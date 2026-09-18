import { useId } from 'react';
export function ControlObject({kind}:{kind:'coin'|'bomb'|'star'|'enemy'|'gate'|'chest'|'rock'}) {
  const id=useId();
  return <svg viewBox='0 0 100 100' role='img' aria-label={{coin:'金币',bomb:'炸弹',star:'星星',enemy:'敌机',gate:'旗门',chest:'宝箱',rock:'障碍'}[kind]}>
    <defs><linearGradient id={id} x2='0' y2='1'><stop stopColor='#fff3a8'/><stop offset='.5' stopColor='#ffd252'/><stop offset='1' stopColor='#d88c29'/></linearGradient></defs>
    {kind==='coin'?<><circle cx='50' cy='51' r='36' fill='#bf7b2c' stroke='#fff6c4' strokeWidth='4'/><circle cx='48' cy='47' r='31' fill={`url(#${id})`} stroke='#e9a630' strokeWidth='4'/><path d='m48 25 6 13 15 2-11 10 3 15-13-7-13 7 3-15-11-10 15-2Z' fill='#fff5bb' stroke='#d49025' strokeWidth='2'/></>
    :kind==='bomb'?<><path d='M55 24q10-18 19-9' fill='none' stroke='#ae7837' strokeWidth='6'/><path d='m76 6 3 7 8-1-6 6 4 7-9-4-6 6 1-9-7-4 9-1Z' fill='#ffb933'/><circle cx='48' cy='58' r='31' fill='#3c495a' stroke='#fff0c5' strokeWidth='4'/><ellipse cx='38' cy='43' rx='13' ry='8' fill='#8191a5' transform='rotate(-25 38 43)'/></>
    :kind==='star'?<path d='m50 8 13 26 29 4-21 22 5 30-26-14-26 14 5-30L8 38l29-4Z' fill={`url(#${id})`} stroke='#fff3be' strokeWidth='4'/>
    :kind==='gate'?<><path d='M19 90V15M81 90V15' stroke='#df5b48' strokeWidth='8'/><path d='M20 18h60v22H20Z' fill='#ffd979' stroke='white' strokeWidth='3'/><path d='m42 55 8 10 9-10M50 65v19' fill='none' stroke='#2f8b91' strokeWidth='6'/></>
    :kind==='chest'?<><path d='M15 40q0-25 35-25t35 25v42H15Z' fill='#b76a35' stroke='#fff2b0' strokeWidth='4'/><path d='M15 42h70M29 20v61M71 20v61' stroke='#ffd267' strokeWidth='7'/><rect x='41' y='43' width='18' height='23' rx='4' fill={`url(#${id})`}/><circle cx='50' cy='52' r='3' fill='#79422c'/></>
    :kind==='enemy'?<><ellipse cx='50' cy='59' rx='42' ry='17' fill='#bd83d6' stroke='#fff' strokeWidth='3'/><path d='M27 53q1-40 23-40t23 40Z' fill='#8ad1dc' stroke='#e8fcff' strokeWidth='3'/><path d='M41 26q7-7 17-4' fill='none' stroke='white' strokeWidth='5'/><circle cx='29' cy='61' r='5' fill='#ffe48b'/><circle cx='70' cy='61' r='5' fill='#ffe48b'/></>
    :<><path d='m13 68 9-35 25-20 27 13 17 34-12 23-48 4Z' fill='#9b958c' stroke='#fff2d5' strokeWidth='4'/><path d='m22 33 29 8 23-15-7 34-36 27 3-34Z' fill='#beb6a7'/><path d='m51 41 16 19 12 23-28-6Z' fill='#787b7b'/></>}
  </svg>;
}
