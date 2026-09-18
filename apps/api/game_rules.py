"""Server-authoritative rules for quiz, draw and three-lane coin catching."""
import secrets
import time
import control_rules
import wall_rules
import vote_rules
import create_rules
import social_rules
from fastapi import HTTPException

DEFAULT_QUIZ = 'EventPlay 的玩家从哪里加入？|扫码进入|修改服务器|安装数据库|联系开发者|A\n团队互动最重要的是什么？|共同参与|只有主持人操作|关闭网络|不看规则|A'


def parse_quiz(text):
    questions = []
    for line in text.splitlines():
        if not line.strip():
            continue
        parts = [part.strip() for part in line.split('|')]
        if len(parts) not in (6, 7, 8) or any(not part for part in parts[:6]) or parts[5].upper() not in 'ABCD' or len(parts[5]) != 1:
            raise ValueError('每题格式：题目|选项A|选项B|选项C|选项D|正确字母')
        if len(parts[0]) > 200 or any(len(p) > 100 for p in parts[1:5]):
            raise ValueError('题目最多200字，选项最多100字')
        image = parts[6] if len(parts) >= 7 else ''
        if image and (not image.startswith('/games/') or '..' in image or '?' in image or '#' in image):
            raise ValueError('题图仅支持 /games/ 下的本地素材路径')
        clues = parts[7].split('~') if len(parts) == 8 else []
        if len(clues) > 3 or any(not c.strip() or len(c) > 100 for c in clues):
            raise ValueError('最多3条线索，每条1～100字，用~分隔')
        questions.append(dict(text=parts[0], options=parts[1:5], correct='ABCD'.index(parts[5].upper()), image=image, clues=clues))
    if not 1 <= len(questions) <= 20:
        raise ValueError('请配置1～20道题')
    return questions


def elapsed(room):
    return max(0, room['config']['duration'] - room['remaining'])


def quiz_index(room):
    return min(len(room['quiz']), int(elapsed(room) * len(room['quiz']) / room['config']['duration']))


def award(room, player, points):
    player['score'] += points
    room['scores'][player['team']] += points


def coin_interval(room):
    return {'easy': 3, 'normal': 2, 'hard': 1}[room['config'].get('catchDifficulty', 'normal')]


