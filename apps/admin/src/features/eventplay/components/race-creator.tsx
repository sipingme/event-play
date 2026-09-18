'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { useAppForm } from '@/lib/form';
import { cn } from '@/lib/utils';
import { configOf, createActivity, saveActivity, readLogo, validateConfig } from '../api/service';
import { eventKeys } from '../api/queries';
import type { Activity, GameConfig } from '../api/types';
import { defaultStoryboard } from '../api/storyboard';
import { StoryboardEditor } from './storyboard-editor';
import { Stage } from './stage';

const steps = ['选玩法', '设置参与', '装扮场景', '设置规则', '试玩发布'];
export function RaceCreator({ initial, activity }: { initial: GameConfig; activity?: Activity }) {
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(activity?.revision ?? 0);
  const router = useRouter();
  const client = useQueryClient();
  const form = useAppForm({
    defaultValues: { ...initial, participants: initial.participationMode === 'individual' ? Math.min(20, initial.participants) : initial.participants, participationMode: initial.participationMode ?? 'team', teamAssignment: initial.teamAssignment ?? 'choose', raceBackdrop: initial.raceBackdrop ?? 'day', raceHorse: initial.raceHorse ?? 'team' } as GameConfig,
    onSubmit: async ({ value }) => {
      try {
        const config = { ...value, duration: Number(value.duration), participants: Number(value.participants), goal: Number(value.goal ?? 1000) };
        const errors = validateConfig(config);
        if (errors.length) throw new Error(errors.join('；'));
        const saved = activity ? await saveActivity(activity.id, config, revision) : await createActivity(config);
        setRevision(saved.revision); form.reset(configOf(saved));
        await client.invalidateQueries({ queryKey: eventKeys.all });
        setNotice('草稿已保存。发布后可创建正式场次；不会自动上架公共体验库。');
        if (!activity) router.replace(`/dashboard/activities/${saved.id}/edit`);
      } catch (error) { setNotice((error as Error).message); }
    }
  });
  return <PageContainer pageTitle='我的游戏创作器' pageDescription='从喜欢的范例开始。默认配置已备好，只改品牌也能开场。' pageHeaderAction={<form.Subscribe selector={s => s.isSubmitting}>{pending => <Button disabled={pending} onClick={() => void form.handleSubmit()}>{pending ? '保存中…' : '保存草稿'}</Button>}</form.Subscribe>}>
    <nav aria-label='创建步骤' className='mb-6 grid grid-cols-5 gap-2'>{steps.map((name, i) => <button type='button' key={name} aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)} className={cn('rounded-xl border px-2 py-4 text-sm transition-colors', step === i ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}><span className='mb-1 block text-xs opacity-70'>0{i + 1}</span>{name}</button>)}</nav>
    {notice && <p role='status' className='mb-4 rounded-xl border bg-muted p-4 text-sm'>{notice}</p>}
    <div className='grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]'>
      <section className='space-y-5 rounded-2xl border bg-card p-5'>
        <div><p className='text-xs text-muted-foreground'>第 {step + 1} 步 / 共 5 步 · 可随时跳转</p><h2 className='mt-2 text-xl font-semibold'>{steps[step]}</h2></div>
        {step === 0 && <><div className='rounded-xl border-2 border-primary bg-primary/5 p-4'><strong>欢乐摇摇赛马</strong><p className='mt-2 text-sm text-muted-foreground'>支持个人竞速和战队协作，限时结束按积分排名。适合年会热场与团队竞赛。</p><p className='mt-3 text-xs'>已选择 · 成熟规则 · 卡通风格</p></div><form.AppField name='participationMode' listeners={{ onChange: ({value}) => { if(value === 'individual') form.setFieldValue('participants', Math.min(20, Number(form.state.values.participants) || 20)); } }}>{field => <fieldset className='space-y-3'><legend className='mb-2 text-sm font-medium'>选择赛马玩法</legend>{([{value:'individual',title:'个人竞速',description:'每人一匹马，最多20人。共享赛场，全员同屏交叉竞速，独立计分。'},{value:'team',title:'战队协作',description:'玩家加入战队，共同贡献积分。分道展示，按团队总积分排名。'}] as const).map(option => <label key={option.value} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-4', field.state.value === option.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted')}><input type='radio' name='participationMode' value={option.value} checked={field.state.value === option.value} onBlur={field.handleBlur} onChange={() => field.handleChange(option.value)} className='mt-1 accent-current' /><span><strong className='block text-sm'>{option.title}</strong><span className='mt-1 block text-xs leading-5 text-muted-foreground'>{option.description}</span></span></label>)}</fieldset>}</form.AppField><form.AppField name='name'>{field => <field.TextField label='游戏名称' maxLength={60} required />}</form.AppField><p className='text-xs text-muted-foreground'>这一版先开放赛马分步创作。其他游戏仍可从体验库制作同款；切换前请保存当前草稿。</p><Link className='text-sm underline' href='/dashboard/templates'>查看其他玩法 →</Link></>}
        {step === 2 && <>
          <form.AppField name='raceBackdrop'>{field => <field.SelectField label='赛场背景氛围' description='同一座卡通赛场的三种光影氛围。' options={[{value:'day',label:'晴日赛场 · 清新明亮'},{value:'sunset',label:'暖阳赛场 · 温暖热烈'},{value:'night',label:'夜色赛场 · 深色氛围'}]} />}</form.AppField>
          <form.AppField name='raceHorse'>{field => <field.SelectField label='骑手与赛马配色' options={[{value:'team',label:'自动配色（推荐）'},{value:'red',label:'全员红色骑手'},{value:'blue',label:'全员蓝色骑手'},{value:'green',label:'全员绿色骑手'},{value:'purple',label:'全员紫色骑手'}]} />}</form.AppField>
          <form.AppField name='brand'>{field => <field.TextField label='品牌名称' maxLength={40} />}</form.AppField>
          <label className='block text-sm'>品牌 Logo<input aria-label='上传品牌 Logo' className='mt-2 block w-full text-xs' type='file' accept='image/png,image/jpeg,image/webp' onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { form.setFieldValue('logo', await readLogo(file)); setNotice('Logo 已更新，请保存草稿。'); } catch (error) { setNotice((error as Error).message); } }} /><span className='mt-2 block text-xs text-muted-foreground'>PNG / JPG / WebP，最多 500KB；请使用有权使用的素材。</span></label>
          <Button size='sm' variant='outline' onClick={() => form.setFieldValue('logo', '')}>移除 Logo</Button>
        </>}
        {step === 3 && <>
          <p className='text-sm text-muted-foreground'>选一套节奏，再按需微调。所有预设均为限时积分赛。</p>
          <div className='flex flex-wrap gap-2'>{[{name:'快速热场',seconds:30},{name:'标准竞赛',seconds:60},{name:'持久挑战',seconds:120}].map(preset => <Button key={preset.name} size='sm' variant='outline' onClick={() => form.setFieldValue('duration', preset.seconds)}>{preset.name} · {preset.seconds}秒</Button>)}</div>
          <form.AppField name='inputMode'>{field => <field.SelectField label='手机如何操作' options={[{value:'shake',label:'摇一摇 · 保留点击备用'},{value:'tap',label:'点击 · 门槛最低'},{value:'swipe',label:'滑屏 · 向上滑动'}]} />}</form.AppField>
          <form.Subscribe selector={s => s.values.inputMode}>{mode => mode === 'swipe' && <form.AppField name='swipeDirection'>{field => <field.SelectField label='滑屏方向' options={[{value:'up',label:'向上'},{value:'down',label:'向下'},{value:'alternating',label:'左右交替'}]} />}</form.AppField>}</form.Subscribe>
          <form.AppField name='duration'>{field => <field.TextField label='比赛时长（秒）' type='number' min={30} max={600} description='30～600 秒；摇动时注意周围空间。' />}</form.AppField>
          <div className='rounded-xl bg-muted p-3 text-sm'>胜负规则：倒计时结束，个人赛比较个人积分，战队赛比较团队总积分；同分并列。计分、防刷和联网同步由系统管理。</div>
        </>}
        {step === 1 && <>

          <form.Subscribe selector={s => s.values.participationMode}>{mode => <form.AppField name='participants'>{field => <field.TextField label='入场人数上限' type='number' min={2} max={mode === 'individual' ? 20 : 500} description={mode === 'individual' ? '2～20 人，每人一匹马，全员同屏交叉竞速。昵称由玩家填写，尚未接入微信身份。' : '2～500 人，按战队展示；正式活动前请压测。'} />}</form.AppField>}</form.Subscribe>
          <form.Subscribe selector={s => s.values.participationMode}>{mode => mode !== 'individual' && <><form.AppField name='teamAssignment'>{field => <field.SelectField label='分队方式' options={[{value:'choose',label:'玩家自选战队'},{value:'balanced',label:'自动均衡分队'}]} />}</form.AppField><form.AppField name='teams'>{field => <field.TextField label='战队名称' description='2～4 个不同队名，用逗号分隔，每个最多 16 字。' />}</form.AppField></>}</form.Subscribe>
          <p className='rounded-xl bg-muted p-3 text-sm'>个人赛每人独立排名；战队赛按团队总积分排名。同分并列，均由主持人统一开场。</p>
        </>}
        {step === 4 && <form.Subscribe selector={s => [s.values, s.isDirty, s.isSubmitting] as const}>{([value, dirty, pending]) => <div className='space-y-4'>
          <p className='text-sm'>先用右侧手机模拟按钮体验大屏反馈，再保存、发布并创建现场场次。</p>
          <dl className='space-y-2 rounded-xl bg-muted p-4 text-sm'><div>游戏：{value.name}</div><div>时长：{value.duration} 秒</div><div>人数上限：{value.participants} 人</div><div>模式：{value.participationMode === 'individual' ? '个人赛' : '战队赛'}</div>{value.participationMode !== 'individual' && <div>队伍：{value.teams}</div>}</dl>
          {validateConfig(value).length > 0 && <p role='alert' className='text-sm text-destructive'>{validateConfig(value).join('；')}</p>}
          <Button className='w-full' disabled={pending} onClick={() => void form.handleSubmit()}>保存我的游戏</Button>
          <Button className='w-full' variant='outline' disabled={!activity || dirty || pending || validateConfig(value).length > 0} onClick={() => router.push(`/dashboard/activities/${activity!.id}/publish`)}>前往发布与联机试玩</Button>
          <p className='text-xs text-muted-foreground'>{!activity || dirty ? '请先保存草稿，才能发布当前配置。' : '草稿已保存，可进入发布页。'} 发布供自己的活动使用，不会自动上架公共体验库。</p>
        </div>}</form.Subscribe>}
        <div className='flex justify-between border-t pt-4'><Button variant='ghost' disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</Button>{step < 4 && <Button onClick={() => setStep(step + 1)}>下一步</Button>}</div>
      </section>
      <div className='min-w-0 space-y-4'><div className='flex justify-between text-sm'><strong>即时效果预览</strong><span className='text-muted-foreground'>大屏 + 手机操作模拟</span></div><form.Subscribe selector={s => s.values}>{value => <RaceTryout key={`${value.participationMode}:${value.participants}:${value.teams}:${value.duration}:${value.inputMode}`} config={value} />}</form.Subscribe><p className='text-xs text-muted-foreground'>模拟预览不创建房间、不消耗活动次数；摇动与滑屏在这里用按钮代替，真实设备操作请到发布页联机试玩。</p></div>
    </div>
    <details className='mt-6 rounded-xl border p-4'><summary className='cursor-pointer text-sm font-medium'>进阶：活动故事板（可选，不影响基础配置）</summary><p className='my-3 text-xs text-muted-foreground'>用于开场与结束画面的编排预演，暂未接入现场自动执行；修改后请保存草稿。</p><form.Subscribe selector={s => s.values}>{value => <StoryboardEditor config={value} board={value.storyboard ?? defaultStoryboard()} onChange={board => form.setFieldValue('storyboard', board)} />}</form.Subscribe></details>
  </PageContainer>;
}

