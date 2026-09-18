import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,configOf,validateConfig} from '../src/features/eventplay/api/service.ts';
test('八款抽奖可配置且保留旧链接、场景与概率规则',()=>{
 const items=templates.filter(t=>t.mechanic==='draw');
 assert.equal(items.length,8);assert.ok(items.some(t=>t.id==='draw-gold'));
 for(const t of items){const c=configOf({...t,participants:10,brand:'演示',logo:''});assert.equal(c.drawVariant,t.drawVariant);assert.equal(c.drawRepeat,false);assert.deepEqual(validateConfig(c),[],t.name);}
});
