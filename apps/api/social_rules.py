"""Consent-based icebreakers. Public projections never contain contacts or unrevealed answers."""
import secrets
import time
from collections import Counter
from typing import Literal
from fastapi import HTTPException
from pydantic import BaseModel, Field

VARIANTS=('team','interest','match','same','bingo','truth','cards','story','praise')
INTERESTS=('露营','阅读','运动','音乐','旅行','美食','摄影','电影','宠物')
QUESTIONS=('周末更喜欢？','旅行更喜欢？','合作更喜欢？')
CHOICES=(('户外活动','室内放松'),('提前规划','随心出发'),('先讨论','先尝试'))
TASKS=('互相介绍昵称','找到一个共同爱好','一起想一个团队口号')

class SocialInput(BaseModel):
    action:Literal['enroll','leave','invite','accept','decline','cancel','answer','task','post','guess']
    code:str=Field(default='',max_length=8)
    id:str=Field(default='',max_length=80)
    interests:list[int]=Field(default_factory=list,max_length=9)
    contact:str=Field(default='',max_length=100)
    text:str=Field(default='',max_length=240)
    index:int=Field(default=0,ge=0,le=8,strict=True)
    choice:int=Field(default=0,ge=0,le=2,strict=True)
    statements:list[str]=Field(default_factory=list,max_length=3)

class SocialCommand(BaseModel):
    action:Literal['approve','hide','close','reveal']
    id:str=Field(default='',max_length=80)

def state(room):
    return room.setdefault('social',dict(profiles={},requests={},answers={},bingo={},tasks={},posts={},guesses={},turns={},closed=False,revealed=False))

def checked(room):
    if room['config']['mechanic']!='social':raise HTTPException(409,'本场不是社交破冰')
    return state(room)

def active(s,pid):return s['profiles'].get(pid,{}).get('active',False)
def status(r):
    return 'expired' if r['status']=='pending' and r['until']<=time.time() else r['status']
def members(s,group):return [pid for pid,p in s['profiles'].items() if p['active'] and p['group']==group]
def turn(s,group):
    people=members(s,group)
    return people[s['turns'].get(str(group),0)%len(people)] if people else None
def paired(s,pid):
    return next((r for r in reversed(list(s['requests'].values())) if r['kind'] in ('interest','match','same') and pid in (r['from'],r['to']) and status(r) in ('pending','accepted')),None)
def cancel_connections(s,pid):
    for r in s['requests'].values():
        if pid in (r['from'],r['to']) and status(r) in ('pending','accepted'):r['status']='cancelled';r.pop('contacts',None)

