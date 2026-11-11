import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createControlRequestListener, loadControlServerConfig, readRequestBody, startControlServer } from '../server/control-server.js';

const token = 't'.repeat(40);
const env = {
  BRIDGE_CONTROL_TLS_KEY_FILE: '/secrets/key.pem',
  BRIDGE_CONTROL_TLS_CERT_FILE: '/secrets/cert.pem',
  BRIDGE_CONTROL_TOKEN_FILE: '/secrets/control-token',
  BRIDGE_CONTROL_ALLOWED_ORIGINS: 'https://card.example,https://second.example',
  BRIDGE_CONTROL_BUNDLE_FILE: '/secrets/aru-sender-bundle.json',
  BRIDGE_CONTROL_PORT: '9443'
};
const files = new Map([['/secrets/key.pem', 'fake-key'], ['/secrets/cert.pem', 'fake-cert'], ['/secrets/control-token', `${token}\n`]]);
const readFileImpl = async (path, encoding) => { assert.equal(encoding, 'utf8'); if (!files.has(path)) throw new Error('missing fixture'); return files.get(path); };

test('从 secret 文件加载 TLS 与 Token，默认只监听 loopback', async () => {
  const config = await loadControlServerConfig(env, { readFileImpl });
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 9443);
  assert.equal(config.key, 'fake-key');
  assert.equal(config.cert, 'fake-cert');
  assert.equal(config.authToken, token);
  assert.deepEqual(config.allowedOrigins, ['https://card.example', 'https://second.example']);
});

test('拒绝弱 Token、缺失文件、无效端口和空 origin', async () => {
  await assert.rejects(() => loadControlServerConfig({ ...env, BRIDGE_CONTROL_PORT: '70000' }, { readFileImpl }), /PORT/);
  await assert.rejects(() => loadControlServerConfig({ ...env, BRIDGE_CONTROL_ALLOWED_ORIGINS: ' ' }, { readFileImpl }), /ORIGINS/);
  const weakFiles = async path => path === '/secrets/control-token' ? 'short' : files.get(path);
  await assert.rejects(() => loadControlServerConfig(env, { readFileImpl: weakFiles }), /32/);
  await assert.rejects(() => loadControlServerConfig({ ...env, BRIDGE_CONTROL_TLS_KEY_FILE: '' }, { readFileImpl }), /KEY_FILE/);
});

test('请求读取严格执行正文上限', async () => {
  const small = new EventEmitter();
  const smallPromise = readRequestBody(small, { limit: 5 });
  small.emit('data', Buffer.from('he')); small.emit('data', Buffer.from('llo')); small.emit('end');
  assert.equal(await smallPromise, 'hello');
  const large = new EventEmitter();
  const largePromise = readRequestBody(large, { limit: 4 });
  large.emit('data', Buffer.from('hello'));
  await assert.rejects(largePromise, error => error.status === 413);
});

function fakeResponse() {
  return { status: null, headers: null, body: undefined, writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; this.resolve?.(); } };
}

test('HTTPS listener 将请求转给 API 并写回响应', async () => {
  const calls = [];
  const api = { handle: async input => { calls.push(input); return { status: 200, headers: { 'x-test': 'yes' }, body: '{"ok":true}' }; } };
  const listener = createControlRequestListener(api);
  const request = new EventEmitter();
  Object.assign(request, { method: 'PUT', url: '/v1/pairing/aru-trigger?ignored=yes', headers: { Origin: 'https://card.example', Authorization: 'Bearer token' }, socket: { encrypted: true } });
  const response = fakeResponse();
  const done = new Promise(resolve => { response.resolve = resolve; });
  listener(request, response);
  request.emit('data', Buffer.from('{"bundle":"fake"}')); request.emit('end');
  await done;
  assert.equal(calls[0].pathname, '/v1/pairing/aru-trigger');
  assert.equal(calls[0].secure, true);
  assert.equal(calls[0].headers.origin, 'https://card.example');
  assert.equal(calls[0].body, '{"bundle":"fake"}');
  assert.equal(response.status, 200);
  assert.equal(response.body, '{"ok":true}');
});

test('传输层错误不泄露内部错误内容', async () => {
  const listener = createControlRequestListener({ handle: async () => { throw new Error('secret internal detail'); } });
  const request = new EventEmitter();
  Object.assign(request, { method: 'GET', url: '/', headers: {}, socket: { encrypted: true } });
  const response = fakeResponse();
  const done = new Promise(resolve => { response.resolve = resolve; });
  listener(request, response);
  await done;
  assert.equal(response.status, 500);
  assert.equal(response.body.includes('secret internal detail'), false);
});

test('启动服务只记录非敏感监听摘要并支持关闭', async () => {
  const events = [];
  let options; let listener;
  const fakeServer = new EventEmitter();
  fakeServer.listen = (port, host, callback) => { events.push(['listen', port, host]); callback(); };
  fakeServer.close = callback => { events.push(['close']); callback(); };
  const running = await startControlServer({
    env, readFileImpl,
    createServerImpl: (receivedOptions, receivedListener) => { options = receivedOptions; listener = receivedListener; return fakeServer; },
    writeLog: line => events.push(['log', line])
  });
  assert.deepEqual(options, { key: 'fake-key', cert: 'fake-cert' });
  assert.equal(typeof listener, 'function');
  assert.deepEqual(running.config, { host: '127.0.0.1', port: 9443, originCount: 2 });
  assert.equal(events[1][1].includes(token), false);
  await running.close();
  assert.deepEqual(events.at(-1), ['close']);
});
