import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-read-scheduler-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),workshop=path.join(output,'workshop');fs.mkdirSync(workshop);
const gold=Array.from({length:13},(_,i)=>({file:`lesson-${String(i+1).padStart(2,'0')}.md`,marker:`EDU${randomBytes(4).toString('hex').toUpperCase()}`}));
for(const item of gold)fs.writeFileSync(path.join(workshop,item.file),`# 教研资料 ${item.file}\n课堂主题：分数教学。\n资料核对码：${item.marker}\n`);
fs.writeFileSync(path.join(output,'gold.json'),JSON.stringify(gold,null,2));
const buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out'),main=testMain(process.cwd()),fixed=fingerprint(buildRoot);
const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const report={success:false,checks:[],build:{root:buildRoot,sha256:fixed.sha256,files:fixed.files.length},scriptSha256:sha256(fs.readFileSync(new URL(import.meta.url))),humanAccepted:false,scope:'Formal Pi/Electron/real DeepSeek, 13 real owned synthetic files via UI and normal cold restore. Natural SDK batches are measured; no injected model/tool latency and no inference of actual peak from batch size. Not daily profile, VPN-off, network/image or 12-active-slot UI acceptance.'};
let app,page,session;const errors=[];
const pass=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
async function until(fn,ms=180000){const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,100));}throw Error('Read UI observation timed out');}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
function query(sql,args=[]){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}}
function nativeFile(){return path.join(data,'xiaozhi-pi',query('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[session])[0].session_file);}
async function launch(){
 const env={...process.env,DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:'deepseek-flash',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 const current=await page.locator('.office-composer-container').getAttribute('data-session-id');if(session)assert.equal(current,session);session=current;report.session=session;(report.launches??=[]).push(await assertIsolatedPiMain(app,main,profile));
 if(process.argv.includes('--observe')){
  const file=fs.readdirSync(path.join(buildRoot,'main')).find(n=>/^pi-session-.*\.js$/.test(n));assert(file);const lines=fs.readFileSync(path.join(buildRoot,'main',file),'utf8').split('\n');
  const start=lines.findIndex(l=>l.includes('executionStartedAt = performance.now()')),end=lines.findIndex(l=>l.includes('executionMs = Math.max'));assert(start>=0&&end>start);
  await app.evaluate(async(_electron,locations)=>{
   const observer=new(process.getBuiltinModule('inspector').Session)();observer.connect();globalThis.readObserver=observer;globalThis.readObservation={active:0,peak:0,rows:[]};
   const post=(method,params={})=>new Promise((resolve,reject)=>observer.post(method,params,(e,r)=>e?reject(e):resolve(r)));
   await post('Debugger.enable');const urlRegex=locations.file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$';
   // Conditional logpoints never pause or substitute a response. They only
   // observe entry/finally of the actual reviewed read in this owned process.
   await post('Debugger.setBreakpointByUrl',{urlRegex,lineNumber:locations.start,condition:'(manifest.effect === "safe_read" && (globalThis.readObservation.active++, globalThis.readObservation.peak=Math.max(globalThis.readObservation.peak,globalThis.readObservation.active),globalThis.readObservation.rows.push({event:"enter",callId,tool:def.name,at:performance.now()})),false)'});
   await post('Debugger.setBreakpointByUrl',{urlRegex,lineNumber:locations.end,condition:'(manifest.effect === "safe_read" && (globalThis.readObservation.active--,globalThis.readObservation.rows.push({event:"exit",callId,tool:def.name,at:performance.now()})),false)'});
  },{file,start,end});
 }
 if(process.argv.includes('--diagnostic')){
 const source=fs.readFileSync(main,'utf8'),match=/catch \((\w+)\) \{\n\s+const code = \1 instanceof Error \? \1.message : "";\n\s+failure\d* = code === "authentication"/.exec(source);assert(match,'Owned host catch location missing');
 const lineNumber=source.slice(0,match.index).split('\n').length;
 await app.evaluate(async(_electron,location)=>{
  const inspector=process.getBuiltinModule('inspector'),observer=new inspector.Session();observer.connect();globalThis.readDiagnostics=[];globalThis.readDiagnosticObserver=observer;
  const post=(method,params={})=>new Promise((resolve,reject)=>observer.post(method,params,(e,r)=>e?reject(e):resolve(r)));
  await post('Debugger.enable');await post('Debugger.setBreakpointByUrl',{urlRegex:'index\\.js$',lineNumber:location.lineNumber,condition:`(globalThis.readDiagnostics.push({message:String(${location.variable}.message).replace(/sk-[A-Za-z0-9._-]+/g,'[credential]'),stack:String(${location.variable}.stack).replace(/sk-[A-Za-z0-9._-]+/g,'[credential]').slice(0,3000)}),false)`});
 },{lineNumber,variable:match[1]});
 }
}
try{
 await launch();await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},workshop);
 await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();await until(async()=>(await snapshot()).workspace);
 await page.getByTestId('office-prompt-input').fill(`请真实读取工作目录下这13份独立教研资料：${gold.map(i=>i.file).join('、')}。每份文件都必须调用 office_read_text 读取正文；它们彼此独立，请尽可能在同一批工具调用中并行读取，不要先读两份就停止，不要调用创建/修改/复制工具。最后按文件名逐行列出各文件实际的资料核对码，不要猜测或追问。`);
 await page.getByRole('button',{name:'发送消息',exact:true}).click();assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');
 const turn=await until(async()=>{const s=await snapshot(),t=s.projection.turns.at(-1);return !s.running&&['completed','failed','interrupted'].includes(t?.status)?t:undefined;});assert.equal(turn.status,'completed',turn.error);report.runId=turn.id;
 const lines=fs.readFileSync(nativeFile(),'utf8').trim().split('\n').map(JSON.parse),messages=lines.map(l=>l.message).filter(Boolean);
 const batches=messages.filter(m=>m.role==='assistant').map(m=>m.content?.filter(c=>c.type==='toolCall')||[]).filter(v=>v.length);
 const reads=batches.flat().filter(t=>t.name==='office_read_text');report.natural={batchSizes:batches.map(v=>v.length),readCalls:reads.length,maxRequestedBatch:Math.max(0,...batches.map(v=>v.length)),actualActivePeak:'not instrumented; cannot infer from SDK batch size'};
 const results=messages.filter(m=>m.role==='toolResult'&&reads.some(t=>t.id===m.toolCallId));
 for(const g of gold){const calls=reads.filter(t=>t.arguments.path===g.file);assert(calls.length>0,`Unread file ${g.file}`);assert(results.some(m=>calls.some(t=>t.id===m.toolCallId)&&!m.isError&&JSON.stringify(m.content).includes(g.marker)),`No real tool result for ${g.file}`);}
 assert.equal(new Set(reads.map(t=>t.arguments.path)).size,13);const response=turn.items.filter(i=>i.kind==='message'&&i.role==='assistant').map(i=>i.text).join('\n');for(const g of gold)assert(response.includes(g.marker),`Wrong response ${g.file}`);
 if(process.argv.includes('--observe')){const observation=await app.evaluate(()=>globalThis.readObservation);assert.equal(observation.active,0);assert(observation.peak>0&&observation.peak<=12);for(const call of reads){assert.equal(observation.rows.filter(r=>r.callId===call.id&&r.event==='enter').length,1);assert.equal(observation.rows.filter(r=>r.callId===call.id&&r.event==='exit').length,1);}report.natural.actualActivePeak=observation.peak;report.natural.observation=observation;report.natural.observer='Non-pausing V8 logpoints at production underlying read entry/finally; timing includes debugger observer overhead, not a throughput benchmark';await app.evaluate(()=>globalThis.readObserver.disconnect());}
 pass('Actual Pi model requests and receives all 13 independent real files; final reply matches frozen hidden markers');
 const events=query('SELECT event_json FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence',[turn.id]).map(v=>JSON.parse(v.event_json)),attempts=events.filter(e=>e.kind==='tool_attempt');
 for(const call of reads){const own=attempts.filter(e=>e.attempt.callId===call.id);assert.deepEqual(own.map(e=>e.attempt.state),['queued','started','succeeded']);const a=own.at(-1).attempt;assert(Number.isFinite(a.queueWaitMs)&&Number.isFinite(a.executionMs));const item=turn.items.find(i=>i.id===call.id);assert.deepEqual(item.toolAttempt,a);assert.equal(item.status,'completed');const receipt=query('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?',[turn.id,call.id])[0];assert.equal(receipt.admitted,1);assert.equal(receipt.success,1);}
 report.attempts=attempts;pass('Typed snapshot, SQLite journal and admitted receipts agree on per-call queued/started/succeeded and both durations');
 const item=page.locator(`[data-testid="office-tool-step"][data-item-id="${reads[0].id}"]`),group=item.locator('xpath=ancestor::*[@data-testid="office-tool-group"]');
 if(await group.count()){const trigger=group.locator('[data-slot="chat-tool-group-trigger"]');if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();}
 const trigger=item.locator('[data-slot="chat-tool-trigger"]');if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
 const timing=item.getByTestId('pi-tool-timing');await timing.waitFor();assert((await timing.innerText()).includes('本次排队'));assert((await timing.innerText()).includes('本次执行用时'));
 for(const [width,height,theme] of [[1366,768,'light'],[1920,1080,'dark']]){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});await page.emulateMedia({colorScheme:theme});await timing.scrollIntoViewIfNeeded();const box=await timing.boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);await page.screenshot({path:path.join(output,`read-timing-${theme}-${width}.png`),animations:'disabled'});}
 pass('Real tool disclosure exposes both durations at 1366 light and 1920 dark');
 const saved=(await snapshot()).projection.turns,before=fs.readFileSync(nativeFile());await page.reload();await page.getByTestId('xiaozhi-pi-workspace').waitFor();assert.deepEqual((await snapshot()).projection.turns,saved);assert(before.equals(fs.readFileSync(nativeFile())));
 await app.close();app=undefined;await launch();assert.deepEqual((await snapshot()).projection.turns,saved);assert(before.equals(fs.readFileSync(nativeFile())));assert.equal(query('SELECT count(*) n FROM xiaozhi_event_journal WHERE run_id=?',[turn.id])[0].n,events.length);
 pass('Reload and normal cold restart preserve exact process/timing/native history and add no tool or model replay');
 for(const g of gold)assert(fs.readFileSync(path.join(workshop,g.file),'utf8').includes(g.marker));assert.equal(fs.readdirSync(workshop).length,13);assert.deepEqual(errors,[]);assert.equal(fingerprint(buildRoot).sha256,fixed.sha256);pass('Owned source files and frozen build unchanged; no renderer errors');report.success=true;
}catch(error){report.error=String(error.stack).replaceAll(key,'[credential]').slice(0,4500);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});if(page&&session)report.lastSnapshot=await snapshot().catch(()=>undefined);}finally{if(app&&process.argv.includes('--diagnostic'))report.diagnostics=await app.evaluate(()=>{globalThis.readDiagnosticObserver?.post('Debugger.setPauseOnExceptions',{state:'none'});globalThis.readDiagnosticObserver?.disconnect();return globalThis.readDiagnostics;}).catch(()=>undefined);await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,natural:report.natural,error:report.error}));}
