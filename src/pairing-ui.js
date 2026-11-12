import { getPairingStatus, normalizeControlBaseURL, savePairing } from './control-client.js';
import { inspectRuntimeOrigin } from './runtime-origin.js';

let controlToken = '';
let pairingStatus = null;
let busy = false;
const runtimeOrigin = inspectRuntimeOrigin();

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]));
}

function statusText() {
  if (busy) return '正在连接 VPS…';
  if (!pairingStatus) return '尚未检查 VPS 连接';
  if (!pairingStatus.configured) return 'VPS 已认证 · 尚未保存触发器';
  return `VPS 已认证 · ${pairingStatus.host} · 触发器尾号 ${pairingStatus.triggerTail}`;
}

function originText() {
  const observed = runtimeOrigin.origin ? `页面 Origin：${runtimeOrigin.origin}` : '页面 Origin：不可用';
  return `${observed}。${runtimeOrigin.message}最终白名单值必须以控制入口实际收到的 Origin 请求头为准。`;
}

function mountPairingControls() {
  const credentialInput = document.querySelector('#senderBundleInput');
  if (!credentialInput) return;
  const box = credentialInput.closest('.location-box');
  if (!box || box.querySelector('#controlConnectionPanel')) return;

  const panel = document.createElement('div');
  panel.id = 'controlConnectionPanel';
  panel.className = 'control-connection';
  panel.innerHTML = `
    <div class="rule-intro">先连接自己的 VPS。控制 Token 只保留在当前页面内存，刷新即清除。</div>
    <div class="credential-result show ${runtimeOrigin.status === 'https-candidate' ? 'success' : 'error'}" id="runtimeOriginStatus">${escapeText(originText())}</div>
    <div class="connection-grid">
      <input class="control" id="controlBaseURL" inputmode="url" autocomplete="url" placeholder="https://你的控制地址" value="${escapeText(settings.controlBaseURL || '')}">
      <input class="control" id="controlToken" type="password" autocomplete="off" placeholder="控制 Token（不保存）" value="${escapeText(controlToken)}">
    </div>
    <div class="actions">
      <button class="btn" id="checkControlButton">检查连接</button>
      <button class="btn primary" id="savePairingButton">保存配对</button>
    </div>
    <div class="credential-result show ${pairingStatus?.configured ? 'success' : ''}" id="controlConnectionStatus">${escapeText(statusText())}</div>
    <div class="credential-safe">控制地址可保存在本卡片；Token 与发送凭据不会写入 localStorage。保存配对不会发送消息。</div>
  `;
  box.prepend(panel);

  panel.querySelector('#controlToken').addEventListener('input', event => { controlToken = event.target.value; });
  panel.querySelector('#controlBaseURL').addEventListener('change', event => {
    try {
      settings.controlBaseURL = normalizeControlBaseURL(event.target.value);
      event.target.value = settings.controlBaseURL;
      saveSettings(false);
    } catch (error) { showToast(error.message); }
  });
  panel.querySelector('#checkControlButton').addEventListener('click', checkConnection);
  panel.querySelector('#savePairingButton').addEventListener('click', persistPairing);
}

async function withBusy(task) {
  if (busy) return;
  busy = true;
  renderSettings();
  try { await task(); }
  catch (error) { showToast(error.message); }
  finally { busy = false; renderSettings(); updateTriggerStatus(); }
}

function connectionInputs() {
  const address = document.querySelector('#controlBaseURL')?.value || settings.controlBaseURL || '';
  const token = document.querySelector('#controlToken')?.value || controlToken;
  controlToken = token;
  settings.controlBaseURL = normalizeControlBaseURL(address);
  saveSettings(false);
  return { address: settings.controlBaseURL, token };
}

function checkConnection() {
  return withBusy(async () => {
    const { address, token } = connectionInputs();
    pairingStatus = await getPairingStatus(address, token);
    showToast(pairingStatus.configured ? 'VPS 已连接，触发器已配对' : 'VPS 已连接，等待保存触发器');
  });
}

function persistPairing() {
  return withBusy(async () => {
    if (!pendingSenderBundle || !senderBundleSummary) throw new Error('请先验证 Aru 发送凭据');
    const { address, token } = connectionInputs();
    pairingStatus = await savePairing(address, token, pendingSenderBundle);
    pendingSenderBundle = null;
    senderBundleSummary = pairingStatus;
    showToast('配对已安全保存；没有发送消息');
  });
}

const observer = new MutationObserver(mountPairingControls);
observer.observe(document.querySelector('#settings'), { childList: true, subtree: true });
mountPairingControls();
