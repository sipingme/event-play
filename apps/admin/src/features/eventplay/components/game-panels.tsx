'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { answerLiveRoom, type LiveRoom } from '../api/realtime';
import { GameArena } from './game-arena';
import { DrawScene } from './draw-scene';
import { WallScene, WallPlayer } from './wall-scene';
import { SocialScene,SocialPlayer } from './social-scene';
import { CreateScene,CreatePlayer } from './create-scene';
import { VoteScene,VotePlayer } from './vote-scene';
import { QuizQuestion } from './quiz-scene';
import { quizGames } from '../api/quiz-games';
import { buzzLiveRoom } from '../api/realtime';
import { ControlPanel } from './control-panel';
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
  if(room.config.mechanic==='social')return playerId?<SocialPlayer room={room} connected={connected}/>:<SocialScene room={room}/>;
  if(room.config.mechanic==='create')return playerId?<CreatePlayer room={room} connected={connected}/>:<CreateScene room={room}/>;
  if(room.config.mechanic==='vote')return playerId?<VotePlayer room={room} connected={connected}/>:<VoteScene room={room}/>;
  if(room.config.mechanic==='wall')return playerId?<WallPlayer room={room} connected={connected}/>:<WallScene room={room}/>;
  if (['catch'].includes(room.config.mechanic)) return <ControlPanel room={room} playerId={playerId} connected={connected}/>;
  if (room.config.mechanic === 'reaction') return <ReactionPanel room={room} playerId={playerId} connected={connected} />;
  if (room.config.mechanic === 'draw') return <DrawScene room={room} playerId={playerId} connected={connected}/>;
  if (!playerId && room.config.mechanic === 'quiz') return <GameArena room={room} />;
  if (room.config.mechanic === 'quiz') return <section className='my-4 rounded-2xl border bg-card p-6 space-y-4'>
    <h2 className='text-xl font-semibold'>{quizGames[room.config.quizVariant??'adventure'].name} · {game?.question ? `第 ${(game.index ?? 0) + 1}/${game.total} 题` : room.state === 'waiting' ? '等待开场' : '答题已结束'}</h2>
    {game?.question ? <>
      <p className='text-sm text-muted-foreground'>本题剩余 {game.seconds} 秒 · 答对 +{game?.points??10} 分 · 本题结束后统一计分</p>
      <QuizQuestion room={room}/>
      {room.config.quizVariant==='buzzer'&&<><p>以服务端接收顺序为准；每题一人作答，答错或超时不递补。</p><Button disabled={!enabled||!!game.buzzer} onClick={()=>run(()=>buzzLiveRoom(room.id,game.index??0),'抢答成功，请选择答案。')}>{game.buzzer?(game.buzzer===playerId?'你已获得资格':'其他玩家已抢到资格'):'立即抢答'}</Button></>}
      <div className='grid gap-3'>{game.question.options.map((option, index) => <Button aria-label={`${'ABCD'[index]} · ${option}`} className='h-auto min-h-16 justify-start gap-4 rounded-xl px-4 py-3 text-left whitespace-normal' key={index} variant='outline' disabled={!enabled || (room.config.quizVariant==='buzzer' && game.buzzer!==playerId) || player?.answered?.includes(game.index ?? 0)} onClick={() => run(() => answerLiveRoom(room.id, game.index ?? 0, index), '答案已提交，等待本题结束计分。')}><span className='flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted font-mono text-lg'>{'ABCD'[index]}</span><span className='min-w-0 break-words'>{option}</span></Button>)}</div>
      {player?.answered?.includes(game.index ?? 0) && <p role='status'>本题已提交，不可修改。</p>}
    </> : <p>由主持人开场。每道题限时作答，每题只能提交一次。</p>}
    {!!game?.reveals?.length && <div className='rounded-xl border bg-muted p-4'><h3 className='font-semibold'>已结束题目 · 答案揭晓</h3>{game.reveals.map((q) => <p className='mt-2 text-sm' key={q.index}>第 {q.index + 1} 题：{q.text} — 正确答案 {'ABCD'[q.correct]} · {q.answer}</p>)}</div>}
    {message && <p role='status' className='text-sm'>{message}</p>}
  </section>;
  return null;
}
