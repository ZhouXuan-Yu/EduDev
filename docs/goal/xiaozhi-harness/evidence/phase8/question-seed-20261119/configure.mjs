import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const baseline='C:/Users/ZhouXuan/.codex/worktrees/harness-baseline-20261117/EduProject/apps/desktop';
const workspace='D:/WorkProject/EduProject-harness/apps/desktop';
const {fingerprint}=await import(pathToFileURL(path.join(workspace,'scripts/xiaozhi-agent/phase8-real-model-plan.mjs')).href);
const source=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const configuredModel=process.env.DEEPSEEK_MODEL;
assert(typeof configuredModel==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(configuredModel));
assert(Boolean(process.env.DEEPSEEK_API_KEY),'configured credential required');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'omni-edu-xiaozhi-phase8-model-settings-'));
console.log(JSON.stringify({output,phase:'initializing_official_catalogue'}));
const dataRoot=path.join(output,'data'),profile=path.join(output,'profile');
fs.cpSync(source.dataSnapshot,dataRoot,{recursive:true,errorOnExist:true,force:false});fs.mkdirSync(profile);
assert.equal(fingerprint(dataRoot).sha256,source.dataSha256);
const bootstrap=path.join(output,'bootstrap.cjs');
fs.writeFileSync(bootstrap,[
  "const {app,net}=require('electron');",
  "app.setPath('userData',"+JSON.stringify(profile)+");",
  "const original=net.fetch;globalThis.phase8Metadata=[];",
  "net.fetch=async function(input,init){const url=new URL(typeof input==='string'?input:input.href||input.url);",
  "const method=String(init?.method||(typeof input==='object'&&input.method)||'GET').toUpperCase();",
  "if(url.origin!=='https://api.deepseek.com'||url.search||url.hash||!['/v1/models','/models'].includes(url.pathname)||method!=='GET')throw Error('seed_metadata_only');",
  "const row={method,path:url.pathname,status:null};globalThis.phase8Metadata.push(row);",
  "const result=await original.call(net,input,{...init,redirect:'error'});row.status=result.status;return result;};",
  "app.whenReady().then(()=>import("+JSON.stringify(pathToFileURL(path.join(baseline,'out/main/index.js')).href)+"));",
].join('\n'));
const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>
  name==='DEEPSEEK_API_KEY'||(!/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name)&&!name.startsWith('OMNI_EDU_')
    &&!['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(name))));
Object.assign(env,{OMNI_EDU_DATA_ROOT:dataRoot,OMNI_EDU_REPO_ROOT:path.resolve(baseline,'../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_XIAOZHI_PI:'1'});
const require=createRequire(path.join(baseline,'package.json'));
const application=await require('playwright')._electron.launch({executablePath:require('electron'),cwd:baseline,args:[bootstrap],env,timeout:60000});
let metadata,settings;
try{
  const page=await application.firstWindow({timeout:60000});
  assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  await page.waitForFunction(()=>Boolean(window.omniEdu?.getXiaozhiSettings));
  settings=await page.evaluate(async model=>{
    const api=window.omniEdu;
    const info=await api.getXiaozhiSettings();
    if(!info.ok)return {stage:'view',error:info.error};
    const found=info.value.models.find(item=>item.id===model);
    if(!info.value.configured||!found)return {
      stage:'catalogue',configured:info.value.configured,source:info.value.catalogue,error:info.value.catalogueError||'configured_model_unavailable',
    };
    const saved=await api.saveXiaozhiSettings({schemaVersion:'xiaozhi.settings.v1',version:info.value.version,defaultModel:model});
    if(!saved.ok)return {stage:'save',error:saved.error};
    const supported=found.effort?.supportedLevels||[];
    const choice=['high','low','max'].find(item=>supported.includes(item))||'auto';
    const thinking=await api.saveXiaozhiThinking({schemaVersion:'xiaozhi.settings.v1',version:saved.value.thinking.global.version,choice});
    if(!thinking.ok)return {stage:'thinking',error:thinking.error};
    return {stage:'ready',model,choice,configured:thinking.value.configured,configurationVersion:thinking.value.version,
      catalogue:thinking.value.catalogue,capacity:{contextWindow:found.contextWindow,maxOutputTokens:found.maxOutputTokens,
        supportedLevels:supported}};
  },configuredModel);
  metadata=await application.evaluate(()=>globalThis.phase8Metadata);
} finally {await application.close();}
const report={...settings,metadata,output,paidChatAttempts:0,dataSha256:fingerprint(dataRoot).sha256,profileSha256:fingerprint(profile).sha256};
fs.writeFileSync(path.join(output,'settings-evidence.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({stage:report.stage,error:report.error,output,metadata:report.metadata}));
if(report.stage!=='ready')process.exitCode=1;
