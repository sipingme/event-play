'use client';
import { useEffect,useState } from 'react';
import Image from 'next/image';
import { useSuspenseQuery,useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAppForm } from '@/lib/form';
import { cn } from '@/lib/utils';
import type { LiveRoom } from '../api/realtime';
import { apiBase } from '../api/realtime';
import { wallGames,wallCities,type WallVariant } from '../api/wall-games';
import { submitWall,manageWall,wallAdminQuery } from '../api/wall-service';
import styles from './wall-scene.module.css';
const colors=['#f2957d','#80cbd2','#c6a4e8','#f2cd68','#8dccab','#f3a8c7','#8faedb','#e6b07d'];
function Avatar({index=0}:{index?:number}){return <svg viewBox='0 0 80 80' aria-hidden='true'><circle cx='40' cy='40' r='36' fill={colors[index%8]} stroke='#fff3cf' strokeWidth='5'/><circle cx='28' cy='34' r='4' fill='#754a32'/><circle cx='52' cy='34' r='4' fill='#754a32'/><path d='M28 48Q40 62 52 48' stroke='#754a32' strokeWidth='4' fill='none' strokeLinecap='round'/><ellipse cx='20' cy='44' rx='6' ry='3' fill='#fff1cf90'/><ellipse cx='60' cy='44' rx='6' ry='3' fill='#fff1cf90'/></svg>}
export function WallPoster({variant}:{variant:WallVariant}){return <div className={styles.poster} style={{backgroundImage:`url('${wallGames[variant].background}')`}}><div>{variant==='avatars'||variant==='welcome'?<Avatar index={variant==='welcome'?3:1}/>:wallGames[variant].symbol}</div></div>}
export function WallScene({room}:{room:LiveRoom}){
 const v=room.game?.variant??room.config.wallVariant??'avatars';const info=wallGames[v];const entries=room.game?.entries??[];const posts=room.game?.posts??[];
 const [index,setIndex]=useState(0);
 useEffect(()=>{if(room.game?.paused||!entries.length)return;const timer=setInterval(()=>setIndex(i=>(i+1)%entries.length),3500);return()=>clearInterval(timer);},[entries.length,room.game?.paused]);
 const welcome=entries[index%Math.max(1,entries.length)];
 return <section className={styles.scene} data-wall-variant={v} data-paused={room.game?.paused} style={{backgroundImage:`url('${info.background}')`}}>
  <header><span>{room.config.brand||'EventPlay'} · 欢迎每一位来宾</span><span>累计签到 {entries.length} 人 · 在线 {room.presence?.online??0} 人</span></header>
  <h2>{info.name}</h2><p className={styles.caption}>一次签到，多种展示 · {room.game?.paused?'展示动画已暂停':'让每一份参与被看见'}</p>
  {room.game?.hidden?<div className={styles.empty}>画面已清屏，等待主持人恢复</div>:<>
   {v==='logo'?<div className={styles.logo}><div>{room.config.logo?<Image unoptimized src={room.config.logo} alt='品牌 Logo' fill sizes='500px' style={{objectFit:'contain'}}/>:<strong>{room.config.brand||'EventPlay'}</strong>}</div><div className={styles.tiles}>{Array.from({length:100},(_,i)=><span key={i} style={{opacity:i<Math.ceil(entries.length/room.config.participants*100)?0:1}}/>)}</div><p>{entries.length} / {room.config.participants} 人共同拼合</p></div>
   :v==='cities'?<div className={styles.map}><p>城市分布示意 · 非地理定位地图</p><div>{wallCities.map((city,i)=><article key={city} style={{background:colors[i%8]}}><strong>{city}</strong><span>{room.game?.cityCounts?.[city]??0} 人</span></article>)}</div></div>
   :v==='welcome'?<div className={styles.welcome}>{welcome?<><Avatar index={welcome.avatar}/><h3>欢迎 {welcome.name}</h3><p>很高兴与你相聚</p></>:<p>等待第一位来宾</p>}</div>
   :['wishes','photos','barrage'].includes(v)?<div className={cn(styles.posts,v==='barrage'&&styles.barrage)}>{posts.length?posts.map(p=><article key={p.id}>{p.photo&&<Image unoptimized src={`${apiBase()}${p.photo}`} alt='已审核的来宾照片' width={480} height={480}/>}<p>{p.text}</p><small>{p.pinned?'置顶 · ':''}{p.name}</small></article>):<p className={styles.empty}>还没有审核通过的内容，欢迎在手机提交</p>}</div>
   :<div className={styles.people}>{entries.length?entries.slice(-100).map(p=><article key={p.id} data-lit={room.game?.stars?.includes(p.id)}>{v==='garden'?<span className={styles.flower} style={{color:colors[p.avatar]}}>✿</span>:v==='stars'?<span className={styles.star}>★</span>:<Avatar index={p.avatar}/>}<strong>{p.name}</strong></article>):<p className={styles.empty}>扫码入场，成为第一位参与者</p>}</div>}
   {v==='stars'&&<p className={styles.caption}>已点亮 {room.game?.stars?.length??0} / {entries.length} 颗星 · 每人一颗</p>}
   {entries.length>100&&['avatars','garden','stars'].includes(v)&&<p className={styles.caption}>展示最近100位来宾，累计人数包含全部签到</p>}
  </>}
  <footer>昵称与自选卡通头像展示 · 不公开手机号 · 城市由来宾主动选择</footer>
 </section>;
}
export function WallPlayer({room,connected}:{room:LiveRoom;connected:boolean}){
 const [message,setMessage]=useState('');const [photo,setPhoto]=useState('');const [reading,setReading]=useState(false);
 const enabled=connected&&['waiting','running'].includes(room.state);
 const form=useAppForm({defaultValues:{avatar:'0',city:'其他',text:''},onSubmit:async({value})=>{
   setMessage('');try{await submitWall(room.id,{action:'profile',avatar:Number(value.avatar),city:value.city});if(value.text.trim()||photo)await submitWall(room.id,{action:'post',text:value.text,photo});setMessage(value.text.trim()||photo?'已提交，等待主持人审核。':'签到资料已更新。');}catch(e){setMessage((e as Error).message);}
 }});
 async function upload(file?:File){if(!file)return;setReading(true);setPhoto('');try{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('请选择5MB以内的PNG/JPEG/WebP照片');
  const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const scale=Math.min(1,480/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const data=canvas.toDataURL('image/jpeg',.7);if(data.length>160000)throw new Error('照片过于复杂，请换一张较小图片');setPhoto(data);setMessage('照片已压缩，点击提交后等待审核。');
 }catch(e){setMessage((e as Error).message);}finally{setReading(false);}}
 return <section className={styles.player}><h2>你已签到，欢迎来到现场！</h2><p>选择卡通头像和来源城市，也可提交寄语或照片。</p><form onSubmit={e=>{e.preventDefault();void form.handleSubmit();}}>
  <div className={styles.avatarChoices}>{colors.map((_,i)=><Avatar key={i} index={i}/>)}</div>
  <form.AppField name='avatar'>{field=><field.SelectField label='卡通头像' options={colors.map((_,i)=>({value:String(i),label:`笑脸 ${i+1}`}))}/>}</form.AppField>
  <form.AppField name='city'>{field=><field.SelectField label='来源城市' options={wallCities.map(city=>({value:city,label:city}))}/>}</form.AppField>
  <form.AppField name='text'>{field=><field.TextareaField label='上墙寄语（可选）' maxLength={80} description='80字以内，每人最多保留3条内容；审核通过后展示。'/>}</form.AppField>
  <label className={styles.upload}>现场照片（可选，5MB以内）<input type='file' accept='image/png,image/jpeg,image/webp' disabled={!enabled||reading} onChange={e=>void upload(e.target.files?.[0])}/></label>
  {photo&&<div><Image unoptimized src={photo} width={120} height={120} alt='待提交照片'/><Button type='button' variant='outline' onClick={()=>setPhoto('')}>移除照片</Button></div>}
  <form.Subscribe selector={s=>s.isSubmitting}>{pending=><Button type='submit' disabled={!enabled||reading||pending}>{pending?'提交中…':'保存资料 / 提交上墙'}</Button>}</form.Subscribe>
 </form><Button disabled={!enabled} onClick={async()=>{try{await submitWall(room.id,{action:'star'});setMessage('你的星星已点亮！每人一颗，不重复累计。');}catch(e){setMessage((e as Error).message);}}}>点亮我的星星</Button>{message&&<p role='status'>{message}</p>}</section>;
}
export function WallAdmin({id}:{id:string}){
 const {data}=useSuspenseQuery(wallAdminQuery(id));const client=useQueryClient();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function action(kind:string,postId?:string,variant?:string){setBusy(true);setError('');try{await manageWall(id,{action:kind,id:postId,variant});await client.invalidateQueries({queryKey:['wall-admin',id]});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className={styles.admin}><h3>签到与上墙管理</h3><p>切换场景沿用当前房间与签到名单。昵称直接展示；寄语与照片需人工审核。</p><div className={styles.controls}>{Object.entries(wallGames).map(([key,g])=><Button key={key} variant='outline' disabled={busy} onClick={()=>void action('variant',undefined,key)}>{g.name}</Button>)}</div><div className={styles.controls}><Button disabled={busy} onClick={()=>void action(data.paused?'resume':'pause')}>{data.paused?'恢复滚动':'暂停滚动'}</Button><Button disabled={busy} onClick={()=>void action(data.hidden?'restore':'clear')}>{data.hidden?'恢复画面':'清屏（保留内容）'}</Button></div>
 <h4>内容审核 · {data.posts.filter(p=>p.status==='pending').length} 条待审</h4>{data.posts.map(p=><article key={p.id}>{p.photo&&<Image unoptimized src={p.photo} width={160} height={160} alt='待审核照片'/>}<p>{p.name} · {p.status==='pending'?'待审核':p.status==='approved'?'已上墙':'已隐藏'}</p><p>{p.text}</p><div className={styles.controls}><Button disabled={busy} onClick={()=>void action('approve',p.id)}>通过上墙</Button><Button disabled={busy} onClick={()=>void action('hide',p.id)}>隐藏</Button><Button disabled={busy} onClick={()=>void action(p.pinned?'unpin':'pin',p.id)}>{p.pinned?'取消置顶':'置顶'}</Button><Button disabled={busy} variant='outline' onClick={()=>{if(window.confirm('删除这条内容及其照片？删除后无法恢复。'))void action('delete',p.id);}}>删除</Button></div></article>)}{!data.posts.length&&<p>尚无投稿</p>}{error&&<p role='alert'>{error}</p>}</section>;
}
