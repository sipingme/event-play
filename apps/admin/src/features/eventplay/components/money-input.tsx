'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export function MoneyInput({ disabled, onSwipe }: { disabled: boolean; onSwipe: () => void }) {
  const start = useRef<{ x: number; y: number; id: number; at: number } | null>(null);
  const [hint, setHint] = useState('从卡片下方向上划动');
  return <div className='my-6 space-y-3'>
    <div
      className='flex h-64 touch-none select-none flex-col items-center justify-center rounded-3xl border-4 border-amber-300 bg-gradient-to-br from-amber-100 to-amber-300 p-8 text-amber-950 shadow-lg'
      onPointerDown={(event) => {
        if (disabled || start.current) return;
        start.current = { x: event.clientX, y: event.clientY, id: event.pointerId, at: performance.now() };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { start.current = null; }}
      onLostPointerCapture={() => { start.current = null; }}
      onPointerUp={(event) => {
        const down = start.current;
        if (!down || down.id !== event.pointerId) return;
        start.current = null;
        if (disabled) return;
        const dy = down.y - event.clientY;
        if (dy >= 48 && dy > Math.abs(down.x - event.clientX) && performance.now() - down.at < 2000) {
          onSwipe(); setHint('已提交划动，以服务端贡献分数为准');
        } else setHint('请向上划动至少一段距离，不是点击哦');
      }}
    >
      <span className='text-xs tracking-widest'>EVENTPLAY · 财富积分卡</span>
      <strong className='my-6 text-6xl'>↑ +1</strong>
      <span>{disabled ? '等待开场或恢复连接' : '向上划动，为战队数钱'}</span>
    </div>
    <p role='status' className='text-center text-xs text-muted-foreground'>{hint}</p>
    <Button className='w-full' variant='outline' disabled={disabled} onClick={onSwipe}>无障碍操作：数一张</Button>
    <p className='text-center text-xs text-muted-foreground'>虚拟积分，不涉及现金与红包；无障碍操作使用相同限速。</p>
  </div>;
}
