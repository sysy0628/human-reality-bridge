import test from 'node:test';import assert from 'node:assert/strict';import { assertHealthy } from '../server/health.js';const now=10000000;
test('近期心跳和成功采集健康',()=>{assert.equal(assertHealthy({lastHeartbeatAt:now-1000,lastSuccessAt:now-2000,processStartedAt:now-100000,bridgeEnabled:true},{now,pollMinutes:10}),true);});
test('过期心跳不健康',()=>{assert.throws(()=>assertHealthy({lastHeartbeatAt:0,lastSuccessAt:0,processStartedAt:0,bridgeEnabled:true},{now,pollMinutes:1}),/心跳已过期/);});
test('启动宽限结束且未成功采集不健康',()=>{assert.throws(()=>assertHealthy({lastHeartbeatAt:now-1000,lastSuccessAt:null,processStartedAt:0,bridgeEnabled:true},{now,pollMinutes:1}),/天气采集长期未成功/);});
test('主动暂停只要求进程心跳',()=>{assert.equal(assertHealthy({lastHeartbeatAt:now-1000,lastSuccessAt:null,processStartedAt:0,bridgeEnabled:false},{now,pollMinutes:1}),true);});
