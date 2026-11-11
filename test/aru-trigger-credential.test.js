import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseAruTriggerBundle, writeAruTriggerBundle } from '../server/aru-trigger-credential.js';

const triggerId = '123e4567-e89b-42d3-a456-426614174000';
const endpointId = '223e4567-e89b-42d3-a456-426614174001';
const token = Buffer.alloc(32, 7).toString('base64');
const key = Buffer.alloc(32, 9).toString('base64');
const bundle = overrides => JSON.stringify({
  schema: 'aru.wake-bridge.sender-bundle.v2',
  triggerId,
  submitURL: `https://bridge.example/aru/v1/wake-bridge/endpoints/${endpointId}/events`,
  submitToken: token,
  encryptionKey: key,
  ...overrides
});

test('校验 v2 bundle 并且只返回脱敏摘要', () => {
  const parsed = parseAruTriggerBundle(bundle());
  assert.deepEqual(Object.keys(parsed.summary).sort(), [
    'credentialId', 'endpointTail', 'host', 'schema', 'triggerTail'
  ]);
  assert.equal(parsed.summary.host, 'bridge.example');
  assert.equal(parsed.summary.triggerTail, '174000');
  assert.equal(parsed.summary.endpointTail, '174001');
  assert.match(parsed.summary.credentialId, /^[a-f0-9]{16}$/);
  assert.equal(JSON.stringify(parsed.summary).includes(token), false);
  assert.equal(JSON.stringify(parsed.summary).includes(key), false);
});

test('以 0600 原子写入 secret，返回值不包含秘密', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aru-trigger-'));
  const path = join(dir, 'secrets', 'aru-sender-bundle.json');
  const result = await writeAruTriggerBundle(path, bundle());
  const saved = await readFile(path, 'utf8');
  assert.equal(JSON.parse(saved).submitToken, token);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal(result.path, path);
  assert.equal(JSON.stringify(result).includes(token), false);
  assert.equal(JSON.stringify(result).includes(key), false);
});

test('同一 bundle 指纹稳定，凭据变化时指纹变化', () => {
  const first = parseAruTriggerBundle(bundle()).summary.credentialId;
  const second = parseAruTriggerBundle(bundle()).summary.credentialId;
  const changed = parseAruTriggerBundle(bundle({ submitToken: Buffer.alloc(32, 8).toString('base64') })).summary.credentialId;
  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test('拒绝非 HTTPS、非标准路径、内嵌认证与查询参数', () => {
  assert.throws(() => parseAruTriggerBundle(bundle({ submitURL: `http://bridge.example/aru/v1/wake-bridge/endpoints/${endpointId}/events` })), /HTTPS/);
  assert.throws(() => parseAruTriggerBundle(bundle({ submitURL: 'https://bridge.example/events' })), /wake-bridge v2/);
  assert.throws(() => parseAruTriggerBundle(bundle({ submitURL: `https://user:pass@bridge.example/aru/v1/wake-bridge/endpoints/${endpointId}/events` })), /HTTPS/);
  assert.throws(() => parseAruTriggerBundle(bundle({ submitURL: `https://bridge.example/aru/v1/wake-bridge/endpoints/${endpointId}/events?token=nope` })), /查询参数/);
});

test('拒绝错误 schema、UUID、Token、密钥和过大输入', () => {
  assert.throws(() => parseAruTriggerBundle('{'), /有效 JSON/);
  assert.throws(() => parseAruTriggerBundle(bundle({ schema: 'wrong' })), /schema/);
  assert.throws(() => parseAruTriggerBundle(bundle({ triggerId: 'not-a-uuid' })), /触发器标识/);
  assert.throws(() => parseAruTriggerBundle(bundle({ submitToken: 'bad' })), /提交令牌/);
  assert.throws(() => parseAruTriggerBundle(bundle({ encryptionKey: 'bad' })), /加密密钥/);
  assert.throws(() => parseAruTriggerBundle(' '.repeat(16 * 1024 + 1)), /过大/);
});
