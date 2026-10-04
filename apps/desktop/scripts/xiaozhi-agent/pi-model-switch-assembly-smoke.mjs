import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { SessionManager } from '@earendil-works/pi-coding-agent';
const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
const {createModelSwitchState}=await import('../../src/main/xiaozhi-agent/model-switch-state.ts');
const {createNativeModelSwitch}=await import('../../src/main/xiaozhi-agent/native-model-switch.ts');
const {createPiMemoryEpoch}=await import('../../src/main/xiaozhi-agent/native-memory-epoch.ts');
const {createPiSkillEpoch}=await import('../../src/main/xiaozhi-agent/native-skill-epoch.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-model-assembly-')),checks=[],fixtures=[];
const report={success:false,checks,boundary:'Actual production Pi assembler/native authority epochs/SQLite/JSONL and owned synthetic history; one controlled native summary request, no live provider calls'};
const flash='deepseek-flash',pro='deepseek-v4-pro',A='a'.repeat(64),B='b'.repeat(64);
const caps=id=>({id,name:id,contextWindow:id===pro?65536:32768,maxOutputTokens:8192,observedAt:new Date().toISOString(),source:'official'});
const sha=v=>createHash('sha256').update(v).digest('hex');
const assistant=text=>({role:'assistant',content:[{type:'text',text}],provider:'xiaozhi_deepseek',model:flash,api:'openai-completions',timestamp:Date.now(),stopReason:'stop',
  usage:{input:10,output:10,cacheRead:0,cacheWrite:0,totalTokens:20,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}});
