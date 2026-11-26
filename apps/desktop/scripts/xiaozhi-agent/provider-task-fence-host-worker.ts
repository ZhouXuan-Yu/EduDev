import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import {filesystemScope} from '../../src/main/xiaozhi-agent/permissions/resources';

const output = process.argv[2];
const dataRoot = path.join(output, 'data');
const workspace = path.join(output, 'workspace');
fs.mkdirSync(workspace);
process.env.DEEPSEEK_API_KEY = 'synthetic-provider-task-fence';
process.env.DEEPSEEK_MODEL = 'deepseek-flash';
const store = new OmniEduStore(dataRoot);
const calls: {caseName: string; model: string; tool: string | null}[] = [];
const publishedReviews = new Set<string>();
const checks: {name:string; pass:true}[] = [];
const report: {success:boolean;output:string;dataRoot:string;checks:typeof checks;cases:Record<string,unknown>;calls:typeof calls;paidCalls:number;error?:string} =
  {success:false,output,dataRoot,checks,cases:{},calls,paidCalls:0};
let host: ReturnType<typeof createXiaozhiProductionHost> | undefined;
let plan: {caseName:string;path:string;text:string;requirementsVersion:number;revision:number;preserve?:string};
let stage = 0;
let modelError: unknown;
const contentHash = (file:string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const model = http.createServer(async (request,response) => {
  try {
    if (request.url === '/v1/models') {
      response.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,
        max_output_tokens:32768,input_modalities:['text']}]}));
      return;
    }
    assert.equal(request.url,'/v1/chat/completions');
    let encoded = '';
    for await (const chunk of request) encoded += chunk;
    const body = JSON.parse(encoded);
    assert.equal(body.model,'deepseek-flash');
    const turn = stage++;
    const saveId=plan.preserve?'save_current':'save';
    let tool: {name:string;input:unknown} | null = null;
    if (turn === 0) {
      tool={name:'update_task_plan',input:{schemaVersion:'xiaozhi.task-plan.v3',expectedRevision:plan.revision,
        requirementsVersion:plan.requirementsVersion,reason:'保存本次教师要求的合成讲义',
        steps:[...(plan.preserve?[{id:'save',text:'保留原步骤待核对',target:plan.preserve,kind:'saved_text',reported:'pending',dependsOn:[]}]:[]),
          {id:saveId,text:'保存合成讲义',target:plan.path,kind:'saved_text',reported:'pending',dependsOn:[]},
          {id:'review',text:'教师核对实际讲义',kind:'human',reported:'pending',dependsOn:plan.preserve?['save',saveId]:[saveId]}]}};
    } else if (turn === 1) {
      tool={name:'office_create_text',input:{path:plan.path,content:plan.text,taskStepId:saveId}};
    }
    calls.push({caseName:plan.caseName,model:body.model,tool:tool?.name ?? null});
    const id='fence_'+randomUUID().replaceAll('-','');
    const chunk=(delta:unknown,reason:string|null) => 'data: '+JSON.stringify({id,object:'chat.completion.chunk',created:1,
      model:body.model,choices:[{index:0,delta,finish_reason:reason}]})+'\n\n';
    const delta=tool?{role:'assistant',tool_calls:[{index:0,id,type:'function',function:{name:tool.name,arguments:JSON.stringify(tool.input)}}]}
      :{role:'assistant',content:'请以实际文件和保存结果为准。'};
    response.writeHead(200,{'content-type':'text/event-stream'});
    response.end(chunk(delta,null)+chunk({},tool?'tool_calls':'stop')+'data: [DONE]\n\n');
  } catch (error) {
    modelError=error;
    if (!response.headersSent) response.writeHead(500);
    response.end();
  }
});

