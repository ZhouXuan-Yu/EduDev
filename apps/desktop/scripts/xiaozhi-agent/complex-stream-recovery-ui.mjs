/** Cold readback + real Win32 pointer gestures on the preserved FX09 fixture. No new generation. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';

const desktop=path.resolve(import.meta.dirname,'../..');
const root=path.resolve(process.argv[2]);
const original=JSON.parse(fs.readFileSync(path.join(root,'report.json'),'utf8'));
assert(original.ok,'Requires the successful preserved FX09 fixture');
assert.equal(original.root,root);
const readbackOnly=process.argv.includes('--readback-only');
const build=path.resolve(process.argv.slice(3).find(arg=>!arg.startsWith('--'))||original.build);
const sha=value=>createHash('sha256').update(value).digest('hex');
const report={ok:false,root,build,checks:[],errors:[],providerRequests:0,
  boundary:'Preserved synthetic FX09 data only; actual Pi readback, original SQLite and Win32 physical pointer. No provider or teacher data. No full DPI/IME/installer acceptance.'};
let app,page;
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const until=async fn=>{const end=Date.now()+15000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('condition timeout');};
const bounds=()=>app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return{bounds:w.getBounds(),normal:w.getNormalBounds(),maximized:w.isMaximized(),minimized:w.isMinimized(),visible:w.isVisible()};});
function persisted(){
 const db=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});
 try{
  const journal=db.prepare('SELECT event_json,event_hash FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence').all(original.runId);
  const text=journal.map(row=>JSON.parse(row.event_json)).filter(event=>event.kind==='text_delta').map(event=>event.delta).join('');
  const messages=db.prepare('SELECT id,content,metadata_json FROM ai_conversation_messages WHERE session_id=? AND role=?').all(original.sessionId,'assistant');
  const matching=messages.filter(row=>JSON.parse(row.metadata_json||'{}').agentRunId===original.runId);
  assert.equal(matching.length,1);assert.equal(sha(matching[0].content),original.rawTextSha256);assert.equal(sha(text),original.rawTextSha256);
  assert.equal(sha(JSON.stringify(journal)),original.journal.sha256);
  return {journalRows:journal.length,journalSha256:sha(JSON.stringify(journal)),textSha256:sha(text),messageId:matching[0].id};
 }finally{db.close();}
}
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:path.join(root,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1',DEEPSEEK_API_KEY:'synthetic-recovery-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 app=await electron.launch({args:[path.join(build,'main/index.js'),'--user-data-dir='+path.join(root,'profile')],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net})=>{globalThis.c02UnexpectedRequests=[];net.fetch=async(input)=>{const url=typeof input==='string'?input:input.url;if(url.endsWith('/models'))return new Response(JSON.stringify({data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});globalThis.c02UnexpectedRequests.push(url);throw Error('No provider allowed during cold readback');};});
 page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function pointer(action,options={}){
 const handle=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getNativeWindowHandle().readBigUInt64LE().toString());
 const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(import.meta.dirname,'native-caption-pointer.ps1'),'-WindowHandle',handle,'-Action',action];
 for(const [key,value] of Object.entries(options))args.push('-'+key,String(value));
 return JSON.parse(execFileSync('powershell.exe',args,{encoding:'utf8',timeout:10000,windowsHide:true}).trim());
}
try{
 report.persistedBefore=persisted();check('Exact assistant message and full text_delta journal match the saved UI SHA and unchanged journal hash');
 await launch();
 const snap=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),original.sessionId);
 const turn=snap.projection.turns.find(turn=>turn.id===original.runId);assert(turn);assert.equal(snap.projection.turns.length,11);
 assert.equal(sha(turn.items.filter(item=>item.kind==='message'&&item.role==='assistant').map(item=>item.text||'').join('')),original.rawTextSha256);
 await page.getByTestId('agent-reply-body').last().getByText('复杂流式正文完成。',{exact:false}).waitFor();
 assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'生成期间的教师草稿 29');
 check('Cold actual UI restores all eleven runs, exact complex正文 and unsent draft without replay');
 if(readbackOnly){
  report.providerRequests=await app.evaluate(()=>globalThis.c02UnexpectedRequests.length);assert.equal(report.providerRequests,0);assert.deepEqual(report.errors,[]);
  report.persistedAfter=persisted();assert.deepEqual(report.persistedAfter,report.persistedBefore);
  check('Readback-only completion keeps exact persisted records, no renderer errors and zero provider requests');report.ok=true;
 }else{
 // Only initial setup uses setBounds. Movements below must be caused by actual OS pointer input.
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setBounds({x:80,y:70,width:1200,height:780});w.show();w.focus();});
 report.normalBefore=await bounds();report.normalGesture=await pointer('drag');report.normalAfter=await bounds();
 assert(!report.normalAfter.maximized);assert(Math.abs(report.normalAfter.bounds.x-report.normalBefore.bounds.x)>50);assert(Math.abs(report.normalAfter.bounds.y-report.normalBefore.bounds.y)>30);
 check('Real foreground Win32 caption pointer moves the normal window in both axes');
 report.maximizeGesture=await pointer('click',{OffsetRightDip:69});await until(async()=>(await bounds()).maximized);
 report.maximizedBefore=await bounds();report.restoreGesture=await pointer('drag',{DeltaX:-80,DeltaY:160});await until(async()=>!(await bounds()).maximized);
 report.restoredAfter=await bounds();assert(report.restoredAfter.bounds.y>0);assert(report.restoredAfter.bounds.width<report.maximizedBefore.bounds.width);
 check('Real native maximize button and maximized caption drag restore a movable normal window');
 const beforeMenu=await bounds();await page.getByTestId('desktop-menu-file').click();
 await app.evaluate(({Menu,BrowserWindow})=>Menu.getApplicationMenu().getMenuItemById('file').submenu.closePopup(BrowserWindow.getAllWindows()[0]));
 assert.deepEqual((await bounds()).bounds,beforeMenu.bounds);check('Actual File menu trigger stays clickable without dragging the window');
 report.minimizeGesture=await pointer('click',{OffsetRightDip:115});await until(async()=>(await bounds()).minimized);
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.restore();w.focus();});await until(async()=>!(await bounds()).minimized);
 check('Actual native minimize button minimizes and restore keeps the same UI');
 report.savedNormal=(await bounds()).normal;
 report.providerRequests+=await app.evaluate(()=>globalThis.c02UnexpectedRequests.length);assert.equal(report.providerRequests,0);
 await page.screenshot({path:path.join(root,'native-restored.png')});
 await pointer('click',{OffsetRightDip:23});await until(async()=>app.process().exitCode!==null);app=undefined;
 report.persistedAfter=persisted();assert.deepEqual(report.persistedAfter,report.persistedBefore);
 await launch();report.restarted=await bounds();assert.deepEqual(report.restarted.normal,report.savedNormal);
 report.providerRequests+=await app.evaluate(()=>globalThis.c02UnexpectedRequests.length);assert.equal(report.providerRequests,0);assert.deepEqual(report.errors,[]);
 check('Actual native close and cold restart preserve normal geometry, journal/message text and zero provider requests');
 await page.screenshot({path:path.join(root,'native-restarted.png')});report.ok=true;
 }
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error.stack);await page?.screenshot({path:path.join(root,'native-failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(root,readbackOnly?'readback-report.json':'recovery-native-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,root,checks:report.checks.length,error:report.error}));}