def initialize(room):
    if room['config'].get('controlVariant'):
        control_rules.initialize(room)
        return
    mechanic = room['config']['mechanic']
    if mechanic == 'reaction':
        room['targets'] = [secrets.randbelow(9) for _ in range((room['config']['duration'] + 1) // 2)]
    if mechanic == 'quiz':
        room['quiz'] = parse_quiz(room['config'].get('quizText', DEFAULT_QUIZ))
    if mechanic == 'catch':
        room['coinLanes'] = [secrets.randbelow(3) for _ in range(room['config']['duration'] // coin_interval(room))]
        room['resolvedCoins'] = 0


def advance(room, final=False):
    if room['config'].get('controlVariant'):
        control_rules.advance(room)
        return
    if room['config']['mechanic'] == 'quiz':
        limit = len(room['quiz']) if final else quiz_index(room)
        # An early finish reveals only questions that were actually presented.
        room['revealedQuestions'] = min(len(room['quiz']), quiz_index(room) + (1 if final else 0))
        for player in room['players'].values():
            for key, answer in player.get('answers', {}).items():
                index = int(key)
                if index < limit and not answer['graded']:
                    if answer['choice'] == room['quiz'][index]['correct']:
                        award(room, player, answer.get('points', 10))
                    answer['graded'] = True
    if room['config']['mechanic'] == 'catch':
        resolved = room.get('resolvedCoins', 0)
        target = min(len(room['coinLanes']), elapsed(room) // coin_interval(room))
        for index in range(resolved, target):
            for player in room['players'].values():
                if player.get('lane', 1) == room['coinLanes'][index]:
                    award(room, player, 1)
        room['resolvedCoins'] = target


def public_game(room):
    if room['config']['mechanic']=='social':return social_rules.public(room)
    if room['config']['mechanic']=='create':return create_rules.public(room)
    if room['config']['mechanic']=='vote':return vote_rules.public(room)
    if room['config']['mechanic']=='wall':return wall_rules.public(room)
    if room['config'].get('controlVariant'):
        return control_rules.public_game(room)
    mechanic = room['config']['mechanic']
    if mechanic == 'reaction':
        index = elapsed(room) // 2
        active = room['state'] in ['running', 'paused'] and index < len(room['targets'])
        return dict(type='reaction', index=index, cell=room['targets'][index] if active else None, interval=2)
    if mechanic == 'quiz':
        index = quiz_index(room)
        active = room['state'] in ['running', 'paused'] and index < len(room['quiz'])
        question = room['quiz'][index] if active else None
        reveals = [dict(index=i, text=q['text'], correct=q['correct'], answer=q['options'][q['correct']])
                   for i, q in enumerate(room['quiz'][:room.get('revealedQuestions', 0)])]
        seconds = max(0, int((index + 1) * room['config']['duration'] / len(room['quiz'])) - elapsed(room)) if active else 0
        stage = min(2, int((elapsed(room) - index * room['config']['duration'] / len(room['quiz'])) / (room['config']['duration'] / len(room['quiz'])) * 3)) if active else 0
        variant = room['config'].get('quizVariant') or 'adventure'
        public = {k: question[k] for k in ['text', 'options']} if question else None
        if public:
            if variant == 'boolean': public['options'] = public['options'][:2]
            public['image'] = question.get('image', '')
            public['clues'] = question.get('clues', [])[:stage + 1]
        buzz = room.get('buzzers', {}).get(str(index))
        return dict(type='quiz', reveals=reveals, index=index, total=len(room['quiz']), question=public, seconds=seconds,
                    revealStage=stage, points=30-stage*10 if variant == 'clues' else 10,
                    buzzer=buzz, goal=room['config'].get('goal', 1000))
    if mechanic == 'catch':
        index = room.get('resolvedCoins', 0)
        interval = coin_interval(room)
        return dict(type='catch', interval=interval, lane=room['coinLanes'][index] if index < len(room['coinLanes']) else None, progress=(elapsed(room) % interval) / interval, index=index)
    if mechanic == 'draw':
        return dict(type='draw', result=room.get('drawResult'), charge=room.get('drawCharge',0), wishes=room.get('drawWishes',{}), revealed=room.get('drawRevealed',[]))
    return None


def answer(room, player, index, choice):
    if room['config']['mechanic'] != 'quiz' or room['state'] != 'running' or index != quiz_index(room):
        raise HTTPException(409, '当前不可答题，题目可能已切换或比赛暂停')
    answers = player.setdefault('answers', {})
    if room['config'].get('quizVariant') == 'boolean' and choice not in (0, 1):
        raise HTTPException(422, '判断题仅可选择对或错')
    if room['config'].get('quizVariant') == 'buzzer' and room.get('buzzers', {}).get(str(index)) != player['id']:
        raise HTTPException(409, '请先抢到本题作答资格')
    if str(index) in answers:
        raise HTTPException(409, '本题已提交，不可重复作答')
    points = public_game(room)['points']
    answers[str(index)] = dict(choice=choice, graded=False, points=points)
    return {'accepted': True}


def buzz(room, player, index):
    if room['config'].get('quizVariant') != 'buzzer' or room['state'] != 'running' or index != quiz_index(room) or index >= len(room['quiz']):
        raise HTTPException(409, '当前不可抢答')
    buzzers = room.setdefault('buzzers', {})
    if str(index) in buzzers and buzzers[str(index)] != player['id']:
        raise HTTPException(409, '本题资格已被抢到，下一题再试')
    buzzers[str(index)] = player['id']
    return {'accepted': True}


def hit(room, player, index, cell):
    if room['config'].get('reactionVariant') not in (None, 'mole'):
        raise HTTPException(422, '本局不支持打地鼠输入')
    if room['config']['mechanic'] != 'reaction' or room['state'] != 'running' or index != elapsed(room) // 2:
        raise HTTPException(409, '目标已切换或比赛未进行，请等待下一轮')
    if player.get('lastHit', -1) >= index:
        raise HTTPException(409, '每轮只能出手一次，请等待下一只地鼠')
    player['lastHit'] = index
    accepted = cell == room['targets'][index]
    if accepted:
        award(room, player, 1)
    return {'accepted': accepted}


def move(room, player, seq, direction):
    if room['config'].get('controlVariant'):
        raise HTTPException(422, '请使用控制游戏专用输入')
    if room['config']['mechanic'] != 'catch' or room['state'] != 'running':
        raise HTTPException(409, '当前不可移动')
    now = time.time()
    if seq <= player['seq'] or now - player.get('lastMove', 0) < .15:
        return {'accepted': False, 'lane': player.get('lane', 1)}
    player['seq'] = seq
    player['lane'] = max(0, min(2, player.get('lane', 1) + (-1 if direction == 'left' else 1)))
    player['lastMove'] = now
    return {'accepted': True, 'lane': player['lane']}


def draw(room, excluded=None):
    if room['config']['mechanic'] != 'draw':
        raise HTTPException(409, '本局不是抽奖')
    if room.get('drawResult'):
        return
    if room['state'] != 'running':
        raise HTTPException(409, '请先开始抽奖；结束或中止后不能开奖')
    if room['config'].get('drawVariant')=='treasure' and room.get('drawCharge',0)<room['config'].get('goal',1000):
        raise HTTPException(409,'开箱能量尚未达标，请邀请玩家继续助力')
    candidates = [p for p in room['players'].values() if p.get('identity') not in (excluded or set())]
    count = room['config'].get('winnerCount', 1)
    if len(candidates) < count:
        raise HTTPException(409, '排除本系列已中奖身份后，候选人数不足中奖名额')
    winners = secrets.SystemRandom().sample(candidates, count)
    room['winnerIdentities'] = [p['identity'] for p in winners if p.get('identity')]
    room['drawResult'] = dict(prizeName=room['config'].get('prizeName', '幸运奖'), at=int(time.time() * 1000), candidates=[p['id'] for p in candidates],
                              winners=[{'id': p['id'], 'name': p['name']} for p in winners], algorithm='SystemRandom.sample/no-replacement')
    room['state'] = 'completed'
