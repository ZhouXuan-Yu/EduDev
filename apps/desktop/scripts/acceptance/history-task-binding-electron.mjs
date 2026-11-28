import {captureTeacherAction, sizeTeacherJourney} from './teacher-journey-viewport.mjs';
import {confirmTeachingTarget} from './confirm-teaching-target.mjs';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..'), main=testMain(desktop);
const acceptance=process.env.OMNI_EDU_ACCEPTANCE_ROOT;
const frozenScopeModes={
  '--frozen-question':['SCP-07','question_no_task','Run only'],
  '--frozen-ambiguity':['SCP-08','ambiguous_history','Clarification'],
  '--frozen-named':['SCP-09','one_source_permission','No auto model text'],
  '--frozen-lifecycle':['SCP-05','pre_send_cancel','No binding'],
  '--frozen-terminal':['SCP-15','completed_not_applied','No old binding'],
  '--frozen-class-edit':['SCP-17','requirements_rename','Selective recheck'],
  '--frozen-semester':['SCP-20','as_of_history','Historical not current'],
  '--frozen-revocation':['SCP-18','revoked_race','Fail closed'],
};
const pairedScopeModes={
  'SCP-09':['SCP-10','unique_explicit','Conditional auto use'],
  'SCP-05':['SCP-06','pre_send_new_task','New Task bound'],
  'SCP-20':['SCP-25','bitemporal_date','Do not fabricate time'],
};
const frozenScopeIndex=process.argv.findIndex(arg=>Object.hasOwn(frozenScopeModes,arg));
const frozenScopeBytes=frozenScopeIndex>=0?fs.readFileSync(process.argv[frozenScopeIndex+1]):undefined;
const frozenScopeHash=frozenScopeBytes&&createHash('sha256').update(frozenScopeBytes).digest('hex');
const scopeCases=frozenScopeBytes&&JSON.parse(frozenScopeBytes).cases;
const scopeMode=frozenScopeModes[process.argv[frozenScopeIndex]];
const scopeCase=scopeCases&&scopeCases.find(row=>row.id===scopeMode[0]);
const pairedMode=pairedScopeModes[scopeCase?.id];
const pairedScopeCase=pairedMode&&scopeCases.find(row=>row.id===pairedMode[0]);
const frozenQuestion=scopeCase?.id==='SCP-07';
const frozenAmbiguity=scopeCase?.id==='SCP-08';
const frozenNamed=scopeCase?.id==='SCP-09';
const frozenLifecycle=scopeCase?.id==='SCP-05';
const frozenTerminal=scopeCase?.id==='SCP-15';
const frozenClassEdit=scopeCase?.id==='SCP-17';
const frozenSemester=scopeCase?.id==='SCP-20';
const frozenRevocation=scopeCase?.id==='SCP-18';
if(frozenScopeBytes){
  assert.equal(frozenScopeHash,'763f44440314290f393874176f402f5d5c2cf4228e12a01ab630607f298d0be5');
  assert.deepEqual([scopeCase?.id,scopeCase?.kind,scopeCase?.expectedRule],scopeMode);
  if(pairedMode)assert.deepEqual([pairedScopeCase?.id,pairedScopeCase?.kind,pairedScopeCase?.expectedRule],pairedMode);
}
const textbookVersions=Boolean(frozenAmbiguity)||process.argv.includes('--textbook-versions');
const reportedQuote=process.argv.includes('--reported-quote');
const multiRevoke=process.argv.includes('--multi-revoke');
const semesterRules=frozenSemester||process.argv.includes('--semester-rules');
const amendClass=frozenClassEdit||process.argv.includes('--change-class');
const frozenRequestIndex=process.argv.findIndex(arg=>['--frozen-resume','--frozen-exclusion'].includes(arg));
const frozenRequestBytes=frozenRequestIndex>=0?fs.readFileSync(process.argv[frozenRequestIndex+1]):undefined;
const frozenRequestHash=frozenRequestBytes&&createHash('sha256').update(frozenRequestBytes).digest('hex');
const frozenRequestId=process.argv[frozenRequestIndex]==='--frozen-exclusion'?'R3-FX-004':'R3-FX-005';
const frozenRequest=frozenRequestBytes&&JSON.parse(frozenRequestBytes).cases.find(row=>row.id===frozenRequestId);
const frozenResume=frozenRequest?.id==='R3-FX-005'?frozenRequest:undefined;
const frozenExclusion=frozenRequest?.id==='R3-FX-004'?frozenRequest:undefined;
if(frozenRequestBytes){
  assert.equal(frozenRequestHash,'53000255841392a5d3ef6cae264623d89e2326cfab6ac6fb114a19c28b4ade20');
  assert.equal(frozenRequest?.expectedBehavior,frozenExclusion?'exclude_requested':'task_authority');
  if(frozenResume)assert(process.argv.includes('--paused-task'));
}
const teachingScope=frozenRequest?.taskScope??{classRef:'B',termRef:'2026F',subject:'数学',grade:'八年级'};
const exclusion=process.argv.includes('--task-exclusion');
const suspendedTask=process.argv.includes('--paused-task')?'paused':process.argv.includes('--interrupted-task')?'interrupted':null;
const recoveryIndex=process.argv.indexOf('--recover-from');
const terminalTask=(frozenTerminal||process.argv.includes('--completed-task'))?'completed':process.argv.includes('--ended-task')?'ended':null;
const receiptFailure=process.argv.includes('--receipt-failure');
const receiptVerified=process.argv.includes('--receipt-verified');
const keyboardHistory=process.argv.includes('--keyboard-history');
const compactionMemory=process.argv.includes('--compaction-memory');
const unknownHistory=process.argv.includes('--unknown-history');
const checkPreference=process.argv.includes('--preference-and-history');
const vagueChoice=textbookVersions||checkPreference||process.argv.includes('--vague-choice');
const namedHistory=Boolean(frozenNamed)||multiRevoke||receiptFailure||receiptVerified||keyboardHistory||compactionMemory||process.argv.includes('--named-history');
const declaredTitle=frozenExclusion?'上一节课的总结':frozenAmbiguity?'温度计实验讲义':textbookVersions?'温度计实验教材记录':'温度计实验观察档案';
assert(acceptance&&process.env.DEEPSEEK_API_KEY,'Use an isolated acceptance root and a configured DeepSeek account.');
const lane=frozenRevocation?'r3-frozen-revocation-':frozenExclusion?'r3-frozen-exclusion-':frozenResume?'r3-frozen-task-resume-':frozenQuestion?'r3-frozen-question-':frozenAmbiguity?'r3-frozen-ambiguity-':frozenNamed?'r3-frozen-named-':frozenLifecycle?'r3-frozen-lifecycle-':textbookVersions?'history-textbook-versions-':reportedQuote?'history-reported-quote-':multiRevoke?'history-multi-revoke-':semesterRules?'history-semester-rules-':amendClass?'history-amended-class-':recoveryIndex>=0?'history-recovered-':suspendedTask?'history-'+suspendedTask+'-':terminalTask?'history-'+terminalTask+'-':unknownHistory?'history-unknown-answer-':checkPreference?'history-preference-consent-':vagueChoice?'history-vague-choice-':receiptFailure?'history-receipt-failure-':receiptVerified?'history-receipt-verified-'
  :keyboardHistory?'history-keyboard-':compactionMemory?'history-compaction-'
  :namedHistory?'history-named-':exclusion?'history-exclusion-':'history-task-';
const root=fs.mkdtempSync(path.join(acceptance,lane));
const data=path.join(root,'data'),profile=path.join(root,'profile');
const marker='星桥读数法先蓝后绿';
const source=frozenAmbiguity?'请用一句话说明你已收到这条合成记录。正文：'+declaredTitle+'（修订版，本条消息就是完整的授权讲义原文）。一、目标：正确读取水温。二、步骤：放稳温度计，视线与液柱顶端平齐，等液柱稳定再读数。三、复核：同桌各读一次，固定复核口令为'+marker+'。待完成内容：四、课堂练习，以 18℃ 和 22℃ 两个读数设计一道口头练习，课堂练习只在聊天续写，保留前三段。':textbookVersions?'温度计实验教材记录。八年级实验教材修订版，固定复核口令：'+marker+'。':reportedQuote?'同事说：“温度计实验的固定复核口令是'+marker+'。”':semesterRules?'秋季 B 班温度计实验采用新的复核口令：'+marker+'。这里只登记教学学期，未记录规则生效的具体日期。':'这是合成教师教学记录。温度计实验的固定复核口令：'+marker+'。请简短回复收到。';
const search='温度计实验 固定复核口令 星桥读数法';
const alternateMarker='冬砂比对先橙后红';
const alternateSource=frozenAmbiguity?'请用一句话说明你已收到这条合成记录。正文：'+declaredTitle+'（初版，本条消息就是完整的授权讲义原文）。一、目标：记录相同液体的两次水温。二、步骤：将温度计放入液体，读数时不取出，两次记录相隔一分钟。三、复核：先读第一次再读第二次，固定复核口令为'+alternateMarker+'。待完成内容：四、课堂练习，比较 14℃ 和 16℃，只在聊天补写。':textbookVersions?'温度计实验教材记录。八年级实验教材初版，固定复核口令：'+alternateMarker+'。':semesterRules?'春季 B 班温度计实验采用当时的复核口令：'+alternateMarker+'。原文没有具体日期。':'这是另一条合成教师教学记录。温度计实验的固定复核口令：'+alternateMarker+'。请简短回复收到。';
const taskRequest='请整理温度计实验复核要点成三条清单。只在聊天中回复，引用已选的老师原话。';
const question='请简述之前的温度计实验采用什么复核口令？';
const report={root,buildHash:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),checks:[],provider:[],ok:false};
if(frozenRequest||scopeCase){
  report.fixture=frozenRequest?{id:frozenRequest.id,sha256:frozenRequestHash,request:frozenRequest.teacherRequest,scope:teachingScope}
    :{id:scopeCase.id,sha256:frozenScopeHash,scenario:scopeCase.teacherUtterance,...(frozenAmbiguity?{scope:teachingScope}:{})};
  assert.equal(report.buildHash,process.env.OMNI_EDU_R3_EVAL_BUILD_SHA256);
  assert.match(process.env.OMNI_EDU_R3_EVAL_PRODUCT_SHA??'',/^[a-f0-9]{40}$/);
  report.source=process.env.OMNI_EDU_R3_EVAL_PRODUCT_SHA;
  if(pairedScopeCase)report.relatedFixture={id:pairedScopeCase.id,sha256:frozenScopeHash,scenario:pairedScopeCase.teacherUtterance};
}
let app,page;

