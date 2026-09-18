'use client';
import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { controlGames, type ControlDirection, type ControlVariant, type ControlState } from '../api/control-games';
import { controlLiveRoom, moveLiveRoom, type LiveRoom } from '../api/realtime';
import { ControlObject } from './control-object';
import styles from './control-scene.module.css';

const defaultControl:ControlState={x:0,y:4,heading:0,key:false,completed:0,direction:'',message:'准备出发'};
const gridVariants=['parking','maze','balance'];
export function ControlSprite({variant}:{variant:ControlVariant}) { const asset=controlGames[variant].asset;return asset?<Image unoptimized src={asset} width={260} height={220} alt=''/>:<span className={styles.ball}/>; }

function HoldButton({children,disabled,act}:{children:ReactNode;disabled:boolean;act:()=>void}) {
  const timer=useRef<ReturnType<typeof setInterval>|null>(null);
  const action=useRef(act);action.current=act;
  function stop(){if(timer.current)clearInterval(timer.current);timer.current=null;}
  useEffect(()=>{if(disabled)stop();return stop;},[disabled]);
  useEffect(()=>{window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);return()=>{window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);};},[]);
  return <button className={styles.button} disabled={disabled} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);stop();action.current();timer.current=setInterval(()=>action.current(),200);}} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onClick={e=>{if(e.detail===0)action.current();}}>{children}</button>;
}

