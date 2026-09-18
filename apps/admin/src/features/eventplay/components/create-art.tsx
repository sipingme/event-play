'use client';
import { useEffect, useState } from 'react';
import {
  creationColors,
  type CreationStroke,
  type CreationItem,
  type CreateVariant
} from '../api/create-games';
export function Sketch({ strokes }: { strokes: CreationStroke[] }) {
  return (
    <svg viewBox='0 0 1000 1000' aria-label='共创笔迹'>
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
  );
}
export function CreationArt({
  variant,
  color = 0,
  shape = 0
}: {
  variant: CreateVariant;
  color?: number;
  shape?: number;
}) {
  const c = creationColors[color];
  return (
    <svg viewBox='0 0 120 120' aria-hidden='true'>
      <ellipse cx='60' cy='111' rx='40' ry='6' fill='#60451f' opacity='.12' />
      {variant === 'tree' ? (
        <>
          <path
            d='M60 108V50M60 80L35 60M60 70L85 45'
            stroke='#a87445'
            strokeWidth='12'
            fill='none'
            strokeLinecap='round'
          />
          <circle cx='35' cy='48' r='25' fill='#86c985' stroke='#fff0c5' strokeWidth='4' />
          <circle cx='83' cy='45' r='28' fill='#a3d883' stroke='#fff0c5' strokeWidth='4' />
          <circle cx='57' cy='29' r='27' fill={c} stroke='#fff0c5' strokeWidth='4' />
        </>
      ) : variant === 'fireworks' ? (
        <>
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d='M60 14V35'
              transform={'rotate(' + i * 30 + ' 60 60)'}
              stroke={creationColors[i % 6]}
              strokeWidth='8'
              strokeLinecap='round'
            />
          ))}
          <circle cx='60' cy='60' r='15' fill='#ffdb71' />
        </>
      ) : variant === 'city' ? (
        <>
          <path
            d={
              shape === 0
                ? 'M25 48L60 17L95 48Z'
                : shape === 1
                  ? 'M30 28L60 12L90 28Z'
                  : 'M20 38L60 8L100 38Z'
            }
            fill={c}
            stroke='#fff0c5'
            strokeWidth='5'
          />
          <rect
            x={shape === 1 ? 32 : 23}
            y={shape === 1 ? 28 : 45}
            width={shape === 1 ? 56 : 74}
            height={shape === 1 ? 79 : 62}
            rx='8'
            fill={c}
            stroke='#fff0c5'
            strokeWidth='5'
          />
          {[42, 76].map((x) =>
            [55, 78].map((y) => (
              <rect key={x + y} x={x - 7} y={y} width='13' height='12' rx='3' fill='#fff6cd' />
            ))
          )}
          <rect x='54' y='87' width='13' height='23' rx='4' fill='#ae784b' />
        </>
      ) : variant === 'flowers' ? (
        <>
          <path
            d='M60 105V52M60 87Q30 56 30 80Q40 99 60 95M60 80Q94 51 90 77Q81 91 60 88'
            fill='#71bd7b'
            stroke='#539d61'
            strokeWidth='5'
          />
          {Array.from({ length: shape === 1 ? 8 : 5 }, (_, i) => (
            <ellipse
              key={i}
              cx='60'
              cy='28'
              rx={shape === 2 ? 19 : 13}
              ry='22'
              fill={c}
              stroke='#fff3c6'
              strokeWidth='3'
              transform={'rotate(' + (i * 360) / (shape === 1 ? 8 : 5) + ' 60 49)'}
            />
          ))}
          <circle cx='60' cy='49' r='15' fill='#ffe084' />
        </>
      ) : variant === 'puzzle' ? (
        <path
          d='M23 23H47Q38 4 60 4Q82 4 73 23H98V49Q117 40 117 62Q117 84 98 75V100H73Q82 80 60 80Q38 80 47 100H23Z'
          fill={c}
          stroke='#fff0c5'
          strokeWidth='5'
        />
      ) : variant === 'draw' || variant === 'scroll' ? (
        <>
          <rect
            x='17'
            y='15'
            width='86'
            height='91'
            rx='13'
            fill='#fff6d7'
            stroke='#e4b478'
            strokeWidth='5'
          />
          <path
            d='M30 80Q40 28 57 64T92 37'
            fill='none'
            stroke={c}
            strokeWidth='9'
            strokeLinecap='round'
          />
          <path d='M80 78L103 38L110 43L87 83L76 91Z' fill='#72bba7' />
        </>
      ) : variant === 'map' ? (
        <>
          <path
            d='M16 27L43 15L77 29L105 17V92L77 104L43 90L16 103Z'
            fill='#a8d9b3'
            stroke='#fff3d0'
            strokeWidth='5'
          />
          <path
            d='M60 90Q20 50 40 29Q60 10 80 29Q100 50 60 90'
            fill={c}
            stroke='#fff3d0'
            strokeWidth='4'
          />
          <circle cx='60' cy='45' r='11' fill='#fff5cf' />
        </>
      ) : (
        <path
          d={
            shape === 1
              ? 'M60 98C-10 55 18 1 60 32C102 1 130 55 60 98Z'
              : shape === 2
                ? 'M60 8L105 60L60 110L15 60Z'
                : 'M60 8L75 40L111 45L85 70L91 106L60 88L29 106L35 70L9 45L45 40Z'
          }
          fill={c}
          stroke='#fff3c6'
          strokeWidth='5'
        />
      )}
    </svg>
  );
}
export function Fireworks({
  items,
  at,
  serverTime,
  frozen
}: {
  items: CreationItem[];
  at: number | null;
  serverTime: number;
  frozen: boolean;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, []);
  const [clock, setClock] = useState(() => ({ server: serverTime, local: Date.now() }));
  useEffect(() => setClock({ server: serverTime, local: Date.now() }), [serverTime]);
  const elapsed = at ? clock.server + (frozen ? 0 : (Date.now() - clock.local) / 1000) - at : 0;
  return (
    <svg viewBox='0 0 1000 500' aria-label='全场定制烟花' data-frame={tick % 2}>
      {items.map((item, i) => {
        const t = elapsed - (i * 0.08 + 1),
          progress = Math.min(1, Math.max(0, t / 2));
        const x = 90 + ((i * 137) % 820),
          y = 90 + ((i * 83) % 270);
        return (
          <g key={item.id} opacity={!at ? 0 : t >= 0 && t < 3 ? 1 - progress * 0.7 : 0}>
            {Array.from({ length: 16 }, (_, j) => {
              const a = (j * Math.PI) / 8;
              const radius = progress * 65;
              let dx = Math.cos(a) * radius,
                dy = Math.sin(a) * radius;
              if (item.shape === 1) {
                dx = (16 * Math.pow(Math.sin(a), 3) * radius) / 16;
                dy =
                  (-(
                    13 * Math.cos(a) -
                    5 * Math.cos(2 * a) -
                    2 * Math.cos(3 * a) -
                    Math.cos(4 * a)
                  ) *
                    radius) /
                  16;
              }
              if (item.shape === 2) {
                dx *= j % 2 ? 0.45 : 1;
                dy *= j % 2 ? 0.45 : 1;
              }
              return (
                <circle
                  key={j}
                  cx={x + dx}
                  cy={y + dy}
                  r={5 - progress * 2}
                  fill={creationColors[item.color]}
                />
              );
            })}
          </g>
        );
      })}
      {!at && (
        <text x='500' y='240' textAnchor='middle' fill='#fff0ba' fontSize='30'>
          等待主持人点火 · 已收集 {items.length} 份设计
        </text>
      )}
      {at && elapsed > items.length * 0.08 + 4 && (
        <text x='500' y='240' textAnchor='middle' fill='#fff0ba' fontSize='30'>
          我们的烟花秀 · 圆满绽放
        </text>
      )}
    </svg>
  );
}
