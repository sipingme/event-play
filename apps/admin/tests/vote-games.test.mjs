import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,configOf,validateConfig} from '../src/features/eventplay/api/service.ts';
test('九款投票评分模板可配置，评分默认不实时公开',()=>{
 const items=templates.filter(t=>t.mechanic==='vote');assert.equal(items.length,9);
 for(const t of items){const c=configOf({...t,participants:10,brand:'演示',logo:''});assert.equal(c.voteVariant,t.voteVariant);assert.equal(c.voteOptions,t.voteOptions);assert.deepEqual(validateConfig(c),[],t.name);if(['score','proposal'].includes(t.voteVariant))assert.equal(c.voteLive,false);}
});
