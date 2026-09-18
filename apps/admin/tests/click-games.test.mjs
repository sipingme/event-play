import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,configOf,validateConfig} from '../src/features/eventplay/api/service.ts';
test('点击类九个示例，八款新场景快照与规则匹配',()=>{
  const clicks=templates.filter(t=>t.category==='点击');
  assert.equal(clicks.length,9);
  for(const t of clicks.filter(t=>t.clickVariant)){
    const c=configOf({...t,participants:20,brand:'测试',logo:''});
    assert.equal(c.clickVariant,t.clickVariant);
    assert.equal(c.goal,200);
    assert.deepEqual(validateConfig(c),[]);
    assert.ok(validateConfig({...c,inputMode:'shake'}).length);
    assert.ok(validateConfig({...c,mechanic:'quiz'}).length);
  }
});
