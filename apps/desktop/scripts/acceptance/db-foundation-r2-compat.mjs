import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {withSql} from './db-foundation-r1-task-fixture.mjs';

const desktop=resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const evidence=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||join(desktop,'test-results'));
mkdirSync(join(evidence,'fixtures'),{recursive:true});
const root=mkdtempSync(join(evidence,'fixtures','R2-compat-'));
const data=join(root,'data'),profile=join(root,'profile');
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const report={root,build:hash(main),test:hash(import.meta.filename),checks:[]};
let app,page,student,session;
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),
  OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:'',GLM_API_KEY:''};
for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
async function launch(){
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  page=await app.firstWindow();
  await assertIsolatedPiMain(app,main,profile);
}
async function waitFor(callback){
  const deadline=performance.now()+10000;
  while(performance.now()<deadline){const value=await callback();if(value)return value;await wait(25);}
  assert.fail('Transaction fixture did not reach the intended native callback');
}
const confirm=id=>page.evaluate(async id=>{
  try{return {ok:true,value:await window.omniEdu.confirmAiConfirmation(id)};}
  catch(error){return {ok:false,error:String(error)};}
},id);
const sql=(query,...params)=>withSql(data,false,db=>db.prepare(query).all(...params));
function seed(id,action){
  const timestamp='2026-11-25T00:00:00.000Z',run='run_compat_'+id;
  const payload={studentId:student.id,title:id,contentMd:'# '+id+'\n合成教学内容。',
    startDate:'2026-10-01',endDate:'2026-11-25',sourceRecordIds:[]};
  withSql(data,true,db=>{
    db.prepare("INSERT INTO ai_agent_runs(id,session_id,prompt,route,status,created_at,updated_at) VALUES(?,?,'fixture','office','succeeded',?,?)")
      .run(run,session,timestamp,timestamp);
    db.prepare(`INSERT INTO ai_confirmation_items(id,run_id,session_id,student_id,action_type,status,title,payload_json,created_at,updated_at)
      VALUES(?,?,?,?,?,'pending',?,?,?,?)`).run(id,run,session,student.id,action,id,JSON.stringify(payload),timestamp,timestamp);
  });
}

