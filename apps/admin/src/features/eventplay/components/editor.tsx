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
  DEFAULT_QUIZ,
  cloudToken,
  createActivity,
  readLogo,
  saveActivity,
  templates,
  validateConfig
} from '../api/service';
import type { Activity, GameConfig } from '../api/types';
import { clickGames } from '../api/click-games';
import { Stage } from './stage';
import { RaceCreator } from './race-creator';
import { StoryboardEditor } from './storyboard-editor';
import { defaultStoryboard } from '../api/storyboard';

export function NewActivity() {
  const search = useSearchParams();
  const { data: brand } = useSuspenseQuery(brandQuery());
  const template = templates.find((t) => t.id === search.get('template')) ?? templates.find((t) => t.id === 'shake-race')!;
  return (
    <Editor
      initial={{
        ...configOf({ ...template, participants: 200, brand: brand.name, logo: brand.logo }),
        name: template.name,
        description: search.get('prompt') ?? template.description,
        mechanic: template.mechanic,
        inputMode: template.inputMode ?? 'tap',
        swipeDirection: template.swipeDirection ?? 'up',
        controlVariant: template.controlVariant,
        reactionVariant: template.reactionVariant,
        clickVariant: template.clickVariant,
        raceVariant: template.raceVariant ?? 'horse',
        theme: template.theme,
        teams: template.teams,
        duration: template.duration,
        participants: 200,
        goal: template.goal ?? 1000,
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
  if (initial.mechanic === 'race' && !initial.clickVariant && (initial.raceVariant ?? 'horse') === 'horse') return <RaceCreator initial={initial} activity={activity} />;
  return <ClassicEditor initial={initial} activity={activity} />;
}
function ClassicEditor({ initial, activity }: { initial: GameConfig; activity?: Activity }) {
  const router = useRouter();
  const client = useQueryClient();
  const [revision, setRevision] = useState(activity?.revision ?? 0);
  const [notice, setNotice] = useState('');
  const [aiText, setAiText] = useState('');
  const [previous, setPrevious] = useState<GameConfig | null>(null);
  const [savedAt, setSavedAt] = useState('');
  const form = useAppForm({
    defaultValues: { ...initial, storyboard: initial.storyboard ?? (initial.mechanic === 'race' && !initial.clickVariant && (initial.raceVariant ?? 'horse') === 'horse' ? defaultStoryboard() : null), voteChange:initial.voteChange??false,voteLive:initial.voteLive??true, drawRepeat: initial.drawRepeat??false, goal: initial.goal ?? 1000, quizText: initial.quizText ?? DEFAULT_QUIZ, winnerCount: initial.winnerCount ?? 1, prizeName: initial.prizeName ?? '幸运奖', catchDifficulty: initial.catchDifficulty ?? 'normal' } as GameConfig,
    onSubmit: async ({ value }) => {
      value = { ...value, storyboard: value.mechanic === 'race' && !value.clickVariant && (value.raceVariant ?? 'horse') === 'horse' ? value.storyboard : null };
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
        toast.success(cloudToken() ? '草稿已保存到云工作区' : '草稿已保存到当前浏览器');
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
      pageTitle={activity ? '我的游戏 · 编辑草稿' : '制作同款 · 我的品牌游戏'}
      pageDescription='选择范例 → 定制品牌与规则 → 保存草稿 → 试玩并发布。作品默认私有，不会公开上架。'
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
              {initial.clickVariant && <p className='rounded-xl bg-muted p-3 text-sm'>点击模板：{clickGames[initial.clickVariant].name}。更换游戏请返回体验库选择；可调整品牌、目标、时长和队伍。</p>}
              {!initial.socialVariant && !initial.createVariant && !initial.voteVariant && !initial.wallVariant && !initial.drawVariant && !initial.quizVariant && !initial.clickVariant && !initial.reactionVariant && !initial.controlVariant && <form.AppField name='mechanic'>
                {(field) => (
                  <field.SelectField
                    label='互动玩法'
                    options={[
                      { value: 'race', label: '团队竞速' },
                      { value: 'tug', label: '团队拔河' },
                      { value: 'money', label: '数钱挑战（向上滑动）' },
                      { value: 'alternating', label: '左右交替冲刺' },
                      { value: 'light', label: '共同点亮 Logo' },
                      { value: 'quiz', label: '答题闯关' },
                      { value: 'draw', label: '基础抽奖' },
                      { value: 'catch', label: '接金币' }
                      ,{ value: 'reaction', label: '萌鼠出没（手眼协调）' }
                    ]}
                  />
                )}
              </form.AppField>
              }
              <form.AppField name='goal'>{(field) => <field.TextField label='点击目标 / 视觉满格积分（合作达标结束，竞赛按时间结算）' type='number' min={10} max={100000} />}</form.AppField>
              <form.Subscribe selector={(s) => s.values.mechanic}>{(mechanic) => <>
                {mechanic === 'race' && !initial.clickVariant && <form.AppField name='raceVariant'>{(field) => <field.SelectField label='竞速场景' options={[{value:'horse',label:'欢乐赛马'},{value:'yacht',label:'碧海游艇'},{value:'car',label:'城市赛车'},{value:'motorbike',label:'公路摩托'},{value:'spaceship',label:'星际飞船'},{value:'rocket',label:'火箭升空'},{value:'penguin',label:'企鹅滑雪'},{value:'balloon',label:'热气球'},{value:'dragonboat',label:'龙舟竞渡'},{value:'bicycle',label:'自行车冲刺'},{value:'climb',label:'步步高升'}]} />}</form.AppField>}
                {mechanic === 'race' && !initial.clickVariant && <form.AppField name='inputMode'>{(field) => <field.SelectField label='竞速操作方式' options={[{label:'点击加速',value:'tap'},{label:'摇一摇（保留点击备用）',value:'shake'},{label:'滑屏（保留无障碍按钮）',value:'swipe'}]} />}</form.AppField>}
                {mechanic === 'race' && !initial.clickVariant && <form.Subscribe selector={(s) => s.values.inputMode}>{(mode) => mode === 'swipe' && <form.AppField name='swipeDirection'>{(field) => <field.SelectField label='滑屏方向' options={[{value:'up',label:'向上滑动'},{value:'down',label:'向下滑动'},{value:'alternating',label:'左右交替滑动'}]} />}</form.AppField>}</form.Subscribe>}
                {mechanic === 'quiz' && <form.AppField name='quizText'>{(field) => <field.TextareaField label='知识问答题库' description='每行：题目|A|B|C|D|正确字母，可追加 |题图路径|线索1~线索2~线索3。判断题A/B填写对/错，C/D填不使用；看图题必须填写 /games/ 本地图片路径；线索题须填写3条线索。1～20题，每题至少5秒。发布前请核对答案。' rows={6} />}</form.AppField>}
                {mechanic==='create'&&initial.createVariant==='puzzle'&&<form.AppField name='createImage'>{field=><field.TextField label='拼图原图路径' description='使用已有 /games/ 本地图片，自动切为16块；可换成品牌海报素材。'/ >}</form.AppField>}
                {mechanic==='vote'&&<><form.AppField name='voteOptions'>{field=><field.TextareaField label='投票 / 评分选项' description='每行一项，2～8项；观点站2项、淘汰赛2/4/8项。' rows={5}/>}</form.AppField><form.AppField name='voteImages'>{field=><field.TextareaField label='产品图片路径（可选）' description='按选项顺序每行一张，使用已有 /games/ 本地图片。'/ >}</form.AppField><form.AppField name='voteLive'>{field=><field.CheckboxField label='实时公开统计' description='关闭后由主持人截止并揭晓。'/ >}</form.AppField><form.AppField name='voteChange'>{field=><field.CheckboxField label='允许截止前修改提交'/ >}</form.AppField>{initial.voteVariant==='story'&&<form.AppField name='voteStory'>{field=><field.TextareaField label='剧情分支 JSON' description='start为起点，每个节点title与choices；每项含label及next，结局choices为空。最多16节点，不可循环。' rows={12}/>}</form.AppField>}</>}
                {mechanic === 'draw' && <form.AppField name='drawRepeat'>{(field)=><field.CheckboxField label='允许本系列跨轮重复中奖' description='关闭时，相同规则再来一局会排除本系列已中奖身份；不同独立活动不共享排除名单。游客身份不是实名防刷。'/ >}</form.AppField>}
                {mechanic === 'draw' && <form.AppField name='winnerCount'>{(field) => <field.TextField label='中奖名额' type='number' min={1} max={100} description='从开场时已入场的玩家中一次性抽取，不重复中奖；无奖品发放。' />}</form.AppField>}
                {mechanic === 'draw' && <form.AppField name='prizeName'>{(field) => <field.TextField label='奖项名称' maxLength={60} required description='写入最终抽奖记录；系统不负责实际发奖。' />}</form.AppField>}
                {mechanic === 'catch' && <form.AppField name='catchDifficulty'>{(field) => <field.SelectField label='接金币难度' options={[{label:'简单 · 每3秒一枚',value:'easy'},{label:'标准 · 每2秒一枚',value:'normal'},{label:'挑战 · 每1秒一枚',value:'hard'}]} />}</form.AppField>}
              </>}</form.Subscribe>
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
            {(value) => value.mechanic === 'race' && !value.clickVariant && (value.raceVariant ?? 'horse') === 'horse' ? <StoryboardEditor config={value} board={value.storyboard ?? defaultStoryboard()} onChange={(board) => form.setFieldValue('storyboard', board)} /> : <Stage config={value} />}
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
              ['01', '扫码入场', 'H5 扫码参与，微信身份待接入'],
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
