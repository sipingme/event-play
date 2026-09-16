'use client';
import { useSyncExternalStore } from 'react';
import { onlineManager, useSuspenseQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { publicEventQuery } from '../api/queries';
import { ClientReady, PageError } from './shell';
import { LivePage } from './realtime';

export function EventPortal({ id, mode }: { id: string; mode: 'play' | 'screen' }) {
  return <PageError><ClientReady><Portal key={`${id}:${mode}`} id={id} mode={mode} /></ClientReady></PageError>;
}

function Portal({ id, mode }: { id: string; mode: 'play' | 'screen' }) {
  const online = useSyncExternalStore((notify) => onlineManager.subscribe(notify), () => onlineManager.isOnline(), () => true);
  const { data, error, refetch, isFetching } = useSuspenseQuery(publicEventQuery(id));
  const url = `${window.location.origin}/live/event/${id}`;
  const between = ['completed', 'aborted'].includes(data.state) && !data.finished;
  return <>
    <header className='mx-auto max-w-7xl space-y-2 border-b p-5'>
      <h1 className='text-xl font-semibold'>{data.name}</h1>
      <p role='status' className='text-sm'>{data.finished ? '整场活动已结束，感谢参与！' : data.index < 0 ? '等待主持人开启首个环节' : `第 ${data.index + 1}/${data.total} 环节 · ${data.stepName}`}</p>
      <p className='text-sm text-muted-foreground'>{between ? '本环节已结束，等待主持人推进下一环节；请保留此页面。' : '整场固定入口，无需重复扫码；换场后确认队伍并加入新环节。'}</p>
      {(!online || error) && <div role='alert' className='flex items-center gap-3 text-sm text-destructive'>{!online ? '网络已断开，恢复连接后自动同步环节。' : '环节同步暂时中断，当前显示上次状态。'}<Button variant='outline' disabled={!online || isFetching} onClick={() => void refetch()}>重新同步</Button></div>}
    </header>
    {data.roomId ? <LivePage key={data.roomId} id={data.roomId} mode={mode} /> : <div className='mx-auto max-w-lg space-y-4 p-10 text-center'><p>活动尚未开场，请保留页面，开场后会自动显示当前环节。</p>{mode === 'screen' && <div className='mx-auto w-fit bg-white p-4'><QRCodeSVG value={url} size={200} title='整场玩家入口' /></div>}</div>}
  </>;
}
