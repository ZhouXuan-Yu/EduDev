import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sqlite3 from 'sqlite3';
const {createCapabilityRegistry}=await import('../../src/main/xiaozhi-agent/capabilities/registry.ts');
const {serializeStateWrites}=await import('../../src/main/xiaozhi-agent/serialized-state-sql.ts');
const {nativeStatDeclarations,NATIVE_STAT_CAPABILITY}=await import('../../src/main/xiaozhi-agent/capabilities/native-stat.ts');
const {protocolHash}=await import('../../src/main/xiaozhi-agent/capabilities/validation.ts');
const {providerResult,validProviderResult,PROVIDER_ERROR_CODES}=await import('../../src/main/xiaozhi-agent/capabilities/provider-contract.ts');
const {createCapabilityTaskRuntime}=await import('../../src/main/xiaozhi-agent/capabilities/runtime.ts');
const {createToolExecutionBoundary}=await import('../../src/main/xiaozhi-agent/tools/execution-bound.ts');
const {SessionExecutionRegistry}=await import('../../src/main/xiaozhi-agent/vendor/hana/lib/session-execution-registry.ts');
const {toolManifest}=await import('../../src/main/xiaozhi-agent/tools/manifest.ts');
const {createCapabilityResolver}=await import('../../src/main/xiaozhi-agent/capabilities/resolver.ts');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-capability-phase2-contract-'));
const checks=[],connections=[];
const report={success:false,checks,root,boundaries:['Real SQLite version migration and rollback','Provider result schema and original execution-boundary concurrency fixtures','Real Provider and Pi paths are in the separate production suite']};
const check=async(name,action)=>{await action();checks.push({name,pass:true});console.log('PASS '+name);};
async function database(filename=':memory:'){
  const db=await new Promise((resolve,reject)=>{const opened=new sqlite3.Database(filename,error=>error?reject(error):resolve(opened));});connections.push(db);
  const sql={run:(query,args=[])=>new Promise((resolve,reject)=>db.run(query,args,error=>error?reject(error):resolve())),change:(query,args=[])=>new Promise((resolve,reject)=>db.run(query,args,function(error){error?reject(error):resolve(this.changes);})),all:(query,args=[])=>new Promise((resolve,reject)=>db.all(query,args,(error,rows)=>error?reject(error):resolve(rows)))};
  sql.transaction=async action=>{await sql.run('BEGIN IMMEDIATE');try{const result=await action(sql);await sql.run('COMMIT');return result;}catch(error){await sql.run('ROLLBACK');throw error;}};
  return{db,sql:serializeStateWrites(sql)};
}
const request={capabilityId:NATIVE_STAT_CAPABILITY.id,contractVersion:'1.0.0',required:[],optional:[],conditions:[],platform:process.platform,localOnly:true,budget:{latencyMs:30000,resourceUnits:1}};
const owner={sessionId:'aisession_'+randomUUID(),runId:'run_fixture',generation:1};
const snapshot={schema:'xiaozhi.capability-snapshot.v1',snapshotId:'xicap_'+randomUUID(),taskId:'xitask_'+'a'.repeat(64),...owner,capabilityId:request.capabilityId,registryRevision:1,requirement:request,selection:{providerId:'edu.native.hana-file-stat',providerVersion:'1.0.0',contractVersion:'1.0.0',level:'full',missingRequirements:[],limitations:[]},providerHash:'b'.repeat(64),createdAt:new Date().toISOString(),evidenceRefs:['fixture'],previousSnapshotId:null,refreshReason:'initial'};
const context={taskId:snapshot.taskId,...owner,stepId:null,callId:'call_fixture',signal:new AbortController().signal,snapshot,grantRef:'c'.repeat(64),idempotencyKey:'d'.repeat(64),budget:{timeoutMs:30000,resourceUnits:1}};
try{
 await check('Phase1-shaped SQLite registry migrates idempotently and retains old version metadata',async()=>{
  const {sql}=await database(path.join(root,'old-registry.sqlite'));
  const old=nativeStatDeclarations()[0];old.provider.version='1.0.0';old.binding.providerVersion='1.0.0';
  const document={revision:7,definitions:[old.definition],providers:[old.provider],bindings:[old.binding]};
  await sql.run('CREATE TABLE xiaozhi_capability_registry_v1(id INTEGER PRIMARY KEY,revision INTEGER,document_json TEXT,document_hash TEXT)');
  await sql.run('INSERT INTO xiaozhi_capability_registry_v1 VALUES(1,?,?,?)',[document.revision,JSON.stringify(document),protocolHash(document)]);
  const registry=createCapabilityRegistry(sql,{officialProviderIds:[old.provider.id]});await registry.migrate();await registry.migrate();
  assert.deepEqual(await registry.snapshot(),document);assert.equal((await registry.providerVersion(old.provider.id,'1.0.0',old.definition.id)).provider.source.packageHash,old.provider.source.packageHash);
  const upgraded=structuredClone(old);upgraded.provider.version='1.1.0';upgraded.binding.providerVersion='1.1.0';
  await registry.register(upgraded.definition,upgraded.provider,upgraded.binding);
  assert(await registry.providerVersion(old.provider.id,'1.0.0',old.definition.id));assert(await registry.providerVersion(old.provider.id,'1.1.0',old.definition.id));
 });
 await check('Same published software version cannot substitute source hash reference or Contract',async()=>{
  const {sql}=await database();const declared=nativeStatDeclarations()[0];const registry=createCapabilityRegistry(sql,{officialProviderIds:[declared.provider.id]});await registry.migrate();await registry.register(declared.definition,declared.provider,declared.binding);const before=await registry.snapshot();
  for(const change of [value=>{value.provider.source.packageHash='f'.repeat(64);value.binding.providerHash=value.provider.source.packageHash;},value=>value.provider.source.reference='changed-source',value=>value.binding.adapterVersion='2.0.0']){
    const changed=structuredClone(declared);change(changed);await assert.rejects(registry.register(changed.definition,changed.provider,changed.binding),/version_immutable/);assert.deepEqual(await registry.snapshot(),before);
  }
 });
 await check('Failed registry COMMIT rolls back current pointer and immutable archive together',async()=>{
  const {sql}=await database();const declared=nativeStatDeclarations()[0];const registry=createCapabilityRegistry(sql,{officialProviderIds:[declared.provider.id]});await registry.migrate();await registry.register(declared.definition,declared.provider,declared.binding);const before=await registry.snapshot();
  await sql.run("CREATE TRIGGER fail_registry BEFORE UPDATE ON xiaozhi_capability_registry_v1 BEGIN SELECT RAISE(ABORT,'fixture commit failure'); END");
  const next=structuredClone(declared);next.provider.version='2.0.0';next.binding.providerVersion='2.0.0';
  await assert.rejects(registry.register(next.definition,next.provider,next.binding),/fixture commit failure/);assert.deepEqual(await registry.snapshot(),before);assert.equal(await registry.providerVersion(next.provider.id,'2.0.0',next.definition.id),null);
 });
 await check('Persisted Provider version bytes reject content tampering',async()=>{
  const {sql}=await database();const declared=nativeStatDeclarations()[0];const registry=createCapabilityRegistry(sql,{officialProviderIds:[declared.provider.id]});await registry.migrate();await registry.register(declared.definition,declared.provider,declared.binding);
  await sql.run("UPDATE xiaozhi_capability_provider_versions_v1 SET document_json=replace(document_json,'ready','disabled')");await assert.rejects(registry.providerVersion(declared.provider.id,declared.provider.version,declared.definition.id),/version_corrupt/);
 });
 await check('Concurrent unrelated registration does not invalidate the fixed executable selection',async()=>{
  const {sql}=await database();const declared=nativeStatDeclarations()[0];const registry=createCapabilityRegistry(sql,{officialProviderIds:[declared.provider.id]});await registry.migrate();await registry.register(declared.definition,declared.provider,declared.binding);let installed=false;
  const resolver=createCapabilityResolver(registry,async()=>{
    if(!installed){installed=true;const external=structuredClone(declared);external.definition.id='edu.fixture.unrelated.read';external.provider.id='mcp.fixture.unrelated';external.provider.type='mcp';external.provider.runtime='managed';external.provider.publisher={id:'fixture',official:false};external.binding.capabilityId=external.definition.id;external.binding.providerId=external.provider.id;external.binding.conformance.capabilityId=external.definition.id;await registry.register(external.definition,external.provider,external.binding);}
    return true;
  });
  const result=await resolver.resolveVersion(request,declared.provider.id,declared.provider.version,declared.provider.source.packageHash);assert.equal(result.selectedProviders[0].providerId,declared.provider.id);
 });
 await check('All standard errors carry safe code retry side effect and execution provenance',async()=>{
  for(const code of PROVIDER_ERROR_CODES){const result=providerResult(context,undefined,Error(code));assert(validProviderResult(result));assert.equal(result.error.code,code);assert.equal(result.executionId,context.callId);assert.equal(result.provenance.providerHash,snapshot.providerHash);}
  const unknown=providerResult(context,undefined,Error('private filesystem detail'));assert.equal(unknown.error.code,'provider_unavailable');assert(!JSON.stringify(unknown).includes('private filesystem'));
 });
 await check('R06 unified result consumes current partial assessment and preserves original Snapshot',async()=>{
  const native={status:'partial',data:{path:'资料.txt',size:7,version:'e'.repeat(64)},conformance:{level:'partial',missingRequirements:['mime']}};
  const result=providerResult(context,native);assert.equal(result.conformance.level,'partial');assert.deepEqual(result.conformance.missingRequirements,['mime']);assert.equal(snapshot.selection.level,'full');assert(validProviderResult(result));
 });
 await check('Result schema rejects unknown fields accessors and invalid success output',async()=>{
  const result=providerResult(context,{status:'completed',data:{path:'资料.txt',size:7,version:'e'.repeat(64)},conformance:{level:'full',missingRequirements:[]}});
  assert(!validProviderResult({...result,credentials:'hidden'}));let reads=0;assert(!validProviderResult(Object.defineProperty({...result},'data',{enumerable:true,get(){reads++;return{};}})));assert.equal(reads,0);
  assert.throws(()=>providerResult(context,{status:'completed',data:{path:'资料.txt',size:-1,version:'e'.repeat(64)},conformance:{level:'full',missingRequirements:[]}}),/invalid_output/);
 });
 await check('Readonly Bootstrap effects stay independent of a fabricated write plan',async()=>{
  assert.equal(toolManifest('capability_execute').effect,'safe_read');assert.equal(toolManifest('capability_inspect').effect,'safe_read');assert.equal(toolManifest('capability_resolve').effect,'local_cache');
 });
 await check('Actual Boundary retains its effect fence until timed-out underlying execution settles',async()=>{
  let release,started;const held=new Promise(resolve=>{release=resolve;});const entered=new Promise(resolve=>{started=resolve;});
  const boundary=createToolExecutionBoundary({sessionId:owner.sessionId,workspaceKey:'unit-effect-'+randomUUID(),registry:new SessionExecutionRegistry(),epoch:()=>owner.runId,current:()=>true,waiting:()=>false,onWaiting:()=>()=>{},beforeDelivery:async()=>{},attempt:async()=>{},timeout:()=>60});
  const pending=boundary.execute({name:'office_create_text',label:'Bounded fixture',description:'State-only effect fixture',parameters:{type:'object',properties:{},additionalProperties:false},execute:async()=>{started();await held;return{content:[],details:{success:true}};}},'effect_fixture',{},new AbortController().signal);
  await entered;assert.equal(boundary.activeEffectCount(),1);
  const runtime=createCapabilityTaskRuntime({owner,taskId:snapshot.taskId,registry:{},snapshots:{current:async()=>null},native:{resolve:async()=>{throw Error('Provider must not run');}},current:()=>true,canRefresh:()=>boundary.activeEffectCount()===0,workspace:async()=>{throw Error('No IO expected');},persist:async action=>action()});
  await assert.rejects(runtime.resolve(request,undefined,true),/refresh_busy/);const timed=await pending;assert(timed.isError);assert.equal(boundary.activeEffectCount(),1);release();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(boundary.activeEffectCount(),0);
 });
 report.success=true;
}catch(error){report.error=error.stack||String(error);console.error(report.error);process.exitCode=1;}
finally{for(const db of connections)await new Promise(resolve=>db.close(()=>resolve()));fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:checks.length,root,error:report.error}));}