function read(sql,...args){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(sql).all(...args);}finally{db.close();}
}
async function until(work,timeout=100000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    const value=await work();
    if(value)return value;
    await new Promise(r=>setTimeout(r,160));
  }
  throw Error('History task journey timed out');
}
function pass(name,evidence={}){
  report.checks.push({name,...evidence});
  console.log('PASS '+name);
}
const bindings=id=>read("SELECT value_json FROM app_settings WHERE key GLOB 'xiaozhi.memory-use.task.v1:*' AND json_extract(value_json,'$.sessionId')=?",id)
  .map(row=>JSON.parse(row.value_json));
const composer=()=>page.getByTestId('office-prompt-input');
const session=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
const snapshot=id=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const provider=()=>app.evaluate(()=>globalThis.historyTaskWire);
async function send(id,text,{answer,expectedStatus='completed'}={}){
  const prior=(await snapshot(id)).projection.turns.at(-1)?.id;
  const offset=(await provider()).length;
  await composer().fill(text);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  let submitted;
  const turn=await until(async()=>{
    const state=await snapshot(id),last=state.projection.turns.at(-1);
    if(!state.running&&last?.id&&last.id!==prior&&['completed','failed','interrupted'].includes(last.status))return last;
    const question=state.controls?.find(item=>item.kind==='question'&&item.state==='pending'&&item.runId===last?.id);
    if(question&&answer&&!submitted){
      const card=page.getByTestId('pi-composer-pending-panel').locator(`[data-control-id="${question.id}"]`);
      await card.getByTestId('pi-question-answer').fill(answer);
      await card.getByTestId('pi-question-submit').click();
      submitted=question.id;
    }
  });
  if(submitted){
    const control=(await snapshot(id)).controls?.find(item=>item.id===submitted);
    assert.equal(control?.state,'answered');
    report.teacherAnswer={runId:turn.id,controlId:submitted};
  }
  assert.equal(turn.status,expectedStatus,turn.error);
  const sent=(await provider()).slice(offset);
  assert(sent.length,'A real provider request is required');
  return {runId:turn.id,sent,answerUsed:turn.items.some(item=>item.role==='assistant'&&item.text?.includes(marker))};
}
async function stage(recordId,text,original=source,query=search){
  await composer().fill(text);
  await page.getByTestId('history-lookup-open').click();
  await page.getByTestId('history-lookup-query').fill(query);
  await page.getByTestId('history-lookup-search').click();
  await page.getByTestId('history-candidate-'+recordId).click();
  await page.getByTestId('history-lookup-preview').getByText(original,{exact:true}).waitFor();
  await page.getByTestId('history-lookup-use').click();
  await page.getByTestId('history-intent-pending').waitFor();
  assert.equal(await composer().inputValue(),text);
}
async function revokeThenCompact(target,sourceSession,sourceRecord,initialGrant){
  const material=Array.from({length:120},(_,index)=>
    `合成教研段落 ${index+1}。先观察相同液体的温度变化，再比较不同试管的刻度。课堂演示由教师复核，课后只保留合成练习和脱敏记录。`).join('\n');
  for(let batch=1;batch<=3;batch++){
    await send(target,`请通读第 ${batch} 批合成教学资料。只回复一句已阅读，不要文件或工具。
${material}`);
  }
  const jsonl=()=>path.join(data,'xiaozhi-pi',read(
    'SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',target)[0].session_file);
  const originalFile=jsonl(),oldBytes=fs.readFileSync(originalFile);
  assert(oldBytes.includes(Buffer.from(marker)),'Before revocation the native branch must contain the prior authorized result');
  const countCompactions=file=>fs.readFileSync(file,'utf8').split('\n').filter(line=>line.includes('"type":"compaction"')).length;
  const beforeCount=countCompactions(originalFile);
  const opening=app.waitForEvent('window');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const settings=await opening;
  await settings.getByTestId('pi-settings-tab-teacher-memory').click();
  await settings.getByTestId('history-settings-session').selectOption(sourceSession);
  const entry=settings.getByTestId('history-settings-source-'+sourceRecord);
  await entry.getByRole('button',{name:'暂停参考',exact:true}).click();
  const revoked=await until(()=>read(`SELECT generation,index_allowed,memory_state FROM memory_source_access WHERE record_id=?
    AND index_allowed=0 AND memory_state='disabled'`,sourceRecord)[0]);
  assert(revoked.generation>initialGrant.generation);
  await Promise.all([settings.waitForEvent('close'),settings.getByTestId('settings-window-close').click()]);
  const previous=(await snapshot(target)).projection.turns.at(-1).id;
  const offset=(await provider()).length;
  await composer().fill('/compact');
  await composer().press('Enter');
  const compact=await until(async()=>{
    const state=await snapshot(target),turn=state.projection.turns.at(-1);
    return !state.running&&turn?.id!==previous&&['completed','failed','interrupted'].includes(turn?.status)?turn:null;
  });
  assert.equal(compact.status,'completed',compact.error);
  const calls=(await provider()).slice(offset);
  assert(calls.some(call=>call.status===200),'Actual manual compaction must have run through DeepSeek');
  assert(calls.every(call=>call.sourceRoles.length===0),'Revoked source leaked into a compaction model request');
  assert(fs.readFileSync(originalFile).subarray(0,oldBytes.length).equals(oldBytes));
  assert(countCompactions(jsonl())>(jsonl()===originalFile?beforeCount:0));
  assert(!JSON.stringify(compact.items).includes(marker));
  pass('Revocation fences all actual compaction model requests without changing the old native bytes',
    {runId:compact.id,generation:revoked.generation,priorSha256:createHash('sha256').update(oldBytes).digest('hex')});
  await close();
  await launch();
  if(await session()!==target)await page.getByTestId('workbench-session-'+target).click();
  await until(async()=>await session()===target);
  assert(fs.readFileSync(originalFile).subarray(0,oldBytes.length).equals(oldBytes));
  const resumed=await send(target,'请说明刚才的合成观察记录安排了哪个实验主题，只在聊天中回答。');
  assert(resumed.sent.every(call=>call.sourceRoles.length===0));
  assert.equal(resumed.answerUsed,false);
  assert.deepEqual(read('SELECT generation,index_allowed,memory_state FROM memory_source_access WHERE record_id=?',sourceRecord),[revoked]);
  pass('Post-compaction cold startup and actual model continuation retain the revocation',{runId:resumed.runId});
}

async function revokeSharedSource(first, sourceSession, recordId, initialGrant, namedPrompt) {
  await page.getByTestId('pi-new-session').click();
  const second = await until(async () => {
    const id = await session();
    return id?.startsWith('aisession_') && id !== first ? id : null;
  });
  await composer().fill(namedPrompt);
  await page.getByTestId('history-lookup-open').click();
  await page.getByTestId('history-lookup-query').fill(declaredTitle);
  await page.getByTestId('history-lookup-search').click();
  await page.getByTestId('history-candidate-'+recordId).click();
  await page.getByTestId('history-lookup-use-session').click();
  await page.getByTestId('history-use-selection').waitFor();
  const probe = async id => page.evaluate(async ({id,title,sourceId}) => {
    const result = await window.omniEdu.discoverHistoryMemory(id,title,true);
    if (!result.ok) throw Error(result.error);
    const candidate=result.value.candidates.find(item=>item.sourceId===sourceId);
    return candidate?{ref:candidate.ref,ticket:candidate.ticket}:undefined;
  },{id,title:declaredTitle,sourceId:initialGrant.source_id});
  const tickets=[];
  for(const id of [first,second]) {
    const ticket=await probe(id);
    assert(ticket);
    tickets.push(ticket);
  }
  await app.evaluate(()=>{globalThis.holdHistoryResponse=true;});
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  await until(async()=>(await provider()).some(call=>call.held));
  const grants=[bindings(first)[0],bindings(second)[0]];
  assert(grants.every(item=>item?.selections.some(pin=>pin.id===initialGrant.source_id)));
  assert.notEqual(grants[0].taskId,grants[1].taskId);
  const run=grants[1].admittedBy.runId;
  pass('Two independently authorized Sessions and Tasks depend on one source; the second real response is in flight',{tasks:grants.map(item=>item.taskId),run});
  const opening=app.waitForEvent('window');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const settings=await opening;
  await settings.getByTestId('pi-settings-tab-teacher-memory').click();
  await settings.getByTestId('history-settings-session').selectOption(sourceSession);
  await settings.getByTestId('history-settings-source-'+recordId).getByRole('button',{name:'暂停参考',exact:true}).click();
  const revoked=await until(()=>read("SELECT generation FROM memory_source_access WHERE record_id=? AND index_allowed=0 AND memory_state='disabled'",recordId)[0]);
  assert(revoked.generation>initialGrant.generation);
  async function denied(){
    for(const [i,id] of [first,second].entries()){
      assert.equal(await probe(id),undefined);
      const result=await page.evaluate(({ref,ticket})=>window.omniEdu.previewHistoryMemory(ref,0,true,ticket),tickets[i]);
      assert.equal(result.ok,false);
      assert(['permission_denied','source_changed','command_conflict','source_unavailable'].includes(result.error),JSON.stringify(result));
      assert(!JSON.stringify(result).includes(marker));
    }
  }
  await denied();
  await app.evaluate(()=>globalThis.releaseHistoryResponse());
  await until(async()=>!(await snapshot(second)).running);
  const final=read('SELECT status FROM ai_agent_runs WHERE id=?',run)[0];
  assert(['failed','interrupted','blocked','cancelled'].includes(final?.status),JSON.stringify(final));
  assert(read("SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='assistant' AND json_extract(metadata_json,'$.agentRunId')=?",second,run).every(row=>!row.content.includes(marker)));
  pass('Global pause rejects both previews before releasing the real late response; the affected Run cannot commit the source as a reply',{generation:revoked.generation,run,status:final.status});
  await Promise.all([settings.waitForEvent('close'),settings.getByTestId('settings-window-close').click()]);
  await close();await launch();await denied();
  for(const id of [first,second]){
    if(await session()!==id)await page.getByTestId('workbench-session-'+id).click();
    await until(async()=>await session()===id);
    const next=await send(id,'请用一句话说明摄氏度是什么。仅在聊天中回答。');
    assert(next.sent.every(call=>call.status===200&&!call.sourceRoles.length));
    assert(!next.answerUsed);
    assert.equal(read('SELECT count(*) AS n FROM xiaozhi_memory_reference_deliveries WHERE source_id=? AND run_id=?',initialGrant.source_id,next.runId)[0].n,0);
  }
  pass('Cold startup keeps both previous grants unreadable and both genuine continuation requests free of revoked content');
}

