'use client';
import Image from 'next/image';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { LiveRoom } from '../api/realtime';
import {
  createGames,
  creationColors,
  creationCities,
  type CreateVariant,
  type CreationStroke,
  type CreationItem
} from '../api/create-games';
import {
  creationSelfQuery,
  creationAdminQuery,
  sendCreation,
  manageCreation,
  type CreationInput
} from '../api/create-service';
import { CreationArt, Sketch, Fireworks } from './create-art';
import styles from './create-scene.module.css';

export function CreatePoster({ variant }: { variant: CreateVariant }) {
  return (
    <div
      className={styles.poster}
      style={{ backgroundImage: "url('" + createGames[variant].background + "')" }}
    >
      <CreationArt variant={variant} color={variant === 'tree' ? 2 : variant === 'map' ? 3 : 0} />
    </div>
  );
}
function Artwork({ item, variant }: { item: CreationItem; variant: CreateVariant }) {
  return (
    <article className={styles.piece} data-kind={variant}>
      {variant === 'draw' || variant === 'scroll' ? (
        <>
          <Sketch strokes={item.strokes} />
          {variant === 'scroll' && (
            <CreationArt variant='stars' color={item.color} shape={item.shape} />
          )}
        </>
      ) : (
        <CreationArt variant={variant} color={item.color} shape={item.shape} />
      )}
      <p>{item.text || '一份共同创造的心意'}</p>
    </article>
  );
}
export function CreateScene({ room }: { room: LiveRoom }) {
  const v = room.config.createVariant ?? 'puzzle',
    info = createGames[v],
    g = room.game?.creation;
  const items = g?.items ?? [],
    pieces = g?.pieces ?? [],
    tree = g?.tree ?? {},
    stage = g?.treeStage ?? 0;
  const source = room.config.createImage ?? '/games/click/garden-bg-v1.png';
  return (
    <section
      className={styles.scene}
      data-create-variant={v}
      style={{ backgroundImage: "url('" + info.background + "')" }}
    >
      <header>
        <span>{room.config.brand || 'EventPlay'} · 全场共同创造</span>
        <span>
          {room.state === 'waiting'
            ? '等待开场'
            : room.state === 'paused'
              ? '共创暂停'
              : g?.closed
                ? '作品已收官'
                : '共创进行中'}{' '}
          · {room.playerCount ?? room.players.length} 人参与
        </span>
      </header>
      <h2>{info.name}</h2>
      <p className={styles.subtitle}>{info.description}</p>
      <div className={styles.artboard}>
        {v === 'puzzle' ? (
          <>
            <div className={styles.tiles}>
              {Array.from({ length: 16 }, (_, i) => (
                <div
                  key={i}
                  className={styles.tile}
                  data-done={pieces.includes(i)}
                  style={{
                    backgroundImage: "url('" + source + "')",
                    backgroundPosition:
                      ((i % 4) * 100) / 3 + '% ' + (Math.floor(i / 4) * 100) / 3 + '%'
                  }}
                >
                  {!pieces.includes(i) && i + 1}
                </div>
              ))}
            </div>
            <p className={styles.caption}>
              共同完成 {pieces.length} / 16 块 ·{' '}
              {pieces.length === 16 ? '完整作品已呈现！' : '领取图块，找到它的位置'}
            </p>
          </>
        ) : v === 'tree' ? (
          <div className={styles.tree}>
            <svg viewBox='0 0 500 350' aria-label='全场共同种树'>
              <ellipse cx='250' cy='320' rx='170' ry='20' fill='#75b67b' />
              <path
                d='M250 310V170M250 240L180 185M250 215L310 165'
                fill='none'
                stroke='#ae7b50'
                strokeWidth={12 + stage * 5}
                strokeLinecap='round'
              />
              {stage > 0 &&
                [
                  [-60, 0],
                  [60, 0],
                  [0, -50]
                ].map(([x, y], i) => (
                  <ellipse
                    key={i}
                    cx={250 + x * (0.5 + stage * 0.12)}
                    cy={170 + y}
                    rx={25 + stage * 20}
                    ry={25 + stage * 15}
                    fill={['#95cf78', '#72bb77', '#a4db82'][i]}
                    stroke='#dff2b8'
                    strokeWidth='5'
                  />
                ))}
              {stage === 0 && (
                <text x='250' y='120' textAnchor='middle' fill='#86562c' fontSize='24'>
                  等待第一颗种子
                </text>
              )}
              {stage >= 3 &&
                [180, 230, 285, 325].map((x, i) => (
                  <circle
                    key={x}
                    cx={x}
                    cy={130 + (i % 2) * 30}
                    r={stage === 4 ? 15 : 8}
                    fill='#ffd775'
                    stroke='#fff1b7'
                    strokeWidth='3'
                  />
                ))}
            </svg>
            <h3>{['待播种', '种子萌芽', '枝叶舒展', '结果成长', '全场丰收'][stage]}</h3>
            <div className={styles.meters}>
              {[
                ['seed', '播种'],
                ['water', '浇水'],
                ['feed', '施肥']
              ].map(([k, label]) => (
                <span key={k}>
                  {label} {tree[k] ?? 0} / {g?.treeTarget ?? 1}
                </span>
              ))}
            </div>
            <p className={styles.caption}>每人每种操作一次，三种协作达到目标共同丰收</p>
          </div>
        ) : v === 'map' ? (
          <>
            <svg viewBox='0 0 800 440' aria-label='城市点亮关系示意图'>
              {creationCities.map((city, i) => {
                const x = 80 + (i % 4) * 205,
                  y = 65 + Math.floor(i / 4) * 145,
                  count = items.filter((a) => a.city === i).length;
                return (
                  <g key={city}>
                    <path
                      d={'M400 220L' + x + ' ' + y}
                      stroke={count ? '#f4be55' : '#d4dcb7'}
                      strokeWidth='4'
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={count ? 33 : 25}
                      fill={count ? '#ffda75' : '#e2e9d1'}
                      stroke='#fff5d5'
                      strokeWidth='5'
                    />
                    <text x={x} y={y + 5} textAnchor='middle' className={styles.maplabel}>
                      {count}人
                    </text>
                    <text x={x} y={y + 54} textAnchor='middle' className={styles.maplabel}>
                      {city}
                    </text>
                  </g>
                );
              })}
            </svg>
            <p className={styles.caption}>
              城市联结示意图，非地理边界地图；玩家自主选择，不采集定位
            </p>
          </>
        ) : v === 'stars' ? (
          <div className={styles.sky}>
            <svg viewBox='0 0 800 480' aria-label='全场爱心星河'>
              {items.map((item, i) => {
                const a = i * 2.39996,
                  r = 0.45 + (0.55 * (i % 7)) / 6,
                  x = 400 + 16 * Math.pow(Math.sin(a), 3) * 17 * r,
                  y =
                    250 -
                    (13 * Math.cos(a) -
                      5 * Math.cos(2 * a) -
                      2 * Math.cos(3 * a) -
                      Math.cos(4 * a)) *
                      14 *
                      r;
                return (
                  <g key={item.id}>
                    <title>{item.text || '共创星星'}</title>
                    <svg x={x - 18} y={y - 18} width='36' height='36'>
                      <CreationArt variant='stars' color={item.color} shape={item.shape} />
                    </svg>
                  </g>
                );
              })}
              {!items.length && (
                <text x='400' y='230' textAnchor='middle' fill='#fff0bb' fontSize='24'>
                  为全场点亮第一颗星星
                </text>
              )}
            </svg>
          </div>
        ) : v === 'fireworks' ? (
          <div className={styles.sky}>
            <Fireworks
              frozen={room.state !== 'running'}
              items={items}
              at={g?.launchedAt ?? null}
              serverTime={g?.serverTime ?? Date.now() / 1000}
            />
          </div>
        ) : items.length ? (
          <div className={v === 'scroll' ? styles.scroll : styles.collection}>
            {items.map((item) => (
              <Artwork key={item.id} item={item} variant={v} />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <p>等待第一份共创作品</p>
            <p>拿起手机，把你的创意放进全场画面</p>
          </div>
        )}
      </div>
      <footer>
        <span>
          {['puzzle', 'tree'].includes(v)
            ? '一起完成，不设个人排名'
            : items.length + ' 份已公开作品 · ' + (g?.total ?? 0) + ' 份已提交'}
        </span>
        <span>文字与绘画经主持人审核后展示</span>
      </footer>
    </section>
  );
}

export function CreatePlayer({ room, connected }: { room: LiveRoom; connected: boolean }) {
  const { data } = useSuspenseQuery(creationSelfQuery(room.id)),
    client = useQueryClient();
  const v = room.config.createVariant ?? 'puzzle',
    g = room.game?.creation;
  const [color, setColor] = useState(0),
    [shape, setShape] = useState(0),
    [city, setCity] = useState(0),
    [text, setText] = useState(''),
    [strokes, setStrokes] = useState<CreationStroke[]>([]);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const drawing = useRef(false);
  useEffect(() => {
    if (data.item) {
      setColor(data.item.color);
      setShape(data.item.shape);
      setCity(data.item.city);
      setText(data.item.text);
      setStrokes(data.item.strokes);
    }
  }, [data.item?.revision]);
  const enabled = connected && room.state === 'running' && !g?.closed;
  async function act(body: CreationInput) {
    setBusy(true);
    setMessage('');
    try {
      await sendCreation(room.id, body);
      await client.invalidateQueries({ queryKey: ['create-self', room.id] });
      setMessage(
        body.action === 'place'
          ? '图块已正确拼合！'
          : body.action === 'claim'
            ? '已领取图块，90秒内完成位置匹配。'
            : '提交成功，文字和绘画将等待审核。'
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function point(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.round(Math.max(0, Math.min(1000, ((e.clientX - r.left) / r.width) * 1000))),
      y: Math.round(Math.max(0, Math.min(1000, ((e.clientY - r.top) / r.height) * 1000)))
    };
  }
  return (
    <section className={styles.panel}>
      <h3>{createGames[v].name} · 我的贡献</h3>
      <p>{enabled ? '现在可以参与' : g?.closed ? '本场已收官，作品保留' : '等待开场或恢复连接'}</p>
      {v === 'puzzle' ? (
        <>
          <Image
            unoptimized
            className={styles.reference}
            src={room.config.createImage ?? '/games/click/garden-bg-v1.png'}
            width={360}
            height={240}
            alt='拼图完整参考图'
          />
          {data.lease ? (
            <>
              <div
                className={styles.fragment}
                style={{
                  backgroundImage:
                    "url('" + (room.config.createImage ?? '/games/click/garden-bg-v1.png') + "')",
                  backgroundPosition:
                    ((data.lease.piece % 4) * 100) / 3 +
                    '% ' +
                    (Math.floor(data.lease.piece / 4) * 100) / 3 +
                    '%'
                }}
              />
              <p>对照原图，选择这块图片应该放入的位置（从左到右，从上到下）。</p>
              <div className={styles.tiles}>
                {Array.from({ length: 16 }, (_, i) => (
                  <button
                    key={i}
                    className={styles.tile}
                    aria-label={'放置到位置 ' + (i + 1)}
                    disabled={!enabled || busy || g?.pieces.includes(i)}
                    onClick={() => void act({ action: 'place', slot: i })}
                  >
                    {g?.pieces.includes(i) ? '已完成' : i + 1}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Button
              disabled={!enabled || busy || g?.pieces.length === 16}
              onClick={() => void act({ action: 'claim' })}
            >
              领取一块拼图
            </Button>
          )}
        </>
      ) : v === 'tree' ? (
        <>
          <div className={styles.controls}>
            {[
              ['seed', '播种'],
              ['water', '浇水'],
              ['feed', '施肥']
            ].map(([action, label]) => (
              <Button
                key={action}
                disabled={!enabled || busy || data.tree.includes(action)}
                onClick={() => void act({ action })}
              >
                {data.tree.includes(action) ? '已完成 · ' : ''}
                {label}
              </Button>
            ))}
          </div>
          <p>每人每种操作一次；先播种，再共同浇水、施肥。</p>
        </>
      ) : (
        <>
          {v === 'map' ? (
            <>
              <label htmlFor='creation-city'>选择来源城市</label>
              <select
                id='creation-city'
                value={city}
                disabled={!enabled || busy}
                onChange={(e) => setCity(Number(e.target.value))}
              >
                {creationCities.map((c, i) => (
                  <option key={c} value={i}>
                    {c}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label>选择颜色</label>
              <div className={styles.controls}>
                {creationColors.map((c, i) => (
                  <button
                    key={c}
                    className={styles.swatch}
                    aria-label={'颜色 ' + (i + 1)}
                    aria-pressed={color === i}
                    disabled={!enabled || busy}
                    style={{ background: c }}
                    onClick={() => setColor(i)}
                  />
                ))}
              </div>
              {!['draw'].includes(v) && (
                <>
                  <label htmlFor='creation-shape'>
                    {v === 'city' ? '建筑造型' : v === 'flowers' ? '花朵造型' : '图案造型'}
                  </label>
                  <select
                    id='creation-shape'
                    value={shape}
                    disabled={!enabled || busy}
                    onChange={(e) => setShape(Number(e.target.value))}
                  >
                    {(v === 'city'
                      ? ['温暖小屋', '缤纷高楼', '童话城堡']
                      : v === 'flowers'
                        ? ['五瓣花', '八瓣花', '圆瓣花']
                        : ['星芒', '爱心', '菱形']
                    ).map((s, i) => (
                      <option key={s} value={i}>
                        {s}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {['draw', 'scroll'].includes(v) && (
                <>
                  <label>我的画布 / 手绘签名（最多20笔、600点）</label>
                  <svg
                    className={styles.drawing}
                    viewBox='0 0 1000 1000'
                    aria-label='我的共创画布'
                    onPointerDown={(e) => {
                      if (
                        !enabled ||
                        busy ||
                        strokes.length >= 20 ||
                        strokes.reduce((n, s) => n + s.points.length, 0) >= 600
                      )
                        return;
                      drawing.current = true;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const p = point(e);
                      setStrokes((old) => [...old, { color, points: [p] }]);
                    }}
                    onPointerMove={(e) => {
                      if (!drawing.current) return;
                      const p = point(e);
                      setStrokes((old) => {
                        if (
                          !old.length ||
                          old[old.length - 1].points.length >= 80 ||
                          old.reduce((n, s) => n + s.points.length, 0) >= 600
                        )
                          return old;
                        return old.map((s, i) =>
                          i === old.length - 1 ? { ...s, points: [...s.points, p] } : s
                        );
                      });
                    }}
                    onPointerUp={() => {
                      drawing.current = false;
                    }}
                    onPointerCancel={() => {
                      drawing.current = false;
                    }}
                  >
                    {strokes.map((s, i) => (
                      <polyline
                        key={i}
                        points={s.points.map((p) => p.x + ',' + p.y).join(' ')}
                        fill='none'
                        stroke={creationColors[s.color]}
                        strokeWidth='18'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    ))}
                  </svg>
                  <div className={styles.controls}>
                    <Button
                      variant='outline'
                      disabled={!enabled || busy}
                      onClick={() => setStrokes((old) => old.slice(0, -1))}
                    >
                      撤销一笔
                    </Button>
                    <Button
                      variant='outline'
                      disabled={!enabled || busy}
                      onClick={() => setStrokes([])}
                    >
                      清空画布
                    </Button>
                  </div>
                </>
              )}
              <label htmlFor='creation-message'>祝福 / 作品名称（可选，60字以内）</label>
              <textarea
                id='creation-message'
                value={text}
                maxLength={60}
                disabled={!enabled || busy}
                onChange={(e) => setText(e.target.value)}
              />
            </>
          )}
          <div className={styles.controls}>
            <Button
              aria-busy={busy}
              disabled={!enabled || busy}
              onClick={() => void act({ action: 'submit', color, shape, city, text, strokes })}
            >
              {data.item ? '更新我的作品' : '提交我的作品'}
            </Button>
          </div>
          {data.item && (
            <p className={styles.status}>
              作品状态：
              {
                { pending: '等待审核', approved: '已公开', hidden: '已隐藏，请修改后重新提交' }[
                  data.item.status
                ]
              }{' '}
              · 修改后需重新审核
            </p>
          )}
        </>
      )}
      {message && <p role='status'>{message}</p>}
    </section>
  );
}

export function CreateAdmin({ room }: { room: LiveRoom }) {
  const { data } = useSuspenseQuery(creationAdminQuery(room.id)),
    client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function act(action: string, item?: CreationItem) {
    setBusy(true);
    setMessage('');
    try {
      await manageCreation(room.id, action, item);
      await client.invalidateQueries({ queryKey: ['create-admin', room.id] });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const active = ['running', 'paused'].includes(room.state),
    v = room.config.createVariant ?? 'puzzle';
  return (
    <section className={styles.panel}>
      <h3>群体共创控制</h3>
      <p>文字和绘画先审核再上屏。收官后停止玩家提交；烟花点火后作品锁定，可再次燃放同一批设计。</p>
      <div className={styles.controls}>
        <Button disabled={!active || busy || data.closed} onClick={() => void act('close')}>
          收官并锁定作品
        </Button>
        {v === 'fireworks' && (
          <Button disabled={!active || busy} onClick={() => void act('launch')}>
            {data.launchedAt ? '再次燃放烟花' : '点火 · 燃放全场烟花'}
          </Button>
        )}
        <Button
          variant='outline'
          onClick={() => {
            const blob = new Blob(
              [
                JSON.stringify(
                  { name: room.config.name, variant: v, artwork: room.game?.creation },
                  null,
                  2
                )
              ],
              { type: 'application/json' }
            );
            const url = URL.createObjectURL(blob),
              a = document.createElement('a');
            a.href = url;
            a.download = 'EventPlay-collective-artwork.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          导出共创作品数据
        </Button>
      </div>
      {message && <p role='alert'>{message}</p>}
      <div className={styles.review}>
        {Object.values(data.items).map((item) => (
          <article key={item.id}>
            <Artwork item={item} variant={v} />
            <p>
              {{ pending: '待审核', approved: '已公开', hidden: '已隐藏' }[item.status]} · 版本{' '}
              {item.revision}
            </p>
            <div className={styles.controls}>
              <Button
                disabled={!active || busy || !!data.launchedAt || item.status === 'approved'}
                onClick={() => void act('approve', item)}
              >
                通过作品
              </Button>
              <Button
                variant='outline'
                disabled={!active || busy || !!data.launchedAt || item.status === 'hidden'}
                onClick={() => void act('hide', item)}
              >
                隐藏作品
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
