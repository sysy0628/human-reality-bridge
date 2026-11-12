import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectRuntimeOrigin } from '../src/runtime-origin.js';

test('把规范 HTTPS 页面 origin 标为白名单候选', () => {
  assert.deepEqual(inspectRuntimeOrigin({ origin: 'https://aru.example' }), {
    status: 'https-candidate',
    origin: 'https://aru.example',
    allowlistCandidate: 'https://aru.example',
    message: '这是页面本地观察到的 HTTPS Origin 候选值。'
  });
});

test('不把 HTTP、不透明或缺失 origin 当作白名单候选', () => {
  assert.equal(inspectRuntimeOrigin({ origin: 'http://aru.example' }).status, 'insecure');
  assert.equal(inspectRuntimeOrigin({ origin: 'http://aru.example' }).allowlistCandidate, null);
  assert.equal(inspectRuntimeOrigin({ origin: 'null' }).status, 'opaque');
  assert.equal(inspectRuntimeOrigin({ origin: 'null' }).allowlistCandidate, null);
  assert.equal(inspectRuntimeOrigin({}).status, 'unavailable');
});

test('拒绝路径和无法解析的伪 origin', () => {
  assert.equal(inspectRuntimeOrigin({ origin: 'https://aru.example/path' }).status, 'invalid');
  assert.equal(inspectRuntimeOrigin({ origin: 'not an origin' }).status, 'invalid');
});