const priorFetch=globalThis.fetch;let requests=0,summaryMode=false;const summaryModels=[];
globalThis.fetch=async(input,init)=>{
  if(!summaryMode){requests++;throw new Error('Unexpected provider call in idle assembly');}
  const url=String(input instanceof Request?input.url:input);assert(url.endsWith('/chat/completions'));
  const body=JSON.parse(input instanceof Request?await input.text():init.body);assert.equal(body.model,pro);summaryModels.push(body.model);
  const chunk={id:'owned-summary',object:'chat.completion.chunk',created:1,model:pro,choices:[{index:0,delta:{role:'assistant',content:'合成课堂资料摘要；本地事实和权限保持。'},finish_reason:null}]};
  const stop={...chunk,choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:64,completion_tokens:10,total_tokens:74}};
  return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(stop)}\n\ndata: [DONE]\n\n`,{headers:{'content-type':'text/event-stream'}});
};
async function fixture({safeHistory=false}={}){
  const root=path.join(output,randomUUID(),'xiaozhi-pi'),id='aisession_'+randomUUID(),stateRoot=path.join(root,id),workspace=path.join(stateRoot,'workspace');fs.mkdirSync(workspace,{recursive:true});
  const db=new DatabaseSync(path.join(root,'app.db'));db.exec('CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,archived_at TEXT);CREATE TABLE xiaozhi_pi_session_bindings(conversation_id TEXT PRIMARY KEY,schema_version INTEGER,session_file TEXT,model TEXT,updated_at TEXT)');
  db.prepare('INSERT INTO ai_conversation_sessions VALUES (?,NULL)').run(id);
  const state=createModelSwitchState({run:async(sql,v=[])=>db.prepare(sql).run(...v),change:async(sql,v=[])=>Number(db.prepare(sql).run(...v).changes),all:async(sql,v=[])=>db.prepare(sql).all(...v)});await state.migrate();
  const coordinator=createNativeModelSwitch({state,root,assertIdle:()=>{},assertAuthorized:async()=>{}});
  let authority=A,enabled=true,agent,file,skillEnabled=true;
  const runId='run_'+randomUUID(),document='---\nname: model-test-skill\ndescription: Synthetic model continuity skill\n---\nUse SYNTHETIC-SKILL-SECRET only for this owned fixture.\n';
  const source={resources:async()=>({revision:skillEnabled?1:2,resources:skillEnabled?[{item:{name:'model-test-skill',title:'合成备课技能',origin:'imported',version:1,files:[{path:'SKILL.md',sha256:sha(document),bytes:Buffer.byteLength(document)}]},bytes:new Map([['SKILL.md',Buffer.from(document)]])}]:[]}),sanitize:async text=>text};
  async function assemble(model=flash,{beforeExit=false,afterNativeExit=false}={}){
    agent?.dispose();const current=await state.current(id);
    agent=await createPiXiaozhiSession({stateRoot,workspace,apiKey:'synthetic-non-live-key',model,sessionFile:file,privateWorkspaceId:id,
      capabilities:caps(model),switchTarget:caps(model===flash?pro:flash),autoCompaction:true,educationSkills:true,managedSkills:source,
      memory:{runId,authority:async()=>({fingerprint:authority,enabled,valid:true,modelAccess:'available'}),readSelected:async()=>[],trace:async()=>[]},
      protectedContext:async excluded=>excluded?.includes(runId)?'safe-authoritative-facts':'synthetic-derived-fact',
      ...(current?{modelHistory:{authorize:manager=>coordinator.authorize(manager,id),beforeLoad:async(manager,scopes)=>{await coordinator.beforeAuthorityLoad(manager,current,scopes);if(beforeExit)throw new Error('restore-before-exit');},
        align:async(session,scopes)=>{if(afterNativeExit){if(!session.messages.length)throw new Error('restore-native-exit');const original=session.setModel.bind(session);session.setModel=async model=>{await original(model);throw new Error('restore-native-exit');};}await coordinator.alignAuthorityBranch(session,current,scopes);}}}:{})});
    return agent;
  }
  await assemble();const manager=agent.session.sessionManager;
  if(safeHistory){manager.appendMessage({role:'user',content:'safe original lesson marker',timestamp:Date.now()});manager.appendMessage(assistant('safe original reply'));}
  const identity=manager.getEntries().find(entry=>entry.type==='custom'&&entry.customType==='xiaozhi.education.skills.v2').data.identity;
  const mem=createPiMemoryEpoch(manager,A),skill=createPiSkillEpoch(manager,identity);mem.beginRun(runId);skill.beginRun(runId,true);
  const userId=manager.appendMessage({role:'user',content:'synthetic tainted lesson',timestamp:Date.now()});mem.beforeDelivery();skill.beforeDelivery();
  manager.appendMessage(assistant('SYNTHETIC-MEMORY-SECRET and SYNTHETIC-SKILL-SECRET derived conclusion'));
  manager.appendCompaction('SYNTHETIC-MEMORY-SECRET and SYNTHETIC-SKILL-SECRET summary',userId,500);
  file=agent.sessionFile;assert(fs.existsSync(file));const relative=path.relative(root,file);
  db.prepare('INSERT INTO xiaozhi_pi_session_bindings VALUES (?,4,?,?,?)').run(id,relative,flash,new Date().toISOString());
  await assemble();const initial={sessionId:id,sessionFile:relative,nativeSessionId:agent.sessionId,originModel:flash,model:flash,revision:0};
  await coordinator.initialize(agent.session.sessionManager,initial,true);
  const snapshot=JSON.stringify(agent.session.sessionManager.getEntries().find(entry=>entry.type==='custom'&&entry.customType==='xiaozhi.education.snapshot.v1'));
  const f={root,id,state,db,coordinator,initial,assemble,runId,get agent(){return agent;},get file(){return file;},snapshot,
    revoke(){authority=B;enabled=false;skillEnabled=false;},
    manager(){return SessionManager.open(file,path.dirname(file),workspace);},
    close(){agent?.dispose();db.close();}};fixtures.push(f);return f;
}
const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log('PASS '+name);};
try{
  for(const safeHistory of [false,true]){
    await check(`Production assembler preserves origin fingerprint after native switch; safeHistory=${safeHistory}`,async()=>{
      const f=await fixture({safeHistory});f.agent.assertSwitchCapacity(caps(pro));await f.coordinator.switch(f.agent.session,f.initial,f.agent.registeredModel(pro));
      await f.assemble(pro);assert.equal(f.agent.session.model.id,pro);assert.equal(f.agent.contextPolicy().window,65536);assert.equal(f.agent.contextPolicy().auto,true);
      assert.equal(JSON.stringify(f.agent.session.sessionManager.getEntries().find(e=>e.type==='custom'&&e.customType==='xiaozhi.education.snapshot.v1')),f.snapshot);
      const before=fs.readFileSync(f.file);f.revoke();await f.assemble(pro);
      assert(fs.readFileSync(f.file).subarray(0,before.length).equals(before));
      const context=JSON.stringify(f.agent.session.messages)+f.agent.session.agent.state.systemPrompt;
      assert(!context.includes('SYNTHETIC-MEMORY-SECRET'));assert(!context.includes('SYNTHETIC-SKILL-SECRET'));assert(!context.includes('synthetic-derived-fact'));
      assert.equal(f.agent.session.messages.length,safeHistory?2:0);assert.equal((await f.state.current(f.id)).revision,1);
      assert(f.agent.session.sessionManager.getEntries().some(e=>e.type==='custom'&&e.customType==='xiaozhi.model-restore.commit.v1'));
      await f.assemble(pro);assert.equal(f.agent.session.model.id,pro);assert(!JSON.stringify(f.agent.session.messages).includes('SYNTHETIC-'));
      const current=await f.state.current(f.id);await f.coordinator.switch(f.agent.session,current,f.agent.registeredModel(flash));await f.assemble(flash);
      assert.equal(f.agent.contextPolicy().window,32768);assert.equal((await f.state.current(f.id)).revision,2);
    });
  }
  await check('Restore intent before SDK empty-branch bootstrap survives exit, without inventing a user message',async()=>{
    const f=await fixture();await f.coordinator.switch(f.agent.session,f.initial,f.agent.registeredModel(pro));f.revoke();
    await assert.rejects(f.assemble(pro,{beforeExit:true}),/restore-before-exit/);await f.assemble(pro);
    assert.equal(f.agent.session.messages.length,0);assert.equal(f.agent.session.model.id,pro);assert.equal((await f.state.current(f.id)).revision,1);
  });
  for(const safeHistory of [false,true])await check(`Native restoration already written before exit is recovered without repeating that model change; safeHistory=${safeHistory}`,async()=>{
    const f=await fixture({safeHistory});await f.coordinator.switch(f.agent.session,f.initial,f.agent.registeredModel(pro));f.revoke();
    await assert.rejects(f.assemble(pro,{afterNativeExit:true}),/restore-native-exit/);
    const manager=f.manager(),count=manager.getEntries().filter(e=>e.type==='model_change').length;
    const current=await f.coordinator.authorize(manager,f.id);assert.equal(current.model,pro);assert.equal(manager.getEntries().filter(e=>e.type==='model_change').length,count);
    const bytes=fs.readFileSync(f.file);await f.coordinator.authorize(manager,f.id);assert(fs.readFileSync(f.file).equals(bytes));
    await f.assemble(pro);assert(!JSON.stringify(f.agent.session.messages).includes('SYNTHETIC-MEMORY-SECRET'));
  });
  await check('Forged model origin never bypasses the original education/memory/control snapshot fingerprint',async()=>{
    const f=await fixture();const previous=f.agent.sessionFile;f.agent.dispose();
    await assert.rejects(createPiXiaozhiSession({stateRoot:path.join(f.root,f.id),workspace:path.join(f.root,f.id,'workspace'),apiKey:'synthetic-key',model:pro,sessionFile:previous,
      modelHistory:{authorize:async()=>({originModel:'foreign-model',model:pro}),beforeLoad:async()=>{},align:async()=>{}}}),/configuration/);
  });
  await check('Full request capacity includes system and output before allowing an idle switch',async()=>{
    const f=await fixture();assert.throws(()=>f.agent.assertSwitchCapacity({...caps(pro),contextWindow:100}),/context_limit/);
    assert.equal((await f.state.current(f.id)).revision,0);
  });
  await check('Malformed restore receipt and unknown versions are rejected by production identity admission',async()=>{
    const f=await fixture();await f.coordinator.switch(f.agent.session,f.initial,f.agent.registeredModel(pro));f.revoke();await f.assemble(pro);f.agent.dispose();
    const rows=fs.readFileSync(f.file,'utf8').trimEnd().split('\n').map(JSON.parse),receipt=rows.find(e=>e.customType==='xiaozhi.model-restore.commit.v1');receipt.data.revision=99;
    fs.writeFileSync(f.file,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');await assert.rejects(f.coordinator.authorize(f.manager(),f.id),/configuration/);
  });
  await check('Native manual compaction after a switch uses the actual Pro model, then same-history Flash can reopen the compacted branch',async()=>{
    const f=await fixture({safeHistory:true});await f.coordinator.switch(f.agent.session,f.initial,f.agent.registeredModel(pro));await f.assemble(pro);
    const manager=f.agent.session.sessionManager;
    manager.appendMessage({role:'user',content:'独立合成课堂资料。'.repeat(900),timestamp:Date.now()});manager.appendMessage({...assistant('已记录合成课堂资料。'),model:pro});
    manager.appendMessage({role:'user',content:'保留最新任务标记 COMPACT-MODEL-317。',timestamp:Date.now()});manager.appendMessage({...assistant('保留 COMPACT-MODEL-317。'),model:pro});
    await f.assemble(pro);summaryMode=true;let result;try{result=await f.agent.compact();}finally{summaryMode=false;}
    assert(result.ok,result.error);assert(summaryModels.length>=1&&summaryModels.every(model=>model===pro));
    await f.assemble(pro);const current=await f.state.current(f.id);await f.coordinator.switch(f.agent.session,current,f.agent.registeredModel(flash));await f.assemble(flash);
    assert.equal(f.agent.session.model.id,flash);assert(f.agent.session.sessionManager.getEntries().some(entry=>entry.type==='compaction'));assert.equal((await f.state.current(f.id)).revision,2);
  });
  await check('No unexpected or live provider requests; native summary uses one controlled request',async()=>{assert.equal(requests,0);assert.equal(summaryModels.length,1);});report.success=true;
}catch(error){report.error={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}
finally{globalThis.fetch=priorFetch;for(const f of fixtures)f.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({output,success:report.success,checks:checks.length,unexpectedRequests:requests,controlledSummaryRequests:summaryModels.length,...(report.error?{error:report.error}:{})},null,2));
