import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {DatabaseSync} from 'node:sqlite';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import {createTaskState} from '../../src/main/xiaozhi-agent/tasks/task-state';
import {NATIVE_STAT_CAPABILITY,NATIVE_STAT_PROVIDER_IDS} from '../../src/main/xiaozhi-agent/capabilities/native-stat';
import {loadNativeStatExecutable,type NativeStatArtifactManifest} from '../../src/main/xiaozhi-agent/capabilities/native-stat-executable';
import {createNativeStatRequire} from '../../src/main/xiaozhi-agent/capabilities/native-stat-require';
import {validProviderResult,type ProviderSnapshot} from '../../src/main/xiaozhi-agent/capabilities/provider-contract';
import {protocolHash} from '../../src/main/xiaozhi-agent/capabilities/validation';

const output = process.argv[2];
const externalRoot = process.argv[3];
const dataRoot = path.join(externalRoot, 'data');
const workspace = path.join(externalRoot, 'workspace');
const dependencyMarker = path.join(externalRoot, 'untrusted-dependency-loaded.txt');
for (const name of ['ipaddr.js', 'undici', 'jsdom']) {
  const directory = path.join(dataRoot, 'node_modules', name);
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({name, main: 'index.cjs'}));
  const markerCode = `require('node:fs').appendFileSync(${JSON.stringify(dependencyMarker)},${JSON.stringify(name + '\n')});throw Error('untrusted fixture dependency executed');`;
  fs.writeFileSync(path.join(directory, 'index.cjs'), markerCode);
}
fs.mkdirSync(workspace);fs.writeFileSync(path.join(workspace,'资料.txt'),'synthetic native artifact evidence');
const fixtures=JSON.parse(fs.readFileSync(path.join(output,'fixtures.json'),'utf8')) as Record<string,{manifest:NativeStatArtifactManifest;path:string}>;
const suiteStarted = performance.now();
let priorCheckAt = suiteStarted;
const checks:{name:string;pass:boolean;elapsedMs:number;sincePreviousCheckMs:number}[]=[];
const report:{success:boolean;checks:typeof checks;error?:string;performance?:unknown;legacyMigration?:unknown;boundary:string}={success:false,checks,boundary:'Actual Electron production host, locked Pi runtime and original Boundary/Task/Journal dispatch, real SQLite and real Native artifacts. Synthetic loopback SSE. Real model requests 0.'};
const check = (name: string) => {
  const now = performance.now();
  checks.push({name, pass: true, elapsedMs: now - suiteStarted, sincePreviousCheckMs: now - priorCheckAt});
  priorCheckAt = now;
  console.log('PASS ' + name);
};
process.env.DEEPSEEK_API_KEY='synthetic-phase2-loopback';process.env.DEEPSEEK_MODEL='deepseek-flash';
const originalFetch=net.fetch;
let store=new OmniEduStore(dataRoot);
let host:ReturnType<typeof createXiaozhiProductionHost>|undefined;
let sessionId='',scenario='activation',stage=0,fixtureFailure:unknown;
const activatedProviderId='edu.native.activated-file-stat';
let v2CallsBeforeInitial=0;
let callsBeforeRequiredLoss=0;
let first:ProviderSnapshot|undefined,second:ProviderSnapshot|undefined;
const events:{kind:string;[key:string]:unknown}[]=[];
const request={capabilityId:NATIVE_STAT_CAPABILITY.id,contractVersion:'1.0.0',required:[],optional:[],conditions:[]};
const wireRequest={...request,platform:process.platform,localOnly:true,budget:{latencyMs:30000,resourceUnits:1}};
const calls=new Map<string,string>();
let stopStarted:()=>void=()=>{};
const stopToolStarted=new Promise<void>(resolve=>{stopStarted=resolve;});
async function task(){return createTaskState(store.xiaozhiState.sql,{sanitize:async text=>text}).latest(sessionId);}
async function snapshots(){const current=await task();assert(current);return store.xiaozhiState.capabilitySnapshots.history(current.id);}
async function verifyActualPhase1Migration(){
  const parent=path.resolve('test-results/xiaozhi-agent');
  const candidates=fs.readdirSync(parent).filter(name=>name.startsWith('pi-goal-task-store-')||name.startsWith('capability-phase1-production-'));
  candidates.sort((left,right)=>Number(right.startsWith('pi-goal-task-store-'))-Number(left.startsWith('pi-goal-task-store-'))||left.localeCompare(right));
  let source='';
  for(const name of candidates){
    const filename=path.join(parent,name,'data/app.db');if(!fs.existsSync(filename))continue;
    const db=new DatabaseSync(filename,{readOnly:true});
    try{
      const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>String(row.name));
      if(tables.includes('xiaozhi_capability_registry_v1')&&!tables.includes('xiaozhi_capability_provider_versions_v1')){source=filename;break;}
    }finally{db.close();}
  }
  assert(source,'Actual Phase1 database fixture is required from the prior phase acceptance');
  const db=new DatabaseSync(source,{readOnly:true});
  const queries=["SELECT * FROM students ORDER BY id","SELECT * FROM ai_conversation_sessions ORDER BY id","SELECT * FROM ai_conversation_messages ORDER BY id","SELECT key,value_json FROM app_settings WHERE key LIKE 'xiaozhi.task.v1:%' ORDER BY key"];
  let facts:string[],old:any;
  try{facts=queries.map(query=>JSON.stringify(db.prepare(query).all()));old=JSON.parse(String(db.prepare('SELECT document_json FROM xiaozhi_capability_registry_v1 WHERE id=1').get()!.document_json));}finally{db.close();}
  const cloneRoot=path.join(output,'actual-phase1-copy');fs.mkdirSync(cloneRoot);fs.copyFileSync(source,path.join(cloneRoot,'app.db'));
  const clone=new OmniEduStore(cloneRoot);
  try{
    await clone.init();
    for(let index=0;index<queries.length;index++)assert.equal(JSON.stringify(await clone.xiaozhiState.sql.all(queries[index])),facts![index]);
    for(const provider of old.providers){assert(await clone.xiaozhiState.capabilities.providerVersion(provider.id,provider.version,old.definitions[0].id));if(provider.health==='revoked')assert.equal((await clone.xiaozhiState.capabilities.snapshot()).providers.find(item=>item.id===provider.id)?.health,'revoked');}
    assert.equal((await clone.xiaozhiState.sql.all('SELECT count(*) AS n FROM xiaozhi_capability_snapshots_v1'))[0].n,0);
    report.legacyMigration={source,cloneRoot,oldRevision:old.revision,oldProviderVersions:old.providers.map((item:any)=>({id:item.id,version:item.version})),preservedFactQueries:queries.length,taskFactRows:JSON.parse(facts![3]).length};
    check('Actual prior Phase1 database copy migrates with business Task facts and revoked Provider preserved');
  }finally{await clone.close();}
}
function lastTool(messages:Record<string,unknown>[],name:string){
  const message=[...messages].reverse().find(item=>item.role==='tool'&&calls.get(String(item.tool_call_id))===name);
  assert(message,'Missing actual tool response '+name);
  const text=typeof message.content==='string'?message.content:JSON.stringify(message.content);
  return JSON.parse(text.split('\n')[0]);
}
function send(response:http.ServerResponse,name?:string,args?:unknown){
  const id='p2_'+randomUUID().replaceAll('-','');
  if(name)calls.set(id,name);
  response.writeHead(200,{'content-type':'text/event-stream'});
  const base={id:'synthetic-phase2',object:'chat.completion.chunk',created:1,model:'deepseek-flash'};
  const delta=name?{role:'assistant',reasoning_content:'合成本地接线验证。',tool_calls:[{index:0,id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}:{role:'assistant',content:'合成本地能力验证已完成。'};
  response.write('data: '+JSON.stringify({...base,choices:[{index:0,delta,finish_reason:null}]})+'\n\n');
  response.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{},finish_reason:name?'tool_calls':'stop'}],usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120}})+'\n\n');
  response.end('data: [DONE]\n\n');
}
async function updateProvider(id:string,action:(provider:any,binding:any)=>void){
  const current=await store.xiaozhiState.capabilities.snapshot();
  const provider=current.providers.find(item=>item.id===id)!;
  const binding=current.bindings.find(item=>item.providerId===provider.id)!;
  action(provider,binding);
  const fixture=Object.values(fixtures).find(item=>item.manifest.sha256===provider.source.packageHash&&item.manifest.version===provider.version);
  const executable=fixture?loadNativeStatExecutable(provider.source.reference.endsWith('#hana')?'hana':'workspace',fixture.manifest,path.dirname(fixture.path)):undefined;
  await store.xiaozhiState.capabilities.register(current.definitions[0],provider,binding,undefined,executable);
}
const updateHana=(action:(provider:any,binding:any)=>void)=>updateProvider(NATIVE_STAT_PROVIDER_IDS[0],action);
async function fakeSnapshotWrites(snapshot:ProviderSnapshot){
  const {schema,snapshotId,taskId,sessionId:ignoredSession,runId,generation,createdAt,...value}=snapshot;
  const owner={sessionId:snapshot.sessionId,runId,generation};
  const before=(await snapshots()).length;
  for(const mutation of [
    {...value,providerHash:'0'.repeat(64)},
    {...value,selection:{...value.selection,providerVersion:'9.9.9'}},
    {...value,selection:{...value.selection,level:'partial',missingRequirements:['invented']}},
    {...value,registryRevision:value.registryRevision+1},
    {...value,evidenceRefs:['invented-proof']},
  ])await assert.rejects(store.xiaozhiState.capabilitySnapshots.save(owner,taskId,mutation as typeof value),/invalid_snapshot|source_changed/);
  assert.equal((await snapshots()).length,before);
}
async function initialFlow(body:any,response:http.ServerResponse){
  const messages=body.messages as Record<string,unknown>[];
  switch(stage++){
    case 0:{
      const names=body.tools.map((tool:any)=>tool.function.name);
      for(const name of ['capability_inspect','capability_resolve','capability_execute','office_read_text','office_list_files'])assert(names.includes(name),name);
      check('Stable Bootstrap schemas coexist with the original named core tools');
      send(response,'capability_inspect',{});return;
    }
    case 1:assert(lastTool(messages,'capability_inspect').capabilities.some((item:any)=>item.id===request.capabilityId));send(response,'capability_resolve',request);return;
    case 2:{
      const resolved=lastTool(messages,'capability_resolve');first=resolved.snapshot;assert(first);assert.equal(first.selection.providerVersion,fixtures.v1.manifest.version);assert.equal(first.selection.level,'full');
      check('Real Pi resolve creates a Task Run generation-bound SQLite Snapshot');
      send(response,'capability_execute',{requirement:request,input:{path:'资料.txt'}});return;
    }
    case 3:{
      const result=lastTool(messages,'capability_execute');assert(validProviderResult(result));assert.equal(result.status,'completed');assert.equal(result.data.mime,'text/plain');assert.equal(result.provenance.providerVersion,fixtures.v1.manifest.version);assert.equal(result.snapshotId,first!.snapshotId);
      check('Actual Dispatcher stat traverses Boundary Task Journal admission without a write plan');
      await fakeSnapshotWrites(first!);check('Real SQLite rejects invented selection hash version conformance revision and evidence');
      const declared=await store.xiaozhiState.capabilities.snapshot();
      const definition={...structuredClone(declared.definitions[0]),id:'edu.fixture.unrelated.read'};
      const provider={...structuredClone(declared.providers[0]),id:'mcp.fixture.unrelated',type:'mcp' as const,runtime:'managed' as const,publisher:{id:'fixture',official:false}};
      const binding={...structuredClone(declared.bindings[0]),capabilityId:definition.id,providerId:provider.id,conformance:{...structuredClone(declared.bindings[0].conformance),capabilityId:definition.id}};
      await store.xiaozhiState.capabilities.register(definition,provider,binding);
      send(response,'capability_resolve',request);return;
    }
    case 4:{
      assert.equal(lastTool(messages,'capability_resolve').snapshot.snapshotId,first!.snapshotId);assert.equal((await snapshots()).length,1);
      check('Unrelated Registry revision preserves the exact current Snapshot');
      await updateHana((_provider,binding)=>{binding.conformance.evidence=binding.conformance.evidence.filter((item:any)=>item.requirementId==='file_metadata');});
      send(response,'capability_execute',{requirement:request,input:{path:'资料.txt'}});return;
    }
    case 5:{
      const result=lastTool(messages,'capability_execute');assert.equal(result.status,'partial');assert.equal(result.conformance.level,'partial');assert(result.conformance.missingRequirements.includes('mime'));assert.equal(first!.selection.level,'full');assert.equal((await snapshots())[0].selection.level,'full');
      check('R06 current Optional evidence loss is disclosed while historical full Snapshot stays immutable');
      await updateHana((_provider,binding)=>{binding.conformance.evidence=[];});
      callsBeforeRequiredLoss=host!.capabilities.executionHistory().length;
      send(response,'capability_execute',{requirement:request,input:{path:'资料.txt'}});return;
    }
    case 6:{
      const blocked=lastTool(messages,'capability_execute');assert.equal(blocked.success,false);assert.equal(blocked.error.code,'needs_refresh');assert(blocked.resolution.excludedProviders.some((item:any)=>item.reasons.includes('missing_required')));
      assert.equal(host!.capabilities.executionHistory().length,callsBeforeRequiredLoss);assert.equal((await snapshots()).length,1);
      check('Required proof withdrawal blocks the existing Snapshot before any new artifact execution');
      await updateHana((provider,binding)=>{binding.conformance.evidence=['file_metadata','mime','mime_required'].map(requirementId=>({requirementId,supported:true,kind:'adapter_detected',reference:provider.source.evidenceRef}));});
      await host!.capabilities.installArtifact(NATIVE_STAT_PROVIDER_IDS[0],'hana',fixtures.v2.manifest,path.dirname(fixtures.v2.path));
      send(response,'capability_execute',{requirement:request,input:{path:'资料.txt'}});return;
    }
    case 7:{
      const result=lastTool(messages,'capability_execute');assert.equal(result.data.mime,'text/plain');assert.equal(result.provenance.providerVersion,fixtures.v1.manifest.version);assert.equal(result.provenance.providerHash,fixtures.v1.manifest.sha256);assert.equal((await snapshots()).length,1);
      assert.equal(host!.capabilities.executionHistory().filter(item=>item.hash===fixtures.v2.manifest.sha256).length,v2CallsBeforeInitial);
      check('Ordinary actual V2 artifact upgrade keeps the current Run executing observable V1 code');
      fs.unlinkSync(fixtures.v1.path);
      fs.unlinkSync(path.join(dataRoot,'capability-artifacts',fixtures.v1.manifest.file));
      host!.capabilities.forgetExecutable(NATIVE_STAT_PROVIDER_IDS[0],fixtures.v1.manifest.version,fixtures.v1.manifest.sha256);
      send(response,'capability_execute',{requirement:request,input:{path:'资料.txt'}});return;
    }
    case 8:{
      const result=lastTool(messages,'capability_execute');assert.equal(result.success,false);assert.equal(result.error.code,'provider_version_unavailable');assert.equal(result.snapshotId,first!.snapshotId);assert.equal((await snapshots()).length,1);
      assert.equal(host!.capabilities.executionHistory().filter(item=>item.hash===fixtures.v2.manifest.sha256).length,v2CallsBeforeInitial);
      check('G2-F01 missing old executable rejects this execute with zero V2 calls and unchanged Snapshot');
      send(response,'capability_resolve',{...request,refresh:true});return;
    }
    case 9:{
      const refreshed=lastTool(messages,'capability_resolve');second=refreshed.snapshot;assert(second);assert.notEqual(second.snapshotId,first!.snapshotId);assert.equal(second.previousSnapshotId,first!.snapshotId);assert.equal(second.refreshReason,'explicit_refresh');assert.equal(second.selection.providerVersion,fixtures.v2.manifest.version);
      check('Explicit safe-point refresh records compatible V2 selection linked to the original Snapshot');
      send(response,'capability_execute',{requirement:request,input:{path:'资料.txt'}});return;
    }
    case 10:{
      const result=lastTool(messages,'capability_execute');assert.equal(result.data.mime,'application/x-native-stat-v2');assert.equal(result.provenance.providerHash,fixtures.v2.manifest.sha256);assert.equal(result.snapshotId,second!.snapshotId);
      check('Actual V2 normalized metadata is returned only after explicit refresh');send(response);return;
    }
    default:throw Error('Unexpected initial fixture step');
  }
}
const fixture=http.createServer(async(incoming,response)=>{
  try {
    if(incoming.url==='/v1/models'){response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'low'}}]}));return;}
    assert.equal(incoming.url,'/v1/chat/completions');const chunks:Buffer[]=[];for await(const chunk of incoming)chunks.push(Buffer.from(chunk));const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(scenario==='activation'){
      const mimeRequest={...request,conditions:['require_mime']};
      switch(stage++){
        case 0:send(response,'capability_resolve',mimeRequest);return;
        case 1:{
          const missing=lastTool(body.messages,'capability_resolve');assert.equal(missing.snapshot,null);assert.equal(missing.resolution.selectedProviders.length,0);
          await host!.capabilities.installArtifact(activatedProviderId,'hana',fixtures.v2.manifest,path.dirname(fixtures.v2.path));
          send(response,'capability_resolve',mimeRequest);return;
        }
        case 2:{
          const activated=lastTool(body.messages,'capability_resolve');assert.equal(activated.snapshot.selection.providerId,activatedProviderId);
          send(response,'capability_execute',{requirement:mimeRequest,input:{path:'资料.txt'}});return;
        }
        case 3:{
          const result=lastTool(body.messages,'capability_execute');assert(validProviderResult(result));assert.equal(result.providerId,activatedProviderId);assert.equal(result.data.mime,'application/x-native-stat-v2');
          check('Previously missing compatible Provider is installed and used at a safe point in the same Pi Session');send(response);return;
        }
        default:throw Error('Unexpected activation fixture step');
      }
    }
    if(scenario==='initial'){await initialFlow(body,response);return;}
    if(stage++===0){send(response,'capability_execute',{requirement:request,input:{path:'资料.txt'}});return;}
    const result=lastTool(body.messages,'capability_execute');assert(validProviderResult(result));
    assert.equal(result.provenance.providerVersion,scenario==='resume'?fixtures.v3.manifest.version:fixtures.v2.manifest.version);
    assert.equal(result.data.mime,scenario==='resume'?'text/plain':'application/x-native-stat-v2');send(response);
  } catch(error) {fixtureFailure=error;console.error(error);if(!response.headersSent)response.writeHead(500);response.end();}
});
async function start(prompt:string){assert(host);stage=0;const result=await host.start({sessionId,commandId:'xicmd_'+randomUUID(),prompt});assert(result.ok,JSON.stringify(result));return result.runId;}
try {
  await verifyActualPhase1Migration();
  await new Promise<void>(resolve=>fixture.listen(0,'127.0.0.1',resolve));const address=fixture.address();assert(address&&typeof address!=='string');
  net.fetch=async(input,init)=>{const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.equal(target.origin,'https://api.deepseek.com');return globalThis.fetch(`http://127.0.0.1:${address.port}${target.pathname}`,init);};
  await store.init();sessionId=(await store.createAiConversationSession({title:'Phase2合成真实执行',folderId:null})).session.id;
  await store.xiaozhiState.setWorkspace(sessionId,workspace,'合成授权目录');
  host=createXiaozhiProductionHost({store,dataRoot,enabled:true,emit:event=>{events.push(event);if(scenario==='stop'&&event.kind==='tool_attempt'&&event.attempt.state==='started'&&event.attempt.tool==='capability_execute')stopStarted();}});
  const coldBegin=performance.now();
  const executable=loadNativeStatExecutable('hana',fixtures.dependencyOnly.manifest,path.dirname(fixtures.dependencyOnly.path));
  const coldLoadMs=performance.now()-coldBegin;
  const lease=await host.resolveFileWorkspace(sessionId);
  const dependencyResult=await executable.execute('hana',{sessionId,runId:'dependency-probe',callId:randomUUID(),signal:new AbortController().signal,lease,resolveWorkspace:()=>Promise.resolve(lease)},{path:'资料.txt'});
  const baselineExecutable=loadNativeStatExecutable('hana');
  const baselineResult=await baselineExecutable.execute('hana',{sessionId,runId:'baseline-probe',callId:randomUUID(),signal:new AbortController().signal,lease,resolveWorkspace:()=>Promise.resolve(lease)},{path:'资料.txt'});
  assert.notEqual(dependencyResult.version,baselineResult.version);
  const currentResult=await host.capabilities.execute({sessionId,runId:'inactive',callId:randomUUID(),signal:new AbortController().signal},NATIVE_STAT_PROVIDER_IDS[0],wireRequest,{path:'资料.txt'});
  assert.equal(currentResult.error?.code,'permission_denied');assert(dependencyResult.version);
  assert.notEqual(fixtures.v1.manifest.sha256,fixtures.v2.manifest.sha256);assert.notEqual(fixtures.v1.manifest.sha256,fixtures.dependencyOnly.manifest.sha256);
  const entryRef='src/main/xiaozhi-agent/capabilities/native-stat-artifact-entry.ts';
  assert.equal(fixtures.v1.manifest.sources.find(item=>item.reference===entryRef)?.sha256,fixtures.dependencyOnly.manifest.sources.find(item=>item.reference===entryRef)?.sha256);
  check('G2-F02 normalization and dependency-only changes alter full executable artifact identity');
  const spoof={...fixtures.v2.manifest,sha256:fixtures.v1.manifest.sha256};assert.throws(()=>loadNativeStatExecutable('hana',spoof,path.dirname(fixtures.v2.path)),/invalid_artifact/);
  const corrupt=path.join(output,'corrupt-artifact');fs.mkdirSync(corrupt);
  fs.writeFileSync(path.join(corrupt,fixtures.v2.manifest.file),Buffer.concat([fs.readFileSync(fixtures.v2.path),Buffer.from('\n// changed artifact bytes')]));
  assert.throws(()=>loadNativeStatExecutable('hana',fixtures.v2.manifest,corrupt),/invalid_artifact/);
  check('Executable loader rejects artifact bytes and manifest identity spoofing');
  const packagedDirectory=path.resolve('out/main/capability-artifacts');
  const packagedManifest=JSON.parse(fs.readFileSync(path.join(packagedDirectory,'native-stat-manifest.json'),'utf8')) as NativeStatArtifactManifest;
  const packaged=loadNativeStatExecutable('hana',packagedManifest,packagedDirectory);
  assert.equal(packaged.hash,baselineExecutable.hash);assert.equal(packaged.version,baselineExecutable.version);
  const warmSamples:number[]=[];
  for(let index=0;index<30;index++){const begin=performance.now();const result=await packaged.execute('hana',{sessionId,runId:'packaged-probe',callId:randomUUID(),signal:new AbortController().signal,lease,resolveWorkspace:()=>Promise.resolve(lease)},{path:'资料.txt'});assert.equal(result.version,baselineResult.version);warmSamples.push(performance.now()-begin);}
  check('Development and packaged artifact paths load and execute the same verified bytes');
  await host.capabilities.installArtifact(NATIVE_STAT_PROVIDER_IDS[0],'hana',fixtures.v1.manifest,path.dirname(fixtures.v1.path));
  await updateHana((provider,binding)=>{provider.health='disabled';binding.userPinned=true;});
  const activationRun=await start('P2_ACTIVATION 请在当前任务读取资料.txt的MIME，先核对所需能力。');await host.waitForRun(sessionId,activationRun);if(fixtureFailure)throw fixtureFailure;
  assert.equal(stage,4);assert.equal((await store.getAiAgentRun(activationRun))?.status,'succeeded');
  await updateHana((provider)=>{provider.health='ready';});
  await updateProvider(activatedProviderId,(provider)=>{provider.health='disabled';});
  v2CallsBeforeInitial=host.capabilities.executionHistory().filter(item=>item.hash===fixtures.v2.manifest.sha256).length;
  scenario='initial';
  const firstRun=await start('P2_INITIAL 请按合成能力合同读取资料.txt元信息。');await host.waitForRun(sessionId,firstRun);if(fixtureFailure)throw fixtureFailure;
  assert.equal((await store.getAiAgentRun(firstRun))?.status,'succeeded');assert.equal(stage,11);
  const admission=(await store.xiaozhiState.sql.all('SELECT count(*) AS n FROM xiaozhi_tool_receipts WHERE run_id=? AND admitted=1',[firstRun]))[0];
  assert(first&&second);assert.equal(first.taskId,second.taskId);assert.equal(first.runId,second.runId);assert(Number(admission.n)>=9);
  check('All same-Session capability calls retain one Task Run and persisted Journal receipts');
  scenario='new';const nextRun=await start('P2_NEW 新任务读取资料.txt元信息。');await host.waitForRun(sessionId,nextRun);if(fixtureFailure)throw fixtureFailure;
  const third=(await snapshots())[0];assert(third);assert.equal(third.selection.providerVersion,fixtures.v2.manifest.version);assert.notEqual(third.runId,firstRun);
  check('A new Run selects the currently installed real V2 artifact');
  const raw=(await store.xiaozhiState.sql.all('SELECT * FROM xiaozhi_capability_snapshots_v1 WHERE snapshot_id=?',[first.snapshotId]))[0];assert(raw);
  await store.xiaozhiState.sql.run('UPDATE xiaozhi_capability_snapshots_v1 SET snapshot_json=?,snapshot_hash=? WHERE snapshot_id=?',[JSON.stringify(third),protocolHash(third),first.snapshotId]);
  await assert.rejects(store.xiaozhiState.capabilitySnapshots.history(first.taskId),/snapshot_corrupt/);
  await store.xiaozhiState.sql.run('UPDATE xiaozhi_capability_snapshots_v1 SET snapshot_json=?,snapshot_hash=? WHERE snapshot_id=?',[String(raw.snapshot_json),String(raw.snapshot_hash),first.snapshotId]);
  check('Valid cross-owner JSON plus matching hash cannot be misplaced under another Snapshot row');
  const preserved=await store.xiaozhiState.capabilitySnapshots.history(first.taskId);
  await host.close();host=undefined;await store.close();store=new OmniEduStore(dataRoot);await store.init();
  assert.deepEqual(await store.xiaozhiState.capabilitySnapshots.history(first.taskId),preserved);
  const beforeRestart=await store.xiaozhiState.capabilities.snapshot();assert.equal(beforeRestart.providers.find(item=>item.id===NATIVE_STAT_PROVIDER_IDS[0])?.version,fixtures.v2.manifest.version);
  host=createXiaozhiProductionHost({store,dataRoot,enabled:true,emit:event=>events.push(event)});
  scenario='cold';const coldRun=await start('P2_COLD 冷启后读取资料.txt元信息。');await host.waitForRun(sessionId,coldRun);if(fixtureFailure)throw fixtureFailure;
  check('Cold production restart preserves immutable history and reloads the exact installed V2 bytes');
  assert.equal(process.env.NODE_PATH, undefined);
  const relativeDataRoot = path.relative(path.resolve('.'), dataRoot);
  assert(relativeDataRoot.startsWith('..' + path.sep) || path.isAbsolute(relativeDataRoot));
  assert(!fs.existsSync(dependencyMarker));
  const trustedRequire = createNativeStatRequire();
  assert.throws(() => trustedRequire(path.join(dataRoot, 'node_modules/undici')), /untrusted_dependency/);
  assert.throws(() => trustedRequire('./node_modules/undici'), /untrusted_dependency/);
  check('G2-F04 outside-repository cold V2 uses trusted app dependencies with NODE_PATH cleared and zero DataRoot marker loads');
  const current=await store.xiaozhiState.capabilities.snapshot();await store.xiaozhiState.capabilities.revokeProviderVersion(NATIVE_STAT_PROVIDER_IDS[0],fixtures.v2.manifest.version,request.capabilityId);
  const revoked=await host.capabilities.resolveVersion(sessionId,wireRequest,NATIVE_STAT_PROVIDER_IDS[0],fixtures.v2.manifest.version,fixtures.v2.manifest.sha256);
  assert.equal(revoked.selectedProviders.length,0);assert(revoked.excludedProviders.some(item=>item.reasons.includes('provider_revoked')));
  assert.equal((await store.xiaozhiState.capabilities.snapshot()).revision,current.revision+1);
  check('Version revocation takes precedence over retained executable bytes and old Snapshots');
  await host.capabilities.installArtifact(NATIVE_STAT_PROVIDER_IDS[0],'hana',fixtures.v3.manifest,path.dirname(fixtures.v3.path));
  await host.close();
  host=createXiaozhiProductionHost({store,dataRoot,enabled:true,emit:event=>{
    events.push(event);
    if(scenario==='stop'&&event.kind==='tool_attempt'&&event.attempt.state==='started'&&event.attempt.tool==='capability_execute')stopStarted();
  }});
  scenario='stop';const stoppingRun=await start('P2_STOP 在真实只读Adapter运行时停止。');
  await Promise.race([stopToolStarted,new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('stop_fixture_timeout')),20000))]);
  const deadline=Date.now()+10000;
  while(!host.capabilities.executionHistory().some(item=>item.hash===fixtures.v3.manifest.sha256)){
    if(Date.now()>deadline)throw Error('actual_artifact_start_timeout');
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  const stoppedAt=performance.now();await host.stop(sessionId);const stopReceiptMs=performance.now()-stoppedAt;
  const settleDeadline=Date.now()+10000;
  while(host.capabilities.activeExecutionCount()>0){
    if(Date.now()>settleDeadline)throw Error('artifact_cancel_settle_timeout');
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  const artifactSettledMs=performance.now()-stoppedAt;
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal((await store.getAiAgentRun(stoppingRun))?.status,'blocked');
  assert(!events.some(event=>event.runId===stoppingRun&&event.kind==='tool_end'&&event.success===true));
  const stoppedTask=await task();assert(stoppedTask);const stoppedTaskId=stoppedTask.id;
  check('Actual active Native artifact cancellation keeps late completion behind the original Run fence');
  await host.close();host=undefined;await store.close();store=new OmniEduStore(dataRoot);await store.init();
  const resumeTask=await task();assert(resumeTask);assert.equal(resumeTask.id,stoppedTaskId);
  host=createXiaozhiProductionHost({store,dataRoot,enabled:true,emit:event=>events.push(event)});
  scenario='resume';stage=0;
  const resumed=await host.start({sessionId,commandId:'xicmd_'+randomUUID(),prompt:'继续',continueTask:{taskId:resumeTask.id,requirementsVersion:resumeTask.requirementsVersion}});
  assert(resumed.ok,JSON.stringify(resumed));assert.notEqual(resumed.runId,stoppingRun);await host.waitForRun(sessionId,resumed.runId);if(fixtureFailure)throw fixtureFailure;
  assert.equal((await task())?.id,stoppedTaskId);
  const resumedSnapshots=await snapshots();assert(resumedSnapshots.some(item=>item.runId===resumed.runId&&item.selection.providerVersion===fixtures.v3.manifest.version));
  check('Cold Pi Session reconstruction resumes the same Task with a new fenced Run and current Provider');
  report.performance={artifactBytes:fs.statSync(fixtures.v2.path).size,coldArtifactLoadMs:coldLoadMs,warmNativeSamples:warmSamples.length,warmNativeMeanMs:warmSamples.reduce((sum,value)=>sum+value,0)/warmSamples.length,warmNativeP95Ms:[...warmSamples].sort((a,b)=>a-b)[Math.ceil(warmSamples.length*0.95)-1],stopReceiptMs,artifactSettledMs,sourceFiles:fixtures.v2.manifest.sources.length};
  report.success=true;
  Object.assign(report,{externalRoot,dataRoot,dependencyMarker,dependencyMarkerLoads:0,nodePathCleared:true});
} catch(error) {report.error=String(error instanceof Error?error.stack:error);process.exitCode=1;}
finally {
  await host?.close().catch(()=>{});await store.close().catch(()=>{});net.fetch=originalFetch;
  fixture.closeAllConnections();await new Promise<void>(resolve=>fixture.close(()=>resolve()));
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:checks.length,output,error:report.error}));
}
