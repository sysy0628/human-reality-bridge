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
