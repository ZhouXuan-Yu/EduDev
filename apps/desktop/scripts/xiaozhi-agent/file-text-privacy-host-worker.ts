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
const filename='synthetic-teacher.txt',file=path.join(workspace,filename);
const original=Buffer.from(identifiers.join(' ')+'\nSAFE_TEACHER_TEXT_V1 一元一次方程 2x+3=9。\n');
fs.writeFileSync(file,original);
const originalHash=createHash('sha256').update(original).digest('hex'),originalVersion=fileVersion(fs.statSync(file));
const store=new OmniEduStore(dataRoot);
let host:ReturnType<typeof createXiaozhiProductionHost>|undefined;
let activeCase='',scenario:{name:string;input:Record<string,unknown>}[]=[];
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
  const tool=scenario.shift(),base={id:'synthetic-file-privacy',object:'chat.completion.chunk',created:1,model:'deepseek-flash'};
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
 await store.xiaozhiState.setWorkspace(sessionId,workspace,'合成教学目录');
 const permissions=await host!.permissions.view(sessionId);
 await host!.permissions.setMode({sessionId,revision:permissions.profile.revision,mode});
 scenario=[tool];
 const started=await host!.start({sessionId,commandId:'xicmd_'+randomUUID(),prompt:'读取教师选择的合成教案，核对其中一元一次方程的教学文字。'});
 assert(started.ok,JSON.stringify(started));await host!.waitForRun(sessionId,started.runId);
 assert(!report.error,report.error);assert.equal(scenario.length,0,'The actual Host must dispatch the normal requested tool');
 const bodies=requests.filter(item=>item.case===activeCase).map(item=>item.body);
 assert(bodies.length>=2,'A subsequent model POST must contain the actual tool result');
 const strings=semanticStrings(bodies);
 for(const identifier of identifiers)assert(!strings.some(text=>text.includes(identifier)),'Unredacted synthetic identifier: '+identifier);
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
 host=createXiaozhiProductionHost({store,dataRoot,enabled:true,emit(){}});
 for(const mode of PERMISSION_MODES)await check('Normal file text is redacted under '+mode,async()=>{
  const texts=await run(mode,{name:'office_read_text',input:{path:filename}});
  const payload=texts.flatMap(text=>{try{return[JSON.parse(text.split('\n')[0])];}catch{return[];}})
   .find(value=>value.success&&value.data?.text?.includes('SAFE_TEACHER_TEXT_V1'));
  assert(payload,'The real file tool must succeed');assert.equal(payload.data.sanitized,true);
  assert.equal(payload.data.source,filename);assert.equal(payload.data.sha256,originalHash);assert.equal(payload.data.version,originalVersion);
 });
 await check('Foreground terminal output uses the same production file text boundary',async()=>{
  await run('fullAccess',{name:'exec_command',input:{cmd:"Get-Content -LiteralPath 'synthetic-teacher.txt' -Raw",timeout:30}});
 });
 await check('Local source bytes, filename and version remain unchanged',async()=>{
  assert(fs.readFileSync(file).equals(original));assert.equal(path.basename(file),filename);
  assert.equal(fileVersion(fs.statSync(file)),originalVersion);
 });
 report.success=true;
}catch(error){report.error=String((error as Error).stack||error);console.error(error);process.exitCode=1;}
finally{
 await host?.close();await store.close();net.fetch=originalFetch;
 await new Promise<void>(resolve=>server.close(()=>resolve()));
 fs.writeFileSync(path.join(output,'MODEL_REQUESTS.json'),JSON.stringify(requests,null,2));
 fs.writeFileSync(path.join(output,'REPORT.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
