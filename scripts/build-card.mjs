#!/usr/bin/env node
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Script } from 'node:vm';

function fail(message){console.error(message);process.exit(1)}
function args(argv){const out={};for(let i=0;i<argv.length;i++){const key=argv[i];if(!key.startsWith('--'))fail(`未知参数：${key}`);const value=argv[++i];if(!value||value.startsWith('--'))fail(`${key} 缺少值`);out[key.slice(2)]=value;}return out;}
function exactHttpsOrigin(value){let url;try{url=new URL(value)}catch{fail('base-url 必须是有效 HTTPS origin')}if(url.protocol!=='https:'||url.origin!==value||url.pathname!=='/'||url.search||url.hash||url.username||url.password)fail('base-url 必须是无路径、查询或认证信息的精确 HTTPS origin');return url.origin;}
function escapeAttribute(value){return value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
function validateInlineScripts(html){const pattern=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let count=0;for(const match of html.matchAll(pattern)){count++;try{new Script(match[1],{filename:`inline-card-script-${count}.js`});}catch(error){fail(`生成卡片的第 ${count} 段内联脚本语法无效：${error.message}`);}}if(count===0)fail('生成卡片不包含内联脚本');return count;}
const input=args(process.argv.slice(2));
const root=resolve(input.root||'.'),source=resolve(root,input.input||'index.html'),output=resolve(input.output||'private-build/human-reality-bridge.html');
const baseURL=exactHttpsOrigin(input['base-url']||'');
if(!input['token-file'])fail('必须通过 --token-file 提供 Settings Token 文件');
const tokenPath=resolve(input['token-file']);const info=await stat(tokenPath).catch(()=>null);if(!info?.isFile())fail('Settings Token 文件不存在');
if((info.mode&0o077)!==0)fail('Settings Token 文件权限必须为 0600 或更严格');
const token=(await readFile(tokenPath,'utf8')).trim();if(token.length<32)fail('Settings Token 至少需要 32 个字符');
let html=await readFile(source,'utf8');
if(!html.includes('__SETTINGS_BASE_URL__')||!html.includes('__SETTINGS_TOKEN__'))fail('卡片源码缺少安全占位符');
const cssPattern=/<link rel="stylesheet" href="\.\/(src\/[^"?#]+)">/g;for(const match of [...html.matchAll(cssPattern)]){const css=await readFile(resolve(root,match[1]),'utf8');const replacement=`<style data-source="${match[1]}">${css}</style>`;html=html.replace(match[0],()=>replacement)}
const jsPattern=/<script src="\.\/(src\/[^"?#]+)"><\/script>/g;for(const match of [...html.matchAll(jsPattern)]){const js=await readFile(resolve(root,match[1]),'utf8');const replacement=`<script data-source="${match[1]}">${js}</script>`;html=html.replace(match[0],()=>replacement)}
html=html.replace('__SETTINGS_BASE_URL__',()=>escapeAttribute(baseURL)).replace('__SETTINGS_TOKEN__',()=>escapeAttribute(token));
if(/(?:href|src)="\.\/src\//.test(html)||html.includes('__SETTINGS_'))fail('生成卡片仍含未内联资源或占位符');
const inlineScriptCount=validateInlineScripts(html);
await mkdir(dirname(output),{recursive:true,mode:0o700});await writeFile(output,html,{encoding:'utf8',mode:0o600,flag:'wx'}).catch(error=>{if(error.code==='EEXIST')fail(`拒绝覆盖已有生成物：${output}`);throw error});
console.log(JSON.stringify({ok:true,output,bytes:Buffer.byteLength(html),inlineScriptCount,warning:'该文件含部署专用 Settings Token，不得提交 Git 或公开分享'},null,2));
