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
    if (['vote','wall','create','social'].includes(room.config.mechanic) || !sound || !connected || room.blackout || !audio.current || !(room.state==='completed' || room.state==='running' && room.remaining<=10)) return;
    const ctx=audio.current;
    const oscillator=ctx.createOscillator(); const gain=ctx.createGain();
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.frequency.value=room.state==='completed'?880:660;
    gain.gain.setValueAtTime(.08,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.25);
    oscillator.start(); oscillator.stop(ctx.currentTime+.3);
  },[room.state,room.remaining,room.blackout,room.config.mechanic,connected,sound]);
  const individual = room.config.participationMode === 'individual';
  const high=individual ? (room.leaderboard?.[0]?.score ?? 0) : Math.max(...room.scores);
  const winners=individual ? (room.leaderboard ?? []).filter(p=>p.score===high).map(p=>p.name) : room.config.teams.split(',').filter((_,i)=>room.scores[i]===high);
  const competitive=!['draw','light','vote','wall','create','social'].includes(room.config.mechanic);
  return <div className='mb-4 space-y-3'>
    <div className='flex flex-wrap items-center gap-3'>
      <Button variant='outline' onClick={async()=>{try{if(document.fullscreenElement) await document.exitFullscreen(); else await ((room.config.clickVariant || ['race','money','alternating','reaction','catch'].includes(room.config.mechanic)) ? document.querySelector('[data-click-stage], [data-race-stage], [data-money-stage], [data-coordination-stage], [data-control-stage]') ?? document.documentElement : document.documentElement).requestFullscreen();setMessage('');}catch{setMessage('浏览器不支持或阻止全屏，请使用浏览器全屏功能。');}}}>{fullscreen?'退出全屏':'进入全屏'}</Button>
      <Button variant='outline' onClick={async()=>{if(sound){setSound(false);return;}try{audio.current??=new AudioContext();await audio.current.resume();setSound(true);setMessage('');}catch{setMessage('此浏览器无法启用音效。');}}}>{sound?'关闭音效':'启用倒计时音效'}</Button>
      {room.state==='running' && (['vote','wall','create','social'].includes(room.config.mechanic)?<strong className='ml-auto text-xl'>{room.config.mechanic==='social'?(room.game?.social?.closed?'破冰已截止':'社交破冰中'):room.config.mechanic==='create'?(room.game?.creation?.closed?'共创已收官':'全场共创中'):room.config.mechanic==='vote'?`第 ${(room.game?.round??0)+1} 轮 · ${room.game?.finished?'已完成':room.game?.closed?'已截止':'开放中'}`:'开放签到中'}</strong>:<strong role='timer' className='ml-auto font-mono text-4xl tabular-nums'>{room.remaining<=10?'最后 ':''}{room.remaining}s</strong>)}
    </div>
    {message && <p role='status'>{message}</p>}
    {!room.blackout && room.state==='completed' && competitive && <div className='rounded-2xl border border-amber-400 bg-amber-500/10 p-6 text-center'><p className='text-sm'>最终战报 · 服务器确认</p><h2 className='mt-2 text-3xl font-bold'>{high===0?'本局暂无有效得分':`${winners.join('、')}${winners.length>1?' 并列领先':' 获胜'}`}</h2><p className='mt-2'>{room.playerCount ?? room.players.length} 位参与者 · 最高{individual ? '个人' : '团队'}得分 {high}{individual && ' · 全员同屏'}</p></div>}
  </div>;
}
