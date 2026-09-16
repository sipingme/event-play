'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { activityQuery, eventKeys, roomQuery, roomsQuery } from '../api/queries';
import { commandRoom, createRoom, publishDemo, validateConfig } from '../api/service';
import type { DemoRoom } from '../api/types';
import { Stage } from './stage';
import { HostScreen } from './host';

const stateLabels = {
  waiting: '等待开场',
  running: '演示进行中',
  paused: '已暂停',
  completed: '演示已结束',
  aborted: '已中止'
};
export function Publish({ id }: { id: string }) {
  const { data } = useSuspenseQuery(activityQuery(id));
  const client = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errors = validateConfig(data);
  async function run(action: 'publish' | 'room') {
    setBusy(true);
    setError('');
    try {
      if (action === 'publish') {
        await publishDemo(id);
        await client.invalidateQueries({ queryKey: eventKeys.all });
        toast.success('已保存本地演示版本');
      } else {
        const room = await createRoom(id);
        router.push(`/host/${room.id}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageContainer
      pageTitle='发布与入场'
      pageDescription='确认活动配置，保存版本，再进入现场演示。'
      pageHeaderAction={
        <Button
          nativeButton={false}
          variant='outline'
          render={<Link href={`/dashboard/activities/${id}/edit`} aria-label='返回编辑' />}
        >
          返回编辑
        </Button>
      }
    >
      <div className='grid gap-5 lg:grid-cols-[1.5fr_1fr]'>
        <Stage config={data} />
        <Card className='shadow-none'>
          <CardContent className='space-y-5'>
            <h2 className='font-semibold'>{data.name}</h2>
            <div className='grid grid-cols-2 gap-4 text-sm'>
              <span className='text-muted-foreground'>预计人数</span>
              <span>{data.participants} 人</span>
              <span className='text-muted-foreground'>活动时长</span>
              <span>{data.duration} 秒</span>
              <span className='text-muted-foreground'>当前版本</span>
              <span>{data.release ? `演示 v${data.release.version}` : '尚未保存版本'}</span>
            </div>
            <div className='space-y-3 border-t pt-4'>
              {['活动名称与规则', '队伍与人数配置', '预览资源'].map((text) => (
                <p className='flex items-center gap-2 text-sm' key={text}>
                  <Icons.circleCheck className='size-4' />
                  {text}
                </p>
              ))}
            </div>
            {errors.map((e) => (
              <p key={e} className='text-sm text-destructive'>
                {e}
              </p>
            ))}
            {error && (
              <p role='alert' className='text-sm text-destructive'>
                {error}
              </p>
            )}
            <Button
              className='w-full'
              disabled={busy || errors.length > 0}
              onClick={() => run('publish')}
            >
              保存演示版本
            </Button>
            <Button
              className='w-full'
              variant='outline'
              disabled={busy || !data.release}
              onClick={() => run('room')}
            >
              进入演示控制台 <Icons.arrowRight />
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className='mt-5 rounded-xl border border-dashed p-5'>
        <h3 className='flex items-center gap-2 font-medium'>
          <Icons.lock className='size-4' /> 正式发布尚未启用
        </h3>
        <p className='mt-2 text-sm leading-6 text-muted-foreground'>
          此操作仅保存当前浏览器中的配置快照，不会创建真实活动。微信小程序码、多人连接和正式发布需要
          FastAPI 与小程序接入后启用。
        </p>
      </div>
    </PageContainer>
  );
}
export function Control({ id, screen = false }: { id: string; screen?: boolean }) {
  const { data } = useSuspenseQuery(roomQuery(id));
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'finish' | 'abort' | null>(null);
  async function send(command: Parameters<typeof commandRoom>[1]) {
    setBusy(true);
    try {
      await commandRoom(id, command);
      await client.invalidateQueries({ queryKey: eventKeys.all });
      setConfirm(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (screen)
    return (
      <div className='mx-auto flex min-h-screen max-w-7xl flex-col justify-center gap-4 p-6'>
        <div className='flex justify-between text-sm'>
          <Badge variant='secondary'>{stateLabels[data.state]}</Badge>
          <span>本地演示大屏 · 同一浏览器同步</span>
        </div>
        <HostScreen room={data} />
        <Link href={`/host/${id}`} className='text-sm underline'>
          返回控制台
        </Link>
      </div>
    );
  return (
    <PageContainer
      pageTitle='现场控制台'
      pageDescription={`${data.config.name} · 演示版本 v${data.version}`}
      pageHeaderAction={
        <Button
          nativeButton={false}
          variant='outline'
          render={<Link href={`/screen/${id}`} target='_blank' aria-label='打开演示大屏' />}
        >
          <Icons.externalLink />
          打开演示大屏
        </Button>
      }
    >
      <div className='mb-5 flex flex-wrap gap-3'>
        <Badge>{stateLabels[data.state]}</Badge>
        <Badge variant='outline'>真实玩家：0 人</Badge>
        <Badge variant='outline'>本地模拟计分</Badge>
      </div>
      <div className='grid gap-5 lg:grid-cols-[1.6fr_1fr]'>
        <Stage config={data.config} scores={data.scores} remaining={data.remaining} />
        <Card className='shadow-none'>
          <CardContent>
            <p className='text-sm text-muted-foreground'>本局剩余时间</p>
            <p className='my-5 font-mono text-5xl tracking-tight'>
              {Math.floor(data.remaining / 60)
                .toString()
                .padStart(2, '0')}
              :{(data.remaining % 60).toString().padStart(2, '0')}
            </p>
            <div className='flex flex-wrap gap-2'>
              {data.state === 'waiting' && (
                <Button disabled={busy} onClick={() => send('start')}>
                  开始演示
                </Button>
              )}
              {data.state === 'running' && (
                <Button disabled={busy} onClick={() => send('pause')}>
                  暂停演示
                </Button>
              )}
              {data.state === 'paused' && (
                <Button disabled={busy} onClick={() => send('resume')}>
                  继续演示
                </Button>
              )}
              {['running', 'paused'].includes(data.state) && (
                <Button variant='outline' disabled={busy} onClick={() => setConfirm('finish')}>
                  结束并结算
                </Button>
              )}
              {!['completed', 'aborted'].includes(data.state) && (
                <Button variant='destructive' disabled={busy} onClick={() => setConfirm('abort')}>
                  中止本局
                </Button>
              )}
              {['completed', 'aborted'].includes(data.state) && (
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={`/dashboard/reports?activity=${data.activityId}`}
                      aria-label='查看演示报告'
                    />
                  }
                >
                  查看演示报告
                </Button>
              )}
            </div>
            {confirm && (
              <div role='alert' className='mt-4 rounded-lg border p-3 text-sm'>
                <p>
                  {confirm === 'finish'
                    ? '结束当前演示并保存当前分数？'
                    : '中止后本局不计为正常完成，确认中止？'}
                </p>
                <div className='mt-3 flex gap-2'>
                  <Button disabled={busy} onClick={() => send(confirm)}>
                    确认
                  </Button>
                  <Button variant='outline' onClick={() => setConfirm(null)}>
                    取消
                  </Button>
                </div>
              </div>
            )}
            <p className='mt-6 border-t pt-4 text-xs leading-6 text-muted-foreground'>
              每秒按固定速度模拟各队贡献。暂停会冻结时间与成绩，刷新可恢复进度。该演示不能用于真实比赛。
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className='mt-5 shadow-none'>
        <CardContent>
          <h2 className='mb-3 font-medium'>主持人提示</h2>
          <p className='text-sm leading-7 text-muted-foreground'>
            “欢迎来到{data.config.name}！今天我们将分为{data.config.teams.split(/[,，]/).length}
            支队伍。每一次点击，都将为自己的队伍贡献力量。准备好了吗？让我们一起出发！”
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
export function Reports({ activityId }: { activityId?: string }) {
  const { data } = useSuspenseQuery(roomsQuery());
  const rooms = data.filter(
    (r) =>
      ['completed', 'aborted'].includes(r.state) && (!activityId || r.activityId === activityId)
  );
  function download(room: DemoRoom) {
    const blob = new Blob(
      [JSON.stringify({ ...room, demo: true, notice: '模拟数据，不是真实比赛成绩' }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eventplay-demo-${room.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <PageContainer
      pageTitle='活动报告'
      pageDescription='回顾每一次共同参与。这里仅展示当前浏览器已结束的演示局次。'
    >
      {!rooms.length ? (
        <div className='rounded-xl border border-dashed p-16 text-center'>
          <Icons.trendingUp className='mx-auto mb-4 size-9 text-muted-foreground' />
          <h2>还没有已结束的演示</h2>
          <p className='my-3 text-sm text-muted-foreground'>
            保存一个演示版本，在控制台完成一局后即可查看。
          </p>
          <Button
            nativeButton={false}
            render={<Link href='/dashboard/activities' aria-label='返回活动列表' />}
          >
            选择活动
          </Button>
        </div>
      ) : (
        <div className='grid gap-5 md:grid-cols-2'>
          {rooms.map((room) => (
            <Card key={room.id} className='shadow-none'>
              <CardContent>
                <div className='mb-4 flex items-center justify-between gap-3'>
                  <h2 className='font-medium'>{room.config.name}</h2>
                  <Badge variant='secondary'>{stateLabels[room.state]}</Badge>
                </div>
                <p className='mb-4 text-xs text-muted-foreground'>
                  演示 v{room.version} · 真实参与人数 0 · 模拟数据
                </p>
                {room.config.teams.split(/[,，]/).map((name, i) => (
                  <div key={i} className='flex justify-between border-t py-3 text-sm'>
                    <span>{name}</span>
                    <span>{room.scores[i]} 模拟贡献</span>
                  </div>
                ))}
                <Button variant='outline' className='mt-4' onClick={() => download(room)}>
                  <Icons.share />
                  导出演示数据
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
