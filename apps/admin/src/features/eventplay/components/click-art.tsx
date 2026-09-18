'use client';
import { useId } from 'react';
import type { ClickVariant } from '../api/types';
import styles from './click-scene.module.css';

const asset=(name:string)=>`/games/click/${name}-v1.png`;
export const clickBackground:Record<ClickVariant,string>={
  tug:'/games/race/stadium-cartoon-v2.png',boss:asset('forest-bg'),balloon:asset('carnival-bg'),
  rocket:'/games/race/illustrated/rocket-bg-v2.png',flower:asset('garden-bg'),tower:asset('town-bg'),
  brand:asset('stage-bg'),popcorn:asset('carnival-bg')
};

// Sprite sheets stay intact; SVG viewports select their authored cells.
export function ClickArt({variant,progress=.45,color='#ee795a',balance=0}:{variant:ClickVariant;progress?:number;color?:string;balance?:number}) {
  const p=Math.max(0,Math.min(1,progress));
  const id=useId().replace(/:/g,'');const blue=id+'blue';
  const stage=p<.2?0:p<.55?1:2;
  const filter=(key:string,paint:string)=><filter id={key} x='0' y='0' width='100%' height='100%' colorInterpolationFilters='sRGB'>
    <feColorMatrix in='SourceGraphic' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3 -6 0 0 0' result='redMask'/>
    <feComposite in='redMask' in2='SourceAlpha' operator='in' result='mask'/>
    <feColorMatrix in='SourceGraphic' type='saturate' values='0' result='gray'/><feFlood floodColor={paint} result='paint'/>
    <feBlend in='gray' in2='paint' mode='screen' result='litPaint'/><feComposite in='litPaint' in2='mask' operator='in' result='colored'/>
    <feComposite in='SourceGraphic' in2='mask' operator='out' result='base'/><feComposite in='colored' in2='base' operator='over'/>
  </filter>;
  return <svg viewBox={variant==='tug'?'0 48 320 170':'0 0 320 230'} aria-hidden='true' className={styles.art} data-click-art={variant} data-art-progress={p} data-art-stage={variant==='flower'?stage:undefined}>
    <defs>{filter(id,color)}{filter(blue,'#439fda')}<clipPath id={id+'bucket'}><rect x='75' y='56' width='170' height='170'/></clipPath></defs>
    <ellipse cx='160' cy='213' rx='80' ry='8' fill='#79542822'/>
    {variant==='balloon'&&<g style={{transformOrigin:'160px 205px',transform:`translateY(${p>=1?-18:0}px) scale(${.4+p*.6})`,transition:'transform .5s'}}><image href={asset('balloon-sprite')} x='87' y='9' width='146' height='206' filter={`url(#${id})`}/></g>}
    {variant==='boss'&&<g style={{transformOrigin:'160px 190px',transform:p>=1?'rotate(14deg) scale(.8)':'none',transition:'transform .5s'}}><image href={asset('boss-sprite')} x='65' y='10' width='190' height='202'/>{p<.34&&<ellipse cx='160' cy='111' rx='112' ry='107' fill='#a6ecff22' stroke='#c4f4ff' strokeWidth='4' strokeDasharray='12 8'/>}{p>=1&&<text x='160' y='35' textAnchor='middle' fontSize='32' fill='#ffdf6e'>★ ★ ★</text>}</g>}
    {variant==='rocket'&&<g style={{transform:`translateY(${p>=1?-28:0}px)`,transition:'transform 1s'}}>{p>.65&&<path d='m145 173 15 49 15-49z' fill='#ffbe37' stroke='#ff8837' strokeWidth='5'/>}<image href='/games/race/illustrated/rocket-sprite-v2.png' x='92' y='13' width='136' height='180'/></g>}
    {variant==='flower'&&<svg style={{overflow:'hidden'}} x='55' y='5' width='210' height='210' viewBox={`${stage*724} 0 724 724`}><image href={asset('flower-sprite')} width='2172' height='724'/></svg>}
    {variant==='tower'&&<g filter={`url(#${id})`}>{Array.from({length:1+Math.floor(p*5)},(_,i)=><image key={i} data-floor={i} href={asset('tower-sprite')} x='45' y={163-i*29} width='230' height='67' preserveAspectRatio='none'/>)}</g>}
    {variant==='brand'&&<image href={asset('brand-sprite')} x='78' y='0' width='164' height='230' opacity={.35+p*.65}/>}
    {variant==='popcorn'&&<g><g clipPath={`url(#${id}bucket)`}><svg style={{overflow:'hidden'}} x='75' y='56' width='170' height='170' viewBox='0 0 887 887' filter={`url(#${id})`}><image href={asset('popcorn-sprite')} width='1774' height='887'/></svg></g>{p>0&&<svg style={{overflow:'hidden'}} data-popcorn-fill={p} x='87' y={87-p*47} width='146' height={20+p*69} viewBox='887 300 887 587' preserveAspectRatio='none'><image href={asset('popcorn-sprite')} width='1774' height='887'/></svg>}</g>}
    {variant==='tug'&&<g style={{transform:`translateX(${balance*22}px)`,transition:'transform .4s'}}><path d='M130 135H190' stroke='#a66c32' strokeWidth='5'/><image href={asset('tug-sprite')} x='0' y='64' width='153' height='145' preserveAspectRatio='xMidYMid meet'/><g transform='translate(320 0) scale(-1 1)'><image href={asset('tug-sprite')} x='0' y='64' width='153' height='145' preserveAspectRatio='xMidYMid meet' filter={`url(#${blue})`}/></g><path d='m160 129-7 24h14z' fill='#ec554c' stroke='#fff4cb' strokeWidth='2'/></g>}
  </svg>;
}
