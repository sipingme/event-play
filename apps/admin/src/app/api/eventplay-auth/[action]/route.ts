// Fail closed until FastAPI auth is connected. Never persist demo credentials.
export async function POST() {
  return Response.json(
    { message: '账号服务尚未接入。未创建账号或发送邮件，请使用“体验管理端演示”。' },
    { status: 503 }
  );
}
