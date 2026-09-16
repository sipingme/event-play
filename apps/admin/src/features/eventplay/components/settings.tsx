'use client';
import Image from 'next/image';
import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppForm } from '@/lib/form';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { brandQuery, eventKeys } from '../api/queries';
import { readLogo, resetDemo, saveBrand } from '../api/service';

export function Brands() {
  const { data } = useSuspenseQuery(brandQuery());
  const client = useQueryClient();
  const [logo, setLogo] = useState(data.logo);
  const form = useAppForm({
    defaultValues: { name: data.name, color: data.color },
    onSubmit: async ({ value }) => {
      try {
        if (!value.name.trim()) throw new Error('请填写品牌名称');
        await saveBrand({ ...value, logo });
        await client.invalidateQueries({ queryKey: eventKeys.all });
        toast.success('品牌已保存，新活动将使用此品牌');
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
  });
  return (
    <PageContainer
      pageTitle='品牌素材'
      pageDescription='保存一次，在下一场活动继续使用。已发布的演示版本不受更改影响。'
    >
      <Card className='max-w-2xl shadow-none'>
        <CardContent>
          <form
            className='space-y-6'
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <form.AppField name='name'>
              {(field) => <field.TextField label='品牌名称' maxLength={40} required />}
            </form.AppField>
            <form.AppField name='color'>
              {(field) => (
                <field.TextField
                  label='品牌色（素材记录）'
                  type='color'
                  description='当前游戏预览使用预设主题，品牌色暂存供后续自定义主题使用。'
                />
              )}
            </form.AppField>
            <label className='block text-sm'>
              品牌 Logo
              <input
                aria-label='品牌素材图片'
                type='file'
                accept='image/png,image/jpeg,image/webp'
                className='my-3 block text-sm'
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      setLogo(await readLogo(file));
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }
                }}
              />
            </label>
            {logo && (
              <div className='flex items-center gap-4'>
                <Image
                  unoptimized
                  width={80}
                  height={80}
                  src={logo}
                  alt='品牌预览'
                  className='size-20 rounded-lg border object-contain'
                />
                <Button variant='outline' type='button' onClick={() => setLogo('')}>
                  移除图片
                </Button>
              </div>
            )}
            <Button type='submit'>保存品牌</Button>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
export function Settings() {
  const [confirm, setConfirm] = useState(false);
  const client = useQueryClient();
  return (
    <PageContainer pageTitle='账户与设置' pageDescription='当前为本地演示工作区。'>
      <Card className='max-w-2xl shadow-none'>
        <CardContent className='space-y-5'>
          <h2 className='font-medium'>身份与服务</h2>
          <p className='text-sm leading-6 text-muted-foreground'>
            当前没有登录真实账号，未连接 FastAPI、AI
            模型或微信服务。演示数据仅存储在本机浏览器中，请勿用于真实活动。
          </p>
          <Button
            nativeButton={false}
            variant='outline'
            render={<Link href='/login' aria-label='返回登录' />}
          >
            查看登录与注册
          </Button>
          <div className='border-t pt-5'>
            <h2 className='font-medium'>重置本地演示</h2>
            <p className='my-3 text-sm text-muted-foreground'>
              清除你在此浏览器创建的演示活动、房间和品牌，恢复初始样例。
            </p>
            <Button variant='destructive' onClick={() => setConfirm(true)}>
              重置演示数据
            </Button>
            {confirm && (
              <div className='mt-4 space-x-3'>
                <Button
                  onClick={async () => {
                    await resetDemo();
                    await client.invalidateQueries({ queryKey: eventKeys.all });
                    setConfirm(false);
                    toast.success('本地演示已重置');
                  }}
                >
                  确认重置
                </Button>
                <Button variant='outline' onClick={() => setConfirm(false)}>
                  取消
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
