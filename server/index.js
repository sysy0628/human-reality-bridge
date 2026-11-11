import { loadConfig } from './config.js';
import { ensureRuntimeConfig } from './bootstrap.js';
import { flushLatest, runCycle } from './bridge.js';
import { JsonStore } from './store.js';
import { WakeFieldSender } from './wake-sender.js';
import { createSafeLogger } from './safe-log.js';
import { shouldCreateStartupTest, createStartupTestEvent, hasPendingStartupTest } from './startup-test.js';
const waitForNextCycle = (ms, signal) => new Promise(resolve => { const timer = setTimeout(resolve, ms); signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true }); });
const log = createSafeLogger();
async function main() {
  const bootstrap = await ensureRuntimeConfig(); let config = await loadConfig(); const store = new JsonStore(config.dataDir); await store.load(); const trigger = new WakeFieldSender(config.wakeSender); if (trigger.configured) await trigger.initialize();
  store.state.processStartedAt = Date.now(); store.state.lastHeartbeatAt = Date.now(); store.state.bridgeEnabled = Boolean(config.enabled); await store.save();
  log('info', '人类现实感应桥启动', { pollMinutes: config.pollMinutes, triggerConfigured: trigger.configured, configInitialized: bootstrap.created, bridgeEnabled: config.enabled });
  if (shouldCreateStartupTest(config, trigger, store.state)) { store.enqueue(createStartupTestEvent(trigger.credentialId)); await store.save(); }
  if (hasPendingStartupTest(store.state) && trigger.configured) { const result = await flushLatest(store, trigger, config, { log }); log('info', '启动测试投递已执行', { status: result.status }); }
  let stopping = false; const controller = new AbortController(); const stop = () => { stopping = true; controller.abort(); }; process.once('SIGTERM', stop); process.once('SIGINT', stop);
  while (!stopping) {
    try {
      try { const refreshed = await loadConfig(); if (refreshed.dataDir !== config.dataDir) throw new Error('运行中不能更改 BRIDGE_DATA_DIR；请重启服务'); config = refreshed; store.state.lastConfigError = null; }
      catch (error) { store.state.lastConfigError = { at: Date.now(), message: error.message }; log('error', '新配置无效，继续使用上一份有效配置', { error: error.message }); }
      if (hasPendingStartupTest(store.state)) { const result = await flushLatest(store, trigger, config, { log }); store.state.lastHeartbeatAt = Date.now(); store.state.bridgeEnabled = Boolean(config.enabled); await store.save(); log('info', '等待启动测试完成', { status: result.status }); }
      else await runCycle(config, store, trigger, { log });
    } catch (error) { store.state.lastHeartbeatAt = Date.now(); store.state.bridgeEnabled = Boolean(config.enabled); store.state.lastError = { at: Date.now(), message: error.message }; await store.save().catch(() => {}); log('error', '环境检查失败', { error: error.message }); }
    if (!stopping) await waitForNextCycle(config.pollMinutes * 60_000, controller.signal);
  }
  await store.save(); log('info', '人类现实感应桥已停止');
}
main().catch(error => { log('error', '启动失败', { error: error.message }); process.exitCode = 1; });
