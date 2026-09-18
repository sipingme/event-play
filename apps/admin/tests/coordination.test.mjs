import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,configOf,validateConfig} from '../src/features/eventplay/api/service.ts';
test('八种手眼协调模板和发布快照',()=>{
  const games=templates.filter(t=>t.category==='手眼协调');
  assert.equal(games.length,8);
  assert.equal(new Set(games.map(t=>t.reactionVariant??'mole')).size,8);
  for(const game of games){const config=configOf({...game,participants:10,brand:'测试',logo:''});assert.deepEqual(validateConfig(config),[]);assert.equal(config.reactionVariant,game.reactionVariant);}
});
