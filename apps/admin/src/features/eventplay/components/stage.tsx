'use client';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { GameConfig } from '../api/types';
export function Stage({
  config,
  scores = [78, 65, 52],
  remaining,
  compact = false,
  live = false
}: {
  config: GameConfig;
  scores?: number[];
  remaining?: number;
  compact?: boolean;
  live?: boolean;
}) {
  const teams = config.teams
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const max = Math.max(100, ...scores) * 1.15;
  return (
    <div className={cn('ep-stage', `ep-stage-${config.theme}`, compact && 'ep-stage-compact')}>
      <div className='ep-stage-stars' aria-hidden='true' />
      <div className='relative flex items-center justify-between gap-3 text-xs'>
        <span className='flex items-center gap-2'>
          {config.logo && (
            <Image
              unoptimized
              width={28}
              height={28}
              src={config.logo}
              alt='品牌 Logo'
              className='size-7 rounded object-contain'
            />
          )}
          {config.brand || 'YOUR BRAND'}
        </span>
        <span>
          {remaining === undefined
            ? '大屏效果预览'
            : `${Math.floor(remaining / 60)
                .toString()
                .padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`}
        </span>
      </div>
      <div className='relative my-6 text-center'>
        <p className='mb-2 text-[10px] tracking-[.3em] opacity-65'>
          EVERYONE PLAYS. EVERYONE BELONGS.
        </p>
        <h2
          className={cn(
            'font-semibold tracking-wide',
            compact ? 'text-xl' : 'text-2xl md:text-3xl'
          )}
        >
          {config.name}
        </h2>
        <p className='mt-2 text-xs opacity-70'>
          {config.mechanic === 'tug'
            ? '凝聚每一份力量，一起推动胜利'
            : '每一次点击，都让我们更进一步'}
        </p>
      </div>
      {config.mechanic === 'race' ? (
        <div className='relative space-y-3'>
          {teams.map((team, i) => (
            <div key={team + i} className='ep-lane'>
              <span className='ep-lane-label'>{team}</span>
              <span className='ep-lane-dashes' />
              <span
                className='ep-runner'
                style={{ left: `${Math.min(87, 24 + ((scores[i] ?? 0) / max) * 60)}%` }}
              >
                <span className='ep-runner-glow' />
                <svg viewBox='0 0 64 38' className='relative h-9 w-14' aria-hidden='true'>
                  <path
                    fill='currentColor'
                    d='m9 13 11-4 16 2 8-8 10 2 5 9-7 3-4-3-8 12-7 1-3 9h-6l2-12-10-2-7 14H4l6-17-6-3z'
                  />
                  <path fill='currentColor' d='m12 12-9-2-3 8 5-2 6 3z' />
                </svg>
              </span>
              <span className='ep-finish' />
            </div>
          ))}
        </div>
      ) : (
        <div className='relative flex h-24 items-center justify-between gap-4'>
          <span className='text-sm'>{teams[0]}</span>
          <div className='relative h-2 flex-1 rounded-full bg-white/20'>
            <span
              className='absolute top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/50 bg-violet-300 shadow-[0_0_50px_#a78bfa]'
              style={{
                left: `${Math.max(15, Math.min(85, 50 + (((scores[0] ?? 0) - (scores[1] ?? 0)) / max) * 30))}%`
              }}
            />
          </div>
          <span className='text-sm'>{teams[1]}</span>
        </div>
      )}
      <div className='relative mt-6 flex items-center justify-between border-t border-white/15 pt-3 text-xs opacity-70'>
        <span>点击手机，为你的战队加速</span>
        <span>{live ? '联机测试 · 玩家实时贡献' : '演示画面 · 非真实比赛'}</span>
      </div>
    </div>
  );
}
