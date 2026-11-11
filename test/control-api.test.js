import test from 'node:test';
import assert from 'node:assert/strict';
import { createControlApi, CONTROL_API_BODY_LIMIT } from '../server/control-api.js';

const token = 'control-token-with-at-least-32-characters';
const origin = 'https://card.example';
const bundlePath = '/run/secrets/aru-sender-bundle.json';
const request = overrides => ({
  method: 'GET',
  pathname: '/v1/pairing/aru-trigger',
  secure: true,
  headers: { origin, authorization: `Bearer ${token}` },
  ...overrides
});

test('拒绝弱 Token、空白名单与非 HTTPS origin 配置', () => {
  assert.throws(() => createControlApi({ authToken: 'short', allowedOrigins: [origin], bundlePath }), /32/);
  assert.throws(() => createControlApi({ authToken: token, allowedOrigins: [], bundlePath }), /白名单/);
  assert.throws(() => createControlApi({ authToken: token, allowedOrigins: ['http://card.example'], bundlePath }), /HTTPS origin/);
});

test('拒绝非 HTTPS、未知来源与错误 Bearer Token', async () => {
  const api = createControlApi({ authToken: token, allowedOrigins: [origin], bundlePath });
  assert.equal((await api.handle(request({ secure: false }))).status, 403);
  assert.equal((await api.handle(request({ headers: { origin: 'https://evil.example', authorization: `Bearer ${token}` } }))).status, 403);
  assert.equal((await api.handle(request({ headers: { origin, authorization: 'Bearer wrong' } }))).status, 401);
});

test('预检只向授权来源返回精确 CORS', async () => {
  const api = createControlApi({ authToken: token, allowedOrigins: [origin], bundlePath });
  const result = await api.handle(request({ method: 'OPTIONS', headers: { origin } }));
  assert.equal(result.status, 204);
  assert.equal(result.headers['access-control-allow-origin'], origin);
  assert.equal(result.headers['access-control-allow-methods'], 'GET, PUT, OPTIONS');
});

test('读取配对状态只返回脱敏摘要', async () => {
  const api = createControlApi({
    authToken: token, allowedOrigins: [origin], bundlePath,
    readSummary: async path => {
      assert.equal(path, bundlePath);
      return { configured: true, schema: 'aru.wake-bridge.sender-bundle.v2', host: 'bridge.example', triggerTail: '174000', endpointTail: '174001', credentialId: 'abcdef0123456789' };
    }
  });
  const result = await api.handle(request());
  const body = JSON.parse(result.body);
  assert.equal(result.status, 200);
  assert.equal(body.pairing.host, 'bridge.example');
  assert.equal(result.body.includes('submitToken'), false);
  assert.equal(result.body.includes('encryptionKey'), false);
});

test('保存配对只写 secret，不触发发送且不返回路径', async () => {
  const calls = [];
  const api = createControlApi({
    authToken: token, allowedOrigins: [origin], bundlePath,
    writeBundle: async (path, bundle) => {
      calls.push({ path, bundle });
      return { path, configured: true, schema: 'aru.wake-bridge.sender-bundle.v2', host: 'bridge.example', triggerTail: '174000', endpointTail: '174001', credentialId: 'abcdef0123456789' };
    }
  });
  const secret = '{"schema":"aru.wake-bridge.sender-bundle.v2"}';
  const result = await api.handle(request({ method: 'PUT', body: JSON.stringify({ bundle: secret }) }));
  assert.equal(result.status, 200);
  assert.deepEqual(calls, [{ path: bundlePath, bundle: secret }]);
  assert.equal(result.body.includes(bundlePath), false);
  assert.equal(result.body.includes(secret), false);
});

test('拒绝无效正文和超限请求', async () => {
  const api = createControlApi({ authToken: token, allowedOrigins: [origin], bundlePath });
  assert.equal((await api.handle(request({ method: 'PUT', body: '{' }))).status, 400);
  assert.equal((await api.handle(request({ method: 'PUT', body: JSON.stringify({ noBundle: true }) }))).status, 400);
  assert.equal((await api.handle(request({ method: 'PUT', body: 'x'.repeat(CONTROL_API_BODY_LIMIT + 1) }))).status, 413);
});

test('未知接口和方法被明确拒绝', async () => {
  const api = createControlApi({ authToken: token, allowedOrigins: [origin], bundlePath });
  assert.equal((await api.handle(request({ pathname: '/v1/other' }))).status, 404);
  assert.equal((await api.handle(request({ method: 'POST' }))).status, 405);
});
