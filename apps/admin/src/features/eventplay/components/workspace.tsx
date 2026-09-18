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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { activitiesQuery, eventKeys } from '../api/queries';
import { archiveActivity, configOf, createActivity, templates } from '../api/service';
import type { Activity, Template } from '../api/types';
import { Stage } from './stage';
import { StarterGames, TemplatePoster } from './template-experience';
import { catalogCategories, catalogMembership, plannedGames, visibleTemplates } from '../api/template-catalog';

export function TemplateCard({ template }: { template: Template }) {
  return (
    <Card className='overflow-hidden py-0 shadow-none'>
      <Link
        href={`/dashboard/templates/${template.id}`}
        className='block p-2'
        aria-label={`使用${template.name}模板`}
      >
        {template.featured || template.showcase ? <TemplatePoster template={template}/> : <Stage compact config={{ ...template, participants: 200, brand: 'EventPlay', logo: '' }} />}
      </Link>
      <CardContent className='pb-5'>
        <div className='mb-2 flex items-center justify-between'>
          <h3 className='font-medium'>{template.name}</h3>
          <Badge variant='secondary'>{catalogMembership(template)[0]}</Badge>
        </div>
        <p className='text-xs leading-5 text-muted-foreground'>{template.description}</p>
        <div className='mt-4 flex items-center justify-between text-xs text-muted-foreground'>
          <Link href={`/dashboard/templates/${template.id}`} className='underline'>看效果 / 试玩</Link>
          <Link
            className='flex items-center gap-1 text-foreground hover:underline'
            href={`/dashboard/activities/new?template=${template.id}`}
          >
            使用模板 <Icons.arrowRight className='size-3' />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
function ActivityRows({ items }: { items: Activity[] }) {
  const client = useQueryClient();
  const router = useRouter();
  async function action(item: Activity, kind: 'copy' | 'archive') {
    try {
      if (kind === 'copy') {
        const copy = await createActivity({
          ...configOf(item),
          name: `${item.name.slice(0, 55)} · 副本`
        });
        router.push(`/dashboard/activities/${copy.id}/edit`);
      } else await archiveActivity(item.id);
      await client.invalidateQueries({ queryKey: eventKeys.all });
      toast.success(kind === 'copy' ? '已复制为独立草稿' : '已更新归档状态');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  if (!items.length)
    return (
      <div className='rounded-xl border border-dashed p-12 text-center'>
        <Icons.calendar className='mx-auto mb-3 size-8 text-muted-foreground' />
        <h3>还没有符合条件的活动</h3>
        <p className='my-3 text-sm text-muted-foreground'>调整筛选，或创建你的第一场互动。</p>
        <Button
          nativeButton={false}
          render={<Link href='/dashboard/activities/new' aria-label='创建活动' />}
        >
          创建活动
        </Button>
      </div>
    );
  return (
    <div className='overflow-x-auto rounded-xl border bg-card'>
      <table className='w-full min-w-[650px] text-sm'>
        <thead className='border-b bg-muted/35 text-left text-xs text-muted-foreground'>
          <tr>
            <th className='p-4 font-normal'>活动名称</th>
            <th className='font-normal'>玩法 / 人数</th>
            <th className='font-normal'>状态</th>
            <th className='font-normal'>最近更新</th>
            <th className='pr-4 text-right font-normal'>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className='border-b last:border-0 hover:bg-muted/30'>
              <td className='p-4'>
                <Link
                  className='font-medium hover:underline'
                  href={`/dashboard/activities/${a.id}/edit`}
                >
                  {a.name}
                </Link>
                <p className='mt-1 text-xs text-muted-foreground'>
                  {a.brand} · 草稿 v{a.revision}
                </p>
              </td>
              <td>
                {{ money: '数钱挑战', race: '团队竞速', tug: '团队拔河', alternating: '左右冲刺', light: '共同点亮', quiz: '答题闯关', draw: '基础抽奖', catch: '接金币', reaction: '萌鼠出没', wall:'签到上墙',social:'社交破冰',create:'群体共创',vote:'投票评分' }[a.mechanic]}
                <p className='mt-1 text-xs text-muted-foreground'>预计 {a.participants} 人</p>
              </td>
              <td>
                <Badge variant='secondary'>
                  {a.archived ? '已归档' : a.release ? `演示版本 v${a.release.version}` : '草稿'}
                </Badge>
              </td>
              <td className='text-xs text-muted-foreground'>
                {new Date(a.updatedAt).toLocaleDateString('zh-CN')}
              </td>
              <td className='pr-3 text-right'>
                <Button size='sm' variant='ghost' onClick={() => action(a, 'copy')}>
                  复制
                </Button>
                <Button size='sm' variant='ghost' onClick={() => action(a, 'archive')}>
                  {a.archived ? '恢复' : '归档'}
                </Button>
                <Button
                  nativeButton={false}
                  size='sm'
                  variant='outline'
                  render={
                    <Link href={`/dashboard/activities/${a.id}/edit`} aria-label='编辑活动' />
                  }
                >
                  编辑
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Workspace() {
  const { data } = useSuspenseQuery(activitiesQuery());
  const [prompt, setPrompt] = useState('');
  const router = useRouter();
  return (
    <PageContainer
      pageTitle='把下一场活动，变成全场的主场。'
      pageDescription='从一个想法开始，创造大家都想参与的现场。'
    >
      <StarterGames />
      <section className='ep-preview-hero my-3 grid gap-8 rounded-2xl border p-6 md:grid-cols-[1.3fr_1fr] md:p-8'>
        <div className='flex flex-col justify-center'>
          <Badge variant='outline' className='mb-5'>
            EVENTPLAY STUDIO
          </Badge>
          <h2 className='text-2xl font-semibold tracking-tight md:text-3xl'>
            一句话，让全场玩起来。
          </h2>
          <p className='mt-3 text-sm leading-6 text-muted-foreground'>
            描述你的活动，选择熟悉的玩法。
            <br />
            加入品牌与团队，让每一次互动都属于你。
          </p>
          <div className='mt-6 rounded-xl border bg-background p-3'>
            <Textarea
              aria-label='描述你的活动需求'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='例如：为公司年会做一场 200 人的部门赛马，红金风格…'
              className='min-h-20 resize-none border-0 shadow-none focus-visible:ring-0'
            />
            <div className='mt-2 flex items-center justify-between'>
              <span className='pl-2 text-xs text-muted-foreground'>当前以模板生成演示方案</span>
              <Button
                onClick={() =>
                  router.push(`/dashboard/activities/new?prompt=${encodeURIComponent(prompt)}`)
                }
              >
                <Icons.sparkles /> 创建我的活动
              </Button>
            </div>
          </div>
          <div className='mt-4 flex flex-wrap gap-2'>
            {['公司年会', '新品发布会', '商场促销'].map((s) => (
              <Button
                key={s}
                size='sm'
                variant='outline'
                onClick={() => setPrompt(`为${s}设计一场 200 人参与、时长 2 分钟的互动游戏`)}
              >
                {s} <Icons.add className='size-3' />
              </Button>
            ))}
          </div>
        </div>
        <div className='flex items-center'>
          <Stage
            config={{
              ...templates[0],
              name: '一起冲向下一程',
              participants: 200,
              brand: 'YOUR BRAND',
              logo: ''
            }}
          />
        </div>
      </section>
      <section className='mt-6'>
        <div className='mb-4 flex justify-between'>
          <div>
            <h2 className='font-semibold'>从大家熟悉的玩法开始</h2>
            <p className='mt-1 text-xs text-muted-foreground'>
              操作简单，反馈直接，轻松融入你的品牌。
            </p>
          </div>
          <Link href='/dashboard/templates' className='flex items-center gap-1 text-sm'>
            全部模板 <Icons.arrowRight className='size-4' />
          </Link>
        </div>
        <div className='grid gap-4 md:grid-cols-3'>
          {templates.filter(t=>t.showcase).slice(0, 3).map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      </section>
      <section className='mt-8'>
        <div className='mb-4 flex justify-between'>
          <h2 className='font-semibold'>最近的活动</h2>
          <Link
            href='/dashboard/activities'
            className='text-sm text-muted-foreground hover:underline'
          >
            查看全部
          </Link>
        </div>
        <ActivityRows items={data.filter((a) => !a.archived).slice(0, 3)} />
      </section>
    </PageContainer>
  );
}
export function Activities() {
  const { data } = useSuspenseQuery(activitiesQuery());
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  return (
    <PageContainer
      pageTitle='我的活动'
      pageDescription='每一场值得参与的活动，都从这里开始。'
      pageHeaderAction={
        <Button
          nativeButton={false}
          render={<Link href='/dashboard/activities/new' aria-label='创建活动' />}
        >
          <Icons.add />
          创建活动
        </Button>
      }
    >
      <div className='my-4 flex flex-wrap gap-3'>
        <Input
          className='max-w-sm'
          aria-label='搜索活动'
          placeholder='搜索活动名称、品牌…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant={archived ? 'default' : 'outline'} onClick={() => setArchived(!archived)}>
          {archived ? '查看进行中的活动' : '查看已归档'}
        </Button>
      </div>
      <ActivityRows
        items={data.filter(
          (a) => a.archived === archived && `${a.name}${a.brand}`.includes(search)
        )}
      />
    </PageContainer>
  );
}
export function Templates() {
  const [filter, setFilter] = useState('全部');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('全部状态');
  const query = search.trim().toLocaleLowerCase();
  const ready = visibleTemplates(templates).filter((t) =>
    (filter === '全部' || catalogMembership(t).includes(filter)) &&
    `${t.name} ${t.description} ${catalogMembership(t).join(' ')}`.toLocaleLowerCase().includes(query)
  );
  const planned = plannedGames.filter((t) =>
    (filter === '全部' || t.category === filter) &&
    `${t.name} ${t.description} ${t.category}`.toLocaleLowerCase().includes(query)
  );
  return (
    <PageContainer
      pageTitle='游戏体验库'
      pageDescription='先看效果、扫码体验，再一键创建属于你的品牌活动。'
    >
      <div className='my-4 flex flex-wrap gap-2'>
        {['全部', ...catalogCategories].map((s) => (
          <Button
            key={s}
            variant={filter === s ? 'default' : 'outline'}
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
          >
            {s}
          </Button>
        ))}
      </div>
      <div className='mb-6 flex flex-wrap items-center gap-2'>
        <Input className='w-full sm:max-w-xs' aria-label='搜索玩法' placeholder='搜索玩法名称、场景…' value={search} onChange={(e) => setSearch(e.target.value)} />
        {['全部状态', '可试玩', '规划中'].map((s) => <Button key={s} variant={status === s ? 'secondary' : 'ghost'} aria-pressed={status === s} onClick={() => setStatus(s)}>{s}</Button>)}
      </div>
      <p className='mb-4 text-sm text-muted-foreground' role='status'>当前分类与搜索：{ready.length} 个可试玩 · {planned.length} 个规划中。共创玩法可跨分类展示，“全部”中不重复。</p>
      {status !== '规划中' && <section aria-label='可试玩玩法'>
        <h2 className='mb-4 text-lg font-semibold'>可试玩 · {ready.length}</h2>
        {ready.length ? <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>{ready.map((t) => <TemplateCard key={t.id} template={t} />)}</div> : <p className='rounded-xl border border-dashed p-8 text-center text-muted-foreground'>暂无符合条件的可试玩玩法。可查看下方规划或切换分类。</p>}
      </section>}
      {status !== '可试玩' && <section className='mt-8' aria-label='规划中玩法'>
        <h2 className='mb-2 text-lg font-semibold'>规划中 · {planned.length}</h2>
        <p className='mb-4 text-sm text-muted-foreground'>以下是待开发方向，暂不能试玩或创建活动；不是已上线游戏。</p>
        {planned.length ? <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>{planned.map((t) => <Card key={t.id} className='border-dashed shadow-none'><CardContent>
          <div className='mb-3 flex items-center justify-between gap-2'><h3 className='font-medium'>{t.name}</h3><Badge variant='outline'>规划中</Badge></div>
          <p className='mb-2 text-xs text-muted-foreground'>{t.category}</p>
          <p className='text-sm text-muted-foreground'>{t.description}</p>
        </CardContent></Card>)}</div> : <p className='py-4 text-sm text-muted-foreground'>暂无符合条件的规划玩法。</p>}
      </section>}
      <p className='mt-6 text-xs text-muted-foreground'>
        保存并发布活动后，在联机主持端邀请 H5 玩家参与。当前为预览版，不涉及真实奖品。
      </p>
    </PageContainer>
  );
}
