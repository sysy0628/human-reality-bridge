import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('卡片不再向使用者收集控制 Token 或发送凭据', async () => {
  const [index, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/app.js', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(index, /data-tab="pairing"/);
  assert.doesNotMatch(index, /pairing-ui\.js|credential\.js/);
  assert.doesNotMatch(app, /senderBundleInput|controlToken|pendingSenderBundle|savePairing/);
  assert.match(index, /由知舟管理/);
  assert.match(app, /status\.textContent='由知舟管理'/);
});
