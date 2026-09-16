'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { listAgendas, openAgenda } from '../api/service';

export function HostAgenda({ agendaId, roomId, ended }: { agendaId: string; roomId: string; ended: boolean }) {
  const { data } = useSuspenseQuery({queryKey:['eventplay-agendas'],queryFn:listAgendas,refetchInterval:3000});
  const client = useQueryClient();
  const router = useRouter();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const agenda = data.find((item)=>item.id===agendaId);
  if (!agenda) return <p>当前工作区无此编排的管理权限，请连接正确工作区。</p>;
  const current = agenda.steps[agenda.index];
  const next = agenda.steps[agenda.index+1];
  const outdated = current?.roomId !== roomId;
  return <section className='mb-5 space-y-3 rounded-xl border bg-card p-5'>
    <h2 className='font-semibold'>整场控制 · {agenda.name}</h2>
    <p>当前：第 {agenda.index+1}/{agenda.steps.length} 环节 · {current?.name}</p>
    <p className='text-sm text-muted-foreground'>下一环节：{next?.name ?? '无，已是最后一环'}。{outdated?'此主持页已不是当前环节，请接管当前环节。':'上一环节结束后可直接推进，无需返回管理端。'}</p>
    {error && <p role='alert' className='text-destructive'>{error}</p>}
    {(next || outdated) && <Button disabled={busy || (!outdated && !ended)} onClick={async()=>{
      if (!window.confirm(outdated?'接管当前环节会使旧主持凭证失效，确认？':`确认进入下一环节：${next.name}？玩家和大屏将自动换场。`)) return;
      setBusy(true);setError('');
      try {const id=await openAgenda(agenda,!outdated);await client.invalidateQueries({queryKey:['eventplay-agendas']});router.push(`/live/host/${id}`);}
      catch(e){setError((e as Error).message);await client.invalidateQueries({queryKey:['eventplay-agendas']});}
      finally{setBusy(false);}
    }}>{outdated?'接管当前环节':'结束后进入下一环节'}</Button>}
  </section>;
}
