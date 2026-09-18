import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,configOf,validateConfig} from '../src/features/eventplay/api/service.ts';
test('九款群体共创具备独立示例和有效配置',()=>{
 const items=templates.filter(t=>t.mechanic==='create');assert.equal(items.length,9);
 for(const t of items){const c=configOf({...t,participants:10,brand:'共创',logo:''});assert.equal(c.createVariant,t.createVariant);assert.deepEqual(validateConfig(c),[],t.name);}
});
