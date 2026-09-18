"""Player-local challenges. Server owns targets, attempts, scores and sequence state."""
import secrets
import time
from fastapi import HTTPException

VARIANTS = ('mole', 'rhythm', 'stack', 'basket', 'fruit', 'chef', 'fish', 'memory')
TIMED = ('rhythm', 'stack', 'basket', 'fish')


def challenge(room, player):
    if room['state'] != 'running' or room['config']['mechanic'] != 'reaction':
        raise HTTPException(409, '请等待开场或恢复比赛')
    variant = room['config'].get('reactionVariant') or 'mole'
    if variant == 'mole':
        raise HTTPException(422, '地鼠使用洞口判定')
    old = player.get('challenge')
    now = time.time()
    if old and now - old['created'] < .7:
        raise HTTPException(429, '请稍后开始下一次挑战')
    board = secrets.SystemRandom().sample([0, 0, 1, 1, 2, 2], 6)
    data = dict(token=secrets.token_urlsafe(16), variant=variant, created=now,
                deadline=room['deadline'], used=False, target=secrets.randbelow(41)+30,
                sequence=[secrets.randbelow(4) for _ in range(3)], step=0,
                board=board, matched=[], first=None, turns=0,
                x=secrets.randbelow(51)+25, y=secrets.randbelow(51)+25)
    player['challenge'] = data
    return dict(token=data['token'], variant=variant, target=data['target'],
                sequence=data['sequence'] if variant == 'chef' else [],
                board=board if variant == 'memory' else [], x=data['x'], y=data['y'],
                lifetime=20 if variant == 'memory' else 10)


def act(room, player, data):
    c = player.get('challenge')
    if room['state'] != 'running' or not c or c['token'] != data.token or c['deadline'] != room['deadline']:
        raise HTTPException(409, '挑战已过期，请开始新一轮')
    age = time.time() - c['created']
    variant = c['variant']
    if c['used'] or age > (20 if variant == 'memory' else 10):
        raise HTTPException(409, '本轮已结束')
    points = 0
    result = {}
    if variant in TIMED:
        c['used'] = True
        # Bounded transport tolerance, never accept client-supplied scores.
        if abs(data.elapsed / 1000 - age) > .65:
            raise HTTPException(409, '网络延迟过高，请重试')
        position = (data.elapsed / 30) % 200
        position = position if position <= 100 else 200 - position
        error = abs(position - c['target'])
        points = (3 if error <= 6 else 1 if error <= 16 else 0)
        if variant == 'basket':
            points = 2 if error <= 12 else 0
        if variant == 'fish':
            points = 2 if error <= 10 else 0
        result['precision'] = round(max(0, 100-error))
    elif variant == 'fruit':
        c['used'] = True
        dx, dy = data.x2-data.x1, data.y2-data.y1
        length = dx*dx+dy*dy
        def touches(x, y):
            t = max(0, min(1, ((x-data.x1)*dx+(y-data.y1)*dy)/max(1, length)))
            return (data.x1+t*dx-x)**2 + (data.y1+t*dy-y)**2 <= 12**2
        bomb_x = 85 if c['x'] < 50 else 15
        points = 1 if length >= 225 and touches(c['x'], c['y']) and not touches(bomb_x, 50) else 0
    elif variant == 'chef':
        if age < .15 or data.cell != c['sequence'][c['step']]:
            c['used'] = True
        else:
            c['step'] += 1
            if c['step'] == 3:
                points, c['used'] = 3, True
        result['step'] = c['step']
    elif variant == 'memory':
        if age < 2 or not 0 <= data.cell < 6 or data.cell in c['matched'] or data.cell == c['first']:
            raise HTTPException(409, '请等待记忆结束，选择未配对的另一张卡')
        if c.get('lastAction', 0) + .18 > time.time():
            raise HTTPException(429, '操作太快')
        c['lastAction'] = time.time()
        result['revealed'] = {str(data.cell): c['board'][data.cell]}
        if c['first'] is None:
            c['first'] = data.cell
        else:
            first = c['first']
            result['revealed'][str(first)] = c['board'][first]
            if c['board'][first] == c['board'][data.cell]:
                c['matched'].extend([first, data.cell])
                points = 1
            c['first'] = None
            c['turns'] += 1
            c['used'] = len(c['matched']) == 6 or c['turns'] >= 6
        result['matched'] = c['matched']
    player['score'] += points
    room['scores'][player['team']] += points
    return dict(accepted=points > 0, points=points, done=c['used'], **result)
