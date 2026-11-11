import { access, copyFile, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';

export async function ensureRuntimeConfig({ target = process.env.BRIDGE_CONFIG || './config.json', template = './config.example.json' } = {}) {
  const targetPath = resolve(target);
  try { await access(targetPath, constants.R_OK | constants.W_OK); return { path: targetPath, created: false }; }
  catch (error) { if (error.code !== 'ENOENT') throw new Error(`运行配置不可读写：${targetPath}`); }
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(resolve(template), targetPath, constants.COPYFILE_EXCL);
  return { path: targetPath, created: true };
}
