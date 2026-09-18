"""Cosmetic reveal and cooperative charge never change draw probabilities."""
import time
from fastapi import HTTPException
WISHES=['心想事成','幸福同行','一路生花','好运常在']

def act(room, player, action, value=0):
    if room['config']['mechanic'] != 'draw':
        raise HTTPException(409,'本场不是抽奖')
    variant=room['config'].get('drawVariant')
    if action=='reveal':
        result=room.get('drawResult')
        if variant not in ('egg','box') or not result or player['id'] not in [p['id'] for p in result['winners']]:
            raise HTTPException(403,'只有本轮中奖者可以揭晓')
        revealed=room.setdefault('drawRevealed',[])
        if player['id'] not in revealed:revealed.append(player['id'])
    elif action=='wish':
        if variant!='balloon' or room['state']!='waiting' or room.get('startsAt'):
            raise HTTPException(409,'请在开场前选择祝福')
        if not 0<=value<len(WISHES):raise HTTPException(422,'祝福选项无效')
        room.setdefault('drawWishes',{})[player['id']]=WISHES[value]
    elif action=='charge':
        if variant!='treasure' or room['state']!='running':raise HTTPException(409,'当前不可助力')
        now=time.time()
        if now-player.get('lastDrawCharge',0)<.2:return {'accepted':False}
        player['lastDrawCharge']=now
        room['drawCharge']=min(room['config'].get('goal',1000),room.get('drawCharge',0)+1)
    else:raise HTTPException(422,'不支持的抽奖交互')
    return {'accepted':True}
