import type { Activity, Brand, DemoRoom, GameConfig, Template } from './types';
const KEY = 'eventplay.activities.v1';
const ROOM_KEY = 'eventplay.rooms.v1';
export const templates: Template[] = [
  {
    id: 'race-gold',
    name: '全员冲刺',
    category: '年会热场',
    description: '点击加速，为你的部门赢下这一程。',
    mechanic: 'race',
    theme: 'gold',
    teams: '销售部,研发部,市场部',
    duration: 120
  },
  {
    id: 'tug-space',
    name: '能量争夺战',
    category: '团队对抗',
    description: '两队集结，用全场力量推动能量核心。',
    mechanic: 'tug',
    theme: 'space',
    teams: '星河队,闪电队',
    duration: 120
  },
  {
    id: 'race-space',
    name: '向未来出发',
    category: '品牌发布',
    description: '科技主题竞速，一起冲向新的目的地。',
    mechanic: 'race',
    theme: 'space',
    teams: '探索队,先锋队,未来队',
    duration: 180
  },
  {
    id: 'race-garden',
    name: '春日游园会',
    category: '商场活动',
    description: '轻松明亮的竞速，让每位来宾加入。',
    mechanic: 'race',
    theme: 'garden',
    teams: '向阳队,春风队,花火队',
    duration: 90
  }
];
function read<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('本地数据无法读取，请在设置中重置演示数据。');
  }
}
function write<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    throw new Error('本地存储空间不足或不可用，请缩小上传图片后重试。');
  }
}
export function configOf(a: GameConfig): GameConfig {
  const { name, description, mechanic, theme, duration, participants, teams, brand, logo } = a;
  return { name, description, mechanic, theme, duration, participants, teams, brand, logo };
}
export function validateConfig(value: GameConfig): string[] {
  const errors: string[] = [];
  if (!value.name.trim() || value.name.length > 60) errors.push('活动名称须为 1～60 个字符');
  if (!Number.isFinite(value.duration) || value.duration < 30 || value.duration > 600)
    errors.push('时长须为 30～600 秒');
  if (!Number.isInteger(value.participants) || value.participants < 2 || value.participants > 500)
    errors.push('预计人数须为 2～500 的整数');
  const teams = value.teams
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    teams.length < 2 ||
    teams.length > 4 ||
    new Set(teams).size !== teams.length ||
    teams.some((s) => s.length > 16)
  )
    errors.push('填写 2～4 个不重复的队名，每个不超过 16 字');
  if (value.mechanic === 'tug' && teams.length !== 2) errors.push('拔河模式需要恰好两支队伍');
  return errors;
}
function seed(): Activity[] {
  return templates.slice(0, 2).map((t, i) => ({
    id: `sample-${i + 1}`,
    name: i ? '新品发布 · 能量争夺战' : '年度盛典 · 全员冲刺',
    description: t.description,
    mechanic: t.mechanic,
    theme: t.theme,
    duration: t.duration,
    participants: 200,
    teams: t.teams,
    brand: 'EventPlay',
    logo: '',
    revision: 1,
    archived: false,
    updatedAt: '2026-09-15T08:00:00.000Z'
  }));
}
export async function listActivities(): Promise<Activity[]> {
  return read(KEY, seed());
}
export async function getActivity(id: string): Promise<Activity> {
  const item = (await listActivities()).find((a) => a.id === id);
  if (!item) throw new Error('活动不存在，可能已被重置。');
  return item;
}
export async function createActivity(config: GameConfig): Promise<Activity> {
  const errors = validateConfig(config);
  if (errors.length) throw new Error(errors.join('；'));
  const item: Activity = {
    ...config,
    id: crypto.randomUUID(),
    revision: 1,
    archived: false,
    updatedAt: new Date().toISOString()
  };
  write(KEY, [item, ...(await listActivities())]);
  return item;
}
export async function saveActivity(
  id: string,
  config: GameConfig,
  revision: number
): Promise<Activity> {
  const errors = validateConfig(config);
  if (errors.length) throw new Error(errors.join('；'));
  const items = await listActivities();
  const old = items.find((a) => a.id === id);
  if (!old) throw new Error('活动不存在');
  if (old.revision !== revision) throw new Error('活动已在其他页面修改，请刷新后重新编辑。');
  const item = { ...old, ...config, revision: revision + 1, updatedAt: new Date().toISOString() };
  write(
    KEY,
    items.map((a) => (a.id === id ? item : a))
  );
  return item;
}
export async function archiveActivity(id: string): Promise<void> {
  if (
    (await listRooms()).some(
      (r) => r.activityId === id && !['completed', 'aborted'].includes(r.state)
    )
  )
    throw new Error('请先结束该活动的演示房间');
  write(
    KEY,
    (await listActivities()).map((a) => (a.id === id ? { ...a, archived: !a.archived } : a))
  );
}
export async function publishDemo(id: string): Promise<Activity> {
  const item = await getActivity(id);
  const errors = validateConfig(item);
  if (errors.length) throw new Error(errors.join('；'));
  const next = {
    ...item,
    release: {
      version: (item.release?.version ?? 0) + 1,
      config: configOf(item),
      createdAt: new Date().toISOString()
    }
  };
  write(
    KEY,
    (await listActivities()).map((a) => (a.id === id ? next : a))
  );
  return next;
}
export async function listRooms(): Promise<DemoRoom[]> {
  return read(ROOM_KEY, []);
}
export async function createRoom(id: string): Promise<DemoRoom> {
  const activity = await getActivity(id);
  if (!activity.release) throw new Error('请先保存演示版本');
  const rooms = await listRooms();
  const active = rooms.find(
    (r) => r.activityId === id && !['completed', 'aborted'].includes(r.state)
  );
  if (active) return active;
  const room: DemoRoom = {
    id: crypto.randomUUID(),
    activityId: id,
    version: activity.release.version,
    config: activity.release.config,
    state: 'waiting',
    remaining: activity.release.config.duration,
    scores: activity.release.config.teams.split(/[,，]/).map(() => 0),
    updatedAt: Date.now()
  };
  write(ROOM_KEY, [room, ...rooms]);
  return room;
}
export async function getRoom(id: string): Promise<DemoRoom> {
  const room = (await listRooms()).find((r) => r.id === id);
  if (!room) throw new Error('本地演示房间不存在');
  if (room.state !== 'running') return room;
  const elapsed = Math.max(0, Math.floor((Date.now() - room.updatedAt) / 1000));
  if (!elapsed) return room;
  const seconds = Math.min(elapsed, room.remaining);
  const next = {
    ...room,
    remaining: room.remaining - seconds,
    scores: room.scores.map((score, i) => score + seconds * (9 - i * 2)),
    updatedAt: room.updatedAt + seconds * 1000
  };
  if (!next.remaining) next.state = 'completed';
  write(
    ROOM_KEY,
    (await listRooms()).map((r) => (r.id === id ? next : r))
  );
  return next;
}
export async function commandRoom(
  id: string,
  command: 'start' | 'pause' | 'resume' | 'finish' | 'abort'
): Promise<DemoRoom> {
  const room = await getRoom(id);
  const allowed = {
    start: ['waiting'],
    pause: ['running'],
    resume: ['paused'],
    finish: ['running', 'paused'],
    abort: ['waiting', 'running', 'paused']
  };
  if (!allowed[command].includes(room.state)) throw new Error('当前阶段无法执行此操作');
  const state = {
    start: 'running',
    pause: 'paused',
    resume: 'running',
    finish: 'completed',
    abort: 'aborted'
  } as const;
  const next = { ...room, state: state[command], updatedAt: Date.now() };
  if (room.host) {
    const labels = {
      start: '开始演示',
      pause: '暂停演示',
      resume: '继续演示',
      finish: '结束并结算',
      abort: '中止本局'
    };
    next.host = {
      ...room.host,
      log: [{ at: Date.now(), text: labels[command] }, ...room.host.log].slice(0, 50)
    };
  }
  write(
    ROOM_KEY,
    (await listRooms()).map((r) => (r.id === id ? next : r))
  );
  return next;
}
export async function getBrand(): Promise<Brand> {
  return read('eventplay.brand.v1', { name: 'EventPlay', color: '#f59e0b', logo: '' });
}

