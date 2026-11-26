import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';

const [build,acceptance]=process.argv.slice(2);
assert(path.isAbsolute(build??'')&&path.isAbsolute(acceptance??''));
const budgetCases=process.argv[4]==='--budget';
assert(!process.argv[4]||budgetCases,'Unknown fixture argument');
const main=fs.realpathSync(path.join(build,'main/index.js'));
const root=fs.mkdtempSync(path.join(fs.realpathSync(acceptance),'provider-goal-recovery-'));
const data=path.join(root,'data'),profile=path.join(root,'profile'),workspace=path.join(root,'workspace');
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={ok:false,root,mainHash:sha(main),checks:[],calls:[],paidCalls:0};
const input=path.join(workspace,'课堂资料.txt'),code='GOAL-RECOVERY-3719';
const outputs={
  denial:{first:'教师已保存的讲义.md',second:'教师拒绝的练习.md'},
  budget:{first:'超时前已保存讲义.md',second:'预算耗尽未保存练习.md'},
};
fs.mkdirSync(workspace);
fs.writeFileSync(input,'浮力方向竖直向上。资料核验码 '+code);
const originalSha=sha(input);
let app,page,mode='inactive',number=0;

const server=http.createServer(async(request,response)=>{
  if(request.url==='/v1/models'){
    response.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({object:'list',data:[{
      id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']
    }]}));
    return;
  }
  if(request.url!=='/v1/chat/completions'||request.method!=='POST'){
    response.writeHead(404).end();
    return;
  }
  let encoded='';
  for await(const chunk of request)encoded+=chunk;
  const body=JSON.parse(encoded),ordinal=++number;
  const row={mode,ordinal,at:Date.now(),model:body.model,status:200};
  report.calls.push(row);
  if((mode==='review'||mode==='pause')&&ordinal===1){
    row.status=503;
    response.writeHead(503,{'content-type':'application/json','retry-after':'2.5'}).end(JSON.stringify({error:{message:'Owned transient failure'}}));
    return;
  }
  if(mode==='budget'&&ordinal>=3){
    row.status=503;
    response.writeHead(503,{'content-type':'application/json','retry-after':'0'}).end(JSON.stringify({error:{message:'Owned recovery ceiling'}}));
    return;
  }
  let tool;
  if(mode==='review'&&ordinal===2)tool={name:'office_read_text',arguments:JSON.stringify({path:'课堂资料.txt'})};
  if(mode==='review'&&ordinal===3){
    row.sourceSeen=body.messages.some(message=>message.role==='tool'&&JSON.stringify(message.content).includes(code));
    tool={name:'report_goal_progress',arguments:JSON.stringify({summary:'已核对一次合成课堂资料。',nextStep:'交给教师确认',readyForReview:true})};
  }
  if(outputs[mode]&&ordinal===1){
    const {first,second}=outputs[mode];
    tool={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:1,expectedRevision:0,
      reason:'先保存讲义，再单独审核练习',steps:[
        {id:'lesson',text:'审核并保留讲义',kind:'saved_text',target:first,reported:'pending',dependsOn:[]},
        {id:'practice',text:'审核并保存练习',kind:'saved_text',target:second,reported:'pending',dependsOn:['lesson']},
        {id:'review',text:'教师核对',kind:'human',reported:'pending',dependsOn:['practice']},
      ]})};
  }
  if(outputs[mode]&&ordinal===2)tool={name:'office_create_text',arguments:JSON.stringify({
    taskStepId:'lesson',path:outputs[mode].first,content:'# 已核对的讲义\n版次 '+code
  })};
  if(mode==='denial'&&ordinal===3)tool={name:'office_create_text',arguments:JSON.stringify({
    taskStepId:'practice',path:outputs[mode].second,content:'# 待审核的练习\n浮力方向。'
  })};
  if(mode==='denial'&&ordinal===4)tool={name:'report_goal_progress',arguments:JSON.stringify({
    summary:'老师确认的讲义已保留，练习未获批准。',nextStep:'待教师确认剩余安排',readyForReview:true
  })};
  if(mode==='pause'||mode==='inactive'||ordinal>7){row.status=412;response.writeHead(412).end();return;}
  const delta=tool?{role:'assistant',tool_calls:[{index:0,id:'goal_recovery_'+ordinal,type:'function',function:tool}]}:
    {role:'assistant',content:mode==='review'?'依据课堂资料，浮力竖直向上。核验码 '+code:
      mode==='denial'?'讲义已保存，练习尚未获准。':'这一轮没有新增核验证据。'};
  const chunk=(delta,finish_reason)=>'data: '+JSON.stringify({id:'goal-'+mode+'-'+ordinal,object:'chat.completion.chunk',created:1,
    model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
  response.writeHead(200,{'content-type':'text/event-stream'}).end(chunk(delta,null)+chunk({},tool?'tool_calls':'stop')+'data: [DONE]\n\n');
});

