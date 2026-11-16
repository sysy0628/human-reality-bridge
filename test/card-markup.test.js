import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('卡片包含降水槽位且初始递送状态为关闭', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/app.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="precipitation"/);
  assert.match(html, /id="masterStatus">递送已暂停/);
  assert.match(html, /id="masterButton">恢复递送/);
  assert.match(app, /\$\('#precipitation'\)/);
});

test('部署文档覆盖混合位置链路和精确代理路由', async () => {
  const [readme, deployment, nginx] = await Promise.all([
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/deployment.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/nginx-control-routes.example.conf', import.meta.url), 'utf8')
  ]);
  assert.match(readme, /给人类看的隐私与回复说明/);
  assert.match(deployment, /PUT \/v1\/location/);
  assert.match(nginx, /environment\/current/);
  assert.match(nginx, /settings\/environment/);
});

test('定时递送提供从半小时到七天的完整间隔', async () => {
  const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const expected = [
    [30, '30 分钟'], [60, '1 小时'], [120, '2 小时'], [180, '3 小时'],
    [240, '4 小时'], [360, '6 小时'], [480, '8 小时'], [720, '12 小时'],
    [1440, '1 天'], [2880, '2 天'], [4320, '3 天'], [7200, '5 天'], [10080, '7 天']
  ];
  for (const [minutes, label] of expected) {
    assert.match(app, new RegExp(`\\[${minutes},'${label}'\\]`));
  }
});
