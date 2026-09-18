"""Authoritative lane challenges and grid-control puzzles; no client score claims."""
import secrets
import time
from fastapi import HTTPException

VARIANTS = ('coins', 'runner', 'space', 'ski', 'boat', 'parking', 'maze', 'balance')
GRID = ('parking', 'maze', 'balance')
WALLS = [6, 7, 8, 11, 13, 16, 18]
HOLES = [6, 8, 12, 16, 18]


def initialize(room):
    room['controlWaves'] = [dict(lane=secrets.randbelow(3), kind='bomb' if i % 4 == 3 else 'coin') for i in range(room['config']['duration'])]
    room['controlResolved'] = 0


def state(player):
    return player.setdefault('control', dict(x=0, y=4, heading=0, key=False, completed=0, direction='', message='准备出发'))


def award(room, player, points):
    delta = max(-player['score'], points)
    player['score'] += delta
    room['scores'][player['team']] += delta


def interval(room):
    return {'easy': 3, 'normal': 2, 'hard': 1}[room['config'].get('catchDifficulty', 'normal')]


def advance(room):
    variant = room['config']['controlVariant']
    if variant in GRID:
        return
    end = min(len(room['controlWaves']), (room['config']['duration']-room['remaining']) // interval(room))
    for index in range(room.get('controlResolved', 0), end):
        wave = room['controlWaves'][index]
        target = wave['lane']
        hazard = (target+1) % 3
        for player in room['players'].values():
            lane = player.get('lane', 1)
            if variant == 'coins':
                points = (1 if wave['kind']=='coin' else -1) if lane==target else 0
            elif variant == 'runner':
                # Jump belongs to a single wave, recorded before its resolution.
                hit = lane==hazard and player.get('jumpWave')!=index
                points = -1 if hit else 2 if lane==target else 1
            else:
                points = 2 if lane==target else -1 if lane==hazard else 0
            award(room, player, points)
            state(player)['message'] = f'+{points} 分' if points>0 else '碰到障碍 -1 分' if points<0 else '继续调整方向'
    room['controlResolved'] = end


def public_game(room):
    index = room.get('controlResolved', 0)
    waves = room.get('controlWaves', [])
    wave = waves[index] if index<len(waves) else None
    elapsed = max(0, room['config']['duration']-room['remaining'])
    return dict(type='catch', index=index, interval=interval(room), progress=(elapsed % interval(room))/interval(room),
                lane=wave['lane'] if wave else None, kind=wave['kind'] if wave else None,
                walls=WALLS if room['config']['controlVariant'] in ('maze','parking') else HOLES,
                controlVariant=room['config']['controlVariant'])


def act(room, player, seq, direction):
    variant = room['config'].get('controlVariant')
    if room['state']!='running' or room['config']['mechanic']!='catch' or variant not in VARIANTS:
        raise HTTPException(409, '当前不可控制')
    allowed = ('left','right','forward','back') if variant=='parking' else ('up','down','left','right','brake') if variant=='balance' else ('up','down','left','right') if variant=='maze' else ('left','right','jump') if variant=='runner' else ('left','right')
    if direction not in allowed:
        raise HTTPException(422, '本局不支持该操作')
    now = time.time()
    if seq<=player['seq'] or now-player.get('lastControl',0)<.12:
        return dict(accepted=False, control=state(player), lane=player.get('lane',1))
    player.update(seq=seq,lastControl=now)
    c=state(player)
    if variant not in GRID:
        if direction=='jump':
            index=room.get('controlResolved',0)
            # A held jump cannot protect consecutive waves.
            if player.get('jumpWave',-2)==index-1 or player.get('jumpWave')==index:
                return dict(accepted=False,control=c,lane=player.get('lane',1))
            player['jumpWave']=index
            c['message']='跳跃保护当前障碍'
        else:
            player['lane']=max(0,min(2,player.get('lane',1)+(-1 if direction=='left' else 1)))
    else:
        if variant=='balance' and direction=='brake':
            c['direction']='';c['message']='已刹车，下次移动一格'
            return dict(accepted=True,control=c,lane=player.get('lane',1))
        if variant=='parking' and direction in ('left','right'):
            c['heading']=(c['heading']+(-1 if direction=='left' else 1))%4
        else:
            moves={'up':(0,-1),'right':(1,0),'down':(0,1),'left':(-1,0)}
            if variant=='parking':
                dx,dy=list(moves.values())[c['heading']]
                if direction=='back':dx,dy=-dx,-dy
            else:dx,dy=moves[direction]
            steps=2 if variant=='balance' and c['direction']==direction else 1
            for _ in range(steps):
                x,y=c['x']+dx,c['y']+dy
                cell=y*5+x
                blocked=not (0<=x<5 and 0<=y<5) or cell in (HOLES if variant=='balance' else WALLS)
                if blocked:
                    c['message']='碰到障碍，请换个方向'
                    if variant=='balance':
                        award(room,player,-1);c.update(x=0,y=4,direction='',message='掉入洞口或越界，返回起点 -1 分')
                    break
                c.update(x=x,y=y,direction=direction,message='继续前进')
                if variant=='maze' and (x,y)==(4,4):c.update(key=True,message='拿到钥匙，前往出口')
                goal=(x,y)==(4,0) and (variant!='maze' or c['key']) and (variant!='parking' or c['heading']==0)
                if goal:
                    award(room,player,5);c.update(x=0,y=4,key=False,heading=0,direction='',completed=c['completed']+1,message='闯关成功 +5 分，下一轮！')
                    break
    return dict(accepted=True,control=c,lane=player.get('lane',1))
