import type { SocialVariant } from '../api/social-games';
export function SocialArt({ variant, index = 0 }: { variant: SocialVariant; index?: number }) {
  const colors = ['#f3927d', '#78bfe2', '#a6cf81', '#c0a2e2', '#efba65', '#ecaac9'];
  return (
    <svg viewBox='0 0 180 145' aria-hidden='true'>
      <ellipse cx='90' cy='133' rx='68' ry='9' fill='#745236' opacity='.13' />
      {variant === 'cards' || variant === 'praise' ? (
        <>
          <rect
            x='28'
            y='39'
            width='124'
            height='86'
            rx='15'
            fill='#fff3ce'
            stroke='#dcad70'
            strokeWidth='5'
          />
          <path d='M31 47L90 91L149 47' fill='none' stroke={colors[index % 6]} strokeWidth='10' />
          <path
            d='M90 68C58 48 67 20 90 36C113 20 122 48 90 68Z'
            fill={colors[index % 6]}
            stroke='#fff4d2'
            strokeWidth='4'
          />
        </>
      ) : variant === 'story' || variant === 'truth' ? (
        <>
          <path
            d='M17 35Q55 13 90 35Q125 13 163 35V119Q125 99 90 120Q55 99 17 119Z'
            fill='#fff5d6'
            stroke='#dbae72'
            strokeWidth='5'
          />
          <path d='M90 36V117' stroke='#dbae72' strokeWidth='4' />
          {[55, 72, 89].map((y) => (
            <path
              key={y}
              d={'M32 ' + y + 'H72M108 ' + y + 'H148'}
              stroke={colors[index % 6]}
              strokeWidth='7'
              strokeLinecap='round'
            />
          ))}
        </>
      ) : variant === 'bingo' ? (
        <>
          {Array.from({ length: 9 }, (_, i) => (
            <rect
              key={i}
              x={29 + (i % 3) * 43}
              y={12 + Math.floor(i / 3) * 43}
              width='37'
              height='37'
              rx='10'
              fill={colors[(i + index) % 6]}
              stroke='#fff1c9'
              strokeWidth='4'
            />
          ))}
          <path
            d='M45 31L51 37L61 24M88 74L94 80L104 67M131 117L137 123L147 110'
            fill='none'
            stroke='white'
            strokeWidth='4'
            strokeLinecap='round'
          />
        </>
      ) : (
        <>
          {[0, 1].map((i) => (
            <g key={i} transform={'translate(' + i * 77 + ',0)'}>
              <path
                d='M17 123Q17 83 48 83Q79 83 79 123Z'
                fill={colors[(index + i) % 6]}
                stroke='#fff2cb'
                strokeWidth='4'
              />
              <circle cx='48' cy='58' r='31' fill='#ffe4b9' stroke='#fff5d2' strokeWidth='4' />
              <path
                d='M17 53Q21 8 52 28Q79 16 79 51Q63 37 51 42Q35 54 17 53'
                fill={colors[(index + i) % 6]}
              />
              <circle cx='38' cy='60' r='3' fill='#815433' />
              <circle cx='58' cy='60' r='3' fill='#815433' />
              <path
                d='M39 73Q48 81 57 73'
                fill='none'
                stroke='#b4754b'
                strokeWidth='3'
                strokeLinecap='round'
              />
            </g>
          ))}
          <path
            d='M76 107Q90 91 104 107'
            fill='none'
            stroke='#fff1c8'
            strokeWidth='10'
            strokeLinecap='round'
          />
          {variant === 'interest' ? (
            <path d='M90 43C63 25 72 3 90 17C108 3 117 25 90 43Z' fill='#ef998d' />
          ) : (
            <path
              d='M90 3L96 18L112 20L100 30L104 45L90 36L76 45L80 30L68 20L84 18Z'
              fill='#ffcf65'
              stroke='#fff1c8'
              strokeWidth='3'
            />
          )}
        </>
      )}
    </svg>
  );
}
