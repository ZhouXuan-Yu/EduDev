import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {withSql} from './db-foundation-r1-task-fixture.mjs';
import {productEntry} from '../product-navigation.mjs';

const desktop=resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const evidence=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||join(desktop,'test-results'));
mkdirSync(join(evidence,'fixtures'),{recursive:true});
const root=mkdtempSync(join(evidence,'fixtures','FX-08-config-'));
const data=join(root,'data'),profile=join(root,'profile');
const digest=value=>createHash('sha256').update(value).digest('hex');
const report={ok:false,main:digest(readFileSync(main)),checks:[]};
const stamp='2026-01-01T00:00:00.000Z';
const markers={legacy:'R1_SECRET_SYNTHETIC_LEGACY',wrapped:'R1_SECRET_SYNTHETIC_WRAPPED',
  memory:'R1_SYNTHETIC_MEMORY_BODY',path:'D:/R1-synthetic-private-workspace/session.jsonl',environment:'R1_SYNTHETIC_ENV_KEY'};
const check=(name,extra={})=>{report.checks.push({name,...extra});console.log('PASS '+name);};
let app,page,stage='launch';
function put(values) {
  withSql(data,true,db=>{
    db.exec('BEGIN IMMEDIATE');
    try{
      const set=db.prepare('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json');
      const remove=db.prepare('DELETE FROM app_settings WHERE key=?');
      for(const [key,value] of Object.entries(values)){
        if(value===null)remove.run(key);
        else set.run(key,JSON.stringify(value),stamp);
      }
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
  });
}
const restoredSettings=()=>withSql(data,false,db=>digest(JSON.stringify(db.prepare('SELECT * FROM app_settings ORDER BY key').all())));
const launch=async()=>{
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'',GLM_API_KEY:'',DEEPSEEK_MODEL:''};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  page=await app.firstWindow({timeout:45000});
  await page.waitForFunction(()=>Boolean(window.omniEdu));
  await assertIsolatedPiMain(app,main,profile);
};
const read=(input)=>page.evaluate(input=>window.omniEdu.getXiaozhiResolvedAgentConfig(input),input);
async function config(id){
  const result=await read(id?{sessionId:id}:undefined);
  assert.equal(result.ok,true,JSON.stringify(result));
  const payload=JSON.stringify(result);
  for(const marker of Object.values(markers))assert(!payload.includes(marker),'Protected fixture marker in diagnostic');
  assert(!/apiKey|sealedKey|fingerprint|sha256|payload_json|sessionFile/u.test(payload));
  return result.value;
}
async function diagnostics(){
  await productEntry(page,'settings').click();
  const tab=page.getByTestId('pi-settings-tab-diagnostics');
  if(!await tab.isVisible())await page.getByTestId('pi-settings-advanced-toggle').click();
  await tab.click();
  await page.getByTestId('pi-resolved-config').waitFor();
}
async function guards(){
  await app.evaluate(({safeStorage,net,ipcMain},file)=>{
    const db=process.getBuiltinModule('module').createRequire(file)('sqlite3').Database.prototype;
    const fs=process.getBuiltinModule('fs/promises');
    const {AsyncLocalStorage}=process.getBuiltinModule('async_hooks');
    const scope=new AsyncLocalStorage();
    const channel='xiaozhi:resolved-agent-config',handlers=ipcMain._invokeHandlers;
    const diagnostic=handlers.get(channel);
    if(typeof diagnostic!=='function')throw Error('Configured diagnostic handler was not registered');
    const raw={all:db.all,run:db.run,exec:db.exec,decrypt:safeStorage.decryptString,request:net.request,fetch:globalThis.fetch,read:fs.readFile};
    const counts={decrypt:0,writes:0,network:0,nativeFileReads:0};
    const state={counts,independentWrites:[],writeTargets:[],requests:0,hold:false,release:null};
    globalThis.r1Config=state;
    handlers.set(channel,(...args)=>{state.requests++;return scope.run(true,()=>diagnostic(...args));});
    safeStorage.decryptString=function(...args){if(scope.getStore())counts.decrypt++;return raw.decrypt.apply(this,args);};
    net.request=function(){
      if(scope.getStore())counts.network++;
      throw Error('network disabled in isolated R1 diagnostic fixture');
    };
    globalThis.fetch=async()=>{
      if(scope.getStore())counts.network++;
      throw Error('network disabled in isolated R1 diagnostic fixture');
    };
    fs.readFile=function(path,...args){if(scope.getStore()&&String(path).endsWith('.jsonl'))counts.nativeFileReads++;return raw.read.call(this,path,...args);};
    const changes=/^\s*(?:INSERT(?: OR \w+)? INTO|UPDATE|DELETE FROM|REPLACE INTO|ALTER TABLE|DROP TABLE|CREATE TABLE)\s+(\w+)/ui;
    function write(sql){
      const entry=changes.exec(sql);
      if(!entry)return;
      if(scope.getStore()){counts.writes++;state.writeTargets.push(entry[1]);}
      else state.independentWrites.push(entry[1]);
    }
    db.run=function(sql,...args){write(sql);return raw.run.call(this,sql,...args);};
    db.exec=function(sql,...args){write(sql);return raw.exec.call(this,sql,...args);};
    db.all=function(sql,params,callback){
      if(state.hold && scope.getStore() && typeof callback==='function' && sql==='SELECT value_json FROM app_settings WHERE key=?'
        && params?.[0]==='xiaozhi.provider.v1'){
        state.hold=false;
        state.release=()=>raw.all.call(this,sql,params,callback);
        return this;
      }
      return raw.all.call(this,sql,params,callback);
    };
    state.restore=()=>{
      handlers.set(channel,diagnostic);
      db.all=raw.all;db.run=raw.run;db.exec=raw.exec;
      safeStorage.decryptString=raw.decrypt;net.request=raw.request;globalThis.fetch=raw.fetch;fs.readFile=raw.read;
    };
  },join(desktop,'package.json'));
}
const counts=()=>app.evaluate(()=>globalThis.r1Config.counts);
const zero={decrypt:0,writes:0,network:0,nativeFileReads:0};
async function eventually(predicate){
  const end=performance.now()+4000;
  while(performance.now()<end){if(await predicate())return;await wait(25);}
  throw Error('Timed out: '+stage);
}
try{
  await launch();
  stage='global defaults without a session';
  await productEntry(page,'materials').click();
  withSql(data,true,db=>db.prepare('UPDATE ai_conversation_sessions SET archived_at=? WHERE archived_at IS NULL').run(stamp));
  await diagnostics();
  await guards();
  const section=page.getByTestId('pi-resolved-config');
  await section.getByRole('button',{name:'当前配置来源'}).click();
  await page.getByTestId('pi-resolved-config-table').waitFor();
  assert.match(await page.getByTestId('pi-resolved-config-session').innerText(),/全局视图/u);
  const initial=await config();
  assert.equal(initial.session,null);
  assert.deepEqual(initial.model,{value:'deepseek-flash',source:'default',revision:null,status:'valid'});
  assert.equal(initial.memory.status,'not_applicable');
  assert.equal(initial.permission.status,'not_applicable');
  assert.deepEqual(await counts(),zero);
  await app.evaluate(()=>globalThis.r1Config.restore());
  check('Visible disclosure works without a session and uses the global built-in default.');

  stage='read authoritative source hierarchy with independent scoping';
  const [first,second]=await page.evaluate(async()=>{
    const [one,two]=await Promise.all(['R1 配置来源会话','R1 其他会话'].map(title=>window.omniEdu.createAiConversationSession({title})));
    return [one.session.id,two.session.id];
  });
  await productEntry(page,'materials').click();
  await page.evaluate(id=>localStorage.setItem('xiaozhi.current-session.v1',id),first);
  await diagnostics();
  await guards();
  await app.evaluate((_,key)=>{process.env.DEEPSEEK_API_KEY=key;},markers.environment);
  assert.equal((await config()).credential.source,'environment');
  await app.evaluate(()=>{delete process.env.DEEPSEEK_API_KEY;});
  put({deepseek:{model:'legacy-model',apiKey:markers.legacy}});
  assert.equal((await config()).model.source,'legacy_compat');
  assert.equal((await config()).model.value,'legacy-model');
  put({'xiaozhi.provider.v1':{schema:1,revision:4,defaultModel:'global-r1',sealedKey:markers.wrapped},
    [`xiaozhi.model.${first}`]:{schema:1,revision:5,model:'selected-r1'},
    'xiaozhi.thinking.default':{schema:1,revision:3,choice:'high'},
    [`xiaozhi.thinking.${first}`]:{schema:1,revision:2,choice:'off'},
    [`xiaozhi.thinking-run.${first}`]:{schema:1,requested:'max',effective:'low',scope:'session',thinkingType:'enabled',
      effort:'low',mode:'fast',maxOutputTokens:9000,runId:'run_r1_previous',model:'old-run-model'},
    'xiaozhi.teacher-preference.v1:personal-policy':{schemaVersion:1,revision:7,
      profile:{subject:'数学',grade:'七年级',textbook:'合成教材'},use:{}}});
  const selected=await config(first);
  assert.deepEqual(selected.model,{value:'selected-r1',source:'session_selection',revision:5,status:'valid'});
  assert.deepEqual(selected.thinking,{value:'off',source:'session_selection',revision:2,status:'valid'});
  assert.equal((await config(second)).thinking.value,'high');
  assert.equal((await config(second)).model.value,'global-r1');
  assert.equal((await config()).model.value,'global-r1');
  withSql(data,true,db=>{
    db.prepare('INSERT INTO xiaozhi_pi_session_bindings(conversation_id,schema_version,session_file,model,updated_at) VALUES(?,1,?,?,?)')
      .run(first,markers.path,'bound-r1',stamp);
    db.prepare('INSERT INTO xiaozhi_pi_memory_scopes(conversation_id,version,payload_json,updated_at) VALUES(?,2,?,?)')
      .run(first,JSON.stringify({enabled:true,selections:[]}),stamp);
    db.prepare('INSERT INTO ai_conversation_messages(id,session_id,role,content,created_at) VALUES(?,?,?,?,?)')
      .run('r1_private_test_body',first,'user',markers.memory,stamp);
  });
  const bound=await config(first);
  assert.deepEqual(bound.model,{value:'bound-r1',source:'session_binding',revision:null,status:'valid'});
  assert.equal(bound.lastRun.value.model,'old-run-model');assert.equal(bound.lastRun.value.requested,'max');
  assert.equal(bound.lastRun.value.effective,'low');
  assert.deepEqual(bound.teacher.value,{subject:'数学',grade:'七年级',textbook:'合成教材'});
  assert.equal(bound.teacher.revision,7);
  assert.equal(bound.preferences.application,'requires_task_context');
  assert.equal(bound.preferences.temporary,'not_persisted');assert.equal(bound.preferences.textbook,'reference_only');
  assert.deepEqual(bound.memory.value,{enabled:true,selectedCount:0});
  assert.equal(bound.memory.revision,2);assert.equal(bound.permission.value,'request');
  assert.deepEqual(bound.credential,{value:true,source:'global',revision:4,status:'valid',verification:'not_checked'});
  check('Binding, selection, global and legacy precedence match existing settings. Thinking history, teacher policy, memory consent and permission have independent sources.');

  stage='read snapshot survives concurrent update';
  await app.evaluate(()=>{globalThis.r1Config.hold=true;});
  const pending=config(first);
  await eventually(()=>app.evaluate(()=>Boolean(globalThis.r1Config.release)));
  put({'xiaozhi.provider.v1':{schema:1,revision:5,defaultModel:'global-r1-new',sealedKey:markers.wrapped},
    [`xiaozhi.thinking.${first}`]:{schema:1,revision:3,choice:'low'}});
  await app.evaluate(()=>{globalThis.r1Config.release();globalThis.r1Config.release=null;});
  const old=await pending,after=await config(first);
  assert.equal(old.consistency,'snapshot');
  assert.equal(old.credential.revision,4);assert.equal(old.thinking.revision,2);
  assert.equal(after.credential.revision,5);assert.equal(after.thinking.revision,3);
  const businessBefore=restoredSettings();
  await section.getByRole('button',{name:'当前配置来源'}).click();
  await page.getByTestId('pi-resolved-config-table').waitFor();
  const title=await page.getByTestId('pi-resolved-config-session').innerText();
  assert.equal(title,'R1 配置来源会话');
  for(const width of [1366,1920]){
    await page.setViewportSize({width,height:width===1366?768:1080});
    const button=page.getByTestId('pi-resolved-config-refresh');
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await page.getByTestId('pi-resolved-config-table').waitFor();
    assert(await button.evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
    assert.match(await page.getByTestId('pi-resolved-config-last-run').innerText(),/old-run-model/u);
    await page.screenshot({path:join(root,'config-'+width+'.png')});
  }
  assert.equal(restoredSettings(),businessBefore);
  const targets=await app.evaluate(()=>({diagnosticWriteTargets:globalThis.r1Config.writeTargets,
    separateBackgroundWriteTargets:globalThis.r1Config.independentWrites,diagnosticRequests:globalThis.r1Config.requests}));
  assert.deepEqual(await counts(),zero,JSON.stringify(targets));
  check('One read-only SQLite snapshot survives concurrent edits. Real UI open and refresh in two viewports cause no settings write, codec open, network or native JSONL read.',{counters:await counts(),...targets});

  stage='corrupt and archived inputs are explicit';
  put({[`xiaozhi.thinking.${first}`]:{schema:1,revision:9,choice:'invalid-fixture'}});
  await page.getByTestId('pi-resolved-config-refresh').click();
  await page.getByRole('status').filter({hasText:'部分配置暂不可读'}).waitFor();
  assert.equal((await config(first)).thinking.status,'invalid');
  assert.deepEqual(await read({sessionId:'bad'}),{ok:false,error:'invalid_input'});
  withSql(data,true,db=>db.prepare('UPDATE ai_conversation_sessions SET archived_at=? WHERE id=?').run(stamp,first));
  assert.deepEqual(await read({sessionId:first}),{ok:false,error:'permission_denied'});
  assert.deepEqual(await counts(),zero);
  check('Malformed settings are visible without defaulting to a value. Invalid and archived scopes fail explicitly.');
  await app.evaluate(()=>globalThis.r1Config.restore());
  report.ok=true;
}catch(error){
  report.failedStage=stage;report.error=error.stack;
  console.error(error);process.exitCode=1;
  await page?.screenshot({path:join(root,'failure.png'),timeout:3000}).catch(()=>{});
}finally{
  await app?.evaluate(()=>globalThis.r1Config?.restore()).catch(()=>{});
  await app?.close().catch(()=>{});
  writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.ok,stage,checks:report.checks.length,fixture:basename(root),error:report.error}));
}
