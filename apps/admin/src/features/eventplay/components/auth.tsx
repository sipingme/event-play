'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAppForm } from '@/lib/form';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stage } from './stage';
type Mode = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'verify-email';
const titles = {
  login: '欢迎回来',
  register: '创建你的 EventPlay 账号',
  'forgot-password': '找回密码',
  'reset-password': '设置新密码',
  'verify-email': '验证你的邮箱'
};
export function AuthPage({ mode }: { mode: Mode }) {
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);
  const form = useAppForm({
    defaultValues: { email: '', password: '', confirm: '', code: '' },
    onSubmit: async ({ value }) => {
      setMessage('');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
        setMessage('请输入有效的邮箱地址');
        return;
      }
      if (['login', 'register', 'reset-password'].includes(mode) && value.password.length < 8) {
        setMessage('密码至少 8 位');
        return;
      }
      if (['register', 'reset-password'].includes(mode) && value.password !== value.confirm) {
        setMessage('两次输入的密码不一致');
        return;
      }
      try {
        const response = await fetch(`/api/eventplay-auth/${mode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value)
        });
        const result = await response.json();
        setMessage(result.message ?? '服务暂不可用，请稍后重试');
      } catch {
        setMessage('无法连接服务，请检查网络后重试');
      }
    }
  });
  return (
    <div className='grid min-h-screen lg:grid-cols-2'>
      <section className='flex flex-col px-6 py-8 md:px-14'>
        <Link href='/login' className='flex items-center gap-2 text-xl font-semibold'>
          <span className='flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground'>
            <Icons.sparkles className='size-5' />
          </span>
          EventPlay
        </Link>
        <div className='mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12'>
          <Badge variant='outline' className='mb-5'>
            YOUR NEXT GREAT EVENT
          </Badge>
          <h1 className='text-2xl font-semibold tracking-tight'>{titles[mode]}</h1>
          <p className='mt-3 mb-7 text-sm leading-6 text-muted-foreground'>
            {mode === 'login' ? '从一个想法开始，让大家一起参与。' : '准备好你的下一场精彩现场。'}
          </p>
          <form
            className='space-y-5'
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <form.AppField name='email'>
              {(field) => (
                <field.TextField
                  label='邮箱'
                  type='email'
                  placeholder='you@company.com'
                  autoComplete='email'
                  required
                />
              )}
            </form.AppField>
            {['login', 'register', 'reset-password'].includes(mode) && (
              <>
                <form.AppField name='password'>
                  {(field) => (
                    <field.TextField
                      label='密码'
                      type={show ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      placeholder='至少 8 位字符'
                      required
                    />
                  )}
                </form.AppField>
                <div className='flex items-center justify-between text-xs'>
                  <Button type='button' variant='ghost' size='sm' onClick={() => setShow(!show)}>
                    {show ? '隐藏密码' : '显示密码'}
                  </Button>
                  {mode === 'login' && (
                    <Link className='underline' href='/forgot-password'>
                      忘记密码？
                    </Link>
                  )}
                </div>
              </>
            )}
            {['register', 'reset-password'].includes(mode) && (
              <form.AppField name='confirm'>
                {(field) => (
                  <field.TextField
                    label='确认密码'
                    type={show ? 'text' : 'password'}
                    autoComplete='new-password'
                    required
                  />
                )}
              </form.AppField>
            )}
            {['verify-email', 'reset-password'].includes(mode) && (
              <form.AppField name='code'>
                {(field) => <field.TextField label='邮件中的验证凭证' required />}
              </form.AppField>
            )}
            {message && (
              <div
                role='alert'
                className='rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm leading-6'
              >
                {message}
              </div>
            )}
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(pending) => (
                <Button className='h-10 w-full' type='submit' disabled={pending}>
                  {pending
                    ? '正在请求…'
                    : mode === 'login'
                      ? '登录'
                      : mode === 'register'
                        ? '创建账号'
                        : mode === 'forgot-password'
                          ? '发送重置邮件'
                          : mode === 'reset-password'
                            ? '重置密码'
                            : '验证邮箱'}
                  <Icons.arrowRight />
                </Button>
              )}
            </form.Subscribe>
          </form>
          <p className='mt-5 text-center text-sm text-muted-foreground'>
            {mode === 'login' ? (
              <>
                还没有账号？{' '}
                <Link className='text-foreground underline' href='/register'>
                  立即注册
                </Link>
              </>
            ) : (
              <Link className='text-foreground underline' href='/login'>
                返回登录
              </Link>
            )}
          </p>
          <div className='my-6 border-t' />
          <Button
            nativeButton={false}
            variant='outline'
            className='h-10'
            render={<Link href='/dashboard' aria-label='体验管理端演示' />}
          >
            无需账号，体验管理端演示
          </Button>
          <p className='mt-4 text-xs leading-5 text-muted-foreground'>
            账号服务尚未接入，当前不会创建账号、保存密码或发送邮件。你可以先体验本地演示。
          </p>
        </div>
        <p className='text-xs text-muted-foreground'>
          © 2026 EventPlay · Turn any event into a game.
        </p>
      </section>
      <section className='hidden flex-col justify-center gap-8 border-l bg-muted/40 p-10 lg:flex xl:p-16'>
        <div>
          <h2 className='text-3xl font-semibold leading-tight'>
            一句话。
            <br />
            一场属于所有人的游戏。
          </h2>
          <p className='mt-4 max-w-md text-sm leading-7 text-muted-foreground'>
            熟悉的玩法，独特的品牌表达。让年会、发布会和每一个相聚的现场，都成为值得记住的时刻。
          </p>
        </div>
        <Stage
          config={{
            name: '全员冲刺 · 巅峰对决',
            description: '',
            mechanic: 'race',
            theme: 'gold',
            teams: '销售部,研发部,市场部',
            duration: 120,
            participants: 200,
            brand: 'YOUR BRAND',
            logo: ''
          }}
        />
        <div className='flex gap-6 text-xs text-muted-foreground'>
          <span>01 选择玩法</span>
          <span>02 加入品牌</span>
          <span>03 全场参与</span>
        </div>
      </section>
    </div>
  );
}
