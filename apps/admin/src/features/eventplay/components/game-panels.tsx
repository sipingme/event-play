'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { answerLiveRoom, moveLiveRoom, type LiveRoom } from '../api/realtime';
import { GameArena } from './game-arena';
import { ReactionPanel } from './reaction-panel';

export function GamePanel({ room, playerId, connected }: { room: LiveRoom; playerId?: string; connected: boolean }) {
  const player = room.players.find((p) => p.id === playerId);
  const game = room.game;
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [message, setMessage] = useState('');
  const enabled = connected && room.state === 'running' && !!player && !busy;
  async function run(action: () => Promise<unknown>, text: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try { await action(); setMessage(text); } catch (error) { setMessage((error as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  useEffect(() => { setMessage(''); }, [game?.index]);
  if (room.config.mechanic === 'reaction') return <ReactionPanel room={room} playerId={playerId} connected={connected} />;
  if (room.config.mechanic === 'draw' || !playerId && room.config.mechanic === 'quiz') return <GameArena room={room} />;
  if (room.config.mechanic === 'quiz') return <section className='my-4 rounded-2xl border bg-card p-6 space-y-4'>
    <h2 className='text-xl font-semibold'>知识闯关 · {game?.question ? `第 ${(game.index ?? 0) + 1}/${game.total} 题` : room.state === 'waiting' ? '等待开场' : '答题已结束'}</h2>
    {game?.question ? <>
      <p className='text-sm text-muted-foreground'>本题剩余 {game.seconds} 秒 · 答对 +10 分 · 本题结束后统一计分</p>
      <h3 className='text-xl font-medium'>{game.question.text}</h3>
      <div className='grid gap-3'>{game.question.options.map((option, index) => <Button aria-label={`${'ABCD'[index]} · ${option}`} className='h-auto min-h-16 justify-start gap-4 rounded-xl px-4 py-3 text-left whitespace-normal' key={index} variant='outline' disabled={!enabled || player?.answered?.includes(game.index ?? 0)} onClick={() => run(() => answerLiveRoom(room.id, game.index ?? 0, index), '答案已提交，等待本题结束计分。')}><span className='flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted font-mono text-lg'>{'ABCD'[index]}</span><span className='min-w-0 break-words'>{option}</span></Button>)}</div>
      {player?.answered?.includes(game.index ?? 0) && <p role='status'>本题已提交，不可修改。</p>}
    </> : <p>由主持人开场。每道题限时作答，每题只能提交一次。</p>}
    {!!game?.reveals?.length && <div className='rounded-xl border bg-muted p-4'><h3 className='font-semibold'>已结束题目 · 答案揭晓</h3>{game.reveals.map((q) => <p className='mt-2 text-sm' key={q.index}>第 {q.index + 1} 题：{q.text} — 正确答案 {'ABCD'[q.correct]} · {q.answer}</p>)}</div>}
    {message && <p role='status' className='text-sm'>{message}</p>}
  </section>;
  if (room.config.mechanic === 'catch') return <section className='my-4 space-y-4 rounded-2xl border bg-card p-5'>
    <h2 className='text-xl font-semibold'>接金币 · 左右移动篮子</h2><p className='text-sm'>每 {game?.interval ?? 2} 秒一枚金币，落到篮子所在轨道 +1 分。暂停时停止掉落。</p>
    <CoinBoard room={room} lane={player?.lane} />
    {player && <><p className='text-center'>篮子位置：{['左', '中', '右'][player.lane ?? 1]}轨道</p><div className='grid grid-cols-2 gap-4'>{(['left', 'right'] as const).map((direction) => <Button className='h-16 text-xl' key={direction} disabled={!enabled} onClick={() => run(() => moveLiveRoom(room.id, direction), '')}>{direction === 'left' ? '向左移动' : '向右移动'}</Button>)}</div></>}
    {!player && <p className='text-center text-xs'>轨道底部显示该轨道的玩家人数；成绩由服务器判定。</p>}
    {message && <p role='status'>{message}</p>}
  </section>;
  return null;
}

function CoinBoard({ room, lane }: { room: LiveRoom; lane?: number }) {
  const [progress, setProgress] = useState(room.game?.progress ?? 0);
  const startProgress = room.game?.progress ?? 0;
  useEffect(() => {
    const at = performance.now(); let frame: number;
    function animate() {
      setProgress(Math.min(.99, startProgress + (room.state === 'running' ? (performance.now() - at) / ((room.game?.interval ?? 2) * 1000) : 0)));
      frame = requestAnimationFrame(animate);
    }
    animate(); return () => cancelAnimationFrame(frame);
  }, [startProgress, room.game?.index, room.game?.interval, room.state]);
  return <div className='relative h-64 overflow-hidden rounded-xl border bg-sky-950 text-white'>
    <div className='absolute inset-0 grid grid-cols-3'>{[0, 1, 2].map((index) => <div key={index} className='relative border-r border-white/20 last:border-0'><span className='absolute bottom-2 left-1/2 -translate-x-1/2 rounded-lg border-2 border-amber-200 bg-amber-600 px-4 py-2'>{lane === undefined ? (room.laneCounts?.[index] ?? room.players.filter((p) => (p.lane ?? 1) === index).length) + '人' : lane === index ? '篮子' : '·'}</span></div>)}</div>
    {room.game?.lane != null && room.state !== 'waiting' && <span aria-label='掉落金币' className='absolute flex size-10 -translate-x-1/2 items-center justify-center rounded-full border-4 border-amber-200 bg-amber-500 font-bold text-amber-950' style={{ left: `${(room.game.lane + .5) / 3 * 100}%`, top: `${4 + progress * 72}%` }}>+1</span>}
  </div>;
}
