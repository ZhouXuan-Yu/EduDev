import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, writeFileSync} from 'node:fs';
import {basename, join, relative, resolve} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {SessionManager} from '@earendil-works/pi-coding-agent';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {productEntry} from '../product-navigation.mjs';
import {addApproval,addTask} from './db-foundation-r1-task-fixture.mjs';

const desktop=resolve(import.meta.dirname,'../..');
const main=testMain(desktop);
const evidence=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||join(desktop,'test-results'));
mkdirSync(join(evidence,'fixtures'),{recursive:true});
const root=mkdtempSync(join(evidence,'fixtures','FX-05-backup-'));
const data=join(root,'data'),profile=join(root,'profile'),source=join(root,'source');
const exported=join(root,'exported'),restored=join(root,'restored');
for(const folder of [profile,source,exported,restored]) mkdirSync(folder,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={ok:false,sha:sha(readFileSync(main)),checks:[],errors:[]};
const check=(name,detail={})=>{report.checks.push({name,...detail});console.log('PASS '+name);};
let app,page,stage='seed native binding';

function dbAt(folder,writable,action) {
  const db=new DatabaseSync(join(folder,'app.db'),{readOnly:!writable});
  try{return action(db);}finally{db.close();}
}
const sql=(folder,statement,...values)=>dbAt(folder,false,db=>db.prepare(statement).all(...values));
async function until(test,limit=20000) {
  const end=performance.now()+limit;
  while(performance.now()<end){const value=await test();if(value)return value;await wait(25);}
  throw Error('Acceptance condition timed out: '+stage);
}
const result=(state)=>page.getByTestId('data-backup-'+state);
const directories=()=>readdirSync(exported,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
async function launch(previousPartial, restoreSource) {
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),
    OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_RESTORE_RELAUNCH:'manual',
    OMNI_EDU_E2E_DATA_BACKUP_EXPORT_DIALOG_QUEUE:JSON.stringify(Array(8).fill(exported)),
    OMNI_EDU_E2E_DATA_BACKUP_VERIFY_DIALOG_QUEUE:JSON.stringify(previousPartial?[previousPartial]:[]),
    OMNI_EDU_E2E_RESTORE_SOURCE_QUEUE:JSON.stringify(restoreSource?[restoreSource]:[]),
    OMNI_EDU_E2E_RESTORE_TARGET_QUEUE:JSON.stringify([restored]),DEEPSEEK_API_KEY:'',GLM_API_KEY:''};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL']) delete env[key];
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  page=await app.firstWindow({timeout:45000});
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.waitForFunction(()=>Boolean(window.omniEdu));
  await assertIsolatedPiMain(app,main,profile);
}
async function pick(file) {
  await app.evaluate(({dialog},file)=>{
    const original=dialog.showOpenDialog;
    dialog.showOpenDialog=async()=>{
      dialog.showOpenDialog=original;
      return {canceled:!file,filePaths:file?[file]:[]};
    };
  },file);
}
async function settings() {
  await productEntry(page,'settings').click();
  await page.getByTestId('pi-settings-tab-backup').click();
}
async function startBackup() {
  await result('export').click();
}
async function goodBackup() {
  await startBackup();
  await result('export-success').waitFor();
  return await result('export-path').innerText();
}
async function failingBackup() {
  const before=directories();
  await startBackup();
  await result('error').waitFor();
  assert.deepEqual(directories(),before);
  assert.equal(await result('export-success').count(),0);
}
async function hydratePause() {
  await app.evaluate((_,packageFile)=>{
    const require=process.getBuiltinModule('module').createRequire(packageFile);
    const prototype=require('sqlite3').Database.prototype;
    const original=prototype.run;
    const state={waiting:false,resume:null,restore:()=>{prototype.run=original;}};
    globalThis.r1ParseHold=state;
    prototype.run=function(statement,...args){
      if(!state.waiting && /^UPDATE teacher_resources SET parse_status=\?,parse_engine=\?,updated_at=\? WHERE id=\?/u.test(statement)){
        state.waiting=true;
        state.resume=()=>{state.resume=null;original.call(this,statement,...args);};
        return this;
      }
      return original.call(this,statement,...args);
    };
  },join(desktop,'package.json'));
}
async function addMaterial(name) {
  const file=join(source,name);
  writeFileSync(file,'# 合成备课资料\n这里保存本地解析用于一致备份的文字。\n','utf8');
  await productEntry(page,'materials').click();
  await pick(file);
  await page.getByTestId('materials-import').click();
  await until(()=>sql(data,'SELECT id FROM teacher_resources WHERE original_file_name=?',name).length>0);
}
async function releaseParse() {
  await app.evaluate(()=>{globalThis.r1ParseHold.resume?.();globalThis.r1ParseHold.restore();});
}
const dataManifest=folder=>JSON.parse(readFileSync(join(folder,'omni-edu-backup-manifest.v1.json'),'utf8'));

