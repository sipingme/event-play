'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  playerSession,
  tapLiveRoom,
  type LiveRoom
} from '../api/realtime';
import { ClientReady, PageError } from './shell';
import { Stage } from './stage';

const labels = {
  waiting: '等待开场',
  running: '比赛进行中',
  paused: '已暂停',
  completed: '本局已结算',
  aborted: '本局已中止'
};
function useLive(id: string) {
  const { data } = useSuspenseQuery(liveQuery(id));
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let active = true;
    let socket: WebSocket;
    let timer: ReturnType<typeof setTimeout>;
    let watchdog: ReturnType<typeof setTimeout>;
    function connect() {
      socket = new WebSocket(`${apiBase().replace(/^http/, 'ws')}/rooms/${id}/stream`);
      socket.addEventListener('message', (event) => {
        if (!active) return;
        try {
          const next: LiveRoom = JSON.parse(event.data);
          client.setQueryData<LiveRoom>(liveKey(id), (old) =>
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
  }, [id, client]);
  return { data, connected };
}
export function LivePage({ id, mode }: { id: string; mode: 'host' | 'play' | 'screen' }) {
  return (
    <PageError>
      <ClientReady>
        <LiveView id={id} mode={mode} />
      </ClientReady>
    </PageError>
  );
}
function LiveView({ id, mode }: { id: string; mode: 'host' | 'play' | 'screen' }) {
  const { data, connected } = useLive(id);
  const [session, setSession] = useState(() => playerSession(id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hasOwner, setHasOwner] = useState(() => !!ownerToken(id));
  const [notice, setNotice] = useState('');
  const playerUrl = `${window.location.origin}/live/play/${id}`;
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
  const player = data.players.find((p) => p.id === session?.playerId);
  const ended = data.state === 'completed' || data.state === 'aborted';
  const form = useAppForm({
    defaultValues: { name: '', team: '0' },
    onSubmit: async ({ value }) => {
      setError('');
      try {
        setSession(await joinLiveRoom(id, value.name, Number(value.team)));
      } catch (e) {
        setError((e as Error).message);
      }
    }
  });
  async function command(action: string) {
    setBusy(true);
    setError('');
    try {
      await liveCommand(id, action);
      setConfirm('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function tap() {
    if (busy || !connected || data.state !== 'running') return;
    setBusy(true);
    setError('');
    try {
      const result = await tapLiveRoom(id);
      if (!result.accepted) setError(result.reason);
    } catch {
      setError('发送失败，本次不补发；请检查网络后再点击');
    } finally {
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
      <Badge variant='outline'>已入场 {data.players.length} 人（非在线人数）</Badge>
    </div>
  );
  const stage = (
    <div className='relative overflow-hidden rounded-xl'>
      <Stage config={data.config} scores={data.scores} remaining={data.remaining} live />
      {(data.blackout || data.state !== 'running') && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/65 text-center text-white'>
          <div>
            <p className='text-3xl font-semibold'>
              {data.blackout ? '画面暂时隐藏' : labels[data.state]}
            </p>
            <p className='mt-3'>联机测试 · 以服务端成绩为准</p>
          </div>
        </div>
      )}
    </div>
  );
  if (mode === 'screen')
    return (
      <main className='mx-auto flex min-h-screen max-w-7xl flex-col justify-center p-5'>
        {status}
        {stage}
        <div className='mt-5 grid grid-cols-2 gap-3 md:grid-cols-4'>
          {teams.map((name, i) => (
            <div key={name} className='rounded-xl border p-5 text-xl'>
              {name}
              <strong className='float-right'>{data.scores[i]}</strong>
            </div>
          ))}
        </div>
        <p className='mt-5 text-center text-sm'>
          玩家入口：{typeof window !== 'undefined' ? window.location.origin : ''}/live/play/{id}
        </p>
        {data.state === 'waiting' && <div className='mx-auto mt-4 bg-white p-4'><QRCodeSVG value={playerUrl} size={160} marginSize={4} title='扫码加入本局' /></div>}
      </main>
    );
  if (mode === 'play')
    return (
      <main className='mx-auto min-h-screen max-w-md bg-background px-5 py-8'>
        <p className='mb-4 text-sm font-semibold'>EventPlay · 一起为团队加速</p>
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
            <form.AppField name='team'>
              {(field) => (
                <field.SelectField
                  label='加入战队'
                  options={teams.map((name, i) => ({ label: name, value: String(i) }))}
                />
              )}
            </form.AppField>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(pending) => (
                <Button
                  className='h-12 w-full'
                  disabled={pending || !connected || data.state !== 'waiting'}
                  type='submit'
                >
                  {pending ? '加入中…' : '加入活动'}
                </Button>
              )}
            </form.Subscribe>
            {data.state !== 'waiting' && <p className='text-sm'>本局已开场，暂不接受新玩家。</p>}
          </form>
        ) : (
          <>
            {data.state === 'waiting' && <div role='status' className='mb-5 rounded-xl border bg-muted p-5'><strong>已成功入场，请等待主持人开始</strong><p className='mt-2 text-sm'>无需重复加入。你的队伍：{player ? teams[player.team] : '正在同步'}。如长时间未开场，请向主持人确认房间 ID：{id}。</p></div>}
            <div className='rounded-2xl border p-5'>
              <p>
                {player?.name || '正在恢复身份…'} · {player ? teams[player.team] : ''}
              </p>
              <div className='mt-5 flex justify-between'>
                <div>
                  <p className='text-xs text-muted-foreground'>我的贡献</p>
                  <strong className='text-4xl'>{player?.score ?? 0}</strong>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>剩余时间</p>
                  <strong className='font-mono text-4xl'>{data.remaining}s</strong>
                </div>
              </div>
            </div>
            <Button
              className='my-8 h-48 w-full touch-manipulation select-none rounded-full text-2xl active:scale-95'
              disabled={!connected || !player || data.state !== 'running'}
              onClick={tap}
            >
              {data.state === 'running' ? '点击，为战队加速！' : labels[data.state]}
            </Button>
            <p className='text-center text-xs text-muted-foreground'>
              每次有效点击 +1 分 · 服务端限速 · 断线不补发
            </p>
            {ended && (
              <div className='mt-6 rounded-xl border p-5'>
                <h2 className='font-semibold'>
                  {data.state === 'aborted' ? '本局已中止，不评定胜负' : '本局贡献战报'}
                </h2>
                <p className='mt-3'>
                  {player?.name}：贡献 {player?.score ?? 0} 分
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
        <p className='mb-4 break-all text-sm'>联机房间：{id} · 主持端、玩家端与大屏必须使用同一个房间 ID。</p>
        <div className='mb-5 flex flex-wrap gap-4'>
          <Link className='underline' href='/host'>
            返回活动选择
          </Link>
          <Link className='underline' target='_blank' href={`/live/screen/${id}`}>
            打开联机大屏
          </Link>
          <Link className='underline' target='_blank' href={`/live/play/${id}`}>
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
          <Card>
            <CardContent>
              <p>剩余时间</p>
              {data.state === 'waiting' && <p className='mt-3 text-sm'>{!hasOwner ? '请先恢复主持权限。' : !connected ? '连接恢复后才可开始。' : !data.players.length ? '等待至少一位玩家加入后，即可开始比赛。' : `已有 ${data.players.length} 人入场，可以开始比赛。`}</p>}
              <p className='my-5 font-mono text-6xl'>{data.remaining}s</p>
              <div className='flex flex-wrap gap-3'>
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
                      (action === 'start' && !data.players.length)
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
                    {confirm === 'start'
                      ? '确认所有玩家已入场并开始？开局后禁止新玩家加入。'
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
              <h2 className='mb-4 font-semibold'>战队成绩</h2>
              {teams.map((name, i) => (
                <div key={name} className='flex justify-between border-t py-3'>
                  <span>{name}</span>
                  <strong>{data.scores[i]} 分</strong>
                </div>
              ))}
              <h2 className='my-4 font-semibold'>玩家贡献（前 20 名，同分并列）</h2>
              {ranking.slice(0, 20).map((p) => (
                <div key={p.id} className='flex justify-between border-t py-2 text-sm'>
                  <span>
                    {p.name} · {teams[p.team]}
                  </span>
                  <span>{p.score}</span>
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