async function session(title:string) {
  const id=(await store.createAiConversationSession({title,folderId:null})).session.id;
  await store.xiaozhiState.setWorkspace(id,workspace,title);
  await host!.permissions.issue({sessionId:id,taskId:null,expiresAt:null,scopes:[filesystemScope(workspace,['read','write'])]});
  return id;
}
async function send(sessionId:string, next:typeof plan, continueTask?:{taskId:string;requirementsVersion:number}) {
  stage=0;
  plan=next;
  const started=await host!.start({sessionId,commandId:'xicmd_'+randomUUID(),prompt:'按当前要求生成合成讲义，保存前由教师确认。',
    ...(continueTask?{continueTask}:{})});
  assert(started.ok,JSON.stringify(started));
  return started.runId;
}
async function proposed(sessionId:string,runId:string) {
  const deadline=performance.now()+30_000;
  while(performance.now()<deadline) {
    if(modelError)throw modelError;
    const row=(await store.xiaozhiState.changes.list(sessionId)).find(item=>item.runId===runId&&item.state==='pending');
    if(row&&publishedReviews.has(row.id))return row;
    const run=await store.getAiAgentRun(runId);
    if(run&&!['running','pending','queued'].includes(run.status))throw Error('Run ended before save review: '+JSON.stringify(run));
    await delay(50);
  }
  throw Error('Missing actual save review: '+plan.caseName);
}
async function settle(sessionId:string,runId:string) {
  const deadline=performance.now()+30_000;
  while(performance.now()<deadline){
    if(modelError)throw modelError;
    const current=await host!.snapshot(sessionId);
    const turn=current.projection.turns.find(item=>item.id===runId);
    if(turn&&!current.running&&turn.status!=='running')return turn;
    await delay(50);
  }
  throw Error('Run did not settle: '+runId);
}
function approve(sessionId:string,row:{id:string;revision:number}) {
  return host!.decideTextChange({schemaVersion:'xiaozhi.change.v1',sessionId,changeId:row.id,revision:row.revision,action:'approve'});
}
const effects=(sessionId:string,taskId:string)=>store.xiaozhiState.effects.forTask(sessionId,taskId);
const audit=(runId:string)=>store.xiaozhiState.sql.all(
  'SELECT call_id,tool,phase,success,admitted,generation,contract_json,effect_state FROM xiaozhi_tool_receipts WHERE run_id=? ORDER BY rowid',[runId]);
