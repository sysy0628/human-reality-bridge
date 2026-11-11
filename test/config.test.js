import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../server/config.js';
async function file(value){const dir=await mkdtemp(join(tmpdir(),'reality-config-'));const path=join(dir,'config.json');await writeFile(path,JSON.stringify(value));return path;}
test('配置解析并校验位置与 sender 路径',async()=>{const path=await file({scheduled:{intervalMinutes:180},quietHours:{start:'23:30',end:'07:00',timezone:'Asia/Shanghai'},rules:[]});const config=await loadConfig({BRIDGE_CONFIG:path,BRIDGE_LATITUDE:'30.2',BRIDGE_LONGITUDE:'120.1',BRIDGE_POLL_MINUTES:'10',BRIDGE_WAKE_SENDER_MODULE:'/opt/wake-field/wake-send.mjs',BRIDGE_WAKE_BUNDLE_FILE:'/run/secrets/aru-sender-bundle.json'});assert.equal(config.location.latitude,30.2);assert.equal(config.quietHours.timezone,'Asia/Shanghai');assert.deepEqual(config.wakeSender,{modulePath:'/opt/wake-field/wake-send.mjs',bundlePath:'/run/secrets/aru-sender-bundle.json'});});
test('空气质量只有显式开启才启用',async()=>{const path=await file({location:{latitude:30,longitude:120,timezone:'UTC'},airQuality:{enabled:true},rules:[]});assert.equal((await loadConfig({BRIDGE_CONFIG:path})).airQuality.enabled,true);});
test('拒绝越界坐标和规则',async()=>{let path=await file({rules:[]});await assert.rejects(()=>loadConfig({BRIDGE_CONFIG:path,BRIDGE_LATITUDE:'100',BRIDGE_LONGITUDE:'120'}),/location.latitude/);path=await file({rules:[{id:'humidity',enabled:true,field:'humidity',operator:'gte',value:101,persistMinutes:10,cooldownMinutes:60,action:'normal'}]});await assert.rejects(()=>loadConfig({BRIDGE_CONFIG:path,BRIDGE_LATITUDE:'30',BRIDGE_LONGITUDE:'120'}),/value 超出允许范围/);});
test('默认读配置位置且环境变量可覆盖',async()=>{const path=await file({location:{latitude:31.2,longitude:121.5,timezone:'Asia/Shanghai'},rules:[]});const config=await loadConfig({BRIDGE_CONFIG:path,BRIDGE_LATITUDE:'35',BRIDGE_LONGITUDE:'139',BRIDGE_TIMEZONE:'Asia/Tokyo'});assert.deepEqual(config.location,{latitude:35,longitude:139,timezone:'Asia/Tokyo'});});
test('Wake Field sender 路径必须成对配置',async()=>{const path=await file({location:{latitude:30,longitude:120,timezone:'UTC'},rules:[]});await assert.rejects(()=>loadConfig({BRIDGE_CONFIG:path,BRIDGE_WAKE_SENDER_MODULE:'/opt/wake-field/wake-send.mjs'}),/必须同时配置/);});
