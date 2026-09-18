import { NextRequest, NextResponse } from 'next/server';
import { accountProxy } from '@/features/eventplay/api/account-proxy';

type Context = { params: Promise<{ action: string }> };
export async function POST(request: NextRequest, context: Context) {
  const { action } = await context.params;
  if (!['login', 'register', 'logout', 'password', 'brand'].includes(action)) {
    return NextResponse.json({ detail: '邮件验证与自助找回尚未开放；如忘记密码请联系管理员。未发送任何邮件。' }, { status: 501, headers: { 'Cache-Control': 'no-store' } });
  }
  return accountProxy(request, `accounts/${action}`);
}
export async function GET(request: NextRequest, context: Context) {
  const { action } = await context.params;
  if (!['me', 'brand'].includes(action)) return new NextResponse(null, { status: 404 });
  return accountProxy(request, `accounts/${action}`);
}