async function launch(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
    OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_MODEL:process.env.DEEPSEEK_MODEL||'deepseek-flash'};
  for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_HISTORY_LOOPBACK','OMNI_EDU_HISTORY_TOKEN'])delete env[k];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
  // Main produces bounded journal failure codes. Keep these with the failing SQLite copy.
  app.process().stderr?.on('data',chunk=>{
    for(const line of String(chunk).split(/\r?\n/u)){
      if(/^\[xiaozhi-(journal|cancel)\] /u.test(line))fs.appendFileSync(path.join(root,'journal-failure.log'),line+'\n');
    }
  });
  await app.evaluate(({net},{marker,alternateMarker,spent})=>{
    const actual=net.fetch.bind(net);
    globalThis.historyTaskWire=[];
    net.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      if(url.origin!=='https://api.deepseek.com'||url.pathname!=='/v1/chat/completions')return actual(input,init);
      if(spent+globalThis.historyTaskWire.length>=12)throw Error('Frozen history task evaluation exceeds 12 provider calls');
      const body=JSON.parse(init.body);
      const hasMarker=content=>JSON.stringify(content??'').includes(marker);
      const record={model:body.model,effort:body.reasoning_effort,maxTokens:body.max_tokens,status:0,toolCount:body.tools?.length??0,
        stepPreference:body.messages.some(message=>message.role==='user'&&JSON.stringify(message.content).includes('当前教师表达偏好')&&JSON.stringify(message.content).includes('分步骤讲解')),
        sourceRoles:body.messages.filter(m=>hasMarker(m.content)).map(m=>m.role),
        attributed:body.messages.some(m=>m.role==='user'&&(typeof m.content==='string'?[m.content]:m.content.map(p=>p.text??'')).some(t=>t.includes('"evidence":"third_party"')&&t.includes('"sourceOccurredAt":null'))),
        alternateRoles:body.messages.filter(m=>JSON.stringify(m.content??'').includes(alternateMarker)).map(m=>m.role)};
      globalThis.historyTaskWire.push(record);
      const started=Date.now();
      if(globalThis.deferHistoryTransport&&record.sourceRoles.includes('user')){
        globalThis.deferHistoryTransport=false;
        record.preDispatchHeld=true;
        await new Promise(resolve=>{globalThis.releaseHistoryTransport=resolve;});
        record.abortedWhenReleased=Boolean(init.signal?.aborted);
      }
      const response=await actual(input,init);
      record.status=response.status;
      if(globalThis.holdHistoryResponse&&response.ok&&record.sourceRoles.includes('user')){
        globalThis.holdHistoryResponse=false;
        record.held=true;
        await new Promise(resolve=>{globalThis.releaseHistoryResponse=resolve;});
      }
      if(globalThis.waitForHistoryPause&&record.sourceRoles.includes('user')){
        globalThis.waitForHistoryPause=false;
        record.delayedForPause=true;
        await new Promise(resolve=>{
          const timeout=setTimeout(resolve,20000);
          init.signal?.addEventListener('abort',()=>{clearTimeout(timeout);resolve();},{once:true});
        });
      }
      void response.clone().text().then(stream=>{
        for(const line of stream.split('\n').filter(x=>x.startsWith('data: {'))){
          const item=JSON.parse(line.slice(6));
          if(item.usage)record.usage=item.usage;
        }
        record.elapsedMs=Date.now()-started;
      }).catch(()=>{});
      if(globalThis.failHistoryTaskAfterAcknowledgement&&response.ok&&record.sourceRoles.includes('user')){
        globalThis.failHistoryTaskAfterAcknowledgement=false;
        record.controlledStreamFailure=true;
        const body=new ReadableStream({start(controller){controller.error(Error('controlled post-acknowledgement stream interruption'));}});
        return new Response(body,{status:response.status,headers:response.headers});
      }
      return response;
    };
  },{marker,alternateMarker,spent:report.provider.length});
  page=await app.firstWindow();
  await sizeTeacherJourney(page);
  await composer().waitFor();
  await assertIsolatedPiMain(app,main,profile);
}
async function close(){
  if(!app)return;
  report.provider.push(...await provider().catch(()=>[]));
  await app.close();
  app=undefined;
}
async function recoverBoundTask(){
  const fixture=fs.realpathSync(process.argv[recoveryIndex+1]);
  assert.equal(path.dirname(fixture),fs.realpathSync(acceptance));
  const prior=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
  assert(prior.ok&&prior.buildHash&&prior.provider.some(call=>call.status===200));
  assert(!fs.existsSync(path.join(fixture,'data','app.db-wal'))||fs.statSync(path.join(fixture,'data','app.db-wal')).size===0);
  fs.cpSync(path.join(fixture,'data'),data,{recursive:true});
  const saved=read("SELECT value_json FROM app_settings WHERE key GLOB 'xiaozhi.memory-use.task.v1:*'")
    .map(row=>JSON.parse(row.value_json)).filter(row=>row.selections.length>0);
  assert.equal(saved.length,1);
  const [binding]=saved;
  const taskView=()=>JSON.parse(read('SELECT value_json FROM app_settings WHERE key=?','xiaozhi.task.v1:'+binding.taskId)[0].value_json).view;
  const original=taskView();
  assert(['paused','interrupted','review_required'].includes(original.state));
  const effects=()=>read('SELECT effect_id,operation FROM xiaozhi_effects_v1 ORDER BY effect_id');
  const before=effects();
  await launch();
  const button=page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-my_tasks');
  await button.click({timeout:10000});
  const row=page.getByTestId('my-tasks-workspace').locator('[data-task-id="'+binding.taskId+'"]');
  await row.waitFor({timeout:10000});
  assert.deepEqual(bindings(binding.sessionId),[binding]);
  assert.equal((await provider()).length,0);
  await row.getByTestId('pi-task-open-session').click({timeout:10000});
  await until(async()=>await session()===binding.sessionId);
  if(original.state==='review_required'){
    await composer().fill('继续核对刚才任务，只把清单的标题改为《课堂复核》。请保留教师原话，直接在聊天中给出修改后的内容。');
  }else{
    const priorTurn=page.locator('[data-turn-id="'+(original.lastRunId||original.origin.runId)+'"]');
    await priorTurn.getByTestId('office-turn-continue').click({timeout:10000});
    assert((await composer().inputValue()).length>0);
  }
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  let answered;
  const teacherAnswer='五年级，请在对话里完成这份清单，不操作文件。';
  const turn=await until(async()=>{
    const st=await snapshot(binding.sessionId),turn=st.projection.turns.at(-1);
    if(!turn||turn.id===(original.lastRunId||original.origin.runId))return;
    const pending=st.controls?.find(item=>item.runId===turn.id&&item.kind==='question'&&item.state==='pending');
    if(pending&&!answered){
      const card=page.getByTestId('pi-composer-pending-panel').locator('[data-control-id="'+pending.id+'"]');
      await card.getByTestId('pi-question-answer').fill(teacherAnswer);
      await card.getByTestId('pi-question-submit').click();answered=pending.id;
    }
    return !st.running&&['completed','failed','interrupted'].includes(turn.status)?turn:null;
  });
  assert.equal(turn.status,'completed',turn.error);
  assert.equal((await snapshot(binding.sessionId)).task?.id,binding.taskId);
  assert.deepEqual(bindings(binding.sessionId),[binding]);
  const expectedEffects=[...before];
  if(answered){
    const [control]=read("SELECT payload_json FROM xiaozhi_pi_controls WHERE id=? AND conversation_id=? AND run_id=? AND kind='question' AND state='answered'",answered,binding.sessionId,turn.id);
    const answer=JSON.parse(control.payload_json);assert.equal(answer.answer,teacherAnswer);
    const explicit=read(`SELECT e.effect_id,e.operation FROM xiaozhi_effects_v1 e JOIN xiaozhi_tool_receipts r
      ON r.run_id=e.run_id AND r.call_id=e.call_id WHERE e.run_id=? AND e.session_id=? AND e.task_id=? AND e.call_id=?
      AND r.tool='ask_teacher' AND r.admitted=1 AND r.success=1 AND r.native_state='matched'`,turn.id,binding.sessionId,binding.taskId,answer.callId);
    assert(explicit.length<=1);
    expectedEffects.push(...explicit);
  }
  expectedEffects.sort((a,b)=>a.effect_id.localeCompare(b.effect_id));
  assert.deepEqual(effects(),expectedEffects);
  const sent=await provider();
  assert(sent.some(call=>call.status===200&&call.sourceRoles.includes('user')));
  assert.notEqual(taskView().state,'completed');
  pass('Teacher resumes the exact bound Task from My Tasks after a cold launch without executing an old effect or approving its result',{
    previousState:original.state,taskId:binding.taskId,runId:turn.id,teacherAnswered:answered,priorEffectCount:before.length});
}
async function runDefinitionJourney(){
  await launch();
  const id=await until(async()=>{const selected=await session();return selected?.startsWith('aisession_')?selected:null;});
  const readTaskPointers=()=>read('SELECT value_json FROM app_settings WHERE key=?','xiaozhi.task.v1:session:'+id);
  const readHistoryBindings=()=>bindings(id);
  assert.deepEqual(readTaskPointers(),[]);
  const prompt='请用一句话解释什么是磁力，只在聊天中回答。';
  const answer=await send(id,prompt);
  const state=await snapshot(id);
  const turn=state.projection.turns.find(item=>item.id===answer.runId);
  report.definition={prompt,runId:answer.runId,taskId:state.task?.id??null,provider:answer.sent};
  assert(!state.task&&!state.running);
  assert.deepEqual(readTaskPointers(),[]);
  assert.deepEqual(readHistoryBindings(),[]);
  assert(answer.sent.some(call=>call.status===200));
  assert(answer.sent.every(call=>call.toolCount===0));
  assert(turn?.items.some(item=>item.role==='assistant'&&item.text?.includes('磁')));
  await close();await launch();
  assert(!(await snapshot(id)).task);
  assert.deepEqual(readTaskPointers(),[]);
  assert.deepEqual(readHistoryBindings(),[]);
  pass('The exact classroom definition question completes a real tool-free Run without creating or restoring a Task');
}

