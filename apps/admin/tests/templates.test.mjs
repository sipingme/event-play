import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,configOf,validateConfig} from '../src/features/eventplay/api/service.ts';
test('五种类型各有一个可创建的默认示例，摇动配置保留到快照',()=>{
  const examples=templates.filter(t=>t.featured);
  assert.equal(examples.length,5);
  assert.deepEqual(examples.map(t=>t.category),['摇一摇','滑屏','点击','手眼协调','控制']);
  for(const t of examples) {
    const config=configOf({...t,participants:10,brand:'Example',logo:''});
    assert.deepEqual(validateConfig(config),[]);
    if(t.id==='shake-race') assert.equal(config.inputMode,'shake');
  }
});
