import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'eventplay_session';
const noStore = { 'Cache-Control': 'no-store' };

/** Server-only BFF: the opaque account session never enters browser JavaScript. */
export async function accountProxy(request: NextRequest, path: string): Promise<NextResponse> {
  const method = request.method;
  const authentication = /^accounts\/(login|register)$/.test(path);
  if (method === 'POST') {
    const origin = request.headers.get('origin');
    const expected = process.env.EVENTPLAY_APP_ORIGIN;
    let sameOrigin = false;
    try {
      sameOrigin = !!origin && (expected ? origin === new URL(expected).origin :
        new URL(origin).host === request.headers.get('host') &&
        new URL(origin).protocol === (process.env.NODE_ENV === 'production' ? 'https:' : request.nextUrl.protocol));
    } catch { /* Reject malformed and opaque origins. */ }
    if (!sameOrigin || !request.headers.get('content-type')?.startsWith('application/json')) {
      return NextResponse.json({ detail: '请求来源无效，请从本站重新操作' }, { status: 403, headers: noStore });
    }
  }
  const session = request.cookies.get(COOKIE)?.value;
  if (!authentication && !session) {
    return NextResponse.json({ detail: '请先登录账号' }, { status: 401, headers: noStore });
  }
  try {
    if (Number(request.headers.get('content-length') || 0) > 900000) {
      return NextResponse.json({ detail: '请求过大' }, { status: 413, headers: noStore });
    }
    const body = method === 'POST' ? await request.text() : undefined;
    if (body && Buffer.byteLength(body) > 900000) {
      return NextResponse.json({ detail: '请求过大' }, { status: 413, headers: noStore });
    }
    const base = process.env.EVENTPLAY_API_INTERNAL_URL || (process.env.NODE_ENV === 'production' ? 'http://127.0.0.1:8002' : 'http://127.0.0.1:8001');
    const upstream = await fetch(`${base}/${path}`, {
      method, body, cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', ...(session && !authentication ? { Authorization: `Bearer ${session}` } : {}) }
    });
    const payload = await upstream.json();
    // Only authentication routes can issue an account cookie. Room host tokens
    // returned by workspace routes keep their existing, separate capability model.
    const issueSession = upstream.ok && /^accounts\/(login|register|password)$/.test(path);
    const response = NextResponse.json(issueSession ? { user: payload.user, message: '已登录个人工作空间' } : payload,
      { status: upstream.status, headers: noStore });
    if (issueSession) {
      response.cookies.set(COOKIE, payload.token, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: payload.expiresIn
      });
    }
    if (path === 'accounts/logout' && upstream.ok || upstream.status === 401 && !authentication) {
      response.cookies.set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    }
    return response;
  } catch {
    return NextResponse.json({ detail: '账号服务暂时不可用，请稍后重试' }, { status: 503, headers: noStore });
  }
}
