import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('项目声明非商业许可证且发布包强制包含许可证和致谢', async () => {
  const [license, pkgText, release] = await Promise.all([
    readFile(new URL('../LICENSE', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/build-release.sh', import.meta.url), 'utf8')
  ]);
  const pkg = JSON.parse(pkgText);
  assert.equal(pkg.license, 'PolyForm-Noncommercial-1.0.0');
  assert.match(license, /^# PolyForm Noncommercial License 1\.0\.0/m);
  assert.match(license, /Any noncommercial purpose is a permitted purpose\./);
  assert.match(release, /^\s+LICENSE$/m);
  assert.match(release, /^\s+CREDITS\.md$/m);
});
