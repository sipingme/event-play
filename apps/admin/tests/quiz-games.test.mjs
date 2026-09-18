import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,configOf,validateConfig} from '../src/features/eventplay/api/service.ts';
test('八款知识问答可创建且快照保留题库、场景',()=>{
  const games=templates.filter(t=>t.mechanic==='quiz');
  assert.equal(games.length,8);
  assert.equal(new Set(games.map(t=>t.quizVariant)).size,8);
  assert.ok(games.find(t=>t.id==='quiz-space'));
  for(const t of games){
    const config=configOf({...t,participants:10,brand:'EventPlay',logo:''});
    assert.equal(config.quizVariant,t.quizVariant);
    assert.equal(config.quizText,t.quizText);
    assert.deepEqual(validateConfig(config),[],t.name);
  }
});
