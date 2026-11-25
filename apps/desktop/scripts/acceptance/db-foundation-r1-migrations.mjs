import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {basename, dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {backup, DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=resolve(import.meta.dirname,'../..');
const main=testMain(desktop);
const legacy=resolve(process.env.OMNI_EDU_DB_V0_BUILD || join(desktop,'test-results/xiaozhi-db-r1-baseline/out/main/index.js'));
const expectedVersion=5;
assert(existsSync(legacy),'The actual frozen WP-00 v0 build is required');
const evidence=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||join(desktop,'test-results'));
mkdirSync(join(evidence,'fixtures'),{recursive:true});
const root=mkdtempSync(join(evidence,'fixtures','FX-02-08-migrations-'));
const buildHash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const report={ok:false,legacyMain:buildHash(legacy),candidateMain:buildHash(main),checks:[]};
let stage='legacy fixture';

const dbPath=data=>join(data,'app.db');
function sql(data,readonly,action) {
  const db=new DatabaseSync(dbPath(data),{readOnly:readonly,enableForeignKeyConstraints:true});
  try {return action(db);} finally{db.close();}
}
function dataState(data) {
  return sql(data,true,db=>{
    const rows=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' ORDER BY type,name").all();
    const state={
      version:db.prepare('PRAGMA user_version').get().user_version,
      users:db.prepare('SELECT id FROM users ORDER BY id').all().map(item=>item.id),
      students:db.prepare('SELECT id,display_name FROM students ORDER BY id').all().map(item=>[item.id,item.display_name]),
      nativeLegacyMigration:db.prepare('SELECT name FROM retrieval_schema_migrations ORDER BY name').all().map(item=>item.name),
      schema:rows.map(item=>[item.type,item.name,item.tbl_name,item.sql]), foreignKeys:db.prepare('PRAGMA foreign_key_check').all(),
      integrity:db.prepare('PRAGMA integrity_check').get().integrity_check,
    };
    if(rows.some(row=>row.name==='xiaozhi_schema_migrations')){
      state.ledger=db.prepare('SELECT * FROM xiaozhi_schema_migrations ORDER BY to_version').all().map(row=>({...row}));
      state.baseline=db.prepare('SELECT * FROM xiaozhi_schema_baseline').all().map(row=>({...row}));
    }
    return state;
  });
}
function receipt(name,detail={}) {
  report.checks.push({name,...detail});
  console.log('PASS '+name);
}
function profile(name) {
  const folder=join(root,name,'profile');
  mkdirSync(folder,{recursive:true});
  return folder;
}
function environment(data) {
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),
    OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:'',GLM_API_KEY:'',OPENAI_API_KEY:''};
  for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL']) delete env[key];
  return env;
}
async function launch(build,data,chosenProfile,action=async()=>{}) {
  const app=await electron.launch({args:[build,'--user-data-dir='+chosenProfile],cwd:desktop,env:environment(data),timeout:60000});
  try{
    const page=await app.firstWindow({timeout:45000});
    await page.waitForFunction(()=>Boolean(window.omniEdu));
    await assertIsolatedPiMain(app,build,chosenProfile);
    assert.equal(await page.evaluate(()=>window.omniEdu.isXiaozhiEnabled()),true);
    await action(page);
  } finally{await app.close();}
}
async function startFailing(name,data,interrupt=0) {
  const folder=profile(name);
  const bootstrap=join(root,name,'failed-start.cjs');
  const dialog=join(root,name,'startup-dialog.json');
  writeFileSync(bootstrap,`
    const electron=require('electron');
    const fs=require('node:fs');
    const requireDesktop=require('node:module').createRequire(${JSON.stringify(join(desktop,'package.json'))});
    electron.dialog.showErrorBox=(title,message)=>fs.writeFileSync(${JSON.stringify(dialog)},JSON.stringify({title,message}));
    if(${interrupt}){
      const db=requireDesktop('sqlite3').Database.prototype;
      const exec=db.exec;
      db.exec=function(statement,callback){
        const v1=statement==='CREATE INDEX idx_ai_memory_revisions_document ON ai_memory_revisions(document_id);';
        const v2=statement.includes('CREATE TABLE IF NOT EXISTS xiaozhi_task_summary_control');
        const v3=statement.includes('CREATE TABLE IF NOT EXISTS xiaozhi_acquisition_candidates_v1');
        const v4=statement.includes('CREATE TABLE material_local_book_rechecks_v1');
        const v5=statement.includes('CREATE TABLE memory_source_access');
        if((${interrupt}===1 && v1) || (${interrupt}===2 && v2) || (${interrupt}===3 && v3) || (${interrupt}===4 && v4) || (${interrupt}===5 && v5)){
          return exec.call(this,statement,error=>{
            if(error)return callback(error);
            electron.app.exit(31);
          });
        }
        return exec.call(this,statement,callback);
      };
    }
    import(${JSON.stringify(pathToFileURL(main).href)});
  `);
  const runtime=resolve(desktop,'node_modules/electron/dist/electron.exe');
  const result=await new Promise((resolve,reject)=>{
    const process=spawn(runtime,[bootstrap,'--user-data-dir='+folder],{
      cwd:desktop, env:environment(data),windowsHide:true,stdio:['ignore','ignore','pipe']});
    let tail='';
    const timer=setTimeout(()=>{process.kill();reject(Error('Migration failure probe did not exit'));},40000);
    process.stderr.on('data',chunk=>{tail=(tail+chunk).slice(-4000);});
    process.once('error',error=>{clearTimeout(timer);reject(error);});
    process.once('close',code=>{clearTimeout(timer);resolve({code,tail});});
  });
  if(interrupt){
    assert.equal(result.code,31,result.tail);
    return {code:result.code};
  }
  assert.equal(result.code,1,result.tail);
  const diagnostic=JSON.parse(readFileSync(join(folder,'xiaozhi-database-startup.json'),'utf8'));
  assert.match(JSON.parse(readFileSync(dialog,'utf8')).message,new RegExp(diagnostic.issue,'u'));
  return {code:result.code,issue:diagnostic.issue,sqliteCode:diagnostic.sqliteCode};
}

