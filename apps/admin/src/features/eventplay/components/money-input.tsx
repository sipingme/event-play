'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { CSSProperties } from 'react';
import { WealthCard } from './money-scene';
import styles from './money-scene.module.css';

export function MoneyInput({ disabled, onSwipe, score = 0, brand }: { disabled: boolean; onSwipe: () => void; score?: number; brand?: string }) {
  const start = useRef<{ x: number; y: number; id: number; at: number } | null>(null);
  const [hint, setHint] = useState('从卡片下方向上划动');
  const [drag,setDrag]=useState(0);
  const [flight,setFlight]=useState(0);
  const submit=()=>{if(disabled)return;onSwipe();setFlight(n=>n+1);setHint('已提交划动，以服务端贡献分数为准');};
  return <div className={styles.input}>
    <div className={styles.confirmed}>我的已确认贡献 <b>{score}</b> 积分</div>
    <div
      className={styles.pad} data-money-pad role='group' aria-label='数钱滑动区' aria-disabled={disabled}
      onPointerMove={event=>{if(!disabled&&start.current?.id===event.pointerId)setDrag(Math.max(-100,Math.min(20,event.clientY-start.current.y)));}}
      onPointerDown={(event) => {
        if (disabled || start.current) return;
        start.current = { x: event.clientX, y: event.clientY, id: event.pointerId, at: performance.now() };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { start.current = null; setDrag(0); }}
      onLostPointerCapture={() => { start.current = null; setDrag(0); }}
      onPointerUp={(event) => {
        const down = start.current;
        if (!down || down.id !== event.pointerId) return;
        start.current = null; setDrag(0);
        if (disabled) return;
        const dy = down.y - event.clientY;
        if (dy >= 48 && dy > Math.abs(down.x - event.clientX) && performance.now() - down.at < 2000) {
          submit();
        } else setHint('请向上划动至少一段距离，不是点击哦');
      }}
    >
      <span className='text-xs tracking-widest'>EVENTPLAY · 财富积分卡</span>
      <div className={styles.handCard} style={{'--drag':`${drag}px`} as CSSProperties}><WealthCard brand={brand}/></div>
      {flight>0&&!disabled&&<div key={flight} className={styles.flight}><WealthCard brand={brand}/></div>}
      <small>{disabled ? '等待开场或恢复连接' : '↑ 向上划出积分卡，为战队数钱'}</small>
    </div>
    <p role='status' className='text-center text-xs text-muted-foreground'>{hint}</p>
    <Button className='w-full' variant='outline' disabled={disabled} onClick={submit}>无障碍操作：数一张</Button>
    <p className='text-center text-xs text-muted-foreground'>虚拟积分，不涉及现金与红包；无障碍操作使用相同限速。</p>
  </div>;
}
