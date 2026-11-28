import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {SessionManager} from '@earendil-works/pi-coding-agent';
import {profile,wilsonLower} from '../../src/main/xiaozhi-agent/capabilities/intelligence/evidence.ts';
import {advise,capabilityGap} from '../../src/main/xiaozhi-agent/capabilities/intelligence/selection.ts';
import {classifyProviderObservation,createProviderHealth} from '../../src/main/xiaozhi-agent/capabilities/intelligence/health.ts';
import {createCapabilityReplanGuard} from '../../src/main/xiaozhi-agent/capabilities/intelligence/replan.ts';
import {safeProviderSwitch} from '../../src/main/xiaozhi-agent/capabilities/intelligence/switch.ts';
import {createContextAdapter} from '../../src/main/xiaozhi-agent/context/authority.ts';
import {createCompactionBudget} from '../../src/main/xiaozhi-agent/context/budget.ts';
import {contextCacheReceipt,requestPrefixDigest} from '../../src/main/xiaozhi-agent/context/model-cache.ts';
import {validTaskCapabilityRequirements} from '../../src/shared/xiaozhi-task-planning.ts';
import {TASK_PLAN_SCHEMA,validTaskPlanInput} from '../../src/shared/xiaozhi-task-plan.ts';

const root=path.resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||'test-results/xiaozhi-agent/d2-foundation');
const output=fs.mkdtempSync(path.join(root,'foundation-'));
const db=new DatabaseSync(path.join(output,'d2.sqlite'));
const sql={
  run:async(statement,args=[])=>db.prepare(statement).run(...args),
  all:async(statement,args=[])=>db.prepare(statement).all(...args),
};
sql.transaction=async callback=>{
  db.exec('BEGIN IMMEDIATE');
  try{const result=await callback(sql);db.exec('COMMIT');return result;}
  catch(error){db.exec('ROLLBACK');throw error;}
};
const checks=[];
const check=async(name,callback)=>{await callback();checks.push(name);console.log('PASS '+name);};
const now=Date.now();
await check('Capability dependency plans admit backward-compatible, acyclic references only',()=>{
  const make=(capabilityId,dependsOn)=>({capabilityId,contractVersion:'1.0.0',required:[],optional:[],conditions:[],
    ...(dependsOn?{dependsOn}:{})});
  const input={schemaVersion:TASK_PLAN_SCHEMA,expectedRevision:0,requirementsVersion:1,reason:'依赖计划',
    steps:[{id:'review',text:'教师核对',dependsOn:[],reported:'pending',kind:'human'}],
    capabilityRequirements:[make('write',['read']),make('read')]};
  assert(validTaskPlanInput(input));
  assert(validTaskCapabilityRequirements([make('read')]));
  for(const dependencies of [[make('read',['read'])],[make('read',['missing'])],
    [make('read',['write']),make('write',['read'])],[make('read'),make('read')]])assert(!validTaskCapabilityRequirements(dependencies));
});
await check('Managed canary samples stay rate limited and never inflate runtime confidence',async()=>{
  const health=createProviderHealth(sql);
  const scope={kind:'binding',id:'synthetic-canary',version:'1.0.0',sourceHash:'canary'};
  await health.observe(scope,25,'success','probe');
  await health.observe(scope,27,'success','probe');
  const record=await health.view(scope);
  assert.equal(record.probeCount,1);
  assert.equal(record.count,0);
  assert.equal(record.trust,'UNKNOWN');
});
const candidate=(providerId,latency,oks)=>{
  const metrics=profile(oks.map((ok,i)=>({at:now-i,ok,latencyMs:latency})),[],now);
  return {selection:{providerId,providerVersion:'1.0.0',contractVersion:'1.0.0',level:'full',missingRequirements:[],limitations:[]},health:'CLOSED',metrics};
};
const reliable=candidate('reliable',240,[true,true,true,true,true,true,true,true]);
const fast=candidate('fast',140,[true,true,true,true,true,false,true,true]);
const policy={preference:'reliability'};
const percentiles=values=>{
  values.sort((a,b)=>a-b);
  return {samples:values.length,p50Ms:values[Math.floor(values.length*.50)],p95Ms:values[Math.floor(values.length*.95)]};
};
try {
  await check('Single candidate, developer preference, stale evidence and dominant evidence skip AI',async()=>{
    const seen=async()=>{throw Error('should not call');};
    assert.equal((await advise([fast],policy,undefined,seen)).reason,'single_candidate');
    assert.equal((await advise([fast,reliable],{...policy,preferredProvider:'fast'},undefined,seen)).reason,'developer_preference');
    const cold=candidate('cold',1,[true]);
    assert.equal((await advise([cold,fast],policy,undefined,seen)).confidence,'INSUFFICIENT_EVIDENCE');
    assert.equal((await advise([fast,candidate('better',10,[true,true,true,true,true,true,true,true])],policy,undefined,seen)).reason,'pareto_dominant');
    assert(wilsonLower(1,1)<wilsonLower(8,8));
    assert.equal(profile([{at:now-3_600_001,ok:true,latencyMs:1}],[],now).reliability,null);
  });
  await check('Ambiguous selection validates small offered set, rejects invented and open provider, and respects quality floor',async()=>{
    const unavailable={...fast,health:'OPEN',selection:{...fast.selection,providerId:'open'}};
    const trusted=[fast,reliable,unavailable];
    const accepted=await advise(trusted,policy,undefined,async offered=>{
      assert.deepEqual(new Set(offered.map(item=>item.selection.providerId)),new Set(['reliable','fast']));
      return {providerId:'fast',confidence:'supported'};
    });
    assert.equal(accepted.candidate.selection.providerId,'fast');
    assert.equal(accepted.ai,'selected');
    assert.equal((await advise(trusted,policy,undefined,async()=>({providerId:'open',confidence:'supported'}))).ai,'rejected');
    const abort=new AbortController();
    const failed=advise(trusted,policy,abort.signal,async()=>new Promise(()=>{}));abort.abort();
    assert.equal((await failed).ai,'rejected');
    assert.equal((await advise(trusted,{...policy,minimumQuality:.5})).candidate,null);
  });
  const health=createProviderHealth(sql);
  const scope={kind:'binding',id:'file:provider:default',version:'1.0.0',sourceHash:'a'.repeat(64)};
  const sibling={...scope,id:'ocr:provider:default'};
  const observeMs=[];
  await check('Real SQLite persists Cockatiel OPEN, excludes non-runtime failures and separates binding and quality data',async()=>{
    assert.equal((await health.view(scope)).trust,'UNKNOWN');
    for(const error of ['cancelled','invalid_input','not_found','permission_denied','approval_denied','invalid_output'])
      assert.equal(classifyProviderObservation(Error(error)),'ignored');
    for(const error of ['process_crashed','connection_failed','timeout','upstream_5xx'])
      assert.equal(classifyProviderObservation(Error(error)),'fault');
    assert.equal(classifyProviderObservation({status:503}),'fault');
    for(let i=0;i<3;i++){const begin=performance.now();await health.observe(scope,5,'fault');observeMs.push(performance.now()-begin);}
    assert.equal((await createProviderHealth(sql).view(scope)).state,'OPEN');
    assert.equal((await health.view(sibling)).state,'CLOSED');
    await health.recordQuality(scope,{passed:false,evidence:'quality:owned-fixture'});
    assert.equal((await health.view(scope)).qualityCount,1);
    assert.equal((await health.view(scope)).count,3);
    assert.equal((await createProviderHealth(sql,()=>Date.now()+30001).view(scope)).state,'HALF_OPEN');
  });
  await check('Planner returns a bounded missing-capability gap, and a new requirements version resets replan limit',()=>{
    const blocked={requirementsVersion:1,preflight:{checks:{capabilities:{state:'blocked'}}},capabilityRequirements:[{capabilityId:'a'}]};
    const allows=createCapabilityReplanGuard();
    assert(allows(blocked)); assert(!allows(blocked)); assert(allows({...blocked,requirementsVersion:2}));
    assert.equal(capabilityGap({capabilityId:'a',selectedProviders:[],excludedProviders:[{missingRequirements:['read']}],
      blockedReasons:['permission_denied'],status:'blocked_permission'}).next,'review_current_authority');
  });
  await check('Cockatiel restores HALF_OPEN and accepts a successful recovery, while effect history blocks unsafe provider refresh',async()=>{
    const probeScope={...scope,id:'separate:process:instance'};
    const breaker=createProviderHealth(sql,Date.now,80);
    for(let i=0;i<3;i++)await breaker.observe(probeScope,1,'fault');
    await new Promise(resolve=>setTimeout(resolve,90));
    const restored=createProviderHealth(sql,Date.now,80);
    assert.equal((await restored.view(probeScope)).state,'HALF_OPEN');
    await restored.observe(probeScope,1,'success');
    assert.equal((await restored.view(probeScope)).state,'CLOSED');
    const request={capabilityId:'file'};
    const safe={task:{state:'active'},checkpointId:'xitcp',request,previous:request,effects:[]};
    assert(safeProviderSwitch(safe));
    for(const state of ['intent','executing','unknown','committed','reconciled','compensated']){
      assert(!safeProviderSwitch({...safe,effects:[{state,contract:{effect:'local_write',capabilityId:'file'}}]}));
    }
    assert(!safeProviderSwitch({...safe,previous:{capabilityId:'another'}}));
  });
  await check('Pi native history survives invalid, competing and interrupted compaction, and publishes one validated summary',async()=>{
    const manager=SessionManager.create(output,output);
    const first=manager.appendMessage({role:'user',content:'原文 保留这条记录',timestamp:now});
    const second=manager.appendMessage({role:'user',content:'后续合法消息',timestamp:now+1});
    let facts={p0:['task:fixture','checkpoint:fixture'],p1:['step:local'],effectInProgress:false};
    const adapter=createContextAdapter(manager,async()=>facts);
    let lease=await adapter.begin('manual');
    await assert.rejects(adapter.begin('threshold'),/compaction_busy/);
    await assert.rejects(lease.validate({summary:'例',firstKeptEntryId:'invented',tokensBefore:10}),/compaction_failed/);
    lease.release();
    const cancel=new AbortController();lease=await adapter.begin('manual',cancel.signal);cancel.abort();
    await assert.rejects(lease.validate({summary:'例',firstKeptEntryId:second,tokensBefore:10}));
    lease.release();
    assert.equal(adapter.previous(),null);
    facts={...facts,effectInProgress:true};await assert.rejects(adapter.begin('threshold'),/compaction_busy/);
    facts={...facts,effectInProgress:false};lease=await adapter.begin('manual');
    const draft=await lease.validate({summary:'合成摘要，引用原始记录',firstKeptEntryId:second,tokensBefore:10});
    manager.appendCompaction(draft.summary,draft.firstKeptEntryId,draft.tokensBefore,draft.details);
    lease.release();
    assert.equal(adapter.previous().details.xiaozhiContext.engine,'pi-native@1.0.2');
    assert.equal(manager.getEntry(first).message.content,'原文 保留这条记录');
    lease=await adapter.begin('manual');
    await assert.rejects(lease.validate({summary:'重复',firstKeptEntryId:second,tokensBefore:10}),/compaction_failed/);
    lease.release();
  });
  await check('A native metadata anchor retains the exact next message and cannot repeat its effective compaction boundary',async()=>{
    const manager=SessionManager.create(output,output);
    manager.appendMessage({role:'user',content:'待压缩旧文本',timestamp:now});
    const boundary=manager.appendCustomEntry('xiaozhi.memory.run.v1',{runId:'synthetic'});
    const kept=manager.appendMessage({role:'user',content:'保留新任务',timestamp:now+1});
    const tail=manager.appendCustomEntry('xiaozhi.compaction.usage.v1',{});
    const adapter=createContextAdapter(manager);
    let lease=await adapter.begin('manual');
    await assert.rejects(lease.validate({summary:'末尾没有可保留上下文',firstKeptEntryId:tail,tokensBefore:20}),/compaction_failed/);
    const draft=await lease.validate({summary:'旧文本摘要',firstKeptEntryId:boundary,tokensBefore:20});
    assert.equal(draft.firstKeptEntryId,boundary);
    manager.appendCompaction(draft.summary,draft.firstKeptEntryId,draft.tokensBefore,draft.details);
    lease.release();
    assert(JSON.stringify(manager.buildSessionContext().messages).includes('保留新任务'));
    lease=await adapter.begin('manual');
    await assert.rejects(lease.validate({summary:'同一上下文重复压缩',firstKeptEntryId:kept,tokensBefore:20}),/compaction_failed/);
    lease.release();
  });
  await check('Dynamic thresholds, output reservation and actual wire-prefix hashing are deterministic',()=>{
    let at=1234; const budget=createCompactionBudget(32000,4096,()=>at);
    assert(budget.low<budget.high);assert(budget.observe(budget.high));budget.committed();
    at+=10;assert(!budget.observe(budget.high));assert(budget.observe(32001));
    at+=501;budget.observe(budget.low);assert(budget.observe(budget.high));
    const base={model:'deepseek',messages:[{role:'system',content:'稳定'}, {role:'user',content:'动态 A'}],tools:[{name:'one'}]};
    assert.equal(requestPrefixDigest(base),requestPrefixDigest({...base,messages:[base.messages[0],{role:'user',content:'动态 B'}]}));
    assert.notEqual(requestPrefixDigest(base),requestPrefixDigest({...base,tools:[]}));
    const usage=contextCacheReceipt({input:3,output:2,cacheRead:7,cacheWrite:0},{kind:'reply',model:'deepseek',prefix:requestPrefixDigest(base),latencyMs:10});
    assert.equal(usage.inputTokens,10);assert.equal(usage.cacheHitTokens,7);assert.equal(usage.cacheMissTokens,3);
  });
  const timings=[];
  let aiCalls=0;
  for(let i=0;i<500;i++){
    const begin=performance.now();
    await advise([fast],policy,undefined,async()=>{aiCalls++;});
    timings.push(performance.now()-begin);
  }
  assert.equal(aiCalls,0);
  const result={success:true,checks,output,benchmarks:{directSingleCandidate:percentiles(timings),observerWrite:percentiles(observeMs),aiCalls}};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally {db.close();}
