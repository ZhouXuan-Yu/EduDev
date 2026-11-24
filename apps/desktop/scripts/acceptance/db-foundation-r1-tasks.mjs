import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {arch,availableParallelism,platform,release,totalmem} from 'node:os';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {addTask,expectedTasks,prefix,saveTask,seed,sessionFor,withSql} from './db-foundation-r1-task-fixture.mjs';

const desktop=resolve(import.meta.dirname,'../..'), main=testMain(desktop);
const legacy=resolve(desktop,'test-results/xiaozhi-db-r1-baseline/out/main/index.js');
assert(existsSync(legacy),'The WP-00 Electron build is required');
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const evidence=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||join(desktop,'test-results'));
mkdirSync(join(evidence,'fixtures'),{recursive:true});
const root=mkdtempSync(join(evidence,'fixtures','FX-07-task-'));
const report={ok:false,main:sha(main),baseline:sha(legacy),host:{arch:arch(),platform:platform(),
  release:release(),logicalCpu:availableParallelism(),memory:totalmem()},fixtures:{},checks:[]};
const query={schemaVersion:1,kind:'tasks',filter:'all',limit:25};
const scoped={...query,sessionId:sessionFor(0)};
const names=['first','deep','state','session'];
let app,page,stage='legacy scale fixture';
const check=(name,detail={})=>{report.checks.push({name,...detail});console.log('PASS '+name);};
const read=(data,sql,...args)=>withSql(data,false,db=>db.prepare(sql).all(...args));
const exec=(data,action)=>withSql(data,true,db=>{
  db.exec('BEGIN IMMEDIATE');
  try{const result=action(db);db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}
});
const clock=data=>read(data,`SELECT *, EXISTS(SELECT 1 FROM xiaozhi_task_summary_dirty) OR
  EXISTS(SELECT 1 FROM xiaozhi_task_summary_dirty_sessions) AS dirty FROM xiaozhi_task_summary_control`)[0];
async function until(predicate,timeout=60000){
  const start=performance.now();
  while(performance.now()-start<timeout){const result=await predicate();if(result)return result;await wait(35);}
  throw Error('Timed out: '+stage);
}
async function launch(data,label,build=main) {
  const profile=join(root,label+'-profile');
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),
    OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'',GLM_API_KEY:''};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[build,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  page=await app.firstWindow({timeout:45000});
  await page.waitForFunction(()=>Boolean(window.omniEdu));
  await assertIsolatedPiMain(app,build,profile);
}
async function close(){if(app)await app.close();app=undefined;page=undefined;}
const list=(input=query)=>page.evaluate(input=>window.omniEdu.getXiaozhiWorkbenchSummary(input),input);
async function good(input=query){
  const result=await list(input);
  assert.equal(result.ok,true,JSON.stringify(result));
  return result.value;
}
const ready=data=>until(()=>{const row=clock(data);return row?.phase==='ready'&&!row.dirty&&row;});
async function walk(input,limit=Infinity){
  const received=[];
  let after;
  do {
    const page=await good({...input,...(after?{cursor:after}:{})});
    assert.equal(page.partial,false,JSON.stringify(page.sourceFailures));
    assert(page.scanned<=26);
    received.push(...page.items.map(row=>row.taskId));
    after=page.nextCursor;
  }while(after&&received.length<limit);
  return {received,after};
}
const canonical=value=>JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left],[right])=>left<right?-1:left>right?1:0)));
function baselineCursor(view){
  const scope=createHash('sha256').update(canonical(query)).digest('hex');
  return Buffer.from(JSON.stringify({v:1,query:scope,key:view.updatedAt,id:view.id})).toString('base64url');
}
function p95(values){
  return [...values].sort((a,b)=>a-b)[Math.ceil(values.length*0.95)-1];
}
const reportFixture=()=>writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
async function sample(input){
  const began=performance.now(),result=await good(input);
  return {elapsedMs:performance.now()-began,scanned:result.scanned,matched:result.matched,first:result.items[0]?.taskId};
}
async function traceStart() {
  await app.evaluate((_,path)=>{
    const db=process.getBuiltinModule('module').createRequire(path)('sqlite3').Database.prototype;
    const original=db.all, observed=new Map(), delaySamples=[];
    const origin=performance.now();
    let last=origin;
    const timer=setInterval(()=>{const now=performance.now();delaySamples.push(Math.max(0,now-last-50));last=now;},50);
    db.all=function(sql,...args){
      const values=args[0];
      if(/xiaozhi_task_summary|SELECT id,title FROM ai_conversation_sessions|xiaozhi_effects_v1|SELECT rowid AS workbench_rowid/u.test(sql)){
        const statement=sql.replace(/\s+/gu,' ').trim(), old=observed.get(statement);
        if(!old)observed.set(statement,{calls:1,parameters:Array.isArray(values)?values:[]});
        else old.calls++;
      }
      return original.call(this,sql,...args);
    };
    globalThis.r1TraceEnd=()=>{
      clearInterval(timer);
      db.all=original;
      return {statements:[...observed.entries()],eventLoop50Ms:delaySamples,wallMs:performance.now()-origin};
    };
  },join(desktop,'package.json'));
}
const traceEnd=()=>app.evaluate(()=>globalThis.r1TraceEnd());
function plan(data,trace){
  return trace.statements.filter(([sql])=>sql.includes('r.row_json')).map(([sql,entry])=>({
    sql,calls:entry.calls,limit:entry.parameters.at(-1),
    plan:read(data,'EXPLAIN QUERY PLAN '+sql,...entry.parameters).map(row=>row.detail),
  }));
}

