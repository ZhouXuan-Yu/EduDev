import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from 'playwright';
import {fingerprint} from './acceptance/evidence.mjs';
import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'..'),root=path.resolve(desktop,'../..');
const output=fs.mkdtempSync(path.join(root,'acceptance/ui-ux-r1-20261124/evidence/settings-'));
const owned=path.join(desktop,'test-results',path.basename(output)),data=path.join(owned,'data'),profile=path.join(owned,'profile');
for(const d of [data,profile])fs.mkdirSync(d,{recursive:true});
const main=path.join(desktop,'out/main/index.js'),source=fingerprint(path.join(desktop,'src')),build=fingerprint(path.join(desktop,'out'));
const bootstrap=zeroNetworkBootstrap({main,profile,output,counter:'__uiRoneSettingsHttp'});
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:root,NODE_ENV:'development'};
for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/.test(k)||k.startsWith('OMNI_EDU_E2E_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
const report={success:false,source:source.sha256,build:build.sha256,output,data,profile,checks:[],errors:[],readback:{},
  scope:'Production Electron, original typed IPC and persistent host. Fictional local teacher settings. No provider requests. Concurrent-write case uses a real typed host write to the isolated profile, not a mocked response.'};
let app,page,session;
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push({name,pass:true});save();};
const until=async(fn)=>{const end=Date.now()+15000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('condition timed out: '+report.checks.at(-1)?.name);};
async function nav(id){await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-'+id).click();}
async function choose(id,label){await page.getByTestId(id).click();await page.getByRole('option',{name:label,exact:true}).click();}
async function tab(id){await page.getByTestId('pi-settings-tab-'+id).click();await page.locator(`[data-testid="pi-settings-workspace"][data-tab="${id}"]`).waitFor();}
async function launch(){
  app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(String(e)));
  await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
  await until(()=>page.getByTestId('office-prompt-input').isEnabled());
  report.identity=await assertIsolatedPiMain(app,main,profile);
  report.displays=await app.evaluate(({screen})=>screen.getAllDisplays().map(({id,bounds,workArea,scaleFactor})=>({id,bounds,workArea,scaleFactor})));
  session=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
try{
  await launch();
  const draft='UI R1 未发送草稿：保留一模范围，不含二模。';
  await page.getByTestId('office-prompt-input').fill(draft);
  await nav('settings');await page.getByTestId('pi-settings-key').waitFor();await until(()=>page.getByTestId('pi-settings-key').isEnabled());
  await page.getByTestId('pi-settings-key').fill('ui-r1-not-a-real-credential');
  await page.getByTestId('pi-settings-unsaved').waitFor();
  assert(await page.getByTestId('pi-settings-tab-interface').isDisabled());
  await page.screenshot({path:path.join(output,'models-unsaved.png')});
  check('unsaved model input has an explicit dirty notice and prevents category loss');
  await page.getByTestId('pi-settings-discard').click();await until(()=>page.getByTestId('pi-settings-tab-interface').isEnabled());
  assert.equal(await page.getByTestId('pi-settings-key').inputValue(),'');
  check('explicit discard clears only the local model form');
  await tab('interface');await choose('pi-queue-mode','补充到本轮');
  assert.equal(await page.evaluate(()=>localStorage.getItem('edudev.composer.follow-up.v1')),'steer');
  check('existing queue preference saves the original steer enum immediately');
  await tab('teacher-memory');await choose('teacher-memory-subject','物理');await choose('teacher-memory-grade','八年级');
  await page.getByTestId('teacher-memory-textbook').fill('UI验收教材');
  await page.getByTestId('teacher-memory-save').click();await page.getByTestId('teacher-memory-notice').waitFor();
  const memory=await page.evaluate(()=>window.omniEdu.getTeacherMemorySettings());assert(memory.ok);
  assert.equal(memory.value.profile.subject,'物理');assert.equal(memory.value.profile.grade,'八年级');
  report.readback.teacherSaved=memory.value;
  check('teacher profile is saved through the original host and read back');
  await page.getByTestId('teacher-memory-textbook').fill('UI验收尚未保存的教材');
  const concurrent=await page.evaluate(async()=>{
    const result=await window.omniEdu.getTeacherMemorySettings();if(!result.ok)return result;
    const {revision,profile,use,preference}=result.value;
    return window.omniEdu.saveTeacherMemorySettings({revision,profile:{...profile,textbook:'UI验收并发修改的教材'},use,preferenceRevision:preference.revision});
  });assert(concurrent.ok);
  await page.getByTestId('teacher-memory-save').click();await page.getByTestId('teacher-memory-error').waitFor();
  assert.equal(await page.getByTestId('teacher-memory-textbook').inputValue(),'UI验收尚未保存的教材');
  await page.screenshot({path:path.join(output,'teacher-save-conflict.png')});
  check('real revision conflict is visible and retains unsaved teacher input');
  await page.getByRole('button',{name:'放弃修改并重新读取',exact:true}).click();
  await until(async()=>await page.getByTestId('teacher-memory-textbook').inputValue()==='UI验收并发修改的教材');
  check('conflict recovery reloads the real concurrent value');
  await nav('ai-workspace');assert.equal(await page.getByTestId('office-prompt-input').inputValue(),draft);
  check('settings save and return do not remount or clear the conversation draft');
  await page.evaluate(()=>localStorage.removeItem('xiaozhi.current-session.v1'));
  await nav('settings');await tab('permissions');await page.getByTestId('pi-settings-no-session').waitFor();
  assert.equal(await page.getByTestId('pi-settings-workspace-choose').count(),0);
  const list=await page.evaluate(()=>window.omniEdu.listAiConversations());assert(list.sessions.length>0);
  report.readback.scope={sessionCount:list.sessions.length,currentPreference:null,workspaceSelectorAbsent:true};
  await page.screenshot({path:path.join(output,'no-current-conversation.png')});
  check('existing recent sessions are not silently adopted as current permissions scope');
  await page.evaluate(id=>localStorage.setItem('xiaozhi.current-session.v1',id),session);
  await app.close();app=undefined;await launch();
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(),draft);
  const restored=await page.evaluate(()=>window.omniEdu.getTeacherMemorySettings());assert(restored.ok);
  assert.equal(restored.value.profile.textbook,'UI验收并发修改的教材');
  assert.equal(await page.evaluate(()=>localStorage.getItem('edudev.composer.follow-up.v1')),'steer');
  report.readback.afterRestart=restored.value;
  check('cold restart retains profile, queue enum and original conversation draft');
  await nav('settings');await tab('interface');
  await page.getByTestId('pi-queue-mode').focus();await page.keyboard.press('Enter');
  await page.getByRole('listbox').waitFor();await page.keyboard.press('Escape');
  await until(()=>page.getByTestId('pi-queue-mode').evaluate(el=>el===document.activeElement));
  check('Select opens with keyboard and Escape restores trigger focus');
  report.httpAttempts=await app.evaluate(()=>globalThis.__uiRoneSettingsHttp);
  assert.deepEqual(report.httpAttempts,[]);assert.deepEqual(report.errors,[]);
  assert.equal(fingerprint(path.join(desktop,'src')).sha256,source.sha256);assert.equal(fingerprint(path.join(desktop,'out')).sha256,build.sha256);
  report.success=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;if(page&&!page.isClosed()){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'failure-body.txt'),await page.locator('body').innerText().catch(()=>''));}}
finally{if(app)await app.close();save();console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,failure:report.failure}));}
