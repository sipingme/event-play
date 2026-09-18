import { NextRequest, NextResponse } from 'next/server';
import { accountProxy } from '@/features/eventplay/api/account-proxy';

type Context = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, context: Context) {
  const { path } = await context.params;
  const route = path.join('/');
  const allowed = request.method === 'GET'
    ? /^(activities|managed-rooms|agendas)$/.test(route)
    : /^(activities|agendas|activities\/[A-Za-z0-9_-]+\/(save|publish|archive|enter)|agendas\/[A-Za-z0-9_-]+\/(next|host)|rooms\/[A-Za-z0-9_-]+\/takeover)$/.test(route);
  if (!allowed) return NextResponse.json({ detail: '不支持的工作区操作' }, { status: 404 });
  return accountProxy(request, route);
}
export const GET = handle;
export const POST = handle;
