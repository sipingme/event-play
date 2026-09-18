import test from 'node:test';
import assert from 'node:assert/strict';
import {detectSwipe} from '../src/features/eventplay/api/swipe.ts';
import {templates,configOf,validateConfig} from '../src/features/eventplay/api/service.ts';
test('滑屏方向、最小距离、超时与斜向判定',()=>{
  assert.equal(detectSwipe(0,-60,100,'up'),'swipe-up');
  assert.equal(detectSwipe(0,60,100,'down'),'swipe-down');
  assert.equal(detectSwipe(-60,0,100,'alternating'),'swipe-left');
  assert.equal(detectSwipe(60,0,100,'alternating'),'swipe-right');
  for(const [x,y,t,d] of [[0,60,100,'up'],[0,-60,100,'down'],[0,47,100,'down'],[60,60,100,'alternating'],[0,-60,2000,'up'],[0,0,10,'up']]) assert.equal(detectSwipe(x,y,t,d),null);
});
test('四种滑屏示例可保存配置，品牌拼图未混入',()=>{
  const examples=templates.filter(t=>t.category==='滑屏');
  assert.equal(examples.length,4);
  for(const t of examples){const c=configOf({...t,participants:10,brand:'Test',logo:''});assert.deepEqual(validateConfig(c),[]);if(t.mechanic==='race'){assert.equal(c.inputMode,'swipe');assert.equal(c.swipeDirection,t.swipeDirection);assert.equal(c.raceVariant,t.raceVariant);}}
  assert.equal(examples.some(t=>t.name.includes('拼图')),false);
});
