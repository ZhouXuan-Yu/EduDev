import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {seed,withSql} from './db-foundation-r1-task-fixture.mjs';

const desktop = resolve(import.meta.dirname,'../..');
const main = testMain(desktop);
const evidence = resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT || join(desktop,'test-results'));
mkdirSync(join(evidence,'fixtures'),{recursive:true});
const root = mkdtempSync(join(evidence,'fixtures','R2-summary-faults-'));
const data = join(root,'data'), profile = join(root,'profile');
const sha = value => createHash('sha256').update(value).digest('hex');
const report = {root,build:sha(readFileSync(main)),test:sha(readFileSync(import.meta.filename)),checks:[]};
const query = {schemaVersion:1,kind:'tasks',filter:'all',limit:25};
const factHash = () => withSql(data,false,db=>sha(JSON.stringify([
  db.prepare("SELECT key,value_json FROM app_settings WHERE key GLOB 'xiaozhi.task.v1:*' ORDER BY key").all(),
  db.prepare('SELECT * FROM ai_confirmation_items ORDER BY id').all(),
  db.prepare('SELECT * FROM xiaozhi_effects_v1 ORDER BY effect_id').all(),
])));
let app, page;
const rendererErrors = [];
const call = input => page.evaluate(query => window.omniEdu.getXiaozhiWorkbenchSummary(query),input);
async function read(input=query){
  const result=await call(input);
  assert.equal(result.ok,true,JSON.stringify(result));
  return result.value;
}
async function until(action) {
  const deadline=performance.now()+30000;
  while(performance.now()<deadline){const value=await action();if(value)return value;await wait(35);}
  assert.fail('Projection did not become ready in 30 seconds');
}
function partial(result,source) {
  assert.equal(result.partial,true,`Expected partial ${source}: ${JSON.stringify({total:result.total,failures:result.sourceFailures,first:result.items[0]})}`);
  for(const key of ['total','matched','counts','nextCursor'])assert.equal(result[key],null,key);
  assert(result.sourceFailures.some(value=>value.source===source && value.code==='corrupt'));
}

try {
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),
    OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:'',GLM_API_KEY:''};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  page=await app.firstWindow();
  page.on('pageerror',error=>rendererErrors.push(String(error)));
  report.runtime=await app.evaluate(()=>({electron:process.versions.electron,node:process.versions.node,arch:process.arch}));
  await assertIsolatedPiMain(app,main,profile);
  seed(data,80,8);
  const initial=await until(async()=>{const value=await read();return !value.partial && value.total===80 && value;});
  const target=(await read({...query,filter:'overview'})).items[0],scope={...query,sessionId:target.sessionId,taskId:target.taskId};
  const hash=factHash();
  await app.evaluate((_,requirePath)=>{
    const db=process.getBuiltinModule('module').createRequire(requirePath)('sqlite3').Database.prototype;
    const all=db.all;
    const gate=globalThis.r2Summary={hold:false,resume:null,restore:()=>{db.all=all;}};
    db.all=function(statement,params,callback){
      if(gate.hold && statement.startsWith('SELECT id FROM xiaozhi_task_summary_control WHERE')){
        gate.resume=()=>{gate.hold=false;gate.resume=null;all.call(this,statement,params,callback);};
        return this;
      }
      return all.call(this,statement,params,callback);
    };
  },join(desktop,'package.json'));
  for(const [name,replacement] of [
    ['empty object','{}'],
    ['state mismatch',JSON.stringify({...target,state:target.state==='ended'?'completed':'ended'})],
    ['revision mismatch',JSON.stringify({...target,revision:target.revision+1})],
    ['invalid JSON','{'],
  ]){
    await app.evaluate(()=>{globalThis.r2Summary.hold=true;});
    await until(()=>app.evaluate(()=>Boolean(globalThis.r2Summary.resume)));
    withSql(data,true,db=>{
      db.exec('PRAGMA ignore_check_constraints=ON');
      assert.equal(db.prepare('UPDATE xiaozhi_task_summary_rows SET row_json=? WHERE task_id=?').run(replacement,target.taskId).changes,1);
    });
    report.activeProbe=name;
    const result=await read(scope);
    partial(result,'tasks');
    assert(!result.items.some(item=>item.taskId===target.taskId));
    assert(withSql(data,false,db=>db.prepare('SELECT 1 FROM xiaozhi_task_summary_dirty WHERE task_id=?').get(target.taskId)));
    if(name==='empty object'){
      await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-my_tasks').click();
      await page.getByTestId('pi-task-partial').waitFor();
      assert.equal(await page.getByTestId('pi-task-overview-empty').count(),0);
      await page.screenshot({path:join(root,'partial-summary.png')});
    }
    await app.evaluate(()=>{globalThis.r2Summary.resume();});
    const recovered=await until(async()=>{const value=await read(scope);return !value.partial && value;});
    assert.deepEqual(recovered.items,[target]);
    assert.equal(factHash(),hash);
    report.checks.push({name,partial:result,recovered:recovered.items[0]});
  }
  await app.evaluate(()=>globalThis.r2Summary.restore());
  const stable=await read();
  assert(stable.nextCursor);
  withSql(data,true,db=>assert.equal(db.prepare('UPDATE ai_conversation_sessions SET title=? WHERE id=?')
    .run(Buffer.from([1,2,3]),target.sessionId).changes,1));
  report.activeProbe='session title BLOB';
  const global=await read(),scoped=await read(scope);
  partial(global,'sessions');partial(scoped,'sessions');
  assert.deepEqual(await call({...query,cursor:stable.nextCursor}),{ok:false,error:'changed'});
  await page.reload();
  await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-my_tasks').click();
  await page.getByTestId('pi-task-partial').waitFor();
  assert.match(await page.getByTestId('pi-task-counts').innerText(),/未完整核对/u);
  assert.equal(await page.getByTestId('pi-task-overview-empty').count(),0);
  await page.screenshot({path:join(root,'partial-session.png')});
  withSql(data,true,db=>db.prepare('UPDATE ai_conversation_sessions SET title=? WHERE id=?').run('R2 合成标题',target.sessionId));
  const restored=await read(scope);
  assert.equal(restored.partial,false);
  assert.equal(restored.items[0].sessionTitle,'R2 合成标题');
  const beforeArchive=await read();
  assert.equal(beforeArchive.total,80);
  withSql(data,true,db=>db.prepare('UPDATE ai_conversation_sessions SET archived_at=? WHERE id=?').run(new Date().toISOString(),target.sessionId));
  assert.deepEqual(await call(scope),{ok:false,error:'permission_denied'});
  assert.deepEqual(await call({...query,cursor:beforeArchive.nextCursor}),{ok:false,error:'changed'});
  assert(!(await read()).items.some(item=>item.sessionId===target.sessionId));
  assert.equal(factHash(),hash);
  assert.deepEqual(rendererErrors,[]);
  report.checks.push({name:'Session BLOB gives partial for global and scoped reads, then title and archive restore ordinary visibility rules',
    global:{failures:global.sourceFailures,counts:global.counts},scoped,restored:restored.items[0],authoritySha256:hash});
  report.ok=true;
} catch(error) {
  report.ok=false;report.error=error.stack;process.exitCode=1;
  await page?.screenshot({path:join(root,'failure.png')}).catch(()=>{});
} finally {
  await app?.evaluate(()=>globalThis.r2Summary?.resume?.()).catch(()=>{});
  await app?.close();
  writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
