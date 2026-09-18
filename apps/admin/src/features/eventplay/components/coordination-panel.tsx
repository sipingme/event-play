'use client';
import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { coordinationAsset, coordinationGames, type ReactionVariant } from '../api/coordination';
import { startSkill, submitSkill, type LiveRoom, type SkillChallenge } from '../api/realtime';
import styles from './coordination.module.css';

export function CoordinationShell({room,connected,playerId,children}:{room:LiveRoom;connected:boolean;playerId?:string;children?:ReactNode}) {
  const variant=room.config.reactionVariant ?? 'mole';
  const game=coordinationGames[variant];
  const highest=Math.max(0,...room.scores);
  const teams=room.config.teams.split(/[,，]/);
  const message=room.id==='preview'?game.description:!connected?'连接恢复中，操作暂停':room.countdown?`准备开场 · ${room.countdown}`:room.state==='waiting'?'等待主持人开场':room.state==='paused'?'比赛暂停':room.state==='aborted'?'本轮中止，不评定胜负':room.state==='completed'?highest>0?`${teams.filter((_,i)=>room.scores[i]===highest).join('、')} 获胜`:'本轮暂无有效得分':game.description;
  return <section data-coordination-stage={variant} data-player={!!playerId} className={styles.scene} style={{backgroundImage:`url('${game.background}')`}}>
    <header className={styles.header}><div className={styles.brand}>{room.config.logo&&<Image unoptimized width={40} height={40} src={room.config.logo} alt='品牌 Logo'/>}{room.config.brand||'EventPlay'}</div><h2>{room.config.name}</h2><div className={styles.badge} role='timer'>{room.id==='preview'?'效果预览':`${room.remaining} 秒`}</div></header>
    {children ?? <div className={styles.hero}><CoordinationSprite variant={variant}/></div>}
    {!playerId&&<div className={styles.scores}>{teams.map((name,i)=><div key={i} className={styles.team} style={{'--team':['#e95e46','#3e8acb','#4bab71','#9f6cbe'][i%4]} as CSSProperties}>{name}<strong>{room.scores[i]??0}</strong><small>团队积分</small></div>)}</div>}
    <p className={styles.instructions} role='status'>{message}</p>
    {!playerId&&<p className={styles.instructions}>{room.id==='preview'?'示意成绩 · 创建扫码试玩体验操作':'看手机操作 · 大屏展示战队成绩'}</p>}
  </section>;
}
export function CoordinationSprite({variant}:{variant:ReactionVariant}) { return <Image unoptimized src={coordinationAsset(variant)} alt='' width={260} height={260}/>; }

function TeamExhibit({room,variant}:{room:LiveRoom;variant:ReactionVariant}) {
  const teams=room.config.teams.split(/[,，]/);
  return <div className={styles.exhibits}>{teams.map((team,index)=>{
    const score=room.scores[index]??0;
    return <div key={index} className={styles.exhibit}>
      <div className={styles.exhibitArt}>
        {variant==='stack'?<div className={styles.floors}>{Array.from({length:Math.min(6,1+Math.floor(score/3))},(_,i)=><Image unoptimized key={i} src={coordinationAsset('stack')} alt='' width={220} height={74}/>)}</div>
        :variant==='memory'?<div className={styles.memoryDisplay}>{Array.from({length:6},(_,i)=><span key={i} data-lit={i<score}>{i<score?<Image unoptimized src={`/games/coordination/${['fruit','fish','drum'][i%3]}-v1.png`} width={60} height={60} alt=''/>:'?'}</span>)}</div>
        :<CoordinationSprite variant={variant}/>}
        {score>0&&<span key={score} className={styles.spark}>★</span>}
      </div><strong className={styles.teamLabel}>{team}</strong>
    </div>;
  })}</div>;
}

