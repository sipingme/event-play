import test from 'node:test';
import assert from 'node:assert/strict';
import { templates } from '../src/features/eventplay/api/service.ts';
import { catalogCategories, catalogMembership, legacyTemplateIds, plannedGames, visibleTemplates } from '../src/features/eventplay/api/template-catalog.ts';

test('全部分类覆盖现有和规划玩法，旧模板保持可解析', () => {
  const ready = visibleTemplates(templates);
  assert.equal(catalogCategories.length, 11);
  assert.equal(new Set(ready.map(t => t.id)).size, ready.length);
  for (const t of ready) for (const c of catalogMembership(t)) assert.ok(catalogCategories.includes(c), t.id);
  for (const id of legacyTemplateIds) assert.ok(templates.some(t => t.id === id));
  assert.equal(ready.length + legacyTemplateIds.size, templates.length);
  assert.ok(catalogMembership(ready.find(t => t.id === 'quiz-space')).includes('知识答题'));
  assert.ok(catalogMembership(ready.find(t => t.id === 'click-brand')).includes('群体共创'));
});
test('规划不混入可创建模板，每项具备独立标识与分类', () => {
  assert.equal(plannedGames.length, 0);
  assert.equal(new Set(plannedGames.map(t => t.id)).size, plannedGames.length);
  for (const t of plannedGames) {
    assert.equal(t.status, 'planned');
    assert.ok(catalogCategories.includes(t.category));
    assert.ok(!templates.some(ready => ready.id === t.id));
  }
  assert.equal(templates.find(t => t.id === 'create-puzzle').category, '群体共创');
});
