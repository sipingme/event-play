"""Server-authoritative rules for quiz, draw and three-lane coin catching."""
import secrets
import time
from fastapi import HTTPException

DEFAULT_QUIZ = 'EventPlay 的玩家从哪里加入？|扫码进入|修改服务器|安装数据库|联系开发者|A\n团队互动最重要的是什么？|共同参与|只有主持人操作|关闭网络|不看规则|A'


def parse_quiz(text):
    questions = []
    for line in text.splitlines():
        if not line.strip():
            continue
        parts = [part.strip() for part in line.split('|')]
        if len(parts) != 6 or any(not part for part in parts) or parts[5].upper() not in 'ABCD' or len(parts[5]) != 1:
            raise ValueError('每题格式：题目|选项A|选项B|选项C|选项D|正确字母')
        if len(parts[0]) > 200 or any(len(p) > 100 for p in parts[1:5]):
            raise ValueError('题目最多200字，选项最多100字')
        questions.append(dict(text=parts[0], options=parts[1:5], correct='ABCD'.index(parts[5].upper())))
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
    mechanic = room['config']['mechanic']
    if mechanic == 'reaction':
        room['targets'] = [secrets.randbelow(9) for _ in range((room['config']['duration'] + 1) // 2)]
    if mechanic == 'quiz':
        room['quiz'] = parse_quiz(room['config'].get('quizText', DEFAULT_QUIZ))
    if mechanic == 'catch':
        room['coinLanes'] = [secrets.randbelow(3) for _ in range(room['config']['duration'] // coin_interval(room))]
        room['resolvedCoins'] = 0


def advance(room, final=False):
    if room['config']['mechanic'] == 'quiz':
        limit = len(room['quiz']) if final else quiz_index(room)
        # An early finish reveals only questions that were actually presented.
        room['revealedQuestions'] = min(len(room['quiz']), quiz_index(room) + (1 if final else 0))
        for player in room['players'].values():
            for key, answer in player.get('answers', {}).items():
                index = int(key)
                if index < limit and not answer['graded']:
                    if answer['choice'] == room['quiz'][index]['correct']:
                        award(room, player, 10)
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
        return dict(type='quiz', reveals=reveals, index=index, total=len(room['quiz']), question={k: question[k] for k in ['text', 'options']} if question else None,
                    seconds=max(0, int((index + 1) * room['config']['duration'] / len(room['quiz'])) - elapsed(room)) if active else 0)
    if mechanic == 'catch':
        index = room.get('resolvedCoins', 0)
        interval = coin_interval(room)
        return dict(type='catch', interval=interval, lane=room['coinLanes'][index] if index < len(room['coinLanes']) else None, progress=(elapsed(room) % interval) / interval, index=index)
    if mechanic == 'draw':
        return dict(type='draw', result=room.get('drawResult'))
    return None


def answer(room, player, index, choice):
    if room['config']['mechanic'] != 'quiz' or room['state'] != 'running' or index != quiz_index(room):
        raise HTTPException(409, '当前不可答题，题目可能已切换或比赛暂停')
    answers = player.setdefault('answers', {})
    if str(index) in answers:
        raise HTTPException(409, '本题已提交，不可重复作答')
    answers[str(index)] = dict(choice=choice, graded=False)
    return {'accepted': True}


def hit(room, player, index, cell):
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
    candidates = [p for p in room['players'].values() if p.get('identity') not in (excluded or set())]
    count = room['config'].get('winnerCount', 1)
    if len(candidates) < count:
        raise HTTPException(409, '排除本系列已中奖身份后，候选人数不足中奖名额')
    winners = secrets.SystemRandom().sample(candidates, count)
    room['winnerIdentities'] = [p['identity'] for p in winners if p.get('identity')]
    room['drawResult'] = dict(prizeName=room['config'].get('prizeName', '幸运奖'), at=int(time.time() * 1000), candidates=[p['id'] for p in candidates],
                              winners=[{'id': p['id'], 'name': p['name']} for p in winners], algorithm='SystemRandom.sample/no-replacement')
    room['state'] = 'completed'