export function CoordinationPanel({room,playerId,connected}:{room:LiveRoom;playerId?:string;connected:boolean}) {
  const variant=room.config.reactionVariant??'mole';
  const [challenge,setChallenge]=useState<SkillChallenge|null>(null);
  const [ms,setMs]=useState(0);
  const [done,setDone]=useState(false);
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  const started=useRef(0);
  const [notice,setNotice]=useState('');
  const [step,setStep]=useState(0);
  const [matched,setMatched]=useState<number[]>([]);
  const [revealed,setRevealed]=useState<Record<string,number>>({});
  const swipe=useRef<{x:number;y:number}|null>(null);
  const active=!!playerId&&connected&&room.state==='running';
  const generation=useRef(0);
  useEffect(()=>{if(!active){generation.current++;setChallenge(null);setDone(false);}},[active]);
  useEffect(()=>{
    if(!challenge||done||!active)return;
    const timer=setInterval(()=>{const elapsed=performance.now()-started.current;setMs(elapsed);if(elapsed>=challenge.lifetime*1000){setDone(true);setNotice('本轮超时，请开始下一轮');}},30);
    return()=>clearInterval(timer);
  },[challenge,done,active]);
  useEffect(()=>{if(Object.keys(revealed).length>=2){const timer=setTimeout(()=>setRevealed({}),700);return()=>clearTimeout(timer);}},[revealed]);
  async function begin(){
    if(lock.current||!active)return;lock.current=true;setBusy(true);const version=generation.current;
    try{const result=await startSkill(room.id);if(version!==generation.current)return;started.current=performance.now();setChallenge(result);setMs(0);setDone(false);setStep(0);setMatched([]);setRevealed({});setNotice('看准再出手！');}
    catch(e){setNotice((e as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  async function act(extra:{cell?:number;x1?:number;y1?:number;x2?:number;y2?:number}={}){
    if(!challenge||done||!active||lock.current)return;lock.current=true;setBusy(true);const version=generation.current;
    try{const result=await submitSkill(room.id,{token:challenge.token,elapsed:Math.round(performance.now()-started.current),...extra});if(version!==generation.current)return;setDone(result.done);if(result.step!==undefined)setStep(result.step);if(result.matched)setMatched(result.matched);if(result.revealed)setRevealed(result.revealed);setNotice(result.points?`成功！+${result.points} 分`:result.done?'没有命中，下一轮再来！':'继续完成挑战');}
    catch(e){setNotice((e as Error).message);setDone(true);}finally{lock.current=false;setBusy(false);}
  }
  const position=(ms/30)%200;
  const x=position<=100?position:200-position;
  const ingredients=['面包','生菜','芝士','肉饼'];
  const cardAssets=['fruit','fish','drum'];
  return <CoordinationShell room={room} connected={connected} playerId={playerId}>
    {playerId?<div className={styles.hero}><CoordinationSprite variant={variant}/></div>:<TeamExhibit room={room} variant={variant}/>}
    {playerId&&<div className={styles.controls}>
      {!challenge||done?<button className={styles.action} disabled={!active||busy} onClick={()=>void begin()}>{challenge?'下一轮挑战':'开始挑战'}</button>:<>
        {['rhythm','stack','basket','fish'].includes(variant)&&<>
          {variant==='stack'?<div className={styles.stack}><span className={cn(styles.block,styles.base)} style={{left:`${challenge.target}%`}}/><span className={styles.block} style={{left:`${x}%`}}/></div>:<div className={styles.meter} aria-label='时机指示条'><span className={styles.zone} style={{left:`${challenge.target}%`}}/><span className={styles.needle} style={{left:`${x}%`}}/></div>}
          <button className={styles.action} disabled={!active||busy} onClick={()=>void act()}>{variant==='rhythm'?'敲鼓':variant==='stack'?'落下楼层':variant==='basket'?'投篮':'收竿'}</button>
        </>}
        {variant==='fruit'&&<div className={styles.fruit} aria-label='滑动切苹果，避开炸弹' onPointerDown={e=>{if(!active||busy)return;const r=e.currentTarget.getBoundingClientRect();swipe.current={x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerCancel={()=>{swipe.current=null;}} onPointerUp={e=>{const from=swipe.current;swipe.current=null;if(!from)return;const r=e.currentTarget.getBoundingClientRect();const clamp=(v:number)=>Math.max(0,Math.min(100,v));void act({x1:clamp(from.x),y1:clamp(from.y),x2:clamp((e.clientX-r.left)/r.width*100),y2:clamp((e.clientY-r.top)/r.height*100)});}}><Image unoptimized src={coordinationAsset('fruit')} width={90} height={90} alt='苹果' style={{left:`${challenge.x}%`,top:`${challenge.y}%`}}/><span className={styles.bomb} style={{left:challenge.x<50?'85%':'15%',top:'50%'}}>炸弹</span></div>}
        {variant==='chef'&&<><p className={styles.notice}>订单：{challenge.sequence.map((v,i)=><span key={i} style={{opacity:i < step ? .35 : 1}}>{ingredients[v]}{i<2?' → ':''}</span>)}</p><div className={styles.grid}>{ingredients.map((name,cell)=><button key={name} className={styles.card} disabled={!active||busy} onClick={()=>void act({cell})}>{name}</button>)}</div></>}
        {variant==='memory'&&<><p className={styles.notice}>{ms<2000?'记住图案的位置…':'翻出相同图案 · 最多 6 次配对'}</p><div className={styles.grid}>{challenge.board.map((value,cell)=>{const visible=ms<2000||matched.includes(cell)||revealed[cell]!==undefined;return <button key={cell} aria-label={`卡片 ${cell+1}`} className={styles.card} disabled={!active||busy||ms<2000||matched.includes(cell)||revealed[cell]!==undefined} onClick={()=>void act({cell})}>{visible?<Image unoptimized src={`/games/coordination/${cardAssets[value]}-v1.png`} width={70} height={70} alt={['苹果','金鱼','小鼓'][value]}/>: '?'}</button>;})}</div></>}
      </>}
      <p className={styles.notice} role='status'>{notice}</p>
      <small>{coordinationGames[variant].description}</small>
    </div>}
  </CoordinationShell>;
}
