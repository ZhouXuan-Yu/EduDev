import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {build} from 'esbuild';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {withSql} from './db-foundation-r1-task-fixture.mjs';

const desktop=resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const evidence=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||join(desktop,'test-results'));
mkdirSync(join(evidence,'fixtures'),{recursive:true});
const root=mkdtempSync(join(evidence,'fixtures','R2-prepared-'));
const data=join(root,'data'),profile=join(root,'profile');
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const report={root,build:hash(main),test:hash(import.meta.filename),checks:[]};
let app,page;
const secret='R2-synthetic-provider-key';
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),
  OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:secret,GLM_API_KEY:'',DEEPSEEK_MODEL:'deepseek-flash'};
for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];

async function launch(activeData=data,activeProfile=profile){
  app=await electron.launch({args:[main,'--user-data-dir='+activeProfile],cwd:desktop,
    env:{...env,OMNI_EDU_DATA_ROOT:activeData},timeout:60000});
  app.process().stderr?.on('data',chunk=>{
    const log=String(chunk);
    if(log.includes('[xiaozhi-'))(report.hostDiagnostics??=[]).push(log);
  });
  await app.evaluate(({net},{database,requirePath})=>{
    const sqlite=process.getBuiltinModule('module').createRequire(requirePath)('sqlite3');
    const native=sqlite.Database.prototype;
    const run=native.run;
    const fixture=globalThis.r2Prepared={requests:[],faults:0,rejectWrite:false};
    native.run=function(statement,...args){
      if(fixture.rejectWrite && /^INSERT INTO xiaozhi_prepared_runs_v1/u.test(statement)){
        fixture.faults++;
        return run.call(this,statement.replace('xiaozhi_prepared_runs_v1','r2_controlled_missing_table'),...args);
      }
      return run.call(this,statement,...args);
    };
    net.fetch=async(input,options)=>{
      const url=String(typeof input==='string'?input:input.url);
      if(url.endsWith('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',
        context_window:1048576,max_output_tokens:32768,effort:{supported_levels:['low','high','max'],default_level:'high'}}]}),
        {headers:{'content-type':'application/json'}});
      if(!url.endsWith('/chat/completions'))throw Error('Unexpected provider fixture request');
      const body=JSON.parse(options.body);
      const db=await new Promise((resolve,reject)=>{
        const connection=new sqlite.Database(database,sqlite.OPEN_READONLY,error=>error?reject(error):resolve(connection));
      });
      const get=(query,values=[])=>new Promise((resolve,reject)=>db.get(query,values,(error,row)=>error?reject(error):resolve(row)));
      try{
        const current=await get("SELECT id,model FROM ai_agent_runs WHERE status='running' ORDER BY created_at DESC LIMIT 1");
        const exists=await get("SELECT 1 FROM sqlite_schema WHERE name='xiaozhi_prepared_runs_v1'");
        const receipt=exists&&await get('SELECT * FROM xiaozhi_prepared_runs_v1 WHERE run_id=?',[current.id]);
        const native=await get('SELECT generation FROM xiaozhi_native_run_bindings WHERE run_id=?',[current.id]);
        fixture.requests.push({hostRunId:current.id,receipt:receipt?JSON.parse(receipt.payload_json):null,
          requestedModel:body.model,hostModel:current.model,nativeGeneration:native?.generation});
      }finally{await new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve()));}
      const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'r2-local-usage',object:'chat.completion.chunk',created:0,
        model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
      return new Response(chunk({role:'assistant',content:''})+chunk({content:'合成教学回答。'})+chunk({},'stop')+'data: [DONE]\n\n',
        {headers:{'content-type':'text/event-stream'}});
    };
  },{database:join(activeData,'app.db'),requirePath:join(desktop,'package.json')});
  page=await app.firstWindow();
  await assertIsolatedPiMain(app,main,activeProfile);
}

const requests=()=>app.evaluate(()=>globalThis.r2Prepared.requests);
const receipt=id=>withSql(data,false,db=>db.prepare('SELECT * FROM xiaozhi_prepared_runs_v1 WHERE run_id=?').get(id));
const runFor=prompt=>withSql(data,false,db=>db.prepare('SELECT id,session_id,status,model FROM ai_agent_runs WHERE prompt=?').get(prompt));
async function until(predicate,timeout=60000) {
  const deadline=performance.now()+timeout;
  while(performance.now()<deadline){const value=await predicate();if(value)return value;await wait(40);}
  assert.fail('Prepared fixture timed out waiting for run settlement');
}
async function send(prompt){
  const input=page.getByTestId('office-prompt-input');
  await until(async()=>await input.isVisible() && !await input.isDisabled());
  await input.fill(prompt);
  await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const settled=await until(()=>{const row=runFor(prompt);return row && row.status!=='running' && row;});
  await until(()=>page.evaluate(async sessionId=>{
    const settings=await window.omniEdu.getXiaozhiSettings({sessionId});
    return settings.ok && !settings.value.locked;
  },settled.session_id));
  return settled;
}
const config=(sessionId,runId)=>page.evaluate(input=>window.omniEdu.getXiaozhiResolvedAgentConfig(input),
  {sessionId,...(runId?{runId}:{})});

