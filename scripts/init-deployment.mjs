#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { mkdir, open, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

function fail(message){console.error(message);process.exit(1)}
function args(argv){const out={};for(let i=0;i<argv.length;i++){const key=argv[i];if(!key.startsWith('--'))fail(`未知参数：${key}`);const value=argv[++i];if(!value||value.startsWith('--'))fail(`${key} 缺少值`);out[key.slice(2)]=value;}return out;}
function exactHttpsOrigin(value){let url;try{url=new URL(value)}catch{fail('origin 必须是有效 HTTPS origin')}if(url.protocol!=='https:'||url.origin!==value||url.pathname!=='/'||url.search||url.hash||url.username||url.password)fail('origin 必须是无路径、查询或认证信息的精确 HTTPS origin');return url.origin;}
async function requireAbsoluteFile(name,value){if(!value||!isAbsolute(value))fail(`${name} 必须是绝对文件路径`);const info=await stat(value).catch(()=>null);if(!info?.isFile())fail(`${name} 指向的文件不存在`);return value;}
async function exclusive(path,content,mode=0o600){const handle=await open(path,'wx',mode).catch(error=>{if(error.code==='EEXIST')fail(`拒绝覆盖已有文件：${path}`);throw error});try{await handle.writeFile(content,{encoding:'utf8'});await handle.sync();}finally{await handle.close();}}
const input=args(process.argv.slice(2));
const output=resolve(input.output||'private-deployment');
const origin=exactHttpsOrigin(input.origin||'');
const sender=await requireAbsoluteFile('sender',input.sender);
const tlsKey=await requireAbsoluteFile('tls-key',input['tls-key']);
const tlsCert=await requireAbsoluteFile('tls-cert',input['tls-cert']);
const settingsBaseURL=input['settings-base-url']?exactHttpsOrigin(input['settings-base-url']):fail('必须提供 settings-base-url');
const port=Number(input.port||9443);if(!Number.isInteger(port)||port<1||port>65535)fail('port 无效');
await mkdir(output,{recursive:true,mode:0o700});
const secrets=resolve(output,'secrets');await mkdir(secrets,{mode:0o700}).catch(error=>{if(error.code!=='EEXIST')throw error});
const controlPath=resolve(secrets,'control-token'),settingsPath=resolve(secrets,'settings-token');
await exclusive(controlPath,randomBytes(48).toString('base64url')+'\n');
await exclusive(settingsPath,randomBytes(48).toString('base64url')+'\n');
const env=[
'BRIDGE_POLL_MINUTES=10',
'BRIDGE_SEND_STARTUP_TEST=false',
`BRIDGE_ARU_SENDER_HOST_PATH=${sender}`,
`BRIDGE_CONTROL_ALLOWED_ORIGINS=${origin}`,
`BRIDGE_CONTROL_HOST_PORT=${port}`,
`BRIDGE_CONTROL_TLS_KEY_HOST_PATH=${tlsKey}`,
`BRIDGE_CONTROL_TLS_CERT_HOST_PATH=${tlsCert}`,
`BRIDGE_CONTROL_TOKEN_HOST_PATH=${controlPath}`,
`BRIDGE_SETTINGS_TOKEN_HOST_PATH=${settingsPath}`,
''
].join('\n');
await exclusive(resolve(output,'.env'),env);
const guide={schema:'human-reality-bridge.deployment.v1',createdAt:new Date().toISOString(),origin,composeFiles:['compose.yaml','compose.control.example.yaml'],card:{settingsBaseURL,settingsTokenFile:settingsPath},notes:['目录包含秘密，不得提交 Git','初次启动保持 enabled=false','生成卡片后不得把生成物提交仓库']};
await exclusive(resolve(output,'deployment.json'),JSON.stringify(guide,null,2)+'\n');
console.log(JSON.stringify({ok:true,output,envFile:resolve(output,'.env'),settingsTokenFile:settingsPath,next:'使用 scripts/build-card.mjs 生成部署专用卡片；不要提交生成物'},null,2));
