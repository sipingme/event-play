'use client';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import type { RaceSceneProps } from './race-scene';
import styles from './money-scene.module.css';

export function WealthCard({brand='EVENTPLAY'}:{brand?:string}) {
  return <div className={styles.note} aria-hidden='true'><span>财富积分卡 · 非现金</span><strong>+1</strong><b>{brand}</b><i>PLAY • TOGETHER</i></div>;
}
export function MoneyArena({config,scores,remaining,compact,live,phase='running',countdown=0,playerCount,playerUrl,connected=true}:RaceSceneProps) {
  const teams=config.teams.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
  const points=teams.map((_,i)=>Math.max(0,scores[i]??0));
  const high=Math.max(0,...points),total=points.reduce((a,b)=>a+b,0);
  const running=live&&connected&&phase==='running';
  const seconds=Math.max(0,Math.ceil(remaining??config.duration));
  const winners=teams.filter((_,i)=>points[i]===high);
  const overlay=!connected&&live?'正在恢复连接':countdown>0?'准备开场':phase==='paused'?'暂停数钱':phase==='aborted'?'本轮已中止':phase==='completed'?'财富战报':'';
  const colors=['#ed6346','#278bd7','#32a76d','#9567d4'];
  return <section data-money-stage data-moving={running} data-phase={phase} aria-label='疯狂数钱场景' className={cn(styles.scene,compact&&styles.compact)}>
    <header className={styles.header}>
      <div className={styles.brand}>{config.logo&&<Image unoptimized src={config.logo} width={42} height={42} alt='品牌 Logo'/>}<b>{config.brand||'EventPlay'}<small>把每一份参与，变成团队财富</small></b></div>
      <div className={styles.clock}><strong role='timer'>{live?`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`:'预览'}</strong><span>{playerCount===undefined?'团队财富挑战':`${playerCount} 人已入场`}</span></div>
    </header>
    <div className={styles.title}><p>一起数出好彩头</p><h2>{config.name}</h2><span>{live?'全场财富积分':'效果预览 · 示意积分'} <b>{total.toLocaleString()}</b></span></div>
    <div className={styles.teams} style={{'--teams':teams.length} as CSSProperties}>
      {teams.map((name,i)=>{const score=points[i],rank=1+points.filter(p=>p>score).length;return <article key={name} className={styles.team} style={{'--team':colors[i%4]} as CSSProperties}>
        <span className={styles.rank}>{high===0?'蓄势待发':rank===1?'领先中':`第 ${rank} 名`}</span>
        <h3>{name}</h3><strong className={styles.amount} key={score}>{score.toLocaleString()}<small> 积分</small></strong>
        <div className={styles.character} aria-hidden='true'><Image unoptimized src='/games/money/wealth-mascot-v1.png' alt='' width={1024} height={1536}/>{score>0&&<span key={score} className={styles.spark}>★</span>}</div>
        <div className={styles.track} aria-hidden='true'><i style={{width:`${high?score/high*100:0}%`}}/></div>
        <p>每次有效上滑 +1</p>
      </article>;})}
    </div>
    {phase==='waiting'&&!countdown&&playerUrl&&<aside className={styles.join}><QRCodeSVG value={playerUrl} size={90} marginSize={4}/><span>扫码加入 · 等待开场</span></aside>}
    {overlay&&<div className={styles.overlay} role='status'><span>{overlay}</span><strong>{countdown>0&&connected?countdown:phase==='completed'&&connected?(high?`${winners.join('、')} · ${winners.length>1?'并列获胜':'获胜'}`:'本轮暂无有效得分'):phase==='aborted'?'本轮不评定胜负':'请等待主持人或连接恢复'}</strong>
      {phase==='completed'&&connected&&<ol aria-label='财富最终排名'>{teams.map((name,i)=>({name,score:points[i],rank:1+points.filter(p=>p>points[i]).length})).sort((a,b)=>b.score-a.score).map(t=><li key={t.name}><span>第 {t.rank} 名 · {t.name}</span><b>{t.score} 积分</b></li>)}</ol>}
    </div>}
    <footer className={styles.footer}><strong>{phase==='waiting'?'战队集结中 · 等待主持人开场':running&&seconds<=10?'最后冲刺！向上滑动，为战队加油':phase==='running'?'向上滑动，一划一分！':'每一份参与，都值得喝彩'}</strong><span>虚拟积分 · 非现金，不涉及红包或提现 · 排名以服务端确认积分为准</span></footer>
  </section>;
}