async function runModelMatrix(){
  const matrixData=join(root,'model-matrix-data');
  await launch(matrixData,join(root,'model-matrix-profile'));
  const stored=(key,value)=>withSql(matrixData,true,db=>{
    if(value===null)return db.prepare('DELETE FROM app_settings WHERE key=?').run(key);
    return db.prepare(`INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`)
      .run(key,JSON.stringify(value),'2026-11-25T00:00:00.000Z');
  });
  const newSession=title=>page.evaluate(async title=>(await window.omniEdu.createAiConversationSession({title})).session.id,title);
  async function prepare(scope,settings){
    const pending=await config(scope);
    assert.equal(pending.ok,true,JSON.stringify(pending));
    assert.deepEqual(pending.value.model,settings);
    const prompt='合成基础问候 '+randomUUID();
    const started=await page.evaluate(input=>window.omniEdu.startXiaozhi(input),{sessionId:scope,commandId:'xicmd_'+randomUUID(),prompt});
    assert.equal(started.ok,true,JSON.stringify(started));
    const row=await until(()=>withSql(matrixData,false,db=>db.prepare("SELECT id,model,status FROM ai_agent_runs WHERE prompt=? AND status<>'running'").get(prompt)));
    await until(()=>page.evaluate(async id=>{
      const result=await window.omniEdu.getXiaozhiSettings({sessionId:id});
      return result.ok && !result.value.locked;
    },scope));
    assert.equal(row.status,'succeeded',JSON.stringify(row));
    const observed=(await config(scope,row.id)).value.prepared;
    assert.equal(observed.status,'prepared');
    const {modelValue,model}=observed.receipt;
    assert.deepEqual({value:modelValue,...model},settings);
    assert.equal(row.model,modelValue);
    assert.equal((await requests()).find(item=>item.hostRunId===row.id)?.requestedModel,modelValue);
    return {scope,runId:row.id,diagnostic:pending.value.model,prepared:{value:modelValue,...model}};
  }
  const expected=(source,revision=null)=>({source,revision,value:'deepseek-flash',status:'valid'});
  const matrix=[];
  await app.evaluate(()=>{process.env.DEEPSEEK_MODEL='';});
  matrix.push(await prepare(await newSession('内置模型来源'),expected('default')));
  await app.evaluate(()=>{process.env.DEEPSEEK_MODEL='deepseek-flash';});
  matrix.push(await prepare(await newSession('启动环境模型来源'),expected('environment')));
  await app.evaluate(()=>{process.env.DEEPSEEK_MODEL='unused-synthetic-environment-model';});
  stored('deepseek',{model:'deepseek-flash'});
  matrix.push(await prepare(await newSession('旧模型来源'),expected('legacy_compat','2026-11-25T00:00:00.000Z')));
  stored('xiaozhi.provider.v1',{schema:1,revision:7,defaultModel:'deepseek-flash'});
  matrix.push(await prepare(await newSession('全局模型来源'),expected('global',7)));
  const selected=await newSession('会话选择与绑定来源');
  stored('xiaozhi.model.'+selected,{schema:1,revision:5,model:'deepseek-flash'});
  matrix.push(await prepare(selected,expected('session_selection',5)));
  matrix.push(await prepare(selected,expected('session_binding')));
  stored('xiaozhi.provider.v1',null);
  stored('deepseek',null);
  await app.evaluate(()=>{process.env.DEEPSEEK_API_KEY='';});
  const envOnly=await newSession('无凭据环境边界');
  assert.deepEqual((await config(envOnly)).value.model,expected('default'));
  const noCredential=await page.evaluate(input=>window.omniEdu.startXiaozhi(input),{
    sessionId:envOnly,commandId:'xicmd_'+randomUUID(),prompt:'无凭据的合成边界检查'});
  assert.equal(noCredential.ok,true,JSON.stringify(noCredential));
  const auth=await until(()=>withSql(matrixData,false,db=>db.prepare("SELECT id,model,status FROM ai_agent_runs WHERE session_id=? AND status<>'running'").get(envOnly)));
  assert.deepEqual({model:auth.model,status:auth.status},{model:'deepseek-flash',status:'failed'});
  assert.equal((await config(envOnly,auth.id)).value.prepared.status,'not_recorded');
  assert(!(await requests()).some(item=>item.hostRunId===auth.id));
  report.checks.push({name:'Six model sources match the runtime, native provider and read-only configuration snapshot',matrix,
    environmentOnly:{model:auth.model,status:auth.status}});
}