function RaceTryout({ config }: { config: GameConfig }) {
  const individual = config.participationMode === 'individual';
  const teams = individual ? Array.from({length:Math.min(20,Math.max(2,Number(config.participants)||20))},(_,i)=>i===0?'你':`模拟玩家${i+1}`) : config.teams.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 4);
  const [scores, setScores] = useState(() => teams.map(() => 0));
  const [remaining, setRemaining] = useState(Number(config.duration) || 60);
  const [running, setRunning] = useState(false);
  const [team, setTeam] = useState(0);
  useEffect(() => { if (!running || remaining <= 0) return; const timer = setTimeout(() => { setRemaining(n => Math.max(0, n - 1)); setScores(old => old.map((score, i) => i === team ? score : score + (i < teams.length ? 2 + i : 0))); }, 1000); return () => clearTimeout(timer); }, [running, remaining, team, teams.length]);
  const complete = remaining <= 0;
  return <>
    <Stage config={{ ...config, teams: teams.length ? teams.join(',') : '示例战队' }} racers={individual ? teams.map((name,i)=>({id:String(i),name,score:scores[i]})) : undefined} scores={scores} remaining={remaining} compact live phase={complete ? 'completed' : running ? 'running' : 'waiting'} />
    <div className='flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4'>
      <div className='flex-1'><p className='text-sm font-medium'>手机操作模拟 · {individual ? '你控制的玩家' : '你控制的战队'}</p><div className='mt-2 flex flex-wrap gap-2'>{teams.map((name, i) => <Button key={i} size='sm' variant={team === i ? 'default' : 'outline'} onClick={() => setTeam(i)}>{name}</Button>)}</div><p className='mt-2 text-xs text-muted-foreground'>其他参赛者自动产生模拟积分。</p></div>
      <Button disabled={!running || complete} onClick={() => setScores(old => old.map((score, i) => i === team ? score + 1 : score))}>{individual ? '为自己加速' : '为战队加速'} ＋1</Button>
      <Button variant='outline' onClick={() => { if (complete) { setRemaining(Number(config.duration) || 60); setScores(teams.map(() => 0)); } setRunning(!running || complete); }}>{complete ? '重新试玩' : running ? '暂停模拟' : '开始模拟'}</Button>
    </div>
  </>;
}
