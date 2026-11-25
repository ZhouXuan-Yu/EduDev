import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
const desktop=path.resolve(import.meta.dirname,'../..'),baseline=process.argv.includes('--baseline');
const buildArg=process.argv.indexOf('--build');
const build=buildArg<0?path.join(desktop,'out'):process.argv[buildArg+1];
assert(path.isAbsolute(build??''),'Pass an absolute test build');
const main=fs.realpathSync(path.join(build,'main/index.js'));
const readRoot=process.argv.includes('--read')?path.resolve(process.argv[process.argv.indexOf('--read')+1]):undefined;
const continueRestored=process.argv.includes('--continue');
const withPending=process.argv.includes('--pending-approval');
assert(!continueRestored||!readRoot,'Continuation always starts in a new isolated fixture');
assert(!withPending||continueRestored,'The cold approval case must exercise explicit Continue');
if(readRoot){assert.equal(path.dirname(readRoot).toLowerCase(),os.tmpdir().toLowerCase());assert(path.basename(readRoot).startsWith('xiaozhi-stage-ui-'));}
const root=readRoot||fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-stage-ui-')),data=path.join(root,'data'),profile=path.join(root,'profile'),marker=path.join(root,'cut.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const query=(sql,...args)=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
const until=async(action,ms=60000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=await action();if(v)return v;await new Promise(r=>setTimeout(r,80));}throw Error('Stage recovery condition timed out');};
const report={ok:false,baseline,main,mainHash:sha(fs.readFileSync(main)),checks:[],boundary:'Original Pi/UI/local synthetic SSE; owned main force termination while installing actual DOCX. No paid model, teacher data, power loss or full AT acceptance.'};
const check=name=>{report.checks.push(name);console.log('PASS '+name);};let app,page,session;
async function launch(){
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>
  !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(key)));
 Object.assign(env,{OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',
  OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_SKIP_DOTENV:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'});
 app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net})=>{
  const state=globalThis.stageTest={requests:0,blocked:[],continueReadback:false,requestApproval:false};
  net.fetch=async(url,init)=>{
   const endpoint=new URL(typeof url==='string'?url:url instanceof URL?url.href:url.url);
   if(endpoint.origin==='https://api.deepseek.com'&&endpoint.pathname==='/v1/models')return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(endpoint.origin!=='https://api.deepseek.com'||endpoint.pathname!=='/v1/chat/completions'){state.blocked.push(endpoint.origin);throw Error('External network forbidden');}
   const body=JSON.parse(init.body),i=state.requests++,planned=body.tools?.some(t=>t.function.name==='update_task_plan');let call;
   if(state.continueReadback||state.requestApproval){
    state.continuation={prompt:body.messages.at(-1)?.content,toolCount:body.tools?.length??0};
    const repair=state.requestApproval&&i===0;
    if(repair&&!body.tools?.some(tool=>tool.function.name==='exec_command'))throw Error('The real pending permission tool was not offered');
    const delta=repair?{role:'assistant',tool_calls:[{index:0,id:'cold-approval-hold',type:'function',function:{
      name:'exec_command',arguments:JSON.stringify({cmd:"Write-Output 'Should only run after teacher approval'",timeout:30})
    }}]}:{role:'assistant',content:'原演示文件保留，讲解仍待核对。'};
    const chunk=(delta,finish_reason)=>'data: '+JSON.stringify({id:'owned-cold-continuation',object:'chat.completion.chunk',
      created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
    return new Response(chunk(delta,null)+chunk({},repair?'tool_calls':'stop')+'data: [DONE]\n\n',
      {headers:{'content-type':'text/event-stream'}});
   }
   if(i===0&&planned){const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),task=JSON.parse(system.split('\n').findLast(l=>l.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'))),requirementsVersion=task.requirementsVersion;call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion,expectedRevision:task.revision,reason:'保存两份教学文件',steps:[{id:'deliver',text:'保存教学文件',dependsOn:[],reported:'pending',kind:'saved_bundle',target:'current'},{id:'review',text:'教师核对内容',dependsOn:['deliver'],reported:'pending',kind:'human'}]})};}
   else if(i===(planned?1:0))call={name:'office_deliver_files',arguments:JSON.stringify({files:[{fileId:'html',kind:'text',path:'保留演示.html',content:'<!doctype html><html lang="zh-CN"><title>浮力</title><body><h1>排液体积与浮力</h1></body></html>'},{fileId:'doc',kind:'office',path:'未完成讲解.docx',format:'docx',sources:[],draft:{schemaVersion:'xiaozhi.office-draft.v1',title:'浮力讲解',sections:[{heading:'探究问题',paragraphs:['排液体积改变时浮力怎样变化？']}]}}],...(planned?{taskStepId:'deliver'}:{})})};
   const delta=call?{tool_calls:[{index:0,id:'stage-'+i,type:'function',function:call}]}:{content:'文件已保存。'};
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'local-stage',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk(delta)+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 });
 page=await app.firstWindow();await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 const id=await page.locator('.office-composer-container').getAttribute('data-session-id');if(session)assert.equal(id,session);session=id;
}
try{
 await launch();const identity=await app.evaluate(({app})=>({pid:process.pid,userData:app.getPath('userData')}));assert.equal(identity.userData,path.resolve(profile));report.identity=identity;
 if(readRoot){
  const original=JSON.parse(fs.readFileSync(path.join(root,'report.json'),'utf8'));assert(original.ok);assert.equal(query('SELECT state FROM xiaozhi_pi_office_drafts')[0].state,'interrupted');
  assert.equal(sha(fs.readFileSync(original.cut.formal)),original.finalFormalSha256);assert.equal(fs.existsSync(original.cut.temporary),original.baseline);
  assert.equal((await app.evaluate(()=>globalThis.stageTest)).requests,0);assert.equal(fs.readFileSync(path.join(path.dirname(original.cut.formal),'.xiaozhi-office-unrelated.tmp'),'utf8'),'other task sentinel');
  for(const [width,height]of[[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await page.getByTestId('pi-delivery-bundle').last().waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(root,'readback-'+width+'.png')});}
  check('Final-build dual-viewport readback keeps exact saved bytes and unrelated/legacy temporaries, zero model replay');report.ok=true;
 }else{
 await page.getByTestId('office-prompt-input').fill('保存一份浮力HTML演示与一份讲解DOCX，整包审阅后交付。');await page.getByRole('button',{name:'发送消息',exact:true}).click();
 const bundle=page.getByTestId('pi-delivery-bundle').last();await bundle.waitFor({timeout:120000});await until(async()=>!await bundle.getByTestId('pi-delivery-approve').isDisabled());
 report.syntheticRequests=(await app.evaluate(()=>globalThis.stageTest)).requests;
 await app.evaluate((_,marker)=>{const fs=process.getBuiltinModule('fs'),path=process.getBuiltinModule('path'),link=fs.linkSync;fs.linkSync=function(from,to,...args){if(path.basename(to)==='未完成讲解.docx'){fs.writeFileSync(marker,JSON.stringify({pid:process.pid,temporary:from,destination:to}));Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60000);throw Error('Owned cut was not terminated');}return link.call(this,from,to,...args);};},marker);
 const click=bundle.getByTestId('pi-delivery-approve').click();void click.catch(()=>{});await until(()=>fs.existsSync(marker));assert.equal(JSON.parse(fs.readFileSync(marker)).pid,identity.pid);execFileSync('taskkill',['/PID',String(identity.pid),'/T','/F'],{windowsHide:true,stdio:'pipe'});await click.catch(()=>{});await app.close().catch(()=>{});app=undefined;
 const cut=JSON.parse(fs.readFileSync(marker));assert.equal(cut.pid,identity.pid);assert(fs.existsSync(cut.temporary));assert(!fs.existsSync(cut.destination));const formal=path.join(path.dirname(cut.destination),'保留演示.html'),before=fs.readFileSync(formal),beforeHash=sha(before),beforeMtime=fs.statSync(formal).mtimeMs;report.cut={...cut,formal,formalSha256:beforeHash,tempSha256:sha(fs.readFileSync(cut.temporary))};
 const unrelated=path.join(path.dirname(formal),'.xiaozhi-office-unrelated.tmp');fs.writeFileSync(unrelated,'other task sentinel');check('Actual owned main exited between temporary write/fsync and exclusive DOCX install; prior HTML remains saved');
 await launch();assert.equal((await app.evaluate(()=>globalThis.stageTest)).requests,0);
 const office=await until(()=>query('SELECT * FROM xiaozhi_pi_office_drafts')[0]);assert.equal(office.state,'uncertain');assert.equal(query('SELECT state FROM xiaozhi_pi_text_changes')[0].state,'applied');
 const verify=page.getByTestId('pi-office-verify').last();await verify.waitFor();assert(await verify.isEnabled());await page.screenshot({path:path.join(root,'cold-partial.png')});check('Cold original UI exposes uncertain child verification and retained saved sibling with zero model replay');
 await verify.click();await until(()=>query('SELECT state FROM xiaozhi_pi_office_drafts')[0].state==='interrupted');
 assert.equal(sha(fs.readFileSync(formal)),beforeHash);assert.equal(fs.statSync(formal).mtimeMs,beforeMtime);assert.equal(fs.readFileSync(unrelated,'utf8'),'other task sentinel');assert(!fs.existsSync(cut.destination));
 assert.equal(fs.existsSync(cut.temporary),baseline);assert.equal((await app.evaluate(()=>globalThis.stageTest)).requests,0);assert.deepEqual((await app.evaluate(()=>globalThis.stageTest)).blocked,[]);
 report.after=query('SELECT * FROM xiaozhi_pi_office_drafts').map(({output_bytes,draft_json,...row})=>row);report.finalFormalSha256=sha(fs.readFileSync(formal));
 check(baseline?'Baseline reproduced: original verify leaves written orphan temporary file':'Original verify removes only recorded owned temporary file; no formal rewrite or unrelated deletion');
 for(const [width,height]of[[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await verify.count();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(root,'verified-'+width+'.png')});}
 await app.close();app=undefined;await launch();assert.equal((await app.evaluate(()=>globalThis.stageTest)).requests,0);assert.equal(fs.existsSync(cut.temporary),baseline);assert.equal(sha(fs.readFileSync(formal)),beforeHash);check('Second cold read preserves recovery and saved bytes without model or file replay');report.ok=true;
 if(continueRestored){
  report.ok=false;
  const readTask=()=>page.evaluate(sessionId=>window.omniEdu.getXiaozhiTask({sessionId}),session);
  const readPermission=()=>page.evaluate(sessionId=>window.omniEdu.getXiaozhiPermissions(sessionId),session);
  const task=await readTask();
  assert(task.ok&&task.value.recovery?.unknownEffects.length&&task.value.task?.state==='interrupted');
  const originalTask=task.value.task;
  async function openReview(){
   const review=page.locator(`[data-testid="pi-task-review"][data-task-id="${originalTask.id}"]`).last();
   const toggle=review.getByTestId('pi-task-review-toggle');
   if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
   await review.getByTestId('pi-task-recovery-effects').waitFor();
   return review;
  }
  let pendingApproval;
  if(withPending){
   await app.evaluate(()=>{globalThis.stageTest.requestApproval=true;});
   await (await openReview()).getByTestId('pi-task-resume').click();
   pendingApproval=await until(async()=>{
    const result=await readPermission();
    return result.ok&&result.value.approvals.find(item=>item.request.callId==='cold-approval-hold'&&item.state==='pending');
   },30_000);
   const execution=await app.evaluate(({app})=>({pid:process.pid,profile:app.getPath('userData'),command:process.argv[1]}));
   assert.equal(path.resolve(execution.profile),path.resolve(profile));
   assert.equal(fs.realpathSync(execution.command),main);
   const owner=execution.pid;
   const closed=app.waitForEvent('close',{timeout:15_000});
   void closed.catch(()=>undefined);
   execFileSync('taskkill',['/PID',String(owner),'/T','/F'],{windowsHide:true,stdio:'pipe'});
   await closed;
   app=undefined;
   await launch();
   const restartedPid=await app.evaluate(()=>process.pid);
   assert.notEqual(restartedPid,owner);
   assert.equal((await app.evaluate(()=>globalThis.stageTest)).requests,0);
   report.coldApproval={cutPid:owner,restartedPid};
  }
  if(pendingApproval){
   assert.equal(pendingApproval.request.owner.taskId,originalTask.id);
   const cold=await readTask();
   assert(cold.ok&&cold.value.task?.id===originalTask.id&&cold.value.recovery.unknownEffects.length);
   const prior=cold.value.recovery.approvals.find(approval=>approval.id===pendingApproval.id);
   assert.deepEqual(prior,{id:pendingApproval.id,revision:pendingApproval.revision,state:'pending',action:'exec_command'});
  }
  const effects=query('SELECT effect_id,state,document_json FROM xiaozhi_effects_v1 WHERE task_id=? ORDER BY effect_id',originalTask.id);
  assert(effects.some(effect=>effect.state==='unknown'));
  const snapshots=query('SELECT snapshot_id,snapshot_hash FROM xiaozhi_capability_snapshots_v1 WHERE task_id=? ORDER BY snapshot_id',originalTask.id);
  assert(snapshots.length>0);
  for(const effect of effects){
   const reference=JSON.parse(effect.document_json).contract?.snapshotId;
   if(reference)assert(snapshots.some(snapshot=>snapshot.snapshot_id===reference));
  }
  const review=await openReview();
  if(pendingApproval){
   const approvalPanel=review.getByTestId('pi-task-recovery-approvals');
   await approvalPanel.waitFor();
   assert.match(await approvalPanel.innerText(),/待审批/u);
  }
  const beforeRuns=query('SELECT run_id,status FROM xiaozhi_event_runs ORDER BY rowid');
  assert.equal(beforeRuns.length,withPending?2:1);
  assert.equal((await app.evaluate(()=>globalThis.stageTest)).requests,0);
  await app.evaluate(()=>{globalThis.stageTest.continueReadback=true;});
  await review.getByTestId('pi-task-resume').click();
  const resumed=await until(async()=>{
   const live=await page.evaluate(sessionId=>window.omniEdu.getXiaozhiSnapshot(sessionId),session);
   return !live.running&&live.projection.turns.find(turn=>!beforeRuns.some(row=>row.run_id===turn.id)&&turn.status!=='running');
  });
  assert.equal(resumed.task?.id,originalTask.id);
  assert.equal(resumed.task?.requirementsVersion,originalTask.requirementsVersion);
  const after=query('SELECT run_id,status FROM xiaozhi_event_runs ORDER BY rowid');
  assert.equal(after.length,beforeRuns.length+1);
  assert.equal(after.at(-1).run_id,resumed.id);
  const model=await app.evaluate(()=>globalThis.stageTest);
  assert.equal(model.requests,1);
  assert.deepEqual(query('SELECT effect_id,state,document_json FROM xiaozhi_effects_v1 WHERE task_id=? ORDER BY effect_id',originalTask.id),effects);
  const retained=query('SELECT snapshot_id,snapshot_hash FROM xiaozhi_capability_snapshots_v1 WHERE task_id=? ORDER BY snapshot_id',originalTask.id);
  assert(snapshots.every(snapshot=>retained.some(row=>row.snapshot_id===snapshot.snapshot_id&&row.snapshot_hash===snapshot.snapshot_hash)));
  assert.equal(sha(fs.readFileSync(formal)),beforeHash);
  assert.equal(fs.statSync(formal).mtimeMs,beforeMtime);
  assert(!fs.existsSync(cut.destination));
  report.continuation={task:originalTask.id,unknownEffects:task.value.recovery.unknownEffects,effectsCount:effects.length,snapshots,runs:after,requests:model.requests};
  if(pendingApproval){
   const wake=await page.evaluate(sessionId=>window.omniEdu.getXiaozhiPermissions(sessionId),session);
   assert(wake.ok);
   assert.equal(wake.value.approvals.find(item=>item.id===pendingApproval.id).state,'pending');
   const grant=wake.value.grants.find(item=>pendingApproval.grantRefs.some(ref=>ref.grantId===item.grantId)&&!item.revokedAt);
   assert(grant,'The pending original execution must keep a relevant existing grant');
   const revoked=await page.evaluate(input=>window.omniEdu.revokeXiaozhiGrant(input),{sessionId:session,grantId:grant.grantId,revision:grant.revision});
   assert(revoked.ok,JSON.stringify(revoked));
   const invalidated=await page.evaluate(sessionId=>window.omniEdu.getXiaozhiPermissions(sessionId),session);
   assert(invalidated.ok);
   const retired=invalidated.value.approvals.find(item=>item.id===pendingApproval.id);
   assert.equal(retired.state,'invalidated');
   const stale=await page.evaluate(input=>window.omniEdu.decideXiaozhiPermission(input),{
    sessionId:session,approvalId:pendingApproval.id,revision:pendingApproval.revision,decision:'approve',scope:'operation'
   });
   assert(!stale.ok);
   assert.equal(query("SELECT count(*) AS n FROM xiaozhi_permission_audit_v1 WHERE kind='execution_intent' AND json_extract(metadata_json,'$.callId')='cold-approval-hold'")[0].n,0);
   assert.equal((await app.evaluate(()=>globalThis.stageTest)).requests,1);
   report.continuation.approval={original:pendingApproval.id,before:'pending',after:retired.state,stale};
   check('The original persisted pending approval survives cold launch, then real teacher revoke fences the old decision with zero terminal execution');
  }
  check('The actual Continue button runs once on the original Task after readback and cannot duplicate unknown Effects or replace prior snapshots');
  report.ok=true;
 }
 }
}catch(error){report.error=String(error.stack);report.probe=await app?.evaluate(()=>globalThis.stageTest).catch(()=>undefined);process.exitCode=1;await page?.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});}finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(root,readRoot?'readback-report.json':'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,baseline,root,checks:report.checks.length,error:report.error}));}