async function checkReplay(input){
  const probe=join(root,'prepared-contract.cjs');
  await build({entryPoints:[join(desktop,'src/main/xiaozhi-agent/prepared-agent-config.ts')],outfile:probe,
    platform:'node',format:'cjs',bundle:true,logLevel:'silent'});
  const result=await app.evaluate(async(_,args)=>{
    const require=process.getBuiltinModule('module').createRequire(args.requirePath);
    const {savePreparedAgentConfig}=require(args.probe),sqlite=require('sqlite3');
    const db=await new Promise((resolve,reject)=>{
      const connection=new sqlite.Database(args.db,sqlite.OPEN_READWRITE,error=>error?reject(error):resolve(connection));
    });
    const exec=statement=>new Promise((resolve,reject)=>db.exec(statement,error=>error?reject(error):resolve()));
    const work={run:(sql,values)=>new Promise((resolve,reject)=>db.run(sql,values,error=>error?reject(error):resolve())),
      all:(sql,values)=>new Promise((resolve,reject)=>db.all(sql,values,(error,rows)=>error?reject(error):resolve(rows)))};
    const sql={...work,transaction:async action=>{
      await exec('BEGIN IMMEDIATE;');
      try{const value=await action(work);await exec('COMMIT;');return value;}
      catch(error){await exec('ROLLBACK;');throw error;}
    }};
    const current=()=>{};
    const read=()=>work.all('SELECT * FROM xiaozhi_prepared_runs_v1 WHERE run_id=?',[args.input.runId]);
    try{
      const before=await read();
      await savePreparedAgentConfig(sql,args.input,current);
      let conflict,oversize;
      try{await savePreparedAgentConfig(sql,{...args.input,receipt:{...args.input.receipt,operation:'compact'}},current);}
      catch(error){conflict=error.message;}
      try{await savePreparedAgentConfig(sql,{...args.input,receipt:{...args.input.receipt,extra:'a'.repeat(16385)}},current);}
      catch(error){oversize=error.message;}
      return {before,after:await read(),conflict,oversize};
    }finally{await new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve()));}
  },{requirePath:join(desktop,'package.json'),db:join(data,'app.db'),probe,input});
  assert.equal(result.conflict,'prepared_configuration_conflict');
  assert.equal(result.oversize,'prepared_configuration_invalid');
  assert.deepEqual(result.after,result.before);
  assert.equal(result.before.length,1);
  report.checks.push({name:'Native SQLite contract retries identical content, rejects conflict and keeps first capture time',
    sourceSha256:hash(join(desktop,'src/main/xiaozhi-agent/prepared-agent-config.ts')),probeSha256:hash(probe),
    result:{capturedAt:result.before[0].captured_at,conflict:result.conflict,oversize:result.oversize}});
}

