import test from 'node:test';
import assert from 'node:assert/strict';
import { enterActivityRoom, restoreOwner, ownerToken } from '../src/features/eventplay/api/realtime.ts';

test('活动复用未结束房间，结算后新建；恢复凭证验证失败不覆盖本机权限', async () => {
  const values = new Map();
  const previous = { fetch: globalThis.fetch, window: globalThis.window, localStorage: globalThis.localStorage };
  globalThis.window = { location: { protocol: 'https:', origin: 'https://example.test' } };
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let ended = false;
  let creates = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/owner')) return new Response(JSON.stringify({ detail: 'invalid' }), { status: 403 });
    if (options.method === 'POST') {
      creates++;
      return new Response(JSON.stringify({ room: { id: `room${creates}`, state: 'waiting' }, token: 'secret' }));
    }
    return new Response(JSON.stringify({ id: 'room1', state: ended ? 'completed' : 'waiting' }));
  };
  try {
    assert.equal((await enterActivityRoom('activity', {})).id, 'room1');
    assert.equal((await enterActivityRoom('activity', {})).id, 'room1');
    assert.equal(creates, 1);
    ended = true;
    assert.equal((await enterActivityRoom('activity', {})).id, 'room2');
    await assert.rejects(restoreOwner('room2', 'bad'));
    assert.equal(ownerToken('room2'), 'secret');
  } finally {
    Object.assign(globalThis, previous);
  }
});