const originalFetch=net.fetch;
try {
  await new Promise<void>(resolve=>model.listen(0,'127.0.0.1',resolve));
  const address=model.address();
  assert(address&&typeof address!=='string');
  net.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    assert.equal(url.origin,'https://api.deepseek.com');
    return globalThis.fetch('http://127.0.0.1:'+address.port+url.pathname,init);
  };
  await store.init();
  host=createXiaozhiProductionHost({store,dataRoot,enabled:true,emit:event=>{
    if(event.kind==='change'&&event.change.state==='pending')publishedReviews.add(event.change.id);
  }});

  const fileSession=await session('手工文件变化');
  const fileName='teacher-edit.txt';
  const fileRun=await send(fileSession,{caseName:'manual-file-change',path:fileName,text:'过期草稿',requirementsVersion:1,revision:0});
  const fileReview=await proposed(fileSession,fileRun);
  const file=path.join(workspace,fileName);
  assert(!fs.existsSync(file));
  fs.writeFileSync(file,'教师在等待期间保存的版本',{flag:'wx'});
  const teacherHash=contentHash(file);
  const decision=await approve(fileSession,fileReview);
  assert(decision.ok,JSON.stringify(decision));
  const fileTurn=await settle(fileSession,fileRun);
  const current=(await store.xiaozhiState.changes.list(fileSession)).find(item=>item.id===fileReview.id);
  assert.equal(current?.state,'conflict');
  assert.equal(contentHash(file),teacherHash);
  const fileTask=(await host.snapshot(fileSession)).task!;
  const fileEffects=await effects(fileSession,fileTask.id);
  assert(!fileEffects.some(item=>item.tool==='office_create_text'&&item.state==='committed'));
  const fileReceipts=await audit(fileRun);
  const fileAttempts=fileReceipts.filter(item=>item.tool==='office_create_text');
  assert.equal(fileAttempts.length,1);
  assert.equal(fileAttempts[0].phase,'settled');
  report.cases.manualFile={file,teacherHash,decision,current,turnStatus:fileTurn.status,receipts:fileReceipts,effects:fileEffects};
  checks.push({name:'Actual change confirmation refuses a teacher file changed during waiting and preserves its SHA-256',pass:true});

  const id=await session('新教学要求');
  const previousFile=path.join(workspace,'old-requirement.txt');
  const first=await send(id,{caseName:'old-requirement',path:path.basename(previousFile),text:'旧要求正文',requirementsVersion:1,revision:0});
  const oldReview=await proposed(id,first);
  const before=(await host.snapshot(id)).task!;
  const correction={schema:before.schema,sessionId:id,taskId:before.id,revision:before.revision,
    requirementsVersion:before.requirementsVersion,requestId:'xitact_'+randomUUID(),
    criteria:before.criteria.filter(row=>row.kind==='human').map(row=>({id:row.id,text:'教师修订：先保存新版讲义，旧稿保留待核对'}))};
  const during=await host.correctTask(correction);
  assert(!during.ok&&during.error==='busy');
  assert((await host.stop(id)).ok);
  await settle(id,first);
  const stopped=(await host.snapshot(id)).task!;
  const corrected=await host.correctTask({...correction,revision:stopped.revision,requestId:'xitact_'+randomUUID()});
  report.cases.requirementTransition={before,stopped,corrected};
  assert(corrected.ok,JSON.stringify(corrected));
  const updated=corrected.value.task!;
  assert.equal(updated.id,before.id);
  assert.equal(updated.requirementsVersion,before.requirementsVersion+1);
  const callsBeforeStaleStart=calls.length;
  const staleStart=await host.start({sessionId:id,commandId:'xicmd_'+randomUUID(),prompt:'继续旧要求',
    continueTask:{taskId:before.id,requirementsVersion:before.requirementsVersion}});
  assert(!staleStart.ok,JSON.stringify(staleStart));
  assert.equal(calls.length,callsBeforeStaleStart);
  assert.equal((await host.snapshot(id)).task?.requirementsVersion,updated.requirementsVersion);
  const freshName='new-requirement.txt';
  const fresh=await send(id,{caseName:'new-requirement',path:freshName,text:'教师确认的新版讲义',
    requirementsVersion:updated.requirementsVersion,revision:updated.planRevision,preserve:path.basename(previousFile)},
    {taskId:updated.id,requirementsVersion:updated.requirementsVersion});
  const freshReview=await proposed(id,fresh);
  const late=await approve(id,oldReview);
  assert(!late.ok,JSON.stringify(late));
  assert(!fs.existsSync(previousFile));
  const approved=await approve(id,freshReview);
  assert(approved.ok,JSON.stringify(approved));
  await settle(id,fresh);
  const finalFile=path.join(workspace,freshName);
  assert.equal(fs.readFileSync(finalFile,'utf8'),'教师确认的新版讲义');
  assert(!fs.existsSync(previousFile));
  const final=(await host.snapshot(id)).task!;
  assert.equal(final.id,before.id);
  assert.equal(final.requirementsVersion,updated.requirementsVersion);
  const finalEffects=await effects(id,final.id);
  const ownedWrites=finalEffects.filter(item=>item.tool==='office_create_text'&&item.state==='committed');
  assert.deepEqual(ownedWrites.map(item=>[item.owner.runId,item.contract.requirementsVersion]),[[fresh,updated.requirementsVersion]]);
  report.cases.requirements={before,stopped,updated,staleStart,staleStartModelCalls:0,late,final,finalFile,sha256:contentHash(finalFile),
    previousReceipts:await audit(first),currentReceipts:await audit(fresh),effects:finalEffects};
  checks.push({name:'Actual task correction advances the generation, blocks the old pending approval and saves only the new requirements',pass:true});
  report.success=true;
} catch(error) {
  report.error=String(error instanceof Error?error.stack:error);
  process.exitCode=1;
} finally {
  await host?.close();
  await store.close();
  net.fetch=originalFetch;
  model.closeAllConnections();
  await new Promise<void>(resolve=>model.close(()=>resolve()));
  fs.writeFileSync(path.join(output,'REPORT.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,checks:checks.length,output,error:report.error}));
}
