'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { useAppForm } from '@/lib/form';
import { CLOUD_KEY, cloudToken, connectCloud, importLocalActivities, listManagedRooms, takeoverRoom } from '../api/service';
import { ClientReady, PageError } from './shell';
import { AgendaPanel } from './agenda';
import { useAccount } from './account-boundary';

export function CloudPage() {
  return <PageError><ClientReady><CloudView /></ClientReady></PageError>;
}
function CloudView() {
  const account = useAccount();
  const [connected] = useState(() => !!cloudToken());
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  async function run(action: () => Promise<void>) {
    setBusy(true); setNotice('');
    try { await action(); } catch (e) { setNotice((e as Error).message); } finally { setBusy(false); }
  }
  const form = useAppForm({
    defaultValues: { token: '' },
    onSubmit: async ({ value }) => {
      await run(async () => { await connectCloud(value.token); window.location.reload(); });
    }
  });
  return <PageContainer pageTitle='云工作区与房间' pageDescription={account ? '登录即连接个人云空间，管理已发布作品的现场场次。' : '旧版密钥工作区保持可用；新作品建议通过账号创建。'}>
    <div className='mb-6 rounded-xl border bg-card p-6 space-y-4'>
      <h2 className='font-semibold'>{connected ? '已连接云工作区' : '当前使用本地活动'}</h2>
      <p className='text-sm text-muted-foreground'>{account ? `当前属于 ${account.email}。新作品和品牌自动保存到云端；旧本地演示不会自动导入。需要迁移时可主动导入本地草稿，导入后请检查并重新发布。` : '本地活动不会自动删除或上传。管理密钥能读取全部云活动并接管主持权限，请妥善保管，不要分享给玩家。'}</p>
      {notice && <p role='status' className='text-sm'>{notice}</p>}
      {connected ? <div className='flex flex-wrap gap-3'>
        {!account && <Button disabled={busy} onClick={() => run(async () => { await navigator.clipboard.writeText(cloudToken()); setNotice('管理密钥已复制，请私下保存。'); })}>复制管理密钥（保密）</Button>}
        <Button variant='outline' disabled={busy} onClick={() => run(async () => { const count = await importLocalActivities(); await client.invalidateQueries(); setNotice(`已处理 ${count} 个本地活动，作为云端草稿导入；重复导入不会覆盖。请检查后重新发布。`); })}>导入本地活动为云端草稿</Button>
        {!account && <Button variant='outline' disabled={busy} onClick={() => { if (window.confirm('请确认已备份管理密钥。断开后返回本地模式，不删除云端数据。')) { localStorage.removeItem(CLOUD_KEY); window.location.reload(); } }}>断开工作区</Button>}
        <Link href='/dashboard/activities' className='p-2 underline'>管理云活动 →</Link>
      </div> : <>
        <Button disabled={busy} onClick={() => run(async () => { await connectCloud(); window.location.reload(); })}>创建云工作区</Button>
        <form className='max-w-xl space-y-3' onSubmit={(event) => { event.preventDefault(); form.handleSubmit(); }}>
          <form.AppField name='token'>{(field) => <field.TextField type='password' label='已有工作区管理密钥' required />}</form.AppField>
          <Button variant='outline' disabled={busy} type='submit'>连接已有工作区</Button>
        </form>
      </>}
    </div>
    {connected && <PageError><Suspense fallback={<p>正在读取活动编排…</p>}><AgendaPanel /></Suspense></PageError>}
    <h2 className='mb-4 text-lg font-semibold'>联机房间历史</h2>
    <PageError><Suspense fallback={<p>正在读取房间…</p>}><ManagedRooms /></Suspense></PageError>
  </PageContainer>;
}
function ManagedRooms() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { data: rooms } = useSuspenseQuery({ queryKey: ['eventplay-managed-rooms'], queryFn: listManagedRooms, refetchInterval: 5000 });
  const labels = { waiting: '等待入场', running: '进行中', paused: '暂停', completed: '已结算', aborted: '已中止' };
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <>
    {error && <p role='alert'>{error}</p>}
    {!rooms.length && <p className='rounded-xl border border-dashed p-8 text-sm'>暂无云工作区房间。先创建或导入活动、发布版本，再进入联机主持端。旧本地模式房间不会自动归属到工作区。</p>}
    <div className='space-y-3'>{rooms.map((room) => <div key={room.id} className='flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5'>
      <div><h3 className='font-semibold'>{room.config.name} · 第 {room.round} 局</h3><p className='mt-2 text-sm'>{labels[room.state]} · 已入场 {room.players.length} 人</p><p className='mt-1 text-xs text-muted-foreground'>{room.id}</p></div>
      <div className='flex gap-3'>
        {!['completed', 'aborted'].includes(room.state) && <Button disabled={busy} onClick={() => run(async () => { if (!window.confirm('接管将使该房间旧主持凭证失效，确认继续？')) return; const next = await takeoverRoom(room.id); router.push(`/live/host/${next.id}`); })}>接管主持</Button>}
        <Link href={`/live/screen/${room.id}`} className='p-2 underline'>查看大屏／成绩</Link>
      </div>
    </div>)}</div>
  </>;
}
