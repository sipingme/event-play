'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAppForm } from '@/lib/form';
import { createAgenda, listActivities, listAgendas, openAgenda, type Agenda } from '../api/service';

export function AgendaPanel() {
  const router = useRouter();
  const client = useQueryClient();
  const { data: activities } = useSuspenseQuery({ queryKey: ['eventplay-agenda-activities'], queryFn: listActivities });
  const { data: agendas } = useSuspenseQuery({ queryKey: ['eventplay-agendas'], queryFn: listAgendas, refetchInterval: 5000 });
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const available = activities.filter((a) => a.release && !a.archived);
  const form = useAppForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => {
      if (!steps.length || busy) return;
      setBusy(true); setError('');
      try { await createAgenda(value.name, steps); setSteps([]); form.reset(); await client.invalidateQueries({ queryKey: ['eventplay-agendas'] }); }
      catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }
  });
  async function open(agenda: Agenda, next: boolean) {
    if (!window.confirm(next ? '确认进入下一环节？固定入口将自动换场，玩家确认队伍后加入。' : '接管当前环节将使旧主持凭证失效，确认继续？')) return;
    setBusy(true); setError('');
    try { const id = await openAgenda(agenda, next); await client.invalidateQueries({queryKey:['eventplay-agendas']}); router.push(`/live/host/${id}`); }
    catch (e) { setError((e as Error).message); await client.invalidateQueries({queryKey:['eventplay-agendas']}); }
    finally { setBusy(false); }
  }
  return <section className='mb-8 space-y-4 rounded-xl border bg-card p-6'>
    <h2 className='text-lg font-semibold'>整场活动编排</h2>
    <p className='text-sm text-muted-foreground'>依次添加已发布的游戏环节（最多20个）。保存时锁定版本；上一环节结束后才能推进。整场共用固定二维码，大屏与玩家页面自动换场，玩家需确认队伍并加入新环节。</p>
    {error && <p role='alert' className='text-destructive'>{error}</p>}
    <form className='space-y-3' onSubmit={(e) => {e.preventDefault(); form.handleSubmit();}}>
      <form.AppField name='name'>{(field) => <field.TextField label='整场活动名称' required maxLength={60} />}</form.AppField>
      <div className='flex flex-wrap gap-2'>{available.map((a) => <Button type='button' variant='outline' key={a.id} disabled={busy || steps.length >= 20} onClick={() => setSteps([...steps,a.id])}>添加：{a.name}</Button>)}</div>
      {!available.length && <p className='text-sm'>请先在活动管理中发布至少一个云活动。</p>}
      <ol className='space-y-2'>{steps.map((id,i) => <li className='flex items-center gap-3 rounded-lg bg-muted p-2' key={`${id}-${i}`}><span className='flex-1'>{i+1}. {activities.find((a)=>a.id===id)?.name}</span><Button type='button' variant='outline' disabled={busy || i===0} aria-label={`上移环节${i+1}`} onClick={()=>setSteps((old)=>{const next=[...old]; [next[i-1],next[i]]=[next[i],next[i-1]];return next;})}>上移</Button><Button type='button' variant='outline' disabled={busy} onClick={()=>setSteps(steps.filter((_,index)=>index!==i))}>移除</Button></li>)}</ol>
      <Button type='submit' disabled={busy || !steps.length}>保存整场编排</Button>
    </form>
    {agendas.map((agenda) => <article className='space-y-3 rounded-xl border p-4' key={agenda.id}>
      <h3 className='font-semibold'>{agenda.name}</h3>
      <div className='flex flex-wrap items-center gap-4'><div className='bg-white p-2'><QRCodeSVG value={`${window.location.origin}/live/event/${agenda.id}`} size={120} title={`${agenda.name} 整场入口`} /></div><div className='space-y-2'><Link className='block underline' href={`/live/event/${agenda.id}`} target='_blank'>打开整场玩家入口</Link><Link className='block underline' href={`/live/event-screen/${agenda.id}`} target='_blank'>打开整场大屏</Link><p className='text-xs text-muted-foreground'>此二维码可提前分享，整场保持不变。</p></div></div>
      <ol className='space-y-1 text-sm'>{agenda.steps.map((step,i)=><li key={i} aria-current={i===agenda.index?'step':undefined}>{i===agenda.index?'▶ ':''}{i+1}. {step.name} · v{step.version}{i<agenda.index?' · 已结束':''}</li>)}</ol>
      <div className='flex flex-wrap gap-2'>{agenda.index>=0 && <Button variant='outline' disabled={busy} onClick={()=>open(agenda,false)}>接管当前环节</Button>}{agenda.index<agenda.steps.length-1 && <Button disabled={busy} onClick={()=>open(agenda,true)}>{agenda.index<0?'进入首个环节':'进入下一环节'}</Button>}</div>
    </article>)}
  </section>;
}
