'use client';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { hitLiveRoom, type LiveRoom } from '../api/realtime';
import { CoordinationPanel, CoordinationShell } from './coordination-panel';
import styles from './coordination.module.css';
export function ReactionPanel(props:{room:LiveRoom;playerId?:string;connected:boolean}) {
  if(props.room.config.reactionVariant && props.room.config.reactionVariant!=='mole') return <CoordinationPanel {...props}/>;
  return <MolePanel {...props}/>;
}
function MolePanel({room,playerId,connected}:{room:LiveRoom;playerId?:string;connected:boolean}) {
  const pending=useRef(false);
  const [attempted,setAttempted]=useState(-1);
  const [notice,setNotice]=useState('');
  const index=room.game?.index??0;
  const active=room.state==='running'&&connected;
  async function hit(cell:number) {
    if(!active||pending.current||attempted===index)return;
    pending.current=true;setAttempted(index);setNotice('正在判定…');
    try { const result=await hitLiveRoom(room.id,index,cell);setNotice(result.accepted?'命中！+1 分':'没打中，下一轮看准再出手！'); }
    catch(e){setNotice((e as Error).message);}finally{pending.current=false;}
  }
  return <CoordinationShell room={room} playerId={playerId} connected={connected}>
    <div className={styles.moles}>
      {Array.from({length:9},(_,cell)=><button key={cell} aria-label={`洞口 ${cell+1}`} data-target={room.game?.cell===cell} disabled={!playerId||!active||attempted===index} onClick={()=>void hit(cell)} className={styles.hole}>
        {room.game?.cell===cell&&<Image unoptimized src='/games/coordination/mole-v1.png' alt='' width={150} height={150}/>}
      </button>)}
    </div>
    {playerId&&<p role='status' className={styles.instructions}>{attempted===index?notice:active?'小地鼠出现了，点击它！':'等待开场'}</p>}
  </CoordinationShell>;
}
