'use client';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { LiveRoom } from '../api/realtime';
import { quizGames, type QuizVariant } from '../api/quiz-games';
import { ClickArt } from './click-art';
import styles from './quiz-scene.module.css';

const backgrounds:Record<QuizVariant,string> = {
  adventure:'/games/race/illustrated/yacht-bg-v2.png', boolean:'/games/click/stage-bg-v1.png', buzzer:'/games/click/carnival-bg-v1.png', race:'/games/race/stadium-cartoon-v2.png', picture:'/games/click/stage-bg-v1.png', clues:'/games/click/forest-bg-v1.png', tower:'/games/click/town-bg-v1.png', boss:'/games/click/forest-bg-v1.png'
};
export function QuizArtwork({variant,progress=0}:{variant:QuizVariant;progress?:number}) {
  if (variant==='boss'||variant==='tower') return <ClickArt variant={variant} progress={progress}/>;
  if (variant==='race') return <div className={styles.horse} />;
  return <div className={styles.emblem} aria-hidden='true'>{variant==='boolean'?'✓ / ✕':variant==='buzzer'?'!':variant==='picture'?'▧':variant==='clues'?'?':'★'}</div>;
}
export function QuizPoster({variant}:{variant:QuizVariant}) {
  return <div className={styles.poster} style={{backgroundImage:`url('${backgrounds[variant]}')`}}><QuizArtwork variant={variant} progress={.45}/><strong>{quizGames[variant].scene}</strong></div>;
}
export function QuizQuestion({room}:{room:LiveRoom}) {
  const q=room.game?.question;
  if (!q) return null;
  return <div className={styles.question}>
    <div className={styles.questionTop}><span>第 {(room.game?.index??0)+1} / {room.game?.total} 题</span><strong>{room.game?.seconds??0} 秒</strong></div>
    <h3>{q.text}</h3>
    {room.config.quizVariant==='picture'&&q.image&&<div className={styles.photo}><Image unoptimized src={q.image} alt='本题题图' fill sizes='600px' style={{objectFit:'contain',clipPath:`inset(0 ${[66,33,0][room.game?.revealStage??0]}% 0 0)`}}/><span>第 {(room.game?.revealStage??0)+1} 阶段揭图</span></div>}
    {!!q.clues?.length&&<ol className={styles.clues}>{q.clues.map((clue,i)=><li key={i}>线索 {i+1} · {clue}</li>)}</ol>}
  </div>;
}
export function QuizScene({room,compact=false}:{room:LiveRoom;compact?:boolean}) {
  const variant=room.config.quizVariant??'adventure';
  const info=quizGames[variant];
  const teams=room.config.teams.split(/[,，]/);
  const total=room.scores.reduce((a,b)=>a+b,0);
  const goal=room.config.goal??1000;
  const ended=['completed','aborted'].includes(room.state);
  const progress=Math.min(1,total/goal);
  const leader=Math.max(10,...room.scores);
  const phase={waiting:'等待主持人开场',running:'全场一起挑战',paused:'已暂停 · 等待继续',completed:'本轮挑战结束',aborted:'本轮已中止'}[room.state];
  return <section className={cn(styles.scene,compact&&styles.compact)} style={{backgroundImage:`url('${backgrounds[variant]}')`}} data-quiz-variant={variant}>
    <header><span>{room.config.brand||'EventPlay'} · {info.scene}</span><span>{room.playerCount??room.players.length} 人参与 · {phase}</span></header>
    <h2>{room.config.name}</h2><p className={styles.description}>{info.description}</p>
    <div className={styles.playfield}>
      <div className={styles.visual}>
        {variant==='race'?teams.map((team,i)=><div className={styles.lane} key={team}><span>{team}</span><div className={styles.runner} style={{left:`${Math.min(75,(room.scores[i]??0)/leader*75)}%`}}><QuizArtwork variant='race'/></div></div>):<QuizArtwork variant={variant} progress={progress}/>}
        {variant==='adventure'&&<div className={styles.map}>{Array.from({length:room.game?.total??3},(_,i)=><span key={i} data-done={i<(room.game?.reveals?.length??0)}>{i+1}</span>)}</div>}
        {variant==='boss'&&<div className={styles.coop}><strong>{ended?(room.state==='aborted'?'挑战中止':total>=goal?'全场协作成功！':'继续积累知识，下次再挑战！'):progress<.5?'第一阶段 · 破盾':'第二阶段 · 合力攻击'}</strong><progress max={goal} value={total}/><span>累计伤害 {total} / {goal}</span></div>}
        {variant==='buzzer'&&<p className={styles.buzz}>{room.game?.buzzer?`${room.players.find(p=>p.id===room.game?.buzzer)?.name??'玩家'} 获得作答资格`:'准备好，点击手机抢答！'}</p>}
      </div>
      <div className={styles.board}>{room.game?.question?<><QuizQuestion room={room}/><div className={styles.answers}>{room.game.question.options.map((o,i)=><div key={i}><b>{'ABCD'[i]}</b>{o}</div>)}</div><p>答对 +{room.game.points??10} 分 · 题目结束统一结算</p></>:<div className={styles.lobby}><strong>{phase}</strong><p>{ended?'感谢每一份智慧与参与':'手机扫码加入，主持人开始后作答。'}</p></div>}</div>
    </div>
    <div className={styles.scores}>{teams.map((team,i)=><div key={team}><strong>{team}</strong><span>{room.scores[i]??0} 分{variant==='tower'?` · ${Math.floor((room.scores[i]??0)/10)} 层`:''}</span><progress max={Math.max(goal,leader)} value={room.scores[i]??0}/></div>)}</div>
    {room.state==='completed'&&variant!=='boss'&&<div className={styles.reveals}><strong>本轮团队成绩 · 同分并列</strong>{teams.map((name,i)=>({name,score:room.scores[i]??0})).sort((a,b)=>b.score-a.score).map(team=><p key={team.name}>第 {1+room.scores.filter(score=>score>team.score).length} 名 · {team.name} · {team.score} 分</p>)}</div>}
    {!!room.game?.reveals?.length&&<div className={styles.reveals}>{(ended?room.game.reveals:room.game.reveals.slice(-1)).map(q=><p key={q.index}>第 {q.index+1} 题揭晓：{'ABCD'[q.correct]} · {q.answer}</p>)}</div>}
  </section>;
}
