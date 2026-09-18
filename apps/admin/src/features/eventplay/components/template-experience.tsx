'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useSuspenseQuery } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { configOf, templates } from '../api/service';
import { creatorLink } from '../api/account';
import { createTrialRoom, liveCommand, liveQuery } from '../api/realtime';
import type { Template } from '../api/types';
import { ClickArt, clickBackground } from './click-art';
import { Stage } from './stage';
import { QuizPoster } from './quiz-scene';
import { DrawPoster } from './draw-scene';
import { WallPoster,WallAdmin } from './wall-scene';
import { SocialPoster,SocialAdmin } from './social-scene';
import { CreatePoster,CreateAdmin } from './create-scene';
import { VotePoster,VoteAdmin } from './vote-scene';
import { controlGames } from '../api/control-games';
import { ControlSprite } from './control-panel';
import { coordinationAsset, coordinationGames } from '../api/coordination';
import { ReactionPanel } from './reaction-panel';
import { PageError } from './shell';
import { RaceVehicle, RaceLandscape, raceColors } from './race-art';

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
      {kind==='social'?<SocialPoster variant={template.socialVariant??'team'}/>:kind==='create'?<CreatePoster variant={template.createVariant??'puzzle'}/>:kind==='vote'?<VotePoster variant={template.voteVariant??'poll'}/>:kind==='wall'?<WallPoster variant={template.wallVariant??'avatars'}/>:kind==='draw'?<DrawPoster variant={template.drawVariant??'list'}/>:kind==='quiz'?<QuizPoster variant={template.quizVariant??'adventure'}/>:kind==='catch'?<div className='absolute inset-0 flex items-center justify-center bg-cover bg-center' style={{backgroundImage:`url('${controlGames[template.controlVariant??'coins'].background}')`}}><div className='flex h-40 w-48 items-center justify-center [&_img]:h-full [&_img]:w-full [&_img]:object-contain'><ControlSprite variant={template.controlVariant??'coins'}/></div></div>:template.clickVariant ? <div className='absolute inset-0 flex items-center justify-center bg-cover bg-center' style={{backgroundImage:`url('${clickBackground[template.clickVariant]}')`}}><div className='h-40 w-56 [&_svg]:h-full'><ClickArt variant={template.clickVariant}/></div></div> : kind === 'race' && template.raceVariant && template.raceVariant !== 'horse' ? <div className='absolute inset-0' style={{background:raceColors[template.raceVariant]}}><RaceLandscape variant={template.raceVariant}/><div className='absolute inset-x-[22%] inset-y-[15%]'><RaceVehicle variant={template.raceVariant}/></div></div> : kind === 'race' ? (
        <div
          className='absolute inset-0 bg-cover bg-center'
          style={{ backgroundImage: "url('/games/race/stadium-cartoon-v2.png')" }}
        >
          <div
            className='absolute inset-y-0 left-1/3 w-36 bg-[length:400%_100%]'
            style={{ backgroundImage: "url('/games/race/horse-cartoon-red-v2.png')" }}
          />
        </div>
      ) : kind === 'alternating' ? (
        <div className='absolute inset-0 bg-cover bg-center' style={{backgroundImage:"url('/games/race/stadium-cartoon-v2.png')"}}><div className='absolute inset-y-2 inset-x-[28%] bg-contain bg-center bg-no-repeat' style={{backgroundImage:"url('/games/race/illustrated/sprint-sprite-v1.png')"}}/><span className='absolute bottom-3 left-3 rounded-full bg-orange-600 px-3 py-1 text-xs font-bold text-white'>左 · 右 · 齐心冲刺</span></div>
      ) : kind === 'reaction' ? (
        <div className='absolute inset-0 flex items-center justify-center bg-cover bg-center' style={{backgroundImage:`url('${coordinationGames[template.reactionVariant??'mole'].background}')`}}>
          <div className='h-40 w-48 bg-contain bg-center bg-no-repeat' style={{backgroundImage:`url('${coordinationAsset(template.reactionVariant??'mole')}')`}}/>
        </div>
      ) : kind === 'money' ? (
        <div className='absolute inset-0 bg-cover bg-center' style={{backgroundImage:"url('/games/money/wealth-plaza-v2.png')"}}>
          <div className='absolute inset-x-0 top-3 text-center text-xl font-black text-orange-700 [text-shadow:0_2px_white]'>疯狂数钱</div>
          <div className='absolute inset-x-[30%] top-10 bottom-1 bg-contain bg-center bg-no-repeat' style={{backgroundImage:"url('/games/money/wealth-mascot-v1.png')"}}/>
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
          render={<Link href={creatorLink(id)} />}
        >
          制作同款 · 我的品牌游戏
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
        {['wall','vote','create','social'].includes(template.mechanic)?'本场试玩由主持人结束':'试玩为 30 秒'}、最多 10 人，有效期 10
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
      {room.config.mechanic==='social'&&<Suspense fallback={<p>加载破冰控制…</p>}><SocialAdmin room={room}/></Suspense>}
      {room.config.mechanic==='create'&&<Suspense fallback={<p>加载共创控制…</p>}><CreateAdmin room={room}/></Suspense>}
      {room.config.mechanic==='vote'&&<VoteAdmin room={room}/>}
      {room.config.mechanic==='wall'&&<Suspense fallback={<p>加载审核区…</p>}><WallAdmin id={id}/></Suspense>}
      <div className='mb-5 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-4'>
        <strong>独立试玩房间</strong>
        <span className='text-sm'>
          已入场 {room.players.length} 人 · {['wall','vote','create','social'].includes(room.config.mechanic)?'由主持人结束':`${room.remaining} 秒`}
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
        {room.config.mechanic==='draw'&&room.state==='running'&&<Button disabled={pending||(room.config.drawVariant==='treasure'&&(room.game?.charge??0)<(room.config.goal??1000))} onClick={()=>void command('draw')}>抽取并锁定结果</Button>}
        {!!room.game?.result&&['egg','box'].includes(room.config.drawVariant??'')&&<Button disabled={pending} onClick={()=>void command('reveal_draw')}>代揭晓全部</Button>}
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
