'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { LiveRoom } from '../api/realtime';

export function ScreenPresentation({room, connected}: {room: LiveRoom; connected: boolean}) {
  const audio = useRef<AudioContext | null>(null);
  const last = useRef('');
  const [sound, setSound] = useState(false);
  const [message, setMessage] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange',update);
    return () => {document.removeEventListener('fullscreenchange',update); void audio.current?.close();};
  },[]);
  useEffect(() => {
    const key = `${room.state}:${room.remaining}`;
    if (key===last.current) return;
    last.current=key;
    if (!sound || !connected || room.blackout || !audio.current || !(room.state==='completed' || room.state==='running' && room.remaining<=10)) return;
    const ctx=audio.current;
    const oscillator=ctx.createOscillator(); const gain=ctx.createGain();
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.frequency.value=room.state==='completed'?880:660;
    gain.gain.setValueAtTime(.08,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.25);
    oscillator.start(); oscillator.stop(ctx.currentTime+.3);
  },[room.state,room.remaining,room.blackout,connected,sound]);
  const high=Math.max(...room.scores);
  const winners=room.config.teams.split(',').filter((_,i)=>room.scores[i]===high);
  const competitive=!['draw','light'].includes(room.config.mechanic);
  return <div className='mb-4 space-y-3'>
    <div className='flex flex-wrap items-center gap-3'>
      <Button variant='outline' onClick={async()=>{try{if(document.fullscreenElement) await document.exitFullscreen(); else await (room.config.mechanic === 'race' ? document.querySelector('[data-race-stage]') ?? document.documentElement : document.documentElement).requestFullscreen();setMessage('');}catch{setMessage('浏览器不支持或阻止全屏，请使用浏览器全屏功能。');}}}>{fullscreen?'退出全屏':'进入全屏'}</Button>
      <Button variant='outline' onClick={async()=>{if(sound){setSound(false);return;}try{audio.current??=new AudioContext();await audio.current.resume();setSound(true);setMessage('');}catch{setMessage('此浏览器无法启用音效。');}}}>{sound?'关闭音效':'启用倒计时音效'}</Button>
      {room.state==='running' && <strong role='timer' className='ml-auto font-mono text-4xl tabular-nums'>{room.remaining<=10?'最后 ':''}{room.remaining}s</strong>}
    </div>
    {message && <p role='status'>{message}</p>}
    {!room.blackout && room.state==='completed' && competitive && <div className='rounded-2xl border border-amber-400 bg-amber-500/10 p-6 text-center'><p className='text-sm'>最终战报 · 服务器确认</p><h2 className='mt-2 text-3xl font-bold'>{high===0?'本局暂无有效得分':`${winners.join('、')}${winners.length>1?' 并列领先':' 获胜'}`}</h2><p className='mt-2'>{room.playerCount ?? room.players.length} 位参与者 · 最高团队得分 {high}</p></div>}
  </div>;
}
