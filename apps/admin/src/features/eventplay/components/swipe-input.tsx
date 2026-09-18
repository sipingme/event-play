'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { InputKind, SwipeDirection } from '../api/types';
import { detectSwipe, swipeLabels } from '../api/swipe';
import { cn } from '@/lib/utils';

export function SwipeInput({disabled,direction,nextSide,onInput}:{
  disabled:boolean; direction:SwipeDirection; nextSide:'left'|'right'; onInput:(kind:InputKind)=>void;
}) {
  const start=useRef<{x:number;y:number;id:number;at:number}|null>(null);
  const [hint,setHint]=useState('每次滑动至少 48 像素，2 秒内完成');
  const alternating=direction==='alternating';
  const arrow=alternating ? nextSide==='left'?'←':'→' : direction==='down'?'↓':'↑';
  const submit=(kind:InputKind)=>{if(disabled)return;onInput(kind);setHint('已提交划动，以服务端贡献分数为准');};
  return <div className='my-6 space-y-3'>
    <div role='group' aria-label='滑屏操作区' aria-disabled={disabled} data-swipe-pad
      className={cn('flex h-64 touch-none select-none flex-col items-center justify-center rounded-3xl border-4 border-white bg-gradient-to-br from-sky-100 to-cyan-200 p-6 text-sky-950 shadow-lg',disabled && 'opacity-60')}
      onPointerDown={e=>{if(disabled||start.current)return;start.current={x:e.clientX,y:e.clientY,id:e.pointerId,at:performance.now()};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerCancel={()=>{start.current=null;}} onLostPointerCapture={()=>{start.current=null;}}
      onPointerUp={e=>{const down=start.current;if(!down||down.id!==e.pointerId)return;start.current=null;if(disabled)return;
        const kind=detectSwipe(e.clientX-down.x,e.clientY-down.y,performance.now()-down.at,direction);
        if(kind)submit(kind);else setHint(`请${swipeLabels[direction]}至少一段距离，不是点击哦`);
      }}>
      <span className='text-sm font-bold'>{swipeLabels[direction]}</span>
      <strong className='my-4 text-7xl' aria-hidden='true'>{arrow}</strong>
      <span>{disabled?'等待开场或恢复连接':alternating?`建议下一次：向${nextSide==='left'?'左':'右'}滑动`:'松手完成一次有效滑动'}</span>
    </div>
    <p role='status' className='text-center text-xs text-muted-foreground'>{hint}</p>
    {alternating?<div className='grid grid-cols-2 gap-3'>{(['left','right'] as const).map(side=><Button key={side} variant='outline' disabled={disabled} onClick={()=>submit(side==='left'?'swipe-left':'swipe-right')}>无障碍：向{side==='left'?'左':'右'}</Button>)}</div>
      :<Button className='w-full' variant='outline' disabled={disabled} onClick={()=>submit(direction==='down'?'swipe-down':'swipe-up')}>无障碍：{swipeLabels[direction]}一次</Button>}
    <p className='text-center text-xs text-muted-foreground'>每次有效操作 +1；按钮使用相同规则与限速。{alternating?'连续同侧不计分。':''}</p>
  </div>;
}
