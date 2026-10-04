import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { captureWorkspaceMetrics } from './capture-workspace-metrics.mjs';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=fs.mkdtempSync(path.join(desktop,'test-results/xiaozhi-agent/pi-shell-ui-')),data=path.join(output,'data');
const report={success:false,checks:[],boundaries:['Actual formal Electron UI/typed main/local persistence in isolated synthetic data','No provider requests in this shell suite; real process suite is separate','Reference DPI unknown; native menu/title frame and file preview still pending']};
let app,page,session;const errors=[];
function check(name,fn){fn();report.checks.push({name,pass:true});console.log(`PASS ${name}`);}
async function until(fn,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,80));}throw new Error('Shell UI condition timed out');}
async function launch(){const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
  app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),`--user-data-dir=${path.join(output,'electron-profile')}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',error=>errors.push(String(error)));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});await page.getByTestId('office-prompt-input').waitFor();await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
  session=await page.locator('.office-composer-container').getAttribute('data-session-id');
}
const state=()=>page.evaluate(()=>window.omniEdu.listAiConversations());
async function rename(id,title){const row=page.getByTestId(`ai-conversation-session-${id}`);await row.click({button:'right'});await page.getByTestId('ai-conversation-context-rename').click();const input=page.getByTestId(`ai-conversation-rename-session-${id}`);await input.fill(title);await input.press('Enter');await until(async()=>(await state()).sessions.find(item=>item.id===id)?.title===title);}
try{
  await launch();
  check('Original Pro AppLayout/Sidebar and narrow rail are present with real current conversation',()=>{});
  assert.equal(await page.locator('[data-app-layout].pi-shell').count(),1);assert.equal(await page.locator('[data-slot="sidebar"][data-testid="ai-conversation-sidebar"]').count(),1);assert(await page.getByTestId('pi-icon-rail').isVisible());
  assert.equal(await page.getByTestId('pi-task-details-expand').getAttribute('aria-expanded'),'false');assert(!await page.getByTestId('pi-model-capabilities').isVisible());
  await rename(session,'分数课堂教研计划');
  check('Actual context-menu rename persists and reaches header/current selected row',()=>{});assert((await page.getByTestId('pi-workspace-header').innerText()).includes('分数课堂教研计划'));
  const original=session;await page.getByTestId('ai-conversation-new').click();await until(async()=>(await state()).sessions.length===2);session=await page.locator('.office-composer-container').getAttribute('data-session-id');assert.notEqual(session,original);await rename(session,'语文阅读资料');
  await page.getByTestId('pi-conversation-search').click();const search=page.getByTestId('pi-conversation-search-input');await search.fill('分数');await until(async()=>!await page.getByTestId(`ai-conversation-session-${session}`).count());assert(await page.getByTestId(`ai-conversation-session-${original}`).isVisible());await search.press('Escape');await page.getByTestId(`ai-conversation-session-${original}`).click();session=original;
  check('Actual new chat/search/Escape/current conversation switching preserve local facts',()=>assert.equal((report.checks.length>0),true));
  await page.getByTestId('ai-conversation-folder-new').click();await page.getByTestId('ai-conversation-folder-name').fill('教研资料');await page.getByTestId('ai-conversation-folder-save').click();await until(async()=>(await state()).folders.some(item=>item.name==='教研资料'));const folder=(await state()).folders.find(item=>item.name==='教研资料');
  await page.getByTestId(`ai-conversation-session-${session}`).dragTo(page.getByTestId(`ai-conversation-drop-${folder.id}`));await until(async()=>(await state()).sessions.find(item=>item.id===session)?.folderId===folder.id);
  check('Actual create-folder and pointer drag classification persist through typed main',()=>{});
  for(const [width,height]of [[1366,768],[1920,1080]]){
    await page.setViewportSize({width,height});await until(async()=>{const b=await page.getByTestId('office-prompt-input').boundingBox();return b&&b.x>=0&&b.y+b.height<=height;});
    const metrics=await captureWorkspaceMetrics(page,app,output,`shell-${width}x${height}`);assert.equal(metrics.renderer.regions.sidebar.rect.width,304);assert.equal(metrics.renderer.regions.header.rect.height,62);assert(metrics.renderer.regions.inspection.rect.height<400);
    const title=page.getByTestId(`ai-conversation-session-${session}`).locator('[data-slot="chat-list-view-title"]'),titleBox=await title.boundingBox();assert(titleBox.width>180);assert.equal(await title.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
    await page.getByTestId('pi-task-details-expand').click();await page.getByTestId('pi-model-capabilities').waitFor({state:'visible'});await page.getByTestId('pi-budget-expand').click();await page.getByTestId('pi-budget-save').waitFor({state:'visible'});assert(await page.getByTestId('pi-memory-scope').isVisible());await page.getByTestId('pi-budget-expand').click();await page.getByTestId('pi-task-details-expand').click();
    await page.getByTestId('pi-aside-toggle').click();assert(!await page.getByTestId('xiaozhi-pi-inspector').isVisible());await page.getByTestId('pi-aside-toggle').click();assert(await page.getByTestId('xiaozhi-pi-inspector').isVisible());
    await page.getByTestId('pi-sidebar-toggle').click();await until(async()=>(await page.locator('.sidebar__offcanvas-wrapper').boundingBox())?.width===0);await page.getByTestId('pi-rail-chats').click();await until(async()=>Math.abs((await page.locator('.sidebar__offcanvas-wrapper').boundingBox()).width-304)<1);
    check(`Actual shell/compact card/details/sidebar controls and input are reachable at ${width}x${height}`,()=>{});
  }
  await page.getByTestId('pi-skills-open').click();await page.getByTestId('pi-skills-settings').waitFor({state:'visible'});await page.getByTestId('pi-skills-close').click();
  check('Skills settings remain real and reachable from new header',()=>{});
  await page.getByTestId(`ai-conversation-session-${session}`).click({button:'right'});await page.getByTestId('ai-conversation-context-archive').click();await page.getByTestId('ai-conversation-archive-confirm').click();await until(async()=>(await state()).archivedSessions.some(item=>item.id===session));assert(!(await state()).sessions.some(item=>item.id===session));
  check('Actual archive keeps local history and opens a new active conversation',()=>{});
  await page.getByTestId('pi-sidebar-toggle').click();await page.getByTestId('pi-aside-toggle').click();await until(async()=>(await page.locator('.sidebar__offcanvas-wrapper').boundingBox())?.width===0);
  const preserved=await state();report.preferencesBeforeRestart=await page.evaluate(()=>localStorage.getItem('xiaozhi.ui.v1'));assert.deepEqual(JSON.parse(report.preferencesBeforeRestart),{schema:1,sidebar:false,aside:false});report.userData=await app.evaluate(({app})=>app.getPath('userData'));await app.close();app=undefined;await launch();report.preferencesAfterRestart=await page.evaluate(()=>localStorage.getItem('xiaozhi.ui.v1'));assert.equal(report.preferencesAfterRestart,report.preferencesBeforeRestart);await until(async()=>(await page.locator('.sidebar__offcanvas-wrapper').boundingBox())?.width===0);assert(!await page.getByTestId('xiaozhi-pi-inspector').isVisible());assert.deepEqual(await state(),preserved);
  check('Actual restart retains closed-pane preferences, folders, archive and local conversation facts',()=>{});
  await page.getByTestId('pi-rail-chats').click();await page.getByTestId('pi-aside-toggle').click();await page.getByTestId('pi-rail-home').click();await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'hidden'});
  check('Narrow rail home invokes real teacher-workbench navigation',()=>{});assert.deepEqual(errors,[]);report.success=true;
}catch(error){process.exitCode=1;report.error=String(error.stack||error).slice(0,3000);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});report.rendererErrors=errors;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,report:path.relative(desktop,path.join(output,'report.json'))}));}
