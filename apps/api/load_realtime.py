"""Isolated localhost HTTP + WebSocket benchmark; not a production capacity promise.

python load_realtime.py --players 50 --rounds 3
Requires httpx and websockets (provided by uvicorn[standard]).
"""
import argparse
import asyncio
import contextlib
import json
import time
from urllib.parse import urlparse

import httpx
from websockets.asyncio.client import connect


def percentile(values, fraction):
    if not values:
        return None
    ordered = sorted(values)
    return round(ordered[min(len(ordered) - 1, int(len(ordered) * fraction))], 2)


async def run(args):
    semaphore = asyncio.Semaphore(100)
    limits = httpx.Limits(max_connections=100, max_keepalive_connections=100)
    async with httpx.AsyncClient(base_url=args.base, limits=limits, timeout=30, trust_env=False) as client:
        async def request(path, body=None, token=None):
            async with semaphore:
                response = await client.request('GET' if body is None else 'POST', path,
                    json=body, headers={'Authorization': 'Bearer ' + token} if token else {})
                response.raise_for_status()
                return response.json()

        created = await request('/rooms', dict(name='隔离WebSocket压测', mechanic='race', theme='gold', duration=600, participants=args.players, teams='红队,蓝队'))
        rid = created['room']['id']
        path = f'/rooms/{rid}'
        ws_url = args.base.replace('http', 'ws', 1) + path + '/stream?view=' + args.view
        sockets, readers = {}, {}
        observed = [0] * args.players
        revisions = [-1] * args.players
        pending = {}
        latencies, http_latencies, reconnect_latencies = [], [], []
        errors = []
        counts = dict(messages=0, bytes=0, accepted=0, unexpectedDisconnects=0, revisionRegressions=0)
        expected_closes = set()
        started = time.perf_counter()

        async def reader(index, ws, ready):
            try:
                async for raw in ws:
                    now = time.perf_counter()
                    state = json.loads(raw)
                    counts['messages'] += 1
                    counts['bytes'] += len(raw.encode() if isinstance(raw, str) else raw)
                    if state['revision'] < revisions[index]:
                        counts['revisionRegressions'] += 1
                    revisions[index] = state['revision']
                    observed[index] = sum(state['scores'])
                    if index in pending:
                        target, at, player_id = pending[index]
                        score = next(p['score'] for p in state['players'] if p['id'] == player_id)
                        if score >= target:
                            latencies.append((now - at) * 1000)
                            del pending[index]
                    ready.set()
            except Exception as error:
                if index not in expected_closes:
                    errors.append(type(error).__name__)
            finally:
                if index not in expected_closes:
                    counts['unexpectedDisconnects'] += 1

        async def attach(index):
            at = time.perf_counter()
            ws = await connect(ws_url, open_timeout=30, close_timeout=2, max_size=4 * 1024 * 1024, max_queue=4)
            if args.view == 'player':
                await ws.send(json.dumps({'token': players[index]['token']}))
            sockets[index] = ws
            ready = asyncio.Event()
            readers[index] = asyncio.create_task(reader(index, ws, ready))
            await asyncio.wait_for(ready.wait(), 30)
            return (time.perf_counter() - at) * 1000

        async def eventually(predicate, timeout=30):
            deadline = time.monotonic() + timeout
            while not predicate():
                if time.monotonic() > deadline:
                    raise TimeoutError('WebSocket state did not converge')
                await asyncio.sleep(.05)

        phase = 'join'
        try:
            players = await asyncio.gather(*(request(path + '/join', {'name': f'P{i}', 'team': i % 2}) for i in range(args.players)))
            phase = 'connect'
            await asyncio.gather(*(attach(i) for i in range(args.players)))
            phase = 'start'
            await request(path + '/command', {'action': 'start'}, created['token'])
            for seq in range(1, args.rounds + 1):
                phase = f'input-round-{seq}'
                async def tap(index):
                    at = time.perf_counter()
                    pending[index] = (seq, at, players[index]['playerId'])
                    result = await request(path + '/tap', {'seq': seq}, players[index]['token'])
                    http_latencies.append((time.perf_counter() - at) * 1000)
                    counts['accepted'] += int(result['accepted'])
                    if not result['accepted']:
                        errors.append('InputRejected')
                        pending.pop(index, None)
                await asyncio.gather(*(tap(i) for i in range(args.players)))
                await eventually(lambda: not pending and all(score == counts['accepted'] for score in observed))
                # Reconnect 10% after round one, keeping the same room/player credentials.
                if seq == 1:
                    phase = 'reconnect'
                    for i in range(max(1, args.players // 10)):
                        expected_closes.add(i)
                        await sockets[i].close()
                        await readers[i]
                        expected_closes.discard(i)
                        reconnect_latencies.append(await attach(i))
                    await eventually(lambda: all(score == counts['accepted'] for score in observed))
                await asyncio.sleep(.25)
            state = await request(path)
            report = dict(players=args.players, view=args.view, rounds=args.rounds, **counts,
                score=sum(state['scores']), allReceiversConverged=all(score == counts['accepted'] for score in observed),
                scoreMatches=sum(state['scores']) == counts['accepted'], errors=errors,
                httpP95_ms=percentile(http_latencies, .95), inputToOwnSnapshotP95_ms=percentile(latencies, .95),
                reconnectFirstSnapshotP95_ms=percentile(reconnect_latencies, .95),
                seconds=round(time.perf_counter()-started, 2),
                scope='Short local test; includes client HTTP queue time, all players receive snapshots, 10% reconnect; no slow receiver/long soak/production capacity claim')
            print(json.dumps(report, ensure_ascii=False, indent=2))
            if errors or counts['unexpectedDisconnects'] or counts['revisionRegressions'] or not report['scoreMatches'] or not report['allReceiversConverged']:
                raise RuntimeError('Realtime benchmark failed validation')
        except Exception as error:
            print(json.dumps(dict(players=args.players, phase=phase, failure=type(error).__name__, **counts, pending=len(pending), seconds=round(time.perf_counter()-started,2)), ensure_ascii=False))
            raise
        finally:
            expected_closes.update(sockets)
            await asyncio.gather(*(ws.close() for ws in sockets.values()), return_exceptions=True)
            for task in readers.values():
                task.cancel()
            await asyncio.gather(*readers.values(), return_exceptions=True)
            with contextlib.suppress(Exception):
                await request(path + '/command', {'action': 'abort'}, created['token'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='http://127.0.0.1:8012')
    parser.add_argument('--players', type=int, choices=[50, 100, 300, 500], default=50)
    parser.add_argument('--rounds', type=int, choices=range(2, 11), default=3)
    parser.add_argument('--view', choices=['player', 'full'], default='player', help='Player projection or legacy full broadcast for comparison')
    args = parser.parse_args()
    if urlparse(args.base).hostname not in ['localhost', '127.0.0.1', '::1']:
        parser.error('Only isolated localhost API instances are supported')
    asyncio.run(run(args))
