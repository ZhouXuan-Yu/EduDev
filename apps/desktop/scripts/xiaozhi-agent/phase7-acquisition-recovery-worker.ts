import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import {createAcquisitionState} from '../../src/main/xiaozhi-agent/capabilities/acquisition/state';
import {MANAGED_READ_CAPABILITY} from '../../src/main/xiaozhi-agent/capabilities/acquisition/managed-mcp';
const output=process.argv[2];const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-phase5-production-'));
const dataRoot=path.join(root,'data'),workspace=path.join(root,'workspace');fs.mkdirSync(path.join(workspace,'nested'),{recursive:true});
const privateText='Phase7 synthetic teacher private text exact source readback.';fs.writeFileSync(path.join(workspace,'nested/private.txt'),privateText);
process.env.DEEPSEEK_API_KEY='synthetic-phase8-loopback';process.env.DEEPSEEK_MODEL='deepseek-flash';
let store=new OmniEduStore(dataRoot);let host:ReturnType<typeof createXiaozhiProductionHost>|undefined;let sessionId='';let taskId='';let calls=0;let scenario:{name:string,input:Record<string,unknown>}[]=[];const bodies:unknown[]=[];const checks:{name:string,pass:boolean,durationMs:number,runId:string}[]=[];
const report={success:false,root,output,approvalScope:process.env.PHASE7_APPROVAL_SCOPE==='task'?'task':'operation',checks,paidCalls:0,modelCalls:0,approvals:[] as unknown[],sourceRequests:[] as unknown[],error:undefined as string|undefined};
const requirement={capabilityId:MANAGED_READ_CAPABILITY.id,contractVersion:'1.0.0',required:['read_text'],optional:[],conditions:[]};
const fixture=http.createServer(async(req,res)=>{try{if(req.url==='/v1/models'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'low'}}]}));return;}assert.equal(req.url,'/v1/chat/completions');let text='';for await(const b of req)text+=b.toString('utf8');bodies.push(JSON.parse(text));calls++;const tool=scenario.shift();res.writeHead(200,{'content-type':'text/event-stream'});const base={id:'synthetic-phase8',object:'chat.completion.chunk',created:1,model:'deepseek-flash'};const delta=tool?{role:'assistant',tool_calls:[{index:0,id:'call_'+randomUUID().replaceAll('-',''),type:'function',function:{name:tool.name,arguments:JSON.stringify(tool.input)}}]}:{role:'assistant',content:'Synthetic read completed.'};res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta,finish_reason:null}]})+'\n\n');res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{},finish_reason:tool?'tool_calls':'stop'}],usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130}})+'\n\n');res.end('data: [DONE]\n\n');}catch(e){console.error(e);res.writeHead(500);res.end('fixture error');}});
const originalFetch=net.fetch;
try{
 await new Promise<void>(r=>fixture.listen(0,'127.0.0.1',r));const address=fixture.address();assert(address&&typeof address!=='string');
 net.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input.url);assert.equal(url.origin,'https://api.deepseek.com','phase8_non_loopback_fetch_blocked');return fetch(`http://127.0.0.1:${address.port}${url.pathname}`,init);};
 await store.init();await seed();
 const makeHost=()=>createXiaozhiProductionHost({store,dataRoot,enabled:true,emit(){},onCapabilityProbe:result=>fs.appendFileSync(path.join(output,'owned-canary-probes.jsonl'),JSON.stringify(result)+'\n')});host=makeHost();
 sessionId=(await store.createAiConversationSession({title:'Phase8 focused cached synthetic task',folderId:null})).session.id;
 await store.xiaozhiState.setWorkspace(sessionId,workspace,'Synthetic Phase8 public installation/read fixture');
 let view=await host.permissions.view(sessionId);let operationBoundaryVerified=false;const approvalStarted=performance.now();
 const candidateId=JSON.parse(fs.readFileSync(path.join(output,'fixture-contract.json'),'utf8')).operation.candidateId;
 for(let attempt=0;attempt<6;attempt++){
  scenario=[...(attempt===0?[{name:'capability_search',input:{query:'local filesystem read text',sources:['reviewed']}}]:[]),{name:'capability_prepare',input:{candidateId}}];
  const started=await host.start({sessionId,commandId:'xicmd_'+randomUUID(),prompt:'Prepare the exact cached capability, preserving original scope approval.',...(taskId?{continueTask:{taskId,requirementsVersion:1}}:{})});assert(started.ok,JSON.stringify(started));await host.waitForRun(sessionId,started.runId);
  const operations=await createAcquisitionState(store.xiaozhiState.sql).operations();const operation=operations.find(o=>o.owner.runId===started.runId);assert(operation,'Original same Task preparation must reach acquisition after the previous exact approval; no task_effect_recheck_required');taskId=operation.owner.taskId;
  if(operation.phase==='ready'){checks.push({name:'Same Task original dependency/start/function approvals resume to ready',pass:true,durationMs:performance.now()-approvalStarted,runId:started.runId});break;}
  if(process.env.PHASE7_EXPECT_OPERATION_BOUNDARY==='1'&&report.approvalScope==='operation'&&operation.phase==='failed'){
    assert.equal(operation.error,'permission_denied');view=await host.permissions.view(sessionId);assert(view.approvals.some(a=>a.request.action==='capability_prepare'&&a.scope==='operation'&&a.state==='uncertain'));
    const unresolved=await store.xiaozhiState.sql.all("SELECT state FROM xiaozhi_effects_v1 WHERE run_id=? AND operation='tool' AND json_extract(document_json,'$.tool')='capability_prepare'",[started.runId]);assert(unresolved.some(r=>r.state==='unknown'));
    checks.push({name:'Original single-operation authorization remains bounded and is never silently promoted to Task Grant',pass:true,durationMs:performance.now()-approvalStarted,runId:started.runId});operationBoundaryVerified=true;break;
  }
  assert.equal(operation.phase,'needs_approval',JSON.stringify({phase:operation.phase,error:operation.error}));
  const facts=await store.xiaozhiState.sql.all("SELECT state,document_json FROM xiaozhi_effects_v1 WHERE run_id=? AND operation='tool' AND json_extract(document_json,'$.tool')='capability_prepare'",[started.runId]);assert.equal(facts.length,1);assert(['committed','reconciled'].includes(String(facts[0].state)),'known waiting preparation effect has durable domain proof, never unknown');
  view=await host.permissions.view(sessionId);const pending=view.approvals.filter(a=>a.state==='pending');assert(pending.length>0,'original exact scope approval exists');
  for(const a of pending){assert(!a.request.scopes.some(s=>s.kind==='network'||s.kind==='egress'));report.approvals.push({action:a.request.action,scopes:a.request.scopes,runId:a.request.owner.runId});await host.permissions.decide({sessionId,approvalId:a.id,revision:a.revision,decision:'approve',scope:process.env.PHASE7_APPROVAL_SCOPE==='task'?'task':'operation'});console.log('APPROVED '+a.request.action);}
  assert(attempt<5,'bounded approval continuation exhausted');
 }
 async function run(name:string,cold:boolean){
  const start=performance.now();const bodiesBefore=bodies.length;
  scenario=[...(cold?[{name:'capability_search',input:{query:'local filesystem read text',sources:['reviewed']}}]:[]),{name:'capability_prepare',input:{candidateId}},{name:'capability_resolve',input:{...requirement,refresh:true}},{name:'capability_execute',input:{requirement,input:{path:'nested/private.txt'}}}];
  const approvalsBefore=(await host!.permissions.view(sessionId)).approvals.length;
  const started=await host!.start({sessionId,commandId:'xicmd_'+randomUUID(),prompt:'Use the cached read capability to verify synthetic nested/private.txt.',...(cold?{}:{continueTask:{taskId,requirementsVersion:1}})});assert(started.ok,JSON.stringify(started));await host!.waitForRun(sessionId,started.runId);assert.equal(scenario.length,0);
  const operations=await createAcquisitionState(store.xiaozhiState.sql).operations();const operation=operations.find(o=>o.owner.runId===started.runId);assert(operation,JSON.stringify(operations.map(o=>({phase:o.phase,error:o.error,runId:o.owner.runId}))));assert.equal(operation.phase,'ready',JSON.stringify({phase:operation.phase,error:operation.error}));taskId=operation.owner.taskId;
  const runBodies=bodies.slice(bodiesBefore) as {messages:{role:string,content:unknown}[]}[];const toolMessages=runBodies.flatMap(b=>b.messages.filter(m=>m.role==='tool').map(m=>String(m.content)));assert(toolMessages.some(t=>t.includes(privateText)&&t.includes('xiaozhi.provider-result.v1')),toolMessages.join('\n').slice(-3000));
  view=await host!.permissions.view(sessionId);assert.equal(view.approvals.length,approvalsBefore);assert.equal(host!.permissions.engine.activeCount(),0);
  const terminals=(await store.xiaozhiState.sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='mcp_service_terminal'")).map(row=>JSON.parse(String(row.metadata_json))).filter(v=>v.owner.runId===started.runId);assert(terminals.length>=3);for(const terminal of terminals)assert.deepEqual(terminal.result.cleanup,{jobActiveProcesses:0,profileRemoved:true,remainingOwnedAces:0});
  const probes=(await store.xiaozhiState.sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='capability_function_probe'")).map(row=>JSON.parse(String(row.metadata_json))).filter(v=>v.owner.runId===started.runId);assert(probes.some(p=>p.healthMarker&&!p.failed));
  const receipts=await store.xiaozhiState.sql.all('SELECT tool,contract_json FROM xiaozhi_tool_receipts WHERE run_id=? AND admitted=1',[started.runId]);for(const tool of ['capability_prepare','capability_resolve','capability_execute'])assert(receipts.some(r=>r.tool===tool));
  assert.equal(fs.readFileSync(path.join(workspace,'nested/private.txt'),'utf8'),privateText);checks.push({name,pass:true,durationMs:performance.now()-start,runId:started.runId});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('PASS '+name);
 }
 if(!operationBoundaryVerified){
 await run('Same Task ready cached prepare resolves and executes without new approvals',false);
 await host.close();host=undefined;await store.close();store=new OmniEduStore(dataRoot);await store.init();host=makeHost();
 await run('Cold main rechecks original receipts and continues the same Task cached path',false);
 }

 report.success=true;
}catch(e){report.error=e instanceof Error?e.stack:String(e);process.exitCode=1;console.error(e);}
finally{await host?.close();await store.close();net.fetch=originalFetch;await new Promise<void>(r=>fixture.close(()=>r()));report.modelCalls=calls;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(output,'native-tool-bodies.json'),JSON.stringify(bodies,null,2));console.log(JSON.stringify({success:report.success,root,output,error:report.error}));}

async function seed(){
 const seed=JSON.parse(fs.readFileSync(path.join(output,'fixture-contract.json'),'utf8'));const destination=path.join(dataRoot,'managed-tools/capabilities/versions',seed.operation.plan.digest);const source=seed.artifact.binding.directory;
 for(const entry of seed.artifact.installedFiles){const src=path.resolve(source,entry.path),dest=path.resolve(destination,entry.path);assert(src.startsWith(source+path.sep)&&dest.startsWith(destination+path.sep));const stat=fs.lstatSync(src);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size===entry.bytes);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest,fs.constants.COPYFILE_EXCL);}
 const artifact=structuredClone(seed.artifact);artifact.binding.directory=destination;artifact.binding.executable.path=path.join(destination,'node.exe');artifact.revision=1;await createAcquisitionState(store.xiaozhiState.sql).saveArtifact(artifact,0);
 // Existing reviewed package plan metadata only, no historic Grants/config/database are copied.
 const operation=structuredClone(seed.operation);operation.revision=1;operation.plan.directory=destination;await createAcquisitionState(store.xiaozhiState.sql).saveOperation(operation,0);
}
