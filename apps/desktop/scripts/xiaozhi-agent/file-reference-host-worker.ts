import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import {fileVersion} from '../../src/main/xiaozhi-agent/workspace-files';
import {PERMISSION_MODES} from '../../src/shared/xiaozhi-permissions';

const output=process.argv[2],dataRoot=path.join(output,'data'),workspace=path.join(output,'workspace');
fs.mkdirSync(workspace);
process.env.DEEPSEEK_API_KEY='synthetic-file-privacy-loopback';
process.env.DEEPSEEK_MODEL='deepseek-flash';
const identifiers=['合成学员霁青','合成学生甲木','合成松岚学堂','合成学员青柏','合成学生乙禾','合成远岚学堂',
 '13800138000','student.synthetic@example.com','110101199001011234','D:\\synthetic-student-only\\record.txt'];
const filename='合成学员霁青-合成松岚学堂.txt',file=path.join(workspace,filename);
const original=Buffer.from(identifiers.join(' ')+'\nSAFE_TEACHER_TEXT_V1 一元一次方程 2x+3=9。\n');
fs.writeFileSync(file,original);
const originalHash=createHash('sha256').update(original).digest('hex'),originalVersion=fileVersion(fs.statSync(file));
let store=new OmniEduStore(dataRoot);let lastSession='',lastSelector='';let writing=false;
let host:ReturnType<typeof createXiaozhiProductionHost>|undefined;
let activeCase='',scenario:{name:string;input:Record<string,unknown>}[]=[];
const selectorTrace:any[]=[],structuredFields:any[]=[];
const requests:{case:string;body:any}[]=[],checks:{name:string;pass:boolean;durationMs:number}[]=[];
const report={success:false,output,checks,paidCalls:0,modelCalls:0,error:undefined as string|undefined,
 boundary:'Actual production Host, SQLite, Pi and owned local file. Model transport is a loopback SSE fixture. No visible window, paid model or external endpoint.'};
