"""Local-only HTTP input benchmark. Run against a disposable API/database, never production.

Example: python load_inputs.py --players 50 --rounds 5
Does not simulate WebSocket receivers or establish a supported audience capacity.
"""
import argparse
import concurrent.futures
import json
import time
import urllib.request
from urllib.parse import urlparse


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='http://127.0.0.1:8012')
    parser.add_argument('--players', type=int, choices=[50, 100, 300, 500], default=50)
    parser.add_argument('--rounds', type=int, choices=range(1, 11), default=5)
    args = parser.parse_args()
    if urlparse(args.base).hostname not in ['127.0.0.1', 'localhost', '::1']:
        parser.error('Only a disposable localhost API is supported')
    def request(path, body=None, token=None):
        headers={'Content-Type':'application/json'}
        if token:
            headers['Authorization']='Bearer '+token
        payload=json.dumps(body).encode() if body is not None else None
        req=urllib.request.Request(args.base+path,data=payload,headers=headers)
        with urllib.request.urlopen(req,timeout=15) as response:
            return json.load(response)
    created=request('/rooms',dict(name='本地输入压测',mechanic='race',theme='gold',duration=600,participants=args.players,teams='红队,蓝队'))
    rid=created['room']['id']
    latencies=[]
    accepted=errors=0
    started=time.perf_counter()
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(args.players,100)) as pool:
            players=list(pool.map(lambda i:request(f'/rooms/{rid}/join',{'name':f'P{i}','team':i%2}),range(args.players)))
            request(f'/rooms/{rid}/command',{'action':'start'},created['token'])
            def tap(task):
                player,seq=task
                at=time.perf_counter()
                try:
                    result=request(f'/rooms/{rid}/tap',{'seq':seq},player['token'])
                    return (time.perf_counter()-at)*1000,result['accepted'],False
                except Exception:
                    return (time.perf_counter()-at)*1000,False,True
            for seq in range(1,args.rounds+1):
                for latency,ok,failed in pool.map(tap,[(p,seq) for p in players]):
                    latencies.append(latency)
                    accepted+=int(ok)
                    errors+=int(failed)
            state=request(f'/rooms/{rid}')
            latencies.sort()
            print(json.dumps(dict(players=args.players,workers=min(args.players,100),requests=len(latencies),accepted=accepted,errors=errors,score=sum(state['scores']),scoreMatches=sum(state['scores'])==accepted,p50_ms=round(latencies[len(latencies)//2],2),p95_ms=round(latencies[min(len(latencies)-1,int(len(latencies)*.95))],2),seconds=round(time.perf_counter()-started,2),scope='HTTP inputs only; no websocket broadcast/load or production capacity claim'),ensure_ascii=False,indent=2))
            if errors or sum(state['scores'])!=accepted:
                raise SystemExit(1)
    finally:
        request(f'/rooms/{rid}/command',{'action':'abort'},created['token'])


if __name__=='__main__':
    main()
