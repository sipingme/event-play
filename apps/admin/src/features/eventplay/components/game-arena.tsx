'use client';
import Image from 'next/image';
import type { ReactNode, CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { GameConfig } from '../api/types';
import type { LiveRoom } from '../api/realtime';
import styles from './game-arena.module.css';

const phases = { waiting: '入场集结', running: '正在进行', paused: '比赛暂停', completed: '本轮已结束', aborted: '本轮已中止' };
function Arena({ config, eyebrow, children, status, compact = false }: { config: GameConfig; eyebrow: string; children: ReactNode; status: string; compact?: boolean }) {
  return <section className={cn(styles.arena, styles[config.theme], compact && styles.compact)}>
    <div className={styles.grid} aria-hidden='true' />
    <header className={styles.topline}>
      <div className={styles.brand}>{config.logo && <Image unoptimized src={config.logo} width={32} height={32} alt='品牌 Logo' />}{config.brand || 'EVENTPLAY'}<span className={styles.brandDivider} />LIVE EXPERIENCE</div>
      <span className={styles.status}><span aria-hidden='true' />{status}</span>
    </header>
    <div className={styles.heading}><p className={styles.eyebrow}>{eyebrow}</p><h2>{config.name}</h2></div>
    {children}
    <footer className={styles.footer}><span>每一份参与，都值得被看见</span><span>TOGETHER, WE PLAY.</span></footer>
  </section>;
}


export function GameArena({ room }: { room: LiveRoom }) {
  const { config, game } = room;
  const count = room.playerCount ?? room.players.length;
  const running = room.state === 'running';
  const ended = ['completed', 'aborted'].includes(room.state);
  if (config.mechanic === 'quiz') {
    const total = game?.total ?? 0;
    const duration = total ? config.duration / total : config.duration;
    const percent = Math.max(0, Math.min(100, (game?.seconds ?? 0) / duration * 100));
    const reveals = game?.reveals ?? [];
    return <Arena config={config} eyebrow='BRAIN CHALLENGE / 知识闯关' status={phases[room.state]}>
      <div className={styles.quizMeta}><span>{game?.question ? `QUESTION ${String((game.index ?? 0) + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : '准备好，迎接下一次灵光一闪'}</span><span>{count} 位参与者 · 答对 +10 分</span></div>
      {game?.question ? <div className={styles.questionScene} key={game.index}>
        <div className={styles.questionHeader}><h3>{game.question.text}</h3><div className={styles.questionClock} style={{ '--remaining': `${percent}%` } as CSSProperties}><strong>{game.seconds}</strong><span>秒</span></div></div>
        <div className={styles.options}>{game.question.options.map((option, index) => <div className={styles.option} key={index}><span>{'ABCD'[index]}</span><p>{option}</p></div>)}</div>
        <div className={styles.timeTrack}><span style={{width:`${percent}%`}} /></div>
        <p className={styles.stageHint}>{running ? '在手机上选择答案 · 每题仅可提交一次' : '已暂停 · 请等待主持人继续'}</p>
      </div> : <div className={styles.quizLobby}><span className={styles.bigLetters} aria-hidden='true'>A<span>B</span>C<span>D</span></span><h3>{ended ? room.state === 'aborted' ? '本轮已中止' : '思考有回响，答案已揭晓' : '全场一起，开启脑力挑战'}</h3><p>{ended ? '以下仅展示服务器已公布的答案' : '看大屏读题，在手机作答。等待主持人开场。'}</p></div>}
      {!!reveals.length && <div className={styles.reveal}><h3>已结束题目 · 答案揭晓</h3>{(ended ? reveals : reveals.slice(-1)).map((q) => <div key={q.index}><span className={styles.correctLetter}>{'ABCD'[q.correct]}</span><p><small>第 {q.index + 1} 题 · {q.text}</small><strong>{q.answer}</strong></p><span className={styles.correctLabel}>正确答案</span></div>)}</div>}
    </Arena>;
  }
  const result = game?.result;
  return <Arena config={config} eyebrow='LUCKY MOMENT / 幸运时刻' status={result ? '结果已锁定' : phases[room.state]}>
    <div className={cn(styles.drawScene, running && !result && styles.drawRunning)}>
      <div className={styles.spotlight} aria-hidden='true' />
      <div className={styles.prizeLabel}>{config.prizeName || '幸运奖'}</div>
      {result ? <div className={styles.winnerScene}><p className={styles.eyebrow}>THE MOMENT IS YOURS</p><h3>本局中奖名单</h3><div className={styles.winners}>{result.winners.map((winner, i) => <article className={styles.winner} key={winner.id} style={{ '--delay': `${Math.min(i, 8) * 70}ms` } as CSSProperties}><span className={styles.winnerNumber}>{String(i + 1).padStart(2, '0')}</span><p>恭喜获奖</p><strong>{winner.name}</strong><small>{winner.id}</small></article>)}</div><p className={styles.stageHint}>服务器结果已锁定 · {new Date(result.at).toLocaleString()}</p></div> : <div className={styles.drawLobby}><div className={styles.orbit} aria-hidden='true'><span /><span /><strong>{ended ? '—' : '?'}</strong></div><h3>{ended ? '本局未开奖' : room.state === 'paused' ? '抽奖已暂停' : running ? '幸运，即将揭晓' : '下一份惊喜，等你入场'}</h3><p>{ended ? '未产生中奖结果' : room.state === 'paused' ? '请等待主持人继续' : running ? '名单已封存 · 等待主持人确认开奖' : '扫码加入活动 · 等待主持人开场'}</p></div>}
      <div className={styles.drawStats}><div><strong>{count}</strong><span>已入场人数</span></div><span className={styles.statDivider} /><div><strong>{config.winnerCount ?? 1}</strong><span>本轮中奖名额</span></div></div>
    </div>
    <p className={styles.stageHint}>仅展示实际抽奖结果，不模拟候选人滚动；奖品发放由主办方负责。游客去重不是实名防刷。</p>
  </Arena>;
}
