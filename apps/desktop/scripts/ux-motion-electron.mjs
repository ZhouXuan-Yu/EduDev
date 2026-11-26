import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from 'playwright';
import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint} from './acceptance/evidence.mjs';

const desktop=path.resolve(import.meta.dirname,'..'),repo=path.resolve(desktop,'../..');
const output=fs.mkdtempSync(path.join(repo,'docs/audit/ux-motion-20261126/electron-'));
const root=path.join(desktop,'test-results',path.basename(output)),data=path.join(root,'data'),profile=path.join(root,'profile');
for(const p of [data,profile])fs.mkdirSync(p,{recursive:true});
const main=path.join(desktop,'out/main/index.js'),source=fingerprint(path.join(desktop,'src')),build=fingerprint(path.join(desktop,'out'));
const bootstrap=zeroNetworkBootstrap({output,main,profile,counter:'__uxMotionHttp'});
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:repo,OMNI_EDU_SKIP_DOTENV:'1'};
for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k)||k.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'].includes(k))delete env[k];
const report={success:false,output,data,profile,main,source:source.sha256,build:build.sha256,checks:[],errors:[],consoleErrors:[],motion:[],screens:[],boundary:'Production Electron, original typed IPC/SQLite, fictional data entered via UI. Network denied; no model/provider or deletion performed. Narrow desktop CSS is measured, not a mobile installer claim.'};
let app,page,ids,originalTime;
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=label=>{report.checks.push(label);console.log('PASS '+label);save();};
async function start(){
 app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(18000);
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 await page.getByTestId('office-prompt-input').waitFor({timeout:60000});report.identity=await assertIsolatedPiMain(app,main,profile);
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setMinimumSize(0,0);w.setContentSize(1366,768);w.setTitle('小智 · 交互与动效验收');w.show();w.focus();});
 await (await page.context().newCDPSession(page)).send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Shanghai'});
}
async function nav(id){await page.locator('[data-testid=edu-navigation]:visible').getByTestId(id).click();}
async function studentTab(id){await page.getByTestId('student-page-navigation').getByTestId('hub-entry-'+id).click();}
async function settledRecord(){await page.waitForFunction(()=>!document.querySelector('[data-testid=record-form-save]')?.disabled && !document.querySelector('[data-testid=record-form-title]')?.value);}
const read=student=>page.evaluate(id=>window.omniEdu.listRecords(id,{limit:200}),student);
async function screenshot(name){await page.screenshot({path:path.join(output,name+'.png')});report.screens.push(name+'.png');save();}
async function samples(name,action){
 await page.evaluate(()=>{globalThis.__frames=[];globalThis.__long=[];globalThis.__shifts=[];globalThis.__stop=false;globalThis.__previous=0;
 const tick=t=>{if(globalThis.__previous)__frames.push(t-globalThis.__previous);globalThis.__previous=t;if(!__stop)requestAnimationFrame(tick);};requestAnimationFrame(tick);
 globalThis.__observer=new PerformanceObserver(list=>__long.push(...list.getEntries().map(e=>e.duration)));__observer.observe({type:'longtask'});
 globalThis.__layout=new PerformanceObserver(list=>__shifts.push(...list.getEntries().map(e=>({value:e.value,recentInput:e.hadRecentInput}))));__layout.observe({type:'layout-shift'});});
 await action();await page.waitForTimeout(350);
 const result=await page.evaluate(()=>{__stop=true;__observer.disconnect();__layout.disconnect();const f=__frames.slice().sort((a,b)=>a-b),p=q=>f[Math.floor((f.length-1)*q)];return{visible:document.visibilityState,count:f.length,p50:p(.5),p95:p(.95),max:f.at(-1),longTasks:__long,layoutShifts:__shifts};});
 report.motion.push({name,...result});save();
}
try{
 await start();
 for(const name of ['交互验收甲','交互验收乙']){await nav('nav-student-workbench');await page.getByTestId('student-create').click();await page.getByTestId('student-form-display-name').fill(name);await page.getByTestId('student-form-save').click();await page.getByTestId('student-profile-form').waitFor({state:'hidden'});}
 ids=await page.evaluate(async()=>Object.fromEntries((await window.omniEdu.listStudents('交互验收')).map(x=>[x.displayName,x.id])));
 await page.locator('[data-testid^=student-row-]').filter({hasText:'交互验收甲'}).first().click();await page.getByTestId('hub-entry-intake').click();
 await page.getByTestId('record-form-title').fill('甲待保存');await page.getByTestId('record-form-content').fill('甲的课堂观察');await page.getByTestId('record-form-time').fill('2026-11-26T09:30');
 await page.getByTestId('record-student-'+ids['交互验收乙']).click();assert.equal(await page.getByTestId('record-form-title').inputValue(),'');await page.getByTestId('record-form-title').fill('乙待保存');
 await page.getByTestId('record-student-'+ids['交互验收甲']).click();assert.equal(await page.getByTestId('record-form-title').inputValue(),'甲待保存');assert.equal(await page.getByTestId('record-form-time').inputValue(),'2026-11-26T09:30');check('student switches preserve separate drafts and local time');
 await page.getByTestId('record-form-save').click();await settledRecord();let rows=await read(ids['交互验收甲']);assert.equal(rows.length,1);originalTime=rows[0].occurredAt;assert.equal(new Date(originalTime).toISOString(),'2026-11-26T01:30:00.000Z');
 await page.getByTestId('record-edit-'+rows[0].id).click();await page.getByTestId('record-form-title').fill('甲记录已改标题');await page.getByTestId('record-edit-'+rows[0].id).click();assert.equal(await page.getByTestId('record-form-title').inputValue(),'甲记录已改标题');await page.getByTestId('record-form-save').click();await settledRecord();rows=await read(ids['交互验收甲']);assert.equal(rows.length,1);assert.equal(rows[0].occurredAt,originalTime);check('UI edit retains exact timestamp and same-record click never reloads draft');
 await page.getByTestId('record-form-title').fill('未保存新记录');await page.getByTestId('record-edit-'+rows[0].id).click();await page.getByTestId('action-confirmation').waitFor();await page.keyboard.press('Escape');await page.getByTestId('action-confirmation').waitFor({state:'hidden'});assert.equal(await page.getByTestId('record-form-title').inputValue(),'未保存新记录');check('replacing an unfinished record is cancelable by Escape');
 await page.getByTestId('record-form-title').fill('长内容验收');await page.getByTestId('record-form-content').fill('教师观察与证据记录。\n'.repeat(800));await page.getByTestId('record-form-save').click();await settledRecord();
 const targetId=(await read(ids['交互验收甲'])).find(x=>x.title==='甲记录已改标题').id;
 // Volume fixture uses the existing typed host, only inside this script's fictional root.
 await page.evaluate(async studentId=>{for(let i=0;i<101;i++)await window.omniEdu.createRecord({studentId,recordType:'class',subject:'数学',title:'分页容量夹具'+i,content:'独立虚构验收记录',tags:[],occurredAt:'2026-11-26T02:30:00.000Z'});},ids['交互验收甲']);
 await studentTab('search');await page.getByTestId('global-search-input').fill('甲记录已改标题');await page.getByTestId('global-search-submit').click();await page.getByTestId('global-search-record-'+targetId).click();await page.getByTestId('timeline-record-'+targetId).waitFor();await page.waitForFunction(id=>document.activeElement?.getAttribute('data-testid')==='timeline-record-'+id,targetId);await page.getByTestId('desktop-back').click();await page.getByTestId('global-search-record-'+targetId).waitFor();await page.waitForFunction(id=>document.activeElement?.getAttribute('data-testid')==='global-search-record-'+id,targetId);check('same-student old search hit beyond 100 rows focuses exact ID and restores search on Back');
 await studentTab('intake');
 await screenshot('record-timeline');
 await samples('long record timeline / idle',()=>page.waitForTimeout(1000));
 await nav('nav-teaching');await page.getByTestId('hub-entry-notebook').click();
 for(const name of ['验收备课本甲','验收备课本乙']){await page.getByTestId('teacher-notebook-new').click();await page.getByTestId('teacher-notebook-name').fill(name);await page.getByTestId('teacher-notebook-create').click();await page.getByTestId('teacher-notebook-create').waitFor({state:'hidden'});}
 const notebooks=await page.evaluate(()=>window.omniEdu.listTeacherNotebooks(false)),bookA=notebooks.find(x=>x.name==='验收备课本甲'),bookB=notebooks.find(x=>x.name==='验收备课本乙');
 await page.getByTestId('teacher-notebook-item-'+bookA.id).click();await page.getByTestId('teacher-notebook-name').fill('验收备课本甲已改名');await page.getByTestId('teacher-notebook-record-title').fill('课堂活动');await page.getByTestId('teacher-notebook-record-output').fill('保留名称修改的同时，保存这条笔记。');await page.getByTestId('teacher-notebook-record-save').click();await page.waitForFunction(()=>!document.querySelector('[data-testid=teacher-notebook-record-output]').value);assert.equal(await page.getByTestId('teacher-notebook-name').inputValue(),'验收备课本甲已改名');await page.getByTestId('teacher-notebook-save').click();await page.waitForFunction(()=>document.querySelector('[data-testid=teacher-notebook-notice]')?.textContent.includes('信息已保存'));check('saving a child note preserves unsaved notebook metadata');
 await page.getByTestId('teacher-notebook-record-output').fill('未保存的教学想法');await page.getByTestId('teacher-notebook-item-'+bookB.id).click();await page.getByTestId('action-confirmation-cancel').click();assert.equal(await page.getByTestId('teacher-notebook-record-output').inputValue(),'未保存的教学想法');
 await nav('nav-knowledge');await page.getByTestId('desktop-navigation-notice').waitFor();assert(await page.getByTestId('teacher-notebook-workspace').isVisible());await page.getByTestId('teacher-notebook-delete').click();assert((await page.getByTestId('action-confirmation').innerText()).includes('删除《验收备课本甲已改名》'));await page.keyboard.press('Escape');assert.equal(await page.getByTestId('teacher-notebook-record-output').inputValue(),'未保存的教学想法');await screenshot('notebook-protected-draft');check('page exit and whole-book deletion protect unfinished edits with explicit safe cancellation');
 await page.getByTestId('teacher-notebook-record-title').fill('继续课堂活动');await page.getByTestId('teacher-notebook-record-save').click();await page.waitForFunction(()=>!document.querySelector('[data-testid=teacher-notebook-record-output]').value);
 await nav('nav-ai-workspace');await page.getByTestId('workbench-new-folder').click();await page.getByLabel('空间名称',{exact:true}).fill('动效验收空间');await page.getByRole('button',{name:'创建空间',exact:true}).click();await page.getByTestId('workbench-folder-dialog').waitFor({state:'hidden'});
 const folder=page.locator('[data-testid=edu-navigation]:visible').getByRole('button',{name:'动效验收空间',exact:true});
 await samples('folder open / close',async()=>{for(let i=0;i<6;i++){await folder.click();await page.waitForTimeout(220);}});
 await folder.click();const controls=await folder.getAttribute('aria-controls');await page.waitForTimeout(220);assert.equal(await page.locator(`[id="${controls}"]`).getAttribute('inert'),null);
 await folder.click();await page.waitForTimeout(220);assert.notEqual(await page.locator(`[id="${controls}"]`).getAttribute('inert'),null);check('folder state transitions preserve DOM and make collapsed content inert');
 const drag=page.getByTestId('edu-resizer-left');const box=await drag.boundingBox();if(box){const before=await drag.getAttribute('aria-valuenow');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+75,box.y+box.height/2,{steps:10});await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await drag.getAttribute('aria-valuenow'),before);check('resize is direct and Escape restores the starting width');}
 for(const reducedMotion of ['no-preference','reduce'])for(const colorScheme of ['light','dark'])for(const [width,height] of [[390,844],[800,768],[1366,768],[1920,1080]]){
  await page.emulateMedia({reducedMotion,colorScheme});await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);await page.waitForTimeout(220);
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),`${width} document overflow`);
  if(width<=800){const toggle=page.locator('[data-testid=edu-navigation]:visible').getByTestId('workbench-sidebar-toggle');await toggle.click();await page.getByTestId('workbench-dismiss-navigation').waitFor();await page.keyboard.press('Escape');await page.getByTestId('workbench-dismiss-navigation').waitFor({state:'hidden'});assert.equal(await toggle.getAttribute('aria-expanded'),'false');}
  const duration=await page.locator('[data-testid=edu-navigation]:visible').evaluate(el=>getComputedStyle(el).getPropertyValue('--edu-motion-standard').trim());if(reducedMotion==='reduce')assert.equal(duration,'0ms');
  await screenshot(`chat-${width}-${colorScheme}-${reducedMotion}`);
 }
 check('four viewport widths, both OS schemes and reduced motion retain reachability without document overflow');
 await page.emulateMedia({reducedMotion:'no-preference',colorScheme:'light'});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));
 await samples('page transitions',async()=>{for(const id of ['nav-knowledge','nav-teaching','nav-student-workbench','nav-ai-workspace']){await nav(id);await page.waitForTimeout(220);}});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.equal(fingerprint(path.join(desktop,'src')).sha256,source.sha256);assert.equal(fingerprint(path.join(desktop,'out')).sha256,build.sha256);
 await app.close();await start();const persisted=await read(ids['交互验收甲']);assert.equal(persisted.find(x=>x.title==='甲记录已改标题')?.occurredAt,originalTime);const books=await page.evaluate(()=>window.omniEdu.listTeacherNotebooks(false));assert(books.some(x=>x.name==='验收备课本甲已改名'));check('restart readback retains original record timestamp and notebook metadata');
 report.httpAttempts=await app.evaluate(()=>globalThis.__uxMotionHttp);report.success=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;if(page&&!page.isClosed()){await screenshot('failure').catch(()=>{});fs.writeFileSync(path.join(output,'failure-body.txt'),await page.locator('body').innerText().catch(()=>''));}}
finally{if(app)await app.close();save();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,failure:report.failure}));}
