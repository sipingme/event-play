'use client';
import { clickGames } from '../api/click-games';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import PageContainer from '@/components/layout/page-container';
import { useAppForm } from '@/lib/form';
import {
  apiBase,
  joinLiveRoom,
  liveCommand,
  liveKey,
  liveQuery,
  ownerToken,
  restoreOwner,
  rematchLiveRoom,
  playerSession,
  sendPresence,
  playerProfile,
  rememberPlayer,
  tapLiveRoom,
  type LiveRoom
} from '../api/realtime';
import { ClientReady, PageError } from './shell';
import { Stage } from './stage';
import { MoneyInput } from './money-input';
import { ShakeInput } from './shake-input';
import { SwipeInput } from './swipe-input';
import type { InputKind } from '../api/types';
import { GamePanel } from './game-panels';
import { WallAdmin } from './wall-scene';
import { SocialAdmin } from './social-scene';
import { CreateAdmin } from './create-scene';
import { VoteAdmin } from './vote-scene';
import { ScreenPresentation } from './screen-presentation';
import { HostAgenda } from './host-agenda';
import { cloudToken } from '../api/service';

const labels = {
  waiting: '等待开场',
  running: '比赛进行中',
  paused: '已暂停',
  completed: '本局已结算',
  aborted: '本局已中止'
};
function useLive(id: string, mode: 'host' | 'screen' | 'play', token?: string) {
  const { data } = useSuspenseQuery(liveQuery(id, mode));
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let active = true;
    let socket: WebSocket;
    let timer: ReturnType<typeof setTimeout>;
    let watchdog: ReturnType<typeof setTimeout>;
    function connect() {
      const view = mode === 'host' ? 'full' : mode === 'play' && token ? 'player' : 'screen';
      socket = new WebSocket(`${apiBase().replace(/^http/, 'ws')}/rooms/${id}/stream?view=${view}`);
      socket.addEventListener('open', () => { if (view === 'player') socket.send(JSON.stringify({token})); });
      socket.addEventListener('message', (event) => {
        if (!active) return;
        try {
          const next: LiveRoom = JSON.parse(event.data);
          client.setQueryData<LiveRoom>(liveKey(id, mode), (old) =>
            !old || next.revision >= old.revision ? next : old
          );
          setConnected(true);
          clearTimeout(watchdog);
          watchdog = setTimeout(() => {
            setConnected(false);
            socket.close();
          }, 5000);
        } catch {
          socket.close();
        }
      });
      socket.addEventListener('close', () => {
        if (active) {
          setConnected(false);
          timer = setTimeout(connect, 1500);
        }
      });
      socket.addEventListener('error', () => socket.close());
    }
    connect();
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(watchdog);
      socket?.close();
    };
  }, [id, client, mode, token]);
  return { data, connected };
}
export function LivePage({ id, mode }: { id: string; mode: 'host' | 'play' | 'screen' }) {
  return (
    <PageError>
      <ClientReady>
        <LiveView key={`${mode}:${id}`} id={id} mode={mode} />
      </ClientReady>
    </PageError>
  );
}
function LiveView({ id, mode }: { id: string; mode: 'host' | 'play' | 'screen' }) {
  const router = useRouter();
  const inputPending = useRef(false);
  const [nextSide, setNextSide] = useState<'left' | 'right'>('left');
  const [session, setSession] = useState(() => playerSession(id));
  const { data, connected } = useLive(id, mode, session?.token);
  useEffect(() => {
    if (mode === 'host' || mode === 'play' && !session) return;
    const clientId = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
    let pending = false;
    const pulse = async () => {
      if (pending || document.visibilityState === 'hidden' || !navigator.onLine) return;
      pending = true;
      try { await sendPresence(id, mode === 'screen' ? 'screen' : 'player', clientId); } catch { /* Status expires on the server; the room socket handles reconnection. */ }
      finally { pending = false; }
    };
    void pulse();
    const timer = setInterval(pulse, 5000);
    document.addEventListener('visibilitychange', pulse);
    window.addEventListener('online', pulse);
    return () => {clearInterval(timer);document.removeEventListener('visibilitychange',pulse);window.removeEventListener('online',pulse);};
  }, [id, mode, session]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hasOwner, setHasOwner] = useState(() => !!ownerToken(id));
  const [notice, setNotice] = useState('');
  const [checks, setChecks] = useState<string[]>([]);
  const playerUrl = `${window.location.origin}/live/${data.agendaId ? `event/${data.agendaId}` : `play/${id}`}`;
  const recoveryForm = useAppForm({
    defaultValues: { token: '' },
    onSubmit: async ({ value }) => {
      setError('');
      try {
        await restoreOwner(id, value.token);
        setHasOwner(true);
        recoveryForm.reset();
        setNotice('主持权限已验证并恢复到当前浏览器');
      } catch {
        setError('恢复失败：请检查房间、主持凭证和网络；玩家凭证不能恢复主持权限。');
      }
    }
  });
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('已复制，请妥善保管');
    } catch {
      setError('无法访问剪贴板，请手动复制玩家链接；主持凭证请使用原浏览器操作。');
    }
  }
  const teams = data.config.teams.split(',');
  const individual = data.config.participationMode === 'individual';
  const player = data.players.find((p) => p.id === session?.playerId);
  const ended = data.state === 'completed' || data.state === 'aborted';
  const special = ['quiz', 'draw', 'catch', 'reaction', 'wall', 'vote', 'create', 'social'].includes(data.config.mechanic);
  const profile = playerProfile(data.agendaId);
  const form = useAppForm({
    defaultValues: { name: profile.name, team: String(Math.max(0, teams.indexOf(profile.team))) },
    onSubmit: async ({ value }) => {
      setError('');
      try {
        setSession(await joinLiveRoom(id, value.name, Number(value.team)));
        rememberPlayer(data.agendaId, value.name, teams[Number(value.team)]);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  });
  async function command(action: string) {
    setBusy(true);
    setError('');
    try {
      await liveCommand(id, action === 'start' ? 'countdown' : action);
      setConfirm('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function tap(side?: InputKind) {
    if (inputPending.current || busy || !connected || data.state !== 'running') return;
    inputPending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await tapLiveRoom(id, side ?? (data.config.mechanic === 'money' ? 'swipe' : 'tap'));
      if (result.nextSide) setNextSide(result.nextSide);
      if (!result.accepted) setError(result.reason);
    } catch {
      setError('发送失败，本次不补发；请检查网络后再点击');
    } finally {
      inputPending.current = false;
      setBusy(false);
    }
  }
  const ranking = data.players.toSorted((a, b) => b.score - a.score);
  const status = (
    <div className='mb-4 flex flex-wrap gap-2'>
      <Badge variant={connected ? 'default' : 'destructive'}>
        {connected ? '实时连接' : '断线重连中 · 操作已禁用'}
      </Badge>
      <Badge variant='outline'>{labels[data.state]}</Badge>
      {data.trial && <Badge variant='secondary'>独立试玩 · 非正式活动</Badge>}
      <Badge variant='outline'>已入场 {data.playerCount ?? data.players.length} 人</Badge>
      {data.presence && <><Badge variant='outline'>近期在线 {data.presence.online} 人 · 未检测到心跳 {data.presence.offline} 人</Badge><Badge variant={data.presence.screens ? 'outline' : 'destructive'}>大屏页面 {data.presence.screens} 个</Badge></>}
      {!!data.countdown && <div role='timer' className='w-full rounded-xl bg-amber-500/15 p-5 text-center text-4xl font-bold'>{connected ? `准备开场 · ${data.countdown}` : '正在重连，请等待开场状态同步'}</div>}
    </div>
  );
  const stage = (
    <div className='relative overflow-hidden'>
      {special ? <GamePanel room={data} connected={connected} /> : <Stage config={data.config} racers={data.leaderboard} scores={data.scores} remaining={data.remaining} live phase={data.state} countdown={data.countdown} playerCount={data.playerCount ?? data.players.length} playerUrl={mode === 'screen' ? playerUrl : undefined} connected={connected && !data.blackout} />}
      {(data.blackout || (!special && data.config.mechanic !== 'race' && data.state !== 'running')) && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/65 text-center text-white'>
          <div>
            <p className='text-3xl font-semibold'>
              {data.blackout ? '画面暂时隐藏' : data.config.mechanic === 'light' && data.state === 'completed' ? data.scores.reduce((sum, score) => sum + score, 0) >= (data.config.goal ?? 1000) ? (data.config.clickVariant ? clickGames[data.config.clickVariant].success : '全场点亮成功！') : '时间到，本次共同目标未达成' : labels[data.state]}
            </p>
            <p className='mt-3'>联机测试 · 以服务端成绩为准</p>
          </div>
        </div>
      )}
    </div>
  );
  if (mode === 'screen' && data.config.mechanic === 'race') return <main className='min-h-screen bg-[#e8f5ee] text-slate-800'>
    {stage}
    <details className='mx-auto max-w-7xl p-4 text-sm'>
      <summary className='cursor-pointer text-slate-600'>投屏设置与连接状态</summary>
      <div className='mt-4'>{status}<ScreenPresentation room={data} connected={connected} /><p className='break-all'>玩家入口：{playerUrl}</p></div>
    </details>
  </main>;
  if (mode === 'screen')
    return (
      <main className='mx-auto flex min-h-screen max-w-7xl flex-col justify-center p-5'>
        {status}
        <ScreenPresentation room={data} connected={connected} />
        {stage}
        {!['race', 'draw', 'social'].includes(data.config.mechanic) && <div className='mt-5 grid grid-cols-2 gap-3 md:grid-cols-4'>
          {(!individual ? teams : []).map((name, i) => (
            <div key={name} className='rounded-xl border p-5 text-xl'>
              {name}
              <strong className='float-right'>{data.scores[i]}</strong>
            </div>
          ))}
        </div>}
        <p className='mt-5 text-center text-sm'>
          玩家入口：{playerUrl}
        </p>
        {data.state === 'waiting' && <div className='mx-auto mt-4 bg-white p-4'><QRCodeSVG value={playerUrl} size={160} marginSize={4} title='扫码加入本局' /></div>}
      </main>
    );
  if (mode === 'play')
    return (
      <main className='mx-auto min-h-screen max-w-md bg-background px-5 py-8'>
        <p className='mb-4 text-sm font-semibold'>EventPlay · {individual ? '个人竞速赛' : '一起为团队加速'}</p>
        <h1 className='mb-3 text-2xl font-semibold'>{data.config.name}</h1>
        <p className='mb-3 break-all text-xs text-muted-foreground'>房间：{id}</p>
        {status}
        <p className='mb-6 text-xs leading-5 text-muted-foreground'>
          开发联调玩家入口 · 游客身份，不是微信登录。仅输入测试昵称。
        </p>
        {error && (
          <p role='alert' className='my-4 text-sm text-destructive'>
            {error}
          </p>
        )}
        {!session ? (
          <form
            className='space-y-5'
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit();
            }}
          >
            <form.AppField name='name'>
              {(field) => <field.TextField label='测试昵称' required maxLength={16} />}
            </form.AppField>
            {!individual && data.config.teamAssignment !== 'balanced' && <form.AppField name='team'>
              {(field) => (
                <field.SelectField
                  label='加入战队'
                  options={(!individual ? teams : []).map((name, i) => ({ label: name, value: String(i) }))}
                />
              )}
            </form.AppField>}
            {individual && <p className='text-sm'>个人赛：独立计分，无需选择战队。</p>}
            {!individual && data.config.teamAssignment === 'balanced' && <p className='text-sm'>系统将在入场时自动均衡分队。</p>}
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(pending) => (
                <Button
                  className='h-12 w-full'
                  disabled={pending || !connected || (data.state !== 'waiting' && !(['wall','create','social'].includes(data.config.mechanic)&&data.state==='running')) || !!data.countdown}
                  type='submit'
                >
                  {pending ? '加入中…' : '加入活动'}
                </Button>
              )}
            </form.Subscribe>
            {data.state !== 'waiting' && !['wall','create','social'].includes(data.config.mechanic) && <p className='text-sm'>本局已开场，暂不接受新玩家。</p>}
          </form>
        ) : (
          <>
            {data.state === 'waiting' && !['wall','create','social'].includes(data.config.mechanic) && <div role='status' className='mb-5 rounded-xl border bg-muted p-5'><strong>已成功入场，请等待主持人开始</strong><p className='mt-2 text-sm'>无需重复加入。{individual ? '个人赛：独立计分' : `你的队伍：${player ? teams[player.team] : '正在同步'}`}。如长时间未开场，请向主持人确认房间 ID：{id}。</p></div>}
            <div className='rounded-2xl border p-5'>
              <p>
                {player?.name || '正在恢复身份…'} · {individual ? `全场排名：${player?.rank ?? '—'}（同分并列）` : player ? teams[player.team] : ''}
              </p>
              <div className='mt-5 flex justify-between'>
                <div>
                  <p className='text-xs text-muted-foreground'>{['create','social'].includes(data.config.mechanic)?'参与状态':data.config.mechanic==='vote'?'当前轮次':data.config.mechanic==='wall'?'签到状态':individual ? '我的积分' : '我的贡献'}</p>
                  <strong className='text-4xl'>{['create','social'].includes(data.config.mechanic)?'已加入':data.config.mechanic==='vote'?`第 ${(data.game?.round??0)+1} 轮`:data.config.mechanic==='wall'?'已签到':player?.score ?? 0}</strong>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>{['wall','vote','create','social'].includes(data.config.mechanic)?'参与方式':'剩余时间'}</p>
                  <strong className='font-mono text-4xl'>{data.config.mechanic==='social'?'自愿互动':data.config.mechanic==='create'?'共同创作':data.config.mechanic==='vote'?'按轮提交':data.config.mechanic==='wall'?'手机投稿':`${data.remaining}s`}</strong>
                </div>
              </div>
            </div>
            {special ? <GamePanel room={data} playerId={player?.id} connected={connected} /> : data.config.mechanic === 'race' && data.config.inputMode === 'shake' ? <ShakeInput disabled={!connected || !player || data.state !== 'running' || busy} onInput={(kind) => void tap(kind)} /> : data.config.mechanic === 'race' && data.config.inputMode === 'swipe' ? <SwipeInput disabled={!connected || !player || data.state !== 'running' || busy} direction={data.config.swipeDirection ?? 'up'} nextSide={nextSide} onInput={(kind) => void tap(kind)} /> : data.config.mechanic === 'alternating' ? <div className='my-8 space-y-3'><p className='text-center'>左右交替点击 · 建议下一次：{nextSide === 'left' ? '左' : '右'}</p><div className='grid grid-cols-2 gap-4'>{(['left', 'right'] as const).map((side) => <Button key={side} className='h-36 touch-manipulation text-3xl' variant={side === nextSide ? 'default' : 'outline'} disabled={!connected || !player || data.state !== 'running' || busy} onClick={() => tap(side)}>{side === 'left' ? '左' : '右'}</Button>)}</div></div> : data.config.mechanic === 'money' ? <MoneyInput score={player?.score ?? 0} brand={data.config.brand} disabled={!connected || !player || data.state !== 'running' || busy} onSwipe={() => tap()} /> : <Button
              className='my-8 h-48 w-full touch-manipulation select-none rounded-full text-2xl active:scale-95'
              disabled={!connected || !player || data.state !== 'running'}
              onClick={() => tap()}
            >
              {data.state === 'running' ? data.config.clickVariant ? clickGames[data.config.clickVariant].action : data.config.mechanic === 'light' ? '贡献能量，一起点亮！' : '点击，为战队加速！' : labels[data.state]}
            </Button>}
            <p className='text-center text-xs text-muted-foreground'>
              {special ? '规则由服务器判定 · 断线请等待重连' : '每次有效操作 +1 分 · 服务端限速 · 断线不补发'}
            </p>
            {ended && (
              <div className='mt-6 rounded-xl border p-5'>
                <h2 className='font-semibold'>
                  {data.state === 'aborted' ? '本局已中止，不评定胜负' : data.config.mechanic==='social'?'本场破冰已结束':'本局贡献战报'}
                </h2>
                <p className='mt-3'>
                  {data.config.mechanic==='social'?'感谢你的参与，愿今天的交流成为新的连接。':<>{player?.name}：贡献 {player?.score ?? 0} 分</>}
                </p>
                <p className='mt-2 text-xs text-muted-foreground'>联调成绩，不涉及奖品发放。</p>
              </div>
            )}
          </>
        )}
      </main>
    );
  return (
    <main className='mx-auto min-h-screen max-w-7xl py-6'>
      <PageContainer
        pageTitle={data.config.name}
        pageDescription='联机主持台 · FastAPI 权威计时计分 · 开发测试，不是正式活动服务'
      >
        {status}
        {data.agendaId && cloudToken() && <PageError><Suspense fallback={<p>正在读取整场控制…</p>}><HostAgenda agendaId={data.agendaId} roomId={id} ended={ended} /></Suspense></PageError>}
        {ended && <div className='mb-5 flex flex-wrap gap-3'>
          <Link href='/dashboard/cloud' className='p-2 underline'>返回整场编排 / 下一环节</Link>
          {!data.agendaId && <Button disabled={busy || !hasOwner} onClick={async () => { setBusy(true); setError(''); try { const room = await rematchLiveRoom(id); router.push(`/live/host/${room.id}`); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>相同规则再来一局</Button>}
          <Button variant='outline' onClick={() => {
            const content = JSON.stringify({ roomId: id, name: data.config.name, state: data.state, game: data.game, participationMode: data.config.participationMode ?? 'team', teams: (individual ? [] : teams).map((name, i) => ({ name, score: data.scores[i] })), players: ranking, exportedAt: new Date().toISOString() }, null, 2);
            const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = `eventplay-result-${id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>导出本局成绩 JSON</Button>
          <p className='w-full text-xs text-muted-foreground'>{data.agendaId ? '请返回整场编排推进下一环节；整场入口会自动换场，无需重新扫码。' : '新局使用新二维码，玩家须重新入场。上一局成绩保留；若需更换规则，请回活动编辑器。'}</p>
        </div>}
        <p className='mb-4 break-all text-sm'>联机房间：{id} · 主持端、玩家端与大屏必须使用同一个房间 ID。</p>
        <div className='mb-5 flex flex-wrap gap-4'>
          <Link className='underline' href='/host'>
            返回活动选择
          </Link>
          <Link className='underline' target='_blank' href={data.agendaId ? `/live/event-screen/${data.agendaId}` : `/live/screen/${id}`}>
            打开联机大屏
          </Link>
          <Link className='underline' target='_blank' href={data.agendaId ? `/live/event/${data.agendaId}` : `/live/play/${id}`}>
            打开玩家端
          </Link>
        </div>
        <div className='mb-5 flex flex-wrap items-center gap-5 rounded-xl border p-5'>
          <div className='bg-white p-2'><QRCodeSVG value={playerUrl} size={160} marginSize={4} title='玩家入场二维码' /></div>
          <div className='min-w-0 flex-1 space-y-3'>
            <h2 className='font-semibold'>1. 扫码加入 → 2. 确认入场人数 → 3. 开始比赛</h2>
            <p className='break-all text-sm'>{playerUrl}</p>
            <Button variant='outline' onClick={() => copy(playerUrl)}>复制玩家链接</Button>
            <p className='text-xs text-muted-foreground'>预览站点仍需访问密码。手机请使用线上域名或可访问的局域网地址，不能使用 127.0.0.1。</p>
          </div>
        </div>
        {notice && <p role='status' className='mb-4 text-sm'>{notice}</p>}
        {!hasOwner && (
          <p role='alert' className='mb-4 text-destructive'>
            当前浏览器无主持人凭证，只能观看，不能控制。
          </p>
        )}
        <details className='mb-5 rounded-xl border p-4'>
          <summary className='cursor-pointer font-medium'>主持权限备份与恢复</summary>
          <p className='my-3 text-sm text-muted-foreground'>凭证等同房间控制钥匙，请私下保存，不要发给玩家。当前尚未接入账号找回；凭证和浏览器数据同时丢失时无法恢复。</p>
          {hasOwner ? <Button variant='outline' onClick={() => copy(ownerToken(id))}>复制主持恢复凭证（保密）</Button> : (
            <form className='space-y-3' onSubmit={(event) => { event.preventDefault(); recoveryForm.handleSubmit(); }}>
              <recoveryForm.AppField name='token'>{(field) => <field.TextField label='主持恢复凭证' type='password' required />}</recoveryForm.AppField>
              <recoveryForm.Subscribe selector={(s) => s.isSubmitting}>{(pending) => <Button type='submit' disabled={pending}>验证并恢复主持权限</Button>}</recoveryForm.Subscribe>
            </form>
          )}
        </details>
        {error && (
          <p role='alert' className='mb-4 text-destructive'>
            {error}
          </p>
        )}
        <div className='grid gap-5 lg:grid-cols-[1.6fr_1fr]'>
          {stage}
          {data.config.mechanic==='social'&&hasOwner&&<PageError><Suspense fallback={<p>加载破冰控制…</p>}><SocialAdmin room={data}/></Suspense></PageError>}
          {data.config.mechanic==='create'&&hasOwner&&<PageError><Suspense fallback={<p>加载共创控制…</p>}><CreateAdmin room={data}/></Suspense></PageError>}
          {data.config.mechanic==='vote'&&hasOwner&&<VoteAdmin room={data}/>}
          {data.config.mechanic==='wall'&&hasOwner&&<PageError><Suspense fallback={<p>加载审核区…</p>}><WallAdmin id={id}/></Suspense></PageError>}
          <Card>
            <CardContent>
              <p>{data.config.mechanic==='social'?'破冰阶段':data.config.mechanic==='create'?'共创阶段':data.config.mechanic==='vote'?'主持人控制轮次':data.config.mechanic==='wall'?'签到阶段':'剩余时间'}</p>
              {data.state === 'waiting' && !data.countdown && <fieldset className='mt-3 space-y-2 rounded-lg border p-3'><legend className='text-sm font-semibold'>开场检查（主持人手动确认）</legend>{['大屏画面已正确投放','音量与游戏规则已确认'].map((item)=><label key={item} className='flex items-center gap-2 text-sm'><input type='checkbox' checked={checks.includes(item)} onChange={(e)=>setChecks((old)=>e.target.checked?[...old,item]:old.filter((text)=>text!==item))} />{item}</label>)}<p className='text-xs text-muted-foreground'>在线状态来自最近15秒心跳，切后台可能离线。大屏页面连接不代表投影设备或音量正常，仍需目视确认。</p></fieldset>}
              {data.state === 'waiting' && <p className='mt-3 text-sm'>{!hasOwner ? '请先恢复主持权限。' : !connected ? '连接恢复后才可开始。' : !data.players.length ? '等待至少一位玩家加入后，即可开始比赛。' : `已有 ${data.players.length} 人入场，可以开始比赛。`}</p>}
              <p className='my-5 font-mono text-3xl'>{['wall','vote','create','social'].includes(data.config.mechanic)?labels[data.state]:`${data.remaining}s`}</p>
              <div className='flex flex-wrap gap-3'>
                {!!data.countdown && <Button variant='outline' disabled={busy || !connected || !hasOwner} onClick={()=>command('cancel_countdown')}>取消倒计时，重新开放入场</Button>}
                {data.config.mechanic === 'draw' && data.state === 'running' && <Button disabled={busy || !connected || !hasOwner} onClick={() => setConfirm('draw')}>抽取并锁定结果</Button>}
                {!!data.game?.result&&<><Button disabled={busy||!connected||!hasOwner} onClick={()=>command('reveal_draw')}>代揭晓全部</Button><Button variant='outline' onClick={()=>{
                  const result=data.game?.result;if(!result)return;
                  const cell=(value:string)=>'"'+(/^[=+@\-\t\r]/.test(value)?"'":'')+value.replaceAll('"','""')+'"';
                  const csv='\uFEFF'+[['房间','奖项','玩家ID','昵称','开奖时间'],...result.winners.map(w=>[data.id,result.prizeName??'',w.id,w.name,new Date(result.at).toISOString()])].map(row=>row.map(cell).join(',')).join('\r\n');
                  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='EventPlay-winners.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
                }}>导出中奖名单</Button></>}
                {(data.state === 'waiting'
                  ? [['start', '开始比赛']]
                  : data.state === 'running'
                    ? [
                        ['pause', '暂停比赛'],
                        ['finish', '提前结算']
                      ]
                    : data.state === 'paused'
                      ? [
                          ['resume', '继续比赛'],
                          ['finish', '提前结算']
                        ]
                      : []
                ).map(([action, label]) => (
                  <Button
                    key={action}
                    disabled={
                      busy ||
                      !connected ||
                      !ownerToken(id) ||
                      (action === 'start' && (!data.players.length || !!data.countdown || checks.length < 2))
                    }
                    onClick={() =>
                      ['start', 'finish'].includes(action) ? setConfirm(action) : command(action)
                    }
                  >
                    {label}
                  </Button>
                ))}
                {!ended && (
                  <Button
                    variant='destructive'
                    disabled={busy || !connected || !ownerToken(id)}
                    onClick={() => setConfirm('abort')}
                  >
                    中止
                  </Button>
                )}
                <Button
                  variant='outline'
                  disabled={busy || !connected || !ownerToken(id)}
                  onClick={() => command(data.blackout ? 'restore' : 'blackout')}
                >
                  {data.blackout ? '恢复画面' : '大屏遮罩'}
                </Button>
              </div>
              {confirm && (
                <div role='alert' className='mt-4 rounded-lg border p-4'>
                  <p>
                    {confirm === 'draw' ? '确认从本局入场名单中抽取？结果立即锁定，不能重抽。' : confirm === 'start'
                      ? '确认所有玩家已入场？将开始服务端3秒倒计时，期间关闭新玩家入场，倒计时结束后才开始计分。'
                      : '确认结束本局？此操作不可恢复。'}
                  </p>
                  <Button
                    className='mt-3 mr-2'
                    disabled={busy || !connected}
                    onClick={() => command(confirm)}
                  >
                    确认
                  </Button>
                  <Button variant='outline' disabled={busy} onClick={() => setConfirm('')}>
                    取消
                  </Button>
                </div>
              )}
              <p className='mt-4 text-xs text-muted-foreground'>
                成绩仅来自真实玩家请求，不再模拟增长。游客身份与房间创建仅用于可信开发环境。
              </p>
            </CardContent>
          </Card>
        </div>
        <div className='mt-5 grid gap-5 md:grid-cols-2'>
          <Card>
            <CardContent>
              <h2 className='mb-4 font-semibold'>{individual ? '个人赛成绩' : data.config.mechanic==='social'?'营地参与':'战队成绩'}</h2>
              {(!individual ? teams : []).map((name, i) => (
                <div key={name} className='flex justify-between border-t py-3'>
                  <span>{name}</span>
                  <strong>{data.config.mechanic==='social'?(data.game?.social?.groups[i]?.members??0)+' 人':data.scores[i]+' 分'}</strong>
                </div>
              ))}
              <h2 className='my-4 font-semibold'>{data.config.mechanic==='social'?'入场玩家（前 20 位）':'玩家贡献（前 20 名，同分并列）'}</h2>
              {ranking.slice(0, 20).map((p) => (
                <div key={p.id} className='flex justify-between border-t py-2 text-sm'>
                  <span>
                    {p.name}{data.config.mechanic!=='social'&&!individual&&<> · {teams[p.team]}</>}
                  </span>
                  {data.config.mechanic!=='social'&&<span>{p.score}</span>}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <h2 className='mb-4 font-semibold'>服务端操作记录</h2>
              {data.log.map((entry, i) => (
                <p key={`${entry.at}-${i}`} className='border-t py-3 text-sm'>
                  {new Date(entry.at).toLocaleTimeString()} · {entry.text}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </main>
  );
}