async function runHistoryJourney(){
  await launch();
  const sourceSession=await until(async()=>{const id=await session();return id?.startsWith('aisession_')?id:null;});
  if(keyboardHistory){
    const saved='这是按键打开查找时保留的合成草稿。';
    await composer().fill(saved);
    const open=page.getByTestId('history-lookup-open');
    await open.press('Enter');
    const query=page.getByTestId('history-lookup-query');
    await query.waitFor();
    assert.equal(await query.evaluate(el=>document.activeElement===el),true,'The search input must receive keyboard focus when opened');
    await query.press('Escape');
    await page.getByTestId('history-lookup').waitFor({state:'hidden'});
    await until(()=>open.evaluate(el=>document.activeElement===el));
    assert.equal(await composer().inputValue(),saved);
    pass('Keyboard opening and cancellation restore lookup focus and preserve the draft');
  }
  const renameSource=async (id,title=declaredTitle)=>{
    await page.getByTestId('workbench-manage-history').click();
    const manage=page.getByTestId('workbench-history-dialog');
    await manage.getByTestId('ai-conversation-session-'+id).click({button:'right'});
    await page.getByTestId('ai-conversation-context-rename').click();
    const name=manage.getByTestId('ai-conversation-rename-session-'+id);
    await name.fill(title);
    await name.press('Enter');
    await until(()=>read('SELECT title FROM ai_conversation_sessions WHERE id=?',id)[0]?.title===title);
    await manage.getByRole('button',{name:'关闭',exact:true}).click();
  };
  if(namedHistory||textbookVersions||frozenExclusion)await renameSource(sourceSession);
  if(frozenRequest||amendClass||semesterRules||textbookVersions||frozenLifecycle)await confirmTeachingTarget(until,app,page,sourceSession,teachingScope);
  if(checkPreference||amendClass){
    await send(sourceSession,'请记住，以后讲解都分步骤。请简短确认。');
    const saved=await page.evaluate(()=>window.omniEdu.getTeacherMemorySettings());
    assert(saved.ok&&saved.value.preference.values.structure==='step_by_step');
    report.preferenceRevision=saved.value.preference.revision;
  }
  await send(sourceSession,source,{answer:'请简短确认这条温度计实验合成记录。这是记录，不需要把句子当成长期偏好。'});
  const row=read("SELECT id FROM ai_conversation_messages WHERE session_id=? AND role='user' AND content=?",sourceSession,source)[0];
  assert(row?.id);
  let alternative;
  if(vagueChoice||semesterRules||frozenLifecycle||frozenExclusion){
    await page.getByTestId('pi-new-session').click();
    const id=await until(async()=>{const id=await session();return id?.startsWith('aisession_')&&id!==sourceSession?id:null;});
    if(textbookVersions){
      await renameSource(id);
      await confirmTeachingTarget(until,app,page,id,teachingScope);
    }
    if(semesterRules)await confirmTeachingTarget(until,app,page,id,{...teachingScope,termRef:'2026S'});
    if(frozenLifecycle||frozenExclusion)await confirmTeachingTarget(until,app,page,id,teachingScope);
    if(frozenExclusion)await renameSource(id,'本周实验复核清单');
    await send(id,alternateSource,{answer:'这是合成记录，请简单确认收到。'});
    const candidate=read("SELECT id FROM ai_conversation_messages WHERE session_id=? AND role='user' AND content=?",id,alternateSource)[0];
    assert(candidate?.id);
    alternative={sessionId:id,recordId:candidate.id};
  }
  await page.getByTestId('pi-new-session').click();
  const target=await until(async()=>{const id=await session();return id?.startsWith('aisession_')&&id!==sourceSession&&id!==alternative?.sessionId?id:null;});
  if(frozenRequest||amendClass||semesterRules||textbookVersions||frozenLifecycle)await confirmTeachingTarget(until,app,page,target,teachingScope);
  const opening=app.waitForEvent('window');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const settings=await opening;
  await settings.getByTestId('pi-settings-tab-teacher-memory').click();
  await settings.getByTestId('history-settings-session').selectOption(sourceSession);
  const entry=settings.getByTestId('history-settings-source-'+row.id);
  await entry.getByRole('button',{name:'查看来源'}).click();
  if(reportedQuote)await entry.getByTestId('history-settings-preview').getByText(/教师转述的第三方引文/u).waitFor();
  await entry.getByTestId('history-settings-allow').click();
  await settings.getByTestId('history-settings-notice').getByText(/已允许查找/).waitFor();
  const allowed=read('SELECT source_id,generation FROM memory_source_access WHERE record_id=?',row.id)[0];
  assert(allowed.source_id);
  if(alternative){
    await settings.getByTestId('history-settings-session').selectOption(alternative.sessionId);
    const other=settings.getByTestId('history-settings-source-'+alternative.recordId);
    await other.getByRole('button',{name:'查看来源'}).click();
    await other.getByTestId('history-settings-allow').click();
    await until(()=>read('SELECT source_id FROM memory_source_access WHERE record_id=? AND discover_allowed=1',alternative.recordId)[0]);
  }
  await Promise.all([settings.waitForEvent('close'),settings.getByTestId('settings-window-close').click()]);

  if(frozenRevocation){
    const req='请整理课堂温度计复核三条规则。只用这次选择的原文，在聊天中回复。';
    await stage(row.id,req);
    const prior=(await provider()).length;
    await app.evaluate(()=>{globalThis.deferHistoryTransport=true;});
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    await until(async()=>(await provider()).slice(prior).some(call=>call.preDispatchHeld));
    const before=read('SELECT id FROM ai_agent_runs WHERE session_id=? ORDER BY rowid DESC LIMIT 1',target)[0];
    assert(before?.id);
    const change=app.waitForEvent('window');
    let control;
    let revoked;
    try{
      await page.getByRole('button',{name:'设置',exact:true}).click();
      control=await change;
      await control.getByTestId('pi-settings-tab-teacher-memory').click();
      await control.getByTestId('history-settings-session').selectOption(sourceSession);
      await control.getByTestId('history-settings-source-'+row.id).getByRole('button',{name:'暂停参考',exact:true}).click();
      revoked=await until(()=>read("SELECT generation,memory_state,index_allowed FROM memory_source_access WHERE source_id=? AND memory_state='disabled' AND index_allowed=0",allowed.source_id)[0]);
      assert(revoked.generation>allowed.generation);
      await app.evaluate(()=>globalThis.releaseHistoryTransport?.());
      await control.getByTestId('history-settings-source-'+row.id).getByText(/^已暂停(?: · 索引.*)?$/u).waitFor();
    }finally{
      await app.evaluate(()=>globalThis.releaseHistoryTransport?.());
    }
    await until(async()=>{
      const state=await snapshot(target);
      return !state.running&&state.projection.turns.some(turn=>turn.id===before.id&&['completed','failed','interrupted'].includes(turn.status));
    });
    const wire=(await provider()).slice(prior);
    const dbRun=read('SELECT status FROM ai_agent_runs WHERE id=?',before.id)[0];
    report.revocation={sourceId:allowed.source_id,runId:before.id,dbRun,revoked,provider:wire};
    assert(wire.some(call=>call.preDispatchHeld&&call.abortedWhenReleased));
    assert(wire.every(call=>!call.sourceRoles.length||call.status===0),'A request carrying revoked source data must never reach HTTP acknowledgement');
    assert(['blocked','failed','interrupted','cancelled'].includes(dbRun.status));
    const receipts=read('SELECT source_id FROM xiaozhi_memory_reference_deliveries WHERE run_id=?',before.id);
    assert.deepEqual(receipts,[]);
    assert(read("SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='assistant'",target).every(item=>!item.content.includes(marker)));
    if(control)await Promise.all([control.waitForEvent('close'),control.getByTestId('settings-window-close').click()]);
    await close();await launch();
    if(await session()!==target)await page.getByTestId('workbench-session-'+target).filter({visible:true}).first().click();
    await until(async()=>await session()===target);
    const next=await send(target,'什么是温度计？只在聊天中回答。');
    assert(next.sent.some(call=>call.status===200));
    assert(next.sent.every(call=>!call.sourceRoles.length));
    assert.deepEqual(read('SELECT generation,memory_state,index_allowed FROM memory_source_access WHERE source_id=?',allowed.source_id),[revoked]);
    pass('Teacher revocation aborts a prepared request before transport acknowledgement and restart never reuses the source',{runId:before.id,laterRunId:next.runId});
    return;
  }
  if(frozenExclusion){
    const request=frozenExclusion.teacherRequest;
    const before=(await snapshot(target)).memoryScope;
    const counts=()=>read('SELECT count(*) AS n FROM ai_agent_runs WHERE session_id=?',target)[0].n;
    assert.equal(counts(),0);
    const denied=allowed.source_id;
    const kept=read('SELECT source_id FROM memory_source_access WHERE record_id=?',alternative.recordId)[0].source_id;
    assert.notEqual(denied,kept);
    await stage(row.id,request);
    await stage(alternative.recordId,request,alternateSource,'温度计实验 复核口令 冬砂比对');
    await page.getByRole('button',{name:'移除待发送历史 2'}).waitFor();
    assert.deepEqual(bindings(target),[]);
    assert.deepEqual((await snapshot(target)).memoryScope,before);
    const offset=(await provider()).length;
    const observed=await send(target,request);
    const receipts=read('SELECT source_id,reason FROM xiaozhi_memory_reference_deliveries WHERE run_id=?',observed.runId);
    report.exclusion={request,denied,kept,runId:observed.runId,provider:observed.sent,receipts,offset};
    assert(observed.sent.some(call=>call.status===200));
    assert(observed.sent.every(call=>!call.sourceRoles.length),'The temporarily excluded source must not enter a provider request');
    assert(observed.sent.some(call=>call.status===200&&call.alternateRoles.includes('user')),'The other teacher-selected source remains valid');
    assert.deepEqual(receipts.map(item=>item.source_id),[kept]);
    assert(bindings(target).every(binding=>binding.selections.every(item=>item.id!==denied)));
    assert.deepEqual((await snapshot(target)).memoryScope,before);
    assert.deepEqual(read('SELECT memory_state,index_allowed FROM memory_source_access WHERE source_id=?',denied).map(r=>[r.memory_state,r.index_allowed]),[['active',1]]);
    pass('The exact teacher exclusion removes only the temporarily declined source; the other approved source is still delivered');
    return;
  }
  if(frozenLifecycle){
    const scopeBefore=(await snapshot(target)).memoryScope;
    assert(scopeBefore.teachingTarget?.folderId);
    await stage(row.id,taskRequest);
    const oldRun=await send(target,taskRequest);
    const oldTask=(await snapshot(target)).task;
    const [oldBinding]=bindings(target);
    assert(oldTask&&oldBinding&&oldTask.id===oldBinding.taskId&&oldBinding.admittedBy.runId===oldRun.runId);
    assert(oldRun.sent.some(call=>call.status===200&&call.sourceRoles.includes('user')));
    const record=read('SELECT source_id,generation FROM memory_source_access WHERE record_id=?',alternative.recordId)[0];
    assert(record?.source_id&&record.source_id!==allowed.source_id);
    const checkpoint=()=>read('SELECT id FROM ai_agent_runs WHERE session_id=? ORDER BY rowid',target);
    const entry=checkpoint(), calls=(await provider()).length;
    const draft='给八年级 B 班新建一份温度计课堂讲义。先拟一个草稿。';
    const alternateSearch='温度计实验 复核口令 冬砂比对';
    await stage(alternative.recordId,draft,alternateSource,alternateSearch);
    await page.getByRole('button',{name:'移除待发送历史 1'}).click();
    await page.getByTestId('history-intent-pending').waitFor({state:'hidden'});
    assert.equal(await composer().inputValue(),draft);
    assert.deepEqual(checkpoint(),entry);
    assert.equal((await provider()).length,calls);
    assert.deepEqual(bindings(target),[oldBinding]);
    assert.deepEqual((await snapshot(target)).memoryScope,scopeBefore);
    assert.equal((await snapshot(target)).task.id,oldTask.id);
    pass('Cancelling a staged reference to a different source persists no Run, Task binding or Session grant',{oldTask:oldTask.id});
    const edited='请为八年级 B 班新写一份温度计课堂讲义，标题为《读数与复核》，写三条观察规则，并引用本次老师选择的原文。只用聊天展示，不创建文件。';
    await stage(alternative.recordId,edited,alternateSource,alternateSearch);
    assert.deepEqual(bindings(target),[oldBinding]);
    assert.deepEqual(checkpoint(),entry);
    const admitted=await send(target,edited);
    const actual=(await snapshot(target)).task;
    assert(actual?.id&&actual.id!==oldTask.id);
    const grants=bindings(target);
    const own=grants.find(binding=>binding.taskId===actual.id);
    assert.deepEqual(grants.find(binding=>binding.taskId===oldTask.id),oldBinding);
    assert.equal(own?.admittedBy.runId,admitted.runId);
    assert.deepEqual(own?.selections.map(item=>[item.id,item.version]),[[record.source_id,record.generation]]);
    assert(admitted.sent.some(call=>call.status===200&&call.alternateRoles.includes('user')));
    assert(admitted.sent.every(call=>!call.sourceRoles.length));
    assert.deepEqual((await snapshot(target)).memoryScope,scopeBefore);
    const receipts=read('SELECT reason,source_id FROM xiaozhi_memory_reference_deliveries WHERE run_id=?',admitted.runId);
    assert.deepEqual(receipts.map(item=>[item.reason,item.source_id]),[['task',record.source_id]]);
    report.lifecycle={oldTask:oldTask.id,oldReference:allowed.source_id,newTask:actual.id,newSource:record.source_id,cancelledDraft:draft,submittedDraft:edited,runId:admitted.runId,provider:admitted.sent};
    pass('Only the newly admitted B-class Task owns the edited draft source and the real provider never receives the old source');
    return;
  }
  if(reportedQuote){
    const ask='这条温度计实验记录中的口令原文是什么，谁说的？能确定这是我自己的长期偏好以及具体启用日吗？仅依据本次预览的记录，在聊天中回答。';
    const settingsView=()=>page.evaluate(()=>window.omniEdu.getTeacherMemorySettings());
    const before=await settingsView();assert(before.ok);
    await composer().fill(ask);
    await page.getByTestId('history-lookup-open').click();
    await page.getByTestId('history-lookup-query').fill(search);
    await page.getByTestId('history-lookup-search').click();
    await page.getByTestId('history-candidate-'+row.id).click();
    const preview=page.getByTestId('history-lookup-preview');
    await preview.getByText(source,{exact:true}).waitFor();
    await preview.getByText(/教师转述的第三方引文/u).waitFor();
    await page.getByTestId('history-lookup-use').click();
    const result=await send(target,ask);
    const text=read("SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='assistant' AND json_extract(metadata_json,'$.agentRunId')=?",target,result.runId).map(row=>row.content).join('');
    assert(result.sent.some(call=>call.status===200&&call.attributed&&call.sourceRoles.includes('user')));
    assert(result.answerUsed&&/同事|第三方/u.test(text)&&/不能|无法|没有|未/u.test(text));
    assert.equal((await settingsView()).value.preference.revision,before.value.preference.revision);
    pass('Both teacher previews identify the attributed quote; real Pi receives its source kind and unknown event time, and no teacher preference is adopted',{runId:result.runId,reply:text});
    return;
  }
  if(semesterRules){
    const currentPrompt='当前是秋季，请根据本次选择的 B 班温度计实验记录，原样给出目前正在使用的完整复核口令。'
      +(frozenSemester?'只回复口令，省略会话记录时间及其他说明。':'');
    const oldPrompt=frozenSemester
      ?'回顾 B 班春季的温度计实验。完整复核口令是什么？根据这次已选原文，能否确定口令生效的具体时点？只答这两点，不引用会话记录时间。'
      :'回顾 B 班春季的温度计实验，与当前秋季区分。当时使用的完整复核口令是什么？能否从原话确定具体启用日期？请只回答启用时间是否可确认，省略系统记录日期。';
    for(const [prompt,ref,original,historical] of [[currentPrompt,row.id,source,false],[oldPrompt,alternative.recordId,alternateSource,true]]){
      await composer().fill(prompt);
      await page.getByTestId('history-lookup-open').click();
      if(historical)await page.getByRole('checkbox',{name:'查找本班上学期的资料（仅本次比较）'}).check();
      await page.getByTestId('history-lookup-search').click();
      await page.getByTestId('history-candidate-'+ref).click();
      await page.getByTestId('history-lookup-preview').getByText(original,{exact:true}).waitFor();
      await page.getByTestId('history-lookup-use').click();
      await page.getByTestId('history-intent-pending').waitFor();
      const observed=await send(target,prompt);
      const turn=(await snapshot(target)).projection.turns.find(item=>item.id===observed.runId);
      const reply=turn.items.filter(item=>item.role==='assistant').map(item=>item.text).join('\n');
      if(frozenSemester)(report.comparison??=[]).push({historical,runId:observed.runId,reply,provider:observed.sent});
      assert(observed.sent.some(call=>call.status===200&&(historical?call.alternateRoles:call.sourceRoles).includes('user')));
      if(!historical)assert(observed.sent.every(call=>!call.alternateRoles.length));
      assert(reply.includes(historical?alternateMarker:marker),reply);
      assert(!/\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}/u.test(reply),reply);
      if(historical)assert(/无法|不能|没有|未记|不详|未提供|不确定/u.test(reply),reply);
      if(frozenSemester)assert(!/\d{1,2}\s*月\s*\d{1,2}\s*[日号]|\d{1,2}\s*[点时](?:\d{1,2}\s*分)?|\b\d{1,2}:\d{2}\b/u.test(reply),reply);
      pass(historical?'Earlier spring rule is expressly previewed; actual response preserves the unknown effective date':'Current fall rule is read from the current class, with no spring text sent',{runId:observed.runId,reply});
    }
    assert(!(await snapshot(target)).memoryScope.selections.length);
    if(frozenSemester){
      const current=await send(target,'请为八年级 B 班秋季温度计实验整理三条通用课堂提示，只在聊天中回复。');
      assert(current.sent.some(call=>call.status===200));
      assert(current.sent.every(call=>!call.alternateRoles.length));
      assert(!(await snapshot(target)).memoryScope.selections.length);
      pass('A later normal fall request does not receive the source approved only for the spring comparison',{runId:current.runId});
    }
    return;
  }
  if(unknownHistory){
    const before=(await snapshot(target)).memoryScope;
    assert.deepEqual(before.selections,[]);
    const answer=await send(target,'以前我有没有告诉过你我第一次上公开课的具体日期？请只根据已经获准使用的原话核对；缺少依据就说无法确认。');
    const text=(await snapshot(target)).projection.turns.find(turn=>turn.id===answer.runId).items
      .filter(item=>item.role==='assistant'&&item.status!=='inProgress').map(item=>item.text).join('\n');
    assert.match(text,/无法确认|不能确认|无法核实|没有.{0,15}(?:记录|依据|原话|日期|证据)|未.{0,8}(?:找到|提供|记录|提[及过])/u);
    assert(!/(?:19|20)\d{2}[-年/.]\s*\d{1,2}|\d{1,2}月\d{1,2}[日号]/u.test(text));
    assert(answer.sent.every(call=>!call.sourceRoles.length&&!call.alternateRoles.length));
    assert.deepEqual((await snapshot(target)).memoryScope,before);
    assert.equal(bindings(target).length,0);
    pass('A discoverable but unrelated source with no usage grant cannot supply a claimed past date',{runId:answer.runId,reply:text});
  }else if(vagueChoice){
    const vague=frozenAmbiguity?frozenAmbiguity.teacherUtterance.split('；',1)[0]:textbookVersions?'照上次那份教材继续。请在聊天中引用我确认的八年级温度计实验教材记录，给出固定复核口令。':checkPreference?'照上次那份继续。请解释为什么记录温度计读数时要复核，保留这份记录中完整的复核口令，只在聊天中答复。'
      :'照上次那份继续。请在聊天里给出温度计实验记录里的复核口令。';
    const requests=(await provider()).length;
    await composer().fill(vague);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    const pending=page.getByTestId('pi-composer-pending-panel').getByTestId('history-lookup');
    const query=pending.getByTestId('history-lookup-query');
    await query.waitFor();
    await until(()=>query.evaluate(element=>document.activeElement===element));
    assert.equal(await pending.count(),1);
    assert.equal(await composer().inputValue(),vague);
    assert.equal((await provider()).length,requests);
    assert.equal(read('SELECT COUNT(*) n FROM ai_agent_runs WHERE session_id=?',target)[0].n,0);
    await query.fill('温度计实验 固定复核口令');
    await pending.getByTestId('history-lookup-search').click();
    await pending.getByTestId('history-candidate-'+row.id).waitFor();
    await pending.getByTestId('history-candidate-'+alternative.recordId).waitFor();
    pass('One local confirmation focuses the query and preserves the original draft with two legitimate candidates');
    if(textbookVersions){
      assert.equal(read('SELECT title FROM ai_conversation_sessions WHERE id=?',sourceSession)[0].title,declaredTitle);
      assert.equal(read('SELECT title FROM ai_conversation_sessions WHERE id=?',alternative.sessionId)[0].title,declaredTitle);
      await pending.getByTestId('history-candidate-'+alternative.recordId).click();
      await pending.getByTestId('history-lookup-preview').getByText(alternateSource,{exact:true}).waitFor();
      assert.equal((await provider()).length,requests);
      assert.deepEqual((await snapshot(target)).memoryScope.selections,[]);
      pass('Two identically titled textbook sources have distinct edition text; previewing the first edition alone grants no use');
    }
    await pending.getByTestId('history-candidate-'+row.id).click();
    await pending.getByTestId('history-lookup-preview').getByText(source,{exact:true}).waitFor();
    await pending.getByTestId('history-lookup-use').click();
    await page.getByTestId('history-intent-pending').waitFor();
    assert.equal(await composer().inputValue(),vague);
    await until(()=>composer().evaluate(element=>document.activeElement===element));
    assert.equal((await provider()).length,requests);
    const accepted=await send(target,vague,frozenAmbiguity?{}:{answer:'继续温度计实验，使用我刚确认的课程记录，仅在聊天回复复核口令。'});
    assert(accepted.sent.some(item=>item.status===200&&item.sourceRoles.includes('user')));
    assert(accepted.sent.every(item=>!item.alternateRoles.length));
    if(frozenAmbiguity){
      const saved=read("SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='user' ORDER BY rowid",target);
      assert.deepEqual(saved.map(row=>row.content),[vague]);
      assert.equal(await page.getByTestId('pi-composer-pending-panel').getByTestId('pi-question-answer').count(),0);
      report.ambiguity={initialRequest:vague,sameTitle:declaredTitle,candidates:[allowed.source_id,alternative.recordId],approvedSource:allowed.source_id};
    }else assert(accepted.answerUsed);
    if(checkPreference){
      assert(accepted.sent.some(call=>call.status===200&&call.stepPreference&&call.sourceRoles.includes('user')));
      const settings=await page.evaluate(()=>window.omniEdu.getTeacherMemorySettings());
      assert(settings.ok&&settings.value.preference.revision===report.preferenceRevision);
      pass('The same real request carries the confirmed explanation preference and only the approved original',
        {revision:report.preferenceRevision,runId:accepted.runId});
    }
    assert.equal(await page.getByTestId('history-lookup').count(),0);
    const [binding]=bindings(target);
    if(binding)assert.deepEqual(binding.selections.map(item=>item.id),[allowed.source_id]);
    assert.deepEqual((await snapshot(target)).memoryScope.selections,[]);
    pass('Only the explicitly previewed history reaches the real model, with no additional confirmation or Session grant',
      {runId:accepted.runId,taskId:binding?.taskId??null,sourceId:allowed.source_id});
  }else if(suspendedTask){
    const request=frozenResume
      ?'请整理八年级 B 班温度计读数的复核要点，保留老师的复核口令。请先提问，确认要练习整数刻度还是半度刻度；等我回答，只用聊天回复。'
      :'请整理温度计实验复核要点，保留老师的复核口令。请先用提问工具请我确定用于三年级还是五年级，再根据我选择的年级写三条。等我回答，只用聊天回复。';
    await stage(row.id,request);
    if(suspendedTask==='paused')await app.evaluate(()=>{globalThis.waitForHistoryPause=true;});
    await composer().fill(request);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    const pending=page.getByTestId('pi-composer-pending-panel').getByTestId('pi-question-answer');
    if(suspendedTask==='paused')await until(async()=>(await provider()).some(call=>call.delayedForPause));
    else await pending.waitFor({timeout:90000});
    const active=await snapshot(target),[binding]=bindings(target);
    assert.equal(active.task.id,binding.taskId);
    assert.equal(binding.selections[0].id,allowed.source_id);
    if(suspendedTask==='paused'){
      await page.getByTestId('pi-task-pause').click();
    }else await page.getByRole('button',{name:'停止本轮',exact:true}).click();
    await until(async()=>{const st=await snapshot(target);return !st.running&&st.task?.state===suspendedTask;});
    assert.deepEqual(bindings(target),[binding]);
    pass('Teacher interruption or pause preserves the Task binding at the controlled boundary',{state:suspendedTask,taskId:binding.taskId});
    await close();await launch();
    if(await session()!==target)await page.getByTestId('workbench-session-'+target).filter({visible:true}).first().click();
    await until(async()=>await session()===target);
    const cold=await snapshot(target);
    assert.equal(cold.task.state,suspendedTask);assert(!cold.running);
    assert.deepEqual(bindings(target),[binding]);assert.equal((await provider()).length,0);
    await page.getByTestId('history-task-selection').waitFor();
    await page.getByTestId('pi-new-session').click();
    const separate=await until(async()=>{const id=await session();return id&&id!==target?id:null;});
    const unrelated=await send(separate,'请用一句话解释什么是磁力，只在聊天中回答。');
    assert(unrelated.sent.every(call=>!call.sourceRoles.length));
    await page.getByTestId('workbench-session-'+target).filter({visible:true}).first().click();
    await until(async()=>await session()===target);
    const original=await snapshot(target);
    assert.equal(original.task.state,suspendedTask);assert.equal(original.task.id,binding.taskId);
    const review=page.getByTestId('pi-task-review');
    await review.getByTestId('pi-task-review-toggle').click();
    await until(()=>review.getByTestId('pi-task-review-refresh').isEnabled());
    assert(await review.getByTestId('pi-task-review-accept').isDisabled());
    pass('Cold recovery waits for the teacher; another session gets no source and cannot complete the stopped task',{state:original.task.state,unrelatedRunId:unrelated.runId});
    if(frozenResume){
      const fileCount=()=>read('SELECT count(*) AS n FROM document_artifacts WHERE session_id=?',target)[0].n;
      const grants=()=>read('SELECT version,payload_json FROM xiaozhi_pi_memory_scopes WHERE conversation_id=?',target);
      const beforeFiles=fileCount(),beforeGrants=grants();
      const resumed=await send(target,frozenResume.teacherRequest,{answer:'练习半度刻度，按原要求只在聊天给三条。'});
      const after=await snapshot(target);
      const [message]=read("SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='user' ORDER BY rowid DESC LIMIT 1",target);
      assert.equal(message.content,frozenResume.teacherRequest);
      const latest=read('SELECT value_json FROM app_settings WHERE key=?','xiaozhi.task.v1:session:'+target)[0];
      report.frozenResume={stateBefore:original.task.state,taskBefore:original.task.id,taskAfter:after.task?.id,
        originalRequirementsVersion:original.task.requirementsVersion,requirementsVersion:after.task?.requirementsVersion,
        sqliteTask:JSON.parse(latest.value_json).taskId,runId:resumed.runId,provider:resumed.sent};
      assert.equal(after.task?.id,original.task.id,'The explicit continuation must resume the paused Task');
      assert.equal(report.frozenResume.sqliteTask,original.task.id,'SQLite must retain the original Task pointer');
      assert.equal(after.task.requirementsVersion,original.task.requirementsVersion);
      assert.deepEqual(bindings(target),[binding]);
      assert.deepEqual(grants(),beforeGrants);
      assert.equal(fileCount(),beforeFiles);
      assert(resumed.sent.some(call=>call.status===200&&call.sourceRoles.includes('user')));
      pass('The original teacher words resume the same Task and use its valid source after restart');
      await page.getByTestId('pi-new-session').click();
      const empty=await until(async()=>{
        const id=await session();
        return id?.startsWith('aisession_')&&![target,separate,sourceSession].includes(id)?id:null;
      });
      const counts=()=>({
        runs:read('SELECT count(*) AS n FROM ai_agent_runs WHERE session_id=?',empty)[0].n,
        pointers:read('SELECT count(*) AS n FROM app_settings WHERE key=?','xiaozhi.task.v1:session:'+empty)[0].n,
      });
      assert(!(await snapshot(empty)).task,'The new control session has no current Task');
      assert.deepEqual(counts(),{runs:0,pointers:0});
      const providerCount=(await provider()).length;
      const rejected=await page.evaluate(input=>window.omniEdu.startXiaozhi(input),{
        sessionId:empty,commandId:'xicmd_'+randomUUID(),prompt:frozenResume.teacherRequest,
      });
      assert.deepEqual(rejected,{ok:false,error:'task_context_changed'});
      assert.deepEqual(counts(),{runs:0,pointers:0});
      assert.equal((await provider()).length,providerCount);
      pass('An explicit continuation without a current Task opens no new Run or Task',{sessionId:empty,rejected});
    }
  }else if(terminalTask){
    await stage(row.id,taskRequest);
    const first=await send(target,taskRequest);
    const [binding]=bindings(target);
    assert.equal(binding.admittedBy.runId,first.runId);
    assert(first.sent.some(call=>call.status===200&&call.sourceRoles.includes('user')));
    const review=page.getByTestId('pi-task-review');
    await review.getByTestId('pi-task-review-toggle').click();
    await until(()=>review.getByTestId('pi-task-review-refresh').isEnabled());
    assert.equal((await snapshot(target)).task.state,'review_required');
    if(terminalTask==='completed'){
      const checks=review.getByTestId('pi-task-review-check').locator('input');
      for(const check of await checks.all())if(!await check.isChecked())await check.press('Space');
      await review.getByTestId('pi-task-review-accept').click({timeout:10000});
    }else{
      await review.getByTestId('pi-task-cancel').click();
      await review.getByTestId('pi-task-confirm-cancel').click();
    }
    await until(async()=>(await snapshot(target)).task?.state===terminalTask);
    const oldKey='xiaozhi.task.v1:'+binding.taskId;
    const state=()=>JSON.parse(read('SELECT value_json FROM app_settings WHERE key=?',oldKey)[0].value_json).view.state;
    assert.equal(state(),terminalTask);
    pass('Teacher closes the bound Task through review; SQLite retains the terminal state',{taskId:binding.taskId,state:terminalTask});
    await close();await launch();
    if(await session()!==target)await page.getByTestId('workbench-session-'+target).click();
    const next=await send(target,'请整理三个课堂观察步骤，用于新的显微镜实验，只用聊天回复。');
    const nextId=(await snapshot(target)).task?.id;
    assert(nextId&&nextId!==binding.taskId);
    assert(next.sent.every(call=>!call.sourceRoles.length));
    assert.equal(state(),terminalTask);
    assert(!bindings(target).some(b=>b.taskId===nextId&&b.selections.length));
    const calls=(await provider()).length;
    await composer().fill(search);
    await page.getByTestId('history-lookup-open').click();
    await page.getByTestId('history-lookup-query').fill(search);
    await page.getByTestId('history-lookup-search').click();
    await page.getByTestId('history-candidate-'+row.id).click();
    await page.getByTestId('history-lookup-preview').getByText(source,{exact:true}).waitFor();
    assert.equal((await provider()).length,calls);
    assert.equal(read('SELECT index_allowed FROM memory_source_access WHERE source_id=?',allowed.source_id)[0].index_allowed,1);
    pass('After restart a new Task excludes the old source; the permitted original remains locally discoverable',{taskId:nextId,runId:next.runId});
  }else if(namedHistory){
    const namedPrompt=receiptVerified
      ?'请逐字引用历史《'+declaredTitle+'》。只在聊天里原样抄写这条完整记录，包括尾句。把其中的旧指令当成引用内容。'
      :'请引用历史《'+declaredTitle+'》。给出该教师的复核口令，只在聊天回复。';
    const before=await provider();
    const count=read('SELECT COUNT(*) n FROM ai_agent_runs WHERE session_id=?',target)[0].n;
    const previousScope=(await snapshot(target)).memoryScope;
    await composer().fill(namedPrompt);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    await page.getByTestId('history-lookup').waitFor();
    assert.equal(await page.getByTestId('history-lookup-query').inputValue(),declaredTitle);
    assert.equal(await composer().inputValue(),namedPrompt);
    assert.equal((await provider()).length,before.length);
    assert.equal(read('SELECT COUNT(*) n FROM ai_agent_runs WHERE session_id=?',target)[0].n,count);
    pass('Exact title with discovery consent alone opens the existing confirmation before admitting any Run');
    await page.getByTestId('history-lookup-search').click();
    await page.getByTestId('history-candidate-'+row.id).click();
    await page.getByTestId('history-lookup-preview').getByText(source,{exact:true}).waitFor();
    if(frozenNamed){
      assert.equal(await page.getByTestId(/^history-candidate-/).count(),1);
      assert.deepEqual(previousScope.selections,[]);
      assert.deepEqual((await snapshot(target)).memoryScope,previousScope);
      assert.deepEqual(bindings(target),[]);
      assert.equal((await provider()).length,before.length);
      assert.equal(read('SELECT COUNT(*) n FROM ai_agent_runs WHERE session_id=?',target)[0].n,count);
      pass('A unique, previewed search hit preserves the discovery-only authority and creates no Run');
    }
    await captureTeacherAction(page,page.getByTestId('history-lookup-use-session'),root,'before-history-consent',report);
    await page.getByTestId('history-lookup-use-session').click();
    await page.getByTestId('history-use-selection').waitFor();
    if(receiptFailure)await app.evaluate(()=>{globalThis.failHistoryTaskAfterAcknowledgement=true;});
    const task=await send(target,namedPrompt,{expectedStatus:receiptFailure?'failed':'completed'});
    const [binding]=bindings(target);
    assert.equal(binding.admittedBy.runId,task.runId);
    assert.equal(binding.permissionBasis.kind,'session_reference');
    assert(task.sent.some(call=>call.status===200&&call.sourceRoles.includes('user')));
    assert.equal(await page.getByTestId('history-lookup').count(),0);
    pass('One exact, currently authorized Session source binds directly to a real Task',{answerUsed:task.answerUsed});
    const reads=read("SELECT value_json FROM app_settings WHERE key GLOB ?",
      'xiaozhi.memory.reference-readback.v1:'+task.runId+':*').map(row=>JSON.parse(row.value_json));
    assert.deepEqual(reads.map(item=>[item.id,item.reason]),[[binding.selections[0].id,'task']]);
    assert.deepEqual(Object.keys(reads[0]).sort(),['estimatedTokens','fingerprint','id','reason','scopeVersion','version']);
    const historyPanel=page.getByTestId('history-task-selection');
    if(receiptVerified){
      const results=read("SELECT content FROM ai_conversation_messages WHERE session_id=? AND role='assistant' AND json_extract(metadata_json,'$.agentRunId')=?",target,task.runId);
      assert.equal(results.length,1);
      assert(results[0].content.includes(source),'The committed reply must independently contain the exact complete authorized source');
      await historyPanel.getByText(/已核对回复中的原文/).waitFor();
      pass('Persisted reply independently verifies the explicit complete verbatim-source requirement',{runId:task.runId});
    }else{
      await historyPanel.getByText(/已提供给模型，仍待核验成果/).waitFor();
      pass('The real desktop distinguishes source readback and acknowledged delivery from verified use',{runId:task.runId});
    }
    if(receiptFailure){
      const request=task.sent.find(call=>call.controlledStreamFailure);
      assert.equal(request?.status,200,'The provider must acknowledge the actual request before the controlled fault');
      assert.equal(read('SELECT status FROM ai_agent_runs WHERE id=?',task.runId)[0].status,'failed');
      await page.getByTestId('history-task-run-failed').waitFor();
      pass('A failed Run retains its specific provider delivery while exposing the durable failure state',{runId:task.runId});
    }
    if(frozenNamed){
      report.namedAuthority={query:namedPrompt,selected:binding.selections[0].id,runId:task.runId,
        bindingVersion:binding.requirementsVersion,basis:binding.permissionBasis.kind,provider:task.sent};
      return;
    }
    if(multiRevoke){
      await revokeSharedSource(target,sourceSession,row.id,allowed,namedPrompt);
    }else if(compactionMemory){
      assert.equal(task.answerUsed,true,'The first full Task must actually use the authorized source before testing revocation');
      await revokeThenCompact(target,sourceSession,row.id,allowed);
    }else{
      const calls=(await provider()).length;
      const vague='照上次那份继续。';
      await composer().fill(vague);
      await page.getByRole('button',{name:'发送消息',exact:true}).click();
      await page.getByTestId('history-lookup').waitFor();
      assert.equal(await composer().inputValue(),vague);
      const query=page.getByTestId('history-lookup-query');
      if(keyboardHistory)await until(()=>query.evaluate(el=>document.activeElement===el));
      await query.fill(declaredTitle);
      if(keyboardHistory)await query.press('Enter');
      else await page.getByTestId('history-lookup-search').click();
      await page.getByTestId('history-candidate-'+row.id).waitFor();
      assert.equal((await provider()).length,calls);
      assert.deepEqual(bindings(target),[binding]);
      pass('Vague history opens one local confirmation with the preserved draft and no prompt delivery');
      if(keyboardHistory){
        const searchInput=page.getByTestId('history-lookup-query');
        await searchInput.press('Escape');
        await page.getByTestId('history-lookup').waitFor({state:'hidden'});
        await until(()=>composer().evaluate(el=>document.activeElement===el));
        const sessionSelections=(await snapshot(target)).memoryScope.selections;
        assert(sessionSelections.some(item=>item.layer==='history'&&item.id===binding.selections[0].id));
        await page.getByTestId('history-task-selection').getByRole('button',{name:/停止引用/}).press('Enter');
        await page.getByTestId('history-task-selection').waitFor({state:'hidden'});
        const remaining=(await snapshot(target)).memoryScope.selections;
        assert.deepEqual(remaining,sessionSelections);
        assert.equal(await composer().inputValue(),vague);
        await page.getByTestId('pi-new-session').click();
        const next=await until(async()=>{const id=await session();return id?.startsWith('aisession_')&&id!==target?id:null;});
        await until(async()=>!(await snapshot(next)).taskHistory);
        assert.equal(await page.getByTestId('history-lookup').count(),0);
        assert.equal((await provider()).length,calls);
        pass('Keyboard stops Task use while preserving Session use, drafts and conversation isolation');
      }
    }
  }else if(exclusion){
    await composer().fill(taskRequest);
    await page.getByTestId('history-lookup-open').click();
    await page.getByTestId('history-lookup-query').fill(search);
    await page.getByTestId('history-lookup-search').click();
    await page.getByTestId('history-candidate-'+row.id).click();
    await page.getByTestId('history-lookup-preview').getByText(source,{exact:true}).waitFor();
    await page.getByTestId('history-lookup-use-session').click();
    await page.getByTestId('history-use-selection').waitFor();
    const sessionScope=(await snapshot(target)).memoryScope;
    assert.equal(sessionScope.selections[0].id,allowed.source_id);
    const excluded=await send(target,'本任务不用历史。请制作一份温度计实验检查表标题，标题为《实验检查表》。仅在聊天中给出标题。');
    assert(excluded.sent.every(call=>!call.sourceRoles.length));
    const [binding]=bindings(target);
    assert.equal(binding.excludeSessionHistory,true);
    assert.equal(binding.admittedBy.runId,excluded.runId);
    await page.getByTestId('history-task-selection').getByText(/当前任务已停用会话历史/).waitFor();
    pass('Teacher exclusion applies to the admitted Task with a live Session selection');
    await close();
    await launch();
    if(await session()!==target)await page.getByTestId('workbench-session-'+target).click();
    await until(async()=>await session()===target);
    await page.getByTestId('history-task-selection').getByText(/当前任务已停用会话历史/).waitFor();
    const follow=await send(target,'只改刚才标题的末尾标点为句号，其他照旧。标题已指定为《实验检查表》，只在聊天里给出标题。',{
      answer:'标题为《实验检查表》，只修改标题末尾标点为句号。'
    });
    assert(follow.sent.every(call=>!call.sourceRoles.length));
    assert.equal((await snapshot(target)).task.id,binding.taskId);
    assert.deepEqual((await snapshot(target)).memoryScope,sessionScope);
    pass('Cold restart and a same-Task amendment still exclude the Session source');
    const another=await send(target,'请读取本会话已选的教学记忆，找到温度计实验的复核口令。先调用 read_education_memory，再用原话回答。');
    assert(another.sent.some(call=>call.status===200&&call.sourceRoles.includes('tool')));
    assert.notEqual((await snapshot(target)).task.id,binding.taskId);
    assert.deepEqual((await snapshot(target)).memoryScope,sessionScope);
    pass('A separate new Task can still use the original explicit Session source');
  }else{
    const earlier=await send(target,'请整理三个课堂观察步骤，只用聊天回复。');
    assert(earlier.sent.every(r=>!r.sourceRoles.length));
    const initial=(await snapshot(target)).memoryScope;
    const checkpoint=(await provider()).length;
    await stage(row.id,taskRequest);
    assert.equal((await provider()).length,checkpoint);
    assert.deepEqual((await snapshot(target)).memoryScope,initial);
    assert.equal(bindings(target).length,0);
    await page.screenshot({path:path.join(root,'draft-reference.png')});
    pass('Staging with a previous task writes neither a Task binding nor a Session grant');
    const task=await send(target,taskRequest);
    const [binding]=bindings(target);
    assert.equal(bindings(target).length,1);
    assert.equal(binding.admittedBy.runId,task.runId);
    assert.notEqual(binding.admittedBy.runId,earlier.runId);
    assert.equal(binding.selections[0].id,allowed.source_id);
    assert.equal(binding.selections[0].version,allowed.generation);
    assert(task.sent.some(r=>r.status===200&&r.sourceRoles.includes('user')));
    const taskReceipt=read("SELECT reason,source_id,scope_version FROM xiaozhi_memory_reference_deliveries WHERE run_id=?",task.runId);
    assert.deepEqual(taskReceipt.map(row=>[row.reason,row.source_id,row.scope_version]),[['task',allowed.source_id,initial.version]]);
    assert.deepEqual((await snapshot(target)).memoryScope,initial);
    pass('A new actual Task owns the binding and the source reached DeepSeek', {taskId:binding.taskId,runId:task.runId,sourceId:allowed.source_id,answerUsed:task.answerUsed});
    await page.getByTestId('history-task-selection').waitFor();
    const initialRequirements=(await snapshot(target)).task.requirementsVersion;
    const titleAmendment=amendClass?'只改刚才讲解清单的标题为《实验复核》，讲解内容和适用班级照旧，请在聊天里展示改名后的讲解。':'只改刚才清单的标题为《实验复核》，其他内容照旧。核对教师已授权的历史。';
    const followup=await send(target,titleAmendment);
    assert(followup.sent.some(r=>r.status===200&&r.sourceRoles.includes('user')));
    assert.equal((await snapshot(target)).task.id,binding.taskId);
    assert.equal(bindings(target).length,1);
    pass('A requirements amendment preserves the existing Task source',{runId:followup.runId,taskId:binding.taskId});
    if(amendClass){
      const editedTask=(await snapshot(target)).task;
      assert(followup.sent.some(call=>call.stepPreference));
      assert(editedTask.requirementsVersion>initialRequirements);
      const changed=await confirmTeachingTarget(until,app,page,target,{...teachingScope,classRef:'A'});
      assert.notEqual(changed.folder,initial.teachingTarget.folderId);
      const next=await send(target,'只修改刚才讲解清单的受众，改为给 A 班使用。请在聊天中讲解温度计的读数方法，给出新版清单。');
      assert(next.sent.some(call=>call.status===200&&call.stepPreference));
      assert(next.sent.every(call=>!call.sourceRoles.length));
      const nextTask=(await snapshot(target)).task;
      assert.equal(nextTask.id,binding.taskId);
      assert.deepEqual(read('SELECT source_id FROM xiaozhi_memory_reference_deliveries WHERE run_id=?',next.runId),[]);
      pass('Changing only the title preserves B history and general structure; moving the same Task to A excludes all B source bytes and keeps the general structure',{
        originalTask:editedTask.id,originalRequirements:initialRequirements,titleRequirements:editedTask.requirementsVersion,
        changedTask:nextTask.id,changedRequirements:nextTask.requirementsVersion,originalClass:initial.teachingTarget,changedClass:changed.folder,
        titleRun:followup.runId,classRun:next.runId,
      });
      return;
    }
    const nextAmendment=await send(target,'继续修改刚才清单，只把第一个要点改为一句简短的提醒，保留老师的原话和其余要点。请直接在对话中给出修改后的清单。');
    assert(nextAmendment.sent.some(call=>call.status===200 && call.sourceRoles.includes('user')));
    assert.equal((await snapshot(target)).task.id,binding.taskId);
    assert.deepEqual(bindings(target),[binding]);
    pass('Two consecutive amendments use the same granted source and Task without asking for another reference',
      {taskId:binding.taskId,runIds:[followup.runId,nextAmendment.runId]});
    await stage(row.id,question);
    await page.getByRole('button',{name:'移除待发送历史 1'}).click();
    await page.getByTestId('history-intent-pending').waitFor({state:'hidden'});
    assert.equal(await composer().inputValue(),question);
    assert.equal(bindings(target).length,1);
    pass('Removing pending history preserves the draft and existing binding');
    await stage(row.id,question);
    const turn=await send(target,question);
    assert(turn.sent.some(r=>r.status===200&&r.sourceRoles.includes('user')));
    assert.deepEqual(read('SELECT reason,source_id FROM xiaozhi_memory_reference_deliveries WHERE run_id=?',turn.runId)
      .map(row=>[row.reason,row.source_id]),[['turn',allowed.source_id]]);
    assert.deepEqual(bindings(target),[binding]);
    pass('Ordinary question receives the Turn reference with no durable grant',{runId:turn.runId,answerUsed:turn.answerUsed});
    const next=await send(target,'请简述物态变化中的凝固是什么？');
    assert(next.sent.every(r=>!r.sourceRoles.length));
    assert.deepEqual(bindings(target),[binding]);
    assert.deepEqual((await snapshot(target)).memoryScope,initial);
    pass('Following unrelated question sends no former Task or Turn source',{runId:next.runId});
    const journal=read('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',target)[0]?.session_file;
    assert(journal);
    const native=path.join(data,'xiaozhi-pi',journal),prefix=fs.readFileSync(native);
    await close();
    await launch();
    if(await session()!==target)await page.getByTestId('workbench-session-'+target).click();
    await until(async()=>await session()===target);
    const taskPanel=page.getByTestId('history-task-selection');
    await taskPanel.waitFor();
    assert.deepEqual(bindings(target),[binding]);
    assert.equal((await snapshot(target)).task.id,binding.taskId);
    assert(fs.readFileSync(native).subarray(0,prefix.length).equals(prefix));
    pass('Cold Electron restart restores the Task and preserves the prior Pi JSONL bytes',{prefixHash:createHash('sha256').update(prefix).digest('hex')});
    await composer().fill('请保留这句未发送草稿。');
    await taskPanel.getByRole('button',{name:/停止引用/}).click();
    await taskPanel.waitFor({state:'hidden'});
    assert.equal(await composer().inputValue(),'请保留这句未发送草稿。');
    const [removed]=bindings(target);
    assert.equal(removed.revision,binding.revision+1);
    assert.deepEqual(removed.selections,[]);
    assert.deepEqual((await snapshot(target)).memoryScope,initial);
    assert.equal(read('SELECT index_allowed FROM memory_source_access WHERE source_id=?',allowed.source_id)[0].index_allowed,1);
    const after=await send(target,'只改刚才标题的标点，其他不变。请基于当前任务说明。',{
      answer:'标题是《实验复核》。把标题末尾标点改为全角句号，其他内容不变。只在聊天中给出新标题。'
    });
    assert(after.sent.every(r=>!r.sourceRoles.length));
    pass('Teacher removes one Task reference, preserving the draft, Session scope and discovery permission',{runId:after.runId});
  }
}
try{
  if(recoveryIndex>=0)await recoverBoundTask();
  else if(frozenQuestion)await runDefinitionJourney();
  else await runHistoryJourney();
  report.ok=true;
}catch(error){
  report.failure=String(error?.stack??error);
  const startup=path.join(profile,'xiaozhi-database-startup.json');
  if(fs.existsSync(startup))report.databaseStartup=JSON.parse(fs.readFileSync(startup,'utf8'));
  if(page)await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});
  throw error;
}finally{
  await close().catch(()=>{});
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(root);
}
