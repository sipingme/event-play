'use client';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { hitLiveRoom, type LiveRoom } from '../api/realtime';
export function ReactionPanel({
  room,
  playerId,
  connected
}: {
  room: LiveRoom;
  playerId?: string;
  connected: boolean;
}) {
  const pending = useRef(false);
  const [attempted, setAttempted] = useState(-1);
  const [notice, setNotice] = useState('');
  const index = room.game?.index ?? 0;
  const active = room.state === 'running' && connected;
  async function hit(cell: number) {
    if (!active || pending.current || attempted === index) return;
    pending.current = true;
    setAttempted(index);
    setNotice('正在判定…');
    try {
      const result = await hitLiveRoom(room.id, index, cell);
      setNotice(result.accepted ? '命中！+1 分' : '没打中，下一轮看准再出手！');
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      pending.current = false;
    }
  }
  return (
    <section
      aria-label='萌鼠出没游戏'
      className='my-4 rounded-3xl border-4 border-white bg-gradient-to-b from-sky-100 to-lime-100 p-5 text-center text-emerald-950 shadow-lg md:p-8'
    >
      <p className='text-sm font-semibold tracking-widest'>手眼协调 · 看准再出手</p>
      <h2 className='my-3 text-3xl font-black'>{room.config.name}</h2>
      <p>
        {room.state === 'waiting'
          ? '等待开场'
          : room.state === 'paused'
            ? '已暂停'
            : room.state === 'completed'
              ? '挑战结束'
              : room.state === 'aborted'
                ? '本局中止'
                : !connected
                  ? '正在重连，操作已暂停'
                  : `第 ${index + 1} 轮 · 剩余 ${room.remaining} 秒`}
      </p>
      <div
        style={playerId ? undefined : { maxWidth: 'min(100%, 42vh, 32rem)' }}
        className='mx-auto my-5 grid max-w-xl grid-cols-3 gap-3 rounded-3xl bg-emerald-700/10 p-3 md:gap-5 md:p-5'
      >
        {Array.from({ length: 9 }, (_, cell) => (
          <button
            key={cell}
            aria-label={`洞口 ${cell + 1}`}
            data-target={room.game?.cell === cell}
            disabled={!playerId || !active || attempted === index}
            onClick={() => void hit(cell)}
            className={cn(
              'relative aspect-square touch-manipulation overflow-hidden rounded-2xl border-b-8 border-amber-900/30 bg-amber-100 shadow-inner focus-visible:outline-4 focus-visible:outline-sky-500',
              room.game?.cell === cell && 'bg-yellow-200'
            )}
          >
            <span className='absolute inset-x-[12%] bottom-[12%] h-[28%] rounded-[50%] bg-amber-950/50' />
            {room.game?.cell === cell && (
              <svg
                viewBox='0 0 100 100'
                className='absolute inset-0 h-full w-full'
                aria-hidden='true'
              >
                <circle cx='28' cy='30' r='12' fill='#b87a4b' />
                <circle cx='72' cy='30' r='12' fill='#b87a4b' />
                <path d='M20 80V49a30 30 0 0 1 60 0v31Z' fill='#bf8b5c' />
                <ellipse cx='50' cy='66' rx='20' ry='17' fill='#ffe3b2' />
                <circle cx='38' cy='48' r='4' fill='#293b37' />
                <circle cx='62' cy='48' r='4' fill='#293b37' />
                <ellipse cx='50' cy='60' rx='7' ry='5' fill='#69432d' />
                <path d='M44 72q6 6 12 0' fill='none' stroke='#69432d' strokeWidth='3' />
              </svg>
            )}
          </button>
        ))}
      </div>
      <p className='text-sm'>每 2 秒一轮 · 每人每轮一次机会 · 命中 +1 分</p>
      {playerId && (
        <p role='status' className='mt-3 min-h-6 font-bold'>
          {attempted === index ? notice : active ? '小地鼠出现了，点击它！' : ''}
        </p>
      )}
      {!playerId && (
        <div className='mt-5 flex flex-wrap justify-center gap-3'>
          {room.config.teams.split(',').map((team, i) => (
            <div key={i} className='rounded-xl bg-white px-5 py-3'>
              <span>{team}</span>
              <strong className='ml-4 text-2xl'>{room.scores[i] ?? 0}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
