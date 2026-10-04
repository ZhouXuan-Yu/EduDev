import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { captureWorkspaceMetrics } from './capture-workspace-metrics.mjs';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=fs.mkdtempSync(path.join(desktop,'test-results/xiaozhi-agent/pi-control-menus-'));
const checks=[],report={success:false,checks,boundary:'Actual formal renderer/main/typed snapshots and native Settings/back; isolated fresh data/profile; chooser cancellation controlled. No provider reply claim from menu measurements.'};
let app,page;
const check=name=>{checks.push({name,pass:true});console.log(`PASS ${name}`);};
async function fit(locator){const rect=await locator.boundingBox(),view=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));assert(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=view.width+1&&rect.y+rect.height<=view.height+1);}
try{
 const env={...process.env,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_DATA_ROOT:path.join(output,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..')};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),`--user-data-dir=${path.join(output,'profile')}`],env,timeout:60000});page=await app.firstWindow();
 await page.getByTestId('office-conversation').waitFor({state:'visible',timeout:60000});await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
 const session=await page.locator('.office-composer-container').getAttribute('data-session-id');
 for(const [width,height]of[[1366,768],[1920,1080]]){
  await page.setViewportSize({width,height});await page.getByTestId('pi-permission-picker').click();
  const menu=page.locator('.pi-office-menu:not([data-exiting])');await menu.getByText('文件写入逐次由教师确认',{exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.pi-office-menu:not([data-exiting])')?.hasAttribute('data-entering'));
  assert(await menu.getByText('文件写入逐次由教师确认',{exact:true}).isVisible());await fit(menu);
  await page.screenshot({path:path.join(output,`permissions-${width}x${height}.png`)});await page.keyboard.press('Escape');check(`Real permission disclosure and teacher confirmation policy reachable at ${width}x${height}`);
  await page.getByRole('button',{name:'选择模型',exact:true}).click();const models=page.locator('.pi-office-menu:not([data-exiting])');await models.getByRole('menuitemradio').first().waitFor();await page.waitForFunction(()=>!document.querySelector('.pi-office-menu:not([data-exiting])')?.hasAttribute('data-entering'));await fit(models);
  assert.equal(await models.getByRole('menuitemradio',{checked:true}).count(),1);
  await page.screenshot({path:path.join(output,`models-${width}x${height}.png`)});await page.keyboard.press('Escape');check(`Actual model selection indicator and original menu reachable at ${width}x${height}`);
  const metrics=await captureWorkspaceMetrics(page,app,output,`workspace-${width}x${height}`);report.metrics??=[];report.metrics.push(metrics);
  assert.equal(metrics.renderer.regions.sidebarHeading.fontSize,'21px');assert.equal(metrics.renderer.regions.sidebarTitle.fontSize,'15px');check(`Actual sidebar heading and conversation row match frozen type scale at ${width}x${height}`);
 }
 await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});
 await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();
 const canceled=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);assert(!canceled.workspace);assert.equal(canceled.projection.turns.length,0);check('Permission menu uses the actual chooser; cancellation grants no directory or run');
 await page.getByTestId('pi-conversation-search').click();const search=page.getByRole('textbox',{name:'搜索本地对话',exact:true});await search.fill('不会匹配的合成对话');
 assert(!await page.getByTestId(`ai-conversation-session-${session}`).isVisible());await search.fill('新对话');assert(await page.getByTestId(`ai-conversation-session-${session}`).isVisible());await page.getByTestId('pi-conversation-search').click();check('Real sidebar search changes actual rows and restores current conversation');
 const draft='尚未发送：教研办公任务草稿。';await page.getByTestId('office-prompt-input').fill(draft);
 await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'管理工作目录与权限',exact:true}).click();await page.getByTestId('pi-settings-workspace').waitFor({state:'visible'});await page.getByTestId('nav-ai').click();
 await page.getByTestId('office-conversation').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);assert.equal(await page.locator('.office-composer-container').getAttribute('data-session-id'),session);assert.equal(await page.getByTestId('office-prompt-input').inputValue(),draft);check('Permission settings/back preserves the same actual conversation and unsent draft');
 await app.evaluate(({Menu,BrowserWindow})=>{const item=Menu.getApplicationMenu().getMenuItemById('settings');item.click(item,BrowserWindow.getAllWindows()[0],{triggeredByAccelerator:false});});
 await page.getByTestId('pi-settings-workspace').waitFor({state:'visible'});await page.getByTestId('desktop-back').click();await page.getByTestId('office-conversation').waitFor({state:'visible'});
 assert.equal(await page.getByTestId('office-prompt-input').inputValue(),draft);check('Actual native Settings/back preserves the unsent draft without starting a run');
 report.success=true;
}catch(error){process.exitCode=1;report.error=String(error.stack||error).slice(0,3000);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,error:report.error,report:path.relative(desktop,path.join(output,'report.json'))}));}