try{
  await launch();
  const session=await page.evaluate(()=>window.omniEdu.createAiConversationSession({title:'R1 合成原生会话'}));
  const nativeRoot=join(data,'xiaozhi-pi'),sessionRoot=join(nativeRoot,session.session.id,'sessions');
  mkdirSync(sessionRoot,{recursive:true});
  const manager=SessionManager.create(source, sessionRoot);
  manager.appendMessage({role:'user',content:'合成恢复证据',timestamp:Date.now()});
  manager.appendMessage({role:'assistant',content:[{type:'text',text:'已保存合成会话。'}],
    api:'openai-completions',provider:'deepseek',model:'deepseek-flash',
    usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},
    stopReason:'stop',timestamp:Date.now()});
  const nativeFile=manager.getSessionFile(), nativeId=manager.getSessionId();
  assert(existsSync(nativeFile));
  const {effect,approval,taskId}=dbAt(data,true,db=>{
    db.exec('PRAGMA busy_timeout=5000');
    db.prepare('INSERT INTO xiaozhi_pi_session_bindings(conversation_id,schema_version,session_file,model,updated_at) VALUES(?,1,?,?,?)')
      .run(session.session.id,relative(nativeRoot,nativeFile),'deepseek-flash',new Date().toISOString());
    const document=addTask(db,37,100);
    const approval=addApproval(db,document),taskId=document.view.id;
    return {effect:db.prepare('SELECT effect_id,state,revision,idempotency_key FROM xiaozhi_effects_v1 WHERE task_id=?').get(taskId),approval,taskId};
  });
  const material=join(source,'r1-attachment.txt');
  writeFileSync(material,'R1 attachment and output recovery fixture.','utf8');
  await pick(material);
  const attachmentInput={schemaVersion:'xiaozhi.attachments.v1',sessionId:session.session.id,requestId:'xiattach_'+randomUUID()};
  const attachment=await page.evaluate(input=>window.omniEdu.chooseXiaozhiAttachments(input),attachmentInput);
  assert.equal(attachment.ok,true,JSON.stringify(attachment));
  assert.equal(attachment.data.items.length,1,JSON.stringify(attachment.data.failures));
  const savedArtifact=await page.evaluate(input=>window.omniEdu.exportDocumentArtifact(input),{
    sessionId:session.session.id,title:'R1 合成恢复产物',type:'markdown',fileName:'r1-export.md',
    contentMd:'# 已保存产物',destinationRoot:join(data,'exports','r1'),
  });
  assert.equal(savedArtifact.status,'exported');
  const memory=await page.evaluate(()=>window.omniEdu.createAiMemoryEntry({
    surface:'chat',section:'R1 backup fixture',text:'合成备份记忆',refs:['ai_agent_run:airun_r1_37'],origin:'teacher',
  }));

  stage='live KB publisher holds a write transaction';
  await hydratePause();
  await addMaterial('r1-primary.txt');
  await until(()=>app.evaluate(()=>globalThis.r1ParseHold.waiting));
  await settings();
  const before=directories();
  await startBackup();
  await result('cancel-export').waitFor();
  await wait(200);
  assert.deepEqual(directories(),before,'No public snapshot may start while the true publisher holds the cut');
  await releaseParse();
  await result('export-success').waitFor();
  const full=await result('export-path').innerText();
  const readback=sql(full,'SELECT * FROM teacher_resources WHERE original_file_name=?','r1-primary.txt')[0];
  assert.equal(readback.parse_status,'ready');
  assert(sql(full,'SELECT id FROM resource_chunks WHERE resource_id=?',readback.id).length>0);
  const archived=readback.local_path;
  const saved=join(full,relative(data,archived));
  assert.equal(sha(readFileSync(saved)),readback.content_hash);
  const manifest=dataManifest(full);
  assert.equal(manifest.snapshotValidation.sessions,1);
  assert(manifest.snapshotValidation.files>=3);
  assert.equal(SessionManager.open(join(full,relative(data,nativeFile))).getSessionId(),nativeId);
  assert.equal(sql(full,'PRAGMA integrity_check')[0].integrity_check,'ok');
  assert.deepEqual(sql(full,'PRAGMA foreign_key_check'),[]);
  check('Actual KB writer drains before snapshot; archived original, indexed text, native JSONL and database share the published cut.',
    {manifestSources:manifest.snapshotValidation, files:manifest.fileCount});

  stage='mount loss of an authoritative original';
  const removed=archived+'.fixture-held';
  renameSync(archived,removed);
  try{await failingBackup();}finally{renameSync(removed,archived);}
  check('A missing file referenced by the database prevents a verified publication.');

  stage='mutate actual data-root file during streaming copy';
  const original=readFileSync(archived);
  await app.evaluate((_,target)=>{
    const fs=process.getBuiltinModule('fs'), modules=process.getBuiltinModule('module');
    const original=fs.createReadStream;
    let opened=0;
    globalThis.r1BackupStream={get hit(){return opened>=2;},restore:()=>{fs.createReadStream=original;modules.syncBuiltinESMExports();}};
    fs.createReadStream=function(file,...arguments_){
      if(String(file)===target && ++opened===2)fs.appendFileSync(target,'\nchanged during copy');
      return original.call(this,file,...arguments_);
    };
    modules.syncBuiltinESMExports();
  },archived);
  try {
    await failingBackup();
    assert(await app.evaluate(()=>globalThis.r1BackupStream.hit));
  } finally {
    await app.evaluate(()=>globalThis.r1BackupStream.restore());
    writeFileSync(archived,original);
  }
  check('Mutating a copied original under the cut invalidates the staged package and keeps prior backups intact.');

  stage='inject disk capacity failure at publication';
  await app.evaluate(()=>{
    const fs=process.getBuiltinModule('fs/promises'),original=fs.rename;
    globalThis.r1BackupRename={hit:false,restore:()=>{fs.rename=original;}};
    fs.rename=async(from,to)=>{
      if(!String(from).includes('.xiaozhi-backup-partial-'))return original(from,to);
      globalThis.r1BackupRename.hit=true;
      throw Object.assign(Error('R1 injected destination full'),{code:'ENOSPC'});
    };
  });
  try{await failingBackup();assert(await app.evaluate(()=>globalThis.r1BackupRename.hit));}
  finally {await app.evaluate(()=>globalThis.r1BackupRename.restore());}
  check('Injected ENOSPC at atomic publication fails visibly and leaves no success directory.',{enospc:'injected'});

  stage='cancel while independently published KB work is in flight';
  await hydratePause();
  await addMaterial('r1-queued.txt');
  await until(()=>app.evaluate(()=>globalThis.r1ParseHold.waiting));
  await settings();
  const cancelBefore=directories();
  await startBackup();
  await result('cancel-export').click();
  await result('cancelled').waitFor();
  assert.deepEqual(directories(),cancelBefore);
  await releaseParse();
  await until(()=>sql(data,"SELECT parse_status FROM teacher_resources WHERE original_file_name='r1-queued.txt'")[0]?.parse_status==='ready');
  const final=await goodBackup();
  assert(sql(final,'SELECT id FROM teacher_resources').length>=2);
  check('The cancellation button aborts the real waiting export, releases the gate and allows subsequent work and backup.');

  stage='forced process exit with staged snapshot';
  await app.evaluate(({app})=>{
    const fs=process.getBuiltinModule('fs/promises'),original=fs.mkdtemp;
    fs.mkdtemp=async(prefix,...args)=>{
      const staged=await original.call(fs,prefix,...args);
      if(String(prefix).includes('.xiaozhi-backup-partial-'))app.exit(33);
      return staged;
    };
  });
  const owned=app.process();
  await startBackup().catch(error=>{if(owned.exitCode===null && !page.isClosed())throw error;});
  await until(()=>owned.exitCode!==null);
  assert.equal(owned.exitCode,33);
  const partial=directories().find(name=>name.startsWith('.xiaozhi-backup-partial-'));
  assert(partial);
  assert(!existsSync(join(exported,partial,'omni-edu-backup-manifest.v1.json')));
  await launch(join(exported,partial),final);
  await settings();
  await result('verify').click();
  await result('verify-failed').waitFor();
  await goodBackup();
  check('Real process exit leaves only an unusable partial directory. A cold restart rejects it and can publish again.');

  stage='prepared recovery and independent cold read';
  await result('restore').click();
  await result('restore-prepare').click();
  await result('restore-ready').waitFor();
  const folder=await result('restore-ready').locator('.pi-settings-location').innerText();
  assert(!relative(restored,folder).startsWith('..'));
  assert.equal(sql(folder,'PRAGMA integrity_check')[0].integrity_check,'ok');
  assert.deepEqual(sql(folder,'PRAGMA foreign_key_check'),[]);
  assert.equal(sql(folder,'SELECT count(*) AS n FROM teacher_resources')[0].n,2);
  await result('restore-activate').click();
  const selection=join(profile,'xiaozhi-data-selection.v1.json');
  await until(()=>existsSync(selection) && JSON.parse(readFileSync(selection,'utf8')).dataRoot===folder);
  await app.close();
  await launch();
  assert.equal(await page.evaluate(()=>window.omniEdu.getDataRoot()),folder);
  const binding=sql(folder,'SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',session.session.id)[0];
  assert.equal(SessionManager.open(join(folder,'xiaozhi-pi',binding.session_file)).getSessionId(),nativeId);
  assert.equal(sql(data,'SELECT count(*) AS n FROM teacher_resources')[0].n,2);
  assert.deepEqual(sql(folder,'SELECT effect_id,state,revision,idempotency_key FROM xiaozhi_effects_v1 WHERE effect_id=?',effect.effect_id),[effect]);
  assert.equal(sql(folder,'SELECT status FROM ai_confirmation_items WHERE id=?',approval)[0].status,'pending');
  assert.equal(sql(folder,'SELECT text FROM ai_memory_entries WHERE id=?',memory.id)[0].text,'合成备份记忆');
  assert.equal(sql(folder,'SELECT value_json FROM app_settings WHERE key=?','xiaozhi.task.v1:'+taskId).length,1);
  const copied=sql(folder,'SELECT relative_path,original_sha256 FROM xiaozhi_pi_attachment_imports WHERE conversation_id=?',session.session.id)[0];
  assert.equal(sha(readFileSync(join(folder,'xiaozhi-pi','attachments',session.session.id,copied.relative_path))),copied.original_sha256);
  const located=sql(folder,'SELECT file_path,content_hash FROM document_artifacts WHERE id=?',savedArtifact.id)[0];
  assert(!relative(folder,located.file_path).startsWith('..'));
  assert.equal(sha(readFileSync(located.file_path)),located.content_hash);
  assert(!existsSync(join(folder,'r1-test.txt')));
  check('Verified full recovery is prepared in a new root; cold application resolves the restored binding, retains original data and does not replay the historical effect.');
  assert.deepEqual(report.errors,[]);
  report.ok=true;
}catch(error){
  report.failedStage=stage;
  report.error=error.stack;
  console.error(error);
  process.exitCode=1;
  await page?.screenshot({path:join(root,'failure.png')}).catch(()=>{});
}finally{
  await app?.evaluate(()=>{globalThis.r1ParseHold?.resume?.();globalThis.r1ParseHold?.restore();}).catch(()=>{});
  await app?.close().catch(()=>{});
  writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.ok,stage,checks:report.checks.length,fixture:basename(root),error:report.error}));
}
