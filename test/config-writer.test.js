import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeCardSettings } from '../server/config-writer.js';
const cardSettings={enabled:true,scheduledEnabled:true,intervalMinutes:180,deliverWithoutChange:true,quietEnabled:true,quietStart:'23:30',quietEnd:'07:00',cityQuery:'真实城市名',selectedPlace:{name:'真实城市名',admin:'真实省份',latitude:30.2,longitude:120.1,timezone:'Asia/Shanghai'},customRules:[]};
test('原子写入配置且不保存地名',async()=>{const dir=await mkdtemp(join(tmpdir(),'reality-config-'));const path=join(dir,'config.json');const output=await writeCardSettings(path,cardSettings);const text=await readFile(path,'utf8');const saved=JSON.parse(text);assert.deepEqual(saved,output);assert.equal(saved.location.latitude,30.2);assert.equal(text.includes('真实城市名'),false);assert.equal(text.includes('真实省份'),false);});
