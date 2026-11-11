const PAIRING_PATH = '/v1/pairing/aru-trigger';
const DEFAULT_TIMEOUT_MS = 10_000;

export function normalizeControlBaseURL(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('请填写 VPS 控制地址');
  let url;
  try { url = new URL(value.trim()); }
  catch { throw new Error('VPS 控制地址无效'); }
  if (url.protocol !== 'https:') throw new Error('VPS 控制地址必须使用 HTTPS');
  if (url.username || url.password) throw new Error('VPS 控制地址不能包含账号密码');
  if (url.search || url.hash) throw new Error('VPS 控制地址不能包含查询参数或片段');
  if (url.pathname !== '/' && url.pathname !== '') throw new Error('VPS 控制地址只填写 origin，不要附加接口路径');
  return url.origin;
}

function requireToken(value) {
  if (typeof value !== 'string' || value.length < 32) throw new Error('控制 Token 至少需要 32 个字符');
  return value;
}

function timeoutSignal(timeoutMs) {
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(timeoutMs);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function requestPairing(baseURL, token, { method = 'GET', bundle, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const origin = normalizeControlBaseURL(baseURL);
  const secret = requireToken(token);
  const options = {
    method,
    headers: { authorization: `Bearer ${secret}`, accept: 'application/json' },
    signal: timeoutSignal(timeoutMs),
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer'
  };
  if (method === 'PUT') {
    if (typeof bundle !== 'string' || !bundle.trim()) throw new Error('请先验证 Aru 发送凭据');
    options.headers['content-type'] = 'application/json';
    options.body = JSON.stringify({ bundle });
  }
  let response;
  try { response = await fetchImpl(`${origin}${PAIRING_PATH}`, options); }
  catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('连接 VPS 超时');
    throw new Error('无法连接 VPS 控制服务');
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('VPS 返回了无法识别的响应'); }
  if (!response.ok || data?.ok !== true) throw new Error(data?.error || `VPS 请求失败（${response.status}）`);
  return data.pairing;
}

export function getPairingStatus(baseURL, token, options = {}) {
  return requestPairing(baseURL, token, { ...options, method: 'GET' });
}

export function savePairing(baseURL, token, bundle, options = {}) {
  return requestPairing(baseURL, token, { ...options, method: 'PUT', bundle });
}

export const CONTROL_PAIRING_PATH = PAIRING_PATH;
