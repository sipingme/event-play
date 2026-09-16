'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useSuspenseQuery } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { configOf, templates } from '../api/service';
import { createTrialRoom, liveCommand, liveQuery } from '../api/realtime';
import type { Template } from '../api/types';
import { Stage } from './stage';
import { ReactionPanel } from './reaction-panel';
import { PageError } from './shell';

export const gameCategories = ['摇一摇', '滑屏', '点击', '手眼协调', '控制'];
export function TemplatePoster({ template }: { template: Template }) {
  const kind = template.mechanic;
  return (
    <div
      aria-hidden='true'
      className={cn(
        'relative flex h-48 items-center justify-center overflow-hidden rounded-xl',
        kind === 'money' || kind === 'catch'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-sky-100 text-emerald-900'
      )}
    >
      <div className='absolute -top-10 -right-5 size-44 rounded-full bg-white/50' />
      {kind === 'race' ? (
        <div
          className='absolute inset-0 bg-cover bg-center'
          style={{ backgroundImage: "url('/games/race/stadium-cartoon-v2.png')" }}
        >
          <div
            className='absolute inset-y-0 left-1/3 w-36 bg-[length:400%_100%]'
            style={{ backgroundImage: "url('/games/race/horse-cartoon-red-v2.png')" }}
          />
        </div>
      ) : kind === 'reaction' ? (
        <div className='grid w-44 grid-cols-3 gap-3'>
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className={cn(
                'flex h-10 items-center justify-center rounded-[50%] bg-amber-800/25 text-3xl',
                i === 4 && 'bg-amber-200'
              )}
            >
              {i === 4 ? '●' : ''}
            </div>
          ))}
        </div>
      ) : kind === 'money' ? (
        <div className='rotate-[-10deg] rounded-xl border-4 border-amber-300 bg-amber-50 px-12 py-5 text-center shadow-[10px_10px_0_#e5b751,-10px_-10px_0_#fcd986]'>
          <span className='block text-xs tracking-widest'>EVENTPLAY</span>
          <b className='text-5xl'>100</b>
          <span className='block text-xs'>财富积分 ↑</span>
        </div>
      ) : kind === 'catch' ? (
        <div className='text-center'>
          <div className='mb-6 flex gap-8 text-4xl font-black text-amber-500'>
            <span>●</span>
            <span className='translate-y-4'>●</span>
            <span>●</span>
          </div>
          <div className='mx-auto w-24 rounded-b-3xl border-t-8 border-amber-700 bg-amber-500 py-2 text-xl font-bold'>
            ← →
          </div>
        </div>
      ) : (
        <div className='flex gap-6'>
          <span className='rotate-[-12deg] rounded-2xl border-4 border-white bg-emerald-500 px-6 py-7 text-3xl font-black text-white shadow-lg'>
            左
          </span>
          <span className='rotate-[12deg] rounded-2xl border-4 border-white bg-sky-500 px-6 py-7 text-3xl font-black text-white shadow-lg'>
            右
          </span>
        </div>
      )}
      <span className='absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold'>
        {template.category}
      </span>
      <span className='absolute right-3 bottom-3 rounded-full bg-white/95 px-3 py-1 text-xs'>
        可扫码试玩
      </span>
    </div>
  );
}
export function StarterGames() {
  return (
    <section className='my-6'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>先玩一下，再变成你的活动</h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            五种操作，各一个完整示例。不用填表，先看效果。
          </p>
        </div>
        <Link className='text-sm underline' href='/dashboard/templates'>
          全部游戏
        </Link>
      </div>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-5'>
        {templates
          .filter((t) => t.featured)
          .map((t) => (
            <article key={t.id} className='rounded-2xl border bg-card p-3'>
              <Link href={`/dashboard/templates/${t.id}`} aria-label={`体验${t.name}`}>
                <TemplatePoster template={t} />
                <h3 className='mt-3 font-semibold'>{t.name}</h3>
              </Link>
              <p className='my-3 min-h-10 text-xs leading-5 text-muted-foreground'>
                {t.description}
              </p>
              <Link className='text-sm font-medium underline' href={`/dashboard/templates/${t.id}`}>
                看效果 / 试玩 →
              </Link>
            </article>
          ))}
      </div>
    </section>
  );
}
export function TemplateExperience({ id }: { id: string }) {
  const template = templates.find((t) => t.id === id);
  const [roomId, setRoomId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!template)
    return (
      <PageContainer pageTitle='模板不存在'>
        <Link href='/dashboard/templates'>返回游戏库</Link>
      </PageContainer>
    );
  const config = configOf({ ...template, participants: 10, brand: 'EventPlay 体验场', logo: '' });
  async function create() {
    setBusy(true);
    setError('');
    try {
      setRoomId((await createTrialRoom(config)).id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageContainer
      pageTitle={template.name}
      pageDescription={`${template.category} · ${template.description}`}
      pageHeaderAction={
        <Button
          nativeButton={false}
          render={<Link href={`/dashboard/activities/new?template=${id}`} />}
        >
          用此模板创建
        </Button>
      }
    >
      <Link href='/dashboard/templates' className='mb-4 inline-block text-sm underline'>
        ← 返回游戏库
      </Link>
      {!roomId ? (
        <>
          <div className='mb-4 rounded-xl border bg-muted/40 p-4 text-sm'>
            效果预览使用示意成绩，不是真实比赛。点击下方按钮创建独立试玩房间，体验手机与大屏协同。
          </div>
          {template.mechanic === 'reaction' ? (
            <ReactionPanel
              connected
              room={{
                id: 'preview',
                config,
                state: 'paused',
                remaining: 30,
                scores: [12, 9],
                revision: 0,
                blackout: false,
                log: [],
                players: [],
                game: { type: 'reaction', cell: 4, index: 0 }
              }}
            />
          ) : (
            <Stage config={config} />
          )}
          <Button className='my-6' disabled={busy} onClick={() => void create()}>
            {busy ? '正在创建…' : '创建扫码试玩'}
          </Button>
        </>
      ) : (
        <PageError>
          <Suspense fallback={<p>正在连接试玩房间…</p>}>
            <TrialSession id={roomId} onAgain={create} busy={busy} />
          </Suspense>
        </PageError>
      )}
      {error && (
        <p role='alert' className='text-destructive'>
          {error}
        </p>
      )}
      <p className='my-4 text-sm text-muted-foreground'>
        试玩为 30 秒、最多 10 人，有效期 10
        分钟。不创建正式活动，不发放奖品。喜欢这个玩法后，使用模板创建独立草稿。
      </p>
    </PageContainer>
  );
}
function TrialSession({ id, onAgain, busy }: { id: string; onAgain: () => void; busy: boolean }) {
  const { data: room } = useSuspenseQuery({ ...liveQuery(id, 'trial'), refetchInterval: 1000 });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const ended = ['completed', 'aborted'].includes(room.state);
  const playerUrl = `${window.location.origin}/live/play/${id}`;
  async function command(action: string) {
    setPending(true);
    setError('');
    try {
      await liveCommand(id, action);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <div className='mb-5 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-4'>
        <strong>独立试玩房间</strong>
        <span className='text-sm'>
          已入场 {room.players.length} 人 · {room.remaining} 秒
        </span>
        {room.state === 'waiting' && (
          <Button
            disabled={pending || !room.players.length || !!room.countdown}
            onClick={() => void command('countdown')}
          >
            {room.countdown ? `准备 ${room.countdown}` : '开始试玩'}
          </Button>
        )}
        {room.state === 'running' && (
          <Button disabled={pending} onClick={() => void command('pause')}>
            暂停试玩
          </Button>
        )}
        {room.state === 'paused' && (
          <Button disabled={pending} onClick={() => void command('resume')}>
            继续试玩
          </Button>
        )}
        {!ended && (
          <Button variant='outline' disabled={pending} onClick={() => void command('abort')}>
            结束试玩
          </Button>
        )}
        {ended && (
          <Button disabled={busy} onClick={onAgain}>
            重新试玩
          </Button>
        )}
        <a
          className='text-sm underline'
          href={`/live/screen/${id}`}
          target='_blank'
          rel='noreferrer'
        >
          独立大屏 ↗
        </a>
      </div>
      {error && <p role='alert'>{error}</p>}
      <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]'>
        <div className='min-w-0'>
          <iframe
            title='试玩大屏'
            src={`/live/screen/${id}`}
            className='h-[600px] w-full rounded-xl border'
            allowFullScreen
          />
          <div className='mt-4 flex items-center gap-4 rounded-xl border bg-white p-4 text-slate-800'>
            <QRCodeSVG value={playerUrl} size={100} title='扫码试玩二维码' />
            <div>
              <p className='font-semibold'>手机扫码加入，再点击开始试玩</p>
              <a
                href={playerUrl}
                target='_blank'
                rel='noreferrer'
                className='mt-2 block break-all text-xs underline'
              >
                {playerUrl}
              </a>
              <p className='mt-2 text-xs'>
                也可在右侧浏览器玩家窗口操作。线上首次访问需要预览账号。
              </p>
              {['localhost', '127.0.0.1'].includes(window.location.hostname) && (
                <p className='mt-2 text-xs text-red-700'>
                  本机地址不能用手机扫码访问，请使用线上站点试玩。
                </p>
              )}
            </div>
          </div>
        </div>
        <iframe
          title='试玩玩家'
          key={id}
          src={`/live/play/${id}`}
          className='h-[760px] w-full rounded-2xl border'
          allow='accelerometer; gyroscope'
        />
      </div>
    </section>
  );
}
