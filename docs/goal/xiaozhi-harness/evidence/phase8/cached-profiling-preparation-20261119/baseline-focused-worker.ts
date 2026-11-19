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
const privateText='Phase8 synthetic teacher private text exact source readback.';fs.writeFileSync(path.join(workspace,'nested/private.txt'),privateText);
process.env.DEEPSEEK_API_KEY='synthetic-phase8-loopback';process.env.DEEPSEEK_MODEL='deepseek-flash';
const store=new OmniEduStore(dataRoot);let host:ReturnType<typeof createXiaozhiProductionHost>|undefined;let sessionId='';let taskId='';let calls=0;let scenario:{name:string,input:Record<string,unknown>}[]=[];const bodies:unknown[]=[];const checks:{name:string,pass:boolean,durationMs:number,runId:string}[]=[];
const report={success:false,root,output,checks,paidCalls:0,modelCalls:0,approvals:[] as unknown[],sourceRequests:[] as unknown[],error:undefined as string|undefined};
const requirement={capabilityId:MANAGED_READ_CAPABILITY.id,contractVersion:'1.0.0',required:['read_text'],optional:[],conditions:[]};
const fixture=http.createServer(async(req,res)=>{try{if(req.url==='/v1/models'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'low'}}]}));return;}assert.equal(req.url,'/v1/chat/completions');let text='';for await(const b of req)text+=b.toString('utf8');bodies.push(JSON.parse(text));calls++;const tool=scenario.shift();res.writeHead(200,{'content-type':'text/event-stream'});const base={id:'synthetic-phase8',object:'chat.completion.chunk',created:1,model:'deepseek-flash'};const delta=tool?{role:'assistant',tool_calls:[{index:0,id:'call_'+randomUUID().replaceAll('-',''),type:'function',function:{name:tool.name,arguments:JSON.stringify(tool.input)}}]}:{role:'assistant',content:'Synthetic read completed.'};res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta,finish_reason:null}]})+'\n\n');res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{},finish_reason:tool?'tool_calls':'stop'}],usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130}})+'\n\n');res.end('data: [DONE]\n\n');}catch(e){console.error(e);res.writeHead(500);res.end('fixture error');}});
const originalFetch=net.fetch;
try{
 await new Promise<void>(r=>fixture.listen(0,'127.0.0.1',r));const address=fixture.address();assert(address&&typeof address!=='string');
 net.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input.url);assert.equal(url.origin,'https://api.deepseek.com','phase8_non_loopback_fetch_blocked');return fetch(`http://127.0.0.1:${address.port}${url.pathname}`,init);};
 await store.init();await globalThis.__phase8.seedArtifact(store,dataRoot,createAcquisitionState(store.xiaozhiState.sql));
 host=createXiaozhiProductionHost({store,dataRoot,enabled:true,emit(){},onCapabilityProbe:result=>fs.appendFileSync(path.join(output,'owned-canary-probes.jsonl'),JSON.stringify(result)+'\n')});
 sessionId=(await store.createAiConversationSession({title:'Phase8 focused cached synthetic task',folderId:null})).session.id;
 await store.xiaozhiState.setWorkspace(sessionId,workspace,'Synthetic Phase8 public installation/read fixture');
 let view=await host.permissions.view(sessionId);await host.permissions.setMode({sessionId,revision:view.profile.revision,mode:'fullAccess'});
 const candidateId=JSON.parse(fs.readFileSync(path.join(output,'fixture-contract.json'),'utf8')).operation.candidateId;
 globalThis.__phase8.phase='normal-original-scoped-grant-setup';
 const pinned=JSON.parse(fs.readFileSync(path.join(output,'fixture-contract.json'),'utf8'));const installed=path.join(dataRoot,'managed-tools/capabilities/versions',pinned.operation.plan.digest);
 const originalScopes=[{kind:'dependency' as const,source:'https://registry.npmjs.org',package:pinned.artifact.binding.package,version:pinned.artifact.binding.version,sha256:pinned.operation.plan.digest,environment:installed,installScripts:false as const},{kind:'process' as const,backend:'appcontainer' as const,executable:path.join(installed,'node.exe'),executableHash:pinned.artifact.binding.executable.sha256,workspace}];
 await host.permissions.issue({sessionId,scopes:originalScopes,taskId:null,expiresAt:new Date(Date.now()+3600000).toISOString()});
 report.approvals.push({setup:'teacher_explicit_original_scopes_via_PermissionService.issue',scopes:originalScopes,sessionId});
 scenario=[{name:'capability_search',input:{query:'local filesystem read text',sources:['reviewed']}},{name:'capability_prepare',input:{candidateId}}];
 const setup=await host.start({sessionId,commandId:'xicmd_'+randomUUID(),prompt:'Discover and prepare the public cached read capability using normal scopes.'});assert(setup.ok,JSON.stringify(setup));await host.waitForRun(sessionId,setup.runId);
 const setupOperation=(await createAcquisitionState(store.xiaozhiState.sql).operations()).find(o=>o.owner.runId===setup.runId);assert(setupOperation);assert.equal(setupOperation.phase,'needs_approval');
 view=await host.permissions.view(sessionId);const pending=view.approvals.filter(a=>a.state==='pending');assert.equal(pending.length,1);for(const approval of pending){assert.equal(approval.request.action,'mcp_call');assert(!approval.request.scopes.some(s=>s.kind==='network'||s.kind==='egress'));const mcp=approval.request.scopes.find(s=>s.kind==='mcp');assert(mcp&&mcp.kind==='mcp');assert.deepEqual(mcp.tools,['read_text_file']);report.approvals.push({setup:'original_discovered_schema_scoped_approval',request:approval.request});await host.permissions.decide({sessionId,approvalId:approval.id,revision:approval.revision,decision:'approve',scope:'persistent'});}
 console.log('SETUP original discovered MCP scope approved; original partial Task retained');
 async function run(name:string,cold:boolean){
  globalThis.__phase8.phase=name;const start=performance.now();const bodiesBefore=bodies.length;
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
 await run('first-authorized-public-cached-prepare-resolve-execute',true);

 report.success=true;
}catch(e){report.error=e instanceof Error?e.stack:String(e);process.exitCode=1;console.error(e);}
finally{await host?.close();await store.close();net.fetch=originalFetch;await new Promise<void>(r=>fixture.close(()=>r()));report.modelCalls=calls;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(output,'native-tool-bodies.json'),JSON.stringify(bodies,null,2));globalThis.__phase8.finish(report);console.log(JSON.stringify({success:report.success,root,output,error:report.error}));}
