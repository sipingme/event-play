import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT_KEY, accountMode, creatorLink, hostStorageKey } from '../src/features/eventplay/api/account.ts';
import { cloudToken, listActivities, getBrand, templates, configOf } from '../src/features/eventplay/api/service.ts';
import { enterActivityRoom } from '../src/features/eventplay/api/realtime.ts';

test('账号请求走同源 Cookie BFF，失效时不回退本地或旧密钥', async () => {
  const previous = { fetch: globalThis.fetch, window: globalThis.window, localStorage: globalThis.localStorage };
  const values = new Map([['eventplay.workspace.token', 'legacy-secret'], ['eventplay.activities.v1', '[{"name":"legacy"}]']]);
  globalThis.window = { location: { protocol: 'https:', origin: 'https://example.test' } };
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try {
    assert.equal(accountMode(), false);
    assert.match(creatorLink('shake-race'), /^\/login\?next=/);
    values.set(ACCOUNT_KEY, 'user-a');
    assert.equal(cloudToken(), 'account-session');
    assert.equal(creatorLink('shake-race'), '/dashboard/activities/new?template=shake-race');
    assert.equal(hostStorageKey('room'), 'eventplay.account-host.user-a.room');
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push(url);
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.cache, 'no-store');
      return new Response(JSON.stringify(url.endsWith('/brand') ? { name: '私有品牌' } : []));
    };
    assert.deepEqual(await listActivities(), []);
    assert.equal((await getBrand()).name, '私有品牌');
    assert.deepEqual(calls, ['/api/eventplay-workspace/activities', '/api/eventplay-auth/brand']);
    globalThis.fetch = async () => new Response('<!DOCTYPE html><html>Not found</html>', { status: 404, headers: { 'Content-Type': 'text/html' } });
    await assert.rejects(() => listActivities(), /账号接口返回异常（HTTP 404）/);
    globalThis.fetch = async () => new Response(JSON.stringify({detail:'登录已过期'}), { status: 401 });
    await assert.rejects(() => listActivities(), /登录已过期/);
    await assert.rejects(() => enterActivityRoom('private', {}), /登录已过期/);
    values.set(ACCOUNT_KEY, 'user-b');
    assert.equal(hostStorageKey('room'), 'eventplay.account-host.user-b.room');
    assert.equal(values.get('eventplay.workspace.token'), 'legacy-secret');
  } finally { Object.assign(globalThis, previous); }
});

test('制作同款保留赛马及其他模板专属配置，不修改官方范例', () => {
  const original = JSON.stringify(templates);
  const horse = templates.find((template) => template.id === 'shake-race');
  const config = configOf({...horse, participants:200, brand:'我的品牌', logo:''});
  assert.equal(config.inputMode, 'shake');
  assert.equal(config.raceVariant, 'horse');
  assert.equal(config.theme, 'garden');
  for (const template of templates) {
    const copy = configOf({...template, participants:200, brand:'', logo:''});
    for (const field of ['quizVariant','drawVariant','wallVariant','voteVariant','createVariant','socialVariant']) {
      assert.equal(copy[field], template[field]);
    }
  }
  config.name = '我自己的游戏';
  assert.equal(JSON.stringify(templates), original);
});
