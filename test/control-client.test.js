import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL_PAIRING_PATH, getPairingStatus, normalizeControlBaseURL, savePairing } from '../src/control-client.js';

const token = 't'.repeat(40);

test('控制地址只接受纯 HTTPS origin', () => {
  assert.equal(normalizeControlBaseURL('https://bridge.example/'), 'https://bridge.example');
  assert.throws(() => normalizeControlBaseURL('http://bridge.example'), /HTTPS/);
  assert.throws(() => normalizeControlBaseURL('https://user:pass@bridge.example'), /账号密码/);
  assert.throws(() => normalizeControlBaseURL('https://bridge.example/path'), /origin/);
  assert.throws(() => normalizeControlBaseURL('https://bridge.example?x=1'), /查询参数/);
});

test('GET 配对状态使用 Bearer、无缓存且不携带 cookie', async () => {
  const calls = [];
  const pairing = { configured: false };
  const result = await getPairingStatus('https://bridge.example', token, {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ ok: true, pairing }) };
    }
  });
  assert.deepEqual(result, pairing);
  assert.equal(calls[0].url, `https://bridge.example${CONTROL_PAIRING_PATH}`);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers.authorization, `Bearer ${token}`);
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal('body' in calls[0].options, false);
});

test('PUT 只发送 bundle JSON 并返回脱敏状态', async () => {
  const calls = [];
  const bundle = '{"schema":"aru.wake-bridge.sender-bundle.v2"}';
  const pairing = { configured: true, host: 'bridge.example', triggerTail: '174000' };
  const result = await savePairing('https://bridge.example', token, bundle, {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ ok: true, pairing }) };
    }
  });
  assert.deepEqual(result, pairing);
  assert.equal(calls[0].options.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].options.body), { bundle });
});

test('拒绝弱 Token、空 bundle、VPS 错误与非 JSON 响应', async () => {
  await assert.rejects(() => getPairingStatus('https://bridge.example', 'short', { fetchImpl: async () => {} }), /32/);
  await assert.rejects(() => savePairing('https://bridge.example', token, '', { fetchImpl: async () => {} }), /验证/);
  await assert.rejects(() => getPairingStatus('https://bridge.example', token, {
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ ok: false, error: '鉴权失败' }) })
  }), /鉴权失败/);
  await assert.rejects(() => getPairingStatus('https://bridge.example', token, {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad'); } })
  }), /无法识别/);
});

test('网络与超时错误转换为不含秘密的友好提示', async () => {
  await assert.rejects(() => getPairingStatus('https://bridge.example', token, {
    fetchImpl: async () => { throw new Error('network detail with token'); }
  }), error => error.message === '无法连接 VPS 控制服务');
  await assert.rejects(() => getPairingStatus('https://bridge.example', token, {
    fetchImpl: async () => { const error = new Error('timeout'); error.name = 'TimeoutError'; throw error; }
  }), error => error.message === '连接 VPS 超时');
});
