import type { Activity, Brand, DemoRoom, GameConfig, Template, PublicEvent } from './types';
const KEY = 'eventplay.activities.v1';
const ROOM_KEY = 'eventplay.rooms.v1';
export const DEFAULT_QUIZ = 'EventPlay 的玩家从哪里加入？|扫码进入|修改服务器|安装数据库|联系开发者|A\n团队互动最重要的是什么？|共同参与|只有主持人操作|关闭网络|不看规则|A';
export const CLOUD_KEY = 'eventplay.workspace.token';
export function cloudToken(): string { return localStorage.getItem(CLOUD_KEY) || ''; }
export async function cloudRequest<T>(path: string, body?: unknown, token = cloudToken()): Promise<T> {
  const base = process.env.NEXT_PUBLIC_REALTIME_URL || (window.location.protocol === 'https:' ? `${window.location.origin}/realtime` : `${window.location.protocol}//${window.location.hostname}:8001`);
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : '云服务请求失败，请检查连接和访问权限');
  return result;
}
export async function connectCloud(token?: string): Promise<void> {
  const key = token?.trim() || (await cloudRequest<{token: string}>('/workspaces', {})).token;
  await cloudRequest('/activities', undefined, key);
  localStorage.setItem(CLOUD_KEY, key);
}
export async function importLocalActivities(): Promise<number> {
  if (!cloudToken()) throw new Error('请先连接云工作区');
  const items = read<Activity[]>(KEY, []);
  for (const item of items) await cloudRequest('/activities', { config: configOf(item), sourceId: item.id });
  return items.length;
}
export interface ManagedRoom {
  id: string; activityId: string; round: number; config: GameConfig;
  state: DemoRoom['state']; players: { id: string }[]; scores: number[];
}
export async function listManagedRooms(): Promise<ManagedRoom[]> {
  return cloudToken() ? cloudRequest<ManagedRoom[]>('/managed-rooms') : [];
}
export interface Agenda {
  id: string; name: string; index: number;
  steps: { activityId: string; name: string; version: number; roomId?: string }[];
}
export const listAgendas = () => cloudRequest<Agenda[]>('/agendas');
export const getPublicEvent = (id: string) => cloudRequest<PublicEvent>(`/events/${encodeURIComponent(id)}`, undefined, '');
export async function takeoverRoom(id: string) {
  const result = await cloudRequest<{ room: { id: string }; token: string }>(`/rooms/${id}/takeover`, {});
  localStorage.setItem(`eventplay.host.${result.room.id}`, result.token);
  return result.room;
}
export const createAgenda = (name: string, activityIds: string[]) => cloudRequest<Agenda>('/agendas', { name, activityIds });
export async function openAgenda(agenda: Agenda, next: boolean) {
  const result = await cloudRequest<{ room: { id: string }; token: string }>(`/agendas/${agenda.id}/${next ? 'next' : 'host'}`, next ? { index: agenda.index } : {});
  localStorage.setItem(`eventplay.host.${result.room.id}`, result.token);
  return result.room.id;
}
export const templates: Template[] = [
  { id: 'shake-race', name: '欢乐摇摇赛马', category: '摇一摇', description: '轻摇手机，让卡通小马为战队冲刺；不支持传感器时可点击备用。', mechanic: 'race', inputMode: 'shake', featured: true, theme: 'garden', teams: '阳光队,闪电队,追风队', duration: 60 },
  { id: 'swipe-money', name: '财富滑滑乐', category: '滑屏', description: '向上滑动财富卡，一划一分。比手速，不涉及现金奖励。', mechanic: 'money', featured: true, theme: 'gold', teams: '招财队,丰收队', duration: 60 },
  { id: 'click-sprint', name: '左右冲刺赛', category: '点击', description: '左右交替迈步，为战队积累步数；连续同侧不计分。', mechanic: 'alternating', featured: true, theme: 'garden', teams: '活力队,飞跃队', duration: 60 },
  { id: 'reaction-mole', name: '萌鼠出没', category: '手眼协调', description: '看准九宫格里的小地鼠，每轮只能出手一次，命中得分。', mechanic: 'reaction', featured: true, theme: 'garden', teams: '眼力队,敏捷队', duration: 60 },
  { id: 'control-coins', name: '接住好运', category: '控制', description: '左右移动篮子，接住三条轨道里的金币；服务器统一判定。', mechanic: 'catch', featured: true, theme: 'gold', teams: '好运队,宝藏队', duration: 60 },
  { id: 'quiz-space', name: '品牌知识闯关', category: '知识互动', description: '分题限时作答，每题结算后计分，支持自定义单选题。', mechanic: 'quiz', theme: 'space', teams: '智慧队,探索队', duration: 60 },
  { id: 'draw-gold', name: '现场幸运抽奖', category: '抽奖互动', description: '从已入场玩家中随机抽取，结果锁定，无实际奖品发放。', mechanic: 'draw', theme: 'gold', teams: '来宾一组,来宾二组', duration: 120 },
  { id: 'catch-garden', name: '接金币大作战', category: '动作游戏', description: '左右移动接住金币，每次接到加一分，由服务器判定。', mechanic: 'catch', theme: 'garden', teams: '金币队,宝藏队', duration: 60 },
  { id: 'alternating-space', name: '左右冲刺', category: '节奏协作', description: '左右交替点击，为战队加速；连续同侧不计分。', mechanic: 'alternating', theme: 'space', teams: '星河队,闪电队', duration: 90 },
  { id: 'light-gold', name: '共同点亮品牌', category: '全场共创', description: '全场一起贡献能量，达成目标后共同点亮品牌。', mechanic: 'light', theme: 'gold', teams: '星光队,热爱队', duration: 120 },
  {
    id: 'money-gold', name: '数钱挑战', category: '滑动互动',
    description: '向上划动品牌卡片，为团队积累财富积分。无现金奖励。',
    mechanic: 'money', theme: 'gold', teams: '招财队,好运队,丰收队', duration: 60
  },
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
  const { name, description, mechanic, theme, duration, participants, teams, brand, logo, goal, quizText, winnerCount } = a;
  return { name, description, mechanic, theme, duration, participants, teams, brand, logo, inputMode: a.inputMode ?? 'tap', goal: goal ?? 1000, quizText: quizText ?? DEFAULT_QUIZ, winnerCount: winnerCount ?? 1, prizeName: a.prizeName ?? '幸运奖', catchDifficulty: a.catchDifficulty ?? 'normal' };
}
export function validateConfig(value: GameConfig): string[] {
  const errors: string[] = [];
  if (!['race', 'tug', 'money', 'alternating', 'light', 'quiz', 'draw', 'catch', 'reaction'].includes(value.mechanic)) errors.push('不支持的玩法');
  if (!['tap', 'shake'].includes(value.inputMode ?? 'tap')) errors.push('输入方式无效');
  if (!['easy', 'normal', 'hard'].includes(value.catchDifficulty ?? 'normal')) errors.push('接金币难度无效');
  if (!(value.prizeName ?? '幸运奖').trim() || (value.prizeName ?? '幸运奖').length > 60) errors.push('奖项名称须为1～60字');
  if (value.mechanic === 'draw' && (!Number.isInteger(value.winnerCount ?? 1) || (value.winnerCount ?? 1) < 1 || (value.winnerCount ?? 1) > Math.min(100, value.participants))) errors.push('中奖名额须为1～100，且不超过预计人数');
  if (value.mechanic === 'quiz') {
    const lines = (value.quizText ?? DEFAULT_QUIZ).split('\n').filter((s) => s.trim());
    if (!lines.length || lines.length > 20 || value.duration < lines.length * 5) errors.push('需要1～20题，每题至少5秒');
    if (lines.some((line) => { const p = line.split('|').map((s) => s.trim()); return p.length !== 6 || p.some((s) => !s) || !/^[ABCD]$/i.test(p[5]) || p[0].length > 200 || p.slice(1, 5).some((s) => s.length > 100); })) errors.push('题目格式或长度错误：题目|A选项|B选项|C选项|D选项|正确字母');
  }
  if (value.goal !== undefined && (!Number.isInteger(value.goal) || value.goal < 10 || value.goal > 100000)) errors.push('共同目标须为 10～100000 的整数');
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
  return templates.filter((t) => ['race-gold', 'tug-space'].includes(t.id)).map((t, i) => ({
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
  if (cloudToken()) return cloudRequest<Activity[]>('/activities');
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
  if (cloudToken()) return cloudRequest<Activity>('/activities', { config });
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
  if (cloudToken()) return cloudRequest<Activity>(`/activities/${id}/save`, { config, revision });
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
  if (cloudToken()) {
    const item = await getActivity(id);
    await cloudRequest(`/activities/${id}/archive`, { revision: item.revision });
    return;
  }
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
  if (cloudToken()) return cloudRequest<Activity>(`/activities/${id}/publish`, { revision: item.revision });
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