function semanticStrings(value:unknown,depth=0):string[]{
 if(depth>8)return [];
 if(typeof value==='string'){
  try{return [value,...semanticStrings(JSON.parse(value),depth+1)];}catch{return [value];}
 }
 if(Array.isArray(value))return value.flatMap(item=>semanticStrings(item,depth+1));
 if(value&&typeof value==='object')return Object.values(value).flatMap(item=>semanticStrings(item,depth+1));
 return [];
}
const makeHost=()=>createXiaozhiProductionHost({store,dataRoot,enabled:true,emit(event){if(event.kind==='change'&&event.change.state==='pending')void host!.decideTextChange({schemaVersion:'xiaozhi.change.v1',sessionId:event.sessionId,changeId:event.change.id,revision:event.change.revision,action:'approve'}).then(result=>{assert(result.ok,JSON.stringify(result));}).catch(error=>{report.error=String(error.stack||error);});}});
const server=http.createServer(async(request,response)=>{
 try{
  if(request.url==='/v1/models'){
   response.writeHead(200,{'content-type':'application/json'});
   response.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,
    input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'low'}}]}));return;
  }
  assert.equal(request.url,'/v1/chat/completions');
  let text='';for await(const piece of request)text+=piece;
  requests.push({case:activeCase,body:JSON.parse(text)});report.modelCalls++;
  const tool=scenario.shift();
  const actual=requests.at(-1)!.body.messages.filter((message:any)=>message.role==='tool').flatMap((message:any)=>{
   try{return [JSON.parse(String(message.content).split('\n')[0])];}catch{return [];}
  });
  if(tool?.name==='office_file_stat'){
   const written=actual.findLast((value:any)=>value.outcome==='applied'&&typeof value.file==='string');const listed=actual.find((value:any)=>value.tool==='office_list_files'&&value.success);
   assert(listed);const entry=listed.data.entries.find((entry:any)=>entry.kind==='file');assert(entry);
   tool.input.path=written?.file||entry.name;selectorTrace.push({tool:tool.name,selector:tool.input.path,from:written?'applied writer.file':'office_list_files.data.entries[].name'});
  }
  if(tool?.name==='office_read_text'){
   const stated=actual.findLast((value:any)=>value.tool==='office_file_stat'&&value.success);assert(stated);
   tool.input.path=stated.data.source;selectorTrace.push({tool:tool.name,selector:stated.data.source,from:'office_file_stat.data.source'});
  }
  if(tool?.name==='update_task_plan'){const read=actual.findLast((value:any)=>value.tool==='office_read_text'&&value.success);assert(read);const sys=requests.at(-1)!.body.messages.filter((message:any)=>message.role==='system').map((message:any)=>message.content).join('\n');const version=Number([...sys.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1);tool.input={schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:version,expectedRevision:0,reason:'保存合成副本并修订同一来源',steps:[{id:'copy',text:'保存副本',dependsOn:[],reported:'pending',kind:'saved_text',target:'copied.txt'},{id:'edit',text:'修订原件',dependsOn:[],reported:'pending',kind:'saved_text',target:read.data.source},{id:'create',text:'保存新教学文件',dependsOn:[],reported:'pending',kind:'saved_text',target:'合成学员青柏-合成远岚学堂-新建.txt'},{id:'review',text:'教师核对',dependsOn:['copy','edit','create'],reported:'pending',kind:'human'}]};}
  if(tool?.name==='office_copy_file'||tool?.name==='office_edit_text'){const read=actual.findLast((value:any)=>value.tool==='office_read_text'&&value.success);assert(read);if(tool.name==='office_copy_file')tool.input.source=read.data.source;else tool.input.path=read.data.source;}
  const base={id:'synthetic-file-privacy',object:'chat.completion.chunk',created:1,model:'deepseek-flash'};
  const delta=tool?{role:'assistant',tool_calls:[{index:0,id:'call_'+randomUUID().replaceAll('-',''),type:'function',
   function:{name:tool.name,arguments:JSON.stringify(tool.input)}}]}:{role:'assistant',content:'已读取合成教学文字并保留原文件。'};
  response.writeHead(200,{'content-type':'text/event-stream'});
  response.write('data: '+JSON.stringify({...base,choices:[{index:0,delta,finish_reason:null}]})+'\n\n');
  response.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{},finish_reason:tool?'tool_calls':'stop'}],
   usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130}})+'\n\n');
  response.end('data: [DONE]\n\n');
 }catch(error){report.error=String((error as Error).stack||error);response.writeHead(500);response.end('fixture failure');}
});
const originalFetch=net.fetch;
async function check(name:string,action:()=>Promise<void>){
 activeCase=name;const started=performance.now();await action();
 checks.push({name,pass:true,durationMs:performance.now()-started});console.log('PASS '+name);
}
async function run(mode:typeof PERMISSION_MODES[number],tool:{name:string;input:Record<string,unknown>}){
 const sessionId=(await store.createAiConversationSession({title:'合成文件隐私回归',folderId:null})).session.id;
 lastSession=sessionId;await store.xiaozhiState.setWorkspace(sessionId,workspace,'合成教学目录');
 const permissions=await host!.permissions.view(sessionId);
 await host!.permissions.setMode({sessionId,revision:permissions.profile.revision,mode});
 scenario=[tool,{name:'office_file_stat',input:{}},{name:'office_read_text',input:{}},...(writing?[{name:'update_task_plan',input:{}},{name:'office_copy_file',input:{target:'copied.txt',taskStepId:'copy'}},{name:'office_edit_text',input:{taskStepId:'edit',edits:[{oldText:'SAFE_TEACHER_TEXT_V1',newText:'SAFE_TEACHER_TEXT_V2'}]}},{name:'office_create_text',input:{taskStepId:'create',path:'合成学员青柏-合成远岚学堂-新建.txt',content:'SAFE_NEW_TEACHING_TEXT 3x=9'}},{name:'office_file_stat',input:{}},{name:'office_read_text',input:{}}]:[])];
 const started=await host!.start({sessionId,commandId:'xicmd_'+randomUUID(),prompt:'读取教师选择的合成教案，核对其中一元一次方程的教学文字。'});
 assert(started.ok,JSON.stringify(started));await host!.waitForRun(sessionId,started.runId);
 assert(!report.error,report.error);assert.equal(scenario.length,0,'The actual Host must dispatch the normal requested tool');
 const bodies=requests.filter(item=>item.case===activeCase).map(item=>item.body);
 assert(bodies.length>=2,'A subsequent model POST must contain the actual tool result');
 const strings=semanticStrings(bodies);
 const payloads=bodies.flatMap(body=>body.messages.filter((message:any)=>message.role==='tool').flatMap((message:any)=>{try{return [JSON.parse(String(message.content).split('\n')[0])];}catch{return [];}}));
 for(const payload of payloads){
  const values=payload.tool==='office_list_files'?payload.data?.entries?.map((entry:any)=>({field:'data.entries[].name',value:entry.name})):[{field:'data.source',value:payload.data?.source}];
  for(const item of values||[])if(typeof item.value==='string')structuredFields.push({mode,tool:payload.tool,...item,knownIdentifiers:identifiers.filter(identifier=>item.value.includes(identifier)),absoluteDrive:/^[a-z]:[\\/]/i.test(item.value)});
 }
 (report as any).structuredFields=structuredFields;(report as any).selectorTrace=selectorTrace;
 const toolTexts=bodies.flatMap(body=>body.messages.filter((message:any)=>message.role==='tool').flatMap((message:any)=>semanticStrings(message.content)));
 assert(toolTexts.some(text=>text.includes('SAFE_TEACHER_TEXT_V1')),'Safe teaching content must reach the subsequent model request');
 assert(toolTexts.some(text=>text.includes('2x+3=9')),'Teaching mathematics must remain intact');
 return toolTexts;
}
try{
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert(address&&typeof address!=='string');
 net.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  assert.equal(url.origin,'https://api.deepseek.com','Only the configured model route may reach this loopback fixture');
  return fetch(`http://127.0.0.1:${address.port}${url.pathname}`,init);
 };
 await store.init();
 for(const offset of [0,3])await store.createStudent({realName:identifiers[offset],displayName:identifiers[offset+1],school:identifiers[offset+2],grade:'七年级',subjects:['数学']});
 host=makeHost();
 for(const mode of ['request','fullAccess'] as const)await check('Normal list to stat to read selector roundtrip under '+mode,async()=>{
  const texts=await run(mode,{name:'office_list_files',input:{path:'.'}});
  const payload=texts.flatMap(text=>{try{return[JSON.parse(text.split('\n')[0])];}catch{return[];}}).find(value=>value.tool==='office_read_text'&&value.success);
  assert(payload);lastSelector=payload.data.source;assert.match(payload.data.source,/^xiaozhi-file:\/\/[a-f0-9]{32}$/);assert.equal((await store.xiaozhiState.fileReferences.get(payload.data.source))?.relative,filename);assert.equal(payload.data.sha256,originalHash);assert.equal(payload.data.version,originalVersion);assert(!semanticStrings(requests.filter(item=>item.case===activeCase)).some(text=>identifiers.some(identifier=>text.includes(identifier))),'No known student identifiers or local path may reach model transport');
 });
 await check('Synthetic original bytes and file version survive the selector roundtrip',async()=>{
  assert(fs.readFileSync(file).equals(original));assert.equal(fileVersion(fs.statSync(file)),originalVersion);
 });
 await check('Cold Host and SQLite reopen reuse same task selector without replaying effects',async()=>{const snapshot=await host!.snapshot(lastSession);assert(snapshot.task);await host!.close();await store.close();store=new OmniEduStore(dataRoot);await store.init();host=makeHost();scenario=[{name:'office_file_stat',input:{path:lastSelector}},{name:'office_read_text',input:{}}];const started=await host.start({sessionId:lastSession,commandId:'xicmd_'+randomUUID(),prompt:'继续核对已有教学来源。',continueTask:{taskId:snapshot.task.id,requirementsVersion:snapshot.task.requirementsVersion}});assert(started.ok,JSON.stringify(started));await host.waitForRun(lastSession,started.runId);assert(!report.error,report.error);assert.equal(scenario.length,0);assert.equal((await store.xiaozhiState.fileReferences.get(lastSelector))?.relative,filename);assert(fs.readFileSync(file).equals(original));assert(!semanticStrings(requests.filter(item=>item.case===activeCase)).some(text=>identifiers.some(identifier=>text.includes(identifier))));});
 await check('Same-source task admission, approved edit and controlled copy use canonical private source',async()=>{writing=true;await run('fullAccess',{name:'office_list_files',input:{path:'.'}});assert.equal(fs.readFileSync(file,'utf8'),original.toString().replace('SAFE_TEACHER_TEXT_V1','SAFE_TEACHER_TEXT_V2'));assert(fs.readFileSync(path.join(workspace,'copied.txt')).equals(original));const results=requests.filter(item=>item.case===activeCase).flatMap(item=>item.body.messages).filter(message=>message.role==='tool').flatMap(message=>{try{return[JSON.parse(String(message.content).split('\n')[0])];}catch{return[];}});assert(results.some(value=>value.tool==='office_copy_file'&&value.success));assert(results.some(value=>value.outcome==='applied'&&/^xiaozhi-file:/.test(value.file)));assert.equal(fs.readFileSync(path.join(workspace,'合成学员青柏-合成远岚学堂-新建.txt'),'utf8'),'SAFE_NEW_TEACHING_TEXT 3x=9');assert(results.some(value=>value.tool==='office_read_text'&&value.data?.text==='SAFE_NEW_TEACHING_TEXT 3x=9'));assert(!semanticStrings(requests.filter(item=>item.case===activeCase)).some(text=>identifiers.some(identifier=>text.includes(identifier))));});
 (report as any).finding={knownIdentifiersInStructuredFields:structuredFields.some(item=>item.knownIdentifiers.length>0),absoluteDriveInStructuredFields:structuredFields.some(item=>item.absoluteDrive),selectorsRoundtrip:selectorTrace.length>=4&&selectorTrace.every(step=>requests.some(request=>request.body.messages.some((message:any)=>{if(message.role!=='tool')return false;try{const value=JSON.parse(String(message.content).split('\n')[0]);return value.tool===step.tool&&value.success===true&&value.data?.source===step.selector;}catch{return false;}}))),scope:'Actual production Host and owned SQLite/files: privacy-safe list/stat/read selectors, cold same-task recovery, canonical task admission, teacher-approved edit/create and controlled copy. Synthetic loopback model; no live provider or full-domain privacy acceptance.'};
 assert.equal((report as any).finding.knownIdentifiersInStructuredFields,false);assert.equal((report as any).finding.selectorsRoundtrip,true);report.success=true;
}catch(error){report.error=String((error as Error).stack||error);console.error(error);process.exitCode=1;}
finally{
 await host?.close();await store.close();net.fetch=originalFetch;
 await new Promise<void>(resolve=>server.close(()=>resolve()));
 fs.writeFileSync(path.join(output,'MODEL_REQUESTS.json'),JSON.stringify(requests,null,2));
 fs.writeFileSync(path.join(output,'REPORT.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