try{
  const template=join(root,'legacy-empty'), sourceSmall=join(root,'legacy-1000'),sourceLarge=join(root,'legacy-10000');
  await launch(template,'template',legacy);
  await close();
  cpSync(template,sourceSmall,{recursive:true});cpSync(template,sourceLarge,{recursive:true});
  report.fixtures.small=seed(sourceSmall,1000);
  report.fixtures.large=seed(sourceLarge,10000);
  const expectedLarge=expectedTasks(sourceLarge);
  assert.equal(expectedLarge.length,10000);
  const data=join(root,'candidate-1000');
  cpSync(sourceSmall,data,{recursive:true});
  stage='resumable projection interrupts at a committed chunk';
  await launch(data,'small');
  const firstChunk=await until(()=>{const row=clock(data);return row.phase==='rebuilding'&&row.projected_rows>=40&&row.projected_rows<1000&&row;});
  const inFlight=await good();
  assert.equal(inFlight.partial,true);
  assert.equal(inFlight.total,null);
  exec(data,db=>addTask(db,1000,100));
  const process=app.process();
  assert(process.kill());
  await until(()=>process.exitCode!==null||process.signalCode!==null);
  await close().catch(()=>{app=undefined;page=undefined;});
  const interrupted=clock(data);
  assert.equal(interrupted.epoch,firstChunk.epoch);
  assert(interrupted.cursor>=firstChunk.cursor);
  await launch(data,'small-restart');
  const caught=await ready(data);
  assert.equal(caught.epoch,firstChunk.epoch);
  assert.equal(caught.projected_rows,1001);
  const expected=expectedTasks(data);
  check('The cursor and earlier chunk survive process loss and concurrent source insert.',{firstChunk,interrupted,caught});

  stage='static deterministic keyset and scope';
  const walked=await walk(query);
  assert.deepEqual(walked.received,expected.map(task=>task.id));
  const scopedPage=await walk(scoped);
  assert.deepEqual(scopedPage.received,expected.filter(task=>task.sessionId===scoped.sessionId).map(task=>task.id));
  const first=await good();
  for(const invalid of [
    {...query,cursor:first.nextCursor,filter:'completed'},
    {...scoped,cursor:first.nextCursor},
    {...query,cursor:'broken_cursor'},
    {...query,cursor:first.nextCursor.slice(0,-4)+'AAAA'},
  ])assert.deepEqual(await list(invalid),{ok:false,error:'changed'});
  assert.deepEqual(first.counts,Object.fromEntries(
    Object.keys(first.counts).map(state=>[state,expected.filter(task=>task.state===state).length])));
  assert.equal((await good({...query,filter:'overview'})).matched,13);
  check('Stable ordering and filters do not repeat or lose any of 1,001 task identities; scope, invalid and tampered cursors are rejected.');

  stage='atomic invalidation, rollback and latest revision';
  const target=first.items[0], rowKey=prefix+target.taskId;
  const raw=read(data,'SELECT value_json FROM app_settings WHERE key=?',rowKey)[0].value_json;
  const doc=JSON.parse(raw);
  const before=clock(data);
  assert.throws(()=>exec(data,db=>{db.prepare('UPDATE app_settings SET value_json=? WHERE key=?').run('{',rowKey);throw Error('rollback fixture');}),/rollback fixture/u);
  assert.equal(clock(data).generation,before.generation);
  assert.deepEqual((await good()).items,first.items);
  const next=structuredClone(doc);
  next.view.revision=2;next.view.state='paused';next.view.binding=null;
  const latest=structuredClone(next);latest.view.revision=3;latest.view.state='ended';
  const generations=exec(data,db=>{
    saveTask(db,next,true);saveTask(db,latest,true);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM xiaozhi_task_summary_dirty WHERE task_id=?').get(target.taskId).n,1);
    return db.prepare('SELECT generation FROM xiaozhi_task_summary_control').get().generation;
  });
  assert(generations>before.generation);
  assert.deepEqual(await list({...query,cursor:first.nextCursor}),{ok:false,error:'changed'});
  await ready(data);
  const one={...query,sessionId:target.sessionId,taskId:target.taskId};
  assert.equal((await good(one)).items[0].revision,3);
  assert.equal((await good(one)).items[0].state,'ended');
  check('Rolled back writes preserve generation. Repeated invalidations coalesce and projection reads current revision even when timestamps tie.');

  stage='approval, effect, title, archive, corruption and derived rebuild';
  const related=expected.find(task=>task.origin.runId==='airun_r1_0');
  const relatedQuery={...query,sessionId:related.sessionId,taskId:related.id};
  const pending=(await good(relatedQuery)).items[0];
  assert.equal(pending.pendingApprovalCount,1);assert.equal(pending.unknownEffectCount,1);
  exec(data,db=>{
    db.prepare(`UPDATE ai_confirmation_items SET payload_json=json_set(payload_json,'$.state','rejected'),status='rejected' WHERE run_id=?`).run(related.origin.runId);
    db.prepare(`UPDATE xiaozhi_effects_v1 SET document_json=json_set(document_json,'$.state','reconciled','$.revision',2),state='reconciled',revision=2 WHERE task_id=?`).run(related.id);
    db.prepare('UPDATE ai_conversation_sessions SET title=? WHERE id=?').run('R1 新标题',related.sessionId);
  });
  await ready(data);
  const changed=(await good(relatedQuery)).items[0];
  assert.equal(changed.sessionTitle,'R1 新标题');
  assert.equal(changed.pendingApprovalCount,0);assert.equal(changed.unknownEffectCount,0);
  exec(data,db=>db.prepare("UPDATE ai_conversation_sessions SET archived_at='2026-01-01' WHERE id=?").run(related.sessionId));
  assert.deepEqual(await list(relatedQuery),{ok:false,error:'permission_denied'});
  assert(!(await good()).items.some(row=>row.sessionId===related.sessionId));
  exec(data,db=>db.prepare('UPDATE ai_conversation_sessions SET archived_at=NULL WHERE id=?').run(related.sessionId));

  exec(data,db=>db.prepare("UPDATE app_settings SET value_json='{' WHERE key=?").run(rowKey));
  await ready(data);
  const partial=await good();
  assert.equal(partial.partial,true);
  assert.equal(partial.total,null);assert.equal(partial.counts,null);assert.equal(partial.matched,null);
  assert(partial.sourceFailures.some(item=>item.code==='corrupt'));
  await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-my_tasks').click();
  await page.getByTestId('pi-task-partial').waitFor();
  assert.match(await page.getByTestId('pi-task-counts').innerText(),/未完整核对/u);
  assert.equal(await page.getByTestId('pi-task-overview-empty').count(),0);
  exec(data,db=>saveTask(db,latest,true));
  await ready(data);
  const persisted=read(data,'SELECT value_json FROM app_settings WHERE key=?',rowKey)[0].value_json;
  const epoch=clock(data).epoch;
  exec(data,db=>db.prepare('DELETE FROM xiaozhi_task_summary_rows WHERE task_id=?').run(target.taskId));
  await until(()=>clock(data).epoch!==epoch);
  await ready(data);
  assert.equal((await good(one)).items[0].revision,3);
  assert.equal(read(data,'SELECT value_json FROM app_settings WHERE key=?',rowKey)[0].value_json,persisted);
  check('Approval, Effect and title changes appear, archived sessions are hidden, source corruption is visible in the UI and a derived-only deletion rebuilds safely.');

  stage='late response and native SQL error in UI';
  const taskFilter=page.getByTestId('pi-task-filter');
  await app.evaluate((_,file)=>{
    const prototype=process.getBuiltinModule('module').createRequire(file)('sqlite3').Database.prototype;
    const all=prototype.all;
    const fault={held:false,fail:false,release:undefined,restore:()=>{prototype.all=all;}};
    globalThis.r1UiRead=fault;
    prototype.all=function(sql,values,callback) {
      if(typeof callback==='function' && sql.includes('r.row_json') && sql.includes("r.state='completed'") && !fault.held){
        fault.held=true;
        return all.call(this,sql,values,(error,rows)=>{fault.release=()=>callback(error,rows);});
      }
      if(typeof callback==='function' && sql.includes('r.row_json') && fault.fail){
        fault.fail=false;
        return all.call(this,sql.replace('r.row_json','r.r1_failed_column'),values,callback);
      }
      return all.call(this,sql,values,callback);
    };
  },join(desktop,'package.json'));
  try{
    await taskFilter.selectOption('completed');
    await until(()=>app.evaluate(()=>Boolean(globalThis.r1UiRead.release)));
    await taskFilter.selectOption('ended');
    await page.getByTestId('pi-task-overview-row').first().waitFor();
    const shown=await page.getByTestId('pi-task-overview-row').first().getAttribute('data-task-id');
    assert(expectedTasks(data).find(task=>task.id===shown)?.state==='ended');
    await app.evaluate(()=>globalThis.r1UiRead.release());
    await page.waitForFunction(id=>document.querySelector('[data-testid="pi-task-overview-row"]')?.getAttribute('data-task-id')===id,shown);
    await app.evaluate(()=>{globalThis.r1UiRead.fail=true;});
    await page.getByTestId('pi-task-overview-refresh').click();
    await page.getByRole('alert').filter({hasText:'本地索引暂不可用'}).waitFor();
    assert.equal(await page.getByTestId('pi-task-overview-empty').count(),0);
    assert.equal(await page.getByTestId('pi-workbench-action-notice').count(),0);
    await page.getByTestId('pi-task-overview-refresh').click();
    await page.getByTestId('pi-task-overview-row').first().waitFor();
    assert.equal(await page.getByTestId('pi-task-overview-row').first().getAttribute('data-task-id'),shown);
  }finally{await app.evaluate(()=>globalThis.r1UiRead.restore());}
  check('A native read held across filter changes cannot overwrite the newer result. Actual SQL failure renders an error; retry recovers.');
  await close();
  reportFixture();

  const targetLarge=join(root,'candidate-10000');
  cpSync(sourceLarge,targetLarge,{recursive:true});
  stage='10,000 task projection and SQL plans';
  const rebuildStart=performance.now();
  await launch(targetLarge,'large');
  await ready(targetLarge);
  report.initialBuildAndRebuildMs=performance.now()-rebuildStart;
  const cursorStart=performance.now(),walkedLarge=await walk(query,7500);
  report.cursorPreparationMs=performance.now()-cursorStart;
  assert.deepEqual(walkedLarge.received,expectedLarge.slice(0,7500).map(item=>item.id));
  const targetScenarios=[query,{...query,cursor:walkedLarge.after},{...query,filter:'completed'},scoped];
  const expectedSamples=[expectedLarge[0],expectedLarge[7500],expectedLarge.find(row=>row.state==='completed'),
    expectedLarge.find(row=>row.sessionId===scoped.sessionId)];
  report.warm={};
  await traceStart();
  for(const [index,name] of names.entries()){
    const samples=[];
    for(let iteration=0;iteration<50;iteration++){
      const result=await sample(targetScenarios[index]);
      assert.equal(result.first,expectedSamples[index].id);
      assert(result.scanned<=26);
      samples.push(result);
    }
    const elapsed=samples.map(value=>value.elapsedMs);
    report.warm[name]={samples,p95:p95(elapsed),max:Math.max(...elapsed)};
    console.log('warm '+name+' p95='+report.warm[name].p95);
  }
  const trace=await traceEnd();
  report.plan=plan(targetLarge,trace);
  report.eventLoop={samples:trace.eventLoop50Ms,p95:p95(trace.eventLoop50Ms),max:Math.max(...trace.eventLoop50Ms)};
  report.queryTrace=trace.statements.map(([sql,record])=>({sql,calls:record.calls}));
  assert(report.plan.every(record=>record.limit<=26 && record.plan.some(text=>/task_summary/u.test(text))));
  assert(!trace.statements.some(([sql])=>/SELECT rowid AS workbench_rowid|SELECT id,title FROM ai_conversation_sessions|xiaozhi_effects_v1/u.test(sql)));
  assert(Object.values(report.warm).every(sample=>sample.p95<=500));
  assert(report.eventLoop.p95<=100&&report.eventLoop.max<=500);
  await close();
  reportFixture();

  stage='five cold first requests';
  report.cold=[];
  for(let iteration=0;iteration<5;iteration++){
    await launch(targetLarge,'cold-'+iteration);
    await traceStart();
    const result=await sample();
    report.cold.push(result);
    const trace=await traceEnd();
    assert.equal(trace.statements.filter(([sql])=>sql.includes('r.row_json')).reduce((sum,[,row])=>sum+row.calls,0),1);
    assert.equal(result.matched,10000);
    assert(result.elapsedMs<=1500);
    await close();
  }
  check('All separate warm, cold and event-loop budgets pass with SQL LIMIT and matching plans.');
  reportFixture();

  stage='actual v0 comparison on the same facts';
  await launch(sourceLarge,'baseline-performance',legacy);
  const legacyScenarios=[query,{...query,cursor:baselineCursor(expectedLarge[7499])},targetScenarios[2],scoped];
  await traceStart();
  report.previous={};
  for(const [index,name] of names.entries()){
    report.previous[name]=await sample(legacyScenarios[index]);
    assert.equal(report.previous[name].first,expectedSamples[index].id);
    console.log('v0 '+name+' elapsed='+report.previous[name].elapsedMs);
  }
  const oldTrace=await traceEnd();
  report.previousQueryTrace=oldTrace.statements.map(([sql,record])=>({sql,calls:record.calls}));
  report.previousLoop=oldTrace.eventLoop50Ms;
  check('The actual frozen v0 baseline ran the identical four fixed queries and returned the same first identities.');
  await close();
  report.ok=true;
}catch(error){
  report.failedStage=stage;report.error=error.stack;
  console.error(error);process.exitCode=1;
  await page?.screenshot({path:join(root,'failure.png'),timeout:3000}).catch(()=>{});
}finally{
  await close().catch(()=>{});
  reportFixture();
  console.log(JSON.stringify({ok:report.ok,stage,checks:report.checks.length,fixture:basename(root),error:report.error}));
}