export const hostChecks = [
  { id: 'screen', label: '已打开大屏并检查投屏画面' },
  { id: 'rules', label: '已确认队伍、玩法与演示时长' },
  { id: 'brief', label: '已向观众说明本次为模拟演示' }
];
export async function updateHost(
  id: string,
  action: { check: string; checked: boolean } | { blackout: boolean }
): Promise<DemoRoom> {
  const room = await getRoom(id);
  const host = room.host ?? { checks: [], blackout: false, log: [] };
  const nextHost = { ...host };
  if ('check' in action) {
    if (room.state !== 'waiting') throw new Error('开场后不能修改准备清单');
    if (!hostChecks.some((item) => item.id === action.check)) throw new Error('未知检查项');
    nextHost.checks = action.checked
      ? [...new Set([...host.checks, action.check])]
      : host.checks.filter((item) => item !== action.check);
  } else {
    nextHost.blackout = action.blackout;
    nextHost.log = [
      { at: Date.now(), text: action.blackout ? '开启大屏遮罩（计时不变）' : '恢复大屏画面' },
      ...host.log
    ].slice(0, 50);
  }
  const next = { ...room, host: nextHost };
  write(
    ROOM_KEY,
    (await listRooms()).map((item) => (item.id === id ? next : item))
  );
  return next;
}
export async function hostCommand(
  id: string,
  command: Parameters<typeof commandRoom>[1]
): Promise<DemoRoom> {
  const room = await getRoom(id);
  if (command === 'start' && !hostChecks.every((item) => room.host?.checks.includes(item.id)))
    throw new Error('请先完成全部开场检查');
  return commandRoom(id, command);
}
export async function saveBrand(brand: Brand): Promise<void> {
  write('eventplay.brand.v1', brand);
}
export async function resetDemo(): Promise<void> {
  for (const key of [KEY, ROOM_KEY, 'eventplay.brand.v1']) localStorage.removeItem(key);
}
export async function readLogo(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('请选择 PNG、JPG 或 WebP 图片');
  if (file.size > 500 * 1024) throw new Error('演示版图片请小于 500KB');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(new Error('图片读取失败')));
    reader.readAsDataURL(file);
  });
}
