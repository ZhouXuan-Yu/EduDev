import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {net} from 'electron';
import {OmniEduStore} from './src/main/db';
import {createXiaozhiProductionHost} from './src/main/xiaozhi-agent/production-host';
import {createStudentConversation} from './src/main/students/context-service';
import {STUDENT_CONTEXT_SCHEMA} from './src/shared/student-context';
import {createAttachmentImportService} from './src/main/xiaozhi-agent/attachment-import-service';
import {terminalWasNotStarted} from './src/main/xiaozhi-agent/terminal/not-started';
const output=process.argv[2],evidence=path.dirname(output),fixtures=path.join(evidence,'fixtures');
const {pii}=JSON.parse(fs.readFileSync(path.join(fixtures,'EXPECTED.json'),'utf8'));
const dataRoot=path.join(output,'data'),workspace=path.join(output,'workspace');fs.mkdirSync(workspace);
for(const file of ['handout.docx','handout.pdf','terminal-source.txt'])fs.copyFileSync(path.join(fixtures,file),path.join(workspace,file));
process.env.DEEPSEEK_API_KEY='synthetic-frozen-privacy-domains';process.env.DEEPSEEK_MODEL='deepseek-flash';
let store=new OmniEduStore(dataRoot);let host:ReturnType<typeof createXiaozhiProductionHost>|undefined,student:any;
const makeHost=()=>createXiaozhiProductionHost({store,dataRoot,enabled:true,emit(event){if(event.kind==='change'&&event.change.state==='pending')void host!.decideTextChange({schemaVersion:'xiaozhi.change.v1',sessionId:event.sessionId,changeId:event.change.id,revision:event.change.revision,action:'approve'}).then(result=>assert(result.ok,JSON.stringify(result))).catch(error=>{report.handlerError=String(error.stack||error);});}});
const bodies:any[]=[],report:any={success:false,baseline:'3494ffa-plus-model-tool-privacy',output,dataRoot,workspace,checks:[],paidCalls:0,publicSourceGET:0,pii};let activeCase='setup',nextTool:(body:any)=>Promise<any>=async()=>undefined;
function strings(value:any,out:string[]=[]):string[]{if(typeof value==='string'){out.push(value);const line=value.split('\n')[0].trim();if(line.startsWith('{')||line.startsWith('[')){try{strings(JSON.parse(line),out);}catch{}}}else if(value&&typeof value==='object')for(const x of Object.values(value))strings(x,out);return out;}
function leaks(body:any){const raw=strings(body);return Object.entries(pii).filter(([label,value])=>label!=='localPath'&&raw.some(s=>s.includes(String(value)))).map(([label])=>label);}
const hash=(file:string)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const model=http.createServer(async(req,res)=>{try{if(req.url==='/v1/models'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'low'}}]}));return;}assert.equal(req.url,'/v1/chat/completions');let raw='';for await(const b of req)raw+=b;const body=JSON.parse(raw);bodies.push({case:activeCase,body});const tool=await nextTool(body),base={id:'frozen-domains-synthetic',object:'chat.completion.chunk',created:1,model:'deepseek-flash'},delta=tool?{role:'assistant',tool_calls:[{index:0,id:'call_'+randomUUID().replaceAll('-',''),type:'function',function:{name:tool.name,arguments:JSON.stringify(tool.input)}}]}:{role:'assistant',content:'Synthetic source read finished; rely on actual tool receipts.'};res.writeHead(200,{'content-type':'text/event-stream'});res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta,finish_reason:null}]})+'\n\n');res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{},finish_reason:tool?'tool_calls':'stop'}]})+'\n\n');res.end('data: [DONE]\n\n');}catch(e){report.handlerError=String(e.stack);console.error(e);res.writeHead(500);res.end('normal fixture failed');}});
const originalFetch=net.fetch;
async function session(){const id=(await createStudentConversation(store,{schemaVersion:STUDENT_CONTEXT_SCHEMA,studentId:student.id})).session.id;await store.xiaozhiState.setWorkspace(id,workspace,'Owned synthetic source-only privacy audit');await host!.permissions.view(id);return id;}
async function run(id:string,attachments?:any[]){const start=await host!.start({sessionId:id,commandId:'xicmd_'+randomUUID(),prompt:'Read only the selected synthetic teaching source; provide only necessary anonymized facts.',...(attachments?{attachments}:{})});assert(start.ok,JSON.stringify(start));await host!.waitForRun(id,start.runId);assert(!report.handlerError,report.handlerError);return start.runId;}
function visible(name:string){return bodies.filter(x=>x.case===name).map((x,index)=>({index,leaks:leaks(x.body)}));}
function requireBody(name:string){const rows=bodies.filter(x=>x.case===name);if(!rows.some(x=>strings(x.body).some(s=>s.includes('SAFE_PRIVACY_DOMAIN_V1'))))throw Error('BODY_UNAVAILABLE: no actual parser/body output reached model');}
async function check(name:string,action:(proof:any)=>Promise<void>){activeCase=name;const proof:any={name};try{await action(proof);proof.status='PASS';}catch(error){proof.status=String(error.message).startsWith('BODY_UNAVAILABLE')?'BLOCKED_BODY':'FAIL';proof.error=error.stack;}report.checks.push(proof);fs.writeFileSync(path.join(output,'REPORT.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({name,status:proof.status,error:proof.error}));}
async function terminalDiskFullBeforeStart(proof:any) {
 await store.init();
 const id=await session();
 const view=await host!.permissions.view(id);
 await host!.permissions.setMode({sessionId:id,revision:view.profile.revision,mode:'fullAccess'});
 const systemVolume=path.win32.parse(process.env.SystemRoot||'C:\\Windows').root;
 const originalStatfs=fs.promises.statfs;
 let probes=0, dispatched=0;
 nextTool=async()=>dispatched++===0?{name:'exec_command',input:{cmd:"Write-Output 'SAFE_BEFORE_START_ONLY'",tty:true,background:true}}:undefined;
 fs.promises.statfs=(async (file: string,options: {bigint?: boolean})=>{
  if(file===systemVolume&&options?.bigint){probes++;return {bavail:0n,bsize:4096n};}
  return originalStatfs(file,options as {bigint:true});
 }) as typeof originalStatfs;
 try{proof.runId=await run(id);}finally{fs.promises.statfs=originalStatfs;}
 assert.equal(probes,1);
 const exact=(snapshot:any)=>snapshot?.turn.recovery?.receipts.find(row=>row.tool==='exec_command');
 const hot=(await store.xiaozhiState.eventJournal.snapshots(id)).find(row=>row.cursor.runId===proof.runId);
 const receipt=exact(hot);
 assert(receipt);
 assert.equal(receipt.disposition,'not_delivered');
 assert.equal(receipt.effect,'not_checked');
 assert.equal(hot.turn.recovery?.automaticReplay,false);
 const messages=bodies.filter(row=>row.case===activeCase).flatMap(row=>row.body.messages.filter(message=>message.role==='tool'));
 assert(messages.some(message=>String(message.content).includes('Windows 系统盘空间不足')));
 assert(messages.every(message=>!String(message.content).includes('操作可能已经产生效果')&&!String(message.content).includes('"jobId"')));
 const sql=store.xiaozhiState.sql;
 const effects=await sql.all('SELECT state,document_json FROM xiaozhi_effects_v1 WHERE run_id=? AND call_id=?',[proof.runId,receipt.callId]);
 assert.equal(effects.length,1);
 assert.equal(effects[0].state,'failed');
 const effect=JSON.parse(String(effects[0].document_json));
 assert.equal(effect.execution.jobId,undefined);
 assert.equal(effect.proofs.length,1);
 assert.equal((await sql.all('SELECT job_id FROM xiaozhi_jobs_v1 WHERE origin_run_id=?',[proof.runId])).length,0);
 const owner=effect.owner;
 assert(!(await terminalWasNotStarted(sql,{...owner,generation:owner.generation+1},receipt.callId,'exec_command')));
 for(const change of [{start_sequence:-1},{native_state:'conflict'},{contract_json:'{}'},{success:1}]){
  const changed={...sql,all:async (query:string,args?:unknown[])=>{
   const rows=await sql.all(query,args);
   return query.startsWith('SELECT * FROM xiaozhi_tool_receipts')?rows.map(row=>({...row,...change})):rows;
  }} as typeof sql;
  assert(!(await terminalWasNotStarted(changed,owner,receipt.callId,'exec_command')));
 }
 const modelRequestCount=bodies.length;
 await host!.close();await store.close();
 store=new OmniEduStore(dataRoot);await store.init();host=makeHost();
 const cold=(await store.xiaozhiState.eventJournal.snapshots(id)).find(row=>row.cursor.runId===proof.runId);
 assert.deepEqual(exact(cold),receipt);
 assert.equal(cold?.turn.recovery?.automaticReplay,false);
 assert.equal(bodies.length,modelRequestCount);
 const native=await store.xiaozhiState.getBinding(id);assert(native);
 const source=fs.readFileSync(path.join(dataRoot,'xiaozhi-pi',native.sessionFile),'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line).message)
  .filter(message=>message?.role==='toolResult'&&message.toolName==='exec_command');
 assert.equal(source.length,1);
 assert.equal(source[0].details.error.code,'system_disk_full');
 assert.equal(source[0].details.execution.effect,'none');
 proof.noReplay=true;proof.noJob=true;proof.hostError=source[0].details.error.code;
 proof.recovery=receipt;proof.preflightProbes=probes;proof.effectState=effects[0].state;
}

try{await new Promise<void>(r=>model.listen(0,'127.0.0.1',r));const a=model.address();assert(a&&typeof a!=='string');net.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.equal(url.origin,'https://api.deepseek.com','non_loopback_fetch_blocked');return fetch(`http://127.0.0.1:${a.port}${url.pathname}`,init);};await store.init();await store.createStudent({displayName:pii.name,realName:pii.name,school:pii.school,grade:'七年级',subjects:['数学']});student=(await store.listStudents('')).find(x=>x.realName===pii.name);assert(student);host=makeHost();
 if(process.env.OMNI_EDU_TEST_TERMINAL_DISK_FULL==='1'){
  await check('confirmed-disk-full-before-terminal-start',terminalDiskFullBeforeStart);
 } else {
 for(const extension of ['docx','pdf'])await check('office-document-'+extension,async proof=>{const id=await session();let step=0;const source=path.join(workspace,'handout.'+extension),before=hash(source);nextTool=async()=>step++===0?{name:'office_read_document',input:{path:'handout.'+extension,startLine:1,lineCount:50}}:undefined;proof.sessionId=id;proof.runId=await run(id);proof.source={file:source,before,after:hash(source)};proof.modelScan=visible(activeCase);assert.equal(proof.source.after,before);requireBody(activeCase);assert(!proof.modelScan.some(x=>x.leaks.length),'normal Office body model POST contains synthetic identity/path');});
 for(const file of [pii.school+'-attachment.txt','handout.docx','handout.pdf'])await check('submitted-attachment-'+path.extname(file).slice(1),async proof=>{const id=await session(),importer=createAttachmentImportService({dataRoot,state:store.xiaozhiState.attachments,imports:store.xiaozhiState.attachmentImports});const row=await importer.importFile(id,path.join(fixtures,file),new AbortController().signal);let step=0;nextTool=async body=>{if(step++===0)return{name:'office_list_attachments',input:{}};if(step===2){const entry=body.messages.filter(m=>m.role==='tool').map(m=>String(m.content)).find(s=>s.includes('"items"'));assert(entry);const payload=JSON.parse(entry.split('\n')[0]);assert.equal(payload.items.length,1);return{name:'office_read_attachment',input:{id:payload.items[0].id,revision:payload.items[0].revision,startLine:1,lineCount:50}};}return undefined;};proof.sessionId=id;proof.runId=await run(id,[{id:row.id,revision:row.revision}]);const captured=await store.xiaozhiState.attachments.get(id,row.id);proof.attachment=captured;proof.source={file:path.join(fixtures,file),sha256:hash(path.join(fixtures,file))};if(captured){const copy=path.join(dataRoot,'xiaozhi-pi','attachments',id,captured.path);proof.rawCapturedCopy={file:copy,sha256:hash(copy)};assert.equal(proof.rawCapturedCopy.sha256,proof.source.sha256);}proof.modelScan=visible(activeCase);requireBody(activeCase);assert(!proof.modelScan.some(x=>x.leaks.length),'normal submitted attachment body or metadata exposes synthetic identity/path');});
 await check('persistent-terminal-result',async proof=>{const id=await session(),view=await host!.permissions.view(id);await host!.permissions.setMode({sessionId:id,revision:view.profile.revision,mode:'fullAccess'});let step=0,job:any;nextTool=async body=>{if(step++===0)return{name:'exec_command',input:{cmd:"Get-Content -LiteralPath 'terminal-source.txt'",tty:true,background:true,yield_time_ms:1000}};if(step===2){const resultText=body.messages.filter(m=>m.role==='tool').map(m=>String(m.content)).findLast(s=>s.includes('"jobId"'));if(!resultText){proof.preflightFull=body.messages.some(m=>m.role==='tool'&&String(m.content).includes('Windows 系统盘空间不足'));step=3;return undefined;}job=JSON.parse(resultText.split(String.fromCharCode(10))[0]);const deadline=Date.now()+15000;do{const actual=await host!.terminal.readXiaozhiTerminal({sessionId:id,jobId:job.jobId,sinceSequence:0});assert(actual.ok,JSON.stringify(actual));job=actual.data.job;if(job.terminal.output.includes('SAFE_PRIVACY_DOMAIN_V1'))break;await new Promise(r=>setTimeout(r,100));}while(Date.now()<deadline);if(!job.terminal.output.includes('SAFE_PRIVACY_DOMAIN_V1'))throw Error('BODY_UNAVAILABLE: no native source output');proof.rawTeacherJob=job;return{name:'list_terminals',input:{}};}if(step===3&&job)return{name:'close_terminal',input:{job_id:job.jobId}};return undefined;};proof.sessionId=id;proof.runId=await run(id);proof.modelScan=visible(activeCase);if(!job)throw Error(proof.preflightFull?'BODY_UNAVAILABLE: Windows system volume full before terminal start':'BODY_UNAVAILABLE: no original terminal Job receipt');proof.rawFile={file:path.join(workspace,'terminal-source.txt'),sha256:hash(path.join(workspace,'terminal-source.txt'))};requireBody(activeCase);assert(!proof.modelScan.some(x=>x.leaks.length),'persistent terminal raw output reached model without anonymization');});

 await check('actual-redacted-plaintext-artifact',async proof=>{const id=await session(),view=await host!.permissions.view(id);await host!.permissions.setMode({sessionId:id,revision:view.profile.revision,mode:'fullAccess'});let step=0;nextTool=async body=>{if(step++===0)return{name:'office_read_document',input:{path:'handout.docx'}};const source=body.messages.filter((message:any)=>message.role==='tool').flatMap((message:any)=>{try{return[JSON.parse(String(message.content).split('\n')[0])];}catch{return[];}}).find((value:any)=>value.success&&typeof value.text==='string');assert(source);if(step===2){const sys=body.messages.filter((message:any)=>message.role==='system').map((message:any)=>message.content).join('\n'),v=Number([...sys.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1);return{name:'update_task_plan',input:{schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:v,expectedRevision:0,reason:'保存实读脱敏教学摘录',steps:[{id:'save',text:'保存教学摘录',dependsOn:[],reported:'pending',kind:'saved_text',target:'redacted-lesson.txt'},{id:'review',text:'教师核对',dependsOn:['save'],reported:'pending',kind:'human'}]}};}if(step===3)return{name:'office_create_text',input:{path:'redacted-lesson.txt',content:source.text,taskStepId:'save'}};return undefined;};proof.sessionId=id;proof.runId=await run(id);const artifact=path.join(workspace,'redacted-lesson.txt'),text=fs.readFileSync(artifact,'utf8');assert(text.includes('SAFE_PRIVACY_DOMAIN_V1'));assert.equal(leaks({text}).length,0);proof.artifact={file:artifact,sha256:hash(artifact),bytes:fs.statSync(artifact).size};proof.modelScan=visible(activeCase);assert(!proof.modelScan.some(x=>x.leaks.length));});
 await check('cold-native-office-attachment-terminal-and-process',async proof=>{const cases=['office-document-docx','submitted-attachment-txt','persistent-terminal-result'];await host!.close();await store.close();store=new OmniEduStore(dataRoot);await store.init();host=makeHost();proof.histories=[];for(const name of cases){const previous=report.checks.find((check:any)=>check.name===name);assert(previous?.sessionId);const id=previous.sessionId,binding=await store.xiaozhiState.getBinding(id);assert(binding);const native=path.join(dataRoot,'xiaozhi-pi',binding.sessionFile),before=fs.readFileSync(native);assert(before.toString().includes(pii.school),'Native local receipt retains private factual text');const snapshot=await host!.snapshot(id);assert(snapshot.task);let step=0;nextTool=async()=>step++===0?{name:'read_session_process',input:{}}:undefined;const started=await host!.start({sessionId:id,commandId:'xicmd_'+randomUUID(),prompt:'继续核对已有合成教学来源和本会话过程，不重放写入或进程。',continueTask:{taskId:snapshot.task.id,requirementsVersion:snapshot.task.requirementsVersion}});assert(started.ok,JSON.stringify(started));await host!.waitForRun(id,started.runId);assert(!report.handlerError,report.handlerError);assert(fs.readFileSync(native).subarray(0,before.length).equals(before));proof.histories.push({name,sessionId:id,oldNativeBytes:before.length,oldNativeSHA256:createHash('sha256').update(before).digest('hex'),localPrefixUnchanged:true});}proof.modelScan=visible(activeCase);requireBody(activeCase);assert(!proof.modelScan.some(x=>x.leaks.length));});
 }
 report.success=report.checks.every(c=>c.status==='PASS');
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{await host?.close();await store.close();net.fetch=originalFetch;await new Promise<void>(r=>model.close(()=>r()));fs.writeFileSync(path.join(output,'MODEL_REQUESTS.json'),JSON.stringify(bodies,null,2));fs.writeFileSync(path.join(output,'REPORT.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,output,checks:report.checks.map(c=>({name:c.name,status:c.status})),error:report.error}));if(!report.success)process.exitCode=1;}
