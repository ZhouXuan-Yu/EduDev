import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const fixture=fs.realpathSync(process.argv[2]),previous=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
assert(previous.ok&&previous.sourceDocuments.includes('chat'));
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'legacy-memory-state-'));
const data=path.join(root,'data'),profile=path.join(root,'profile');
fs.cpSync(path.join(fixture,'data'),data,{recursive:true});
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_SKIP_DOTENV:'1'};
for(const key of ['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','DEEPSEEK_API_KEY','OMNI_EDU_E2E_LEGACY_RUNTIME'])delete env[key];
const read=()=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare('SELECT version,status FROM ai_memory_l3_entries WHERE id=?').get(previous.id);}finally{db.close();}};
const report={root,ok:false,id:previous.id,build:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),checks:[]};
let app;
try{
  app=await _electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env});
  await assertIsolatedPiMain(app,main,profile);
  const chat=await app.firstWindow(),window=app.waitForEvent('window');
  await chat.getByTestId('nav-settings').click();
  const settings=await window;
  await settings.getByTestId('pi-settings-tab-permissions').click();
  const panel=settings.getByTestId('pi-memory-scope');
  if(!await settings.getByTestId('pi-memory-source').isVisible())await panel.locator('[data-slot="chat-tool-trigger"]').click();
  await settings.getByTestId('pi-memory-source').selectOption('8');
  await settings.getByTestId('pi-memory-entry-'+previous.id).waitFor();
  const before=read();
  await settings.getByTestId('memory-disable-l3-'+previous.id).click({timeout:8000});
  await settings.getByTestId('memory-restore-l3-'+previous.id).waitFor();
  assert.deepEqual({...read()},{version:before.version+1,status:'disabled'});
  const stale=await settings.evaluate(async({id,version})=>{
    try{await window.omniEdu.setLegacyMemoryAvailability(id,version,'active');return false;}catch{return true;}
  },{id:previous.id,version:before.version});assert(stale);
  assert.equal(read().status,'disabled');
  await settings.getByTestId('memory-restore-l3-'+previous.id).click();
  await settings.getByTestId('memory-disable-l3-'+previous.id).waitFor();
  assert.deepEqual({...read()},{version:before.version+2,status:'active'});
  report.checks.push('Formal Pi settings pause and explicitly restore the genuine legacy entry; stale restoration cannot write');
  report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}
finally{await app?.close();fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
