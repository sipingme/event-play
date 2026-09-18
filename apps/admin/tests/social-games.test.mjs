import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,configOf,validateConfig} from '../src/features/eventplay/api/service.ts';
test('九款社交破冰具备独立示例和可发布配置',()=>{
 const items=templates.filter(t=>t.mechanic==='social');assert.equal(items.length,9);
 for(const t of items){const c=configOf({...t,participants:12,brand:'破冰',logo:''});assert.equal(c.socialVariant,t.socialVariant);assert.deepEqual(validateConfig(c),[],t.name);}
});