try{
  await launch();
  [student]=await page.evaluate(()=>window.omniEdu.createStudent({displayName:'R2 事务夹具'}));
  session=await page.evaluate(async()=> (await window.omniEdu.createAiConversationSession({title:'R2 兼容夹具'})).session.id);
  for(const [id,action] of [['exercise-fault','save_exercise_set'],['exercise-valid','save_exercise_set'],
    ['report-file','create_review_report'],['report-body','create_review_report'],
    ['report-commit','create_review_report'],['report-valid','create_review_report']])seed(id,action);
  await app.evaluate((_,requirePath)=>{
    const module=process.getBuiltinModule('module'),fs=process.getBuiltinModule('fs');
    const db=module.createRequire(requirePath)('sqlite3').Database.prototype;
    const base={run:db.run,exec:db.exec,write:fs.writeFileSync,open:fs.openSync};
    const state=globalThis.r2Compat={mode:'exercise',hit:[],identities:new Map(),release:null};
    const identity=connection=>{
      if(!state.identities.has(connection))state.identities.set(connection,state.identities.size+1);
      return state.identities.get(connection);
    };
    const reportConnections=new WeakSet();
    db.run=function(statement,params,callback){
      const connection=identity(this);
      if(statement.includes('INSERT INTO exercise_sets'))state.hit.push({case:'exercise insert',connection});
      if(state.mode==='exercise' && /UPDATE ai_confirmation_items\s+SET status = 'confirmed'/u.test(statement)){
        state.hit.push({case:'exercise fault',connection});
        state.release=()=>base.run.call(this,'SELECT * FROM r2_fixture_missing_table',[],callback);
        return this;
      }
      if(statement.includes('INSERT INTO review_reports')){
        reportConnections.add(this);state.hit.push({case:'report insert',connection});
        if(state.mode==='report-body')return base.run.call(this,'SELECT * FROM r2_fixture_missing_table',[],callback);
      }
      if(statement.includes('INSERT INTO students'))state.hit.push({case:'unrelated student',connection});
      if(state.mode==='report-commit' && reportConnections.has(this) && /^COMMIT\s*;?$/u.test(statement)){
        state.hit.push({case:'report COMMIT',connection});
        state.release=()=>{state.release=null;base.run.call(this,'SELECT * FROM r2_fixture_missing_table',[],callback);};
        return this;
      }
      return base.run.call(this,statement,params,callback);
    };
    db.exec=function(statement,callback){
      if(state.mode==='report-commit' && reportConnections.has(this) && /^COMMIT\s*;?$/u.test(statement)){
        state.hit.push({case:'report COMMIT',connection:identity(this)});
        state.release=()=>{state.release=null;base.exec.call(this,'SELECT * FROM r2_fixture_missing_table',callback);};
        return this;
      }
      return base.exec.call(this,statement,callback);
    };
    const reportFds=new Set();
    const isReport=value=>typeof value==='string' && /[/\\]reports[/\\]report_[^/\\]+\.md$/u.test(value);
    fs.openSync=function(file,...args){
      const fd=base.open.call(this,file,...args);
      if(isReport(file))reportFds.add(fd);
      return fd;
    };
    fs.writeFileSync=function(file,...args){
      if(state.mode==='report-file' && (isReport(file)||reportFds.has(file))){
        base.write.call(this,file,'partial owned fixture',{encoding:'utf8'});
        state.hit.push({case:'report partially written'});
        throw Error('controlled report write failure');
      }
      return base.write.call(this,file,...args);
    };
    module.syncBuiltinESMExports();
  },join(desktop,'package.json'));
  const a=confirm('exercise-fault');
  await waitFor(()=>app.evaluate(()=>Boolean(globalThis.r2Compat.release)));
  const b=page.evaluate(()=>window.omniEdu.createStudent({displayName:'R2 独立并发学生'}));
  await waitFor(()=>app.evaluate(()=>globalThis.r2Compat.hit.some(event=>event.case==='unrelated student')));
  await app.evaluate(()=>globalThis.r2Compat.release());
  const [failed,[unrelated]]=await Promise.all([a,b]);
  assert.equal(failed.ok,false);
  const persisted=sql('SELECT display_name FROM students WHERE id=?',unrelated.id);
  assert.equal(persisted[0]?.display_name,'R2 独立并发学生','A rollback removed successful unrelated student B');
  assert.equal(sql('SELECT * FROM exercise_sets WHERE title=?','exercise-fault').length,0);
  assert.equal(sql('SELECT status FROM ai_confirmation_items WHERE id=?','exercise-fault')[0].status,'failed');
  const firstTrace=await app.evaluate(()=>globalThis.r2Compat.hit);
  assert.equal(firstTrace[0].connection,firstTrace[1].connection);
  assert.notEqual(firstTrace[0].connection,firstTrace[2].connection);
  report.checks.push({name:'Exercise failure does not roll back an unrelated successful IPC',trace:firstTrace});

  await app.evaluate(()=>{globalThis.r2Compat.mode='normal';});
  const [success,duplicate]=await Promise.all([confirm('exercise-valid'),confirm('exercise-valid')]);
  assert.equal(success.ok,true);assert.equal(duplicate.ok,false);
  assert.equal(sql('SELECT * FROM exercise_sets WHERE title=?','exercise-valid').length,1);
  const reportRoot=join(data,'students',student.id,'reports');
  mkdirSync(reportRoot,{recursive:true});
  writeFileSync(join(reportRoot,'neighbor.md'),'unrelated');
  for(const id of ['report-file','report-body','report-commit']){
    const updatedAt=sql('SELECT updated_at FROM students WHERE id=?',student.id)[0].updated_at;
    await app.evaluate((_,mode)=>{globalThis.r2Compat.mode=mode;globalThis.r2Compat.release=null;},id);
    const pending=confirm(id);
    if(id==='report-commit'){
      await waitFor(()=>app.evaluate(()=>Boolean(globalThis.r2Compat.release)));
      const second=page.evaluate(()=>window.omniEdu.createStudent({displayName:'R2 报告并发写入'}));
      await waitFor(()=>app.evaluate(()=>globalThis.r2Compat.hit.filter(event=>event.case==='unrelated student').length===2));
      await app.evaluate(()=>{globalThis.r2Compat.release();});
      const [kept]=await second;
      assert.equal(sql('SELECT display_name FROM students WHERE id=?',kept.id)[0]?.display_name,'R2 报告并发写入');
    }
    const failed=await pending;
    assert.equal(failed.ok,false,JSON.stringify(failed));
    assert.deepEqual(readdirSync(reportRoot),['neighbor.md'],id+' left an owned partial report');
    assert.equal(sql('SELECT * FROM review_reports WHERE title=?',id).length,0);
    assert.equal(sql('SELECT updated_at FROM students WHERE id=?',student.id)[0].updated_at,updatedAt);
  }
  const trace=await app.evaluate(()=>{globalThis.r2Compat.mode='normal';return globalThis.r2Compat.hit;});
  assert(trace.some(event=>event.case==='report partially written'));
  assert(trace.some(event=>event.case==='report COMMIT'));
  const accepted=await confirm('report-valid');
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const result=accepted.value.readback.report;
  assert.equal(readFileSync(join(reportRoot,result.id+'.md'),'utf8'),result.contentMd);
  assert.equal((await confirm('report-valid')).ok,false);
  assert.equal(sql('SELECT * FROM review_reports WHERE title=?','report-valid').length,1);
  await app.close();app=undefined;
  await launch();
  assert((await page.evaluate(studentId=>window.omniEdu.listReports(studentId),student.id)).some(item=>item.id===result.id));
  assert(existsSync(join(reportRoot,result.id+'.md')));
  report.checks.push({name:'Report failures remove only their owned files, and success is readable after restart',trace,reportId:result.id});
  report.ok=true;
}catch(error){report.ok=false;report.error=error.stack;process.exitCode=1;}
finally{
  await app?.evaluate(()=>globalThis.r2Compat?.release?.()).catch(()=>{});
  await app?.close().catch(()=>{});
  writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
