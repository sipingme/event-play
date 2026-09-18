'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { LiveRoom } from '../api/realtime';
import { drawLiveAction } from '../api/realtime';
import { drawGames, drawWishes, type DrawVariant } from '../api/draw-games';
import { DrawArt } from './draw-art';
import styles from './draw-scene.module.css';
export function DrawPoster({variant}:{variant:DrawVariant}){
 return <div className={styles.poster} style={{backgroundImage:`url('${drawGames[variant].background}')`}}><DrawArt variant={variant}/></div>;
}
export function DrawScene({room,playerId,connected=true,compact=false}:{room:LiveRoom;playerId?:string;connected?:boolean;compact?:boolean}){
 const variant=room.config.drawVariant??'list';const info=drawGames[variant];const result=room.game?.result;
 const running=room.state==='running';const ended=['completed','aborted'].includes(room.state);
 const [replay,setReplay]=useState(0);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const winner=result?.winners.some(w=>w.id===playerId);const revealed=room.game?.revealed??[];
 async function act(action:'charge'|'reveal'|'wish',value=0){if(busy)return;setBusy(true);setError('');try{await drawLiveAction(room.id,action,value);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className={cn(styles.scene,compact&&styles.compact)} data-draw-variant={variant} data-running={running} data-open={revealed.length>0} style={{backgroundImage:`url('${info.background}')`}}>
  <header><span>{room.config.brand||'EventPlay'} · 幸运派对</span><span>{room.playerCount??room.players.length} 人入场 · {result?'结果已锁定':running?'等待主持人开奖':room.state==='paused'?'已暂停':ended?'本轮未开奖':'扫码参与'}</span></header>
  <h2>{room.config.name}</h2><p className={styles.subtitle}>{info.description}</p>
  <div className={styles.prize}>{room.config.prizeName||'幸运奖'} · {room.config.winnerCount??1} 位幸运来宾</div>
  <div className={cn(styles.art,running&&styles.moving)}><DrawArt variant={variant}/></div>
  {!result&&<div className={styles.candidates}>
    {room.players.length?room.players.slice(0,30).map((p,i)=><span key={p.id} style={{animationDelay:`${i*.1}s`}}>{variant==='train'?`车票 ${String(i+1).padStart(3,'0')} · `:''}{p.name}{variant==='balloon'?` · ${room.game?.wishes?.[p.id]??'好运常在'}`:''}</span>):<span>等待来宾入场，展示真实参与名单</span>}
    {room.players.length>30&&<span>另有 {room.players.length-30} 位，所有符合资格者均参与抽取</span>}
  </div>}
  {variant==='treasure'&&!result&&<div className={styles.energy}><strong>开箱能量 {room.game?.charge??0} / {room.config.goal??1000}</strong><progress max={room.config.goal??1000} value={room.game?.charge??0}/><p>达标后由主持人开奖，助力次数不影响中奖概率。</p>{playerId&&<Button disabled={!connected||!running||busy||(room.game?.charge??0)>=(room.config.goal??1000)} onClick={()=>void act('charge')}>点击寻宝助力</Button>}</div>}
  {variant==='balloon'&&playerId&&<div className={styles.energy}><p>选择祝福：{room.game?.wishes?.[playerId]??'尚未选择'}</p><div className={styles.actions}>{drawWishes.map((wish,i)=><Button key={wish} variant='outline' disabled={!connected||busy||room.state!=='waiting'||!!room.countdown} onClick={()=>void act('wish',i)}>{wish}</Button>)}</div></div>}
  {result&&<><div className={styles.winners} key={replay}>{result.winners.map((w,i)=>{
    const opened=!['egg','box'].includes(variant)||revealed.includes(w.id);
    return <article key={w.id} style={{animationDelay:`${Math.min(i,12)*.2}s`}}><small>{variant==='train'?`幸运车厢 ${i+1}`:variant==='capsule'?`幸运扭蛋 ${i+1}`:`幸运来宾 ${i+1}`}</small><strong>{w.name}</strong><p>{opened?(result.prizeName||'幸运奖'):'结果已锁定 · 等待开封'}</p>{!opened&&w.id===playerId&&<Button disabled={!connected||busy} onClick={()=>void act('reveal')}>{variant==='egg'?'砸开金蛋':'打开礼盒'}</Button>}</article>;
  })}</div><p className={styles.subtitle}>{playerId?(winner?'恭喜你成为本轮幸运来宾！':'感谢参与，本轮暂未中奖。'):'中奖名单由服务器生成并锁定'}</p><div className={styles.actions}><Button variant='outline' onClick={()=>setReplay(v=>v+1)}>重播揭晓动画</Button></div><p className={styles.note}>重播不重新抽取 · 开封仅为展示效果，不是保密措施</p></>}
  {error&&<p role='alert' className={styles.energy}>{error}</p>}
  <footer>本轮不重复抽中同一人 · {room.config.drawRepeat?'允许跨轮重复中奖':'本系列排除已中奖身份'} · 奖品由主办方发放</footer>
 </section>;
}
