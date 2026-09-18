'use client';
import Image from 'next/image';
import { QuizScene } from './quiz-scene';
import { DrawScene } from './draw-scene';
import { WallScene } from './wall-scene';
import { SocialScene } from './social-scene';
import { CreateScene } from './create-scene';
import { VoteScene } from './vote-scene';
import { cn } from '@/lib/utils';
import type { GameConfig } from '../api/types';
import type { LiveRoom } from '../api/realtime';
import { RaceArena } from './race-scene';
import { ClickArena } from './click-scene';
import { ControlPanel } from './control-panel';
import { ReactionPanel } from './reaction-panel';
import { MoneyArena } from './money-scene';
export function Stage({
  config,
  racers,
  scores = [78, 65, 52],
  remaining,
  compact = false,
  live = false,
  phase = 'running',
  countdown,
  playerCount,
  playerUrl,
  connected
}: {
  config: GameConfig;
  racers?: {id: string; name: string; score: number}[];
  scores?: number[];
  remaining?: number;
  compact?: boolean;
  live?: boolean;
  phase?: LiveRoom['state'];
  countdown?: number;
  playerCount?: number;
  playerUrl?: string;
  connected?: boolean;
}) {
  if(config.mechanic==='social')return <SocialScene room={{id:'preview',config,scores,remaining:config.duration,state:'waiting',revision:0,blackout:false,log:[],players:[]}}/>;
  if(config.mechanic==='create')return <CreateScene room={{id:'preview',config,scores,remaining:config.duration,state:'waiting',revision:0,blackout:false,log:[],players:[]}}/>;
  if(config.mechanic==='vote')return <VoteScene room={{id:'preview',config,scores,remaining:config.duration,state:'waiting',revision:0,blackout:false,log:[],players:[]}}/>;
  if (config.mechanic==='wall') return <WallScene room={{id:'preview',config,scores,remaining:config.duration,state:'waiting',revision:0,blackout:false,log:[],players:[]}}/>;
  if (config.mechanic === 'draw') return <DrawScene compact={compact} room={{id:'preview',config,scores,remaining:remaining??config.duration,state:'waiting',revision:0,blackout:false,log:[],players:[]}}/>;
  if (config.mechanic === 'quiz') return <QuizScene compact={compact} room={{id:'preview',config,scores,remaining:remaining??config.duration,state:'waiting',revision:0,blackout:false,log:[],players:[]}}/>;
  if (['catch'].includes(config.mechanic)) return <ControlPanel connected={connected??true} room={{id:live?'stage':'preview',config,scores,remaining:remaining??config.duration,state:phase,countdown,revision:0,blackout:false,log:[],players:[],game:{type:'catch',lane:1,index:0,progress:.4}}}/>;
  if (['reaction'].includes(config.mechanic)) return <ReactionPanel connected={connected??true} room={{id:live?'stage':'preview', config, scores, remaining:remaining??config.duration, state:phase, countdown, revision:0,blackout:false,log:[],players:[],game:{type:'reaction',cell:4,index:0}}}/>;
  if (config.clickVariant) return <ClickArena config={config} scores={scores} remaining={remaining} compact={compact} live={live} phase={phase} countdown={countdown} playerCount={playerCount} playerUrl={playerUrl} connected={connected} />;
  if (['race', 'alternating'].includes(config.mechanic)) return <RaceArena config={config} racers={racers} scores={scores} remaining={remaining} compact={compact} live={live} phase={phase} countdown={countdown} playerCount={playerCount} playerUrl={playerUrl} connected={connected} />;
  if (config.mechanic === 'money') return <MoneyArena config={config} scores={scores} remaining={remaining} compact={compact} live={live} phase={phase} countdown={countdown} playerCount={playerCount} playerUrl={playerUrl} connected={connected} />;
  const teams = config.teams
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const max = Math.max(100, ...scores) * 1.15;
  const total = scores.reduce((sum, score) => sum + score, 0);
  const goal = config.goal ?? 1000;
  const progress = Math.min(100, total / goal * 100);
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
            : config.mechanic === 'light' ? '每个人的贡献，汇聚成同一束光'
            : config.mechanic === 'alternating' ? '左一下，右一下，齐心加速'
            : '每一次点击，都让我们更进一步'}
        </p>
      </div>
      {['quiz', 'draw', 'catch', 'reaction'].includes(config.mechanic) ? (
        <div className='relative rounded-xl border border-white/25 bg-white/10 p-8 text-center'>
          <p className='text-3xl font-semibold'>{config.mechanic === 'reaction' ? '萌鼠出没 · 看准再出手' : '←  接金币  →'}</p>
          <p className='mt-4 text-sm'>{config.mechanic === 'reaction' ? '九宫格 · 每轮一次机会 · 命中 +1 分' : '三条轨道 · 左右移动 · 接到 +1 分'}</p>
          <p className='mt-3 text-xs opacity-70'>发布后进入联机主持端开始</p>
        </div>
      ) : config.mechanic === 'light' ? (
        <div className='relative flex flex-col items-center gap-5 py-4'>
          <div className='flex size-40 items-center justify-center rounded-full border-4 border-amber-200 bg-amber-100/10 p-5 transition-all duration-500' style={{ opacity: 0.25 + progress / 100 * 0.75, boxShadow: `0 0 ${progress}px #fcd34d88` }}>
            {config.logo ? <Image unoptimized src={config.logo} width={100} height={100} alt='共同点亮的品牌 Logo' className='max-h-28 object-contain' /> : <strong className='text-center text-xl'>{config.brand || 'EventPlay'}</strong>}
          </div>
          <strong className='text-3xl'>{progress >= 100 ? '全场点亮成功！' : `${Math.floor(progress)}%`}</strong>
          <div role='progressbar' aria-label='共同点亮进度' aria-valuenow={Math.floor(progress)} aria-valuemin={0} aria-valuemax={100} className='h-3 w-3/4 overflow-hidden rounded-full bg-white/15'><div className='h-full bg-amber-200 transition-all' style={{ width: `${progress}%` }} /></div>
          <span className='text-sm'>{total} / {goal} 份能量 · 全场合作，不评队伍输赢</span>
        </div>
      ) : config.mechanic === 'alternating' ? (
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
                  <circle cx='36' cy='7' r='6' fill='currentColor'/>
                  <path d='m30 16-10 8m10-8 10 8 10-4m-20-4-5 12-13 5m13-5 13 6 9-2' fill='none' stroke='currentColor' strokeWidth='5' strokeLinecap='round'/>
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
        <span>{config.mechanic === 'light' ? '全场共同贡献，点亮属于我们的品牌' : config.mechanic === 'alternating' ? '左右交替，齐心冲刺' : '点击手机，为你的战队加速'}</span>
        <span>{live ? '联机测试 · 玩家实时贡献' : '演示画面 · 非真实比赛'}</span>
      </div>
    </div>
  );
}
