/** Original UI, copied synthetic FX09 history, local SSE for Stop; never a real provider. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {_electron as electron} from 'playwright';
import {fingerprint} from '../acceptance/evidence.mjs';
const desktop=path.resolve(import.meta.dirname,'../..'),build=path.resolve(process.argv[2]);
const source=path.resolve(process.argv[3]);const original=JSON.parse(fs.readFileSync(path.join(source,'report.json')));assert(original.ok);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-body-layout-'));
const digest=value=>createHash('sha256').update(value).digest('hex'),buildHash=fingerprint(build).sha256,scriptHash=digest(fs.readFileSync(import.meta.filename));
const report={ok:false,root,build,buildHash,scriptHash,source,checks:[],cases:[],requests:[],errors:[],
 boundary:'Isolated actual original UI and Pi, copied synthetic persisted FX09 only; locally controlled SSE. Page zoom is not physical DPI; no real provider, pointer dragging, IME, screen reader, Office or installer acceptance.'};
let app,page,kind;
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const until=async(fn,ms=20000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,40));}throw Error('condition timeout');};
const prompt=()=>page.getByTestId('office-prompt-input');
const session=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
const snapshot=async()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),await session());
const longDraft=Array.from({length:22},(_,i)=>`第${i+1}行教师草稿：比较力与运动，保留原例题与讲解。`).join('\n');
function persisted(){const db=new DatabaseSync(path.join(root,'history/data/app.db'),{readOnly:true});try{
 const events=db.prepare('SELECT event_json,event_hash FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence').all(original.runId);
 const messages=db.prepare('SELECT id,content,metadata_json FROM ai_conversation_messages WHERE session_id=? ORDER BY id').all(original.sessionId);
 const target=messages.filter(row=>JSON.parse(row.metadata_json||'{}').agentRunId===original.runId&&row.content===events.map(row=>JSON.parse(row.event_json)).filter(e=>e.kind==='text_delta').map(e=>e.delta).join(''));
 assert.equal(target.length,1);assert.equal(digest(target[0].content),original.rawTextSha256);
 return{events:digest(JSON.stringify(events)),messages:digest(JSON.stringify(messages)),body:digest(target[0].content)};
}finally{db.close();}}
async function launch(next){kind=next;const fixture=path.join(root,kind);const env={...process.env,OMNI_EDU_DATA_ROOT:path.join(fixture,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-body-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_E2E_VISIBLE'])delete env[key];
 app=await electron.launch({args:[path.join(build,'main/index.js'),'--user-data-dir='+path.join(fixture,'profile')],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net})=>{globalThis.bodyFixture={phase:'disabled',requests:[]};net.fetch=async(input,init)=>{const url=typeof input==='string'?input:input.url;
  if(url.endsWith('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
  const f=globalThis.bodyFixture;if(!url.endsWith('/chat/completions')||f.phase!=='stream')throw Error('No provider allowed');
  const record={local:true,aborted:false,chunks:0};f.requests.push(record);const body=JSON.parse(init.body),encoder=new TextEncoder();
  const emit=(controller,delta,finish_reason=null)=>controller.enqueue(encoder.encode('data: '+JSON.stringify({id:'body-stop',object:'chat.completion.chunk',model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n'));
  return new Response(new ReadableStream({async start(controller){try{emit(controller,{role:'assistant'});for(let i=0;i<1500;i++){init.signal?.throwIfAborted();emit(controller,{content:`公开本地教学说明${i}：先观察再比较。\n\n`});record.chunks++;await new Promise(r=>setTimeout(r,20));}emit(controller,{},'stop');controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close();}catch(e){record.aborted=true;controller.error(e);}}}),{headers:{'content-type':'text/event-stream'}});
 };});
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('[data-testid=office-prompt-input]')?.disabled);
}
async function screenshot(name){const native=await app.evaluate(async({BrowserWindow})=>{const bitmap=await BrowserWindow.getAllWindows()[0].webContents.capturePage();return{data:bitmap.toDataURL(),size:bitmap.getSize()};});fs.writeFileSync(path.join(root,name),Buffer.from(native.data.split(',')[1],'base64'));(report.screenshots??=[]).push({name,size:native.size,viewport:await page.evaluate(()=>[innerWidth,innerHeight])});}
async function close(){if(!app)return;report.requests.push(...await app.evaluate(()=>globalThis.bodyFixture.requests));await app.close();app=undefined;}
async function resize(width,height,zoom){await app.evaluate(({BrowserWindow},[width,height,zoom])=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setZoomFactor(zoom);w.webContents.emit('zoom-changed',{},'in');w.setContentSize(width,height);},[width,height,zoom]);await page.waitForFunction(([w,z])=>Math.abs(innerWidth-w/z)<=1,[width,zoom]);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function reachable(locator){await locator.scrollIntoViewIfNeeded();if(!await locator.isDisabled().catch(()=>false))await locator.focus();const result=await locator.evaluate(el=>{
 const r=el.getBoundingClientRect();let left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
 for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(['auto','scroll','hidden','clip'].includes(s.overflowX)){left=Math.max(left,b.left);right=Math.min(right,b.right);}if(['auto','scroll','hidden','clip'].includes(s.overflowY)){top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}}
 return{label:el.getAttribute('aria-label')||el.textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom},viewport:[innerWidth,innerHeight],visible:[right-left,bottom-top],hit:document.elementFromPoint((left+right)/2,(top+bottom)/2)?.closest('button')===el};
 });assert(result.visible[0]>=Math.min(result.rect.width,24)-1,JSON.stringify(result));assert(result.visible[1]>=Math.min(result.rect.height,24)-1,JSON.stringify(result));if(await locator.evaluate(e=>e.tagName==='BUTTON'&&!e.disabled))assert(result.hit,JSON.stringify(result));return result;}
async function command(id){await app.evaluate(({Menu,BrowserWindow},id)=>{const item=Menu.getApplicationMenu().getMenuItemById(id);item.click(item,BrowserWindow.getAllWindows()[0],{triggeredByAccelerator:false});},id);}
async function popover(trigger,name){await reachable(trigger);await trigger.click();const menu=page.getByRole('menu',{name,exact:true});await menu.waitFor();const rect=await menu.locator('..').boundingBox(),view=await page.evaluate(()=>[innerWidth,innerHeight]);assert(rect.x>=-1&&rect.y>=-1&&rect.x+rect.width<=view[0]+1&&rect.y+rect.height<=view[1]+1,JSON.stringify({name,rect,view}));await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});}
try{
 for(const name of['data','profile'])fs.cpSync(path.join(source,name),path.join(root,'history',name),{recursive:true});
 report.persistedBefore=persisted();
 for(const next of['empty','history']){
  await launch(next);const id=await session();if(next==='history'){assert.equal(id,original.sessionId);assert.equal((await snapshot()).projection.turns.length,11);}
  await prompt().fill(longDraft);
  for(const[width,height,zoom]of[[390,768,1],[390,768,1.5],[390,768,2],[480,768,1.25],[1366,768,1],[1366,768,1.5],[1366,768,2],[1920,1080,1],[1920,1080,1.5]]){
   await resize(width,height,zoom);const controls=[];
   if(width/zoom<=360){const layout=await page.evaluate(()=>({width:innerWidth,workspace:document.querySelector('.edu-workspace').getBoundingClientRect().toJSON(),nav:getComputedStyle(document.querySelector('[data-testid=edu-navigation]')).display}));assert.equal(layout.nav,'none');assert(Math.abs(layout.workspace.width-layout.width)<=1,JSON.stringify(layout));}
   const buttons=page.locator('[data-testid=pi-workspace-header] button,.office-composer-container button');
   for(let i=0;i<await buttons.count();i++)if(await buttons.nth(i).isVisible())controls.push(await reachable(buttons.nth(i)));
   assert.equal(await prompt().inputValue(),longDraft);assert.equal(await session(),id);
   report.cases.push({kind:next,width,height,zoom,controls});
  }
  check(`${next}: nine actual content sizes/zooms keep original header/composer controls reachable with a 22-line draft, without session/draft loss`);
  await resize(390,768,1.5);
  await popover(page.getByRole('button',{name:'选择模型',exact:true}),'选择模型');
  await popover(page.getByTestId('pi-thinking-session-trigger'),'思考强度');
  check(`${next}: original model and thinking menus open within the tiny viewport and Escape closes them`);
  await reachable(page.getByTestId('pi-files-toggle'));await page.getByTestId('pi-files-toggle').click();await page.getByTestId('edu-context-panel').waitFor();await reachable(page.getByTestId('workbench-panel-close'));await page.getByTestId('workbench-tab-tasks').click();await page.getByTestId('workbench-panel-close').click();
  assert.equal(await prompt().inputValue(),longDraft);check(`${next}: real file/task panel remains closable and preserves the composer draft`);
  await command('sidebar');await page.getByTestId('edu-navigation').waitFor({state:'visible'});const nav=await page.getByTestId('edu-navigation').boundingBox();assert(nav.x>=0&&nav.x+nav.width<=260+1);await command('sidebar');await page.getByTestId('edu-navigation').waitFor({state:'hidden'});
  check(`${next}: hidden narrow navigation is still available through the existing native sidebar command`);
  await screenshot(`${next}-after.png`);
  if(next==='empty'){
   await reachable(page.getByTestId('pi-workspace-more'));await page.getByTestId('pi-workspace-more').click();await page.getByRole('menuitem',{name:'设置',exact:true}).click();await page.getByTestId('pi-settings-workspace').waitFor();
   await screenshot('settings-top-after.png');const main=page.getByTestId('pi-settings-main');const size=await main.boundingBox();assert(size.width>=200,JSON.stringify(size));
   await reachable(page.getByTestId('pi-settings-search'));await reachable(main.getByTestId('pi-settings-default-model'));const labelWidth=await main.locator('.pi-model-settings-model-row .edu-setting-label').evaluate(el=>el.getBoundingClientRect().width);assert(labelWidth>=120,'Default model label collapsed to a vertical strip');await reachable(main.getByRole('button',{name:'保存',exact:true}));
   await screenshot('settings-after.png');await page.getByTestId('nav-ai').click();await page.getByTestId('xiaozhi-pi-workspace').waitFor();assert.equal(await prompt().inputValue(),longDraft);
   check('Actual narrow settings has a usable main column, reachable search/Save and returns to the same unsent draft without saving credentials');
   await prompt().fill('只输出教学说明，保持长流直到我停止。');await reachable(page.getByRole('button',{name:'发送消息',exact:true}));await app.evaluate(()=>{globalThis.bodyFixture.phase='stream';});await page.getByRole('button',{name:'发送消息',exact:true}).click();
   await until(async()=>(await snapshot()).running);await until(async()=>(await app.evaluate(()=>globalThis.bodyFixture.requests[0]?.chunks||0))>=5);
   const stop=page.getByRole('button',{name:'停止本轮',exact:true});await reachable(stop);await stop.click();await until(async()=>!(await snapshot()).running);await until(()=>app.evaluate(()=>globalThis.bodyFixture.requests[0]?.aborted));assert.equal((await snapshot()).projection.turns.at(-1).status,'interrupted');
   await prompt().fill('停止后仍保留的教师草稿');check('A real original Pi local stream can be stopped from the tiny viewport; no later chunks or actions are sent');
  }
  const durable=JSON.stringify((await snapshot()).projection.turns),draft=await prompt().inputValue();await close();await launch(next);assert.equal(await session(),id);assert.equal(await prompt().inputValue(),draft);assert.equal(JSON.stringify((await snapshot()).projection.turns),durable);assert.equal((await app.evaluate(()=>globalThis.bodyFixture.requests.length)),0);await close();
  check(`${next}: cold restore preserves the same actual session, draft and projection without replay`);
 }
 report.persistedAfter=persisted();assert.deepEqual(report.persistedAfter,report.persistedBefore);assert.equal(report.requests.length,1);assert(report.requests.every(r=>r.local&&r.aborted));assert.deepEqual(report.errors,[]);assert.equal(fingerprint(build).sha256,buildHash);assert.equal(digest(fs.readFileSync(import.meta.filename)),scriptHash);report.ok=true;
}catch(e){report.error=String(e.stack||e);if(page&&!page.isClosed()){report.failureUi=await page.evaluate(()=>({view:[innerWidth,innerHeight],model:document.querySelector('[aria-label="选择模型"]')?.outerHTML,menus:[...document.querySelectorAll('[role=menu],[data-slot*=popover]')].map(el=>({role:el.getAttribute('role'),label:el.getAttribute('aria-label'),rect:el.getBoundingClientRect().toJSON()}))})).catch(()=>null);await screenshot('failure.png').catch(()=>{});}process.exitCode=1;}
finally{await close().catch(()=>{});fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,root,checks:report.checks.length,error:report.error}));}
