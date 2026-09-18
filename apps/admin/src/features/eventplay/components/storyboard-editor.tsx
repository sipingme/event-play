'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAppForm } from '@/lib/form';
import { cn } from '@/lib/utils';
import { connectionError, storyKinds, storyOrder, storyboardErrors, type Storyboard, type StoryKind, type StoryNode } from '../api/storyboard';
import type { GameConfig } from '../api/types';
import { Stage } from './stage';

export function StoryboardEditor({ config, board, onChange }: { config: GameConfig; board: Storyboard; onChange: (board: Storyboard) => void }) {
  const [selected, setSelected] = useState<string | undefined>(board.nodes[0]?.id);
  const [source, setSource] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [zoom, setZoom] = useState(0.8);
  const [preview, setPreview] = useState<{ config: GameConfig; board: Storyboard } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const drag = useRef<{ id: string; px: number; py: number; x: number; y: number } | null>(null);
  const node = board.nodes.find((item) => item.id === selected);
  const errors = storyboardErrors(board);
  function connect(from: string, to: string) {
    const error = connectionError(board, from, to);
    if (error) { setNotice(error); return; }
    onChange({ ...board, edges: [...board.edges, { source: from, target: to }] });
    setSource(null); setNotice('连线已添加，保存草稿后生效。');
  }
  function add(kind: StoryKind, x = 48, y = 540) {
    if (board.nodes.length >= 10) { setNotice('最多支持 10 个节点'); return; }
    const added: StoryNode = { id: crypto.randomUUID(), kind, x: Math.min(1100, Math.max(0, x)), y: Math.min(1000, Math.max(0, y)), title: storyKinds[kind].name, caption: '', seconds: 3 };
    onChange({ ...board, nodes: [...board.nodes, added] }); setSelected(added.id);
    setNotice('已加入节点。先断开原来的出口，再把新节点接入流程。');
  }
  return <section className='space-y-4 rounded-2xl border bg-card p-4' aria-label='游戏故事板'>
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div><h2 className='text-lg font-semibold'>游戏故事板</h2><p className='text-xs text-muted-foreground'>拖动编排 · 出口连接入口 · 点击节点配置</p></div>
      <div className='flex gap-2'>
        <Button variant='outline' size='sm' aria-label='缩小画布' onClick={() => setZoom(Math.max(.4, +(zoom - .2).toFixed(1)))}>−</Button>
        <span className='self-center text-xs'>{Math.round(zoom * 100)}%</span>
        <Button variant='outline' size='sm' aria-label='放大画布' onClick={() => setZoom(Math.min(1.2, +(zoom + .2).toFixed(1)))}>＋</Button>
        <Button variant='outline' size='sm' onClick={() => { const order = storyOrder(board); const rest = board.nodes.filter(n => !order.some(o => o.id === n.id)); onChange({ ...board, nodes: [...order, ...rest].map((n, i) => ({ ...n, x: 36 + (i % 3) * 260, y: 45 + Math.floor(i / 3) * 210 })) }); }}>自动排版</Button>
        <Button size='sm' disabled={errors.length > 0} onClick={() => setPreview(structuredClone({ config, board }))}>完整预演</Button>
      </div>
    </div>
    <p className='rounded-lg bg-amber-500/10 p-3 text-xs leading-5'>故事板用于编辑预演和版本保存；现场场次仍使用现有竞速规则，暂不自动播放展示节点。预演为模拟数据，比赛压缩为 8 秒。</p>
    <div className='flex flex-wrap gap-2' aria-label='节点库'>
      {(['teams', 'message', 'countdown', 'celebrate'] as StoryKind[]).map(kind => <Button key={kind} variant='outline' size='sm' draggable onDragStart={e => e.dataTransfer.setData('application/eventplay-node', kind)} onClick={() => add(kind)}>＋ {storyKinds[kind].name}</Button>)}
    </div>
    <div role='status' className='text-xs text-muted-foreground'>{source ? '请选择目标节点的「入口」；按 Escape 取消。' : notice || '已经为你准备了完整赛马流程。可以直接预演，也可以拖入品牌寄语。'}</div>
    <div className='max-h-[560px] overflow-auto rounded-xl border bg-muted/25' onKeyDown={e => { if (e.key === 'Escape') setSource(null); }}>
      <div className='relative w-[1360px]' style={{ zoom, height: Math.max(600, ...board.nodes.map(n => n.y + 200)), backgroundImage: 'radial-gradient(circle, #94a3b840 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        onDragOver={e => e.preventDefault()} onDrop={e => { const kind = e.dataTransfer.getData('application/eventplay-node') as StoryKind; if (!['teams', 'message', 'countdown', 'celebrate'].includes(kind)) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); add(kind, (e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom); }}>
        <svg className='pointer-events-none absolute inset-0 h-full w-full' aria-hidden='true'>
          {board.edges.map(edge => { const a = board.nodes.find(n => n.id === edge.source), b = board.nodes.find(n => n.id === edge.target); if (!a || !b) return null; return <path key={`${a.id}-${b.id}`} d={`M ${a.x + 220} ${a.y + 115} C ${a.x + 255} ${a.y + 115}, ${b.x - 35} ${b.y + 115}, ${b.x} ${b.y + 115}`} fill='none' stroke={active === a.id ? '#f59e0b' : '#94a3b8'} strokeWidth='3' />; })}
        </svg>
        {board.nodes.map((n) => <article key={n.id} style={{ left: n.x, top: n.y, borderTopColor: storyKinds[n.kind].color }} className={cn('absolute w-[220px] rounded-xl border border-t-4 bg-card shadow-sm', selected === n.id && 'ring-2 ring-primary', active === n.id && 'ring-4 ring-amber-400')}>
          <button type='button' className='w-full touch-none cursor-grab p-3 text-left active:cursor-grabbing' aria-label={`选择或拖动 ${n.title}`} onClick={() => setSelected(n.id)}
            onPointerDown={e => { if (e.button !== 0) return; setSelected(n.id); drag.current = { id: n.id, px: e.clientX, py: e.clientY, x: n.x, y: n.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={e => { const d = drag.current; if (!d || d.id !== n.id) return; onChange({ ...board, nodes: board.nodes.map(item => item.id === d.id ? { ...item, x: Math.min(1100, Math.max(0, d.x + (e.clientX - d.px) / zoom)), y: Math.min(1000, Math.max(0, d.y + (e.clientY - d.py) / zoom)) } : item) }); }}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            <span className='text-[10px] uppercase tracking-widest text-muted-foreground'>{storyKinds[n.kind].name}</span><strong className='mt-1 block truncate text-sm'>{n.title}</strong><span className='mt-1 block truncate text-xs text-muted-foreground'>{n.kind === 'race' ? `正式比赛 ${config.duration} 秒` : `展示 ${n.seconds} 秒`} · {n.caption || storyKinds[n.kind].description}</span>
          </button>
          <div className='flex justify-between border-t px-2 py-1.5'>
            <button type='button' className='rounded px-2 py-1 text-xs hover:bg-muted disabled:opacity-30' disabled={n.kind === 'gather'} onClick={() => { if (source) connect(source, n.id); else setNotice('先点击另一个节点的出口'); }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); e.stopPropagation(); const from = e.dataTransfer.getData('application/eventplay-port'); if (from) connect(from, n.id); }}>● 入口</button>
            <button type='button' className='rounded px-2 py-1 text-xs hover:bg-muted disabled:opacity-30' disabled={n.kind === 'celebrate'} draggable onDragStart={e => { e.dataTransfer.setData('application/eventplay-port', n.id); setSource(n.id); }} onClick={() => setSource(n.id)}>出口 ●</button>
          </div>
        </article>)}
      </div>
    </div>
    <div className='grid gap-4 lg:grid-cols-2'>
      {node && <NodeSettings key={node.id + ':' + node.title + ':' + node.caption + ':' + node.seconds} node={node} onApply={updated => onChange({ ...board, nodes: board.nodes.map(n => n.id === updated.id ? updated : n) })} />}
      <div className='space-y-3 rounded-xl border p-4 text-sm'>
        <h3 className='font-medium'>流程检查</h3>
        {errors.length ? <ul className='list-disc space-y-1 pl-4 text-amber-700 dark:text-amber-300'>{errors.map(error => <li key={error}>{error}</li>)}</ul> : <p className='text-emerald-600'>所有节点已连通，可以预演和保存发布。</p>}
        <p className='text-xs text-muted-foreground'>未连通也可保存草稿，但不能预演或发布。更改配置后请保存顶部草稿。</p>
        {node && <div className='flex flex-wrap gap-2'><Button variant='outline' size='sm' onClick={() => { onChange({ ...board, edges: board.edges.filter(e => e.source !== node.id) }); setNotice('已断开出口，可重新连线'); }}>断开当前出口</Button>
          <Button variant='outline' size='sm' disabled={['gather', 'race', 'awards'].includes(node.kind)} onClick={() => { onChange({ ...board, nodes: board.nodes.filter(n => n.id !== node.id), edges: board.edges.filter(e => e.source !== node.id && e.target !== node.id) }); setSelected(board.nodes.find(n => n.id !== node.id)?.id); }}>删除可选节点</Button></div>}
      </div>
    </div>
    {preview && <StoryPreview config={preview.config} board={preview.board} onActive={setActive} onClose={() => { setPreview(null); setActive(null); }} />}
  </section>;
}

function NodeSettings({ node, onApply }: { node: StoryNode; onApply: (node: StoryNode) => void }) {
  const form = useAppForm({ defaultValues: { title: node.title, caption: node.caption, seconds: String(node.seconds) }, onSubmit: ({ value }) => { const seconds = Number(value.seconds); if (!value.title.trim() || !Number.isInteger(seconds) || seconds < 1 || seconds > 15) return; onApply({ ...node, title: value.title.trim(), caption: value.caption, seconds }); } });
  return <form className='space-y-3 rounded-xl border p-4' onSubmit={e => { e.preventDefault(); void form.handleSubmit(); }}><h3 className='text-sm font-medium'>节点配置 · {storyKinds[node.kind].name}</h3>
    <form.AppField name='title'>{field => <field.TextField label='画面标题' required maxLength={60} />}</form.AppField>
    <form.AppField name='caption'>{field => <field.TextField label='品牌文案' maxLength={200} />}</form.AppField>
    {node.kind !== 'race' && <form.AppField name='seconds'>{field => <field.TextField label='展示秒数（1～15）' type='number' min={1} max={15} required />}</form.AppField>}
    {node.kind === 'race' && <p className='text-xs text-muted-foreground'>比赛时长和队伍在左侧活动配置中设置。</p>}
    <Button type='submit' variant='outline' size='sm'>应用节点设置</Button>
  </form>;
}

function StoryPreview({ config, board, onActive, onClose }: { config: GameConfig; board: Storyboard; onActive: (id: string) => void; onClose: () => void }) {
  const order = storyOrder(board);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const current = order[index];
  const seconds = current.kind === 'race' ? 8 : current.seconds;
  useEffect(() => { onActive(current.id); }, [current.id, onActive]);
  useEffect(() => { if (!playing) return; const timer = setTimeout(() => { if (elapsed + 1 >= seconds) { if (index < order.length - 1) { setIndex(index + 1); setElapsed(0); } else setPlaying(false); } else setElapsed(elapsed + 1); }, 1000); return () => clearTimeout(timer); }, [playing, elapsed, index, seconds, order.length]);
  const teams = config.teams.split(/[,，]/).filter(Boolean);
  return <div className='space-y-3 rounded-xl border p-3' aria-label='流程预演'>
    <div className='flex flex-wrap items-center justify-between gap-2'><span className='text-sm font-medium'>导演预演 · {index + 1}/{order.length} · 模拟数据</span><div className='flex gap-2'><Button size='sm' variant='outline' onClick={() => setPlaying(!playing)}>{playing ? '暂停' : '播放'}</Button><Button size='sm' variant='outline' onClick={() => { setIndex(0); setElapsed(0); setPlaying(true); }}>重播</Button><Button size='sm' variant='outline' onClick={onClose}>关闭</Button></div></div>
    <div className='flex flex-wrap gap-1'>{order.map((n, i) => <Button key={n.id} size='sm' variant={index === i ? 'default' : 'ghost'} onClick={() => { setIndex(i); setElapsed(0); }}>{i + 1}. {n.title}</Button>)}</div>
    {current.kind === 'race' ? <><p className='text-center font-semibold'>{current.title} · {current.caption}</p><Stage config={config} scores={teams.map((_, i) => Math.round((elapsed + 1) / 8 * 100 * (1 - i * .12)))} remaining={8 - elapsed} /></> : <div className='flex min-h-72 flex-col items-center justify-center gap-5 rounded-xl bg-gradient-to-br from-red-950 via-red-800 to-amber-700 p-8 text-center text-amber-100'>
      <span className='text-xs tracking-[.3em]'>{config.brand || 'EVENTPLAY'} · {storyKinds[current.kind].name}</span><h3 className='text-3xl font-black'>{current.title}</h3><p>{current.caption}</p>
      {current.kind === 'countdown' && <strong className='text-7xl'>{seconds - elapsed}</strong>}
      {current.kind === 'gather' && <div className='rounded-xl border border-amber-200/40 px-8 py-4'>扫码加入 · 入口占位示意<br /><span className='text-xs'>正式入场二维码在创建现场场次后生成</span></div>}
      {['teams', 'awards'].includes(current.kind) && <div className='flex flex-wrap justify-center gap-3'>{teams.map((team, i) => <div key={i} className='rounded-xl border border-amber-200/40 bg-black/10 px-5 py-4'>{current.kind === 'awards' && <strong className='mb-2 block text-2xl'>第 {i + 1} 名</strong>}{team}</div>)}</div>}
      {current.kind === 'celebrate' && <strong className='text-4xl'>✦ 共同创造精彩 ✦</strong>}
    </div>}
  </div>;
}
