'use client';
import { useId } from 'react';
import type { RaceVariant } from '../api/types';

export const raceNames: Record<RaceVariant,string> = {horse:'欢乐赛马',yacht:'碧海游艇',car:'城市赛车',motorbike:'公路摩托',spaceship:'星际飞船',rocket:'火箭升空',penguin:'企鹅滑雪',balloon:'热气球',dragonboat:'龙舟竞渡',bicycle:'自行车冲刺',climb:'步步高升'};
export const raceColors: Record<RaceVariant,string> = {horse:'#bce9fa',yacht:'#9ae6f5',car:'#bcdde7',motorbike:'#e2ead1',spaceship:'#142547',rocket:'#283958',penguin:'#d9f4fa',balloon:'#ffe0cb',dragonboat:'#9ae6f5',bicycle:'#bcdde7',climb:'#bce9fa'};
export const raceAsset = (variant: RaceVariant, kind: 'bg' | 'sprite') =>
  `/games/race/illustrated/${kind === 'bg' && variant === 'dragonboat' ? 'yacht' : kind === 'bg' && variant === 'bicycle' ? 'car' : variant}-${kind}-v2.png`;

// Only saturated red paint is recolored: glass, ivory, outlines and skin retain
// their original art direction. Unique filter IDs also work in repeated cards.
export function RaceVehicle({variant,color='#ce3035'}:{variant:RaceVariant;color?:string}) {
  const id = useId().replace(/:/g, '');
  const recolor = color !== '#ce3035' && color !== '#e6504d';
  return <svg viewBox='0 0 180 110' data-race-vehicle={variant} aria-hidden='true' style={{width:'100%',height:'100%',overflow:'visible'}}>
    {recolor && <defs><filter id={id} x='0' y='0' width='100%' height='100%' colorInterpolationFilters='sRGB'>
      <feColorMatrix in='SourceGraphic' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3 -6 0 0 0' result='redMask'/>
      <feComposite in='redMask' in2='SourceAlpha' operator='in' result='mask'/>
      <feColorMatrix in='SourceGraphic' type='saturate' values='0' result='gray'/>
      <feFlood floodColor={color} result='paint'/>
      <feBlend in='gray' in2='paint' mode='screen' result='litPaint'/>
      <feComposite in='litPaint' in2='mask' operator='in' result='colored'/>
      <feComposite in='SourceGraphic' in2='mask' operator='out' result='base'/>
      <feComposite in='colored' in2='base' operator='over'/>
    </filter></defs>}
    <image href={raceAsset(variant,'sprite')} width='180' height='110' preserveAspectRatio='xMidYMax meet' filter={recolor ? `url(#${id})` : undefined}/>
  </svg>;
}

export function RaceLandscape({variant}:{variant:RaceVariant}) {
  return <svg viewBox='0 0 1600 900' preserveAspectRatio='none' aria-hidden='true' style={{width:'100%',height:'100%'}}>
    <image href={raceAsset(variant,'bg')} width='1600' height='900' preserveAspectRatio='xMidYMid slice'/>
  </svg>;
}
