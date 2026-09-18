import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,configOf,validateConfig} from '../src/features/eventplay/api/service.ts';
test('九款签到场景和新星空玩法可创建且保存配置',()=>{
 const items=templates.filter(t=>t.mechanic==='wall');assert.equal(items.length,9);assert.ok(items.some(t=>t.wallVariant==='stars'));
 for(const t of items){const config=configOf({...t,participants:10,brand:'品牌',logo:''});assert.equal(config.wallVariant,t.wallVariant);assert.deepEqual(validateConfig(config),[],t.name);}
});
