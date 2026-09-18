'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ACCOUNT_KEY, currentAccount, type AccountUser } from '../api/account';

const AccountContext = createContext<AccountUser | null>(null);
export const useAccount = () => useContext(AccountContext);

/** UX boundary only; every private backend operation also verifies the session. */
export function AccountBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<{ ready: boolean; user: AccountUser | null; error: string }>({ ready: false, user: null, error: '' });
  useEffect(() => {
    let mounted = true;
    currentAccount().then((user) => {
      if (!mounted) return;
      if (!user && localStorage.getItem(ACCOUNT_KEY)) {
        setState({ ready: false, user: null, error: '登录已过期，请重新登录。个人作品仍保存在云端，不会退回本地演示。' });
        return;
      }
      if (user) localStorage.setItem(ACCOUNT_KEY, user.id);
      setState({ ready: true, user, error: '' });
    }).catch((error: Error) => { if (mounted) setState({ ready: false, user: null, error: error.message }); });
    const changed = (event: StorageEvent) => { if (event.key === ACCOUNT_KEY || event.key === null) window.location.reload(); };
    window.addEventListener('storage', changed);
    return () => { mounted = false; window.removeEventListener('storage', changed); };
  }, []);
  if (state.error) return <div className='m-8 space-y-4 rounded-xl border p-8'><p role='alert'>{state.error}</p><Button onClick={() => window.location.reload()}>重试连接</Button><Link className='ml-4 underline' href='/login'>重新登录</Link></div>;
  if (!state.ready) return <p className='p-8 text-sm text-muted-foreground' role='status'>正在验证工作空间…</p>;
  if (!state.user && pathname === '/dashboard/activities/new') {
    return <div className='m-8 space-y-4 rounded-xl border p-8'><h1 className='text-xl font-semibold'>把喜欢的范例，做成你的品牌游戏</h1><p>登录后创建独立云端作品，跨设备保存并发布开场。原演示数据不会被删除。</p><Button onClick={() => window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>登录并继续制作</Button><Link className='ml-4 underline' href='/dashboard/templates'>先看游戏效果</Link></div>;
  }
  return <AccountContext.Provider value={state.user}>{children}</AccountContext.Provider>;
}
