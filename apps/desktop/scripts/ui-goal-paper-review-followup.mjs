/** Parent-only paid rerun of PiPaperReview, reusing the failed 9G2OGc fixture.
 * --check reads fixture metadata only. --run-paid requires an explicit inherited
 * key and expected NEW main hash. Never rebuilds, re-exports or alters old reports.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {admitPaperEnter} from './education/paper-ui-admission.mjs';
import {paperReviewRunMetadata} from './acceptance/paper-review-public-metadata.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=path.join(desktop,'test-results/ui-goal-paper-9G2OGc');
const data=path.join(fixture,'data'),profile=path.join(fixture,'electron-profile');
const originalPath=path.join(fixture,'ui-goal-report.json');
const originalBytes=fs.readFileSync(originalPath),original=JSON.parse(originalBytes);
const sessionId=original.result?.session;
const originalRun=original.admissions?.find(item=>item.label==='PiPaperReview');
const hash=value=>sha256(Buffer.from(JSON.stringify(value)));
function rows(query,parameters=[]){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(query).all(...parameters);}finally{db.close();}
}
function prepare(){
  for(const dir of [fixture,data,profile]){
    assert(fs.statSync(dir).isDirectory()&&!fs.lstatSync(dir).isSymbolicLink(),'Owned original fixture required');
  }
  assert.equal(original.success,false,'Original failure must remain recorded');
  assert(original.error.includes('piReviewEntry'),'Unexpected original failure');
  assert.equal(original.result.questionCount,20);
  assert.equal(original.result.deliveries.length,6);
  assert(originalRun?.admitted&&originalRun.inputCleared,'Original command admission evidence required');
  assert.equal(rows('SELECT COUNT(*) AS n FROM question_bank_items')[0].n,20);
  const paper=rows('SELECT * FROM ai_confirmation_items WHERE id=?',[original.result.paperId])[0];
  assert(paper?.status==='confirmed'&&paper.session_id===sessionId);
  const blueprint=JSON.parse(paper.payload_json).input.blueprint;
  // Exact expression and text from the original piReviewEntry; never a new prompt.
  const prompt='请实际调用 education_propose_paper 按下面蓝图做纯题库组卷，等待我逐题核对确认，再调用 education_read_paper 读取保存结果。不要创建文件，不生成新题。蓝图：'+JSON.stringify({...blueprint,title:'U4聊天核题入口'});
  assert.equal(rows('SELECT prompt FROM ai_agent_runs WHERE id=?',[originalRun.runId])[0]?.prompt,prompt);
  for(const file of original.result.deliveries){
    const absolute=path.resolve(fixture,'teacher-workspace',file.path);
    assert(absolute.startsWith(path.join(fixture,'teacher-workspace')+path.sep));
    assert.equal(sha256(fs.readFileSync(absolute)),file.sha256,'Existing delivered bytes changed');
  }
  return{prompt,promptSha256:sha256(Buffer.from(prompt))};
}
const prepared=prepare();
if(process.argv.includes('--check')){
  console.log(JSON.stringify({prepared:true,launchesElectron:false,modelCalls:false,fixture,
    sessionId,originalRunId:originalRun.runId,promptSha256:prepared.promptSha256,
    originalSuccess:false,existingDeliveries:6,scope:'Only original PiPaperReview request; no six-export replay'}));
}else if(process.argv.includes('--run-paid'))await run();
else console.log('Prepared only. Parent: --check, then --run-paid with DEEPSEEK_API_KEY and OMNI_EDU_TEST_EXPECTED_MAIN_SHA256.');

function workspaceFiles(){
  const root=path.join(fixture,'teacher-workspace'),files=[];
  function visit(directory){
    for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      assert(!entry.isSymbolicLink(),'No linked workspace entries');
      const absolute=path.join(directory,entry.name);
      if(entry.isDirectory())visit(absolute);
      else{assert(entry.isFile());files.push({path:path.relative(root,absolute),sha256:sha256(fs.readFileSync(absolute))});}
    }
  }
  visit(root);return files;
}
function facts(){
  return{
    questions:hash(rows('SELECT * FROM question_bank_items ORDER BY id')),
    artifacts:hash(rows('SELECT * FROM document_artifacts ORDER BY id')),
    confirmations:rows('SELECT * FROM ai_confirmation_items ORDER BY id'),
    commands:rows('SELECT command_id FROM xiaozhi_pi_commands ORDER BY command_id').map(row=>row.command_id),
    runs:rows('SELECT id FROM ai_agent_runs ORDER BY id').map(row=>row.id),
    files:workspaceFiles(),
  };
}
async function run(){
  assert(process.env.DEEPSEEK_API_KEY,'Parent must supply DEEPSEEK_API_KEY in environment; no .env fallback');
  const expectedMain=process.env.OMNI_EDU_TEST_EXPECTED_MAIN_SHA256;
  assert(/^[a-f0-9]{64}$/i.test(expectedMain||''),'Parent must supply expected NEW main SHA-256');
  const main=testMain(desktop),buildRoot=path.dirname(path.dirname(main));
  assert.equal(sha256(fs.readFileSync(main)),expectedMain.toLowerCase(),'Unexpected main build');
  const build=fingerprint(buildRoot);
  assert.notEqual(build.sha256,original.build.sha256,'Old failed build is not an admission fix');
  const before=facts(),output=fs.mkdtempSync(path.join(fixture,'pi-review-followup-'));
  const report={success:false,originalSuccess:false,humanAccepted:false,output,
    command:'node scripts/ui-goal-paper-review-followup.mjs --run-paid',sessionId,
    originalRunId:originalRun.runId,originalReportSha256:sha256(originalBytes),
    promptSha256:prepared.promptSha256,buildSha256:build.sha256,mainSha256:expectedMain.toLowerCase(),
    scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),checks:[],screens:[],
    admissions:[],consoleErrors:[],rendererErrors:[],scope:'Same 20-question fixture and original prompt; one new command/run, real modal confirmation/readback; no exports'};
  let app,page,runId,timedOut=false,stage='launch';
  const started=Date.now();
  const timer=setTimeout(()=>{timedOut=true;void app?.close().catch(()=>{});},300000);
  const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
  async function until(predicate,timeout=30000){
    const end=Date.now()+timeout;
    while(Date.now()<end){
      assert(!timedOut,'Follow-up exceeded 300s');
      if(await predicate())return;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw Error('PiPaperReview follow-up condition timeout');
  }
  // Return public metadata only; never serialize native reasoning or transcripts.
  const snapshot=()=>page.evaluate(async id=>{
    const state=await window.omniEdu.getXiaozhiSnapshot(id);
    return{running:state.running,paperReviews:state.paperReviews?.map(review=>({
      id:review.id,runId:review.runId,title:review.title,state:review.state,count:review.count,
    }))||[],projection:{turns:state.projection.turns.map(turn=>({id:turn.id,status:turn.status,
      itemKindCounts:{message:turn.items.filter(item=>item.kind==='message').length,
        tool:turn.items.filter(item=>item.kind==='tool').length,
        other:turn.items.filter(item=>item.kind!=='message'&&item.kind!=='tool').length},
      tools:turn.items.filter(item=>item.kind==='tool').map(item=>({
        tool:item.toolName,status:item.status,code:item.toolAttempt?.code,
      }))}))}};
  },sessionId);
  const commands=()=>rows('SELECT command_id,run_id,status FROM xiaozhi_pi_commands WHERE conversation_id=?',[sessionId]);
  async function capture(dialog,label){
    for(const [width,height] of [[1366,768],[1920,1080]]){
      await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
      await page.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]);
      assert.equal(await page.locator('.edu-shell:visible').getAttribute('data-theme'),'light');
      const file=`${label}-${width}.png`;
      // Capture only the public review dialog, never surrounding model details.
      await dialog.screenshot({path:path.join(output,file),animations:'disabled'});
      report.screens.push({file,width,height,dpr:await page.evaluate(()=>devicePixelRatio),scope:'Real public PiPaperReview modal'});
    }
  }
  try{
    const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_E2E_DIALOG_MODE:'1'};
    for(const name of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','OMNI_EDU_E2E_LEGACY_AI','OMNI_EDU_E2E_VISIBLE'])delete env[name];
    app=await _electron.launch({args:[main,`--user-data-dir=${profile}`,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});
    assert(!timedOut,'Follow-up launch exceeded budget');
    report.runtime=await assertIsolatedPiMain(app,main,profile);
    assert.equal(path.resolve(await app.evaluate(()=>process.env.OMNI_EDU_DATA_ROOT)),data);
    page=await app.firstWindow();page.setDefaultTimeout(20000);
    page.on('pageerror',()=>report.rendererErrors.push({kind:'pageerror'}));
    page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({kind:'console.error'});});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
    const composer=page.locator('.office-composer-container:visible');
    if(await composer.getAttribute('data-session-id')!==sessionId){
      const entry=page.locator('[data-testid="edu-navigation"]:visible').getByTestId(`workbench-session-${sessionId}`);
      assert.equal(await entry.count(),1,'Original session navigation entry required');await entry.click();
    }
    await until(async()=>await composer.getAttribute('data-session-id')===sessionId&&!(await snapshot()).running);
    assert.deepEqual(facts(),before,'Cold launch changed fixture before fresh command');
    stage='command-admission';
    const input=composer.getByTestId('office-prompt-input');
    await input.fill(prepared.prompt);
    runId=await admitPaperEnter({input,send:composer.getByRole('button',{name:'发送消息',exact:true}),snapshot,commands,until,report,label:'PiPaperReview-only follow-up'});
    report.runId=runId;check('Exact original prompt admitted once through Enter in the same isolated session');
    stage='pending-paper-review';
    let review;
    await until(async()=>{
      const state=await snapshot();
      const matches=state.paperReviews.filter(item=>item.runId===runId&&item.title==='U4聊天核题入口'&&item.state==='pending');
      assert(matches.length<=1,'Ambiguous pending review in owned run');
      if(matches.length){review=matches[0];return true;}
      const turn=state.projection.turns.find(item=>item.id===runId);
      if(turn&&['completed','failed','interrupted'].includes(turn.status)){
        report.terminalBeforeReview=paperReviewRunMetadata(turn);
        throw Error('Owned run terminated without the requested pending PiPaperReview; see tool admission metadata');
      }
      return false;
    },180000);
    stage='real-review-modal';
    const card=page.locator(`.office-turn[data-turn-id="${runId}"]:visible`).getByTestId('pi-paper-review').filter({hasText:'U4聊天核题入口'});
    assert.equal(await card.count(),1);
    await card.getByTestId('pi-paper-preview').click();
    const dialog=page.locator('[data-testid="pi-paper-dialog"]:visible');await dialog.waitFor();
    const questions=dialog.getByTestId('paper-question');assert.equal(await questions.count(),20);
    for(const question of await questions.all()){
      assert(await question.isVisible(),'Each actual question card must be visible, not hidden');
      const trigger=question.getByRole('button',{name:/^第 \d+ 题 ·/});
      assert.equal(await trigger.count(),1,'One official question trigger required');
      if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
      const stem=question.getByTestId('paper-question-stem');
      await stem.scrollIntoViewIfNeeded();assert(await stem.isVisible(),'Actual question stem must be expanded for review');
    }
    await capture(dialog,'pending-20-questions');
    const pending=rows('SELECT status,run_id,session_id FROM ai_confirmation_items WHERE id=?',[review.id])[0];
    assert.deepEqual({...pending},{status:'pending',run_id:runId,session_id:sessionId});
    check('Original PiPaperReview modal displays all 20 real questions and remains pending before teacher action');
    stage='teacher-confirmation-and-model-readback';
    await dialog.getByTestId('paper-confirm').click();
    await dialog.getByTestId('paper-confirmed').waitFor();await capture(dialog,'teacher-confirmed');
    await dialog.getByRole('button',{name:'关闭',exact:true}).click();
    await until(async()=>{
      const state=await snapshot(),turn=state.projection.turns.find(item=>item.id===runId);
      if(!state.running&&turn&&['completed','failed','interrupted'].includes(turn.status)){
        report.finalTurn=paperReviewRunMetadata(turn);return true;
      }
      return false;
    },180000);
    assert.equal(report.finalTurn.status,'completed');
    const saved=rows('SELECT * FROM ai_confirmation_items WHERE id=?',[review.id])[0];
    assert(saved.status==='confirmed'&&saved.run_id===runId&&saved.session_id===sessionId);
    assert.equal(JSON.parse(saved.payload_json).selection.items.length,20);
    const reads=rows('SELECT tool,phase,admitted,success FROM xiaozhi_tool_receipts WHERE run_id=? AND tool=?',[runId,'education_read_paper']);
    assert(reads.some(row=>row.phase==='settled'&&row.admitted===1&&row.success===1),'Real education_read_paper must succeed after confirmation');
    assert(report.finalTurn.tools.some(tool=>tool.tool==='education_read_paper'&&tool.status==='completed'));
    report.paper={id:saved.id,status:saved.status,count:20};report.readReceipts=reads;
    check('Teacher confirmation persists the same run-bound paper and the model actually reads it back');
    stage='immutable-facts-and-existing-files';
    const after=facts();
    assert.equal(after.questions,before.questions);assert.equal(after.artifacts,before.artifacts);
    assert.deepEqual(after.files,before.files,'No new or changed teacher workspace files');
    for(const previous of before.confirmations)assert.deepEqual(after.confirmations.find(row=>row.id===previous.id),previous);
    assert.deepEqual(after.confirmations.filter(row=>!before.confirmations.some(old=>old.id===row.id)).map(row=>row.id),[review.id]);
    assert.equal(after.commands.filter(id=>!before.commands.includes(id)).length,1);
    assert.deepEqual(after.runs.filter(id=>!before.runs.includes(id)),[runId]);
    check('Question facts, all prior confirmations and six existing files stay immutable; one command/run and no export replay');
    assert.equal(report.consoleErrors.length,0);assert.equal(report.rendererErrors.length,0);
    report.success=true;
  }catch(error){
    // Fixed categories only; no error stack may serialize snapshots or model text.
    report.failure={stage,
      name:['AssertionError','TimeoutError'].includes(error?.name)?error.name:'Error',
      code:error?.code==='ERR_ASSERTION'?'ERR_ASSERTION':'followup_failed'};
    if(app&&page&&runId){
      const state=await snapshot().catch(()=>null);
      report.failureRun=paperReviewRunMetadata(state?.projection.turns.find(turn=>turn.id===runId));
    }
  }finally{
    clearTimeout(timer);
    try{await app?.close();}catch{report.success=false;report.closeFailure=true;}
    report.originalReportUnchanged=sha256(fs.readFileSync(originalPath))===report.originalReportSha256;
    report.buildUnchanged=fingerprint(buildRoot).sha256===build.sha256;
    report.timedOut=timedOut;report.elapsedMs=Date.now()-started;
    if(!report.originalReportUnchanged||!report.buildUnchanged||timedOut)report.success=false;
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,originalSuccess:false}));
    if(!report.success)process.exitCode=1;
  }
}
