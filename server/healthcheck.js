import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertHealthy } from './health.js';
const dataDir = resolve(process.env.BRIDGE_DATA_DIR || './data');
const pollMinutes = Number(process.env.BRIDGE_POLL_MINUTES || 10);
try { const state = JSON.parse(await readFile(resolve(dataDir, 'state.json'), 'utf8')); assertHealthy(state, { pollMinutes }); } catch (error) { console.error(`unhealthy: ${error.message}`); process.exitCode = 1; }
