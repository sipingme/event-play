"""Bounded collaborative artworks, leased puzzle pieces and moderated contributions."""
import math
import time
from typing import Literal
from fastapi import HTTPException
from pydantic import BaseModel, Field, model_validator

VARIANTS=('puzzle','tree','map','draw','stars','city','flowers','scroll','fireworks')
CITIES=('北京','上海','广州','深圳','杭州','成都','武汉','西安','南京','重庆','其他')

class Point(BaseModel):
    x:int=Field(ge=0,le=1000,strict=True)
    y:int=Field(ge=0,le=1000,strict=True)
class Stroke(BaseModel):
    color:int=Field(ge=0,le=5,strict=True)
    points:list[Point]=Field(min_length=1,max_length=80)
class CreateInput(BaseModel):
    action:Literal['claim','place','seed','water','feed','submit']
    slot:int=Field(default=0,ge=0,le=15,strict=True)
    color:int=Field(default=0,ge=0,le=5,strict=True)
    shape:int=Field(default=0,ge=0,le=2,strict=True)
    city:int=Field(default=0,ge=0,le=10,strict=True)
    text:str=Field(default='',max_length=60)
    strokes:list[Stroke]=Field(default_factory=list,max_length=20)
    @model_validator(mode='after')
    def size(self):
        if sum(len(s.points) for s in self.strokes)>600:raise ValueError('笔迹最多600个点')
        return self
class CreateCommand(BaseModel):
    action:Literal['approve','hide','close','launch']
    id:str=Field(default='',max_length=80)
    revision:int=Field(default=0,ge=0,strict=True)

def state(room):
    return room.setdefault('creation',dict(items={},tree={},pieces={},leases={},closed=False,launchedAt=None))

def checked(room):
    if room['config']['mechanic']!='create':raise HTTPException(409,'本场不是群体共创')
    return state(room)

def act(room,player,data):
    s=checked(room);pid=player['id'];v=room['config'].get('createVariant','puzzle')
    if room['state']!='running' or s['closed']:raise HTTPException(409,'共创尚未开放、暂停或已收官')
    if v=='puzzle':
        if data.action not in ('claim','place'):raise HTTPException(422,'请领取或放置图块')
        now=time.time()
        s['leases']={k:l for k,l in s['leases'].items() if l['until']>now}
        if data.action=='claim':
            if pid not in s['leases']:
                available=[i for i in range(16) if str(i) not in s['pieces'] and i not in [l['piece'] for l in s['leases'].values()]]
                if not available:raise HTTPException(409,'图块已完成或已被领取，请稍后再试')
                s['leases'][pid]=dict(piece=available[(len(s['pieces'])*7)%len(available)],until=now+90)
            return s['leases'][pid]
        lease=s['leases'].get(pid)
        if not lease:raise HTTPException(409,'图块领取已过期，请重新领取')
        if data.slot!=lease['piece']:raise HTTPException(422,'位置不匹配，请对照原图重试')
        s['pieces'][str(data.slot)]=pid;s['leases'].pop(pid)
        return dict(accepted=True)
    if v=='tree':
        if data.action not in ('seed','water','feed'):raise HTTPException(422,'请选择种树操作')
        own=s['tree'].setdefault(pid,[])
        if data.action in own:return dict(accepted=True)
        if data.action!='seed' and not any('seed' in a for a in s['tree'].values()):raise HTTPException(409,'请先由一位来宾播种')
        own.append(data.action);return dict(accepted=True)
    if data.action!='submit':raise HTTPException(422,'请提交作品')
    if pid not in s['items'] and len(s['items'])>=200:raise HTTPException(409,'本场最多200份作品')
    if v=='draw' and not data.strokes:raise HTTPException(422,'请先画出你的作品')
    if v=='scroll' and not data.text.strip() and not data.strokes:raise HTTPException(422,'请填写祝福或绘制签名')
    if time.time()-player.get('lastCreation',0)<1:raise HTTPException(429,'请稍后再提交')
    old=s['items'].get(pid,{})
    s['items'][pid]=dict(id=pid,color=data.color,shape=data.shape,city=data.city,text=data.text.strip(),
        strokes=[x.model_dump() for x in data.strokes] if v in ('draw','scroll') else [],
        revision=old.get('revision',0)+1,status='pending' if data.text.strip() or (v in ('draw','scroll') and data.strokes) else 'approved')
    player['lastCreation']=time.time()
    return dict(accepted=True)

def command(room,data):
    s=checked(room)
    if room['state'] not in ('running','paused'):raise HTTPException(409,'请先开场，结束后作品不可修改')
    if data.action=='close':s['closed']=True;return
    if data.action=='launch':
        if room['state']!='running':raise HTTPException(409,'请恢复活动后再点火')
        if room['config'].get('createVariant')!='fireworks':raise HTTPException(409,'本场不是烟花秀')
        if not any(i['status']=='approved' for i in s['items'].values()):raise HTTPException(409,'请先收集至少一份通过审核的烟花')
        s['closed']=True;s['launchedAt']=time.time();s.pop('pausedAt',None);return
    if s['launchedAt']:raise HTTPException(409,'烟花作品已锁定，不可修改')
    item=s['items'].get(data.id)
    if not item:raise HTTPException(404,'作品不存在')
    if item['revision']!=data.revision:raise HTTPException(409,'作品已更新，请重新审核')
    item['status']='approved' if data.action=='approve' else 'hidden'

def lifecycle(room,action):
    s=state(room)
    if not s['launchedAt']:return
    if action in ('pause','finish','abort'):s.setdefault('pausedAt',time.time())
    elif action=='resume' and s.get('pausedAt'):
        s['launchedAt']+=time.time()-s.pop('pausedAt')

def public(room):
    s=state(room);counts={a:sum(a in own for own in s['tree'].values()) for a in ('seed','water','feed')}
    target=max(1,math.ceil(room['config']['participants']/5))
    stage=0 if not counts['seed'] else 1 if not counts['water'] else 2 if not counts['feed'] else 3 if min(counts.values())<target else 4
    return dict(type='create',creation=dict(items=[i for i in s['items'].values() if i['status']=='approved'],
        pieces=sorted(int(i) for i in s['pieces']),tree=counts,treeStage=stage,treeTarget=target,
        total=len(s['items']),closed=s['closed'] or room['state'] in ('completed','aborted'),
        launchedAt=s['launchedAt'],serverTime=s.get('pausedAt',time.time())))

def own(room,player):
    s=checked(room);pid=player['id'];lease=s['leases'].get(pid)
    return dict(item=s['items'].get(pid),tree=s['tree'].get(pid,[]),lease=lease if lease and lease['until']>time.time() else None)