def act(room,player,data):
    s=checked(room);pid=player['id'];v=room['config'].get('socialVariant','team')
    # Withdrawal remains possible after closing.
    if data.action=='leave':
        if pid in s['profiles']:s['profiles'][pid]['active']=False;s['profiles'][pid]['contact']=''
        cancel_connections(s,pid)
        for post in s['posts'].values():
            if post['author']==pid:post['status']='hidden'
        return dict(accepted=True)
    if room['state']!='running' or s['closed']:raise HTTPException(409,'破冰尚未开放、已暂停或已结束')
    if data.action=='enroll':
        if any(type(i)!=int or i not in range(9) for i in data.interests):raise HTTPException(422,'兴趣选项无效')
        if pid not in s['profiles']:
            count=max(2,len(room['config']['teams'].split(',')))
            totals=[sum(p['active'] and p['group']==i for p in s['profiles'].values()) for i in range(count)]
            code=secrets.token_hex(3).upper()
            while code in [p['code'] for p in s['profiles'].values()]:code=secrets.token_hex(3).upper()
            s['profiles'][pid]=dict(code=code,group=secrets.choice([i for i,n in enumerate(totals) if n==min(totals)]),symbol=len(s['profiles'])//2%6)
        s['profiles'][pid].update(active=True,interests=sorted(set(data.interests)) if v=='interest' else [],contact=data.contact.strip() if v=='cards' else '')
        return dict(accepted=True)
    if not active(s,pid):raise HTTPException(409,'请先自愿加入破冰')
    if data.action in ('accept','decline','cancel'):
        r=s['requests'].get(data.id)
        if not r:raise HTTPException(404,'邀请不存在')
        if data.action=='cancel':
            if pid not in (r['from'],r['to']):raise HTTPException(403,'不能取消他人的邀请')
            r['status']='cancelled';r.pop('contacts',None);return dict(accepted=True)
        if r['to']!=pid:raise HTTPException(403,'只有被邀请者可以回应')
        if status(r)!='pending' or not active(s,r['from']):raise HTTPException(409,'邀请已变化或过期')
        if data.action=='decline':r['status']='declined';return dict(accepted=True)
        if r['kind']=='bingo':
            cells=s['bingo'].setdefault(r['from'],{})
            if str(r['index']) in cells or pid in cells.values():raise HTTPException(409,'这个格子已确认，或该伙伴已经帮助确认过其他格子')
            cells[str(r['index'])]=pid
        if r['kind']=='cards':
            if not s['profiles'][pid]['contact'] or not s['profiles'][r['from']]['contact']:raise HTTPException(409,'双方须先自愿填写交换信息')
            r['contacts']={p:s['profiles'][p]['contact'] for p in (pid,r['from'])}
        r['status']='accepted';return dict(accepted=True)
    if data.action=='invite':
        if v not in ('interest','match','same','bingo','cards','praise'):raise HTTPException(409,'本玩法不使用邀请')
        if len(s['requests'])>=1000:raise HTTPException(409,'本场邀请已达1000条，请新建活动')
        if sum(r['from']==pid and status(r)=='pending' for r in s['requests'].values())>=3:raise HTTPException(409,'最多同时保留3个待回应邀请')
        if v in ('interest','match','same') and paired(s,pid):raise HTTPException(409,'请先取消当前邀请或配对')
        target=next((p for p,profile in s['profiles'].items() if profile['code']==data.code.strip().upper() and profile['active']),None)
        if not data.code and v=='interest':
            target=next((p for p,profile in s['profiles'].items() if p!=pid and profile['active'] and set(profile['interests'])&set(s['profiles'][pid]['interests']) and not paired(s,p)),None)
        if not target or target==pid:raise HTTPException(409,'未找到可邀请的伙伴，请核对破冰码')
        if v in ('interest','match','same') and paired(s,target):raise HTTPException(409,'对方已有邀请或配对')
        if v=='interest' and not set(s['profiles'][target]['interests'])&set(s['profiles'][pid]['interests']):raise HTTPException(409,'双方尚无相同兴趣')
        if v=='same' and s['profiles'][target]['symbol']!=s['profiles'][pid]['symbol']:raise HTTPException(409,'图案不同，请继续寻找同款')
        if v=='bingo' and (str(data.index) in s['bingo'].get(pid,{}) or target in s['bingo'].get(pid,{}).values()):raise HTTPException(409,'请找不同伙伴确认未完成格子')
        if any(r['from']==pid and r['to']==target and r['kind']==v and status(r) in ('pending','accepted') for r in s['requests'].values()):raise HTTPException(409,'已向这位伙伴发送过邀请')
        if v=='praise' and not data.text.strip():raise HTTPException(422,'请填写鼓励的话')
        if v=='praise' and len(s['posts'])>=200:raise HTTPException(409,'本场最多200条公开内容')
        if time.time()-player.get('lastSocialInvite',0)<1:raise HTTPException(429,'邀请过于频繁，请稍后')
        rid=secrets.token_urlsafe(10)
        s['requests'][rid]=dict(id=rid,kind=v,**{'from':pid,'to':target},index=data.index,text=data.text.strip() if v=='praise' else '',status='pending',until=time.time()+120)
        if v=='praise':s['posts'][rid]=dict(id=rid,author=pid,group=s['profiles'][pid]['group'],text=data.text.strip(),statements=[],status='pending',kind=v)
        player['lastSocialInvite']=time.time();return dict(accepted=True)
    if data.action=='answer':
        r=paired(s,pid)
        if v!='match' or not r or r['status']!='accepted':raise HTTPException(409,'请先完成双方配对')
        if data.id!=r['id']:raise HTTPException(409,'配对已变化，请刷新后重新作答')
        if data.index>=3 or data.choice>=2:raise HTTPException(422,'题目或选项无效')
        answers=s['answers'].setdefault(r['id'],{}).setdefault(pid,{})
        if str(data.index) in answers:raise HTTPException(409,'该题已提交')
        answers[str(data.index)]=data.choice;return dict(accepted=True)
    if data.action=='task':
        if v!='team' or data.index>=3:raise HTTPException(422,'任务无效')
        group=s['profiles'][pid]['group'];key=str(group)+':'+str(data.index)
        confirmations=s['tasks'].setdefault(key,[])
        if pid not in confirmations:confirmations.append(pid)
        return dict(accepted=True)
    if data.action=='post':
        if v not in ('truth','story'):raise HTTPException(409,'本玩法不使用故事提交')
        if len(s['posts'])>=200:raise HTTPException(409,'本场最多200条故事')
        if v=='truth':
            if any(p['author']==pid for p in s['posts'].values()):raise HTTPException(409,'每人只提交一组经历，请主持人审核')
            if len(data.statements)!=3 or any(not t.strip() or len(t)>60 for t in data.statements) or len(set(data.statements))!=3:raise HTTPException(422,'需要三条不同的经历，每条1～60字')
        group=s['profiles'][pid]['group']
        if v=='story':
            if not data.text.strip():raise HTTPException(422,'请填写接龙内容')
            if turn(s,group)!=pid:raise HTTPException(409,'请等待你的接龙回合')
            if any(p['kind']=='story' and p['group']==group and p['status']=='pending' for p in s['posts'].values()):raise HTTPException(409,'本组上一句正在审核')
        postid=secrets.token_urlsafe(10)
        s['posts'][postid]=dict(id=postid,author=pid,group=group,text=data.text.strip(),statements=[t.strip() for t in data.statements] if v=='truth' else [],lie=data.choice,status='pending',kind=v)
        return dict(accepted=True)
    if data.action=='guess':
        post=s['posts'].get(data.id)
        if v!='truth' or not post or post['status']!='approved' or post['author']==pid or s['revealed']:raise HTTPException(409,'当前不可猜题')
        guesses=s['guesses'].setdefault(data.id,{})
        if pid in guesses:raise HTTPException(409,'每组经历只能猜一次')
        guesses[pid]=data.choice;return dict(accepted=True)
    raise HTTPException(422,'操作与玩法不匹配')

def command(room,data):
    s=checked(room)
    if room['state'] not in ('running','paused'):raise HTTPException(409,'请在活动进行中操作')
    if data.action=='close':s['closed']=True;return
    if data.action=='reveal':
        if room['config'].get('socialVariant')!='truth' or not s['closed']:raise HTTPException(409,'请先截止两真一假，再揭晓')
        s['revealed']=True;return
    post=s['posts'].get(data.id)
    if not post:raise HTTPException(404,'内容不存在')
    if data.action=='hide':post['status']='hidden';return
    if post['status']=='approved':return
    if post['kind']=='praise' and status(s['requests'][post['id']])!='accepted':raise HTTPException(409,'请等待接收者确认')
    if post['kind']=='story':
        if post.get('advanced'):raise HTTPException(409,'已隐藏的历史句子不可重新加入接龙')
        if turn(s,post['group'])!=post['author']:raise HTTPException(409,'作者已退出或回合已变化')
        s['turns'][str(post['group'])]=s['turns'].get(str(post['group']),0)+1;post['advanced']=True
    if not active(s,post['author']):raise HTTPException(409,'作者已退出')
    post['status']='approved'

def published(s):
    result=[]
    for p in s['posts'].values():
        if p['status']!='approved' or not active(s,p['author']):continue
        if p['kind']=='praise' and status(s['requests'][p['id']])!='accepted':continue
        result.append(dict(id=p['id'],group=p['group'],text=p['text'],statements=p['statements'],kind=p['kind'],**({'lie':p['lie']} if p['kind']=='truth' and s['revealed'] else {})))
    return result

def public(room):
    s=state(room);profiles=[p for p in s['profiles'].values() if p['active']]
    count=max(2,len(room['config']['teams'].split(',')))
    groups=[dict(index=i,members=len(members(s,i)),tasks=[sum(pid in members(s,i) for pid in s['tasks'].get(str(i)+':'+str(t),[]))>=2 for t in range(3)],sentences=sum(p['kind']=='story' and p['group']==i and p['status']=='approved' for p in s['posts'].values())) for i in range(count)]
    return dict(type='social',social=dict(participants=len(profiles),connections=sum(status(r)=='accepted' for r in s['requests'].values()),groups=groups,
        interests=[sum(i in p['interests'] for p in profiles) for i in range(9)],posts=published(s),closed=s['closed'] or room['state'] in ('completed','aborted'),revealed=s['revealed'],
        bingoCompleted=sum(len(cells)==9 for cells in s['bingo'].values())))

def own(room,player):
    s=checked(room);pid=player['id'];p=s['profiles'].get(pid)
    requests=[]
    for r in s['requests'].values():
        if pid not in (r['from'],r['to']):continue
        other=r['to'] if r['from']==pid else r['from']
        entry={k:r[k] for k in ('id','kind','from','to','index','text')};entry['status']=status(r);entry['otherCode']=s['profiles'][other]['code']
        if r['kind']=='cards' and status(r)=='accepted':entry['contact']=r.get('contacts',{}).get(other,'')
        requests.append(entry)
    pair=paired(s,pid);answerdata=None
    if pair and pair['kind']=='match' and pair['status']=='accepted':
        a=s['answers'].get(pair['id'],{});ready=all(len(a.get(x,{}))==3 for x in (pair['from'],pair['to']))
        answerdata=dict(id=pair['id'],mine=a.get(pid,{}),ready=ready,results=[dict(question=q,choices=list(CHOICES[i]),same=a[pair['from']][str(i)]==a[pair['to']][str(i)],answers=[a[pair['from']][str(i)],a[pair['to']][str(i)]]) for i,q in enumerate(QUESTIONS)] if ready else [])
    return dict(profile=p,playerId=pid,requests=requests[-100:],pairAnswers=answerdata,bingo=list(s['bingo'].get(pid,{})),taskMine=[i for i in range(3) if p and pid in s['tasks'].get(str(p['group'])+':'+str(i),[])],
        myTurn=bool(p and active(s,pid) and turn(s,p['group'])==pid),posts=[dict(id=x['id'],status=x['status'],text=x['text'],statements=x['statements']) for x in s['posts'].values() if x['author']==pid],guessed=[k for k,a in s['guesses'].items() if pid in a])

def admin(room):
    s=checked(room)
    return dict(posts=[{k:v for k,v in p.items() if k not in ('lie','author')} for p in s['posts'].values()],closed=s['closed'],revealed=s['revealed'])