try{
  const oldData=join(root,'legacy','data'),oldProfile=profile('legacy');
  await launch(legacy,oldData,oldProfile,async page=>{
    const [student]=await page.evaluate(()=>window.omniEdu.createStudent({displayName:'R1 upgrade fixture'}));
    assert.equal(student.displayName,'R1 upgrade fixture');
  });
  const old=dataState(oldData);
  assert.equal(old.version,0);
  assert.equal(old.students.length,1);

  stage='legacy migration and cold restart';
  const upgradeData=join(root,'upgrade','data'),upgradeProfile=profile('upgrade');
  cpSync(oldData,upgradeData,{recursive:true});
  await launch(main,upgradeData,upgradeProfile,async page=>{
    const [student]=await page.evaluate(()=>window.omniEdu.listStudents('R1 upgrade fixture'));
    assert.equal(student.id,old.students[0][0]);
  });
  const upgraded=dataState(upgradeData);
  assert.equal(upgraded.version,expectedVersion);
  assert.equal(upgraded.baseline[0].kind,'adopted');
  assert.equal(upgraded.ledger.length,expectedVersion);
  assert.deepEqual(upgraded.students,old.students);
  assert.deepEqual(upgraded.users,old.users);
  assert.deepEqual(upgraded.nativeLegacyMigration,old.nativeLegacyMigration);
  assert.deepEqual(upgraded.foreignKeys,[]);
  assert.equal(upgraded.integrity,'ok');
  await launch(main,upgradeData,upgradeProfile);
  const again=dataState(upgradeData);
  assert.deepEqual(again,upgraded);

  const savedParent=join(root,'upgrade','XiaozhiUpgradeRecovery');
  const [label]=readdirSync(savedParent);
  const saved=join(savedParent,label);
  assert(existsSync(join(saved,'omni-edu-backup-manifest.v1.json')));
  const savedState=dataState(saved);
  assert.equal(savedState.version,0);
  assert.deepEqual(savedState.students,old.students);
  receipt('Real old build produced v0 data. Managed adoption preserves identities and ledger stays unchanged on second cold start.', {
    originalVersion:old.version,version:again.version,oldDomainMigrationCount:old.nativeLegacyMigration.length,
    ledger:again.ledger,baseline:again.baseline,recoveryBackupVerified:true,
  });

  stage='fresh and upgraded equivalence';
  const fresh=join(root,'fresh','data');
  await launch(main,fresh,profile('fresh'));
  const created=dataState(fresh);
  assert.equal(created.baseline[0].kind,'fresh');
  assert.equal(created.version,expectedVersion);
  assert.deepEqual(created.schema,upgraded.schema);
  assert.equal(created.ledger[0].schema_sha256,upgraded.ledger[0].schema_sha256);
  assert.deepEqual(created.foreignKeys,[]);
  receipt('Fresh and adopted databases produce identical schema definitions and managed schema digest.');

  stage='interrupt migration between DDL and applied ledger';
  const interrupted=join(root,'interrupted','data');
  cpSync(oldData,interrupted,{recursive:true});
  const killed=await startFailing('interrupted',interrupted,1);
  assert.equal(killed.code,31);
  assert.deepEqual(dataState(interrupted),old);
  await launch(main,interrupted,profile('interrupted-reentry'));
  const resumed=dataState(interrupted);
  assert.equal(resumed.version,expectedVersion);
  assert.equal(resumed.ledger.length,expectedVersion);
  assert.deepEqual(resumed.students,old.students);
  receipt('Process interruption after executing migration DDL rolls back schema and user_version; cold re-entry succeeds.', killed);

  stage='interrupt v2 after v1 commits';
  const between=join(root,'interrupted-v2','data');
  cpSync(oldData,between,{recursive:true});
  await startFailing('interrupted-v2',between,2);
  const committed=dataState(between);
  assert.equal(committed.version,1);
  assert.equal(committed.ledger.length,1);
  assert(!committed.schema.some(([,name])=>name.startsWith('xiaozhi_task_summary_')));
  assert.deepEqual(committed.students,old.students);
  await launch(main,between,profile('interrupted-v2-reentry'));
  const continued=dataState(between);
  assert.equal(continued.version,expectedVersion);
  assert.deepEqual(continued.ledger.slice(0,1),committed.ledger);
  assert.deepEqual(continued.students,old.students);
  receipt('Abort after v2 DDL preserves the committed v1 ledger. Cold re-entry finishes v2 without reapplying v1.');

  stage='acquisition schema migration, partial legacy registration and drift rejection';
  const tableNames=['xiaozhi_acquisition_candidates_v1','xiaozhi_acquisition_operations_v1','xiaozhi_acquisition_artifacts_v1'];
  const createTable=table=>`CREATE TABLE IF NOT EXISTS ${table} (
      id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload_json TEXT NOT NULL, document_hash TEXT NOT NULL)`;
  const partial=join(root,'partial-acquisition','data');
  cpSync(oldData,partial,{recursive:true});
  sql(partial,false,db=>db.exec(createTable(tableNames[0])));
  await startFailing('partial-acquisition',partial,3);
  const partialBefore=dataState(partial);
  assert.equal(partialBefore.version,2);
  assert.deepEqual(partialBefore.schema.filter(([,name])=>tableNames.includes(name)).map(([,name])=>name),[tableNames[0]]);
  sql(partial,false,db=>db.exec(tableNames.slice(1).map(createTable).join(';')));
  for(const [name,change] of [
    ['unexpected-table','CREATE TABLE unrelated_schema_edit(id TEXT)'],
    ['modified-acquisition','ALTER TABLE xiaozhi_acquisition_operations_v1 ADD COLUMN extra TEXT'],
  ]){
    const invalid=join(root,name,'data');
    cpSync(partial,invalid,{recursive:true});
    sql(invalid,false,db=>db.exec(change));
    const before=dataState(invalid);
    assert.equal((await startFailing(name,invalid)).issue,'invalid_ledger');
    assert.deepEqual(dataState(invalid),before);
    receipt('Legacy acquisition compatibility still rejects '+name+' before writes.');
  }
  await launch(main,partial,profile('partial-acquisition-upgrade'));
  const partialAfter=dataState(partial);
  assert.equal(partialAfter.version,expectedVersion);
  assert.deepEqual(partialAfter.ledger.slice(0,2),partialBefore.ledger);
  assert.equal(partialAfter.ledger[2].migration_id,'r1.capability_acquisition.v3');
  assert.equal(partialAfter.ledger[3].migration_id,'r1.local_book_recheck_evidence.v4');
  assert.deepEqual(partialAfter.students,old.students);
  await launch(main,partial,profile('partial-acquisition-reentry'));
  assert.deepEqual(dataState(partial),partialAfter);
  receipt('Upgrade v2 after late creation of exact acquisition tables. A preexisting registered subset and the v1/v2 ledger are preserved.');

  stage='interrupt v4 after v3 commits';
  const recheckUpgrade=join(root,'interrupted-v4','data');
  cpSync(oldData,recheckUpgrade,{recursive:true});
  await startFailing('interrupted-v4',recheckUpgrade,4);
  const stableV3=dataState(recheckUpgrade);
  assert.equal(stableV3.version,3);
  assert(!stableV3.schema.some(([,name])=>name==='material_local_book_rechecks_v1'));
  await launch(main,recheckUpgrade,profile('interrupted-v4-reentry'));
  const stableV4=dataState(recheckUpgrade);
  assert.equal(stableV4.version,expectedVersion);
  assert.deepEqual(stableV4.ledger.slice(0,3),stableV3.ledger);
  assert(stableV4.schema.some(([,name])=>name==='material_local_book_rechecks_v1'));
  assert.deepEqual(stableV4.students,old.students);
  receipt('Interrupting v4 rolls back the evidence table and leaves the committed v3 ledger readable.');

  stage='interrupt history-memory migration after v4 commits';
  const historyUpgrade=join(root,'interrupted-v5','data');
  cpSync(oldData,historyUpgrade,{recursive:true});
  await startFailing('interrupted-v5',historyUpgrade,5);
  const beforeHistory=dataState(historyUpgrade);
  assert.equal(beforeHistory.version,4);
  assert(!beforeHistory.schema.some(([,name])=>name==='memory_source_access'));
  await launch(main,historyUpgrade,profile('interrupted-v5-reentry'));
  const afterHistory=dataState(historyUpgrade);
  assert.equal(afterHistory.version,expectedVersion);
  assert.equal(afterHistory.ledger.at(-1).migration_id,'r1.history_memory_access_and_index.v5');
  assert.deepEqual(afterHistory.ledger.slice(0,4),beforeHistory.ledger);
  assert.deepEqual(afterHistory.students,old.students);
  receipt('Interrupted history DDL rolls back, then v4 resumes and preserves previous records and ledger.');

  const priorFixture=process.env.OMNI_EDU_DB_V2_ACQUISITION_FIXTURE;
  if(priorFixture){
    stage='reproduce and upgrade the original synthetic v2 fixture';
    const data=join(root,'prior-acquisition','data');
    const fixtureDatabase=resolve(priorFixture);
    assert.equal(basename(fixtureDatabase),'app.db');
    cpSync(dirname(fixtureDatabase),data,{recursive:true,filter:path=>!/^app\.db(?:-(?:shm|wal|journal))?$/u.test(basename(path))});
    const source=new DatabaseSync(fixtureDatabase,{readOnly:true});
    try{await backup(source,dbPath(data));}finally{source.close();}
    const tableReadback=dir=>sql(dir,true,db=>tableNames.map(table=>db.prepare('SELECT * FROM '+table+' ORDER BY id').all()));
    const frozen=dataState(data),rows=tableReadback(data);
    assert.equal(frozen.version,2);
    assert(rows[0].length>0,'Use the actual previously failing acquisition fixture');
    await launch(main,data,profile('prior-acquisition'));
    const upgraded=dataState(data);
    assert.equal(upgraded.version,expectedVersion);
    assert.deepEqual(upgraded.ledger.slice(0,2),frozen.ledger);
    assert.deepEqual(tableReadback(data),rows);
    const recovery=join(root,'prior-acquisition','XiaozhiUpgradeRecovery');
    const [label]=readdirSync(recovery);
    const saved=join(recovery,label);
    assert(existsSync(join(saved,'omni-edu-backup-manifest.v1.json')));
    assert.equal(dataState(saved).version,2);
    assert.deepEqual(tableReadback(saved),rows);
    await launch(main,data,profile('prior-acquisition-restart'),async page=>{
      await page.getByTestId('office-prompt-input').waitFor({state:'visible'});
      await page.getByRole('button',{name:'设置',exact:true}).click();
      const advanced=page.getByTestId('pi-settings-advanced-toggle');
      if(await advanced.getAttribute('aria-expanded')!=='true')await advanced.click();
      await page.getByTestId('pi-settings-tab-tools').click();
      const discovery=page.getByTestId('pi-acquisition-discovery');
      await discovery.scrollIntoViewIfNeeded();
      await discovery.getByText('合成候选 · 来源待核对',{exact:true}).waitFor({state:'visible',timeout:15000});
      await discovery.getByText('合成候选 · 核验已过期',{exact:true}).waitFor({state:'visible',timeout:15000});
      for(const {id} of rows[0])assert.equal(await discovery.getByTestId('pi-acquisition-candidate-'+id).count(),1);
      await discovery.getByText('本地资料只读访问',{exact:true}).waitFor({state:'visible'});
      await page.screenshot({path:join(root,'acquisition-cold-readback.png')});
    });
    assert.deepEqual(dataState(data),upgraded);
    // Opening the discovery panel also registers the bundled, reviewed candidate.
    const [candidates,operations,artifacts]=tableReadback(data);
    assert.deepEqual([rows[0].map(({id})=>candidates.find(candidate=>candidate.id===id)),operations,artifacts],rows);
    receipt('Original v2 fixture opens twice. Actual settings show the original candidates and the original rows match the v2 recovery point.',
      {preservedRows:rows.map(table=>table.length)});
  }

  stage='refuse future, unknown migration and corrupt schema before writing';
  const invalid=[
    ['future','PRAGMA user_version=200','newer_version'],
    ['unknown-migration',"UPDATE xiaozhi_schema_migrations SET migration_id='unrecognized' WHERE to_version=2",'invalid_ledger'],
    ['bad-checksum',"UPDATE xiaozhi_schema_migrations SET checksum=printf('%064d',0)",'invalid_ledger'],
    ['missing-schema','DROP INDEX idx_ai_memory_revisions_document','invalid_ledger'],
  ];
  for(const [name,statement,issue] of invalid){
    const data=join(root,name,'data');
    cpSync(upgradeData,data,{recursive:true});
    sql(data,false,db=>db.exec(statement));
    const before=dataState(data);
    const blocked=await startFailing(name,data);
    assert.equal(blocked.issue,issue);
    assert.deepEqual(dataState(data),before);
    receipt('Pre-write rejection: '+name,blocked);
  }

  stage='upgrade recovery point cold boot with the original build';
  const rollbackData=join(root,'rollback','data');
  cpSync(saved,rollbackData,{recursive:true});
  await launch(legacy,rollbackData,profile('rollback'),async page=>{
    const [student]=await page.evaluate(()=>window.omniEdu.listStudents('R1 upgrade fixture'));
    assert.equal(student.id,old.students[0][0]);
  });
  assert.equal(dataState(rollbackData).version,0);
  assert.equal(dataState(upgradeData).version,expectedVersion);
  receipt('Rollback run uses verified pre-upgrade data in a new root and leaves the upgraded root intact.');
  report.ok=true;
} catch(error) {
  report.failedStage=stage;
  report.error=error.stack;
  console.error(error);
  process.exitCode=1;
} finally {
  writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.ok,stage,checks:report.checks.length,fixture:root.split(/[\\/]/u).at(-1),error:report.error}));
}
