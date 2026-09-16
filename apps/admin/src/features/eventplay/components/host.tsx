'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { activitiesQuery, eventKeys, roomQuery } from '../api/queries';
import { createRoom, hostChecks, hostCommand, updateHost } from '../api/service';
import type { DemoRoom } from '../api/types';
import { ClientReady, PageError } from './shell';
import { Stage } from './stage';
import { enterActivityRoom } from '../api/realtime';
import type { GameConfig } from '../api/types';

const labels = {
  waiting: '准备开场',
  running: '演示进行中',
  paused: '演示已暂停',
  completed: '演示已结算',
  aborted: '本局已中止'
};
function time(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}
export function HostShell({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <div className='min-h-screen bg-muted/30'>
      <header className='flex flex-wrap items-center justify-between gap-3 border-b bg-background px-5 py-4 md:px-8'>
        <Link href='/host' className='flex items-center gap-3 font-semibold'>
          <Icons.video className='size-6' />
          EventPlay{' '}
          <span className='border-l pl-3 text-sm font-normal text-muted-foreground'>主持人端</span>
        </Link>
        <div className='flex items-center gap-3'>
          <Badge variant='outline'>本地彩排</Badge>
          <Button
            variant='ghost'
            size='icon'
            aria-label='切换明暗主题'
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            <Icons.brightness />
          </Button>
          <Link href='/dashboard' className='text-sm underline underline-offset-4'>
            管理后台
          </Link>
        </div>
      </header>
      <div className='border-b bg-background px-5 py-3 text-xs leading-5 text-muted-foreground'>
        本地彩排使用模拟分数；“新建联机房间”连接实时后端、接收玩家真实点击。两种模式均未接入正式微信身份，不可用于正式比赛。
      </div>
      <main className='mx-auto max-w-[1600px] py-6'>
        <PageError>
          <ClientReady>{children}</ClientReady>
        </PageError>
      </main>
    </div>
  );
}
export function HostLobby() {
  const { data } = useSuspenseQuery(activitiesQuery());
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const activities = data.filter((item) => !item.archived && item.release);
  async function enterLive(id: string, config: GameConfig) {
    setBusy(id);
    setError('');
    try {
      const room = await enterActivityRoom(id, config);
      router.push(`/live/host/${room.id}`);
    } catch (e) {
      setError(`实时后端连接失败或创建失败：${(e as Error).message}`);
    } finally {
      setBusy('');
    }
  }
  async function enter(id: string) {
    setBusy(id);
    setError('');
    try {
      const room = await createRoom(id);
      router.push(`/host/${room.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <PageContainer
      pageTitle='准备好，让全场一起开玩。'
      pageDescription='选择已保存演示版本的活动，进入专注现场操作的主持人工作台。'
    >
      {error && (
        <p role='alert' className='mb-4 text-destructive'>
          {error}
        </p>
      )}
      <div className='mb-6 grid gap-3 sm:grid-cols-3'>
        {['01 选择活动与版本', '02 检查画面与规则', '03 开局、控场与结算'].map((text) => (
          <div key={text} className='rounded-xl border bg-background p-5 text-sm font-medium'>
            {text}
          </div>
        ))}
      </div>
      {!activities.length ? (
        <div className='rounded-xl border border-dashed bg-background p-10 text-center'>
          <Icons.calendar className='mx-auto mb-4 size-9 text-muted-foreground' />
          <h2 className='text-lg font-semibold'>还没有可主持的活动</h2>
          <p className='my-3 text-sm text-muted-foreground'>
            在管理端创建活动，并在发布预览中保存演示版本。
          </p>
          <Link href='/dashboard/activities' className='underline'>
            前往我的活动
          </Link>
        </div>
      ) : (
        <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
          {activities.map((item) => (
            <Card key={item.id} className='overflow-hidden shadow-none'>
              <CardContent className='space-y-4'>
                <Stage config={item.release!.config} compact />
                <div className='flex items-start justify-between gap-3'>
                  <h2 className='font-semibold'>{item.release!.config.name}</h2>
                  <Badge variant='secondary'>v{item.release!.version}</Badge>
                </div>
                <p className='text-sm text-muted-foreground'>
                  {item.release!.config.mechanic === 'race' ? '团队竞速' : '团队拔河'} ·{' '}
                  {item.release!.config.duration} 秒 · 预计 {item.release!.config.participants} 人
                </p>
                <Button className='h-12 w-full' disabled={!!busy} onClick={() => enterLive(item.id, item.release!.config)}>
                  {busy === item.id ? '正在准备…' : '进入联机主持端'}
                  <Icons.arrowRight />
                </Button>
                <p className='text-xs text-muted-foreground'>
                  继续本活动未结束的联机房间；结束后创建新局。进入后分享玩家二维码，再开始比赛。
                </p>
                <Button
                  variant='outline'
                  className='h-12 w-full'
                  disabled={!!busy}
                  onClick={() => enter(item.id)}
                >
                  仅本地彩排（玩家无法加入）
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
export function HostDesk({ id }: { id: string }) {
  const { data, isRefetchError, refetch } = useSuspenseQuery(roomQuery(id));
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'start' | 'finish' | 'abort' | null>(null);
  const ready = hostChecks.every((item) => data.host?.checks.includes(item.id));
  const ended = ['completed', 'aborted'].includes(data.state);
  const teams = data.config.teams
    .split(/[,，]/)
    .map((name, i) => ({ name: name.trim(), score: data.scores[i] ?? 0, index: i }))
    .toSorted((a, b) => b.score - a.score);
  async function run(action: () => Promise<DemoRoom>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await client.invalidateQueries({ queryKey: eventKeys.all });
      setConfirm(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const script =
    data.state === 'waiting'
      ? `欢迎来到「${data.config.name}」！我们将分为 ${teams.length} 支队伍，通过点击为自己的队伍贡献力量。本次是模拟彩排，请主持人确认大屏与规则后开始。`
      : data.state === 'paused'
        ? '现场稍作调整，比赛已暂停，时间与成绩保持不变。请大家稍候，听到主持人指令后我们继续。'
        : data.state === 'running'
          ? `各位队员准备好了吗？每一份力量都很重要！距离结束还有 ${data.remaining} 秒，一起为自己的队伍加油！`
          : data.state === 'aborted'
            ? '本次彩排已中止，不宣布正式获胜结果。请等待主持人说明后续安排。'
            : '本轮演示结束，感谢大家的参与！以下为模拟成绩，真实活动上线后将显示正式比赛结果。';
  return (
    <PageContainer
      pageTitle={data.config.name}
      pageDescription={`本地模拟彩排 · 玩家无法加入 · 演示 v${data.version}`}
    >
      <div className='mb-5 rounded-xl border border-amber-500 p-5'>
        <strong>这里不是联机主持端，不能控制手机玩家。</strong>
        <p className='mt-2 text-sm'>请返回活动选择，使用「进入联机主持端」。已有玩家等待时，请使用与玩家相同房间 ID 的联机主持链接，不要另建一局。</p>
        <Link href='/host' className='mt-3 inline-block underline'>返回活动选择 →</Link>
      </div>
      <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap gap-2'>
          <Badge>{labels[data.state]}</Badge>
          <Badge variant='outline'>真实在线 0 / 预计 {data.config.participants}</Badge>
        </div>
        <div className='flex gap-2'>
          <Button
            nativeButton={false}
            variant='outline'
            render={<Link href='/host' aria-label='返回活动选择' />}
          >
            切换活动
          </Button>
          <Button
            nativeButton={false}
            render={
              <Link
                href={`/screen/${id}`}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='打开演示大屏'
              />
            }
          >
            <Icons.externalLink />
            打开大屏
          </Button>
        </div>
      </div>
      {(error || isRefetchError) && (
        <div
          role='alert'
          className='mb-4 rounded-xl border border-destructive p-4 text-sm text-destructive'
        >
          {error || '本地状态读取失败，请恢复后再操作。'}
          <Button className='ml-3' variant='outline' onClick={() => refetch()}>
            重新读取
          </Button>
        </div>
      )}
      <div className='grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]'>
        <div className='min-w-0 space-y-5'>
          <Card className='shadow-none'>
            <CardContent>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='font-semibold'>大屏监看</h2>
                <span className='text-xs text-muted-foreground'>本地每秒同步 · SVG 示意</span>
              </div>
              <HostScreen room={data} />
              <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
                <p className='text-xs text-muted-foreground'>遮罩只隐藏画面，不会暂停计时。</p>
                <Button
                  variant='outline'
                  disabled={busy || isRefetchError}
                  onClick={() => run(() => updateHost(id, { blackout: !data.host?.blackout }))}
                >
                  <Icons.eyeOff />
                  {data.host?.blackout ? '恢复大屏画面' : '开启大屏遮罩'}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className='shadow-none'>
            <CardContent>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='font-semibold'>主持人口播</h2>
                <Badge variant='outline'>随阶段更新 · 非 AI 实时生成</Badge>
              </div>
              <p className='text-lg leading-9'>{script}</p>
            </CardContent>
          </Card>
          <Card className='shadow-none'>
            <CardContent>
              <h2 className='mb-3 font-semibold'>{ended ? '本局模拟成绩' : '战队模拟贡献'}</h2>
              {teams.map((team, i) => (
                <div key={team.index} className='flex items-center gap-4 border-t py-4'>
                  <span className='w-5 font-mono text-muted-foreground'>{i + 1}</span>
                  <span className='min-w-0 flex-1 truncate'>{team.name}</span>
                  <span className='font-mono text-xl'>{team.score}</span>
                  <span className='text-xs text-muted-foreground'>模拟分</span>
                </div>
              ))}
              <p className='mt-2 text-xs text-muted-foreground'>
                按固定速率模拟，非玩家输入；同分不作胜负裁定。
              </p>
            </CardContent>
          </Card>
        </div>
        <aside className='order-first space-y-5 xl:sticky xl:top-5 xl:order-last'>
          <Card className='shadow-none'>
            <CardContent>
              <p className='text-sm text-muted-foreground'>本局剩余时间</p>
              <p className='my-6 font-mono text-6xl font-semibold tabular-nums tracking-tight'>
                {time(data.remaining)}
              </p>
              <div className='mb-5 h-1.5 overflow-hidden rounded-full bg-muted'>
                <div
                  className='h-full bg-primary transition-all'
                  style={{ width: `${(data.remaining / data.config.duration) * 100}%` }}
                />
              </div>
              <div className='space-y-3'>
                {data.state === 'waiting' && (
                  <Button
                    className='h-14 w-full text-base'
                    disabled={busy || !ready || isRefetchError}
                    onClick={() => setConfirm('start')}
                  >
                    开始演示
                    <Icons.arrowRight />
                  </Button>
                )}
                {data.state === 'running' && (
                  <Button
                    className='h-14 w-full text-base'
                    disabled={busy || isRefetchError}
                    onClick={() => run(() => hostCommand(id, 'pause'))}
                  >
                    暂停演示
                  </Button>
                )}
                {data.state === 'paused' && (
                  <Button
                    className='h-14 w-full text-base'
                    disabled={busy || isRefetchError}
                    onClick={() => run(() => hostCommand(id, 'resume'))}
                  >
                    继续演示
                  </Button>
                )}
                {['running', 'paused'].includes(data.state) && (
                  <Button
                    variant='outline'
                    className='h-12 w-full'
                    disabled={busy || isRefetchError}
                    onClick={() => setConfirm('finish')}
                  >
                    提前结束并结算
                  </Button>
                )}
                {!ended && (
                  <Button
                    variant='ghost'
                    className='w-full text-destructive'
                    disabled={busy || isRefetchError}
                    onClick={() => setConfirm('abort')}
                  >
                    中止本局
                  </Button>
                )}
                {ended && (
                  <Button
                    nativeButton={false}
                    className='h-12 w-full'
                    render={
                      <Link
                        href={`/dashboard/reports?activity=${data.activityId}`}
                        aria-label='查看本次活动报告'
                      />
                    }
                  >
                    查看活动报告
                  </Button>
                )}
              </div>
              {confirm && (
                <div role='alert' className='mt-4 rounded-lg border bg-muted/40 p-4'>
                  <p className='text-sm leading-6'>
                    {confirm === 'start'
                      ? `确认开始 ${data.config.duration} 秒模拟演示？`
                      : confirm === 'finish'
                        ? '确认提前结束？将保留当前模拟分数，本局不能恢复。'
                        : '确认中止？本局不可恢复，不作为正常完成的比赛。'}
                  </p>
                  <div className='mt-3 flex gap-2'>
                    <Button
                      disabled={busy || isRefetchError}
                      onClick={() => run(() => hostCommand(id, confirm))}
                    >
                      {busy ? '处理中…' : '确认操作'}
                    </Button>
                    <Button disabled={busy} variant='outline' onClick={() => setConfirm(null)}>
                      取消
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className='shadow-none'>
            <CardContent>
              <h2 className='mb-4 font-semibold'>
                开场检查{' '}
                <span className='text-sm font-normal text-muted-foreground'>
                  {data.host?.checks.length ?? 0}/3
                </span>
              </h2>
              <div className='space-y-4'>
                {hostChecks.map((item) => (
                  <label key={item.id} className='flex items-start gap-3 text-sm leading-6'>
                    <input
                      type='checkbox'
                      className='mt-1 size-4 accent-current'
                      checked={data.host?.checks.includes(item.id) ?? false}
                      disabled={busy || data.state !== 'waiting' || isRefetchError}
                      onChange={(event) =>
                        run(() => updateHost(id, { check: item.id, checked: event.target.checked }))
                      }
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <p className='mt-4 border-t pt-3 text-xs leading-5 text-muted-foreground'>
                检查项为人工确认，不代表已检测到投屏连接。微信入场待接入。
              </p>
            </CardContent>
          </Card>
          <Card className='shadow-none'>
            <CardContent>
              <h2 className='mb-4 font-semibold'>操作记录</h2>
              <div className='max-h-60 space-y-3 overflow-auto'>
                {data.host?.log.length ? (
                  data.host.log.map((item, i) => (
                    <div key={`${item.at}-${i}`} className='flex gap-3 text-xs leading-5'>
                      <time className='shrink-0 font-mono text-muted-foreground'>
                        {new Date(item.at).toLocaleTimeString('zh-CN', { hour12: false })}
                      </time>
                      <span>{item.text}</span>
                    </div>
                  ))
                ) : (
                  <p className='text-sm text-muted-foreground'>完成开场检查后，即可开始彩排。</p>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}
export function HostScreen({ room }: { room: DemoRoom }) {
  return (
    <div className='relative overflow-hidden rounded-xl'>
      <Stage config={room.config} scores={room.scores} remaining={room.remaining} />
      {room.host?.blackout ? (
        <div className='absolute inset-0 flex items-center justify-center bg-black text-white'>
          <p className='text-xl tracking-widest'>画面暂时隐藏 · 请稍候</p>
        </div>
      ) : (
        room.state !== 'running' && (
          <div className='pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 p-6 text-center text-white'>
            <div>
              <p className='text-3xl font-semibold'>{labels[room.state]}</p>
              <p className='mt-3 text-sm'>
                {room.state === 'waiting'
                  ? '请听从主持人指令'
                  : room.state === 'paused'
                    ? '时间与成绩已冻结'
                    : '感谢参与本次彩排'}
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
