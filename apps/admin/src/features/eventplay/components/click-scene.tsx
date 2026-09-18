'use client';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import type { CSSProperties } from 'react';
import type { RaceSceneProps } from './race-scene';
import { clickGames } from '../api/click-games';
import styles from './click-scene.module.css';

import { ClickArt, clickBackground } from './click-art';
export { ClickArt } from './click-art';

export function ClickArena({config,scores,remaining,live,phase='running',countdown=0,playerCount,playerUrl,connected=true}:RaceSceneProps) {
  const variant=config.clickVariant!;const game=clickGames[variant];const coop=game.mechanic==='light';
  const teams=config.teams.split(/[,，]/).map(s=>s.trim()).filter(Boolean);const points=teams.map((_,i)=>Math.max(0,scores[i]??0));
  const total=points.reduce((a,b)=>a+b,0),goal=config.goal??200,high=Math.max(0,...points);const progress=Math.min(1,total/goal);
  const running=!!live&&connected&&phase==='running';
  const result=coop?(total>=goal?game.success:'时间到，尚未达成共同目标'):high?teams.filter((_,i)=>points[i]===high).join('、')+' 获胜（同分并列）':'本局暂无有效得分';
  const state=!connected&&live?'连接恢复中':countdown>0?`准备开场 · ${countdown}`:phase==='paused'?'游戏已暂停':phase==='aborted'?'本轮中止，不评定胜负':phase==='completed'?result:'';
  const colors=['#ee795a','#439fda','#58b780','#a286d2'];
  const status=variant==='boss'?(progress<.34?'破盾阶段':progress<.7?'集中攻击':progress<1?'最后一击':'已击败'):variant==='rocket'?(progress<.4?'准备蓄能':progress<1?'点火准备':'发射成功'):variant==='flower'?(progress<.2?'种子萌芽':progress<.55?'枝叶生长':progress<1?'花苞绽开':'全场绽放'):'共同积攒能量';
  return <section className={styles.scene} style={{backgroundImage:`url('${clickBackground[variant]}')`}} data-click-stage={variant} data-moving={running}>
    <header><b>{config.logo&&<Image unoptimized src={config.logo} width={36} height={36} alt='品牌 Logo'/>}{config.brand||'EventPlay'}</b><span>{live?`${Math.max(0,Math.ceil(remaining??config.duration))}s`:'效果预览'} · {playerCount??0} 人</span></header>
    <h2>{config.name}</h2><p className={styles.rule}>{game.description}</p>
    {coop?<div className={styles.shared}><span className={styles.badge}>{status}</span><div className={styles.sharedArt}><ClickArt variant={variant} progress={progress}/>{variant==='brand'&&<div className={styles.logo} style={{opacity:.25+progress*.75}}>{config.logo?<Image unoptimized src={config.logo} width={90} height={90} alt='待点亮的品牌 Logo'/>:<b>{config.brand||'EventPlay'}</b>}</div>}</div><strong className={styles.scoreBubble}>{total} / {goal} 份能量 · {Math.floor(progress*100)}%</strong><progress aria-label='共同目标进度' value={total} max={goal}/><small>全场合作，不评队伍输赢</small></div>:variant==='tug'?<div className={styles.tug}><div className={styles.teamNames}>{teams.map((t,i)=><b key={t} style={{color:colors[i]}}>{t} · {points[i]} 分</b>)}</div><ClickArt variant='tug' progress={progress} balance={total?(points[1]-points[0])/total:0}/><p>绳结随双方贡献差移动 · 时间到按积分判胜</p></div>:<div className={styles.teams} style={{'--teams':teams.length} as CSSProperties}>{teams.map((team,i)=><article key={team} style={{'--team':colors[i]} as CSSProperties}><h3>{team}</h3><ClickArt variant={variant} progress={points[i]/goal} color={colors[i]}/><strong className={styles.scoreBubble}>{points[i]} 分</strong><progress aria-label={team+'收集进度'} value={points[i]} max={goal}/><small>{points[i]>=goal?'已满格 · 继续累计积分':'每次有效点击 +1'}</small></article>)}</div>}
    <footer>{phase==='waiting'?'扫码集结，等待主持人开场':running?game.action:live?'等待开场 / 继续':'示意成绩，非真实比赛'}</footer>
    {phase==='waiting'&&playerUrl&&!countdown&&<aside className={styles.join}><QRCodeSVG value={playerUrl} size={82} marginSize={4}/><span>扫码加入</span></aside>}
    {state&&<div className={styles.overlay} role='status'><strong>{state}</strong>{phase==='completed'&&!coop&&connected&&<ol aria-label='点击游戏最终排名'>{teams.map((name,i)=>({name,score:points[i]})).sort((a,b)=>b.score-a.score).map(t=><li key={t.name}>{t.name} · {t.score} 分</li>)}</ol>}</div>}
  </section>;
}
