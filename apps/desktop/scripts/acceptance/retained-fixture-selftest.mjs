/** In-memory transport/AST tests. No app launch, network or application DB writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {fingerprint} from './evidence.mjs';
import {installRetainedFixtureProvider,retainedProviderControl} from './retained-fixture-provider.mjs';
import {fixtureCases,proposalFor,projectionFor,planContract,fixturePlanSteps} from './retained-fixture-input.mjs';
import {fixtureBudget,ownedExact,readFixtureManifest,fixtureContracts,retainRows,assertPendingDecision} from './retained-fixture-evidence.mjs';

export async function retainedFixtureSelfTest(desktop) {
  const checks=[];
  const test=async(name,fn)=>{await fn();checks.push(name);};
  const compiled=await build({stdin:{contents:
    "export {createTaskPlanRuntime} from './src/main/xiaozhi-agent/tasks/plan-runtime.ts';\n"+
    "export {createTaskState} from './src/main/xiaozhi-agent/tasks/task-state.ts';\n"+
    "export {createTaskResources} from './src/main/xiaozhi-agent/tasks/resources.ts';\n"+
    "export {createTeacherRequestTool,teacherRequestSources} from './src/main/xiaozhi-agent/request-sources.ts';\n"+
    "export {taskStepState} from './src/shared/xiaozhi-task.ts';",
    resolveDir:desktop,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const production=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
  const databases=[];
  const observedRoot=path.join(desktop,'test-results/ui-final-content-20261111/retained-qa/run-RwLhR6');
  const observed=[];
  const nativeRoot=path.join(observedRoot,'baseline/data/xiaozhi-pi');
  for(const session of fs.readdirSync(nativeRoot).filter(name=>name.startsWith('aisession_'))) {
    const folder=path.join(nativeRoot,session,'sessions');
    for(const file of fs.readdirSync(folder).filter(name=>name.endsWith('.jsonl'))) {
      for(const line of fs.readFileSync(path.join(folder,file),'utf8').split('\n').filter(Boolean)) {
        const message=JSON.parse(line).message;
        if(message?.role==='system'||message?.role==='user')observed.push(message);
      }
    }
  }
  const observedUser=observed.find(message=>message.role==='user');
  const userText=message=>typeof message.content==='string'?message.content:message.content.map(part=>part.text||'').join('\n');
  const nativeText=userText(observedUser),taskMarker='{"schemaVersion":"xiaozhi.task-plan.v3","taskId":';
  const nativeTaskLine=nativeText.split('\n').find(line=>line.startsWith(taskMarker));
  const nativeTask=JSON.parse(nativeTaskLine);
  const nativeTeacherLine=nativeText.split('\n').find(line=>line.startsWith('教师要求：'));
  const nativeTeacher=JSON.parse(nativeTeacherLine.slice('教师要求：'.length));
  const withUser=text=>observed.map(message=>message===observedUser?{...message,content:[{type:'text',text}]}:message);
  function lab(cold=false) {
    let registered,nativeCalls=0;
    const web={onBeforeRequest(fn){registered=fn;}};
    const electron={app:{on(){}},session:{defaultSession:{webRequest:web}},
      net:{async fetch(){nativeCalls++;throw Error('NATIVE_FETCH_REACHED');}},
      BrowserWindow:{getAllWindows:()=>[{webContents:{id:7}}]}};
    const context=vm.createContext({process,URL,Request,Response,Headers,Buffer,Date});
    const options={model:'pure-test-model',deadlineAt:Date.now()+15000,cold,
      planParameters:planContract.TASK_PLAN_PARAMETERS,planSteps:fixturePlanSteps};
    vm.runInContext('('+installRetainedFixtureProvider.toString()+')(electron,options)',Object.assign(context,{electron,options}));
    // Mimic the production frame policy registration. No browser exists here.
    web.onBeforeRequest((details,callback)=>callback({cancel:details.resourceType==='subFrame'}));
    const control=input=>vm.runInContext('('+retainedProviderControl.toString()+')(electron,input)',Object.assign(context,{input}));
    const tools=['office_list_materials','office_read_material','find_education_tools','read_teacher_request','read_session_process','update_task_plan'];
    let messages=[],owner,runtime,task,requestTool,systemOverride,payloadOverride;
    const db=new DatabaseSync(':memory:');databases.push(db);
    db.exec(`CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);
      CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,archived_at TEXT);
      CREATE TABLE ai_conversation_messages(id TEXT PRIMARY KEY,session_id TEXT,role TEXT,content TEXT,metadata_json TEXT);
      CREATE TABLE xiaozhi_pi_commands(command_id TEXT PRIMARY KEY,conversation_id TEXT,run_id TEXT,status TEXT);
      CREATE TABLE xiaozhi_event_runs(run_id TEXT,generation INTEGER,status TEXT);
      CREATE TABLE xiaozhi_event_owners(session_id TEXT PRIMARY KEY,run_id TEXT,generation INTEGER);`);
    let lane=Promise.resolve();
    const sql={all:async(query,values=[])=>db.prepare(query).all(...values),run:async(query,values=[])=>db.prepare(query).run(...values),
      change:async(query,values=[])=>Number(db.prepare(query).run(...values).changes),transaction:fn=>{
        const next=lane.then(async()=>{db.exec('BEGIN');try{const value=await fn(sql);db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}});
        lane=next.catch(()=>{});return next;
      }};
    const actor=production.createTaskState(sql,{sanitize:async value=>value}),sessionId='aisession_'+randomUUID(),teacherMessages=[];
    db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,NULL)').run(sessionId);
    const sources=()=>production.teacherRequestSources(teacherMessages,[],[],task);
    const request=async()=>{
      const host=runtime?await runtime.context():'';
      const current=sources().at(-1);
      const protectedText='[小智本会话本地记录，非新增授权]\n'+
        (current?'教师要求：'+JSON.stringify({...current,taskSource:true}):'')+host;
      const user=systemOverride??protectedText+'\n\n[本次讲解的对象与表达]\n本地合成算术核对。\n\n[教师本次请求]\n'+(current?.text||'');
      const sdkMessages=[{role:'system',content:'',sections:{preamble:'Pure SDK shape fixture',skills:'',cwd:'owned'}},
        {role:'user',content:[{type:'text',text:user}]},...messages];
      const response=await electron.net.fetch('https://api.deepseek.com/v1/chat/completions',{
        method:'POST',signal:new AbortController().signal,body:JSON.stringify({model:options.model,stream:true,
          messages:payloadOverride??sdkMessages,tools:tools.map(name=>({type:'function',function:{name,
            ...(name==='update_task_plan'?{parameters:planContract.TASK_PLAN_PARAMETERS}:{})}}))})});
      const packets=(await response.text()).split('\n').filter(line=>line.startsWith('data: {')).map(line=>JSON.parse(line.slice(6)));
      return packets[0].choices[0].delta.tool_calls||[];
    };
    const reply=async(calls,mutatePlan=value=>value)=>{
      for(const call of calls) {
        const args=JSON.parse(call.function.arguments);let value={success:true};
        if(call.function.name==='office_list_materials')value={success:true,materials:[{resourceId:'resource_test',title:'teacher.pdf',bodyAvailable:true}]};
        if(call.function.name==='office_read_material')value={success:true,offset:args.offset,totalChunks:3,truncated:false,source:{version:'a'.repeat(64)}};
        if(call.function.name==='read_teacher_request')value=JSON.parse((await requestTool.execute(call.id,args,new AbortController().signal)).content[0].text);
        if(call.function.name==='read_session_process')value={trace:null};
        if(call.function.name==='update_task_plan')value=JSON.parse((await runtime.tools[0].execute(call.id,mutatePlan(args))).content[0].text);
        if(call.function.name==='education_propose_original_question'){
          // Actual admission only. This pure lab never executes a domain save.
          await runtime.admit(call.id,call.function.name,args);value={success:true,state:'confirmed'};
        }
        messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(value)+'\n[synthetic self-test host note]'});
      }
      if(calls.some(c=>c.function.name==='find_education_tools'))tools.push('education_propose_original_question');
    };
    const arm=async items=>{
      if(task){const latest=await actor.latest(sessionId);if(latest.state==='active')await actor.settle(owner,latest.id,latest.revision,false);}
      const runId='run_'+randomUUID(),commandId='command_'+randomUUID(),messageId='message_'+randomUUID(),generation=teacherMessages.length+1;
      owner={sessionId,runId,generation};
      db.prepare('INSERT INTO xiaozhi_event_runs VALUES(?,?,?)').run(runId,generation,'running');
      db.prepare('INSERT OR REPLACE INTO xiaozhi_event_owners VALUES(?,?,?)').run(sessionId,runId,generation);
      db.prepare('INSERT INTO xiaozhi_pi_commands VALUES(?,?,?,?)').run(commandId,sessionId,runId,'running');
      const content='新任务：'+items.map(item=>item.title).join('、')+'。只通过实际原图和教师审核建立候选。';
      const metadata={piVersion:'xiaozhi.pi.education.v1',agentRunId:runId};
      teacherMessages.push({id:messageId,role:'user',content,metadata});
      db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?)').run(messageId,sessionId,'user',content,JSON.stringify(metadata));
      task=await actor.create(owner,messageId,commandId);
      runtime=production.createTaskPlanRuntime({sql,taskId:task.id,publisher:{owner,checkpointTask:action=>sql.transaction(action)},
        current:()=>true,sanitize:async value=>value,proofs:async()=>[],
        resources:production.createTaskResources({sessionId,workspace:async()=>{throw Error('WORKSPACE_UNUSED');},studentId:async()=>'',attachment:async()=>false})});
      requestTool=production.createTeacherRequestTool({load:async()=>sources(),excluded:()=>[],sanitize:async value=>value,current:()=>true});
      control({arm:{resourceId:'resource_test',version:'a'.repeat(64),fileName:'teacher.pdf',chunks:3,proposals:items.map(item=>proposalFor(item,'resource_test'))}});
    };
    return {electron,context,control,request,reply,arm,tools,actor,sql,get runtime(){return runtime;},get owner(){return owner;},
      get task(){return task;},get messages(){return messages;},set messages(value){messages=value;},
      set payload(value){payloadOverride=value;},
      set system(value){systemOverride=value;},get nativeCalls(){return nativeCalls;},get registered(){return registered;}};
  }
  try {
  await test('nine bounded SSE responses use production plan runtime and actual envelope admission',async()=>{
    const l=lab();l.control({verify:true});await l.arm(fixtureCases.slice(0,2));
    let calls=await l.request();assert.deepEqual(calls.map(c=>c.function.name),['office_list_materials','find_education_tools','read_teacher_request','read_session_process','update_task_plan']);await l.reply(calls);
    calls=await l.request();assert.equal(calls.length,3);await l.reply(calls);
    calls=await l.request();assert.equal(JSON.parse(calls[0].function.arguments).page,1);assert.equal(JSON.parse(calls[0].function.arguments).taskStepId,'single_save');await l.reply(calls);
    calls=await l.request();assert.equal(calls[0].function.name,'update_task_plan');await l.reply(calls);
    calls=await l.request();assert.equal(JSON.parse(calls[0].function.arguments).regions.length,2);assert.equal(JSON.parse(calls[0].function.arguments).taskStepId,'multi_save');await l.reply(calls);
    assert.equal((await l.request()).length,0);
    let firstTask=await l.actor.latest(l.owner.sessionId);
    await l.actor.settle(l.owner,firstTask.id,firstTask.revision,false);firstTask=await l.actor.latest(l.owner.sessionId);
    const firstRows=await l.sql.all('SELECT * FROM app_settings WHERE key=?',['xiaozhi.task.v1:'+firstTask.id]);
    await l.arm([fixtureCases[2]]);calls=await l.request();await l.reply(calls);
    calls=await l.request();await l.reply(calls);calls=await l.request();
    assert.equal(calls[0].function.name,'education_propose_original_question');
    assert.equal(JSON.parse(calls[0].function.arguments).taskStepId,'pending_crop');
    assert.notEqual(l.task.id,firstTask.id);
    // The previous task is immutable historical work after its own settlement.
    const old=JSON.parse((await l.sql.all('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.task.v1:'+firstTask.id]))[0].value_json);
    assert.equal(old.view.state,'review_required');assert.deepEqual(old.view.steps,firstTask.steps);
    assert.deepEqual(await l.sql.all('SELECT * FROM app_settings WHERE key=?',['xiaozhi.task.v1:'+firstTask.id]),firstRows);
    assert.deepEqual(Array.from(l.control({}).plans,p=>p.phase),['initial','advance','pending']);
    assert.equal(l.control({}).teacherRequests.length,2);assert.equal(l.control({}).sourceReads.length,6);
    assert.equal(l.control({}).responses,9);assert.equal(l.nativeCalls,0);
    await assert.rejects(l.request,/RETAINED_RESPONSE_BUDGET/);
  });
  await test('pending decision matches the formal SQLite default and rejects approval facts',()=>{
    const source=fs.readFileSync(path.join(desktop,'src/main/db.ts'),'utf8');
    const ddl=source.match(/CREATE TABLE IF NOT EXISTS ai_confirmation_items \([\s\S]*?\);/)[0];
    const db=new DatabaseSync(':memory:');
    try {
      db.exec(ddl);
      db.prepare(`INSERT INTO ai_confirmation_items(id,action_type,status,title,created_at,updated_at)
        VALUES(?,?,?,?,?,?)`).run('qa_pending','pi_original_question_multi_candidate','pending','QA','QA','QA');
      const row=db.prepare('SELECT * FROM ai_confirmation_items').get();
      assertPendingDecision(row);
      for(const result_json of [null,'','{"complete":true}','{"saved":{"questionId":"qa"}}'])
        assert.throws(()=>assertPendingDecision({...row,result_json}));
      assert.throws(()=>assertPendingDecision({...row,status:'confirmed'}));
      assert.throws(()=>assertPendingDecision({...row,confirmed_at:'QA'}));
    } finally {db.close();}
  });
  await test('all authored drafts satisfy actual production approval schema',()=>{
    for(const item of fixtureCases) {
      const {resourceId,page,box,regions,transcription,...fields}=proposalFor(item,'resource_test');
      const draft={...fields,answer:'',analysis:'',answerOrigin:'missing',analysisOrigin:'missing',sourceChecked:false,
        projection:projectionFor(item)};
      assert(fixtureContracts.validMultiDraft(draft));
      assert(!fixtureContracts.validMultiDraft({...draft,projection:{...draft.projection,figures:{state:'missing',text:item.figures}}}));
    }
  });
  await test('production schema permits exactly one in-progress step per plan revision',()=>{
    for(const steps of Object.values(fixturePlanSteps))assert(planContract.validTaskPlanInput({schemaVersion:'xiaozhi.task-plan.v3',expectedRevision:7,requirementsVersion:3,reason:'读取宿主实际版本后修订',steps}));
    const steps=fixturePlanSteps.initial.map(step=>step.kind==='saved_questions'?{...step,reported:'in_progress'}:step);
    assert(!planContract.validTaskPlanInput({schemaVersion:'xiaozhi.task-plan.v3',expectedRevision:0,requirementsVersion:1,reason:'拒绝双执行状态',steps}));
  });
  await test('actual production admission rejects proposal before any adopted plan',async()=>{
    const l=lab();await l.arm(fixtureCases.slice(0,2));
    const before=await l.sql.all('SELECT * FROM app_settings ORDER BY key');
    await assert.rejects(()=>l.runtime.admit('no_plan','education_propose_original_question',proposalFor(fixtureCases[0],'resource_test')),/task_plan_required/);
    assert.deepEqual(await l.sql.all('SELECT * FROM app_settings ORDER BY key'),before);
  });
  await test('actual plan runtime rejects stale expectedRevision and changed requirementsVersion',async()=>{
    for(const [field,reason]of [['expectedRevision','task_plan_conflict'],['requirementsVersion','task_requirements_changed']]) {
      const l=lab();await l.arm(fixtureCases.slice(0,2));const calls=await l.request();
      await l.reply(calls,input=>({...input,[field]:input[field]+1}));
      const result=l.messages.find(m=>m.tool_call_id===calls.find(c=>c.function.name==='update_task_plan').id);
      assert.equal(JSON.parse(result.content.split('\n')[0]).reason,reason);
      await assert.rejects(l.request,new RegExp('RETAINED_REAL_TOOL_FAILED_'+reason));
      assert.equal(l.control({}).admissionsRequested.length,0);
    }
  });
  await test('host task context and authoritative versions are required with no defaults',async()=>{
    const l=lab();await l.arm(fixtureCases.slice(0,2));l.system='No current host task context';
    await assert.rejects(l.request,/RETAINED_REAL_HOST_TASK_REQUIRED/);
    assert.equal(l.control({}).admissionsRequested.length,0);
  });
  await test('actual SDK user-role protected prefix and structured system sections locate real owner versions',async()=>{
    const l=lab();await l.arm(fixtureCases.slice(0,2));l.payload=observed;
    const calls=await l.request(),plan=calls.find(call=>call.function.name==='update_task_plan');
    const input=JSON.parse(plan.function.arguments);
    assert.equal(input.expectedRevision,nativeTask.revision);assert.equal(input.requirementsVersion,nativeTask.requirementsVersion);
    const teacher=JSON.parse(calls.find(call=>call.function.name==='read_teacher_request').function.arguments);
    assert.equal(teacher.sourceId,nativeTeacher.sourceId);assert.equal(teacher.sourceVersion,nativeTeacher.sourceVersion);
    const system=observed.find(message=>message.role==='system');
    assert.equal(system.content,'');assert.deepEqual(Object.keys(system.sections),['preamble','skills','cwd']);
    assert.equal(l.control({}).admissionsRequested.length,0);
  });
  await test('duplicate protected task or teacher records reject before any tool request',async()=>{
    for(const line of [nativeTaskLine,nativeTeacherLine]) {
      const l=lab();await l.arm(fixtureCases.slice(0,2));l.payload=withUser(nativeText.replace(line,line+'\n'+line));
      await assert.rejects(l.request,/RETAINED_PROTECTED_CONTEXT_AMBIGUOUS/);assert.equal(l.control({}).admissionsRequested.length,0);
    }
  });
  await test('duplicate current-owner SDK user wrapper is ambiguous',async()=>{
    const l=lab();await l.arm(fixtureCases.slice(0,2));l.payload=[...observed,observedUser];
    await assert.rejects(l.request,/RETAINED_PROTECTED_CONTEXT_AMBIGUOUS/);
  });
  await test('task marker in unwrapped or teacher-body text cannot supply protected authority',async()=>{
    for(const raw of [nativeTaskLine,nativeText+'\n'+nativeTaskLine]) {
      const l=lab();await l.arm(fixtureCases.slice(0,2));l.payload=withUser(raw);
      await assert.rejects(l.request,/RETAINED_REAL_HOST_TASK_REQUIRED|RETAINED_PROTECTED_CONTEXT_AMBIGUOUS/);
    }
  });
  await test('structured system sections do not override the actual user protected owner',async()=>{
    const l=lab();await l.arm(fixtureCases.slice(0,2));
    l.payload=observed.map(message=>message.role==='system'?{...message,sections:{...message.sections,preamble:JSON.stringify({...nativeTask,revision:999,requirementsVersion:999})}}:message);
    const calls=await l.request(),input=JSON.parse(calls.find(call=>call.function.name==='update_task_plan').function.arguments);
    assert.equal(input.expectedRevision,nativeTask.revision);assert.equal(input.requirementsVersion,nativeTask.requirementsVersion);
  });
  await test('historical different-owner protected context does not shadow current SDK user',async()=>{
    const oldTask={...nativeTask,taskId:'xitask_'+'e'.repeat(64)},oldTeacher={...nativeTeacher,sourceId:'historical_request',runId:'historical_run'};
    const earlier={role:'user',content:[{type:'text',text:nativeText.replace(nativeTaskLine,JSON.stringify(oldTask)).replace(nativeTeacherLine,'教师要求：'+JSON.stringify(oldTeacher))}]};
    const l=lab();await l.arm(fixtureCases.slice(0,2));l.payload=[observed[0],earlier,...observed.slice(1)];
    const calls=await l.request(),teacher=JSON.parse(calls.find(call=>call.function.name==='read_teacher_request').function.arguments);
    assert.equal(teacher.sourceId,nativeTeacher.sourceId);
  });
  await test('RwLhR6 actual one-response context-location failure remains byte-identical',()=>{
    const before=fingerprint(observedRoot).sha256,report=JSON.parse(fs.readFileSync(path.join(observedRoot,'report.json'),'utf8'));
    assert.equal(report.success,false);assert.equal(report.providerAtFailure.responses,1);assert.equal(report.providerAtFailure.tasks,1);assert.equal(report.providerAtFailure.externalAttempts,0);
    assert.equal(report.providerAtFailure.fatal,'RETAINED_REAL_HOST_TASK_REQUIRED');assert.equal(report.cases.length,0);
    assert.equal(fingerprint(observedRoot).sha256,before);
  });
  await test('missing teacher or process receipts prevents any source proposal',async()=>{
    for(const name of ['read_teacher_request','read_session_process']) {
      const l=lab();await l.arm(fixtureCases.slice(0,2));const calls=await l.request();await l.reply(calls);
      const id=calls.find(c=>c.function.name===name).id;l.messages=l.messages.filter(m=>m.tool_call_id!==id);
      await assert.rejects(l.request,/RETAINED_REAL_TOOL_RESULT_REQUIRED/);
      assert.equal(l.control({}).admissionsRequested.length,0);
    }
  });
  await test('pending or mismatched plan receipt cannot supply an executing envelope',async()=>{
    const l=lab();await l.arm(fixtureCases.slice(0,2));const calls=await l.request();await l.reply(calls);
    const receipt=l.messages.find(m=>m.tool_call_id===calls.find(c=>c.function.name==='update_task_plan').id);
    const value=JSON.parse(receipt.content.split('\n')[0]);value.steps.find(s=>s.id==='single_save').state='pending';receipt.content=JSON.stringify(value);
    await assert.rejects(l.request,/RETAINED_ADOPTED_EXECUTING_STEPS_REQUIRED/);assert.equal(l.control({}).admissionsRequested.length,0);
  });
  await test('production host unwrap preserves exact domain and extra fields remain rejectable',()=>{
    const domain=proposalFor(fixtureCases[0],'resource_test');
    const {stepId,input}=fixtureContracts.unwrapTaskArguments({...domain,taskStepId:'single_save'});
    assert.equal(stepId,'single_save');assert.deepEqual(input,domain);
    const altered=fixtureContracts.unwrapTaskArguments({...domain,taskStepId:'single_save',sourceChecked:true}).input;
    assert.notDeepEqual(altered,domain);
  });
  await test('PQ6tBK actual four-response task_plan_required failure remains byte-identical',()=>{
    const root=path.join(desktop,'test-results/ui-final-content-20261111/retained-qa/run-PQ6tBK');
    const before=fingerprint(root).sha256,report=JSON.parse(fs.readFileSync(path.join(root,'report.json'),'utf8'));
    assert.equal(report.success,false);assert.equal(report.providerAtFailure.responses,4);assert.equal(report.providerAtFailure.tasks,1);assert.equal(report.providerAtFailure.externalAttempts,0);
    assert.deepEqual(report.checks.map(c=>c.id),['IMPORTED_PDF']);assert.equal(report.cases.length,0);
    const sessions=path.join(root,'baseline/data/xiaozhi-pi');let denied=0;
    for(const name of fs.readdirSync(sessions).filter(name=>name.startsWith('aisession_'))) {
      const folder=path.join(sessions,name,'sessions');
      for(const name of fs.readdirSync(folder).filter(name=>name.endsWith('.jsonl'))) {
        for(const line of fs.readFileSync(path.join(folder,name),'utf8').split('\n').filter(Boolean)) {
          const message=JSON.parse(line).message;
          if(message?.role!=='toolResult'||message.toolName!=='education_propose_original_question')continue;
          assert.equal(message.isError,true);
          const failure=message.content.filter(p=>p.type==='text').map(p=>{try{return JSON.parse(p.text);}catch{return null;}}).find(v=>v?.scope==='task_admission');
          assert.equal(failure.reason,'task_plan_required');assert.equal(failure.delivery,'not_delivered');denied++;
        }
      }
    }
    assert.equal(denied,1);assert.equal(fingerprint(root).sha256,before);
  });
  await test('existing usage rows are conserved by actual run_id',()=>{
    const prior=Object.fromEntries(['teacher_resources','resource_chunks','question_bank_items','ai_confirmation_items','ai_agent_runs','xiaozhi_pi_commands','xiaozhi_pi_usage'].map(table=>[table,[]]));
    prior.xiaozhi_pi_usage=[{run_id:'one',payload_json:'old'},{run_id:'two',payload_json:'second'}];
    const after=structuredClone(prior);retainRows(prior,after);
    after.xiaozhi_pi_usage[1].payload_json='changed';assert.throws(()=>retainRows(prior,after),assert.AssertionError);
  });
  await test('missing actual tool result fails closed',async()=>{
    const l=lab();await l.arm(fixtureCases.slice(0,2));await l.request();
    await assert.rejects(l.request,/RETAINED_REAL_TOOL_RESULT_REQUIRED/);assert.equal(l.nativeCalls,0);
  });
  await test('failed tool result is preserved as failure',async()=>{
    const l=lab();await l.arm(fixtureCases.slice(0,2));const calls=await l.request();
    l.messages=[{role:'tool',tool_call_id:calls[0].id,content:'{"success":false,"code":"permission_denied"}'}];
    await assert.rejects(l.request,/RETAINED_REAL_TOOL_FAILED/);
  });
  await test('missing original tool definition cannot be fabricated',async()=>{
    const l=lab();l.tools.splice(l.tools.indexOf('find_education_tools'),1);await l.arm(fixtureCases.slice(0,2));
    await assert.rejects(l.request,/RETAINED_REAL_TOOL_MISSING_find_education_tools/);
  });
  await test('global fetch and models endpoint cannot reach wire',async()=>{
    const l=lab();await assert.rejects(()=>l.context.fetch('https://example.invalid'),/RETAINED_GLOBAL_FETCH_DENIED/);
    const m=lab();await assert.rejects(()=>m.electron.net.fetch('https://api.deepseek.com/v1/models'),/RETAINED_ENDPOINT_DENIED/);
    assert.equal(l.nativeCalls+m.nativeCalls,0);
  });
  await test('formal frame policy composes with zero native wire',()=>{
    const l=lab();l.control({verify:true});let value;
    l.registered({url:'wss://example.invalid',resourceType:'mainFrame'},result=>value=result);assert.equal(value.cancel,true);
    l.registered({url:'file:///child.html',resourceType:'subFrame'},result=>value=result);assert.equal(value.cancel,true);
    assert.equal(l.control({}).externalAttempts,1);
  });
  await test('cold launch rejects task arming and all completions',async()=>{
    const l=lab(true);await assert.rejects(()=>l.arm([fixtureCases[2]]),/RETAINED_TASK_BUDGET/);
    const m=lab(true);await assert.rejects(m.request,/RETAINED_RESPONSE_BUDGET/);assert.equal(m.nativeCalls,0);
  });
  await test('manifest path traversal and missing real manifest reject',()=>{
    assert.throws(()=>ownedExact(path.dirname(desktop),desktop),/Owned exact descendant/);
    assert.throws(()=>readFixtureManifest(path.join(desktop,'package.json'),desktop,{}),/Owned exact descendant/);
    assert.deepEqual(fixtureBudget,{piTasks:2,responses:9,launches:2,externalRequests:0,paidRequests:0,totalMs:240000});
  });
  await test('AST preserves retained reader, cancel and conservation assertions',()=>{
    const file=path.join(desktop,'scripts/ui-final-retained-sources-live.mjs'),source=fs.readFileSync(file,'utf8');
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);assert.equal(ast.parseDiagnostics.length,0);
    const functions=new Map();
    for(const node of ast.statements)if(ts.isFunctionDeclaration(node))functions.set(node.name.text,node.getText(ast));
    for(const name of ['assertStartupMigration','assertMaterialSourcesUnchanged','assertFactsUnchanged','finish','reader','prepare'])assert(functions.has(name));
    const reader=functions.get('reader');
    for(const fragment of ['[800,1366,1920]','question-original-image','naturalWidth>0','keyboard source vertical scroll','keyboard source horizontal scroll','Unique original picture container','await noOverflow()','await finish()'])assert(reader.includes(fragment),fragment);
    for(const fragment of ['const deadline=Date.now()+220000','education-journey-YlBdIe','question_78d96406-9590-4678-99f7-64c829651a1a','education-journey-0T0vdK','question_10934996-88dc-4e32-87df-10a71b9f07e0','education-journey-mnXCtZ','images:[{},{},{}]','assert.equal(row.length,1)','original-region-cancel','Modal footer reachable','Focus returns to actual picker trigger','actual local full-page crop raster'])assert(source.includes(fragment),fragment);
    const finish=functions.get('finish');
    for(const fragment of ['guardAfter.networkAttempts,0','guardAfter.modelAttempts,0','guardAfter.rendererErrors,0','assertFactsUnchanged','assertMaterialSourcesUnchanged','hashFile(r.local_path),r.content_hash','record.originAfter,record.originBefore'])assert(finish.includes(fragment),fragment);
  });
  await test('AST limits new runner to read-only business observations and UI actions',()=>{
    const names=['ui-final-retained-fixture-live.mjs',...['input','provider','evidence','selftest'].map(name=>'acceptance/retained-fixture-'+name+'.mjs')];
    const forbidden=new Set(['decideOriginalMultiQuestion','reviseOriginalMultiQuestion','createQuestion','dispatchXiaozhiCommand','sendXiaozhiMessage']);
    for(const name of names) {
      const source=fs.readFileSync(path.join(desktop,'scripts',name),'utf8'),ast=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
      assert.equal(ast.parseDiagnostics.length,0,name);
      const visit=node=>{
        if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression))assert(!forbidden.has(node.expression.name.text),name);
        ts.forEachChild(node,visit);
      };visit(ast);
      if(name!=='acceptance/retained-fixture-selftest.mjs')assert(!/\b(?:INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE)\b/i.test(source),name);
    }
  });
  await test('retained evidence keeps original proposal effect and source assertions after unwrap',()=>{
    const source=fs.readFileSync(path.join(desktop,'scripts/acceptance/retained-fixture-evidence.mjs'),'utf8');
    for(const fragment of ['fixtureContracts.unwrapTaskArguments(proposal[0].arguments)','assert.deepEqual(domainInput,proposalFor(item,source.id)',
      'assert.equal(payload.proposalDigest,digest(','assert.equal(effect.digest,digest(','assert.equal(image.version,source.content_hash)',
      "assert.equal(admission.inputDigest,digest(['education_propose_original_question',domainInput])",
      "s.id===stepId&&s.state==='executing'",'assert.equal(digest(facts),effect.saved.version'])assert(source.includes(fragment),fragment);
  });
  return checks;
  } finally {for(const db of databases)db.close();}
}
