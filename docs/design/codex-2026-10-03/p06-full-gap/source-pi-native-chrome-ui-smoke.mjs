import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),output=fs.mkdtempSync(path.join(desktop,'test-results/xiaozhi-agent/pi-chrome-ui-'));
const report={success:false,checks:[],viewports:[],boundaries:['Actual Windows Electron/main/menu roles/typed IPC and native window capture; isolated synthetic database/profile','Actual titlebar menu popup pointer and menu command callbacks/accelerator; no claim of manual OS-menu item pointer or native caption button pointer verification','Reference DPI unknown; no overall Codex pixel-match/other OS/VPN or provider proof']};
let app,page;const errors=[];
const check=name=>{report.checks.push({name,pass:true});console.log(`PASS ${name}`);};
async function until(fn,ms=20000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,80));}throw new Error('Native chrome condition timed out');}
async function launch(disabled=false,geometryDisabled=false){const env={...process.env,OMNI_EDU_DATA_ROOT:path.join(output,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_NATIVE_CHROME:disabled?'0':'1',OMNI_EDU_WINDOW_GEOMETRY:geometryDisabled?'0':'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
  app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),`--user-data-dir=${path.join(output,'profile')}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',error=>errors.push(String(error)));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
}
const session=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
const list=()=>page.evaluate(()=>window.omniEdu.listAiConversations());
const command=id=>app.evaluate(({Menu,BrowserWindow},key)=>{const item=Menu.getApplicationMenu().getMenuItemById(key);if(!item)throw new Error('Missing actual menu item');item.click(item,BrowserWindow.getAllWindows()[0],{triggeredByAccelerator:false});},id);
async function captureNative(name){const captured=await app.evaluate(async({BrowserWindow,desktopCapturer,screen})=>{
  const window=BrowserWindow.getAllWindows()[0],bounds=window.getBounds(),id=window.getMediaSourceId();
  const scale=screen.getDisplayMatching(bounds).scaleFactor;
  const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:Math.ceil(bounds.width*scale),height:Math.ceil(bounds.height*scale)}});
  const own=sources.find(source=>source.id===id);if(!own||own.thumbnail.isEmpty())throw new Error('Own native window capture missing');
  return {window:bounds,content:window.getContentBounds(),captureScale:scale,nativePng:own.thumbnail.getSize(),png:own.thumbnail.toPNG().toString('base64')};
});fs.writeFileSync(path.join(output,name),Buffer.from(captured.png,'base64'));const {png,...metrics}=captured;return metrics;}
try{
  await launch();report.runtime=await app.evaluate(({app,screen,BrowserWindow})=>({version:process.versions.electron,platform:process.platform,userData:app.getPath('userData'),display:screen.getPrimaryDisplay(),window:BrowserWindow.getAllWindows()[0].getBounds()}));
  assert.equal(report.runtime.platform,'win32');assert.equal((await page.evaluate(()=>window.omniEdu.getDesktopChrome())).enabled,true);check('Actual main enables native Windows overlay and renderer frame with isolated profile');
  const titlebar=await page.getByTestId('desktop-titlebar').boundingBox();assert.equal(titlebar.height,36);assert.equal(titlebar.y,0);
  assert.equal(await page.getByTestId('desktop-back').isDisabled(),false);assert.equal(await page.getByTestId('desktop-forward').isDisabled(),true);
  const first=await session();await page.getByTestId('desktop-back').click();assert.equal(await session(),first);await page.getByTestId('desktop-forward').click();assert.equal(await session(),first);
  check('Initial history navigation returns the real same conversation without starting a model task');
  await app.evaluate(({Menu})=>{globalThis.chromePopups=[];const original=Menu.prototype.popup;Menu.prototype.popup=function(options){globalThis.chromePopups.push({x:options.x,y:options.y});return original.call(this,options);};});
  for(const group of ['file','edit','view','help']){
    await page.getByTestId(`desktop-menu-${group}`).click();await until(async()=>(await app.evaluate(()=>globalThis.chromePopups.length))>0);
    await app.evaluate(({Menu,BrowserWindow},key)=>{Menu.getApplicationMenu().getMenuItemById(key).submenu.closePopup(BrowserWindow.getAllWindows()[0]);globalThis.chromePopups=[];},group);
  }
  check('Each HeroUI menu trigger opens its actual Electron native popup in the titlebar');
  const roles=await app.evaluate(({Menu})=>Menu.getApplicationMenu().getMenuItemById('edit').submenu.items.map(item=>item.role));for(const role of ['undo','redo','cut','copy','paste','selectall'])assert(roles.includes(role));check('Edit menu contains actual Electron roles, preserving native focus/clipboard semantics');
  const before=(await list()).sessions.length;await app.evaluate(({BrowserWindow})=>{
    const window=BrowserWindow.getAllWindows()[0];window.focus();window.webContents.focus();
    window.webContents.sendInputEvent({type:'keyDown',keyCode:'N',modifiers:['control']});window.webContents.sendInputEvent({type:'keyUp',keyCode:'N',modifiers:['control']});
  });await until(async()=>(await list()).sessions.length===before+1);await until(async()=>(await session())!==first);const second=await session();check('Real Electron Ctrl+N input accelerator creates exactly one SQLite-backed conversation');
  await page.getByTestId('desktop-back').click();await until(async()=>await session()===first);await page.getByTestId('desktop-forward').click();await until(async()=>await session()===second);check('Actual back/forward switches current conversation IDs without copying or replaying turns');
  await command('settings');await page.getByTestId('nav-ai').waitFor({state:'visible'});await page.getByTestId('desktop-back').click();await page.getByTestId('xiaozhi-pi-workspace').waitFor();await until(async()=>await session()===second);check('Native Settings command and Back return to the exact active conversation');
  await page.getByTestId('desktop-sidebar').click();await until(async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('xiaozhi.ui.v1'))).sidebar===false);await command('sidebar');await until(async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('xiaozhi.ui.v1'))).sidebar===true);check('Titlebar and native View menu share the real Pro sidebar state');
  await command('files');await page.getByTestId('pi-file-error').waitFor();assert((await page.getByTestId('pi-file-error').innerText()).includes('选择教学工作目录'));await command('files');await page.getByTestId('pi-file-panel').waitFor({state:'hidden'});check('Native Files command opens the actual panel and preserves no-workspace authority denial');
  for(const [group,x,y] of [['other',1,1],['file',-1,0],['edit',100000,0],['view',0,Infinity]])assert.equal((await page.evaluate(([g,x,y])=>window.omniEdu.openDesktopMenu(g,x,y),[group,x,y])).error,'invalid_input');check('Actual typed menu IPC rejects unknown groups and invalid/out-of-window coordinates');
  report.sender=await app.evaluate(async({BrowserWindow},preload)=>{const side=new BrowserWindow({show:false,webPreferences:{preload,contextIsolation:true,sandbox:true,nodeIntegration:false}});
    try{await side.loadURL('data:text/html,<html></html>');return await side.webContents.executeJavaScript(`(async()=>({menu:await window.omniEdu.openDesktopMenu('file',1,1),state:await window.omniEdu.getDesktopChrome().then(()=> 'unexpected').catch(()=> 'denied')}))()`);}finally{side.destroy();}},path.join(desktop,'out/preload/index.cjs'));
  assert.equal(report.sender.menu.error,'permission_denied');assert.equal(report.sender.state,'denied');check('A different actual renderer with the same preload cannot access main-window chrome');
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await app.evaluate(({BrowserWindow},size)=>{const w=BrowserWindow.getAllWindows()[0];w.setPosition(0,0);w.setContentSize(...size);},[width,height]);await until(async()=>(await page.getByTestId('desktop-titlebar').boundingBox()).width>=width-2);
    const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,body:document.body.scrollHeight,drag:getComputedStyle(document.querySelector('.desktop-titlebar')).getPropertyValue('-webkit-app-region'),button:getComputedStyle(document.querySelector('[data-testid="desktop-back"]')).getPropertyValue('-webkit-app-region'),overlay:navigator.windowControlsOverlay?.getTitlebarAreaRect().toJSON(),visible:navigator.windowControlsOverlay?.visible}));
    const menu=await page.getByTestId('desktop-menu-help').boundingBox(),send=await page.locator('.office-composer [data-slot="prompt-input-send"]').boundingBox();assert.equal(metrics.width,width);assert.equal(metrics.height,height);assert.equal(metrics.drag,'drag');assert.equal(metrics.button,'no-drag');assert(metrics.visible);assert(menu.x+menu.width<=metrics.overlay.x+metrics.overlay.width);assert(send.y+send.height<=height+1);assert(metrics.body<=height+1);
    await page.screenshot({path:path.join(output,`content-${width}x${height}.png`)});const native=await captureNative(`native-${width}x${height}.png`);report.viewports.push({width,height,metrics,native});check(`Actual window/content/native caption capture and reachable input at ${width}x${height}`);
  }
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1.25/1.2));await command('zoom-in');await until(async()=>Math.abs((await page.evaluate(()=>window.omniEdu.getDesktopChrome())).zoomFactor-1.25)<0.001);
  const zoom=await page.evaluate(()=>({height:document.querySelector('.desktop-titlebar').getBoundingClientRect().height,overlay:navigator.windowControlsOverlay.getTitlebarAreaRect().toJSON(),width:innerWidth}));assert(Math.abs(zoom.height-36)<1);assert(Math.abs(zoom.overlay.height-36)<2);assert((await page.getByTestId('desktop-menu-help').boundingBox()).x<zoom.overlay.width);
  report.zoom125=zoom;await captureNative('native-zoom125.png');check('Actual View zoom command synchronizes native overlay height/safe area at 125 percent');
  await command('zoom-reset');await until(async()=>(await page.evaluate(()=>window.omniEdu.getDesktopChrome())).zoomFactor===1);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].maximize());await until(async()=>(await page.evaluate(()=>window.omniEdu.getDesktopChrome())).maximized);await captureNative('native-maximized.png');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].unmaximize());await until(async()=>!(await page.evaluate(()=>window.omniEdu.getDesktopChrome())).maximized);check('Native maximize/restore events update actual main and renderer state');
  const sessions=(await list()).sessions;for(const item of sessions){const snap=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),item.id);assert.equal(snap.projection.turns.length,0);}check('Window menus/navigation/preview never submit provider work or create task effects');
  await command('settings');await page.getByTestId('nav-ai').waitFor();const newBefore=(await list()).sessions.length;await command('new-chat');await page.getByTestId('xiaozhi-pi-workspace').waitFor();await until(async()=>(await list()).sessions.length===newBefore+1);check('Native New Chat from an education/settings page reaches Pi and consumes one pending action');
  await until(async()=>await session()!==second);const third=await session();
  const raceBefore=(await list()).sessions.length;
  await app.evaluate(({Menu,BrowserWindow})=>{const menu=Menu.getApplicationMenu(),window=BrowserWindow.getAllWindows()[0];for(const id of ['new-chat','settings']){const item=menu.getMenuItemById(id);item.click(item,window,{triggeredByAccelerator:false});}});
  await page.getByTestId('nav-ai').waitFor({state:'visible'});await until(async()=>(await list()).sessions.length===raceBefore+1);await new Promise(r=>setTimeout(r,200));assert(await page.getByTestId('nav-ai').isVisible());
  await page.getByTestId('nav-ai').click();await page.getByTestId('xiaozhi-pi-workspace').waitFor();await until(async()=>await session()===third);check('A real pending New Chat completion cannot override a later Settings navigation after Pi unmount');
  await page.getByTestId(`ai-conversation-session-${second}`).click({button:'right'});await page.getByTestId('ai-conversation-context-archive').click();await page.getByTestId('ai-conversation-archive-confirm').click();await until(async()=>(await list()).archivedSessions.some(item=>item.id===second));
  for(let step=0;step<8&&!(await page.getByTestId('desktop-back').isDisabled());step++){
    await page.getByTestId('desktop-back').click();await new Promise(r=>setTimeout(r,160));
    if(await page.getByTestId('xiaozhi-pi-workspace').isVisible())assert.notEqual(await session(),second);
  }
  assert(await page.getByTestId('desktop-back').isDisabled());check('Actual archived session is skipped and removed from navigation without an endless Back loop');
  await page.getByTestId(`ai-conversation-session-${third}`).click();await until(async()=>await session()===third);
  const countBeforeRestart=(await list()).sessions.length;
  const geometryFile=path.join(output,'profile','desktop-window.v1.json');
  const normalBeforeClose=await app.evaluate(({BrowserWindow,screen})=>{
    const w=BrowserWindow.getAllWindows()[0],area=screen.getPrimaryDisplay().workArea;
    w.setBounds({x:area.x+25,y:area.y+20,width:Math.max(1100,Math.min(1280,area.width-50)),height:Math.max(720,Math.min(780,area.height-40))});
    return w.getNormalBounds();
  });
  await app.close();app=undefined;await launch();assert.equal((await page.evaluate(()=>window.omniEdu.getDesktopChrome())).zoomFactor,1);assert.equal(await session(),third);assert.equal((await list()).sessions.length,countBeforeRestart);
  await page.getByTestId('desktop-back').click();assert.equal(await session(),third);assert(await page.getByTestId('desktop-back').isDisabled());check('Actual restart resets the navigation stack and restores current session without replay');
  const normalAfterRestart=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getNormalBounds());
  assert.deepEqual(normalAfterRestart,normalBeforeClose);report.geometry={normalBeforeClose,normalAfterRestart,saved:JSON.parse(fs.readFileSync(geometryFile))};check('Actual move/resize immediately followed by close restores normal dimensions and position');
  report.geometry.repeated=[];
  for(let restart=0;restart<2;restart++){
    await app.close();app=undefined;await launch();const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getNormalBounds());assert.deepEqual(bounds,normalBeforeClose);report.geometry.repeated.push(bounds);
  }
  check('Three actual normal-window launches preserve exact saved bounds without accumulating DPI drift');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].maximize());await until(async()=>(await page.evaluate(()=>window.omniEdu.getDesktopChrome())).maximized);
  await app.close();app=undefined;await launch();assert((await page.evaluate(()=>window.omniEdu.getDesktopChrome())).maximized);
  const savedMax=JSON.parse(fs.readFileSync(geometryFile));assert(savedMax.maximized);assert.equal(savedMax.width,normalBeforeClose.width);assert.equal(savedMax.height,normalBeforeClose.height);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].unmaximize());await until(async()=>!(await page.evaluate(()=>window.omniEdu.getDesktopChrome())).maximized);
  assert.deepEqual(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getNormalBounds()),normalBeforeClose);check('Actual maximized restart retains separate normal bounds and restores them on unmaximize');
  const area=report.runtime.display.workArea;
  const fallback={width:Math.max(1100,Math.min(1360,area.width)),height:Math.max(720,Math.min(900,area.height))};
  for(const [name,body] of [['corrupt','{broken'],['unknown-version',JSON.stringify({...savedMax,version:2})],['invalid-field',JSON.stringify({...savedMax,x:'25'})],['oversized-file',' '.repeat(4097)]]){
    await app.close();app=undefined;fs.writeFileSync(geometryFile,body);await launch();
    const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());assert.equal(bounds.width,fallback.width);assert(Math.abs(bounds.height-fallback.height)<=1,'At most one fractional-DPI physical rounding for a new default dimension');assert.equal((await page.evaluate(()=>window.omniEdu.getDesktopChrome())).maximized,false);
    check(`Actual ${name} UI geometry falls back to usable defaults without losing the active conversation`);assert.equal(await session(),third);
  }
  await app.close();app=undefined;fs.writeFileSync(geometryFile,JSON.stringify({version:1,width:999999,height:999999,x:999999,y:-999999,maximized:false}));await launch();
  const bounded=await app.evaluate(({BrowserWindow,screen})=>{const w=BrowserWindow.getAllWindows()[0];return {bounds:w.getBounds(),area:screen.getDisplayMatching(w.getBounds()).workArea};});
  assert.equal(bounded.bounds.x,bounded.area.x);assert.equal(bounded.bounds.y,bounded.area.y);assert(bounded.bounds.width<=bounded.area.width&&bounded.bounds.width>=bounded.area.width-2);assert(bounded.bounds.height<=bounded.area.height&&bounded.bounds.height>=bounded.area.height-2);report.geometry.offscreen=bounded;check('Actual valid but offscreen/oversized geometry remains fully inside the available work area with bounded DPI inset');
  await captureNative('native-restored-bounded.png');
  await app.close();app=undefined;const retained=fs.readFileSync(geometryFile);await launch(false,true);
  const rollback=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());assert.equal(rollback.width,1360);assert(Math.abs(rollback.height-900)<=4,'Original constructor/native frame has bounded fractional-DPI rounding');report.geometry.rollback=rollback;await app.close();app=undefined;assert.deepEqual(fs.readFileSync(geometryFile),retained);check('Explicit geometry rollback starts original fixed options and preserves the saved UI file byte for byte');
  fs.unlinkSync(geometryFile);fs.mkdirSync(geometryFile);await launch();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1200,760));await until(async()=>(await page.getByTestId('office-prompt-input').isDisabled())===false);await app.close();app=undefined;assert(fs.statSync(geometryFile).isDirectory());fs.rmdirSync(geometryFile);check('Actual unwritable geometry target never prevents launching, interaction or close');
  await launch(true);assert.equal(await page.getByTestId('desktop-titlebar').count(),0);assert.equal((await page.evaluate(()=>window.omniEdu.getDesktopChrome())).enabled,false);assert(await page.locator('.office-composer [data-slot="prompt-input-send"]').isVisible());check('Explicit local rollback uses the original system frame without leaving a blank titlebar row');
  assert.deepEqual(errors,[]);report.success=true;
}catch(error){process.exitCode=1;report.error=String(error.stack||error).slice(0,3500);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});report.rendererErrors=errors;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,report:path.relative(desktop,path.join(output,'report.json'))}));}
