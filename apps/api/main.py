"""Single-worker local integration server. Not a production auth service."""
import asyncio
import hashlib
import json
import math
import os
import secrets
import sqlite3
import time
from contextlib import asynccontextmanager, suppress
from typing import Literal

from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator


class Config(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(default='', max_length=2000)
    mechanic: Literal['race', 'tug']
    theme: Literal['gold', 'space', 'garden']
    duration: int = Field(ge=30, le=600)
    participants: int = Field(ge=2, le=500)
    teams: str = Field(max_length=100)
    brand: str = Field(default='', max_length=60)
    logo: str = Field(default='', max_length=700000)

    @model_validator(mode='after')
    def validate_teams(self):
        teams = [t.strip() for t in self.teams.replace('，', ',').split(',')]
        if not 2 <= len(teams) <= 4 or len(set(teams)) != len(teams) or any(not t or len(t) > 16 for t in teams):
            raise ValueError('需要 2–4 个不同队伍，每个名称 1–16 字')
        if self.mechanic == 'tug' and len(teams) != 2:
            raise ValueError('拔河需要两队')
        self.teams = ','.join(teams)
        if self.logo and not self.logo.startswith(('data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,')):
            raise ValueError('仅支持内嵌 PNG/JPEG/WebP 品牌图')
        return self


class Join(BaseModel):
    name: str = Field(min_length=1, max_length=16)
    team: int = Field(ge=0, le=3)


class Tap(BaseModel):
    seq: int = Field(ge=1, le=2147483647, strict=True)


class Command(BaseModel):
    action: Literal['start', 'pause', 'resume', 'finish', 'abort', 'blackout', 'restore']


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


class Engine:
    def __init__(self, path):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute('CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, body TEXT NOT NULL)')
        self.rooms = {rid: json.loads(body) for rid, body in self.db.execute('SELECT id, body FROM rooms')}
        # A process restart safely pauses active rounds instead of silently consuming time.
        for room in self.rooms.values():
            if room['state'] == 'running':
                room['remaining'] = max(0, math.ceil(room['deadline'] - time.time()))
                room['state'] = 'paused' if room['remaining'] else 'completed'
                self.log(room, '服务重启：恢复为暂停或结算状态')
                self.save(room)

    def save(self, room):
        room['revision'] += 1
        self.db.execute('INSERT OR REPLACE INTO rooms VALUES (?, ?)', (room['id'], json.dumps(room, ensure_ascii=False)))
        self.db.commit()

    def log(self, room, text):
        room['log'] = ([{'at': int(time.time() * 1000), 'text': text}] + room['log'])[:50]

    def get(self, rid):
        if rid not in self.rooms:
            raise HTTPException(404, '房间不存在，请核对入场链接')
        room = self.rooms[rid]
        if room['state'] == 'running':
            remaining = max(0, math.ceil(room['deadline'] - time.time()))
            if remaining != room['remaining']:
                room['remaining'] = remaining
                if not remaining:
                    room['state'] = 'completed'
                    self.log(room, '时间到，自动结算')
                self.save(room)
        return room

    def public(self, room):
        return {**{k: room[k] for k in ['id', 'config', 'state', 'remaining', 'scores', 'revision', 'blackout', 'log']},
                'players': [{'id': p['id'], 'name': p['name'], 'team': p['team'], 'score': p['score']} for p in room['players'].values()]}

    def owner(self, room, token):
        if not token or not secrets.compare_digest(room['owner'], digest(token)):
            raise HTTPException(403, '缺少主持人凭证；请在创建房间的浏览器操作')

    def create(self, config):
        if len(self.rooms) >= 1000:
            raise HTTPException(429, '联调房间达到上限')
        rid, token = secrets.token_urlsafe(12), secrets.token_urlsafe(32)
        room = dict(id=rid, config=config, state='waiting', remaining=config['duration'], scores=[0] * len(config['teams'].split(',')),
                    deadline=0, revision=0, blackout=False, log=[], players={}, owner=digest(token))
        self.rooms[rid] = room
        self.log(room, '创建联机房间')
        self.save(room)
        return {'room': self.public(room), 'token': token}

    def join(self, rid, data):
        room = self.get(rid)
        if room['state'] != 'waiting':
            raise HTTPException(409, '已开局，不能新加入；已加入玩家可刷新恢复')
        if len(room['players']) >= room['config']['participants']:
            raise HTTPException(409, '房间人数已满')
        name = data.name.strip()
        if not name or data.team >= len(room['scores']):
            raise HTTPException(422, '昵称或队伍无效')
        token, pid = secrets.token_urlsafe(32), secrets.token_urlsafe(8)
        room['players'][digest(token)] = dict(id=pid, name=name, team=data.team, score=0, seq=0, bucket=10.0, refill=time.time())
        self.save(room)
        return {'token': token, 'playerId': pid}

    def tap(self, rid, token, seq):
        room = self.get(rid)
        player = room['players'].get(digest(token))
        if not player:
            raise HTTPException(403, '玩家凭证无效')
        if seq <= player['seq']:
            return {'accepted': False, 'reason': '重复输入', 'seq': player['seq']}
        player['seq'] = seq
        now = time.time()
        player['bucket'] = min(10, player['bucket'] + max(0, now - player['refill']) * 10)
        player['refill'] = now
        accepted = room['state'] == 'running' and player['bucket'] >= 1
        if accepted:
            player['bucket'] -= 1
            player['score'] += 1
            room['scores'][player['team']] += 1
        self.save(room)
        return {'accepted': accepted, 'reason': '' if accepted else '未开局、已暂停/结束，或点击过快', 'seq': seq}

    def command(self, rid, token, action):
        room = self.get(rid)
        self.owner(room, token)
        allowed = {'start': ['waiting'], 'pause': ['running'], 'resume': ['paused'], 'finish': ['running', 'paused'], 'abort': ['waiting', 'running', 'paused']}
        if action in ['blackout', 'restore']:
            room['blackout'] = action == 'blackout'
        else:
            if room['state'] not in allowed[action]:
                raise HTTPException(409, '当前阶段不能执行此操作')
            if action == 'start' and not room['players']:
                raise HTTPException(409, '至少需要一名玩家入场')
            room['state'] = {'start': 'running', 'pause': 'paused', 'resume': 'running', 'finish': 'completed', 'abort': 'aborted'}[action]
            if action in ['start', 'resume']:
                room['deadline'] = time.time() + room['remaining']
        self.log(room, {'start': '开始比赛', 'pause': '暂停比赛', 'resume': '继续比赛', 'finish': '提前结算', 'abort': '中止比赛', 'blackout': '开启遮罩（不暂停计时）', 'restore': '恢复画面'}[action])
        self.save(room)
        return self.public(room)


def create_app(path=None):
    engine = Engine(path or os.getenv('EVENTPLAY_DB', 'eventplay.sqlite3'))
    lock = asyncio.Lock()
    origins = os.getenv('EVENTPLAY_ORIGINS', 'http://127.0.0.1:4180,http://localhost:4180').split(',')
    sockets = {}

    async def tick():
        while True:
            await asyncio.sleep(.2)
            async with lock:
                for rid in list(engine.rooms):
                    engine.get(rid)

    @asynccontextmanager
    async def lifespan(app):
        task = asyncio.create_task(tick())
        yield
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        engine.db.close()

    app = FastAPI(title='EventPlay local realtime MVP', lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=['GET', 'POST'], allow_headers=['Content-Type', 'Authorization'])
    app.state.engine = engine

    @app.get('/health')
    async def health():
        return {'status': 'ok', 'mode': 'development', 'guest': True}

    @app.post('/rooms')
    async def create(config: Config):
        # Bootstrap is intentionally development-only; bind loopback by default.
        async with lock:
            return engine.create(config.model_dump())

    @app.get('/rooms/{rid}')
    async def room(rid: str):
        async with lock:
            return engine.public(engine.get(rid))

    @app.post('/rooms/{rid}/join')
    async def join(rid: str, data: Join):
        async with lock:
            return engine.join(rid, data)

    def bearer(value):
        return value[7:] if value and value.startswith('Bearer ') else ''

    @app.post('/rooms/{rid}/tap')
    async def tap(rid: str, data: Tap, authorization: str = Header(default='')):
        async with lock:
            return engine.tap(rid, bearer(authorization), data.seq)

    @app.get('/rooms/{rid}/owner')
    async def verify_owner(rid: str, authorization: str = Header(default='')):
        async with lock:
            engine.owner(engine.get(rid), bearer(authorization))
            return {'verified': True}

    @app.post('/rooms/{rid}/command')
    async def command(rid: str, data: Command, authorization: str = Header(default='')):
        async with lock:
            return engine.command(rid, bearer(authorization), data.action)

    @app.websocket('/rooms/{rid}/stream')
    async def stream(ws: WebSocket, rid: str):
        origin = ws.headers.get('origin')
        if (origin and origin not in origins) or rid not in engine.rooms or sockets.get(rid, 0) >= 600:
            await ws.close(code=1008)
            return
        await ws.accept()
        sockets[rid] = sockets.get(rid, 0) + 1
        try:
            # Public room capability exposes scores/nicknames only; never owner/player tokens.
            while True:
                async with lock:
                    snapshot = engine.public(engine.get(rid))
                await asyncio.wait_for(ws.send_json(snapshot), timeout=3)
                await asyncio.sleep(.2)
        except (WebSocketDisconnect, RuntimeError, OSError, asyncio.TimeoutError):
            pass
        finally:
            sockets[rid] -= 1

    return app


app = create_app()