try {
  await launch();
  const input=page.getByTestId('office-prompt-input');
  await input.waitFor();
  const before=await page.evaluate(()=>window.omniEdu.getXiaozhiResolvedAgentConfig());
  assert.equal(before.ok,true,JSON.stringify(before));
  const a=await send('你好，请简短回答');
  const sessionId=a.session_id;
  const [first]=await requests();
  assert(first,'Fixture must reach the actual Pi provider');
  assert(first.receipt,'Prepared configuration must already be committed when the first Pi request is dispatched');
  assert.equal(first.hostRunId,a.id);
  assert.equal(first.receipt.native.generation,first.nativeGeneration);
  assert.equal(first.requestedModel,first.hostModel);
  assert.equal(first.receipt.model.source,before.value.model.source);
  assert.equal(first.receipt.thinking.source,before.value.thinking.source);
  const original=JSON.stringify(receipt(a.id));
  const native=withSql(data,false,db=>JSON.parse(db.prepare('SELECT binding_json FROM xiaozhi_native_run_bindings WHERE run_id=?').get(a.id).binding_json));
  const entries=readFileSync(join(data,'xiaozhi-pi',native.file),'utf8').trimEnd().split('\n').map(line=>JSON.parse(line));
  const ownerIndex=entries.findIndex(entry=>entry.id===first.receipt.native.markerId);
  assert(ownerIndex>=0);
  const nativePolicy=entries.slice(ownerIndex+1).find(entry=>entry.customType==='xiaozhi.answer-policy.v1');
  assert(nativePolicy);
  assert.notEqual(nativePolicy.data.runId,a.id,'Internal Pi run ID differs from host owner');
  assert.equal(nativePolicy.data.requested,first.receipt.thinking.requested);
  assert.doesNotMatch(original,/R2-synthetic-provider-key|sealedKey|apiKey|\.jsonl|sha256|你好/u);
  report.checks.push({name:'Prepared receipt commits before the provider call and links through the native owner',first,hostRunStatus:a.status});
  await checkReplay({sessionId,runId:a.id,receipt:first.receipt});

  const thinking=await page.evaluate(sessionId=>window.omniEdu.saveXiaozhiThinking({schemaVersion:'xiaozhi.settings.v1',sessionId,
    version:0,choice:'low'}),sessionId);
  assert.equal(thinking.ok,true,JSON.stringify(thinking));
  const b=await send('请简要打招呼');
  const historyA=await config(sessionId,a.id), historyB=await config(sessionId,b.id);
  assert.equal(historyA.value.prepared.status,'prepared');
  assert.equal(historyA.value.prepared.receipt.thinking.source,'default');
  assert.equal(historyB.value.prepared.receipt.thinking.source,'session_selection');
  assert.equal(historyB.value.prepared.receipt.thinking.requested,'low');
  assert.equal(historyB.value.prepared.receipt.model.source,'session_binding');
  assert.equal(JSON.stringify(receipt(a.id)),original);
  report.checks.push({name:'Current config and another host run do not mutate historical preparation',a:historyA.value.prepared,b:historyB.value.prepared});

  const learned=await send('以后请立即采用表格格式');
  const learning=(await config(sessionId,learned.id)).value.prepared.receipt.teacher;
  assert(learning.observedRevision>0 && learning.eventRecorded && learning.decisionId);
  assert.equal(learning.longTermApplied,false);
  const policy=await page.evaluate(async()=>{
    const settings=await window.omniEdu.getTeacherMemorySettings();
    if(!settings.ok)return settings;
    return window.omniEdu.saveTeacherMemorySettings({revision:settings.value.revision,profile:settings.value.profile,
      use:{...settings.value.use,presentation:'off'},preferenceRevision:settings.value.preference.revision});
  });
  assert.equal(policy.ok,true,JSON.stringify(policy));
  const afterPolicy=await send('你好，请简单打个招呼');
  const afterwards=(await config(sessionId,afterPolicy.id)).value.prepared.receipt.teacher;
  assert.equal(afterwards.observedRevision,learning.observedRevision);
  assert.equal(afterwards.policyRevision,policy.value.revision);
  assert.equal(afterwards.longTermApplied,false);
  assert(learning.policyRevision<afterwards.policyRevision);
  assert.deepEqual((await config(sessionId,learned.id)).value.prepared.receipt.teacher,learning);
  report.checks.push({name:'Observed teacher version, current policy revision and actual application are separate',learning,afterwards});

  const beforeFailure=(await requests()).length;
  await app.evaluate(()=>{globalThis.r2Prepared.rejectWrite=true;});
  const failure=await send('你好。');
  const faults=await app.evaluate(()=>globalThis.r2Prepared.faults);
  report.failureProbe={failure,faults,requestsBefore:beforeFailure,requestsAfter:(await requests()).length};
  assert.equal(faults,1,JSON.stringify(report.failureProbe));
  assert.equal(failure.status,'failed',JSON.stringify(report.failureProbe));
  assert.equal((await requests()).length,beforeFailure);
  assert.equal(receipt(failure.id),undefined);
  assert.equal((await config(sessionId,failure.id)).value.prepared.status,'not_recorded');
  assert(withSql(data,false,db=>db.prepare("SELECT 1 FROM ai_conversation_messages WHERE session_id=? AND role='user' AND json_extract(metadata_json,'$.agentRunId')=?")
    .get(sessionId,failure.id)));
  report.checks.push({name:'Write failure settles the admitted run and user message without dispatching a model request',run:failure.id});

  await app.close();app=undefined;
  await launch();
  assert.deepEqual((await config(sessionId,a.id)).value.prepared,historyA.value.prepared);
  assert.equal((await requests()).length,0);
  report.checks.push({name:'Cold start preserves the prepared run and does not replay requests'});

  await page.getByRole('button',{name:'设置',exact:true}).click();
  const tab=page.getByTestId('pi-settings-tab-diagnostics');
  if(!await tab.isVisible())await page.getByTestId('pi-settings-advanced-toggle').click();
  await tab.click();
  await page.getByTestId('pi-resolved-config').getByRole('button',{name:'当前配置来源'}).click();
  const card=page.getByTestId('pi-resolved-config-prepared');
  await card.waitFor();
  assert.match(await card.innerText(),/运行状态 失败/u);
  assert.match(await card.innerText(),/未记录/u);
  await page.screenshot({path:join(root,'prepared-missing-after-failure.png')});

  const backupRoot=join(root,'backups');
  mkdirSync(backupRoot);
  await app.evaluate(({dialog},folder)=>{
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});
  },backupRoot);
  const preparedCopies=[];
  for(const purpose of ['full','portable']){
    await app.evaluate(({dialog},folder)=>{
      dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});
    },backupRoot);
    const exported=await page.evaluate(purpose=>window.omniEdu.exportDataRoot(purpose),purpose);
    assert(exported?.verified,JSON.stringify(exported));
    const backupReceipt=withSql(exported.exportPath,false,db=>db.prepare('SELECT * FROM xiaozhi_prepared_runs_v1 WHERE run_id=?').get(a.id));
    assert.equal(JSON.stringify(backupReceipt),original);
    const nativeCopy=join(exported.exportPath,'xiaozhi-pi',native.file);
    assert.equal(hash(nativeCopy),hash(join(data,'xiaozhi-pi',native.file)));
    report.checks.push({name:purpose+' export preserves receipt and native owner reference',backup:exported.exportPath,
      databaseSha256:hash(join(exported.exportPath,'app.db')),nativeSha256:hash(nativeCopy)});
    await app.evaluate(({dialog},selection)=>{
      dialog.showOpenDialog=async options=>({canceled:false,filePaths:[options.title.includes('保存位置')?selection.destination:selection.source]});
    },{source:exported.exportPath,destination:join(root,'restored')});
    mkdirSync(join(root,'restored'),{recursive:true});
    const prepared=await page.evaluate(async()=>{
      const preview=await window.omniEdu.previewBackupRestore();
      return window.omniEdu.prepareBackupRestore(preview.id);
    });
    assert(prepared?.dataRoot);
    preparedCopies.push({...prepared,purpose});
  }
  for(const prepared of preparedCopies){
    await app.close();app=undefined;
    await launch(prepared.dataRoot,join(root,'cold-'+prepared.purpose));
    assert.deepEqual((await config(sessionId,a.id)).value.prepared,historyA.value.prepared);
    assert.equal((await requests()).length,0);
    report.checks.push({name:prepared.purpose+' restored copy reads the same historical preparation on a cold start',
      dataRoot:prepared.dataRoot,receiptId:prepared.id});
    if(prepared.purpose==='full'){
      const malformed=JSON.stringify({native:{generation:-1},authorization:{allow:true}});
      const facts=()=>withSql(prepared.dataRoot,false,db=>({
        prepared:db.prepare('SELECT payload_json FROM xiaozhi_prepared_runs_v1 WHERE run_id=?').get(a.id),
        run:db.prepare('SELECT status,model FROM ai_agent_runs WHERE id=?').get(a.id),
        grants:db.prepare('SELECT count(*) AS count FROM xiaozhi_permission_grants_v1 WHERE revoked=0').get(),
      }));
      withSql(prepared.dataRoot,true,db=>assert.equal(db.prepare('UPDATE xiaozhi_prepared_runs_v1 SET payload_json=? WHERE run_id=?').run(malformed,a.id).changes,1));
      const before=facts();
      const rejected=(await config(sessionId,a.id)).value.prepared;
      assert.deepEqual(rejected,{status:'invalid',runId:a.id,runStatus:before.run.status,receipt:null});
      assert.deepEqual(facts(),before);
      assert.equal((await requests()).length,0);
      report.checks.push({name:'The actual production reader rejects malformed historical authorization without changing the row, grants, or dispatching',
        runId:a.id,status:rejected.status,modelRequests:0});
    }
    withSql(prepared.dataRoot,true,db=>assert.equal(db.prepare('DELETE FROM xiaozhi_native_run_bindings WHERE run_id=?').run(a.id).changes,1));
    const missingBinding=(await config(sessionId,a.id)).value.prepared;
    assert.equal(missingBinding.status,'not_recorded');
    assert.equal(missingBinding.receipt,null);
    assert.equal(missingBinding.runId,a.id);
  }
  await app.close();app=undefined;
  await runModelMatrix();
  report.ok=true;
} catch(error){
  report.ok=false;report.error=error.stack;process.exitCode=1;
  await page?.screenshot({path:join(root,'failure.png'),timeout:3000}).catch(()=>{});
} finally{
  await app?.close().catch(()=>{});
  writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
