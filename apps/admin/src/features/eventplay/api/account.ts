export interface AccountUser { id: string; email: string; workspace: string }
export const ACCOUNT_KEY = 'eventplay.account.id';
export const ACCOUNT_SESSION = 'account-session';

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch {
    throw new Error(`账号接口返回异常（HTTP ${response.status}），请刷新页面后重试；如仍失败，请检查本地服务。`);
  }
}

export function accountMode(): boolean {
  return typeof window !== 'undefined' && !!localStorage.getItem(ACCOUNT_KEY);
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(18000)
  });
  const result = await readResponse(response) as { detail?: unknown };
  if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : '操作失败，请检查输入后重试');
  return result as T;
}

export function accountRequest<T>(action: string, body?: unknown): Promise<T> {
  return request(`/api/eventplay-auth/${action}`, body);
}
export function accountWorkspaceRequest<T>(path: string, body?: unknown): Promise<T> {
  return request(`/api/eventplay-workspace${path}`, body);
}

export async function currentAccount(): Promise<AccountUser | null> {
  const response = await fetch('/api/eventplay-auth/me', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(18000) });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('无法验证账号，请确认后端已启动后重试');
  return await readResponse(response) as AccountUser;
}

export async function logoutAccount(): Promise<void> {
  await accountRequest('logout', {});
  const keys = Object.keys(localStorage).filter((key) => key.startsWith('eventplay.account-host.'));
  for (const key of keys) localStorage.removeItem(key);
  localStorage.removeItem(ACCOUNT_KEY);
  window.location.assign('/login');
}

export function hostStorageKey(id: string): string {
  const account = localStorage.getItem(ACCOUNT_KEY);
  return account ? `eventplay.account-host.${account}.${id}` : `eventplay.host.${id}`;
}

export function creatorLink(template: string): string {
  const next = `/dashboard/activities/new?template=${encodeURIComponent(template)}`;
  return accountMode() ? next : `/login?next=${encodeURIComponent(next)}`;
}
