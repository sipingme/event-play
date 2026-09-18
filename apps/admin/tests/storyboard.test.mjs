import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultStoryboard, storyboardErrors, connectionError, storyOrder } from '../src/features/eventplay/api/storyboard.ts';
import { configOf, templates, validateConfig } from '../src/features/eventplay/api/service.ts';

test('race creator appearance survives snapshot and rejects unknown assets', () => {
  const config = configOf({ ...templates[0], raceBackdrop: 'night', raceHorse: 'purple' });
  assert.equal(config.raceBackdrop, 'night');
  assert.equal(config.raceHorse, 'purple');
  assert.ok(validateConfig({ ...config, raceBackdrop: 'arbitrary' }).includes('赛场背景氛围无效'));
  assert.equal(configOf(templates[0]).raceHorse, 'team');
});

test('participation modes survive snapshots and do not introduce a solo mode', () => {
  const config = configOf({ ...templates[0], participationMode:'individual', teamAssignment:'balanced' });
  assert.equal(config.participationMode, 'individual');
  assert.equal(config.teamAssignment, 'balanced');
  assert.ok(validateConfig({...config, participants:21}).includes('个人赛最多支持20人'));
  assert.ok(!validateConfig({...config, participants:20}).includes('个人赛最多支持20人'));
  assert.equal(configOf(templates[0]).participationMode, 'team');
  assert.ok(validateConfig({...config, participationMode:'solo'}).includes('参与模式无效'));
  assert.ok(validateConfig({...config, mechanic:'quiz'}).includes('个人赛目前仅支持竞速游戏'));
});

test('default horse story is connected and order follows edges rather than array order', () => {
  const board = defaultStoryboard();
  assert.deepEqual(storyboardErrors(board), []);
  board.nodes.reverse();
  assert.deepEqual(storyOrder(board).map(n => n.kind), ['gather', 'teams', 'countdown', 'race', 'awards']);
});
test('reject self, occupied ports, reverse edges and disconnected publication', () => {
  const board = defaultStoryboard();
  assert.ok(connectionError(board, 'node-race', 'node-race'));
  assert.ok(connectionError(board, 'node-gather', 'node-race'));
  const disconnected = { ...board, edges: [] };
  assert.ok(connectionError(disconnected, 'node-awards', 'node-race'));
  assert.ok(storyboardErrors(disconnected).length);
});
test('configuration snapshots preserve storyboard without shared references', () => {
  const original = { ...templates[0], storyboard: defaultStoryboard() };
  const snapshot = configOf(original);
  assert.deepEqual(snapshot.storyboard, original.storyboard);
  snapshot.storyboard.nodes[0].title = 'Changed';
  assert.notEqual(original.storyboard.nodes[0].title, 'Changed');
});
