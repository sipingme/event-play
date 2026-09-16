'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppForm } from '@/lib/form';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { activityQuery, brandQuery, eventKeys } from '../api/queries';
import {
  configOf,
  createActivity,
  readLogo,
  saveActivity,
  templates,
  validateConfig
} from '../api/service';
import type { Activity, GameConfig } from '../api/types';
import { Stage } from './stage';

export function NewActivity() {
  const search = useSearchParams();
  const { data: brand } = useSuspenseQuery(brandQuery());
  const template = templates.find((t) => t.id === search.get('template')) ?? templates[0];
  return (
    <Editor
      initial={{
        name: template.name,
        description: search.get('prompt') ?? template.description,
        mechanic: template.mechanic,
        theme: template.theme,
        teams: template.teams,
        duration: template.duration,
        participants: 200,
        brand: brand.name,
        logo: brand.logo
      }}
    />
  );
}
export function EditActivity({ id }: { id: string }) {
  const { data } = useSuspenseQuery(activityQuery(id));
  return <Editor key={id} initial={configOf(data)} activity={data} />;
}
function Editor({ initial, activity }: { initial: GameConfig; activity?: Activity }) {
  const router = useRouter();
  const client = useQueryClient();
  const [revision, setRevision] = useState(activity?.revision ?? 0);
  const [notice, setNotice] = useState('');
  const [aiText, setAiText] = useState('');
  const [previous, setPrevious] = useState<GameConfig | null>(null);
  const [savedAt, setSavedAt] = useState('');
  const form = useAppForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      setNotice('');
      try {
        const errors = validateConfig(value);
        if (errors.length) throw new Error(errors.join('；'));
        const saved = activity
          ? await saveActivity(activity.id, value, revision)
          : await createActivity(value);
        setRevision(saved.revision);
        form.reset(configOf(saved));
        setSavedAt(new Date().toLocaleTimeString('zh-CN'));
        await client.invalidateQueries({ queryKey: eventKeys.all });
        toast.success('草稿已保存到当前浏览器');
        if (!activity) router.replace(`/dashboard/activities/${saved.id}/edit`);
      } catch (e) {
        setNotice((e as Error).message);
      }
    }
  });
  function applyPreset(text: string) {
    const values = { ...form.state.values };
    setPrevious(values);
    const changes: string[] = [];
    if (/科技|蓝|未来/.test(text)) {
      form.setFieldValue('theme', 'space');
      changes.push('科技蓝主题');
    }
    if (/红|年会|金/.test(text)) {
      form.setFieldValue('theme', 'gold');
      changes.push('红金主题');
    }
    if (/春|绿|游园/.test(text)) {
      form.setFieldValue('theme', 'garden');
      changes.push('春日主题');
    }
    const minutes = text.match(/(\d+)\s*分钟/);
    if (minutes) {
      form.setFieldValue('duration', Number(minutes[1]) * 60);
      changes.push(`${minutes[1]} 分钟`);
    }
    const people = text.match(/(\d+)\s*人/);
    if (people) {
      form.setFieldValue('participants', Number(people[1]));
      changes.push(`${people[1]} 人`);
    }
    if (/拔河|对抗/.test(text)) {
      form.setFieldValue('mechanic', 'tug');
      form.setFieldValue('teams', '星河队,闪电队');
      changes.push('双队拔河');
    }
    setNotice(
      changes.length
        ? `本地规则已应用：${changes.join('、')}。请预览并保存。此功能未调用 AI。`
        : '暂未匹配演示规则。试试“科技蓝、3 分钟、200 人”；自由语言 AI 尚未接入。'
    );
  }
  return (
    <PageContainer
      pageTitle={activity ? '活动编辑器' : '创建一场新活动'}
      pageDescription='配置你的玩法，在预览中看到变化。'
      pageHeaderAction={
        <div className='flex gap-2'>
          <Button
            nativeButton={false}
            variant='outline'
            render={<Link href='/dashboard/activities' aria-label='返回活动列表' />}
          >
            返回活动
          </Button>
          <form.Subscribe selector={(s) => [s.isSubmitting, s.isDirty]}>
            {([pending, dirty]) => (
              <>
                <Button disabled={pending} onClick={() => form.handleSubmit()}>
                  <Icons.check />
                  {pending ? '保存中…' : '保存草稿'}
                </Button>
                {activity && (
                  <Button
                    variant='outline'
                    disabled={dirty || pending}
                    onClick={() => router.push(`/dashboard/activities/${activity.id}/publish`)}
                  >
                    发布预览 <Icons.arrowRight />
                  </Button>
                )}
              </>
            )}
          </form.Subscribe>
        </div>
      }
    >
      {notice && (
        <div role='status' className='mb-4 rounded-lg border bg-muted/40 p-3 text-sm'>
          {notice}
        </div>
      )}
      <div className='grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]'>
        <Card className='shadow-none'>
          <CardContent>
            <div className='mb-5 flex items-center justify-between'>
              <h2 className='font-medium'>活动配置</h2>
              <Badge variant='secondary'>{savedAt ? `已保存 ${savedAt}` : '草稿'}</Badge>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
              }}
              className='space-y-5'
            >
              <form.AppField name='name'>
                {(field) => <field.TextField label='活动名称' required maxLength={60} />}
              </form.AppField>
              <form.AppField name='description'>
                {(field) => (
                  <field.TextareaField label='活动需求' placeholder='描述你的场景与目标' />
                )}
              </form.AppField>
              <form.AppField name='mechanic'>
                {(field) => (
                  <field.SelectField
                    label='互动玩法'
                    options={[
                      { value: 'race', label: '团队竞速' },
                      { value: 'tug', label: '团队拔河' }
                    ]}
                  />
                )}
              </form.AppField>
              <div className='grid grid-cols-2 gap-3'>
                <form.AppField name='duration'>
                  {(field) => (
                    <field.TextField label='时长（秒）' type='number' min={30} max={600} />
                  )}
                </form.AppField>
                <form.AppField name='participants'>
                  {(field) => <field.TextField label='预计人数' type='number' min={2} max={500} />}
                </form.AppField>
              </div>
              <form.AppField name='teams'>
                {(field) => (
                  <field.TextField label='队伍名称' description='使用逗号分隔；拔河需要两队。' />
                )}
              </form.AppField>
              <form.AppField name='theme'>
                {(field) => (
                  <field.SelectField
                    label='视觉主题'
                    options={[
                      { value: 'gold', label: '年会红金' },
                      { value: 'space', label: '未来科技' },
                      { value: 'garden', label: '春日游园' }
                    ]}
                  />
                )}
              </form.AppField>
              <form.AppField name='brand'>
                {(field) => <field.TextField label='品牌名称' maxLength={40} />}
              </form.AppField>
              <label className='block text-sm'>
                品牌 Logo
                <input
                  aria-label='上传品牌 Logo'
                  type='file'
                  accept='image/png,image/jpeg,image/webp'
                  className='mt-2 block w-full text-xs file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-2'
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      form.setFieldValue('logo', await readLogo(file));
                    } catch (error) {
                      setNotice((error as Error).message);
                    }
                  }}
                />
                <span className='mt-2 block text-xs text-muted-foreground'>
                  PNG / JPG / WebP，小于 500KB
                </span>
              </label>
            </form>
          </CardContent>
        </Card>
        <div className='min-w-0 space-y-5'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium'>大屏预览</span>
            <Badge variant='outline'>示意渲染 · 非 PixiJS 引擎</Badge>
          </div>
          <form.Subscribe selector={(s) => s.values}>
            {(value) => <Stage config={value} />}
          </form.Subscribe>
          <Card className='shadow-none'>
            <CardContent>
              <div className='flex items-center gap-2'>
                <Icons.sparkles className='size-5' />
                <h2 className='font-medium'>告诉我，你想怎么改</h2>
                <Badge variant='secondary'>规则演示</Badge>
              </div>
              <p className='my-3 text-xs leading-5 text-muted-foreground'>
                当前支持主题、人数、时长和双队拔河的本地规则匹配。自由生成将在接入模型后启用。
              </p>
              <Textarea
                aria-label='修改要求'
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder='改成科技蓝，3 分钟，200 人参与…'
              />
              <div className='mt-3 flex flex-wrap gap-2'>
                <Button onClick={() => applyPreset(aiText)} disabled={!aiText.trim()}>
                  <Icons.sparkles />
                  应用演示修改
                </Button>
                <Button
                  variant='outline'
                  onClick={() => applyPreset(form.state.values.description)}
                >
                  从活动需求填入
                </Button>
                {previous && (
                  <Button
                    variant='ghost'
                    onClick={() => {
                      for (const key of Object.keys(previous) as (keyof GameConfig)[])
                        form.setFieldValue(key, previous[key]);
                      setPrevious(null);
                      setNotice('已撤回上一次演示修改');
                    }}
                  >
                    撤回修改
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          <div className='grid gap-3 md:grid-cols-3'>
            {[
              ['01', '扫码入场', '微信登录与入场码待接入'],
              ['02', '点击互动', '全场共同推动游戏进程'],
              ['03', '成绩时刻', '团队排名与品牌贡献卡']
            ].map(([n, title, text]) => (
              <div key={n} className='rounded-xl border p-4'>
                <span className='text-xs text-muted-foreground'>{n}</span>
                <h3 className='my-2 text-sm font-medium'>{title}</h3>
                <p className='text-xs leading-5 text-muted-foreground'>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
