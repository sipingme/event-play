'use client';
import Image from 'next/image';
import {useState} from 'react';
import {useQueryClient,useSuspenseQuery} from '@tanstack/react-query';
import {Button} from '@/components/ui/button';
import type {LiveRoom} from '../api/realtime';
import {voteGames,type VoteVariant} from '../api/vote-games';
import {sendBallot,voteSelfQuery,voteCommand} from '../api/vote-service';
import styles from './vote-scene.module.css';
export function VotePoster({variant}:{variant:VoteVariant}){return <div className={styles.poster} style={{backgroundImage:`url('${voteGames[variant].background}')`}}><span>{voteGames[variant].symbol}</span></div>}
export function VoteScene({room}:{room:LiveRoom}){
 const v=room.config.voteVariant??'poll';const info=voteGames[v];const g=room.game;
 const rating=['score','proposal'].includes(v);const rows=g?.results;
 const opts=g?.options??room.config.voteOptions?.split('\n')??info.options.split('\n');
 const max=Math.max(1,...(rows??[]).map(r=>r.count));const images=room.config.voteImages?.split('\n')??[];
 return <section className={styles.scene} data-vote-variant={v} style={{backgroundImage:`url('${info.background}')`}}><header><span>{room.config.brand||'EventPlay'} · 一起做选择</span><span>第 {(g?.round??0)+1} 轮 · {g?.voters??0} 人已提交</span></header><h2>{info.name}</h2><p className={styles.caption}>{g?.finished?'本场已决出结果':room.state==='waiting'?'等待主持人开场':room.state==='paused'?'活动暂停':g?.closed?'本轮已截止':'本轮开放中'} · {rating?'每项1～5分':'每轮选择一项'}</p><h3 className={styles.title}>{g?.title??room.config.name}</h3>
 {g?.finished&&v==='bracket'?<div className={styles.champion}>♛<strong>冠军 · {opts[0]}</strong></div>:<div className={styles.options}>{opts.map((option,i)=>{const r=rows?.[i];return <article key={option}>{v==='product'&&images[i]&&<Image unoptimized src={images[i]} width={220} height={140} alt={option}/>}<span className={styles.mark}>{v==='satisfaction'?['☺','◡','—','◠','☹'][i]:v==='bracket'?'⚑':String.fromCharCode(65+i)}</span><strong>{option}</strong><div className={styles.value}>{!r?'等待揭晓':rating?r.count?`${(r.total/r.count).toFixed(2)} 分`:'暂无评分':`${r.count} 票`}</div>{r&&<><progress max={rating?5:max} value={rating?r.count?r.total/r.count:0:r.count}/><small>{rating?`${r.count} 人评分`:`占本轮投票 ${g?.voters?Math.round(r.count/g.voters*100):0}%`}</small></>}</article>;})}</div>}
 {v==='stance'&&rows&&<div className={styles.balance} style={{transform:`rotate(${((rows[1]?.count??0)-(rows[0]?.count??0))/Math.max(1,g?.voters??0)*12}deg)`}}>● ━━━━━━━━━ ●</div>}
 {!!g?.history?.length&&<div className={styles.history}><strong>{v==='story'?'共同选择的旅程':'已完成轮次'}</strong>{g.history.map(h=><p key={h.round}>第 {h.round+1} 轮 · {h.title} · {h.results.map(r=>`${r.label} ${h.rating?(r.count?(r.total/r.count).toFixed(2)+'分':'暂无评分'):r.count+'票'}`).join(' / ')}</p>)}</div>}
 <footer>服务端计票 · {room.config.voteChange?'截止前允许修改':'提交后不可修改'} · 游客身份不等于实名一人一票</footer></section>;
}
export function VotePlayer({room,connected}:{room:LiveRoom;connected:boolean}){
 const {data}=useSuspenseQuery(voteSelfQuery(room.id));const client=useQueryClient();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const g=room.game;const rating=['score','proposal'].includes(room.config.voteVariant??'');
 const ballot=data.round===g?.round?data.ballot:{};const enabled=connected&&room.state==='running'&&!g?.closed&&!g?.finished;
 async function send(choice:number,score=1){setBusy(true);setMessage('');try{await sendBallot(room.id,g?.round??0,choice,score);await client.invalidateQueries({queryKey:['vote-self',room.id]});setMessage('提交成功，已由服务器记录。');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className={styles.player}><h2>{g?.title??room.config.name}</h2><p>第 {(g?.round??0)+1} 轮 · {enabled?'可以提交':g?.finished?'活动结果已产生':'等待开放或下一轮'}</p>{(g?.options??[]).map((label,i)=><article key={label}><strong>{label}</strong>{room.config.voteVariant==='product'&&room.config.voteImages?.split('\n')[i]&&<Image unoptimized src={room.config.voteImages.split('\n')[i]} alt={label} width={200} height={120}/>}<div className={styles.controls}>{rating?[1,2,3,4,5].map(score=><Button key={score} aria-label={`${label} ${score}分`} variant={ballot[String(i)]===score?'default':'outline'} disabled={!enabled||busy||(!room.config.voteChange&&String(i) in ballot)} onClick={()=>void send(i,score)}>{score} ★</Button>):<Button disabled={!enabled||busy||(!room.config.voteChange&&Object.keys(ballot).length>0)} onClick={()=>void send(i)}>{String(i) in ballot?'已选择':'选择'} · {label}</Button>}</div></article>)}<p>{rating?'可分别为每一项评分。':'每轮一票。'}{room.config.voteChange?'截止前可修改。':'提交后不可修改。'}</p>{message&&<p role='status'>{message}</p>}</section>;
}
export function VoteAdmin({room}:{room:LiveRoom}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const g=room.game;
 const active=['running','paused'].includes(room.state);
 async function act(action:string){setBusy(true);setError('');try{await voteCommand(room.id,g?.round??0,action);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className={styles.admin}><h3>投票轮次控制</h3><p>截止后停止接收，揭晓后才能进入下一轮。剧情／淘汰赛平票时请选择加赛。</p><div className={styles.controls}><Button disabled={!active||busy||g?.closed||g?.finished} onClick={()=>void act('close')}>截止本轮</Button><Button disabled={!active||busy||!g?.closed||g?.voteRevealed} onClick={()=>void act('reveal')}>揭晓本轮</Button><Button disabled={!active||busy||!g?.voteRevealed||g?.finished} onClick={()=>void act('next')}>进入下一轮 / 推进剧情</Button><Button variant='outline' disabled={!active||busy||!g?.voteRevealed||g?.finished} onClick={()=>void act('runoff')}>本题加赛</Button><Button variant='outline' disabled={!g?.results} onClick={()=>{
  const blob=new Blob([JSON.stringify({roomId:room.id,config:{variant:room.config.voteVariant,allowChange:room.config.voteChange,live:room.config.voteLive},current:{round:g?.round,results:g?.results,voters:g?.voters},history:g?.history},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='EventPlay-votes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }}>导出投票结果</Button></div>{error&&<p role='alert'>{error}</p>}</section>;
}
