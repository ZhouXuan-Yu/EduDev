import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=resolve(import.meta.dirname,'../..');
const main=testMain(desktop);
const legacy=resolve(desktop,'test-results/xiaozhi-db-r1-baseline/out/main/index.js');
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
        if((${interrupt}===1 && v1) || (${interrupt}===2 && v2)){
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
  assert.equal(upgraded.version,2);
  assert.equal(upgraded.baseline[0].kind,'adopted');
  assert.equal(upgraded.ledger.length,2);
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
  assert.equal(created.version,2);
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
  assert.equal(resumed.version,2);
  assert.equal(resumed.ledger.length,2);
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
  assert.equal(continued.version,2);
  assert.deepEqual(continued.ledger.slice(0,1),committed.ledger);
  assert.deepEqual(continued.students,old.students);
  receipt('Abort after v2 DDL preserves the committed v1 ledger. Cold re-entry finishes v2 without reapplying v1.');

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
  assert.equal(dataState(upgradeData).version,2);
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
