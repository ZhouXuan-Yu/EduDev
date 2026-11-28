import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {_electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const fixture=fs.realpathSync(process.argv[2]);
const previous=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
assert(previous.ok && previous.checks.some(item=>item.name.includes('Two consecutive amendments')));
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'history-combined-cap-'));
const main=testMain(desktop),data=path.join(root,'data'),profile=path.join(root,'profile');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const original=path.join(fixture,'data','app.db'),before=hash(original);
fs.cpSync(path.dirname(original),data,{recursive:true});
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
  OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1'};
for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','OMNI_EDU_HISTORY_TOKEN','OMNI_EDU_HISTORY_LOOPBACK'])delete env[key];
const read=(query,...args)=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(query).all(...args);}finally{db.close();}
};
const report={build:hash(main),original:before,root,checks:[],ok:false};
const interrupt=process.argv.includes('--interrupt-after-admission');
let app,page;
async function launch(){
  app=await _electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env});
  await assertIsolatedPiMain(app,main,profile);
  page=await app.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor();
}
try{
  await launch();
  const sourceId=read("SELECT session_id FROM ai_conversation_messages WHERE role='user' GROUP BY session_id ORDER BY count(*) DESC LIMIT 1")[0].session_id;
  const runId=read('SELECT id FROM ai_agent_runs WHERE session_id=? ORDER BY rowid LIMIT 1',sourceId)[0].id;
  const old=await page.locator('.office-composer-container').getAttribute('data-session-id');
  await page.getByTestId('pi-new-session').click();
  await page.waitForFunction(id=>{const next=document.querySelector('.office-composer-container')?.dataset.sessionId;return next?.startsWith('aisession_') && next!==id;},old);
  const target=await page.locator('.office-composer-container').getAttribute('data-session-id');
  const saved=()=>read('SELECT version,payload_json FROM xiaozhi_pi_memory_scopes WHERE conversation_id=?',target);
  const bindings=()=>read("SELECT value_json FROM app_settings WHERE key GLOB 'xiaozhi.memory-use.task.v1:*' AND json_extract(value_json,'$.sessionId')=?",target);
  const invoke=(name,...args)=>page.evaluate(([name,args])=>window.omniEdu[name](...args),[name,args]);
  const sources=await invoke('listHistoryMemory',sourceId,0);
  assert(sources.ok);const selection=sources.value.items.filter(item=>item.ref.kind==='history_request').slice(0,5);assert.equal(selection.length,5);
  for(const item of selection)if(!item.allowed)assert((await invoke('changeHistoryMemory',item.ref,item.accessRevision,'allow')).ok);
  const discover=async item=>{
    const found=await invoke('discoverHistoryMemory',target,item.sessionTitle,true);
    assert(found.ok);const row=found.value.candidates.find(candidate=>candidate.sourceId===item.sourceId);assert(row);
    return row.ticket;
  };
  const snap=()=>invoke('getXiaozhiSnapshot',target);
  for(const item of selection.slice(0,2)){
    const scope=(await snap()).memoryScope;
    assert((await invoke('confirmHistoryMemory',target,scope.version,await discover(item))).ok);
  }
  const current=(await snap()).memoryScope;
  const sessionPins=current.selections.map(({layer,source,id,version,sourceVersion})=>({layer,source,id,version,sourceVersion}));
  const notes=[];
  for(let i=0;i<9;i++){
    const fact=await invoke('createAiMemoryEntry',{surface:'chat',text:'合成教学观察记录 '+(i+1),refs:['ai_agent_run:'+runId],origin:'teacher'});
    notes.push({layer:'L2',source:'chat',id:fact.id,version:fact.version});
  }
  const ten=[...sessionPins,...notes.slice(0,8)];
  assert((await invoke('setXiaozhiMemoryScope',{sessionId:target,version:current.version,enabled:true,selections:ten})).ok);
  const [row]=saved(),version=row.version;assert.equal(JSON.parse(row.payload_json).selections.length,10);
  const tokens=[];
  for(const item of selection){
    const staged=await invoke('stageHistoryMemory',target,version,await discover(item));assert(staged.ok);tokens.push(staged.value.token);
  }
  const prompt='请制作一份温度计实验课堂清单，在聊天中列三个要点，无需导出。';
  const start=historyIntents=>invoke('startXiaozhi',{sessionId:target,commandId:'xicmd_'+randomUUID(),prompt,historyIntents});
  for(let i=0;i<2;i++){const denied=await start(tokens);assert.equal(denied.ok,false);assert.deepEqual(saved(),[row]);assert.deepEqual(bindings(),[]);}
  report.checks.push('Two over-limit submissions leave the ten Session references and Task grants unchanged');
  const authorized=tokens.slice(0,4);
  const forged=await invoke('startXiaozhi',{sessionId:target,commandId:'xicmd_'+randomUUID(),prompt,
    taskId:'xitask_'+randomUUID(),historyIntents:authorized});
  assert.equal(forged.ok,false);assert.deepEqual(bindings(),[]);assert.deepEqual(saved(),[row]);
  if(interrupt){
    await app.evaluate(({net})=>{
      const fetch=net.fetch.bind(net);
      globalThis.heldAdmissionRequests=0;
      net.fetch=(input,init)=>{
        const url=new URL(typeof input==='string'?input:input.url);
        if(url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')return fetch(input,init);
        globalThis.heldAdmissionRequests++;
        return new Promise(()=>{});
      };
    });
  }
  const competing=await Promise.all([start(authorized),start(authorized)]);
  assert.equal(competing.filter(result=>result.ok).length,1,JSON.stringify(competing));
  const rejection=competing.find(result=>!result.ok);
  report.checks.push('The host rejects a client-selected Task and admits one of two simultaneous sends');
  report.concurrentDenial=rejection.error;
  const deadline=Date.now()+120000;
  if(interrupt){
    while(await app.evaluate(()=>globalThis.heldAdmissionRequests)===0){
      assert(Date.now()<deadline,'Provider dispatch barrier was never reached');
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    const admitted=bindings();
    assert.equal(admitted.length,1);
    const runs=()=>read('SELECT id,status FROM ai_agent_runs WHERE session_id=?',target);
    const effects=()=>read('SELECT run_id FROM xiaozhi_effects_v1 WHERE session_id=? ORDER BY rowid',target);
    const prior=runs(),priorEffects=effects();
    assert.equal(prior.length,1);
    assert.equal(priorEffects.length,0);
    report.interruption={runId:prior[0].id,statusBefore:prior[0].status,heldRequests:await app.evaluate(()=>globalThis.heldAdmissionRequests)};
    const pid=await app.evaluate(({app},profile)=>{
      if(process.type!=='browser'||app.getPath('userData')!==profile)throw Error('Unexpected crash target');
      return process.pid;
    },path.resolve(profile));
    report.interruption.processBoundary=process.platform==='win32'&&!process.argv.includes('--main-only')?'application_tree':'main_only';
    if(report.interruption.processBoundary==='application_tree')execFileSync('taskkill.exe',['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    else process.kill(pid,'SIGKILL');
    const exitDeadline=Date.now()+30000;
    for(;;){
      try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')break;throw error;}
      assert(Date.now()<exitDeadline,'Isolated Electron main did not exit');
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    app=undefined;
    await launch();
    await snap();
    assert.deepEqual(bindings(),admitted);
    assert.deepEqual(saved(),[row]);
    const after=runs();assert.equal(after.length,1);assert.equal(after[0].id,prior[0].id);
    assert.deepEqual(effects(),priorEffects);
    assert.equal(report.interruption.statusBefore,'running');
    assert.equal(after[0].status,'blocked','Cold recovery must require an explicit teacher action');
    report.interruption.statusAfter=after[0].status;
    report.checks.push('Killing the isolated Electron process at provider dispatch preserves the single admitted Run and Task binding without a duplicate effect');
  }
  for(;;){
    const state=await snap();if(!state.running && bindings().length===1)break;
    assert(Date.now()<deadline,'Timed out waiting for Task admission and completion');await new Promise(r=>setTimeout(r,200));
  }
  const [binding]=bindings().map(entry=>JSON.parse(entry.value_json));assert.equal(binding.selections.length,4);
  assert.equal(new Set([...ten,...binding.selections].map(item=>item.id)).size,12);
  report.checks.push('Two overlapping pins allow exactly twelve distinct Session and Task references');
  const durable=bindings();
  const duplicate=await start(authorized);
  assert.equal(duplicate.ok,false);assert.deepEqual(bindings(),durable);assert.deepEqual(saved(),[row]);
  assert.equal(read('SELECT count(*) AS n FROM ai_agent_runs WHERE session_id=?',target)[0].n,1);
  report.checks.push('A consumed intent cannot admit another Run or alter the committed Task binding');
  for(let i=0;i<2;i++){
    const denied=await invoke('setXiaozhiMemoryScope',{sessionId:target,version,enabled:true,selections:[...ten,notes[8]]});
    assert.deepEqual(denied,{ok:false,error:'command_conflict'});assert.deepEqual(saved(),[row]);assert.deepEqual(bindings(),durable);
  }
  report.checks.push('Changing the Session cannot bypass the existing Task union on either retry');
  report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}
finally{await app?.close();assert.equal(hash(original),before);fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
