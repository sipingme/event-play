import { queryOptions } from '@tanstack/react-query';
import type { GameConfig, DemoRoom } from './types';
export interface LiveRoom {
  trial?: boolean;
  playerCount?: number;
  laneCounts?: number[];
  presence?: { online: number; offline: number; screens: number };
  countdown?: number;
  agendaId?: string | null;
  game?: {
    type: 'quiz' | 'draw' | 'catch' | 'reaction'; cell?: number | null; index?: number; total?: number; seconds?: number;
    question?: { text: string; options: string[] } | null;
    lane?: number | null; progress?: number; interval?: number;
    reveals?: { index: number; text: string; correct: number; answer: string }[];
    result?: { prizeName?: string; at: number; candidates: string[]; winners: {id: string; name: string}[]; algorithm: string } | null;
  } | null;
  id: string;
  config: GameConfig;
  state: DemoRoom['state'];
  remaining: number;
  scores: number[];
  revision: number;
  blackout: boolean;
  log: { at: number; text: string }[];
  players: { id: string; name: string; team: number; score: number; lane?: number; answered?: number[] }[];
}
export interface PlayerSession {
  token: string;
  playerId: string;
  seq: number;
}
export function playerProfile(agendaId?: string | null): { name: string; team: string } {
  if (!agendaId) return { name: '', team: '' };
  try {
    const value = JSON.parse(localStorage.getItem(`eventplay.profile.${agendaId}`) || 'null');
    return value && typeof value.name === 'string' && typeof value.team === 'string' ? value : { name: '', team: '' };
  } catch { return { name: '', team: '' }; }
}
export function rememberPlayer(agendaId: string | null | undefined, name: string, team: string) {
  if (agendaId) localStorage.setItem(`eventplay.profile.${agendaId}`, JSON.stringify({ name, team }));
}
export function apiBase() {
  return (
    process.env.NEXT_PUBLIC_REALTIME_URL ||
    (window.location.protocol === 'https:'
      ? `${window.location.origin}/realtime`
      : `${window.location.protocol}//${window.location.hostname}:8001`)
  );
}
export async function liveRequest<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(response.status === 403 ? '权限已失效或访问受限。主持人请从云工作区重新接管，玩家请确认访问密码。' : typeof result.detail === 'string' ? result.detail : '请求失败，请检查网络、站点访问密码和输入');
  return result;
}
export const liveKey = (id: string, scope = 'full') => ['eventplay-live', id, scope] as const;
export const liveQuery = (id: string, scope = 'full') =>
  queryOptions({
    queryKey: liveKey(id, scope),
    queryFn: () => liveRequest<LiveRoom>(`/rooms/${id}`),
    retry: 1
  });
export async function createLiveRoom(config: GameConfig, activityId?: string) {
  const result = await liveRequest<{ room: LiveRoom; token: string }>('/rooms', config);
  localStorage.setItem(`eventplay.host.${result.room.id}`, result.token);
  if (activityId) localStorage.setItem(`eventplay.activity-room.${activityId}`, result.room.id);
  return result.room;
}
export async function enterActivityRoom(activityId: string, config: GameConfig) {
  const workspace = localStorage.getItem('eventplay.workspace.token');
  if (workspace) {
    const result = await liveRequest<{ room: LiveRoom; token: string }>(`/activities/${activityId}/enter`, {}, workspace);
    localStorage.setItem(`eventplay.host.${result.room.id}`, result.token);
    return result.room;
  }
  const id = localStorage.getItem(`eventplay.activity-room.${activityId}`);
  if (id) {
    const room = await liveRequest<LiveRoom>(`/rooms/${id}`);
    if (!['completed', 'aborted'].includes(room.state)) return room;
  }
  return createLiveRoom(config, activityId);
}
export async function restoreOwner(id: string, token: string) {
  await liveRequest(`/rooms/${id}/owner`, undefined, token.trim());
  localStorage.setItem(`eventplay.host.${id}`, token.trim());
}
export function ownerToken(id: string) {
  return localStorage.getItem(`eventplay.host.${id}`) || '';
}
export function sendPresence(id: string, role: 'player' | 'screen', clientId: string) {
  return liveRequest(`/rooms/${id}/presence`, {role,clientId}, role === 'player' ? playerSession(id)?.token : undefined);
}
export function playerSession(id: string): PlayerSession | null {
  try {
    return JSON.parse(localStorage.getItem(`eventplay.player.${id}`) || 'null');
  } catch {
    return null;
  }
}
export async function joinLiveRoom(id: string, name: string, team: number) {
  const session = await liveRequest<PlayerSession & { guestToken: string }>(`/rooms/${id}/join`, { name, team, guestToken: localStorage.getItem('eventplay.guest.token') || '' });
  localStorage.setItem('eventplay.guest.token', session.guestToken);
  session.seq = 0;
  localStorage.setItem(`eventplay.player.${id}`, JSON.stringify(session));
  return session;
}
export async function tapLiveRoom(id: string, kind: 'tap' | 'shake' | 'swipe' | 'left' | 'right' = 'tap') {
  const session = playerSession(id);
  if (!session) throw new Error('请先加入房间');
  session.seq += 1;
  localStorage.setItem(`eventplay.player.${id}`, JSON.stringify(session));
  return liveRequest<{ accepted: boolean; reason: string; nextSide?: 'left' | 'right' }>(
    `/rooms/${id}/tap`,
    { seq: session.seq, kind },
    session.token
  );
}
export function liveCommand(id: string, action: string) {
  return liveRequest<LiveRoom>(`/rooms/${id}/command`, { action }, ownerToken(id));
}
export async function answerLiveRoom(id: string, index: number, choice: number) {
  const player = playerSession(id);
  if (!player) throw new Error('请先加入房间');
  return liveRequest<{accepted: boolean}>(`/rooms/${id}/answer`, { index, choice }, player.token);
}
export async function hitLiveRoom(id: string, index: number, cell: number) {
  const player = playerSession(id);
  if (!player) throw new Error('请先加入房间');
  return liveRequest<{accepted: boolean}>(`/rooms/${id}/hit`, { index, cell }, player.token);
}
export async function createTrialRoom(config: GameConfig) {
  const result = await liveRequest<{room: LiveRoom; token: string}>('/trials', config);
  localStorage.setItem(`eventplay.host.${result.room.id}`, result.token);
  return result.room;
}
export async function moveLiveRoom(id: string, direction: 'left' | 'right') {
  const player = playerSession(id);
  if (!player) throw new Error('请先加入房间');
  player.seq += 1;
  localStorage.setItem(`eventplay.player.${id}`, JSON.stringify(player));
  return liveRequest<{accepted: boolean; lane: number}>(`/rooms/${id}/move`, { seq: player.seq, direction }, player.token);
}
export async function rematchLiveRoom(id: string): Promise<LiveRoom> {
  const token = ownerToken(id);
  const room = await liveRequest<LiveRoom>(`/rooms/${id}/rematch`, {}, token);
  localStorage.setItem(`eventplay.host.${room.id}`, token);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('eventplay.activity-room.') && localStorage.getItem(key) === id) localStorage.setItem(key, room.id);
  }
  return room;
}
