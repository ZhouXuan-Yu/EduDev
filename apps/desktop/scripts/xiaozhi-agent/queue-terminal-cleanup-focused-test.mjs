/** Source integration, not Electron/provider acceptance. Execute the complete
 * current host stop method and execute-finally block with the real coordinator
 * and native SQLite. Provider setup and unrelated file/approval services are
 * controlled seams; no production host/loop or source file is rewritten.
 */
import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const {createPiControlState} = await import('../../src/main/xiaozhi-agent/control-state.ts');
const {createPiControlCoordinator} = await import('../../src/main/xiaozhi-agent/control-tools.ts');
const {waitForLifecycle} = await import('../../src/main/xiaozhi-agent/lifecycle-wait.ts');
const {createRunVerification} = await import('../../src/main/xiaozhi-agent/verification/run-observer.ts');
const {applyXiaozhiEvent, XIAOZHI_ERRORS} = await import('../../src/shared/xiaozhi-projection.ts');
const {VERIFICATION_LABELS, verificationDescription} = await import('../../src/shared/xiaozhi-verification.ts');

const desktop = fileURLToPath(new URL('../..', import.meta.url));
const hostPath = path.join(desktop, 'src/main/xiaozhi-agent/production-host.ts');
const source = fs.readFileSync(hostPath, 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const output = fs.mkdtempSync(path.join(desktop, 'test-results/ui-final-queue-terminal-'));
const report = {success:false, checks:[], output, sourceSha256:sha(source),
  electronLaunches:0, modelCalls:0,
  scope:'Complete source stop/finally blocks + real control coordinator + native SQLite; no UI/provider claim',
  seams:['Provider work omitted before finally', 'Unrelated cleanup services counted',
    'Terminal storage/publication observed against real control SQL', 'Injected SQL read failure and hold']};
const db = new DatabaseSync(path.join(output, 'controls.db'));
db.exec('CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);'
  + 'CREATE TABLE terminal_witness(session TEXT, boundary TEXT, status TEXT, dirty INTEGER)');
let failRead = false, holdRead;
const sql = {
  run:async (query, values=[]) => db.prepare(query).run(...values),
  change:async (query, values=[]) => Number(db.prepare(query).run(...values).changes),
  all:async (query, values=[]) => {
    if (query.startsWith('SELECT * FROM xiaozhi_pi_controls WHERE conversation_id=')) {
      if (failRead) { failRead=false; throw Error('owned SQL read failure'); }
      if (holdRead) { const hold=holdRead; holdRead=undefined; hold.enter(); await hold.promise; }
    }
    return db.prepare(query).all(...values);
  },
};
const state = createPiControlState(sql);
const tree = ts.createSourceFile(hostPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function find(node, predicate) {
  if (predicate(node)) return node;
  return ts.forEachChild(node, child => find(child, predicate));
}
const execute = find(tree, node => ts.isFunctionDeclaration(node) && node.name?.text==='execute');
assert(execute, 'Actual execute function must exist');
const finalBlock = find(execute, node => ts.isTryStatement(node)
  && node.finallyBlock?.getText(tree).includes('await controls.finish(id,run.runId)'))?.finallyBlock;
const stop = find(tree, node => ts.isMethodDeclaration(node) && node.name.getText(tree)==='stop');
assert(finalBlock && stop, 'Actual complete stop and finally blocks must exist');
const finalText = finalBlock.getText(tree), stopText = stop.body.getText(tree);
function compile(body, context, tail='') {
  const js = ts.transpileModule(`async function invoke() ${body}\ninvoke`, {
    compilerOptions:{target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.None},
  }).outputText;
  return vm.runInNewContext(js, context, {filename:`host-source-${tail || 'stop'}.js`});
}
function legacy(body) {
  const needle='await controls.finish(id,run.runId)';
  assert.equal(body.split(needle).length, 2);
  return body.replace(needle, 'if(run.hasToolEvents) await controls.finish(id,run.runId)');
}
function deferred() {
  let resolve;
  const promise=new Promise(done => { resolve=done; });
  return {promise, resolve};
}
const check = async (name, action) => {
  try { await action(); report.checks.push({name,status:'PASS'}); console.log('PASS '+name); }
  catch (error) { report.checks.push({name,status:'FAIL',stack:error.stack}); throw error; }
};
async function fixture(hasTools=false, failure) {
  const id='aisession_'+randomUUID(), runId='run_'+randomUUID(), otherRun='run_'+randomUUID();
  db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(id);
  const initial = [
    {id:'xicmd_'+randomUUID(),state:'queued',revision:1,mode:'followUp',text:'编辑后的合成 QA 指令'},
    {id:'xicmd_'+randomUUID(),state:'withdrawn',revision:1,mode:'followUp',text:'已撤回的合成 QA 指令'},
    {id:'xicmd_'+randomUUID(),state:'dispatching',revision:3,mode:'steer',text:'已锁定但未交付的合成 QA 指令'},
    {id:'xicmd_'+randomUUID(),state:'queued',revision:4,mode:'steer',text:'其他轮次不能被清理',runId:otherRun},
  ].map(row => ({sessionId:id,runId,kind:'instruction',requestHash:sha(row.id),...row}));
  for (const row of initial) assert(await state.putControl(row));
  const calls=[], events=[], witnesses=[];
  let aborts=0, publisherFailure=0;
  const run={runId,commandId:'xicmd_'+randomUUID(),hasToolEvents:hasTools,
    operation:'prompt',instructions:new Set(),stopped:false,abort:new AbortController(),
    sequence:0,usage:{runId,state:'running'},usageWrites:Promise.resolve(),
    turn:{id:runId,status:'running',items:[{id:'user',kind:'message',role:'user',text:'合成 QA'}]},
    agent:{dispose:async()=>{},abort:async()=>{aborts++;},qualityMetrics:()=>({})}};
  const active=new Map([[id,run]]);
  const witness=(boundary,status) => {
    const dirty=Number(db.prepare("SELECT count(*) AS n FROM xiaozhi_pi_controls"
      + " WHERE run_id=? AND state IN ('pending','queued','dispatching')").get(runId).n);
    witnesses.push({boundary,status,dirty});
    db.prepare('INSERT INTO terminal_witness VALUES(?,?,?,?)').run(id,boundary,status,dirty);
  };
  const store={xiaozhiState:{...state,sql,
    saveUsage:async()=>{},finishCommand:async()=>{},approvals:async()=>[],
    transition:async()=>assert.fail('No executing approvals in this fixture')},
    recordAiAgentEvent:async()=>{},
    appendAiConversationMessage:async()=>witness('assistant-message',run.turn.status),
    completeAiAgentRun:async(_run,status)=>witness('run-commit',status)};
  const controls=createPiControlCoordinator({store,isCurrent:()=>true,flush:async()=>{},
    resume:async()=>assert.fail('No resume allowed'),
    emit:(_session,_run,payload)=>events.push(structuredClone(payload))});
  const service=name=>({cancel:async()=>{calls.push(name);}});
  const context={run,id,store,controls,active,failure,text:'',settings:{model:'synthetic'},
    executionStarted:performance.now(),preparationMs:0,sdkEndedMs:0,answerTruncated:false,
    applyXiaozhiEvent:(turn,event)=>{
      if(event.kind==='status')witness('terminal-projection',event.status);
      return applyXiaozhiEvent(turn,event);
    },XIAOZHI_ERRORS,createRunVerification,VERIFICATION_LABELS,verificationDescription,
    performance,process:{env:{}},options:{shutdownTimeoutMs:1000},waitForLifecycle,
    validId:value=>value===id,invalidateLearningDecisions:()=>{},admissions:new Map(),
    attachments:{cancelSession:()=>calls.push('attachments')},browser:{cancel:()=>calls.push('browser')},
    publicEvent:(_id,_run,event)=>{
      events.push(structuredClone(event));
      if(event.kind==='status')witness('public-terminal',event.status);
    },decisions:{sealRoute:async()=>{},unavailable:()=>assert.fail('seal failed')},
    publicGoal:value=>value,deliveryFinal:async()=>undefined,
    approvals:service('approvals'),textChanges:service('textChanges'),
    officeArtifacts:service('officeArtifacts'),deliveries:service('deliveries'),
    learningReviews:service('learningReviews'),questionReviews:service('questionReviews'),
    questionCollections:service('questionCollections'),originalReviews:service('originalReviews'),
    practiceReviews:service('practiceReviews'),paperReviews:service('paperReviews'),
  };
  const finish=body=>compile(body,context,'finally')();
  const stopNow=body=>compile(body,context)();
  const invariant=async()=>{
    for(const original of initial){
      const row=await state.control(original.id);
      const expected=original.runId===otherRun?'queued':original.state==='withdrawn'?'withdrawn':'interrupted';
      assert.equal(row.state,expected);
      for(const key of ['id','runId','sessionId','requestHash','revision','mode','text'])
        assert.equal(row[key],original[key],key+' must survive cleanup');
      const raw=db.prepare('SELECT state,payload_json FROM xiaozhi_pi_controls WHERE id=?').get(row.id);
      assert.equal(raw.state,JSON.parse(raw.payload_json).state);
    }
  };
  return {id,run,context,controls,calls,events,witnesses,finish,stopNow,invariant,
    aborts:()=>aborts,publisherFailure:()=>publisherFailure,
    installPublisherFailure:()=>{run.publisher={fail:()=>{publisherFailure++;}};}};
}
const fetchBefore=globalThis.fetch;
globalThis.fetch=async()=>assert.fail('Network forbidden in focused source test');
try {
  await state.migrateControls();
  await check('Negative legacy STOP gate leaves no-tool queued rows stranded',async()=>{
    const f=await fixture(); assert((await f.stopNow(legacy(stopText))).ok);
    assert.equal((await state.controls(f.id))[0].state,'queued'); assert.equal(f.aborts(),1);
  });
  await check('Negative legacy finally reaches normal terminal with queued rows',async()=>{
    const f=await fixture(); await f.finish(legacy(finalText));
    assert(f.witnesses.some(w=>w.boundary==='run-commit'&&w.status==='succeeded'&&w.dirty===2));
  });
  for(const hasTools of [false,true])for(const outcome of ['STOP','normal','failure']){
    await check(`${hasTools?'Tool-event':'No-tool'} ${outcome}: clean before terminal; identity/revision/mode/text/withdrawn and other run retained`,async()=>{
      const f=await fixture(hasTools,outcome==='failure'?'transport':undefined);
      if(outcome==='STOP'){
        assert((await f.stopNow(stopText)).ok); await f.invariant();
        assert.equal(f.aborts(),1); assert(f.run.abort.signal.aborted);
      }
      await f.finish(finalText); await f.invariant();
      const expected=outcome==='STOP'?'blocked':outcome==='failure'?'failed':'succeeded';
      assert(f.witnesses.some(w=>w.boundary==='run-commit'&&w.status===expected));
      assert(f.witnesses.length>=3); assert(f.witnesses.every(w=>w.dirty===0));
      for(const name of ['approvals','textChanges','officeArtifacts','deliveries'])
        assert.equal(f.calls.filter(v=>v===name).length,hasTools?(outcome==='STOP'?2:1):0);
      for(const name of ['learningReviews','questionReviews','questionCollections','originalReviews','practiceReviews','paperReviews'])
        assert.equal(f.calls.filter(v=>v===name).length,hasTools&&outcome==='STOP'?1:0);
      const rows=JSON.stringify(await state.controls(f.id)), count=f.events.length;
      await f.controls.finish(f.id,f.run.runId); await f.controls.finish(f.id,f.run.runId);
      assert.equal(JSON.stringify(await state.controls(f.id)),rows); assert.equal(f.events.length,count);
      assert.equal(f.events.filter(e=>e.kind==='control'&&e.control.state==='interrupted').length,2);
    });
  }
  await check('Held native SQL cleanup prevents any terminal projection/storage until released',async()=>{
    const f=await fixture(),entered=deferred(),release=deferred();
    holdRead={enter:entered.resolve,promise:release.promise};
    const finishing=f.finish(finalText); await entered.promise;
    assert.equal(f.witnesses.length,0); release.resolve(); await finishing;
    await f.invariant(); assert(f.witnesses.every(w=>w.dirty===0));
  });
  await check('Finally cleanup read failure retains configuration failure and prior transport cause',async()=>{
    for(const prior of [undefined,'transport']){
      const f=await fixture(false,prior); failRead=true; await f.finish(finalText);
      assert.equal(f.context.failure,prior||'configuration');
      assert(f.witnesses.some(w=>w.boundary==='run-commit'&&w.status==='failed'));
      assert(!f.witnesses.some(w=>w.status==='succeeded'));
    }
  });
  await check('STOP cleanup SQL failure returns false and marks publisher failure; later cleanup remains possible',async()=>{
    const f=await fixture(); f.installPublisherFailure(); failRead=true;
    assert.equal((await f.stopNow(stopText)).ok,false); assert.equal(f.publisherFailure(),1);
    delete f.run.publisher; await f.finish(finalText); await f.invariant();
    assert(f.witnesses.every(w=>w.dirty===0));
  });
  assert.equal(sha(fs.readFileSync(hostPath)),report.sourceSha256,'Source changed during test');
  report.success=true;
} catch(error) {
  report.error=error.stack; process.exitCode=1;
} finally {
  globalThis.fetch=fetchBefore; db.close();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));
}
