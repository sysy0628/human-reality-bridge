import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseAruTriggerBundle, writeAruTriggerBundle } from './aru-trigger-credential.js';
import { writeCardSettings } from './config-writer.js';

const BODY_LIMIT = 20 * 1024;
const JSON_HEADERS = Object.freeze({ 'content-type': 'application/json; charset=utf-8' });

function digest(value) { return createHash('sha256').update(value).digest(); }
function validBearer(header, expected) { if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false; return timingSafeEqual(digest(header.slice(7)), digest(expected)); }
function normalizeOrigins(origins) { if (!Array.isArray(origins) || origins.length === 0) throw new Error('控制 API 必须配置来源白名单'); return new Set(origins.map(value => { let url; try { url = new URL(value); } catch { throw new Error('控制 API 来源白名单包含无效地址'); } if (url.origin !== value || url.protocol !== 'https:') throw new Error('控制 API 来源必须是精确的 HTTPS origin'); return url.origin; })); }
function response(status, body, origin, extraHeaders = {}) { const headers = { ...JSON_HEADERS, ...extraHeaders }; if (origin) { headers['access-control-allow-origin'] = origin; headers.vary = 'Origin'; } return { status, headers, body: JSON.stringify(body) }; }
function errorResponse(status, message, origin) { return response(status, { ok: false, error: message }, origin); }
function parseJsonObject(body) { if (typeof body !== 'string') throw new Error('请求正文必须是 JSON'); if (Buffer.byteLength(body, 'utf8') > BODY_LIMIT) { const error = new Error('请求正文过大'); error.status = 413; throw error; } let value; try { value = JSON.parse(body); } catch { throw new Error('请求正文不是有效 JSON'); } if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('请求正文必须是 JSON 对象'); return value; }
function parseBundleBody(body) { const value = parseJsonObject(body); if (typeof value.bundle !== 'string') throw new Error('请求正文缺少 bundle'); return value; }
function parseSettingsBody(body) { const value = parseJsonObject(body); if (!value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings)) throw new Error('请求正文缺少天气设置'); return value.settings; }
async function defaultReadSummary(path) { try { const raw = await readFile(path, 'utf8'); return { configured: true, ...parseAruTriggerBundle(raw).summary }; } catch (error) { if (error.code === 'ENOENT') return { configured: false }; throw error; } }

export function createControlApi({ authToken, settingsToken, allowedOrigins, bundlePath, configPath, writeBundle = writeAruTriggerBundle, writeSettings = writeCardSettings, readSummary = defaultReadSummary }) {
  if (typeof authToken !== 'string' || authToken.length < 32) throw new Error('控制 API Token 至少需要 32 个字符');
  settingsToken ||= authToken;
  configPath ||= './config.json';
  if (typeof settingsToken !== 'string' || settingsToken.length < 32) throw new Error('天气设置 Token 至少需要 32 个字符');
  if (typeof bundlePath !== 'string' || !bundlePath.trim()) throw new Error('控制 API 缺少 bundle secret 路径');
  if (typeof configPath !== 'string' || !configPath.trim()) throw new Error('控制 API 缺少天气配置路径');
  const origins = normalizeOrigins(allowedOrigins);
  async function handle({ method, pathname, headers = {}, body = '', secure = false }) {
    const origin = typeof headers.origin === 'string' ? headers.origin : '';
    const allowedOrigin = origins.has(origin) ? origin : '';
    if (!secure) return errorResponse(403, '控制 API 只接受 HTTPS', allowedOrigin);
    if (!allowedOrigin) return errorResponse(403, '请求来源未获授权', '');
    if (method === 'OPTIONS') return response(204, {}, allowedOrigin, { 'access-control-allow-methods': 'GET, PUT, OPTIONS', 'access-control-allow-headers': 'authorization, content-type', 'access-control-max-age': '600' });
    if (pathname === '/v1/settings/environment') {
      if (!validBearer(headers.authorization, settingsToken)) return errorResponse(401, '天气设置鉴权失败', allowedOrigin);
      if (method !== 'PUT') return errorResponse(405, '请求方法不受支持', allowedOrigin);
      try {
        const saved = await writeSettings(configPath, parseSettingsBody(body));
        return response(200, { ok: true, environment: { configured: true, enabled: saved.enabled === true, scheduledEnabled: saved.scheduled?.enabled === true, intervalMinutes: saved.scheduled?.intervalMinutes, airQualityEnabled: saved.airQuality?.enabled === true } }, allowedOrigin);
      } catch (error) { return errorResponse(error.status || 400, error.message, allowedOrigin); }
    }
    if (pathname !== '/v1/pairing/aru-trigger') return errorResponse(404, '接口不存在', allowedOrigin);
    if (!validBearer(headers.authorization, authToken)) return errorResponse(401, '控制 API 鉴权失败', allowedOrigin);
    if (method === 'GET') return response(200, { ok: true, pairing: await readSummary(bundlePath) }, allowedOrigin);
    if (method === 'PUT') { try { const input = parseBundleBody(body); const saved = await writeBundle(bundlePath, input.bundle); const { path: _path, ...summary } = saved; return response(200, { ok: true, pairing: { configured: true, ...summary } }, allowedOrigin); } catch (error) { return errorResponse(error.status || 400, error.message, allowedOrigin); } }
    return errorResponse(405, '请求方法不受支持', allowedOrigin);
  }
  return { handle };
}
export const CONTROL_API_BODY_LIMIT = BODY_LIMIT;
