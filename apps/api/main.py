"""Single-worker local integration server. Not a production auth service."""
import asyncio
import hashlib
import json
import math
import os
import secrets
import sqlite3
import time
from datetime import datetime, timezone
from contextlib import asynccontextmanager, suppress
from typing import Literal

from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
import game_rules


class Config(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(default='', max_length=2000)
    mechanic: Literal['race', 'tug', 'money', 'alternating', 'light', 'quiz', 'draw', 'catch', 'reaction']
    inputMode: Literal['tap', 'shake'] = 'tap'
    quizText: str = Field(default=game_rules.DEFAULT_QUIZ, max_length=14000)
    winnerCount: int = Field(default=1, ge=1, le=100)
    prizeName: str = Field(default='幸运奖', min_length=1, max_length=60)
    catchDifficulty: Literal['easy', 'normal', 'hard'] = 'normal'
    goal: int = Field(default=1000, ge=10, le=100000)
    theme: Literal['gold', 'space', 'garden']
    duration: int = Field(ge=30, le=600)
    participants: int = Field(ge=2, le=500)
    teams: str = Field(max_length=100)
    brand: str = Field(default='', max_length=60)
    logo: str = Field(default='', max_length=700000)

    @model_validator(mode='after')
    def validate_teams(self):
        if not self.prizeName.strip():
            raise ValueError('奖项名称不能为空')
        if self.mechanic == 'draw' and self.winnerCount > self.participants:
            raise ValueError('中奖名额不能超过预计人数')
        if self.mechanic == 'quiz' and self.duration < len(game_rules.parse_quiz(self.quizText)) * 5:
            raise ValueError('每题至少需要5秒，请增加总时长或减少题目')
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
    guestToken: str = Field(default='', max_length=128)
    name: str = Field(min_length=1, max_length=16)
    team: int = Field(ge=0, le=3)


class Tap(BaseModel):
    seq: int = Field(ge=1, le=2147483647, strict=True)
    kind: Literal['tap', 'shake', 'swipe', 'left', 'right'] = 'tap'


class Hit(BaseModel):
    index: int = Field(ge=0, le=300, strict=True)
    cell: int = Field(ge=0, le=8, strict=True)


class ActivityWrite(BaseModel):
    config: Config
    revision: int = Field(default=0, ge=0)
    sourceId: str = Field(default='', max_length=120)


class Revision(BaseModel):
    revision: int = Field(ge=1)


class AgendaCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    activityIds: list[str] = Field(min_length=1, max_length=20)


class AgendaStep(BaseModel):
    index: int = Field(ge=-1, le=19)


class Command(BaseModel):
    action: Literal['start', 'countdown', 'cancel_countdown', 'pause', 'resume', 'finish', 'abort', 'blackout', 'restore', 'draw']


class Answer(BaseModel):
    index: int = Field(ge=0, le=19, strict=True)
    choice: int = Field(ge=0, le=3, strict=True)


class Move(BaseModel):
    seq: int = Field(ge=1, le=2147483647, strict=True)
    direction: Literal['left', 'right']


class Presence(BaseModel):
    role: Literal['player', 'screen']
    clientId: str = Field(default='', max_length=80)


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


class Engine:
    def __init__(self, path):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute('CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, body TEXT NOT NULL)')
        self.db.execute('CREATE TABLE IF NOT EXISTS workspaces (owner TEXT PRIMARY KEY)')
        self.db.execute('CREATE TABLE IF NOT EXISTS guests (identity TEXT PRIMARY KEY)')
        self.db.execute('CREATE TABLE IF NOT EXISTS agendas (id TEXT PRIMARY KEY, owner TEXT NOT NULL, body TEXT NOT NULL)')
        self.db.execute('CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, owner TEXT NOT NULL, source TEXT NOT NULL, body TEXT NOT NULL)')
        self.db.execute("CREATE UNIQUE INDEX IF NOT EXISTS activity_import ON activities(owner, source) WHERE source != ''")
        self.db.commit()
        self.rooms = {rid: json.loads(body) for rid, body in self.db.execute('SELECT id, body FROM rooms')}
        self.presence = {}
        # A process restart safely pauses active rounds instead of silently consuming time.
        for room in self.rooms.values():
            if room.get('startsAt'):
                room.pop('startsAt', None)
                room['countdown'] = 0
                self.log(room, '服务重启：取消开场倒计时，请重新检查并开场')
                self.save(room)
            if room['state'] == 'running':
                room['remaining'] = max(0, math.ceil(room['deadline'] - time.time()))
                room['state'] = 'paused' if room['remaining'] else 'completed'
                game_rules.advance(room, final=room['state'] == 'completed')
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
        if room.get('trialExpiresAt', float('inf')) <= time.time() and room['state'] not in ['completed', 'aborted']:
            room.update(state='aborted', countdown=0)
            room.pop('startsAt', None)
            self.log(room, '试玩有效期结束；不计入正式活动')
            self.save(room)
        if room.get('startsAt') and room['state'] == 'waiting':
            seconds = max(0, math.ceil(room['startsAt'] - time.time()))
            if seconds != room.get('countdown'):
                room['countdown'] = seconds
                if seconds == 0:
                    room['state'] = 'running'
                    room['deadline'] = room.pop('startsAt') + room['remaining']
                    self.log(room, '倒计时结束，正式开始比赛')
                self.save(room)
        if room['state'] == 'running':
            remaining = max(0, math.ceil(room['deadline'] - time.time()))
            if remaining != room['remaining']:
                room['remaining'] = remaining
                game_rules.advance(room, final=remaining == 0)
                if not remaining:
                    room['state'] = 'completed'
                    self.log(room, '时间到，自动结算')
                self.save(room)
        return room

    def public(self, room):
        config = {k: v for k, v in room['config'].items() if k != 'quizText'}
        active = self.presence.get(room['id'], {})
        now = time.monotonic()
        active = {key: stamp for key, stamp in active.items() if now - stamp < 15}
        self.presence[room['id']] = active
        online = sum(key.startswith('player:') for key in active)
        presence = dict(online=online, offline=max(0, len(room['players'])-online), screens=sum(key.startswith('screen:') for key in active))
        return {**{k: room[k] for k in ['id', 'state', 'remaining', 'scores', 'revision', 'blackout', 'log']}, 'trial': bool(room.get('trialExpiresAt')), 'presence': presence, 'countdown': room.get('countdown', 0), 'agendaId': room.get('agendaId'), 'config': config, 'game': game_rules.public_game(room),
                'players': [{'id': p['id'], 'name': p['name'], 'team': p['team'], 'score': p['score'], 'lane': p.get('lane', 1), 'answered': [int(k) for k in p.get('answers', {})]} for p in room['players'].values()]}

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
        game_rules.initialize(room)
        self.log(room, '创建联机房间')
        self.save(room)
        return {'room': self.public(room), 'token': token}

    def join(self, rid, data):
        room = self.get(rid)
        if room['state'] != 'waiting' or room.get('startsAt'):
            raise HTTPException(409, '已开局，不能新加入；已加入玩家可刷新恢复')
        name = data.name.strip()
        if not name or data.team >= len(room['scores']):
            raise HTTPException(422, '昵称或队伍无效')
        guest = data.guestToken or secrets.token_urlsafe(32)
        identity = digest(guest)
        if data.guestToken and not self.db.execute('SELECT 1 FROM guests WHERE identity=?', (identity,)).fetchone():
            raise HTTPException(403, '游客身份已失效，请清除本站玩家身份后重新入场')
        existing = next(((key, p) for key, p in room['players'].items() if p.get('identity') == identity), None)
        if not existing and len(room['players']) >= room['config']['participants']:
            raise HTTPException(409, '房间人数已满')
        token, pid = secrets.token_urlsafe(32), secrets.token_urlsafe(8)
        self.db.execute('INSERT OR IGNORE INTO guests VALUES (?)', (identity,))
        if existing:
            key, player = existing
            del room['players'][key]
            player['seq'] = 0
            room['players'][digest(token)] = player
            pid = player['id']
        else:
            room['players'][digest(token)] = dict(identity=identity, id=pid, name=name, team=data.team, score=0, seq=0, bucket=10.0, refill=time.time())
        self.save(room)
        return {'token': token, 'playerId': pid, 'guestToken': guest}

    def tap(self, rid, token, seq, kind='tap'):
        room = self.get(rid)
        player = room['players'].get(digest(token))
        if not player:
            raise HTTPException(403, '玩家凭证无效')
        mechanic = room['config']['mechanic']
        if mechanic in ['quiz', 'draw', 'catch', 'reaction']:
            raise HTTPException(422, '本局不支持点击加分')
        allowed = ['left', 'right'] if mechanic == 'alternating' else ['swipe'] if mechanic == 'money' else ['tap']
        if mechanic == 'race' and room['config'].get('inputMode') == 'shake':
            allowed = ['shake', 'tap']  # Explicit accessibility fallback, same scoring budget.
        if kind not in allowed:
            raise HTTPException(422, '本局输入方式不匹配')
        if seq <= player['seq']:
            return {'accepted': False, 'reason': '重复输入', 'seq': player['seq']}
        player['seq'] = seq
        now = time.time()
        player['bucket'] = min(10, player['bucket'] + max(0, now - player['refill']) * 10)
        player['refill'] = now
        same_side = mechanic == 'alternating' and player.get('lastSide') == kind
        accepted = room['state'] == 'running' and player['bucket'] >= 1 and not same_side
        if accepted:
            player['bucket'] -= 1
            player['score'] += 1
            room['scores'][player['team']] += 1
            if mechanic == 'alternating':
                player['lastSide'] = kind
            if mechanic == 'light' and sum(room['scores']) >= room['config'].get('goal', 1000):
                room['state'] = 'completed'
                self.log(room, '全场共同目标达成，点亮完成')
        self.save(room)
        return {'accepted': accepted, 'reason': '' if accepted else '请左右交替点击' if same_side else '未开局、已暂停/结束，或操作过快', 'seq': seq, 'nextSide': 'right' if player.get('lastSide') == 'left' else 'left'}

    def rematch(self, rid, token):
        previous = self.get(rid)
        self.owner(previous, token)
        if previous.get('agendaId'):
            raise HTTPException(409, '本局属于整场编排，请返回编排推进下一环节')
        if previous['state'] not in ['completed', 'aborted']:
            raise HTTPException(409, '请先结束当前局')
        if previous.get('nextRoom'):
            return self.public(self.get(previous['nextRoom']))
        aid = previous.get('activityId')
        if aid:
            row = self.db.execute('SELECT body FROM activities WHERE id=?', (aid,)).fetchone()
            if row and json.loads(row[0])['archived']:
                raise HTTPException(409, '活动已归档，请先取消归档')
            if any(r.get('activityId') == aid and self.get(r['id'])['state'] not in ['completed', 'aborted'] for r in self.rooms.values()):
                raise HTTPException(409, '活动已有未结束的房间，请从云工作区接管')
        created = self.create(dict(previous['config']))
        next_room = self.get(created['room']['id'])
        next_room['owner'] = digest(token)
        next_room['series'] = previous.get('series', previous['id'])
        if previous.get('trialExpiresAt'):
            next_room['trialExpiresAt'] = time.time() + 600
        if aid:
            next_room.update(activityId=aid, workspace=previous['workspace'], round=max(r.get('round', 1) for r in self.rooms.values() if r.get('activityId') == aid) + 1)
        previous['nextRoom'] = next_room['id']
        self.log(previous, '使用相同规则创建下一局')
        self.save(next_room)
        self.save(previous)
        return self.public(next_room)

    def command(self, rid, token, action):
        room = self.get(rid)
        self.owner(room, token)
        if action == 'cancel_countdown':
            if not room.get('startsAt'):
                raise HTTPException(409, '当前没有待取消的倒计时')
            room.pop('startsAt')
            room['countdown'] = 0
            self.log(room, '取消开场倒计时，重新开放入场')
            self.save(room)
            return self.public(room)
        if room.get('startsAt') and action not in ['abort', 'blackout', 'restore']:
            raise HTTPException(409, '正在倒计时，请等待或取消倒计时')
        countdown = action == 'countdown'
        if countdown:
            action = 'start'
        if action == 'draw':
            if not room.get('drawResult'):
                series = room.get('series', room['id'])
                excluded = {identity for old in self.rooms.values() if old.get('series', old['id']) == series for identity in old.get('winnerIdentities', [])}
                game_rules.draw(room, excluded)
                self.log(room, '抽奖完成，名单已锁定，不可重复抽取')
                self.save(room)
            return self.public(room)
        allowed = {'start': ['waiting'], 'pause': ['running'], 'resume': ['paused'], 'finish': ['running', 'paused'], 'abort': ['waiting', 'running', 'paused']}
        if action in ['blackout', 'restore']:
            room['blackout'] = action == 'blackout'
        else:
            if room['state'] not in allowed[action]:
                raise HTTPException(409, '当前阶段不能执行此操作')
            if action == 'start' and not room['players']:
                raise HTTPException(409, '至少需要一名玩家入场')
            if action == 'start' and room['config']['mechanic'] == 'draw' and len(room['players']) < room['config'].get('winnerCount', 1):
                raise HTTPException(409, '入场人数不足中奖名额')
            if action == 'finish':
                game_rules.advance(room, final=True)
            room['state'] = {'start': 'running', 'pause': 'paused', 'resume': 'running', 'finish': 'completed', 'abort': 'aborted'}[action]
            if action in ['start', 'resume']:
                room['deadline'] = time.time() + room['remaining']
            if countdown:
                room.update(state='waiting', startsAt=time.time() + 3, countdown=3)
            if action == 'abort':
                room.pop('startsAt', None)
                room['countdown'] = 0
        if countdown:
            self.log(room, '开始3秒倒计时，关闭新玩家入场')
            self.save(room)
            return self.public(room)
        self.log(room, {'start': '开始比赛', 'pause': '暂停比赛', 'resume': '继续比赛', 'finish': '提前结算', 'abort': '中止比赛', 'blackout': '开启遮罩（不暂停计时）', 'restore': '恢复画面'}[action])
        self.save(room)
        return self.public(room)


def create_app(path=None):
    engine = Engine(path or os.getenv('EVENTPLAY_DB', 'eventplay.sqlite3'))
    lock = asyncio.Lock()
    origins = os.getenv('EVENTPLAY_ORIGINS', 'http://127.0.0.1:4180,http://localhost:4180').split(',')
    sockets = {}
    broadcast_cache = {}

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

    @app.post('/trials')
    async def trial(config: Config):
        async with lock:
            config = Config(**{**config.model_dump(), 'duration': max(30, len(game_rules.parse_quiz(config.quizText)) * 5) if config.mechanic == 'quiz' else 30, 'participants': max(10, config.winnerCount) if config.mechanic == 'draw' else 10})
            created = engine.create(config.model_dump())
            room = engine.get(created['room']['id'])
            room['trialExpiresAt'] = time.time() + 600
            engine.save(room)
            return {**created, 'room': engine.public(room)}

    @app.post('/rooms/{rid}/join')
    async def join(rid: str, data: Join):
        async with lock:
            return engine.join(rid, data)

    def bearer(value):
        return value[7:] if value and value.startswith('Bearer ') else ''

    def workspace(value):
        token = bearer(value)
        key = digest(token)
        if not token or not engine.db.execute('SELECT 1 FROM workspaces WHERE owner=?', (key,)).fetchone():
            raise HTTPException(403, '请连接云工作区；管理密钥无效')
        return key

    def activity(aid, key):
        row = engine.db.execute('SELECT body FROM activities WHERE id=? AND owner=?', (aid, key)).fetchone()
        if not row:
            raise HTTPException(404, '活动不存在或无权访问')
        return json.loads(row[0])

    def put_activity(item):
        engine.db.execute('UPDATE activities SET body=? WHERE id=?', (json.dumps(item, ensure_ascii=False), item['id']))
        engine.db.commit()

    def stamp():
        return datetime.now(timezone.utc).isoformat()

    @app.post('/workspaces')
    async def new_workspace():
        async with lock:
            if engine.db.execute('SELECT count(*) FROM workspaces').fetchone()[0] >= 1000:
                raise HTTPException(429, '预览工作区达到上限')
            token = secrets.token_urlsafe(32)
            engine.db.execute('INSERT INTO workspaces VALUES (?)', (digest(token),))
            engine.db.commit()
            return {'token': token}

    @app.get('/activities')
    async def activities(authorization: str = Header(default='')):
        async with lock:
            key = workspace(authorization)
            return [json.loads(row[0]) for row in engine.db.execute('SELECT body FROM activities WHERE owner=? ORDER BY rowid DESC', (key,))]

    @app.post('/activities')
    async def add_activity(data: ActivityWrite, authorization: str = Header(default='')):
        async with lock:
            key = workspace(authorization)
            if data.sourceId:
                row = engine.db.execute('SELECT body FROM activities WHERE owner=? AND source=?', (key, data.sourceId)).fetchone()
                if row:
                    return json.loads(row[0])
            if engine.db.execute('SELECT count(*) FROM activities WHERE owner=?', (key,)).fetchone()[0] >= 200:
                raise HTTPException(429, '每个工作区最多 200 个活动')
            item = dict(**data.config.model_dump(), id=secrets.token_urlsafe(12), revision=1, archived=False, updatedAt=stamp())
            engine.db.execute('INSERT INTO activities VALUES (?,?,?,?)', (item['id'], key, data.sourceId, json.dumps(item, ensure_ascii=False)))
            engine.db.commit()
            return item

    @app.post('/activities/{aid}/save')
    async def save_activity(aid: str, data: ActivityWrite, authorization: str = Header(default='')):
        async with lock:
            item = activity(aid, workspace(authorization))
            if item['revision'] != data.revision:
                raise HTTPException(409, '活动已被修改，请刷新后重试')
            item.update(data.config.model_dump())
            item.update(revision=item['revision'] + 1, updatedAt=stamp())
            put_activity(item)
            return item

    @app.post('/activities/{aid}/publish')
    async def publish_activity(aid: str, data: Revision, authorization: str = Header(default='')):
        async with lock:
            item = activity(aid, workspace(authorization))
            if item['revision'] != data.revision:
                raise HTTPException(409, '活动已被修改，请刷新后重试')
            item['release'] = dict(version=item.get('release', {}).get('version', 0) + 1, config=Config.model_validate(item).model_dump(), createdAt=stamp())
            item.update(revision=item['revision'] + 1, updatedAt=stamp())
            put_activity(item)
            return item

    @app.post('/activities/{aid}/archive')
    async def archive_activity(aid: str, data: Revision, authorization: str = Header(default='')):
        async with lock:
            item = activity(aid, workspace(authorization))
            if item['revision'] != data.revision:
                raise HTTPException(409, '活动已被修改，请刷新后重试')
            if any(r.get('activityId') == aid and engine.get(r['id'])['state'] not in ['completed', 'aborted'] for r in engine.rooms.values()):
                raise HTTPException(409, '请先结束该活动的联机房间')
            item.update(archived=not item['archived'], revision=item['revision'] + 1, updatedAt=stamp())
            put_activity(item)
            return item

    @app.get('/managed-rooms')
    async def managed_rooms(authorization: str = Header(default='')):
        async with lock:
            key = workspace(authorization)
            return [dict(engine.public(engine.get(r['id'])), activityId=r['activityId'], round=r.get('round', 1)) for r in reversed(list(engine.rooms.values())) if r.get('workspace') == key]

    def agenda_view(item):
        return {**item, 'steps': [{k: v for k, v in step.items() if k != 'config'} for step in item['steps']]}

    @app.get('/events/{agenda_id}')
    async def public_event(agenda_id: str):
        async with lock:
            row = engine.db.execute('SELECT body FROM agendas WHERE id=?', (agenda_id,)).fetchone()
            if not row:
                raise HTTPException(404, '整场活动不存在，请核对入场链接')
            item = json.loads(row[0])
            step = item['steps'][item['index']] if item['index'] >= 0 else None
            room = engine.get(step['roomId']) if step else None
            # Public capability: never return draft configs, future questions or management keys.
            return dict(id=item['id'], name=item['name'], index=item['index'], total=len(item['steps']),
                        roomId=room['id'] if room else None, stepName=step['name'] if step else None,
                        state=room['state'] if room else 'waiting',
                        finished=bool(room and item['index'] == len(item['steps']) - 1 and room['state'] in ['completed', 'aborted']))

    @app.get('/agendas')
    async def list_agendas(authorization: str = Header(default='')):
        async with lock:
            key = workspace(authorization)
            return [agenda_view(json.loads(row[0])) for row in engine.db.execute('SELECT body FROM agendas WHERE owner=? ORDER BY rowid DESC', (key,))]

    @app.post('/agendas')
    async def create_agenda(data: AgendaCreate, authorization: str = Header(default='')):
        async with lock:
            key = workspace(authorization)
            if engine.db.execute('SELECT count(*) FROM agendas WHERE owner=?', (key,)).fetchone()[0] >= 100:
                raise HTTPException(429, '每个工作区最多100场编排')
            steps = []
            for aid in data.activityIds:
                item = activity(aid, key)
                if item['archived'] or not item.get('release'):
                    raise HTTPException(409, '环节必须选择已发布且未归档的活动')
                steps.append(dict(activityId=aid, name=item['release']['config']['name'], config=item['release']['config'], version=item['release']['version']))
            agenda = dict(id=secrets.token_urlsafe(12), name=data.name, index=-1, steps=steps)
            engine.db.execute('INSERT INTO agendas VALUES (?,?,?)', (agenda['id'], key, json.dumps(agenda, ensure_ascii=False)))
            engine.db.commit()
            return agenda_view(agenda)

    @app.post('/agendas/{agenda_id}/next')
    async def next_agenda(agenda_id: str, data: AgendaStep, authorization: str = Header(default='')):
        async with lock:
            key = workspace(authorization)
            row = engine.db.execute('SELECT body FROM agendas WHERE id=? AND owner=?', (agenda_id, key)).fetchone()
            if not row:
                raise HTTPException(404, '编排不存在或无权访问')
            agenda = json.loads(row[0])
            if data.index != agenda['index']:
                raise HTTPException(409, '环节已推进，请刷新编排')
            if agenda['index'] >= 0 and engine.get(agenda['steps'][agenda['index']]['roomId'])['state'] not in ['completed', 'aborted']:
                raise HTTPException(409, '请先结束当前环节，再进入下一环节')
            index = agenda['index'] + 1
            if index >= len(agenda['steps']):
                raise HTTPException(409, '已是最后一个环节')
            step = agenda['steps'][index]
            # Recover an already-created step if the process stopped before saving the agenda.
            room = next((r for r in engine.rooms.values() if r.get('agendaId') == agenda_id and r.get('agendaIndex') == index), None)
            token = secrets.token_urlsafe(32)
            if room is None:
                room = engine.get(engine.create(step['config'])['room']['id'])
                aid = step['activityId']
                room.update(workspace=key, activityId=aid, round=1 + sum(r.get('activityId') == aid for r in engine.rooms.values()), series=agenda_id, agendaId=agenda_id, agendaIndex=index)
            room['owner'] = digest(token)
            engine.save(room)
            step['roomId'] = room['id']
            agenda['index'] = index
            engine.db.execute('UPDATE agendas SET body=? WHERE id=?', (json.dumps(agenda, ensure_ascii=False), agenda_id))
            engine.db.commit()
            return dict(agenda=agenda_view(agenda), room=engine.public(room), token=token)

    @app.post('/agendas/{agenda_id}/host')
    async def host_agenda(agenda_id: str, authorization: str = Header(default='')):
        async with lock:
            key = workspace(authorization)
            row = engine.db.execute('SELECT body FROM agendas WHERE id=? AND owner=?', (agenda_id, key)).fetchone()
            if not row:
                raise HTTPException(404, '编排不存在或无权访问')
            agenda = json.loads(row[0])
            if agenda['index'] < 0:
                raise HTTPException(409, '请先进入首个环节')
            room = engine.get(agenda['steps'][agenda['index']]['roomId'])
            token = secrets.token_urlsafe(32)
            room['owner'] = digest(token)
            engine.log(room, '从整场编排接管，旧主持凭证失效')
            engine.save(room)
            return dict(room=engine.public(room), token=token)

    @app.post('/activities/{aid}/enter')
    async def enter_activity(aid: str, authorization: str = Header(default='')):
        async with lock:
            key = workspace(authorization)
            item = activity(aid, key)
            if item['archived'] or not item.get('release'):
                raise HTTPException(409, '请先发布活动，归档活动不可开局')
            rounds = [engine.get(r['id']) for r in engine.rooms.values() if r.get('activityId') == aid and not r.get('agendaId')]
            room = next((r for r in rounds if r['state'] not in ['completed', 'aborted']), None)
            if room:
                token = secrets.token_urlsafe(32)
                room['owner'] = digest(token)
                engine.log(room, '云工作区重新接管主持权限，旧主持凭证失效')
            else:
                created = engine.create(item['release']['config'])
                token = created['token']
                room = engine.get(created['room']['id'])
                room.update(activityId=aid, workspace=key, round=len(rounds) + 1)
            engine.save(room)
            return {'room': engine.public(room), 'token': token}

    @app.post('/rooms/{rid}/takeover')
    async def takeover_room(rid: str, authorization: str = Header(default='')):
        async with lock:
            key = workspace(authorization)
            room = engine.get(rid)
            if room.get('workspace') != key:
                raise HTTPException(404, '房间不存在或无权访问')
            token = secrets.token_urlsafe(32)
            room['owner'] = digest(token)
            engine.log(room, '云工作区接管当前房间，旧主持凭证失效')
            engine.save(room)
            return dict(room=engine.public(room), token=token)

    @app.post('/rooms/{rid}/tap')
    async def tap(rid: str, data: Tap, authorization: str = Header(default='')):
        async with lock:
            return engine.tap(rid, bearer(authorization), data.seq, data.kind)

    def active_player(rid, authorization):
        room = engine.get(rid)
        player = room['players'].get(digest(bearer(authorization)))
        if not player:
            raise HTTPException(403, '玩家凭证无效')
        return room, player

    @app.post('/rooms/{rid}/answer')
    async def answer(rid: str, data: Answer, authorization: str = Header(default='')):
        async with lock:
            room, player = active_player(rid, authorization)
            result = game_rules.answer(room, player, data.index, data.choice)
            engine.save(room)
            return result

    @app.post('/rooms/{rid}/move')
    async def move(rid: str, data: Move, authorization: str = Header(default='')):
        async with lock:
            room, player = active_player(rid, authorization)
            result = game_rules.move(room, player, data.seq, data.direction)
            if result['accepted']:
                engine.save(room)
            return result

    @app.post('/rooms/{rid}/hit')
    async def hit(rid: str, data: Hit, authorization: str = Header(default='')):
        async with lock:
            room, player = active_player(rid, authorization)
            result = game_rules.hit(room, player, data.index, data.cell)
            engine.save(room)
            return result

    @app.post('/rooms/{rid}/presence')
    async def heartbeat(rid: str, data: Presence, authorization: str = Header(default='')):
        async with lock:
            room = engine.get(rid)
            if data.role == 'player':
                _, player = active_player(rid, authorization)
                key = 'player:' + player['id']
            else:
                if not data.clientId:
                    raise HTTPException(422, '大屏页面需要客户端标识')
                key = 'screen:' + data.clientId
            engine.public(room)  # Expire old heartbeats; never persist presence to SQLite.
            active = engine.presence.setdefault(rid, {})
            if data.role == 'screen' and key not in active and sum(k.startswith('screen:') for k in active) >= 20:
                raise HTTPException(429, '心跳连接数达到上限')
            active[key] = time.monotonic()
            return {'ok': True}

    @app.get('/rooms/{rid}/owner')
    async def verify_owner(rid: str, authorization: str = Header(default='')):
        async with lock:
            engine.owner(engine.get(rid), bearer(authorization))
            return {'verified': True}

    @app.post('/rooms/{rid}/rematch')
    async def rematch(rid: str, authorization: str = Header(default='')):
        async with lock:
            return engine.rematch(rid, bearer(authorization))

    @app.post('/rooms/{rid}/command')
    async def command(rid: str, data: Command, authorization: str = Header(default='')):
        async with lock:
            return engine.command(rid, bearer(authorization), data.action)

    @app.websocket('/rooms/{rid}/stream')
    async def stream(ws: WebSocket, rid: str):
        origin = ws.headers.get('origin')
        view = ws.query_params.get('view', 'full')
        if view not in ['full', 'screen', 'player']:
            await ws.close(code=1008)
            return
        if (origin and origin not in origins) or rid not in engine.rooms or sockets.get(rid, 0) >= 600:
            await ws.close(code=1008)
            return
        await ws.accept()
        sockets[rid] = sockets.get(rid, 0) + 1
        try:
            player_key = None
            if view == 'player':
                credentials = await asyncio.wait_for(ws.receive_json(), timeout=5)
                token = credentials.get('token') if isinstance(credentials, dict) else None
                if not isinstance(token, str) or len(token) > 128:
                    await ws.close(code=1008)
                    return
                player_key = digest(token)
                if player_key not in engine.get(rid)['players']:
                    await ws.close(code=1008)
                    return
            # Public room capability exposes scores/nicknames only; never owner/player tokens.
            last_revision, last_sent = -1, 0.0
            while True:
                async with lock:
                    room = engine.get(rid)
                    if player_key and player_key not in room['players']:
                        await ws.close(code=1008)
                        return
                    now = time.monotonic()
                    cached = broadcast_cache.get(rid)
                    if cached is None or now - cached['at'] >= .2 and (room['revision'] != cached['revision'] or now - cached['at'] >= 2):
                        public = engine.public(room)
                        players = public['players']
                        summary = {**public, 'players': [], 'playerCount': len(players), 'laneCounts': [sum(p['lane'] == i for p in players) for i in range(3)], 'log': []}
                        if public.get('game') and public['game']['type'] == 'draw':
                            if public['game'].get('result'):
                                summary['game'] = {**public['game'], 'result': {**public['game']['result'], 'candidates': []}}
                        cached = dict(at=now, revision=room['revision'], payload=json.dumps(public, ensure_ascii=False, separators=(',', ':')),
                                      summary=summary, players={p['id']: p for p in players}, playerPayloads={}, screenPayload=json.dumps(summary, ensure_ascii=False, separators=(',', ':')))
                        broadcast_cache[rid] = cached
                    snapshot = cached if cached['revision'] != last_revision or now - last_sent >= 2 else None
                    payload = None
                    if snapshot:
                        if view == 'player':
                            pid = room['players'][player_key]['id']
                            if pid not in cached['playerPayloads']:
                                own = cached['players'].get(pid)
                                cached['playerPayloads'][pid] = json.dumps({**cached['summary'], 'players': [own] if own else []}, ensure_ascii=False, separators=(',', ':'))
                            payload = cached['playerPayloads'][pid]
                        else:
                            payload = cached['screenPayload'] if view == 'screen' else cached['payload']
                if snapshot is not None:
                    await asyncio.wait_for(ws.send_text(payload), timeout=3)
                    last_revision, last_sent = snapshot['revision'], time.monotonic()
                await asyncio.sleep(.2)
        except (WebSocketDisconnect, RuntimeError, OSError, asyncio.TimeoutError, ValueError):
            pass
        finally:
            sockets[rid] -= 1
            if not sockets[rid]:
                broadcast_cache.pop(rid, None)

    return app


app = create_app()
