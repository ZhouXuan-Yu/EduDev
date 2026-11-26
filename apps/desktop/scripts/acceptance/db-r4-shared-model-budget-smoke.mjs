import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {_electron as electron} from 'playwright';
import { createSharedModelBudget, installSharedModelBudget, readSharedModelBudget, reserveSharedModelRequest, sharedModelBudgetEntry } from './db-r4-shared-model-budget.mjs';
import { assertIsolatedPiMain, testMain } from './build-root.mjs';

const desktop = process.cwd();
const report = { checks: [], externalRequests: 0 };
const check = name => { report.checks.push(name); console.log('PASS ' + name); };
const permit = dir => ['--r4-shared-budget=' + dir,'--allow-paid-model'];
const shared = createSharedModelBudget(desktop,3);
assert.throws(() => readSharedModelBudget(['--r4-shared-budget=' + shared],desktop),/Explicit approval/);
assert.throws(() => readSharedModelBudget(['--r4-shared-budget=relative'],desktop,{dryRun:true}),/absolute/);
assert.equal(readSharedModelBudget(permit(shared),desktop).used,0);
check('Owned shared budget rejects missing approval or relative paths');

const childCode = `
import {reserveSharedModelRequest} from ${JSON.stringify(new URL('./db-r4-shared-model-budget.mjs',import.meta.url).href)};
const [dir,scenario]=process.argv.slice(1);
for(let i=0;i<10;i++){
 try { console.log(reserveSharedModelRequest(dir,{scenario,model:'deepseek-flash',bytes:10})); }
 catch(error){if(error.message!=='R4_SHARED_MODEL_BUDGET_EXHAUSTED')throw error;}
}`;
function child(scenario) {
  return new Promise((resolve,reject) => {
    const processChild = spawn(process.execPath,['--input-type=module','-e',childCode,shared,scenario],{windowsHide:true});
    let output='',errors='';
    processChild.stdout.on('data',chunk=>output+=String(chunk));
    processChild.stderr.on('data',chunk=>errors+=String(chunk));
    processChild.on('error',reject);
    processChild.on('close',code=>code===0?resolve(output.trim().split(/\s+/).filter(Boolean).map(Number)):reject(new Error(errors)));
  });
}
const slots=(await Promise.all([child('QA'),child('PAPER-BLUEPRINT')])).flat().sort((a,b)=>a-b);
assert.deepEqual(slots,[1,2,3]);
assert.equal(readSharedModelBudget(permit(shared),desktop).used,3);
assert.deepEqual(await child('PAPER-COLD'),[]);
check('Concurrent independent processes reserve precisely three slots and cold process stays capped');

const crash = createSharedModelBudget(desktop,1);
fs.writeFileSync(path.join(crash,'slots','001.json'),'');
assert.throws(()=>reserveSharedModelRequest(crash,{scenario:'QA',model:'deepseek-flash',bytes:10}),/BUDGET_EXHAUSTED/);
check('An empty slot from an interrupted process stays consumed');

const guard = createSharedModelBudget(desktop,1);
const accepted=[];
let before,send;
const webRequest = { onBeforeRequest: listener => { before=listener; }, onBeforeSendHeaders: (_,listener) => { send=listener; } };
const reply = (hook,details) => new Promise(resolve=>hook(details,resolve));
const net={fetch:async(url,init)=>{
  const headers=Object.fromEntries(init.headers.entries());
  const decision=await reply(send,{url,method:init.method,requestHeaders:headers});
  if(decision.cancel)throw Error('wire cancelled');
  accepted.push({redirect:init.redirect,headers:decision.requestHeaders});return {};
}};
installSharedModelBudget({net,session:{defaultSession:{webRequest}}},{dir:guard,scenario:'QA'});
webRequest.onBeforeRequest((details,callback)=>callback({cancel:details.url.startsWith('file:')}));
assert.deepEqual(await reply(before,{url:'file:///locked.html',method:'GET'}),{cancel:true});
assert.deepEqual(await reply(before,{url:'https://example.invalid',method:'POST'}),{cancel:true});
const official='https://api.deepseek.com/chat/completions';
assert.deepEqual(await reply(send,{url:official,method:'POST',requestHeaders:{}}),{cancel:true});
const payload={method:'POST',headers:{authorization:'fake-key-never-recorded'},body:JSON.stringify({model:'deepseek-flash',messages:[{content:'private-text-never-recorded'}]})};
await net.fetch(official,payload);
assert.equal(accepted[0].redirect,'error');
assert.deepEqual(Object.keys(accepted[0].headers),['authorization']);
assert(!fs.readFileSync(path.join(guard,'slots','001.json'),'utf8').includes('never-recorded'));
await assert.rejects(net.fetch(official,payload),/wire cancelled/);
await assert.rejects(net.fetch(official,{...payload,body:JSON.stringify({model:'deepseek-out-of-scope'})}),/outside/);
check('Wire guard composes existing hook, rejects direct and excess requests, strips ticket and logs no private body or credential');

const offline=createSharedModelBudget(desktop,2);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'r4-budget-offline-'));
const profile=path.join(root,'profile'),data=path.join(root,'data');
const main=testMain(desktop),budget=readSharedModelBudget(permit(offline),desktop);
const entry=sharedModelBudgetEntry(main,profile,budget,'QA',{offline:true});
const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/(?:API[_-]?KEY|TOKEN|SECRET|NODE_OPTIONS|ELECTRON_RUN_AS_NODE)/i.test(name)));
Object.assign(env,{OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..')});
let app;
try {
  app=await electron.launch({args:[entry,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  const page=await app.firstWindow();
  const runtime=await assertIsolatedPiMain(app,main,profile);
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:25000});
  const guarded=await app.evaluate(async({net})=>{
    const r=await Promise.allSettled([net.fetch('https://api.deepseek.com/models'),net.fetch('https://api.deepseek.com/chat/completions',{method:'POST'})]);
    return r.map(x=>x.reason?.message);
  });
  assert.deepEqual(guarded,['R4_SHARED_MODEL_OFFLINE_PREFLIGHT','R4_SHARED_MODEL_OFFLINE_PREFLIGHT']);
  assert.equal(readSharedModelBudget(permit(offline),desktop).used,0);
  report.offlineElectron={main,paths:runtime.paths,loadedModules:runtime.modules.length};
  check('Formal Windows Electron build opens under installed offline gate with zero requests');
} finally {
  await app?.close();
}
console.log(JSON.stringify(report));