export function ControlPanel({room,playerId,connected}:{room:LiveRoom;playerId?:string;connected:boolean}) {
  const variant=room.config.controlVariant??'coins';
  const game=controlGames[variant];
  const description=room.config.controlVariant?game.description:'左右移动接金币 +1；旧版活动维持纯接金币规则。';
  const [jumping,setJumping]=useState(false);
  useEffect(()=>setJumping(false),[room.game?.index,room.state]);
  const player=room.players.find(p=>p.id===playerId);
  const [lane,setLane]=useState(player?.lane??1);
  const [control,setControl]=useState(player?.control??defaultControl);
  const [notice,setNotice]=useState('');
  const [progress,setProgress]=useState(room.game?.progress??0);
  const pending=useRef(false);
  const active=connected&&room.state==='running'&&!!player;
  const running=connected&&room.state==='running';
  const enabled=useRef(active);enabled.current=active;
  const grid=gridVariants.includes(variant);
  useEffect(()=>{setLane(player?.lane??1);setControl(player?.control??defaultControl);},[player?.lane,player?.control]);
  useEffect(()=>{
    const at=performance.now(),initial=room.game?.progress??0;
    if(!running){setProgress(initial);return;}
    const timer=setInterval(()=>setProgress(Math.min(.99,initial+(performance.now()-at)/((room.game?.interval??2)*1000))),33);
    return()=>clearInterval(timer);
  },[room.game?.progress,room.game?.index,room.game?.interval,running]);
  async function act(direction:ControlDirection){
    if(pending.current||!enabled.current)return;pending.current=true;
    try {
      if(!room.config.controlVariant){if(direction==='left'||direction==='right'){const result=await moveLiveRoom(room.id,direction);setLane(result.lane);}}
      else {const result=await controlLiveRoom(room.id,direction);if(result.accepted){setLane(result.lane);setControl(result.control);if(direction==='jump')setJumping(true);}}
      setNotice('');
    }catch(e){setNotice((e as Error).message);}finally{pending.current=false;}
  }
  const teams=room.config.teams.split(/[,，]/),highest=Math.max(0,...room.scores);
  const status=room.id==='preview'?'效果预览 · 示意成绩':!connected?'连接恢复中，操作暂停':room.countdown?`准备开场 · ${room.countdown}`:room.state==='waiting'?'等待主持人开场':room.state==='paused'?'比赛暂停':room.state==='aborted'?'本轮中止，不评定胜负':room.state==='completed'?highest>0?`${teams.filter((_,i)=>room.scores[i]===highest).join('、')} 获胜`:'本轮暂无有效得分':description;
  const target=room.game?.lane??1,hazard=(target+1)%3;
  const buttons: [ControlDirection,string][]=variant==='parking'?[['left','左转'],['forward','前进'],['right','右转'],['back','后退']]:grid?[['up','向上'],['left','向左'],['down','向下'],['right','向右'],...(variant==='balance'?[['brake','刹车'] as [ControlDirection,string]]:[])]:[['left','向左移动'],...(variant==='runner'?[['jump','跳跃'] as [ControlDirection,string]]:[]),['right','向右移动']];
  return <section data-control-stage={variant} data-variant={variant} data-player={!!playerId} className={styles.scene} style={{backgroundImage:`url('${game.background}')`}}>
    <header className={styles.header}><div className={styles.brand}>{room.config.logo&&<Image unoptimized width={32} height={32} src={room.config.logo} alt='品牌 Logo'/>}{room.config.brand||'EventPlay'}</div><h2>{room.config.name}</h2><div className={styles.timer}>{room.id==='preview'?'预览':`${room.remaining} 秒`}</div></header>
    {playerId?<div className={styles.play}>
      {grid?<div className={styles.grid} aria-label='控制棋盘'>{Array.from({length:25},(_,cell)=>{
        const walls=room.game?.walls??(variant==='balance'?[6,8,12,16,18]:[6,7,8,11,13,16,18]);
        const here=cell===control.y*5+control.x;
        return <div key={cell} data-cell={cell} data-player-cell={here} className={cn(styles.cell,walls.includes(cell)&&(variant==='balance'?styles.hole:styles.wall),cell===4&&styles.goal,cell===24&&styles.key)}>{cell===4?(variant==='parking'?'P ↑':'终点'):cell===24&&variant==='maze'&&!control.key?'钥匙':''}{here&&<><ControlSprite variant={variant}/>{variant==='parking'&&<span className={styles.heading}>{['↑','→','↓','←'][control.heading]}</span>}</>}</div>;
      })}</div>:<div className={styles.board} aria-label='三条控制轨道' onPointerMove={e=>{if(variant!=='space'||!e.buttons)return;const r=e.currentTarget.getBoundingClientRect();const to=Math.max(0,Math.min(2,Math.floor((e.clientX-r.left)/r.width*3)));if(to!==lane)void act(to<lane?'left':'right');}}>
        <div className={styles.lanes}><i/><i/><i/></div>
        {variant==='space'&&running&&<span className={styles.beam} style={{left:`${(lane+.5)/3*100}%`}}/>}
        {room.game?.lane!=null&&room.state!=='waiting'&&<>
          <span className={cn(styles.fall,variant==='coins'&&room.game?.kind==='bomb'&&styles.danger,variant==='ski'&&styles.gate)} style={{left:`${(target+.5)/3*100}%`,top:`${10+progress*65}%`}}><ControlObject kind={variant==='coins'?room.game?.kind==='bomb'?'bomb':'coin':variant==='runner'?'star':variant==='space'?'enemy':variant==='ski'?'gate':'chest'}/></span>
          {variant!=='coins'&&<span className={cn(styles.fall,styles.danger)} style={{left:`${(hazard+.5)/3*100}%`,top:`${10+progress*65}%`}}><ControlObject kind='rock'/></span>}
        </>}
        <div className={styles.actor} data-lane={lane} data-jumping={jumping} style={{left:`${(lane+.5)/3*100}%`}}><ControlSprite variant={variant}/></div>
      </div>}
      <p className={styles.notice} role='status'>{notice||control.message}{grid&&` · 已过 ${control.completed} 关`}</p>
      <div className={styles.buttons}>{buttons.map(([direction,label])=><HoldButton key={direction} disabled={!active} act={()=>void act(direction)}>{label}</HoldButton>)}</div>
      <p className={styles.instructions}>{description}<br/>按住方向按钮可连续移动{variant==='space'?'，也可在轨道上左右拖动':''}</p>
    </div>:<div className={styles.teams}>{teams.map((team,i)=>{const score=room.scores[i]??0;return <div key={i} className={styles.team} style={{'--team':['#ec7156','#409bca','#5cad74','#b07dbf'][i%4]} as CSSProperties}><div className={styles.mascot}><ControlSprite variant={variant}/></div><div className={styles.score}>{team}<strong>{score}</strong><span>团队积分</span><div className={styles.progress}><i style={{width:`${score/Math.max(20,highest)*100}%`}}/></div></div></div>;})}</div>}
    <p className={styles.instructions}>{status}</p>
    {!playerId&&<p className={styles.instructions}>{description}<br/>手机个人操控 · 大屏汇总战队成绩</p>}
  </section>;
}
