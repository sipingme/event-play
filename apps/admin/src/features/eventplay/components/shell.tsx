'use client';
import { Component, Suspense, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar';

const links = [
  { name: '工作台', path: '/dashboard', icon: Icons.dashboard },
  { name: '我的活动', path: '/dashboard/activities', icon: Icons.calendar },
  { name: '云工作区与房间', path: '/dashboard/cloud', icon: Icons.video },
  { name: '主持人端', path: '/host', icon: Icons.video },
  { name: '游戏体验库', path: '/dashboard/templates', icon: Icons.galleryVerticalEnd },
  { name: '品牌素材', path: '/dashboard/brands', icon: Icons.palette },
  { name: '活动报告', path: '/dashboard/reports', icon: Icons.trendingUp }
];
export class PageError extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div role='alert' className='m-8 rounded-xl border p-8'>
        <h2 className='text-lg font-semibold'>页面暂时无法加载</h2>
        <p className='my-4 text-muted-foreground'>{this.state.error}</p>
        <Button onClick={() => window.location.reload()}>重新加载</Button>
        <Link href='/dashboard/settings' className='ml-4 underline'>
          打开设置
        </Link>
      </div>
    ) : (
      this.props.children
    );
  }
}
const subscribeReady = () => () => {};
export function ClientReady({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false
  );
  return ready ? (
    <Suspense
      fallback={
        <div role='status' className='p-8 text-muted-foreground'>
          正在读取活动数据…
        </div>
      }
    >
      {children}
    </Suspense>
  ) : (
    <div role='status' className='p-8 text-muted-foreground'>
      正在准备工作台…
    </div>
  );
}
export function EventShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const current = links.find(
    (l) => l.path === pathname || (l.path !== '/dashboard' && pathname.startsWith(l.path))
  );
  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible='icon'>
        <SidebarHeader className='p-4'>
          <Link href='/dashboard' className='flex items-center gap-3'>
            <span className='flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground'>
              <Icons.sparkles className='size-5' />
            </span>
            <span className='text-xl font-semibold tracking-tight group-data-[collapsible=icon]:hidden'>
              EventPlay
              <span className='block text-xs font-normal text-muted-foreground'>
                让全场，一起开玩
              </span>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>活动空间</SidebarGroupLabel>
            <SidebarMenu>
              {links.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    render={<Link href={item.path} aria-label={item.name} />}
                    isActive={current?.path === item.path}
                    tooltip={item.name}
                  >
                    <item.icon />
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <div className='mx-4 mt-auto rounded-xl border bg-card p-4 group-data-[collapsible=icon]:hidden'>
            <Icons.sparkles className='mb-3 size-5' />
            <p className='text-sm font-medium'>下一场精彩，从这里开始</p>
            <p className='my-2 text-xs leading-5 text-muted-foreground'>
              选一个玩法，加入你的品牌，把现场变成大家的主场。
            </p>
            <Button
              nativeButton={false}
              className='mt-2 w-full'
              render={<Link href='/dashboard/activities/new' aria-label='创建活动' />}
            >
              创建活动 <Icons.add />
            </Button>
          </div>
        </SidebarContent>
        <SidebarFooter className='p-3'>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href='/dashboard/settings' aria-label='账户与设置' />}
              >
                <Icons.settings />
                <span>账户与设置</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href='/login' aria-label='返回登录' />}>
                <Icons.logout />
                <span>退出演示</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className='flex gap-3 border-t px-2 pt-3 group-data-[collapsible=icon]:hidden'>
            <span className='flex size-8 items-center justify-center rounded-full bg-secondary text-sm'>
              EP
            </span>
            <div>
              <p className='text-sm'>体验工作区</p>
              <p className='text-xs text-muted-foreground'>预览版 · 支持云工作区</p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className='min-w-0'>
        <header className='flex h-16 shrink-0 items-center gap-3 border-b px-4 md:px-6'>
          <SidebarTrigger />
          <span className='text-sm text-muted-foreground'>工作空间</span>
          <Icons.chevronRight className='size-3 text-muted-foreground' />
          <span className='text-sm'>{current?.name ?? '活动配置'}</span>
          <div className='ml-auto flex items-center gap-3'>
            <Badge variant='outline'>前端演示</Badge>
            <Button
              variant='ghost'
              size='icon'
              aria-label='切换明暗主题'
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              <Icons.brightness />
            </Button>
          </div>
        </header>
        <div className='border-b bg-muted/50 px-4 py-2 text-xs leading-5 text-muted-foreground md:px-6'>
          预览版：未连接云工作区时，活动保存在本机；连接后保存至后端。支持 H5 联机，正式账号、微信登录与 AI 尚未接入。
        </div>
        <main className='min-w-0 flex-1 py-5'>
          <PageError key={pathname}>
            <ClientReady>{children}</ClientReady>
          </PageError>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
