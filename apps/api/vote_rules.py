"""Round-based ballots: rating, branching narrative and knockout bracket."""
import json
from pydantic import BaseModel, Field
from typing import Literal
from fastapi import HTTPException

VARIANTS=('poll','score','support','product','stance','proposal','satisfaction','story','bracket')
DEFAULT_STORY=json.dumps({'start':{'title':'品牌探险：先去哪里？','choices':[{'label':'森林工坊','next':'forest'},{'label':'海岛展台','next':'island'}]},'forest':{'title':'如何打造新产品？','choices':[{'label':'绿色材料','next':'green'},{'label':'智慧设计','next':'smart'}]},'island':{'title':'如何分享发现？','choices':[{'label':'现场体验','next':'green'},{'label':'线上共创','next':'smart'}]},'green':{'title':'绿色未来：全场选择了可持续之路','choices':[]},'smart':{'title':'智慧未来：全场选择了共创之路','choices':[]}},ensure_ascii=False)

class Ballot(BaseModel):
    round: int = Field(ge=0,strict=True)
    choice: int = Field(ge=0,le=7,strict=True)
    score: int = Field(default=1,ge=1,le=5,strict=True)
class VoteCommand(BaseModel):
    action: Literal['close','reveal','next','runoff']
    round: int = Field(ge=0,strict=True)

def options(text):
    values=[x.strip() for x in text.splitlines() if x.strip()]
    if not 2<=len(values)<=8 or len(set(values))!=len(values) or any(len(x)>60 for x in values):raise ValueError('需要2～8个不同选项，每项最多60字')
    return values

def story(text):
    try:graph=json.loads(text)
    except (ValueError,TypeError):raise ValueError('剧情须为JSON对象')
    if not isinstance(graph,dict) or 'start' not in graph or len(graph)>16:raise ValueError('剧情须含start节点，最多16个节点')
    for key,node in graph.items():
        if not isinstance(node,dict) or not isinstance(node.get('title'),str) or not 1<=len(node['title'])<=120:raise ValueError('剧情标题须为1～120字')
        choices=node.get('choices')
        if not isinstance(choices,list) or len(choices) not in (0,2,3,4):raise ValueError('剧情节点需2～4个选项，结局节点为空数组')
        for c in choices:
            if not isinstance(c,dict) or not isinstance(c.get('label'),str) or not 1<=len(c['label'])<=60 or not isinstance(c.get('next'),str) or c['next'] not in graph:raise ValueError('剧情选项或目标节点无效')
    done=set()
    def visit(key,path):
        if key in path:raise ValueError('剧情不可循环')
        if key in done:return
        for c in graph[key]['choices']:visit(c['next'],path|{key})
        done.add(key)
    for key in graph:visit(key,set())
    if not graph['start']['choices']:raise ValueError('开始节点需要选项')
    return graph

def state(room):
    if 'vote' not in room:
        room['vote']=dict(round=0,ballots={},closed=False,revealed=False,history=[],node='start',pair=0,bracket=options(room['config'].get('voteOptions','方案A\n方案B\n方案C\n方案D')),winners=[],finished=False)
    return room['vote']

def prompt(room):
    s=state(room);variant=room['config'].get('voteVariant','poll')
    if variant=='story':
        node=story(room['config'].get('voteStory',DEFAULT_STORY))[s['node']]
        return node['title'],[c['label'] for c in node['choices']]
    if variant=='bracket':return '人气对决：请选择支持的一方',s['bracket'][s['pair']:s['pair']+2]
    return room['config']['name'],options(room['config'].get('voteOptions','方案A\n方案B\n方案C\n方案D'))

def results(room):
    s=state(room);_,opts=prompt(room)
    return [dict(label=label,count=sum(str(i) in b for b in s['ballots'].values()),total=sum(b.get(str(i),0) for b in s['ballots'].values())) for i,label in enumerate(opts)]

def submit(room,player,data):
    if room['config']['mechanic']!='vote':raise HTTPException(409,'本场不是投票')
    s=state(room);_,opts=prompt(room)
    if room['config']['mechanic']!='vote' or room['state']!='running' or s['closed'] or s['finished'] or data.round!=s['round']:raise HTTPException(409,'本轮尚未开放、已截止或已切换')
    if data.choice>=len(opts):raise HTTPException(422,'选项不存在')
    ballot=s['ballots'].get(player['id'],{})
    rating=room['config'].get('voteVariant') in ('score','proposal')
    if (str(data.choice) in ballot if rating else bool(ballot)) and not room['config'].get('voteChange',False):raise HTTPException(409,'本轮已提交，不可修改')
    s['ballots'][player['id']]={**ballot,str(data.choice):data.score} if rating else {str(data.choice):1}
    return {'accepted':True}

def command(room,data):
    if room['config']['mechanic']!='vote':raise HTTPException(409,'本场不是投票')
    s=state(room)
    if room['config']['mechanic']!='vote' or room['state'] not in ('running','paused') or data.round!=s['round']:raise HTTPException(409,'轮次或活动状态已变化')
    if data.action=='close':s['closed']=True;return
    if data.action=='reveal':
        if not s['closed']:raise HTTPException(409,'请先截止本轮')
        s['revealed']=True;return
    if not s['closed'] or not s['revealed'] or s['finished']:raise HTTPException(409,'请先截止并揭晓本轮')
    rows=results(room);rating=room['config'].get('voteVariant') in ('score','proposal')
    counts=[r['count'] for r in rows]
    winners=[i for i,c in enumerate(counts) if c==max(counts)] if counts and max(counts)>0 else []
    variant=room['config'].get('voteVariant','poll')
    if data.action=='next' and variant in ('story','bracket') and len(winners)!=1:raise HTTPException(409,'无人投票或平票，请发起加赛，不随机决定')
    if len(s['history'])>=64:raise HTTPException(409,'本场已达64轮，请结束并新建活动')
    s['history'].append(dict(round=s['round'],title=prompt(room)[0],results=rows,rating=rating))
    if data.action=='next' and variant=='story':
        graph=story(room['config'].get('voteStory',DEFAULT_STORY));s['node']=graph[s['node']]['choices'][winners[0]]['next'];s['finished']=not graph[s['node']]['choices']
    if data.action=='next' and variant=='bracket':
        s['winners'].append(rows[winners[0]]['label']);s['pair']+=2
        if s['pair']>=len(s['bracket']):
            s['bracket']=s['winners'];s['winners']=[];s['pair']=0
            if len(s['bracket'])==1:s['finished']=True
    s.update(round=s['round']+1,ballots={},closed=s['finished'],revealed=s['finished'])

def public(room):
    s=state(room);title,opts=prompt(room)
    show=room['config'].get('voteLive',True) or s['revealed'] or room['state'] in ('completed','aborted')
    return dict(type='vote',round=s['round'],title=title,options=opts,closed=s['closed'] or room['state'] in ('completed','aborted'),voteRevealed=s['revealed'],finished=s['finished'],voters=len(s['ballots']),results=results(room) if show else None,history=s['history'])
