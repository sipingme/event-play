import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,configOf,validateConfig} from '../src/features/eventplay/api/service.ts';
test('八款控制模板、发布配置与类型验证',()=>{
  const games=templates.filter(t=>t.category==='控制');assert.equal(games.length,8);
  assert.equal(new Set(games.map(t=>t.controlVariant)).size,8);
  for(const t of games){const c=configOf({...t,participants:10,brand:'测试',logo:''});assert.equal(c.controlVariant,t.controlVariant);assert.deepEqual(validateConfig(c),[]);assert.ok(validateConfig({...c,mechanic:'race'}).includes('控制场景与玩法不匹配'));}
});
