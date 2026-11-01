/** Actual native geometry persistence. setBounds is setup, never evidence of pointer dragging. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {_electron as electron} from 'playwright';
const desktop=path.resolve(import.meta.dirname,'../..'),build=path.resolve(process.argv[2]);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-c02-geometry-'));
const profile=path.join(root,'profile'),geometry=path.join(profile,'desktop-window.v1.json');
const report={ok:false,root,build,checks:[],errors:[],requests:0,windows:[],boundary:'Actual original UI/native cold launches with synthetic isolated data; setBounds/maximize are setup for persistence checks, not proof of actual caption pointer or full multi-DPI acceptance.'};
let app,page;
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const state=()=>app.evaluate(({BrowserWindow,screen})=>{const w=BrowserWindow.getAllWindows()[0];return {normal:w.getNormalBounds(),bounds:w.getBounds(),maximized:w.isMaximized(),area:screen.getDisplayMatching(w.getBounds()).workArea};});
const until=async fn=>{const end=Date.now()+15000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('condition timeout');};
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:path.join(root,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:'synthetic-geometry-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 app=await electron.launch({args:[path.join(build,'main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net})=>{globalThis.geometryRequests=0;net.fetch=async input=>{const url=typeof input==='string'?input:input.url;if(url.endsWith('/models'))return new Response(JSON.stringify({data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});globalThis.geometryRequests++;throw Error('No provider allowed');};});
 page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
 report.windows.push(await state());
}
async function close(){report.requests+=await app.evaluate(()=>globalThis.geometryRequests);await app.close();app=undefined;}
try{
 await launch();
 await page.getByTestId('office-prompt-input').fill('窗口重启后保留的教师草稿');
 const session=await page.locator('.office-composer-container').getAttribute('data-session-id');report.sessionId=session;
 // Close immediately after each native resize: do not rely on the debounce completing.
 report.narrow=[];
 for(const width of [480,800,390]){
  await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setBounds({x:90,y:80,width,height:760}),width);
  const before=await state();await close();const saved=JSON.parse(fs.readFileSync(geometry));
  assert.equal(saved.width,before.normal.width);assert.equal(saved.x,before.normal.x);assert.equal(saved.y,before.normal.y);
  await launch();const after=await state();assert.deepEqual(after.normal,before.normal);
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'窗口重启后保留的教师草稿');
  assert.equal(await page.locator('.office-composer-container').getAttribute('data-session-id'),session);
  report.narrow.push({requested:width,before,after,saved});check(`Actual ${width}px normal window retains exact native size/position, same session and draft after immediate close/restart`);
 }
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].maximize());await until(async()=>(await state()).maximized);
 const normal=(await state()).normal;await close();await launch();assert((await state()).maximized);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].unmaximize());await until(async()=>!(await state()).maximized);assert.deepEqual((await state()).normal,normal);
 check('Maximized cold restart retains the narrow normal bounds for restore');
 const displays=await app.evaluate(({screen})=>({primary:screen.getPrimaryDisplay().id,displays:screen.getAllDisplays()}));report.displays=displays;
 const second=displays.displays.find(display=>display.id!==displays.primary);assert(second,'AT-C02-04 requires a connected second display');
 await app.evaluate(({BrowserWindow},area)=>BrowserWindow.getAllWindows()[0].setBounds({x:area.x+80,y:area.y+60,width:1200,height:760}),second.workArea);
 const onSecond=await state();await close();await launch();const secondRestart=await state();assert.deepEqual(secondRestart.normal,onSecond.normal);assert.deepEqual(secondRestart.area,second.workArea);
 report.secondDisplay={before:onSecond,after:secondRestart};check('Actual second-display native coordinates and size survive close/restart across the two real monitor scale factors');
 await close();fs.writeFileSync(geometry,JSON.stringify({version:1,width:1280,height:760,x:999999,y:-999999,maximized:false}));await launch();
 const clamped=await state();assert(clamped.bounds.x>=clamped.area.x);assert(clamped.bounds.y>=clamped.area.y);assert(clamped.bounds.x+clamped.bounds.width<=clamped.area.x+clamped.area.width);assert(clamped.bounds.y+clamped.bounds.height<=clamped.area.y+clamped.area.height);
 report.offscreen=clamped;check('Existing wide v1 preferences with a disconnected monitor restore a fully reachable window');
 await close();assert.equal(report.requests,0);assert.deepEqual(report.errors,[]);check('Every actual cold launch remains interactive with zero provider requests and renderer errors');report.ok=true;
}catch(error){report.error=error.stack;console.error(error.stack);process.exitCode=1;await page?.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,root,checks:report.checks.length,error:report.error}));}
