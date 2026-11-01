/** Original Electron shell, isolated synthetic drafts, no provider calls or OS pointer automation. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {_electron as electron} from 'playwright';
import {fingerprint} from '../acceptance/evidence.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const build=path.resolve(process.argv[2]);
assert(fs.existsSync(path.join(build,'main/index.js')),'Pass an immutable completed build');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-caption-layout-'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const mainHash=hash(path.join(build,'main/index.js'));
const buildFingerprint=fingerprint(build);
const scriptHash=hash(import.meta.filename);
const report={ok:false,root,build,mainHash,scriptHash,buildFingerprint,checks:[],layouts:[],errors:[],requests:[],
 boundary:'Actual original Electron/Pi shell and native Menu popup, isolated synthetic data. Page zoom is not physical system DPI; MenuItem callback routing is not actual OS menu selection. No caption pointer/IME/screen-reader/installer/full AT acceptance.'};
let app,page;
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const until=async fn=>{const end=Date.now()+15000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,40));}throw Error('condition timeout');};
const session=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
const input=()=>page.getByTestId('office-prompt-input');
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:path.join(root,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-caption-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_E2E_VISIBLE'])delete env[k];
 app=await electron.launch({args:[path.join(build,'main/index.js'),'--user-data-dir='+path.join(root,'profile')],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net,Menu})=>{
  globalThis.captionRequests=[];globalThis.captionPopups=[];
  net.fetch=async input=>{const url=typeof input==='string'?input:input.url;
   if(url.endsWith('/models'))return new Response(JSON.stringify({data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
   globalThis.captionRequests.push(url);throw Error('Provider forbidden in caption test');};
  const popup=Menu.prototype.popup;
  Menu.prototype.popup=function(options){globalThis.captionPopups.push({labels:this.items.map(item=>item.label),x:options.x,y:options.y});return popup.call(this,options);};
 });
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function close(){if(!app)return;report.requests.push(...await app.evaluate(()=>globalThis.captionRequests));await app.close();app=undefined;}
async function command(id){await app.evaluate(({Menu,BrowserWindow},id)=>{const item=Menu.getApplicationMenu().getMenuItemById(id);if(!item)throw Error('Missing command '+id);item.click(item,BrowserWindow.getAllWindows()[0],{triggeredByAccelerator:false});},id);}
async function resize(width,height,zoom){
 await app.evaluate(({BrowserWindow},[width,height,zoom])=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setZoomFactor(zoom);w.webContents.emit('zoom-changed',{},'in');w.setContentSize(width,height);},[width,height,zoom]);
 await page.waitForFunction(([width,zoom])=>Math.abs(innerWidth-width/zoom)<=1,[width,zoom]);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
async function measure(){return page.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const title=document.querySelector('[data-testid=desktop-titlebar]'),controls=document.querySelector('[data-testid=desktop-titlebar-safe]');
 const style=getComputedStyle(title),overlay=navigator.windowControlsOverlay.getTitlebarAreaRect().toJSON();
 return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},overlay,
  title:rect(title),padding:[style.paddingLeft,style.paddingRight],controls:rect(controls),drag:rect(document.querySelector('[data-testid=desktop-titlebar-drag]')),
  buttons:[...controls.querySelectorAll('button')].filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return{id:el.dataset.testid,label:el.getAttribute('aria-label')||el.textContent,disabled:el.disabled,rect:rect(el),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el};})};
 });}
try{
 await launch();
 const originalSession=await session();await input().fill('窄窗教师草稿：力与运动');
 // All widths use actual BrowserWindow content sizing; zoom includes the native overlay sync.
 for(const [width,height]of[[390,768],[480,768],[800,768],[1366,768],[1920,1080]])for(const zoom of[1,1.25,1.5,2]){
  await resize(width,height,zoom);const layout=await measure();layout.requested={width,height,zoom};report.layouts.push(layout);
  assert(layout.overlay.width>0);assert(layout.drag.width>=31.5,JSON.stringify(layout));
  assert(layout.drag.x>=layout.controls.right-0.75);assert(layout.drag.right<=layout.overlay.x+layout.overlay.width+0.75);
  for(const button of layout.buttons){assert(button.label?.trim());assert(button.rect.width>=30);assert(button.rect.x>=layout.overlay.x-0.75);assert(button.rect.right<=layout.drag.x+0.75);if(!button.disabled)assert(button.hit,button.id);}
  const compact=layout.buttons.some(button=>button.id==='desktop-menu-app');
  assert.equal(compact,layout.overlay.width<=420.75);
  if(compact)assert(!layout.buttons.some(button=>button.id==='desktop-menu-file'));
  else assert(layout.buttons.some(button=>button.id==='desktop-menu-help'));
  assert.equal(await input().inputValue(),'窄窗教师草稿：力与运动');
 }
 check('20 actual native content sizes/page zooms keep accessible controls outside caption buttons and at least 32 CSS px of drag space, without losing the draft');
 await resize(390,768,1);
 const tree=await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.map(item=>({label:item.label,id:item.id,children:item.submenu?.items.map(child=>({id:child.id,label:child.label,role:child.role,accelerator:child.accelerator}))})));
 report.menu=tree;assert.deepEqual(tree.map(item=>item.id),['file','edit','view','help']);
 for(const role of['undo','redo','cut','copy','paste','selectall'])assert(tree.find(item=>item.id==='edit').children.some(item=>item.role===role));
 for(const id of['back','forward','sidebar','files','zoom-in','zoom-out','zoom-reset'])assert(tree.find(item=>item.id==='view').children.some(item=>item.id===id));
 check('Compact application menu retains all four native groups, original editing roles and navigation/zoom commands');
 for(const trigger of['click','keyboard']){
  const count=await app.evaluate(()=>globalThis.captionPopups.length);
  const button=page.getByTestId('desktop-menu-app');
  if(trigger==='click')await button.click();else{await button.focus();await button.press('Enter');}
  await until(async()=>(await app.evaluate(()=>globalThis.captionPopups.length))>count);
  const popup=await app.evaluate(()=>globalThis.captionPopups.at(-1));assert.deepEqual(popup.labels,['文件','编辑','视图','帮助']);
  assert(popup.x>=0&&popup.x<390&&popup.y>0&&popup.y<768);
  await app.evaluate(({Menu,BrowserWindow})=>Menu.getApplicationMenu().closePopup(BrowserWindow.getAllWindows()[0]));
 }
 check('Actual compact button click and focused Enter invoke the original native application Menu popup at valid coordinates');
 for(const [group,x,y]of[['other',1,1],['app',-1,1],['app',100000,0],['app',0,Infinity]])assert.equal((await page.evaluate(([g,x,y])=>window.omniEdu.openDesktopMenu(g,x,y),[group,x,y])).error,'invalid_input');
 const denied=await app.evaluate(async({BrowserWindow},preload)=>{const other=new BrowserWindow({show:false,webPreferences:{preload,contextIsolation:true,sandbox:true}});try{await other.loadURL('data:text/html,<html></html>');return await other.webContents.executeJavaScript("window.omniEdu.openDesktopMenu('app',1,1)");}finally{other.destroy();}},path.join(build,'preload/index.cjs'));
 assert.equal(denied.error,'permission_denied');check('Application menu preserves input validation and rejects a different renderer sender');
 await command('new-chat');await until(async()=>await session()!==originalSession);const nextSession=await session();await input().fill('另一个会话的草稿');
 await command('back');await until(async()=>await session()===originalSession);assert.equal(await input().inputValue(),'窄窗教师草稿：力与运动');
 await command('forward');await until(async()=>await session()===nextSession);assert.equal(await input().inputValue(),'另一个会话的草稿');
 await command('back');await until(async()=>await session()===originalSession);
 check('Native back/forward MenuItem callbacks navigate real sessions and preserve each separate draft when narrow buttons are hidden');
 await resize(390,768,1.5);await page.screenshot({path:path.join(root,'narrow-zoom150.png')});
 await close();await launch();assert.equal(await session(),originalSession);assert.equal(await input().inputValue(),'窄窗教师草稿：力与运动');
 for(const id of[originalSession,nextSession]){const snapshot=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);assert.equal(snapshot.projection.turns.length,0);}
 check('Cold actual UI retains the active session and draft; both sessions have no run or model work');
 await close();assert.deepEqual(report.requests,[]);assert.deepEqual(report.errors,[]);assert.equal(hash(path.join(build,'main/index.js')),mainHash);assert.equal(fingerprint(build).sha256,buildFingerprint.sha256);assert.equal(hash(import.meta.filename),scriptHash);report.ok=true;
}catch(e){report.error=String(e.stack||e);process.exitCode=1;}
finally{await close().catch(()=>{});fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root,error:report.error}));}
