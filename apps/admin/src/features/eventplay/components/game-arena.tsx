'use client';
import type { LiveRoom } from '../api/realtime';
import { QuizScene } from './quiz-scene';
import { DrawScene } from './draw-scene';
export function GameArena({room}:{room:LiveRoom}) {
  return room.config.mechanic==='quiz'?<QuizScene room={room}/>:<DrawScene room={room}/>;
}
