import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureRuntimeConfig } from '../server/bootstrap.js';

test('首次启动从示例初始化运行配置', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reality-bootstrap-'));
  const template = join(dir, 'example.json');
  const target = join(dir, 'config', 'config.json');
  await writeFile(template, '{"enabled":true}\n');
  const result = await ensureRuntimeConfig({ target, template });
  assert.equal(result.created, true);
  assert.equal(await readFile(target, 'utf8'), '{"enabled":true}\n');
});

test('已有运行配置不会被更新覆盖', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reality-bootstrap-'));
  const template = join(dir, 'example.json');
  const target = join(dir, 'config.json');
  await writeFile(template, '{"enabled":true}\n');
  await writeFile(target, '{"enabled":false}\n');
  const result = await ensureRuntimeConfig({ target, template });
  assert.equal(result.created, false);
  assert.equal(await readFile(target, 'utf8'), '{"enabled":false}\n');
});
