import {testMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { DatabaseSync } from 'node:sqlite';
import { captureWorkspaceMetrics, assertWorkspaceChrome, measureTextContrast } from './capture-workspace-metrics.mjs';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=fs.mkdtempSync(path.join(desktop,'test-results/xiaozhi-agent/pi-control-menus-'));
const checks=[],report={success:false,checks,boundary:'Actual formal renderer/main/typed snapshots and native Settings/back; isolated fresh data/profile; chooser cancellation controlled. No provider reply claim from menu measurements.'};
const cfg=fs.readFileSync(path.join(desktop,'.env.local'),'utf8');
const key=cfg.match(/^DEEPSEEK_API_KEY\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim();assert(key);
const buildRoot=path.dirname(path.dirname(testMain(desktop))), fixed=fingerprint(buildRoot), errors=[];
Object.assign(report,{layer:'C isolated formal Electron',humanAccepted:false,build:{root:buildRoot,files:fixed.files.length,sha256:fixed.sha256},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),contrast:[],layout:[]});
let app,page;
const check=name=>{checks.push({name,pass:true});console.log(`PASS ${name}`);};
function query(sql,values=[]){const db=new DatabaseSync(path.join(output,'data/app.db'),{readOnly:true});try{return db.prepare(sql).all(...values);}finally{db.close();}}
function sql(text){const db=new DatabaseSync(path.join(output,'data/app.db'));try{db.exec(text);}finally{db.close();}}
async function fit(locator){const rect=await locator.boundingBox(),view=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));assert(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=view.width+1&&rect.y+rect.height<=view.height+1);}
try{
 const env={...process.env,DEEPSEEK_API_KEY:key,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_DATA_ROOT:path.join(output,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..')};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[testMain(desktop),`--user-data-dir=${path.join(output,'profile')}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',error=>errors.push(String(error).replaceAll(key,'[credential]')));
 await page.getByTestId('office-conversation').waitFor({state:'visible',timeout:60000});await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
 const session=await page.locator('.office-composer-container').getAttribute('data-session-id');
 await page.getByTestId('ai-conversation-folder-new').click();await page.getByTestId('ai-conversation-folder-name').fill('合成会话分类');await page.getByTestId('ai-conversation-folder-save').click();
 await page.getByTestId('ai-conversation-success').waitFor();
 const folder=query('SELECT id FROM ai_conversation_folders WHERE name=?',['合成会话分类'])[0].id;
 const sessionRow=()=>page.getByTestId(`ai-conversation-session-${session}`).locator('xpath=ancestor::*[@role="row"]');
 const folderRow=()=>page.getByTestId(`ai-conversation-folder-${folder}`).locator('.ai-folder-title').first();
 const context=()=>page.getByTestId('ai-conversation-context-menu');
 async function waitMenu(){await context().getByRole('menu').waitFor();await page.waitForFunction(()=>!document.querySelector('[data-testid="ai-conversation-context-menu"]')?.hasAttribute('data-entering'));}
 for(const theme of ['light','dark'])for(const [width,height]of[[1366,768],[1920,1080]]){
  await page.emulateMedia({colorScheme:theme});
  await app.browserWindow(page).then(win=>win.evaluate((window,size)=>window.setContentSize(...size),[width,height]));
  await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
  for(const [name,trigger,label] of [['permissions','pi-permission-picker','资料与操作权限'],['models',null,'模型'],['skills','pi-skill-picker','教育技能']]){
    const button=trigger?page.getByTestId(trigger):page.getByRole('button',{name:'选择模型',exact:true});
    await button.click();const menu=page.locator('.pi-office-menu:not([data-exiting])');await menu.getByRole('menu').waitFor();(report.menuAccessibility??=[]).push({theme,width,height,name,snapshot:await menu.ariaSnapshot()});
    await page.waitForFunction(()=>!document.querySelector('.pi-office-menu:not([data-exiting])')?.hasAttribute('data-entering'));
    await fit(menu); const chrome=await assertWorkspaceChrome(page);report.layout.push({theme,width,height,name,...chrome});
    if(name==='permissions')assert(await menu.getByText('文件写入逐次由教师确认',{exact:true}).isVisible());
    else assert.equal(await menu.getByRole('menuitemradio',{checked:true}).count(),1);
    const contrast=await measureTextContrast(menu.locator('[data-slot="label"]').first());report.contrast.push({theme,name,...contrast});assert(contrast.ratio>=4.5,`${theme} ${name}: contrast ${contrast.ratio}`);
    await page.keyboard.press('ArrowDown');
    const hoverTarget=menu.getByRole(name==='permissions'?'menuitem':'menuitemradio').last();await hoverTarget.hover();await page.waitForTimeout(300);
    const hoverContrast=await measureTextContrast(hoverTarget.locator('[data-slot="label"]'));report.contrast.push({theme,name,state:'hover',...hoverContrast});assert(hoverContrast.ratio>=4.5,`${theme} ${name} hover contrast ${hoverContrast.ratio}`);
    await page.screenshot({path:path.join(output,`${name}-${theme}-${width}x${height}.png`),animations:'disabled'});
    await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});await page.waitForFunction(selector=>document.activeElement?.matches(selector),trigger?`[data-testid="${trigger}"]`:'button[aria-label="选择模型"]',{timeout:3000});assert(await button.evaluate(e=>e===document.activeElement));
    await assertWorkspaceChrome(page);check(`Actual ${name} menu fits, has contrast, keyboard escape restores focus at ${theme} ${width}x${height}`);
  }
  const metrics=await captureWorkspaceMetrics(page,app,output,`workspace-${theme}-${width}x${height}`);report.metrics??=[];report.metrics.push(metrics);
  assert.equal(metrics.renderer.regions.sidebarHeading.fontSize,'21px');assert.equal(metrics.renderer.regions.sidebarTitle.fontSize,'15px');
  assert.equal(metrics.native.contentBounds.width,width);assert.equal(metrics.native.contentBounds.height,height);
  check(`Actual native window and sidebar scale at ${theme} ${width}x${height}`);
  for(const [kind,trigger,shortcut] of [['session',sessionRow(),'Shift+F10'],['folder',folderRow(),'ContextMenu']]){
    await trigger.focus();await page.keyboard.press(shortcut);await waitMenu();await fit(context());
    const anchor=await page.getByTestId('ai-conversation-menu-anchor').boundingBox(),triggerBounds=await trigger.boundingBox(),menuBounds=await context().boundingBox();
    assert(anchor&&triggerBounds&&menuBounds);assert(Math.abs(anchor.x-triggerBounds.x-12)<2);assert(Math.abs(anchor.y-triggerBounds.y-triggerBounds.height)<2);assert(Math.abs(menuBounds.x-anchor.x)<2);assert(menuBounds.width>=200);
    assert(await page.getByTestId('ai-conversation-context-rename').evaluate(n=>n===document.activeElement));
    await page.keyboard.press('ArrowDown');assert(await page.getByTestId('ai-conversation-context-archive').evaluate(n=>n===document.activeElement));
    await page.keyboard.press('Home');assert(await page.getByTestId('ai-conversation-context-rename').evaluate(n=>n===document.activeElement));
    await page.keyboard.press('End');assert(await page.getByTestId('ai-conversation-context-archive').evaluate(n=>n===document.activeElement));
    for(const item of ['rename','archive']){const contrast=await measureTextContrast(page.getByTestId(`ai-conversation-context-${item}`).locator('[data-slot="label"]'));assert(contrast.ratio>=4.5);report.contrast.push({theme,width,kind,item,...contrast});}
    await page.screenshot({path:path.join(output,`context-${kind}-${theme}-${width}x${height}.png`),animations:'disabled'});
    await page.keyboard.press('Escape');await context().waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.matches('[role="row"],.ai-folder-title'));
    assert(await trigger.evaluate(n=>n===document.activeElement));await assertWorkspaceChrome(page);
    check(`Actual ${kind} keyboard menu, Home/End/arrows/Escape focus restore at ${theme} ${width}x${height}`);
  }
  // Controlled edge coordinates exercise RAC collision, separately from the actual pointer/keyboard paths.
  for(const [x,y] of [[1,1],[width-1,height-1]]){
    await sessionRow().evaluate((element,point)=>element.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:point.x,clientY:point.y})),{x,y});await waitMenu();await fit(context());
    const anchor=await page.getByTestId('ai-conversation-menu-anchor').boundingBox(),rect=await context().boundingBox();assert(anchor&&rect);assert(Math.abs(anchor.x-Math.max(12,Math.min(x,width-12)))<2&&Math.abs(anchor.y-Math.max(12,Math.min(y,height-12)))<2);
    if(x>1){assert(rect.x>width/2&&rect.y>height/2,'Menu must remain near the requested lower/right corner');assert(rect.x+rect.width<=width-11&&rect.y+rect.height<=height-11);}else{assert(rect.x<25&&rect.y<25);}
    report.contextEdges??=[];report.contextEdges.push({theme,width,height,x,y,rect:await context().boundingBox(),input:'controlled contextmenu coordinates on actual row'});
    if(x>1)await page.screenshot({path:path.join(output,`context-edge-${theme}-${width}x${height}.png`),animations:'disabled'});
    await page.keyboard.press('Escape');await context().waitFor({state:'hidden'});
  }check(`Controlled corner coordinates fit native viewport ${theme} ${width}x${height}`);
 }
 await page.emulateMedia({colorScheme:'light'});
 await sessionRow().click({button:'right'});await waitMenu();const outside=await page.getByTestId('office-prompt-input').boundingBox();assert(outside);await page.mouse.click(outside.x+outside.width/2,outside.y+outside.height/2);await context().waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.matches('[role="row"]'));assert(await sessionRow().evaluate(n=>n===document.activeElement));check('Actual outside pointer dismisses context menu with focus restored');
 await sessionRow().focus();await page.keyboard.press('Shift+F10');await waitMenu();await page.getByTestId('ai-conversation-sidebar').dispatchEvent('scroll');await context().waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.matches('[role="row"]'));check('Controlled outside-scroll event closes context menu without changing the active conversation');
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
 const before=query('SELECT * FROM ai_conversation_sessions WHERE id=?',[session])[0];
 await sessionRow().click({button:'right'});await waitMenu();await page.getByTestId('ai-conversation-context-rename').click();
 const rename=page.getByTestId(`ai-conversation-rename-session-${session}`);await rename.fill('');await rename.press('Enter');await page.getByRole('alert').getByText('名称不能为空。',{exact:true}).waitFor();assert.equal(query('SELECT title FROM ai_conversation_sessions WHERE id=?',[session])[0].title,before.title);
 await rename.press('Escape');await rename.waitFor({state:'hidden'});assert(await sessionRow().evaluate(n=>n===document.activeElement));check('Actual pointer menu and empty-name rejection/cancel preserve the row and keyboard focus');
 sql(`CREATE TRIGGER menu_test_failure BEFORE UPDATE OF title ON ai_conversation_sessions BEGIN SELECT RAISE(ABORT,'合成重命名故障'); END;`);
 await sessionRow().focus();await page.keyboard.press('Shift+F10');await waitMenu();await page.keyboard.press('Enter');await rename.fill('合成教研会话复核');await rename.press('Enter');await page.getByRole('alert').filter({hasText:'合成重命名故障'}).waitFor();assert.equal(query('SELECT title FROM ai_conversation_sessions WHERE id=?',[session])[0].title,before.title);assert.equal(await rename.inputValue(),'合成教研会话复核');
 sql('DROP TRIGGER menu_test_failure');await rename.press('Enter');await rename.waitFor({state:'hidden'});assert.equal(query('SELECT title FROM ai_conversation_sessions WHERE id=?',[session])[0].title,'合成教研会话复核');assert(await sessionRow().evaluate(n=>n===document.activeElement));check('Actual IPC/SQLite injected failure keeps edit and original data; retry persists manual title with focus restored');
 await folderRow().focus();await page.keyboard.press('ContextMenu');await waitMenu();await page.keyboard.press('Enter');const folderRename=page.getByTestId(`ai-conversation-rename-folder-${folder}`);await folderRename.fill('合成办公分类复核');await folderRename.press('Enter');await folderRename.waitFor({state:'hidden'});assert.equal(query('SELECT name FROM ai_conversation_folders WHERE id=?',[folder])[0].name,'合成办公分类复核');assert(await folderRow().evaluate(n=>n===document.activeElement));check('Actual folder keyboard rename uses persisted service and restores focus');
 for(const trigger of [sessionRow(),folderRow()]){
   await trigger.focus();await page.keyboard.press('Shift+F10');await waitMenu();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.getByRole('alertdialog').waitFor();await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='ai-conversation-archive-cancel');await page.keyboard.press('Escape');await page.getByRole('alertdialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.matches('[role="row"],.ai-folder-title'));assert(await trigger.evaluate(n=>n===document.activeElement));
 }assert.equal(query('SELECT archived_at FROM ai_conversation_sessions WHERE id=?',[session])[0].archived_at,null);assert.equal(query('SELECT archived_at FROM ai_conversation_folders WHERE id=?',[folder])[0].archived_at,null);check('Session/folder menu Enter opens safe confirmation; Escape cancels and restores original focus without archive');
 sql("CREATE TRIGGER menu_archive_failure BEFORE UPDATE OF archived_at ON ai_conversation_sessions BEGIN SELECT RAISE(ABORT,'合成归档故障'); END;");
 await sessionRow().focus();await page.keyboard.press('Shift+F10');await waitMenu();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.getByTestId('ai-conversation-archive-confirm').click();await page.getByRole('alert').filter({hasText:'合成归档故障'}).waitFor();assert.equal(query('SELECT archived_at FROM ai_conversation_sessions WHERE id=?',[session])[0].archived_at,null);assert(await page.getByRole('alertdialog').isVisible());await page.getByTestId('ai-conversation-archive-cancel').click();await page.getByRole('alertdialog').waitFor({state:'hidden'});sql('DROP TRIGGER menu_archive_failure');check('Actual IPC/SQLite injected archive failure retains confirmation and history; cancel remains usable');
 assert.equal(await page.getByTestId('office-prompt-input').inputValue(),draft);assert.equal((await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session)).projection.turns.length,0);
 await folderRow().click({button:'right'});await waitMenu();await page.getByTestId('ai-conversation-context-archive').click();await page.getByTestId('ai-conversation-archive-confirm').click();await folderRow().waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='ai-conversation-new');assert(query('SELECT archived_at FROM ai_conversation_folders WHERE id=?',[folder])[0].archived_at);check('Actual empty-folder archive persists; removed trigger restores focus to new chat without model execution');
 const rowsBefore=query('SELECT * FROM ai_conversation_messages WHERE session_id=?',[session]);
 await app.close();app=await electron.launch({args:[testMain(desktop),`--user-data-dir=${path.join(output,'profile')}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',error=>errors.push(String(error).replaceAll(key,'[credential]')));await page.getByTestId('office-conversation').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
 assert.equal(query('SELECT title FROM ai_conversation_sessions WHERE id=?',[session])[0].title,'合成教研会话复核');assert.equal(query('SELECT title_source FROM ai_conversation_sessions WHERE id=?',[session])[0].title_source,'manual');assert.equal(await page.getByTestId(`ai-conversation-folder-${folder}`).count(),0);assert.deepEqual(query('SELECT * FROM ai_conversation_messages WHERE session_id=?',[session]),rowsBefore);assert.equal((await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session)).projection.turns.length,0);check('Same owned profile cold restart retains actual title/archive/messages and starts zero model turns');
 assert.deepEqual(errors,[]);assert.equal(fingerprint(buildRoot).sha256,fixed.sha256);report.rendererErrors=errors;report.success=true;
}catch(error){report.focus=await page?.evaluate(()=>({tag:document.activeElement?.tagName,testId:document.activeElement?.getAttribute('data-testid'),aria:document.activeElement?.getAttribute('aria-label')})).catch(()=>null);process.exitCode=1;report.error=String(error.stack||error).replaceAll(key,'[credential]').slice(0,3000);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,error:report.error,report:path.relative(desktop,path.join(output,'report.json'))}));}
