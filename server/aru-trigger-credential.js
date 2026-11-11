import { createHash } from 'node:crypto';
import { chmod, mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const ARU_SENDER_SCHEMA = 'aru.wake-bridge.sender-bundle.v2';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENDPOINT_PATH = /^\/aru\/v1\/wake-bridge\/endpoints\/([0-9a-f-]+)\/events$/i;
const MAX_BUNDLE_BYTES = 16 * 1024;

function requireBase64Bytes(name, value, length = 32) {
  if (typeof value !== 'string' || !value) throw new Error(`${name} 格式无效`);
  let bytes;
  try { bytes = Buffer.from(value, 'base64'); }
  catch { throw new Error(`${name} 格式无效`); }
  if (bytes.length !== length || bytes.toString('base64') !== value) {
    throw new Error(`${name} 格式无效`);
  }
}

function fingerprint(canonical) {
  return createHash('sha256')
    .update('human-reality-bridge:aru-trigger-bundle:v1\0')
    .update(canonical)
    .digest('hex')
    .slice(0, 16);
}

export function parseAruTriggerBundle(raw) {
  if (typeof raw !== 'string') throw new Error('发送凭据不能为空');
  if (Buffer.byteLength(raw, 'utf8') > MAX_BUNDLE_BYTES) throw new Error('发送凭据过大');
  if (!raw.trim()) throw new Error('发送凭据不能为空');

  let bundle;
  try { bundle = JSON.parse(raw); }
  catch { throw new Error('发送凭据不是有效 JSON'); }
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    throw new Error('发送凭据必须是 JSON 对象');
  }
  if (bundle.schema !== ARU_SENDER_SCHEMA) throw new Error('发送凭据 schema 无效');
  if (!UUID_PATTERN.test(bundle.triggerId || '')) throw new Error('触发器标识无效');

  let submitURL;
  try { submitURL = new URL(bundle.submitURL); }
  catch { throw new Error('提交地址无效'); }
  if (submitURL.protocol !== 'https:' || submitURL.username || submitURL.password) {
    throw new Error('提交地址必须是无内嵌认证信息的 HTTPS 地址');
  }
  if (submitURL.search || submitURL.hash) throw new Error('提交地址不能包含查询参数或片段');
  const endpointMatch = submitURL.pathname.match(ENDPOINT_PATH);
  if (!endpointMatch || !UUID_PATTERN.test(endpointMatch[1])) {
    throw new Error('提交地址不是有效的 wake-bridge v2 端点');
  }

  requireBase64Bytes('提交令牌', bundle.submitToken);
  requireBase64Bytes('加密密钥', bundle.encryptionKey);

  const canonical = `${JSON.stringify(bundle)}\n`;
  return {
    canonical,
    summary: Object.freeze({
      schema: bundle.schema,
      host: submitURL.host,
      triggerTail: bundle.triggerId.slice(-6),
      endpointTail: endpointMatch[1].slice(-6),
      credentialId: fingerprint(canonical)
    })
  };
}

export async function writeAruTriggerBundle(target, raw) {
  const parsed = parseAruTriggerBundle(raw);
  const targetPath = resolve(target);
  const parent = dirname(targetPath);
  const temporary = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(parent, { recursive: true, mode: 0o700 });

  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(parsed.canonical, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, targetPath);
    await chmod(targetPath, 0o600);
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }

  return { path: targetPath, ...parsed.summary };
}
