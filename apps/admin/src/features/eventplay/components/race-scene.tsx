'use client';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import type { GameConfig } from '../api/types';
import type { LiveRoom } from '../api/realtime';
import styles from './race-scene.module.css';
import { swipeLabels } from '../api/swipe';
import { RaceVehicle, RaceLandscape, raceNames } from './race-art';

const colors = ['#ce3035', '#246cc5', '#168153', '#8151b1'];
const horseColors = ['red', 'blue', 'green', 'purple'];
export interface RaceSceneProps {
  config: GameConfig;
  scores: number[];
  remaining?: number;
  compact: boolean;
  live: boolean;
  phase?: LiveRoom['state'];
  countdown?: number;
  playerCount?: number;
  playerUrl?: string;
  connected?: boolean;
}

export function RaceArena({ config, scores, remaining, compact, live, phase = 'running', countdown = 0, playerCount, playerUrl, connected = true }: RaceSceneProps) {
  const sprint = config.mechanic === 'alternating';
  const variant = sprint ? 'horse' : config.raceVariant ?? 'horse';
  const vertical = variant === 'rocket' || variant === 'balloon' || variant === 'climb';
  const teams = config.teams.split(/[,，]/).map((team) => team.trim()).filter(Boolean);
  const points = teams.map((_, index) => Math.max(0, scores[index] ?? 0));
  const highest = Math.max(0, ...points);
  const scale = Math.max(100, highest) * 1.15;
  const moving = live && connected && phase === 'running';
  const completed = phase === 'completed';
  const winners = teams.filter((_, index) => points[index] === highest);
  const message = !connected && live ? '连接恢复中 · 画面停留在最近同步状态'
    : countdown > 0 ? '各就各位 · 即将开场'
    : phase === 'waiting' ? '战队集结中 · 等待主持人发令'
    : phase === 'paused' ? '比赛已暂停 · 请等待主持人继续'
    : phase === 'aborted' ? '本轮已中止 · 不评定胜负'
    : completed ? highest > 0 ? `${winners.join('、')} · ${winners.length > 1 ? '并列获胜' : '本轮获胜'}` : '本轮暂无有效得分'
    : sprint ? '左一下，右一下，为战队迈出每一步！' : config.inputMode === 'swipe' ? `${swipeLabels[config.swipeDirection ?? 'up']}，为你的战队加速！`
    : config.inputMode === 'shake' ? '轻摇手机，为你的战队加速！' : '点击手机，为你的战队加速！';
  const seconds = Math.max(0, Math.ceil(remaining ?? config.duration));
  const sprinting = moving && seconds > 0 && seconds <= 10;
  const standings = teams.map((name, index) => ({ name, index, score: points[index], rank: 1 + points.filter((value) => value > points[index]).length })).sort((a, b) => b.score - a.score);
  return <section aria-label={sprint ? '左右冲刺运动场' : variant === 'horse' ? '团队赛马场景' : `${raceNames[variant]}场景`} data-race-stage data-race-variant={sprint ? 'sprint' : variant} data-phase={phase} data-moving={moving} className={cn(styles.scene, sprint && styles.sprintRace, variant !== 'horse' && styles[variant], variant !== 'horse' && styles.illustrated, vertical && styles.vertical, compact && styles.compact)}>
    <div className={styles.backdrop} aria-hidden='true'>{variant !== 'horse' && <RaceLandscape variant={variant}/>}</div>
    <header className={styles.header}>
      <div className={styles.brand}>{config.logo && <Image unoptimized src={config.logo} width={48} height={48} alt='品牌 Logo' />}<span>{config.brand || 'EventPlay'}<small>同心同行 · 共赴热爱</small></span></div>
      <div className={styles.title}><p>{sprint ? '欢乐运动会' : raceNames[variant]} · {vertical ? '一起向上' : '一起加速'}</p><h2>{config.name}</h2></div>
      <div className={cn(styles.clock, moving && seconds <= 10 && styles.urgent)}><strong role='timer'>{live ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : '预览'}</strong><span>{playerCount === undefined ? '团队贡献赛' : `${playerCount} 人已入场`}</span></div>
    </header>
    {sprinting && <div className={styles.sprint} role='status'>最后冲刺 · 为战队再加一把劲！</div>}
    <div className={styles.racefield} style={{ '--lanes': teams.length } as CSSProperties}>
      {teams.map((team, index) => {
        const score = points[index];
        const rank = 1 + points.filter((value) => value > score).length;
        const leading = highest > 0 && score === highest;
        return <div key={`${index}-${team}`} className={styles.lane} style={{ '--team': colors[index % colors.length], '--horse': `url('/games/race/horse-cartoon-${horseColors[index % horseColors.length]}-v2.png')` } as CSSProperties}>
          <div className={styles.pennant}><small>战队 {String(index + 1).padStart(2, '0')}</small><strong>{team}</strong><span>{phase === 'aborted' ? '已中止' : highest === 0 ? '蓄势待发' : leading ? completed ? '本轮获胜' : '领先中' : `第 ${rank} 名`}</span></div>
          <div className={styles.runway}>
            {variant === 'climb' && <div className={styles.tower} aria-hidden='true'>{Array.from({length:8},(_,floor)=><i key={floor} data-lit={score >= (8-floor)*10}/>)}</div>}
            <div className={cn(styles.runner, leading && styles.leader)} style={{ ...(vertical ? {bottom:`${8 + Math.min(1,score/scale)*52}%`} : {left:`${Math.min(1, score / scale) * (variant === 'horse' ? 72 : 65)}%`}), '--offset': `${index * -0.13}s` } as CSSProperties & { '--offset': string }}>
              <div className={styles.score}><b>{score.toLocaleString()}</b><span>积分</span></div>
              <span className={styles.dust} aria-hidden='true' />
              {sprint ? <span className={styles.athlete}><Image unoptimized src='/games/race/illustrated/sprint-sprite-v1.png' alt='' fill sizes='200px' /></span> : variant === 'horse' ? <><span className={styles.horse} data-horse-color={horseColors[index % horseColors.length]} aria-hidden='true' /><span className={styles.saddle} aria-hidden='true'>{index + 1}</span></> : <span className={styles.vehicle}><RaceVehicle variant={variant} color={colors[index % colors.length]}/></span>}
            </div>
          </div>
        </div>;
      })}
      <div className={styles.finish} aria-hidden='true'><span>全力以赴</span></div>
    </div>
    {(countdown > 0 || phase === 'paused' || phase === 'aborted' || completed || (live && !connected)) && <div className={styles.announcement} role='status'>
      {connected && countdown > 0 ? <><span>准备开场</span><strong className={styles.countdown}>{countdown}</strong></> : <><span>{!connected ? '正在重连' : completed ? '本轮战报' : phase === 'paused' ? '稍作休整' : '比赛中止'}</span><strong>{message}</strong>{completed && connected && highest > 0 && <><small>最高团队积分 {highest.toLocaleString()} · 服务端确认</small><ol className={styles.standings} aria-label='战队最终排名'>{standings.map(({ name, index, score, rank }) => <li key={index} style={{ '--team': colors[index % colors.length] } as CSSProperties}><span>第 {rank} 名</span><b>{name}</b><strong>{score.toLocaleString()}<small> 积分</small></strong></li>)}</ol></>}</>}
    </div>}
    {phase === 'waiting' && !countdown && playerUrl && <aside className={styles.join}><QRCodeSVG value={playerUrl} size={112} marginSize={4} title='扫码加入本局' /><span>微信扫码 · 加入战队</span></aside>}
    {completed && highest > 0 && <div className={styles.confetti} aria-hidden='true'>{Array.from({length:18}, (_, i) => <i key={i} style={{ '--x': `${i * 5.7}%`, '--delay': `${i % 6 * -.4}s`, '--team': colors[i % 4] } as CSSProperties} />)}</div>}
    <footer className={styles.footer}><p>{phase === 'running' || phase === 'waiting' ? message : '每一份热爱，都值得全力以赴'}</p><div><span>{live ? '限时积分赛 · 积分最高的战队获胜' : '效果预览 · 非真实比赛'}</span><span>{sprint ? '左右交替计分 · 连续同侧不计分' : '位置为相对积分示意，非完成百分比'}</span></div></footer>
  </section>;
}
