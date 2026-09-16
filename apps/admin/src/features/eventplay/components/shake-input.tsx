'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
export function ShakeInput({
  disabled,
  onInput
}: {
  disabled: boolean;
  onInput: (kind: 'tap' | 'shake') => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [notice, setNotice] = useState('轻摇即可加速，请握稳手机，不要大幅挥动。');
  const latest = useRef({ disabled, onInput });
  useEffect(() => {
    latest.current = { disabled, onInput };
  }, [disabled, onInput]);
  useEffect(() => {
    if (!enabled) return;
    let previous: number[] | null = null;
    let last = 0;
    let received = false;
    function motion(event: DeviceMotionEvent) {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      received = true;
      const current = [a.x, a.y, a.z];
      const delta = previous ? Math.hypot(...current.map((value, i) => value - previous![i])) : 0;
      previous = current;
      if (document.visibilityState !== 'visible' || latest.current.disabled) {
        previous = null;
        return;
      }
      const now = performance.now();
      if (delta > 12 && now - last > 250) {
        last = now;
        latest.current.onInput('shake');
      }
    }
    window.addEventListener('devicemotion', motion);
    const timer = setTimeout(() => {
      if (!received) setNotice('未检测到动作数据，请检查权限或使用点击备用。');
    }, 4000);
    return () => {
      window.removeEventListener('devicemotion', motion);
      clearTimeout(timer);
    };
  }, [enabled]);
  async function enable() {
    try {
      if (!window.isSecureContext || typeof DeviceMotionEvent === 'undefined')
        throw new Error('当前设备不支持摇动，请使用点击备用。');
      const motion = DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<string>;
      };
      if (motion.requestPermission && (await motion.requestPermission()) !== 'granted')
        throw new Error('动作权限未开启，请使用点击备用。');
      setEnabled(true);
      setNotice('摇动已开启，开场后轻摇手机即可加速。');
    } catch (error) {
      setNotice((error as Error).message);
    }
  }
  return (
    <section className='my-6 space-y-4 rounded-3xl border bg-sky-50 p-6 text-center text-sky-950'>
      <div className='text-5xl' aria-hidden='true'>
        ↔
      </div>
      <h2 className='text-xl font-bold'>摇一摇 · 为战队加速</h2>
      <p role='status' className='text-sm'>
        {notice}
      </p>
      <Button
        className='w-full'
        variant='outline'
        onClick={() => (enabled ? setEnabled(false) : void enable())}
      >
        {enabled ? '关闭摇动' : '开启摇动'}
      </Button>
      <Button
        className='h-24 w-full touch-manipulation text-lg'
        disabled={disabled}
        onClick={() => onInput('tap')}
      >
        点击备用加速
      </Button>
      <p className='text-xs'>摇动与点击同分、共用限速。</p>
    </section>
  );
}
