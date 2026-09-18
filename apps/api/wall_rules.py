"""Shared check-in room with moderated posts and bounded, sanitized photos."""
import base64
import io
import secrets
import time
from collections import Counter
from typing import Literal
from fastapi import HTTPException
from pydantic import BaseModel, Field
from PIL import Image, UnidentifiedImageError

VARIANTS=('avatars','logo','wishes','photos','barrage','garden','cities','welcome','stars')
CITIES=('北京','上海','广州','深圳','杭州','成都','武汉','西安','南京','重庆','其他')

class WallInput(BaseModel):
    action: Literal['profile','post','star']
    avatar: int = Field(default=0,ge=0,le=7,strict=True)
    city: str = Field(default='其他',max_length=10)
    text: str = Field(default='',max_length=80)
    photo: str = Field(default='',max_length=170000)

class WallCommand(BaseModel):
    action: Literal['approve','hide','pin','unpin','delete','clear','restore','pause','resume','variant']
    id: str = Field(default='',max_length=40)
    variant: str = Field(default='avatars',max_length=20)

def state(room):
    return room.setdefault('wall',dict(posts=[],profiles={},stars=[],hidden=False,paused=False))

def photo(value):
    if not value:return ''
    try:
        header,data=value.split(',',1)
        if header not in ('data:image/jpeg;base64','data:image/png;base64','data:image/webp;base64'):raise ValueError()
        raw=base64.b64decode(data,validate=True)
        if len(raw)>120000:raise ValueError()
        im=Image.open(io.BytesIO(raw))
        if im.width*im.height>4000000:raise ValueError()
        im.load();im=im.convert('RGB');im.thumbnail((480,480))
        out=io.BytesIO();im.save(out,format='JPEG',quality=75)
        return 'data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode()
    except (ValueError,OSError,UnidentifiedImageError,Image.DecompressionBombError):
        raise HTTPException(422,'请上传压缩后不超过120KB的PNG/JPEG/WebP图片')

def act(room,player,data):
    if room['config']['mechanic']!='wall' or room['state'] not in ('waiting','running'):
        raise HTTPException(409,'签到已暂停或结束')
    wall=state(room);pid=player['id']
    if data.action=='profile':
        if data.city not in CITIES:raise HTTPException(422,'城市选项无效')
        wall['profiles'][pid]=dict(avatar=data.avatar,city=data.city)
    elif data.action=='star':
        if pid not in wall['stars']:wall['stars'].append(pid)
    else:
        if len(wall['posts'])>=100:raise HTTPException(409,'本场内容已达100条，请主持人清理')
        if sum(p['playerId']==pid for p in wall['posts'])>=3:raise HTTPException(409,'每人最多保留3条内容')
        if time.time()-player.get('lastWallPost',0)<3:raise HTTPException(429,'请稍后再提交')
        if not data.text.strip() and not data.photo:raise HTTPException(422,'请填写文字或选择照片')
        if data.photo and sum(bool(p['photo']) for p in wall['posts'])>=30:raise HTTPException(409,'本场照片已达30张')
        entry=dict(id=secrets.token_urlsafe(10),playerId=pid,name=player['name'],text=data.text.strip(),photo=photo(data.photo),status='pending',pinned=False)
        wall['posts'].append(entry);player['lastWallPost']=time.time()
    return {'accepted':True}

def command(room,data):
    if room['config']['mechanic']!='wall':raise HTTPException(409,'本场不是签到上墙')
    wall=state(room)
    if data.action=='variant':
        if data.variant not in VARIANTS:raise HTTPException(422,'展示类型无效')
        wall['variant']=data.variant
    elif data.action in ('clear','restore'):wall['hidden']=data.action=='clear'
    elif data.action in ('pause','resume'):wall['paused']=data.action=='pause'
    else:
        entry=next((p for p in wall['posts'] if p['id']==data.id),None)
        if not entry:raise HTTPException(404,'内容不存在')
        if data.action=='delete':wall['posts'].remove(entry)
        elif data.action in ('approve','hide'):entry['status']='approved' if data.action=='approve' else 'hidden'
        else:entry['pinned']=data.action=='pin'

def public(room):
    wall=state(room)
    entries=[dict(id=p['id'],name=p['name'],**wall['profiles'].get(p['id'],dict(avatar=0,city='其他'))) for p in room['players'].values()]
    posts=[p for p in wall['posts'] if p['status']=='approved']
    posts=[{**p,'photo':f"/rooms/{room['id']}/wall-photo/{p['id']}" if p['photo'] else ''} for p in sorted(reversed(posts),key=lambda p:not p['pinned'])[:24]]
    return dict(type='wall',variant=wall.get('variant',room['config'].get('wallVariant') or 'avatars'),entries=entries,posts=[] if wall['hidden'] else posts,hidden=wall['hidden'],paused=wall['paused'],stars=wall['stars'],cityCounts=dict(Counter(p['city'] for p in entries)))
