import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createActivity,
  saveActivity,
  publishDemo,
  createRoom,
  commandRoom,
  getRoom,
  validateConfig,
  resetDemo
} from '../src/features/eventplay/api/service.ts';
import { hostChecks, hostCommand, updateHost } from '../src/features/eventplay/api/service.ts';
const store = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k)
  },
  configurable: true
});
const config = {
  name: '测试活动',
  description: '测试',
  mechanic: 'race',
  theme: 'gold',
  duration: 60,
  participants: 100,
  teams: 'A队,B队',
  brand: '测试品牌',
  logo: ''
};

test('发布快照不会被后续草稿修改污染，过期草稿拒绝保存', async () => {
  await resetDemo();
  const item = await createActivity(config);
  await publishDemo(item.id);
  const edited = await saveActivity(item.id, { ...config, name: '新草稿' }, item.revision);
  assert.equal(edited.release.config.name, '测试活动');
  await assert.rejects(saveActivity(item.id, config, item.revision), /其他页面修改/);
});
test('房间遵循阶段限制，暂停冻结，重复结束拒绝', async () => {
  await resetDemo();
  const item = await createActivity(config);
  await publishDemo(item.id);
  const room = await createRoom(item.id);
  assert.equal((await createRoom(item.id)).id, room.id);
  await assert.rejects(commandRoom(room.id, 'resume'), /当前阶段/);
  await commandRoom(room.id, 'start');
  const paused = await commandRoom(room.id, 'pause');
  assert.equal((await getRoom(room.id)).remaining, paused.remaining);
  assert.deepEqual((await getRoom(room.id)).scores, paused.scores);
  await commandRoom(room.id, 'finish');
  await assert.rejects(commandRoom(room.id, 'finish'), /当前阶段/);
  assert.notEqual((await createRoom(item.id)).id, room.id);
});
test('错误人数、时长和拔河队伍数不能发布', () => {
  assert.equal(validateConfig(config).length, 0);
  assert.ok(validateConfig({ ...config, participants: 0 }).length);
  assert.ok(validateConfig({ ...config, duration: NaN }).length);
  assert.ok(validateConfig({ ...config, mechanic: 'tug', teams: 'A,B,C' }).length);
});

test('主持人开场检查、遮罩、阶段限制和记录', async () => {
  await resetDemo();
  const item = await createActivity(config);
  await publishDemo(item.id);
  const room = await createRoom(item.id);
  await assert.rejects(hostCommand(room.id, 'start'), /全部开场检查/);
  await assert.rejects(updateHost(room.id, { check: 'unknown', checked: true }), /未知/);
  for (const check of hostChecks) await updateHost(room.id, { check: check.id, checked: true });
  await hostCommand(room.id, 'start');
  await updateHost(room.id, { blackout: true });
  assert.equal((await getRoom(room.id)).state, 'running');
  assert.equal((await getRoom(room.id)).host.blackout, true);
  await assert.rejects(updateHost(room.id, { check: 'screen', checked: false }), /开场后/);
  await hostCommand(room.id, 'pause');
  await updateHost(room.id, { blackout: false });
  assert.equal((await getRoom(room.id)).state, 'paused');
  assert.equal((await getRoom(room.id)).host.blackout, false);
  await hostCommand(room.id, 'finish');
  assert.equal((await getRoom(room.id)).host.log[0].text, '结束并结算');
  const next = await createRoom(item.id);
  assert.equal(next.host, undefined);
});
