import { queryOptions } from '@tanstack/react-query';
import type { GameConfig, DemoRoom } from './types';
export interface LiveRoom {
  id: string;
  config: GameConfig;
  state: DemoRoom['state'];
  remaining: number;
  scores: number[];
  revision: number;
  blackout: boolean;
  log: { at: number; text: string }[];
  players: { id: string; name: string; team: number; score: number }[];
}
export interface PlayerSession {
  token: string;
  playerId: string;
  seq: number;
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
  const result = await response.json();
  if (!response.ok)
    throw new Error(typeof result.detail === 'string' ? result.detail : '请求无效，请检查输入');
  return result;
}
export const liveKey = (id: string) => ['eventplay-live', id] as const;
export const liveQuery = (id: string) =>
  queryOptions({
    queryKey: liveKey(id),
    queryFn: () => liveRequest<LiveRoom>(`/rooms/${id}`),
    retry: 1
  });
export async function createLiveRoom(config: GameConfig) {
  const result = await liveRequest<{ room: LiveRoom; token: string }>('/rooms', config);
  localStorage.setItem(`eventplay.host.${result.room.id}`, result.token);
  return result.room;
}
export function ownerToken(id: string) {
  return localStorage.getItem(`eventplay.host.${id}`) || '';
}
export function playerSession(id: string): PlayerSession | null {
  try {
    return JSON.parse(localStorage.getItem(`eventplay.player.${id}`) || 'null');
  } catch {
    return null;
  }
}
export async function joinLiveRoom(id: string, name: string, team: number) {
  const session = await liveRequest<PlayerSession>(`/rooms/${id}/join`, { name, team });
  session.seq = 0;
  localStorage.setItem(`eventplay.player.${id}`, JSON.stringify(session));
  return session;
}
export async function tapLiveRoom(id: string) {
  const session = playerSession(id);
  if (!session) throw new Error('请先加入房间');
  session.seq += 1;
  localStorage.setItem(`eventplay.player.${id}`, JSON.stringify(session));
  return liveRequest<{ accepted: boolean; reason: string }>(
    `/rooms/${id}/tap`,
    { seq: session.seq },
    session.token
  );
}
export function liveCommand(id: string, action: string) {
  return liveRequest<LiveRoom>(`/rooms/${id}/command`, { action }, ownerToken(id));
}
