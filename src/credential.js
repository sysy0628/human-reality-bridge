const ARU_SENDER_SCHEMA = 'aru.wake-bridge.sender-bundle.v2';
const ARU_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validBase64Bytes(value, length = 32) {
  if (typeof value !== 'string' || !value) return false;
  try { const binary = atob(value); return binary.length === length && btoa(binary) === value; } catch { return false; }
}
function parseAruSenderBundle(raw) {
  let value; try { value = JSON.parse(raw); } catch { throw new Error('这段内容不是有效的 JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('发送凭据必须是一个 JSON 对象');
  if (value.schema !== ARU_SENDER_SCHEMA) throw new Error('这不是受支持的 Aru v2 发送凭据');
  if (!ARU_UUID_PATTERN.test(value.triggerId || '')) throw new Error('触发器标识无效');
  let url; try { url = new URL(value.submitURL); } catch { throw new Error('提交地址无效'); }
  if (url.protocol !== 'https:') throw new Error('提交地址必须使用 HTTPS');
  const match = url.pathname.match(/^\/aru\/v1\/wake-bridge\/endpoints\/([0-9a-f-]+)\/events$/i);
  if (!match || !ARU_UUID_PATTERN.test(match[1])) throw new Error('提交地址不是有效的 wake-bridge v2 端点');
  if (!validBase64Bytes(value.submitToken)) throw new Error('提交令牌格式无效');
  if (!validBase64Bytes(value.encryptionKey)) throw new Error('加密密钥格式无效');
  return { raw: JSON.stringify(value), schema: value.schema, host: url.host, triggerId: value.triggerId, endpointId: match[1] };
}
function credentialSummary(bundle) { return { host: bundle.host, triggerTail: bundle.triggerId.slice(-6), schema: bundle.schema }; }
