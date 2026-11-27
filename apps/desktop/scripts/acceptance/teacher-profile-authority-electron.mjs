import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {_electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..'), main=testMain(desktop);
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'teacher-profile-authority-'));
const data=path.join(root,'data'),profile=path.join(root,'profile');
const report={mainSha256:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),checks:[],ok:false,root};
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1'};
for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY','OMNI_EDU_R2_PYTHON'])delete env[key];
let app;
async function open(){
  app=await _electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env});
  await assertIsolatedPiMain(app,main,profile);
  const chat=await app.firstWindow(),newWindow=app.waitForEvent('window');
  await chat.getByTestId('nav-settings').click();
  const page=await newWindow;await page.getByTestId('pi-settings-tab-teacher-memory').click();
  await page.getByTestId('teacher-memory-textbook').waitFor();return page;
}
async function current(page){
  const reply=await page.evaluate(()=>window.omniEdu.getTeacherMemorySettings());
  assert(reply.ok);return reply.value;
}
async function save(page){
  await page.getByTestId('teacher-memory-save').click();await page.getByTestId('teacher-memory-notice').waitFor();
}
try{
  let page=await open();
  assert.equal((await current(page)).profileOrigin,null,'empty fields must give no profile authority');
  await page.getByTestId('teacher-memory-textbook').fill('合成教材：科学活动手册');await save(page);
  const saved=await current(page);
  assert.deepEqual(saved.profileOrigin,{category:'teacher_profile',evidence:'teacher_explicit'});
  assert.equal(saved.profile.grade,'');assert.equal(saved.profile.subject,'');
  await page.getByTestId('teacher-profile-origin').waitFor();
  assert((await page.getByTestId('teacher-profile-origin').innerText()).includes(String(saved.revision)));
  await app.close();app=undefined;page=await open();assert.deepEqual(await current(page),saved);
  report.checks.push('Explicit structured profile keeps its own category and revision through cold restart without inferring missing fields');
  await page.getByTestId('teacher-memory-textbook').fill('');await save(page);
  const cleared=await current(page);assert.equal(cleared.profileOrigin,null);
  assert.equal(cleared.revision,saved.revision+1);assert.equal(await page.getByTestId('teacher-profile-origin').count(),0);
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{
    const row=db.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.teacher-preference.v1:personal-policy');
    assert.deepEqual(JSON.parse(row.value_json).profile,{subject:'',grade:'',textbook:''});
    assert.equal(db.prepare('SELECT count(*) AS n FROM personal_memory_records').get().n,0);
  }finally{db.close();}
  report.checks.push('Clearing the last field withdraws the profile projection without creating personal memory');report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{
  await app?.close();fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