async function until(action,label,timeout=35_000){
  const end=Date.now()+timeout;
  do{const found=await action();if(found)return found;await delay(40);}while(Date.now()<end);
  throw Error('Timed out: '+label);
}
function ledger(id){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{
    const row=db.prepare('SELECT payload_json FROM xiaozhi_pi_goals WHERE id=?').get(id);
    return row&&JSON.parse(row.payload_json);
  }finally{db.close();}
}
const snapshot=sessionId=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
const mutate=input=>page.evaluate(value=>window.omniEdu.mutateXiaozhiGoal(value),input);

async function create(phase){
  mode=phase;number=0;
  const goal=await page.evaluate(async title=>{
    const {session}=await window.omniEdu.createAiConversationSession({title,folderId:null});
    const selected=await window.omniEdu.selectXiaozhiWorkspace(session.id);
    if(!selected.ok)throw Error(JSON.stringify(selected));
    return {sessionId:session.id,id:'xigoal_'+crypto.randomUUID()};
  },'目标故障恢复 '+phase);
  const pathPair=outputs[phase];
  const objective=pathPair?`分两步实际保存“${pathPair.first}”和“${pathPair.second}”，每次先等教师审批，再提交验收。`:
    '核对合成课堂资料中的浮力方向及标记，提交老师核对。';
  const response=await mutate({...goal,schemaVersion:1,action:'create',revision:0,
    objective,criteria:['讲解保留资料真实标记']});
  assert(response.ok,JSON.stringify(response));
  return goal;
}
async function waitRetry(owner){
  return until(async()=>{
    const state=await snapshot(owner.sessionId);
    return state.projection.turns.find(turn=>turn.id===state.goal?.runId)?.modelRequests?.find(item=>item.state==='retry_wait');
  },'the authoritative retry event');
}
async function decideText(owner,file,action){
  if(action==='approve'){
    const pending=await until(async()=>{
      const result=await page.evaluate(id=>window.omniEdu.getXiaozhiPermissions(id),owner.sessionId);
      return result.ok&&result.value.approvals.find(item=>item.state==='pending'&&item.request.action==='office_create_text'&&
        item.request.files.some(target=>target.path===file));
    },'a teacher-owned write permission for '+file);
    const allowed=await page.evaluate(input=>window.omniEdu.decideXiaozhiPermission(input),{
      sessionId:owner.sessionId,approvalId:pending.id,revision:pending.revision,decision:'approve',scope:'task'
    });
    assert(allowed.ok,JSON.stringify(allowed));
  }
  const change=await until(async()=> (await snapshot(owner.sessionId)).changes.find(item=>item.path===file&&item.state==='pending'),
    'the real text approval '+file);
  assert(!fs.existsSync(path.join(workspace,file)));
  const result=await page.evaluate(input=>window.omniEdu.decideXiaozhiChange(input),{schemaVersion:'xiaozhi.change.v1',
    sessionId:owner.sessionId,changeId:change.id,revision:change.revision,action});
  assert(result.ok,JSON.stringify(result));
  return change;
}
function countRuns(sessionId){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare('SELECT count(*) AS n FROM xiaozhi_event_runs WHERE session_id=?').get(sessionId).n;}
  finally{db.close();}
}
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>
    !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(key)));
  Object.assign(env,{OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_DATA_ROOT:data,
    OMNI_EDU_REPO_ROOT:path.resolve(import.meta.dirname,'../../../..'),DEEPSEEK_API_KEY:'owned-goal-no-external',DEEPSEEK_MODEL:'deepseek-flash',
    TEMP:root,TMP:root});
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,timeout:60_000});
  await app.evaluate(({dialog,net},{workspace,port})=>{
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[workspace]});
    net.fetch=(input,init)=>{
      const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
      if(target.origin!=='https://api.deepseek.com')throw Error('Owned goal fixture blocks external destinations');
      return fetch('http://127.0.0.1:'+port+target.pathname,init);
    };
  },{workspace,port:server.address().port});
  page=await app.firstWindow();
  await page.getByTestId('office-prompt-input').waitFor();

  const review=await create('review');
  const retry=await waitRetry(review);
  const initial=ledger(review.id);
  assert.equal(number,1);
  const save=await page.evaluate(()=>window.omniEdu.createQuestionBankItem({subject:'物理',grade:'初二',knowledgePoint:'浮力',
    questionType:'解答题',difficulty:'medium',stem:'在独立入口保存的合成浮力练习题。',answer:'竖直向上',
    analysis:'依据浮力方向。',sourceTitle:'Provider 故障隔离验收',tags:[]}));
  const saved=(()=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{
    return db.prepare('SELECT stem FROM question_bank_items WHERE id=?').get(save.id);
  }finally{db.close();}})();
  assert.equal(saved.stem,save.stem);
  for(let read=0;read<4;read++){
    await snapshot(review.sessionId);
    await delay(75);
  }
  const waiting=ledger(review.id);
  assert.equal(number,1);
  assert.equal(waiting.id,initial.id);
  assert.equal(waiting.revision,initial.revision);
  assert.deepEqual(waiting.progressKeys,initial.progressKeys);
  assert.equal(waiting.repeats,initial.repeats);
  const candidate=await until(async()=>{
    const current=await snapshot(review.sessionId);
    return !current.running&&current.goal?.state==='review_required'&&current.goal.resultRunId&&current;
  },'the original goal reaches the teacher review boundary');
  assert.equal(candidate.goal.id,review.id);
  assert.equal(candidate.goal.runId,initial.runId);
  assert(report.calls.find(row=>row.mode==='review'&&row.ordinal===3)?.sourceSeen);
  const usage=candidate.usage.find(row=>row.runId===initial.runId);
  assert.equal(usage.modelCalls,4);
  assert(usage.activeMs>=retry.waitMs&&usage.waitingMs===0);
  assert(usage.activeMs<=usage.budget.activeMs);
  assert.match(candidate.goal.candidate,/GOAL-RECOVERY-3719/u);
  const accept=await mutate({...review,schemaVersion:1,action:'accept',revision:candidate.goal.revision,checked:[0]});
  assert(accept.ok&&accept.goal.state==='completed',JSON.stringify(accept));
  report.review={retry,waiting:{id:waiting.id,revision:waiting.revision,repeats:waiting.repeats},
    accepted:accept.goal,run:initial.runId,independentSaved:save.id,usage};
  report.checks.push('Repeated real snapshot reads during model retry neither spend calls nor create progress; the same goal reaches explicit teacher acceptance');

  const stalled=await create('stall');
  const lost=await until(async()=>{
    const current=await snapshot(stalled.sessionId);
    return !current.running&&current.goal?.state==='interrupted'&&current;
  },'the original no-progress cutoff');
  assert.equal(lost.goal.id,stalled.id);
  assert.equal(lost.goal.progress?.idleBoundaries,3);
  assert.equal(number,3);
  assert.equal(lost.projection.turns.find(turn=>turn.id===lost.goal.runId)?.errorCode,'goal_stalled');
  report.stall={goal:lost.goal,calls:number};
  report.checks.push('The actual scheduler stops the original goal after the third evidence-free boundary');

  const paused=await create('pause');
  await waitRetry(paused);
  const live=(await snapshot(paused.sessionId)).goal;
  const stopped=await mutate({...paused,schemaVersion:1,action:'pause',revision:live.revision});
  assert(stopped.ok);
  await delay(3_000);
  const terminal=await snapshot(paused.sessionId);
  assert(!terminal.running);
  assert.equal(number,1);
  assert.equal(terminal.goal.state,'paused');
  assert.equal(terminal.goal.id,paused.id);
  assert.equal(sha(input),originalSha);
  report.pause={goal:terminal.goal,calls:number,sourceHash:originalSha};
  report.checks.push('Teacher pause during a real retry wait remains terminal for that run and sends no second request');
  if(budgetCases){
    const denial=await create('denial');
    const first=await decideText(denial,outputs.denial.first,'approve');
    const second=await decideText(denial,outputs.denial.second,'reject');
    const original=path.join(workspace,outputs.denial.first),originalHash=sha(original);
    const refused=await until(async()=>{
      const item=await snapshot(denial.sessionId);
      return !item.running&&item.goal?.state==='review_required'&&item.goal.resultRunId&&item;
    },'the teacher reviews the partial goal after a denied file');
    assert.equal(refused.changes.find(item=>item.id===first.id).state,'applied');
    assert.equal(refused.changes.find(item=>item.id===second.id).state,'rejected');
    assert(!fs.existsSync(path.join(workspace,outputs.denial.second)));
    const unready=await mutate({...denial,schemaVersion:1,action:'accept',revision:refused.goal.revision,checked:[0]});
    assert(!unready.ok,'An unfulfilled file criterion cannot be accepted');
    const detail=await page.evaluate(id=>window.omniEdu.getXiaozhiTask({sessionId:id}),denial.sessionId);
    assert(detail.ok&&detail.value.candidate);
    const view=detail.value.task;
    const returned=await page.evaluate(input=>window.omniEdu.reviewXiaozhiTask(input),{
      schema:'xiaozhi.task.v1',sessionId:denial.sessionId,taskId:view.id,revision:view.revision,requirementsVersion:view.requirementsVersion,
      requestId:'xitact_'+randomUUID(),candidate:detail.value.candidate,
      checked:view.criteria.filter(item=>item.kind==='human').map(item=>({criterionId:item.id,version:item.version,accepted:false})),
    });
    assert(returned.ok,JSON.stringify(returned));
    const afterDenial=await snapshot(denial.sessionId);
    const paid=number;
    await delay(350);
    assert.equal(afterDenial.goal.state,'paused');
    assert.equal(afterDenial.task.id,view.id);
    assert.equal(number,paid);
    assert.equal(countRuns(denial.sessionId),1);
    assert.equal(sha(original),originalHash);
    report.denial={state:afterDenial.goal.state,artifactSha256:originalHash,calls:paid,task:view.id,retained:afterDenial.goal.id};
    report.checks.push('Teacher refusal keeps the real saved file, blocks incomplete approval and pauses the same goal with zero automatic continuation');

    const budget=await create('budget');
    await decideText(budget,outputs.budget.first,'approve');
    const frozen=path.join(workspace,outputs.budget.first);
    const exhausted=await until(async()=>{
      const item=await snapshot(budget.sessionId);
      return !item.running&&item.goal?.state==='interrupted'&&item;
    },'three allowed recovery attempts close the original goal');
    const failed=exhausted.projection.turns.find(turn=>turn.id===exhausted.goal.runId);
    assert.equal(failed.errorCode,'provider_unavailable');
    const active=exhausted.usage.find(row=>row.runId===failed.id);
    assert.equal(active.modelCalls,5);
    const actualBudget=report.calls.filter(row=>row.mode==='budget');
    assert.deepEqual(actualBudget.map(row=>row.status),[200,200,503,503,503]);
    assert(actualBudget.every(row=>row.model==='deepseek-flash'));
    const retainedHash=sha(frozen);
    await delay(1100);
    const settled=await snapshot(budget.sessionId);
    assert.equal(number,5);
    assert.equal(countRuns(budget.sessionId),1);
    assert.equal(settled.task.id,exhausted.task.id);
    assert.equal(settled.goal.id,budget.id);
    assert.equal(sha(frozen),retainedHash);
    assert(!fs.existsSync(path.join(workspace,outputs.budget.second)));
    const remaining=await page.evaluate(id=>window.omniEdu.getXiaozhiTask({sessionId:id}),budget.sessionId);
    assert(remaining.ok&&remaining.value.task?.steps.some(step=>step.id==='practice'&&step.reported==='pending'));
    report.exhausted={goal:settled.goal.id,task:settled.task.id,error:failed.errorCode,usage:active,retainedHash,calls:actualBudget};
    report.checks.push('Exhausted wire recovery spends three physical attempts, preserves the saved artifact and retains only the explicit continuation boundary');
  }
  report.ok=true;
}catch(error){
  report.error=String(error.stack??error);
  process.exitCode=1;
}finally{
  await app?.close().catch(()=>{});
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({ok:report.ok,root,checks:report.checks.length,error:report.error}));
}
