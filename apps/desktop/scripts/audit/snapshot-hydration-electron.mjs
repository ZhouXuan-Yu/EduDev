import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
const desktop=path.resolve(import.meta.dirname,'../..');
const gapMode=process.argv.includes('--event-gap');
const output=fs.mkdtempSync(path.join(desktop,'test-results/'+(gapMode?'audit-event-recovery-electron-':'audit-hydration-electron-')));
// Production Pi correctly rejects state anywhere under the global .codex root.
// Keep the real runtime in a private OS-temporary root, retaining its path as evidence.
const runtimeRoot=fs.mkdtempSync(path.join(os.tmpdir(),'edu-f14-runtime-')),data=path.join(runtimeRoot,'data'),profile=path.join(runtimeRoot,'profile');
const requestMarker=path.join(runtimeRoot,'controlled-request-count.txt');
const main=testMain(desktop),fixed=fingerprint(path.dirname(path.dirname(main))).sha256;
const expected=Array.from({length:50},(_,i)=>'f14-'+String(i).padStart(3,'0')+'|').join('');
const report={ok:false,gapMode,checks:[],errors:[],build:fixed,runtimeRoot,launches:[],boundary:'Real current Electron/Pi, typed preload, journal/SQLite/native files and cold process. Explicit controlled model catalogue (1M fixture capacity) and SSE text transport; no real model/capacity/teacher answer quality. Owned transport holds/rejects actual IPC reads, optionally drops/duplicates actual notifications; no synthetic journal rows or changed product hooks.'};
let app,page,idA,idB,runId;
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const until=async(fn,timeout=60000)=>{const end=Date.now()+timeout;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,40));}throw Error('Hydration Electron condition timeout');};
function query(sql,args=[]){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}}
const session=()=>page.locator('.office-composer-container').getAttribute('data-session-id');
const ready=()=>page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled&&!document.querySelector('[data-testid="pi-event-synchronization"]'));
async function launch(){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1',DEEPSEEK_API_KEY:'owned-f14-no-network-credential',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_')&&!['OMNI_EDU_E2E_DIALOG_MODE','OMNI_EDU_E2E_VISIBLE'].includes(key))delete env[key];
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 app=await electron.launch({args:[main,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});report.launches.push(await assertIsolatedPiMain(app,main,profile));
 await app.evaluate(async ({net,ipcMain,BrowserWindow},requestMarker)=>{
   const state=globalThis.hydrationAudit={hold:false,target:'',rows:[],peak:0,modelRequests:0,heldModel:true,blockedExternal:[],failNext:false,events:[],eventReads:[],eventPeaks:{},eventTrace:[],clock:0,dropped:[],dropTrace:[],notified:[],mutationCalls:0};
   net.fetch=async(input,init)=>{
     const url=typeof input==='string'?input:input.url;
     if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',object:'model',owned_by:'deepseek',context_window:1048576,max_output_tokens:8192,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
     if(!url.includes('/chat/completions')){state.blockedExternal.push(url);throw Error('Owned F14 blocks external transport');}
     state.modelRequests++;
     process.getBuiltinModule('fs').writeFileSync(requestMarker,String(state.modelRequests));
     if(state.heldModel)await new Promise((resolve,reject)=>{state.modelRelease=resolve;init?.signal?.addEventListener('abort',()=>reject(Error('owned cancelled')),{once:true});});
     const model=JSON.parse(init.body).model,encoder=new TextEncoder();
     const chunk=(delta,finish_reason=null)=>encoder.encode('data: '+JSON.stringify({id:'owned-f14',object:'chat.completion.chunk',created:0,model,choices:[{index:0,delta,finish_reason}]})+'\n\n');
     const stream=new ReadableStream({async start(controller){try{controller.enqueue(chunk({role:'assistant',content:''}));for(let i=0;i<50;i++){if(init?.signal?.aborted)throw Error('owned cancelled');controller.enqueue(chunk({content:'f14-'+String(i).padStart(3,'0')+'|'}));await new Promise(resolve=>setTimeout(resolve,4));}controller.enqueue(chunk({},'stop'));controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close();}catch(error){controller.error(error);}}});
     return new Response(stream,{headers:{'content-type':'text/event-stream'}});
   };
   for(let wait=0;wait<600&&(!ipcMain._invokeHandlers.has('xiaozhi:snapshot')||!BrowserWindow.getAllWindows().length);wait++)await new Promise(resolve=>setTimeout(resolve,50));
   const original=ipcMain._invokeHandlers.get('xiaozhi:snapshot');if(!original)throw Error('Actual snapshot handler missing');
   ipcMain.removeHandler('xiaozhi:snapshot');ipcMain.handle('xiaozhi:snapshot',async(event,target)=>{
     const row={target,done:false,held:false};state.rows.push(row);state.peak=Math.max(state.peak,state.rows.filter(row=>!row.done).length);
     try{const value=await original(event,target);row.sequence=value.projection.sourceSequence;row.cursors=value.eventCursors;if(state.target===target&&state.failNext){state.failNext=false;throw Error('owned snapshot delivery failed');}
       if(state.hold&&state.target===target){row.held=true;row.heldAtEventCount=state.events.length;await new Promise(resolve=>row.release=resolve);}return value;
     }finally{row.done=true;}
   });
   const list=ipcMain._invokeHandlers.get('xiaozhi:events');if(!list)throw Error('Actual journal handler missing');ipcMain.removeHandler('xiaozhi:events');ipcMain.handle('xiaozhi:events',async(event,input)=>{
     const row={input,done:false,order:++state.clock};state.eventReads.push(row);state.eventPeaks[input.runId]=Math.max(state.eventPeaks[input.runId]||0,state.eventReads.filter(row=>row.input.runId===input.runId&&!row.done).length);
     try{row.page=await list(event,input);if(state.holdEvents){row.held=true;await new Promise(resolve=>row.release=resolve);}if(state.rejectEventPage){row.failed=true;throw Error('Owned journal page delivery failed');}return row.page;}finally{row.done=true;}
   });
   for(const channel of ['xiaozhi:start','xiaozhi:queue']){const original=ipcMain._invokeHandlers.get(channel);if(original){ipcMain.removeHandler(channel);ipcMain.handle(channel,(...args)=>{state.mutationCalls++;return original(...args);});}}
   const web=BrowserWindow.getAllWindows()[0].webContents,send=web.send.bind(web);web.send=(channel,...args)=>{if(channel==='xiaozhi:event'){
     const event=args[0],order=++state.clock;state.events.push(event);state.eventTrace.push({event,order});
     if(event.runId===state.cutRun&&(state.dropTen&&event.sequence===10||state.dropTerminal&&event.kind==='status'&&event.status!=='running')){state.dropped.push(event);state.dropTrace.push({event,order});return;}
     state.notified.push(event);if(event.runId===state.cutRun&&state.duplicate&&[9,11].includes(event.sequence)){state.notified.push(event);send(channel,...args);}
   }return send(channel,...args);};
   BrowserWindow.getAllWindows()[0].show();BrowserWindow.getAllWindows()[0].focus();
 },requestMarker);
 page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await ready();await page.bringToFront();
}
async function close(){if(!app)return;const owned=app,child=owned.process();let timer;
 try{await owned.evaluate(()=>{const state=globalThis.hydrationAudit;if(state){state.hold=false;state.holdEvents=false;state.rejectEventPage=false;state.heldModel=false;state.modelRelease?.();for(const row of [...state.rows,...state.eventReads])row.release?.();}}).catch(()=>undefined);
   await Promise.race([owned.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned Electron close timeout')),20000);})]);await until(()=>child.exitCode!==null,10000);assert.equal(child.exitCode,0);(report.closed||=[]).push({pid:child.pid,exitCode:child.exitCode});app=undefined;
 }catch(error){if(child.exitCode===null)child.kill();throw error;}finally{clearTimeout(timer);}}
async function select(id){if(await page.getByTestId('pi-sidebar-toggle').getAttribute('aria-expanded')!=='true')await page.getByTestId('pi-sidebar-toggle').click();await page.getByTestId('ai-conversation-session-'+id).click();await until(async()=>await session()===id);}
const release=()=>app.evaluate(()=>{const state=globalThis.hydrationAudit;state.hold=false;for(const row of state.rows)row.release?.();});
try{
 await launch();idA=await session();
 if(gapMode){await eventGapJourney();}
 else {
 await page.getByTestId('office-prompt-input').fill('合成F14恢复测试：请仅回复一段短文本，不使用工具。');await page.getByTestId('office-prompt-input').press('Enter');
 await until(()=>{const failed=query("SELECT error_message FROM ai_agent_runs WHERE session_id=? AND status='failed' ORDER BY created_at DESC LIMIT 1",[idA])[0];if(failed)throw Error('Actual Pi preparation failed: '+failed.error_message);return fs.existsSync(requestMarker)&&Number(fs.readFileSync(requestMarker,'utf8'))>0;});
 runId=await until(()=>query('SELECT id FROM ai_agent_runs WHERE session_id=? ORDER BY created_at DESC LIMIT 1',[idA])[0]?.id);
 await page.getByTestId('pi-new-session').click();await until(async()=>{const id=await session();return id&&id!==idA;});await ready();idB=await session();
 await app.evaluate((_,target)=>{const state=globalThis.hydrationAudit;state.target=target;state.hold=true;state.rows=[];state.peak=0;},idA);
 await select(idA);await until(()=>app.evaluate(()=>globalThis.hydrationAudit.rows.some(row=>row.held)));assert(await page.getByTestId('office-prompt-input').isDisabled());
 await app.evaluate(()=>{const state=globalThis.hydrationAudit;state.heldModel=false;state.modelRelease();});
 await until(()=>query('SELECT status FROM xiaozhi_event_runs WHERE run_id=?',[runId])[0]?.status==='completed');
 assert.equal(query('SELECT status FROM ai_agent_runs WHERE id=?',[runId])[0]?.status,'succeeded');
 await until(()=>app.evaluate((_,runId)=>globalThis.hydrationAudit.events.some(event=>event.runId===runId&&event.kind==='status'&&event.status==='completed'),runId));
 report.beforeRelease=await app.evaluate(()=>{const state=globalThis.hydrationAudit;return {peak:state.peak,reads:state.rows.map(({target,sequence,cursors,done,held,heldAtEventCount})=>({target,sequence,cursors,done,held,heldAtEventCount})),events:state.events};});
 assert.equal(report.beforeRelease.peak,1);assert.equal(report.beforeRelease.reads.length,1);
 const first=report.beforeRelease.reads[0],cursor=first.cursors.find(cursor=>cursor.runId===runId);assert(cursor,'Held snapshot must have the actual running journal cursor');
 const later=report.beforeRelease.events.slice(first.heldAtEventCount).filter(event=>event.sessionId===idA&&event.runId===runId&&event.generation===cursor.generation&&event.sequence>cursor.sequence&&event.durability==='committed');
 assert(later.some(event=>event.kind==='text_delta'));assert(later.some(event=>event.kind==='status'&&event.status==='completed'));
 for(const event of later){const saved=query('SELECT event_json,event_hash FROM xiaozhi_event_journal WHERE run_id=? AND sequence=?',[runId,event.sequence])[0];assert(saved);assert.equal(saved.event_hash,sha256(saved.event_json));assert.deepEqual(JSON.parse(saved.event_json),event);}
 report.heldBarrier={cursor,laterCommittedSequences:later.map(event=>event.sequence)};await release();await ready();
 const turn=page.locator('.office-turn[data-turn-id="'+runId+'"]');await until(async()=>(await turn.innerText()).includes(expected));assert.equal((await turn.innerText()).split('f14-000|').length-1,1);assert.equal(await turn.getAttribute('data-state'),'completed');
 const projection=query('SELECT turn_json,sequence FROM xiaozhi_event_runs WHERE run_id=?',[runId])[0],savedTurn=JSON.parse(projection.turn_json);
 assert(savedTurn.items.some(item=>item.role==='assistant'&&item.text===expected));const journal=query('SELECT sequence,event_json,event_hash FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence',[runId]);assert.equal(journal.length,projection.sequence);assert(journal.every((row,index)=>row.sequence===index+1&&sha256(row.event_json)===row.event_hash));
 report.recovered=await app.evaluate(()=>({reads:globalThis.hydrationAudit.rows.map(({target,sequence,done})=>({target,sequence,done})),peak:globalThis.hydrationAudit.peak,modelRequests:globalThis.hydrationAudit.modelRequests}));assert.equal(report.recovered.reads.length,2);assert.equal(report.recovered.peak,1);
 check('Actual Pi committed events arrive before the held first snapshot; one stale read plus one fresh read recover exact text and terminal state');
 for(const [width,height]of [[1366,768],[1920,1080]]){await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setContentSize(width,height),{width,height});await page.getByTestId('office-prompt-input').fill('保留的教师草稿');await turn.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'recovered-'+width+'.png')});assert((await turn.innerText()).includes(expected));}check('The same completed result and editable draft remain available in both native window sizes');
 await select(idB);await ready();await app.evaluate(()=>{globalThis.hydrationAudit.hold=true;});await select(idA);await until(()=>app.evaluate(()=>globalThis.hydrationAudit.rows.some(row=>row.held&&!row.done)));await select(idB);await ready();await release();await page.waitForTimeout(100);assert.equal(await session(),idB);assert.equal(await page.locator('.office-turn').count(),0);check('Late real A snapshot delivery does not replace B after navigation');
 await app.evaluate(()=>{globalThis.hydrationAudit.failNext=true;});await select(idA);await page.waitForFunction(()=>document.querySelector('[data-testid="pi-event-synchronization"]')?.getAttribute('data-state')==='unavailable');assert(await page.getByTestId('office-prompt-input').isDisabled());const beforeRuns=query('SELECT count(*) n FROM ai_agent_runs')[0].n;await page.getByTestId('pi-event-refresh').click();await ready();assert.equal(query('SELECT count(*) n FROM ai_agent_runs')[0].n,beforeRuns);assert((await turn.innerText()).includes(expected));check('Actual typed snapshot rejection displays fail-closed retry and teacher refresh reads the unchanged ledger');
 report.transport=await app.evaluate(()=>({modelRequests:globalThis.hydrationAudit.modelRequests,blockedExternal:globalThis.hydrationAudit.blockedExternal}));assert.equal(report.transport.modelRequests,1);assert.deepEqual(report.transport.blockedExternal,[]);
 const hashes=journal.map(row=>row.event_hash),nativeFiles=query('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[idA]).map(row=>path.join(data,'xiaozhi-pi',row.session_file)),nativeHashes=nativeFiles.map(file=>sha256(fs.readFileSync(file)));
 await page.reload();await ready();assert((await turn.innerText()).includes(expected));assert.equal(query('SELECT count(*) n FROM ai_agent_runs')[0].n,beforeRuns);check('Actual renderer reload restores the same committed turn without starting a run');
 await close();await launch();assert.equal(await session(),idA);assert((await page.locator('.office-turn[data-turn-id="'+runId+'"]').innerText()).includes(expected));assert.equal(query('SELECT count(*) n FROM ai_agent_runs')[0].n,beforeRuns);assert.deepEqual(query('SELECT event_hash FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence',[runId]).map(row=>row.event_hash),hashes);assert.deepEqual(nativeFiles.map(file=>sha256(fs.readFileSync(file))),nativeHashes);assert.equal(await app.evaluate(()=>globalThis.hydrationAudit.modelRequests),0);check('Cold Electron restart preserves exact SQLite journal and native bytes with zero model or mutation replay');
 await close();assert.deepEqual(report.errors,[]);assert.equal(fingerprint(path.dirname(path.dirname(main))).sha256,fixed);report.sessionId=idA;report.runId=runId;report.ok=true;
 }
}catch(error){report.error=String(error.stack||error);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});if(app)report.last=await app.evaluate(()=>({rows:globalThis.hydrationAudit?.rows.map(({target,sequence,held,done})=>({target,sequence,held,done})),modelRequests:globalThis.hydrationAudit?.modelRequests})).catch(()=>undefined);}
finally{await close().catch(error=>{report.ok=false;report.closeError=String(error);process.exitCode=1;});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output,error:report.error}));}

async function eventGapJourney(){
 const runs=[];
 async function begin(index){
   await app.evaluate(()=>{const state=globalThis.hydrationAudit;state.heldModel=true;state.dropTen=false;state.dropTerminal=false;state.duplicate=false;state.rejectEventPage=false;state.holdEvents=false;state.hold=false;});
   await page.getByTestId('office-prompt-input').fill('合成F15通知恢复测试第'+index+'轮：仅回复文本，不使用工具。');await page.getByTestId('office-prompt-input').press('Enter');
   await until(()=>{const failed=query("SELECT error_message FROM ai_agent_runs WHERE session_id=? AND status='failed' ORDER BY created_at DESC LIMIT 1",[idA])[0];if(failed)throw Error(failed.error_message);return fs.existsSync(requestMarker)&&Number(fs.readFileSync(requestMarker,'utf8'))>=index;});
   const id=query('SELECT id FROM ai_agent_runs WHERE session_id=? ORDER BY created_at DESC LIMIT 1',[idA])[0].id;runs.push(id);await ready();await page.getByRole('button',{name:'停止本轮',exact:true}).waitFor();return id;
 }
 async function complete(id){await until(()=>query('SELECT status FROM xiaozhi_event_runs WHERE run_id=?',[id])[0]?.status==='completed');assert.equal(query('SELECT status FROM ai_agent_runs WHERE id=?',[id])[0].status,'succeeded');}
 const view=id=>page.locator('.office-turn[data-turn-id="'+id+'"]');
 async function exactText(id){const text=await view(id).innerText();assert(text.includes(expected));let last=-1;for(let i=0;i<50;i++){const token='f14-'+String(i).padStart(3,'0')+'|';assert.equal(text.split(token).length-1,1);assert(text.indexOf(token)>last);last=text.indexOf(token);}const saved=JSON.parse(query('SELECT turn_json FROM xiaozhi_event_runs WHERE run_id=?',[id])[0].turn_json);assert.equal(saved.items.filter(item=>item.role==='assistant').map(item=>item.text||'').join(''),expected);}
 const restore=async()=>{await app.evaluate(()=>{const state=globalThis.hydrationAudit;state.holdEvents=false;state.rejectEventPage=false;state.hold=false;for(const row of [...state.eventReads,...state.rows])row.release?.();});await ready();};
 const first=await begin(1);
 await app.evaluate((_,id)=>{const state=globalThis.hydrationAudit;state.cutRun=id;state.dropTen=true;state.duplicate=true;state.holdEvents=true;state.heldModel=false;state.modelRelease();},first);
 await page.getByTestId('pi-event-synchronization').waitFor();await until(()=>app.evaluate(()=>globalThis.hydrationAudit.eventReads.some(row=>row.held&&!row.done)));
 assert(!await page.getByRole('button',{name:'停止本轮',exact:true}).isDisabled());assert(await page.getByTestId('pi-queue-submit').isDisabled());
 const mutationCount=await app.evaluate(()=>globalThis.hydrationAudit.mutationCalls);await page.getByTestId('office-prompt-input').fill('缺口期间保留的草稿');await page.getByTestId('office-prompt-input').press('Enter');assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'缺口期间保留的草稿');assert.equal(await app.evaluate(()=>globalThis.hydrationAudit.mutationCalls),mutationCount);
 await complete(first);await restore();await until(async()=>await view(first).getAttribute('data-state')==='completed');await exactText(first);assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'缺口期间保留的草稿');assert.equal(await app.evaluate(()=>globalThis.hydrationAudit.mutationCalls),mutationCount);
 const firstTransport=await app.evaluate((_,id)=>{const state=globalThis.hydrationAudit;return {dropped:state.dropped.filter(event=>event.runId===id),notified:state.notified.filter(event=>event.runId===id),pages:state.eventReads.filter(row=>row.input.runId===id)};},first);
 assert.deepEqual(firstTransport.dropped.map(event=>event.sequence),[10]);assert(firstTransport.notified.filter(event=>event.sequence===9).length===2&&firstTransport.notified.filter(event=>event.sequence===11).length===2);assert(firstTransport.pages.some(row=>row.page.events.some(event=>event.sequence===10)));report.first=firstTransport;
 check('Actual tenth notification dropped and ninth/eleventh duplicated; held typed journal catch-up blocks queue, preserves draft and restores exact text once');
 const second=await begin(2);
 await app.evaluate((_,id)=>{const state=globalThis.hydrationAudit;state.cutRun=id;state.dropTen=true;state.holdEvents=true;state.heldModel=false;state.modelRelease();},second);
 await until(()=>app.evaluate((_,id)=>globalThis.hydrationAudit.eventReads.some(row=>row.input.runId===id&&row.held&&!row.done),second));await complete(second);
 await app.evaluate((_,id)=>{const state=globalThis.hydrationAudit;state.target=id;state.hold=true;state.rejectEventPage=true;for(const row of state.eventReads)if(row.input.runId===state.cutRun)row.release?.();},idA);
 await page.waitForFunction(()=>document.querySelector('[data-testid="pi-event-synchronization"]')?.getAttribute('data-state')==='unavailable');assert(await page.getByTestId('pi-queue-submit').isDisabled());await page.getByTestId('office-prompt-input').fill('补读失败保留的草稿');const beforeRetry=await app.evaluate(()=>globalThis.hydrationAudit.mutationCalls);await page.getByTestId('office-prompt-input').press('Enter');assert.equal(await app.evaluate(()=>globalThis.hydrationAudit.mutationCalls),beforeRetry);assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'补读失败保留的草稿');
 await page.getByTestId('pi-event-refresh').click();await restore();await until(async()=>await view(second).getAttribute('data-state')==='completed');await exactText(second);assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'补读失败保留的草稿');assert.equal(await app.evaluate(()=>globalThis.hydrationAudit.mutationCalls),beforeRetry);
 report.second=await app.evaluate((_,id)=>{const state=globalThis.hydrationAudit;return {dropped:state.dropped.filter(event=>event.runId===id),pages:state.eventReads.filter(row=>row.input.runId===id)};},second);assert.deepEqual(report.second.dropped.map(event=>event.sequence),[10]);assert(report.second.pages.some(row=>row.failed&&row.done));check('Actual catch-up delivery failure stays unavailable with zero queued mutation; teacher refresh accepts authoritative SQLite and retains draft');
 const third=await begin(3);
 // Observe a healthy poll while the model is paused, then release the short
 // response; the later assertion proves the repair call occurred after loss.
 await until(()=>app.evaluate((_,id)=>globalThis.hydrationAudit.eventReads.some(row=>row.input.runId===id&&row.done),third));
 await app.evaluate((_,id)=>{const state=globalThis.hydrationAudit;state.cutRun=id;state.dropTerminal=true;state.heldModel=false;state.modelRelease();},third);await complete(third);
 await until(async()=>await view(third).getAttribute('data-state')==='completed');await exactText(third);
 const transport=await app.evaluate(()=>{const state=globalThis.hydrationAudit;return {modelRequests:state.modelRequests,blockedExternal:state.blockedExternal,dropped:state.dropped,pages:state.eventReads,peaks:state.eventPeaks,notified:state.notified,eventTrace:state.eventTrace,dropTrace:state.dropTrace};});assert.equal(transport.modelRequests,3);assert.deepEqual(transport.blockedExternal,[]);const lost=transport.dropped.filter(event=>event.runId===third);assert.equal(lost.length,1);assert.equal(lost[0].kind,'status');assert.equal(lost[0].status,'completed');const drop=transport.dropTrace.find(row=>row.event.runId===third);assert(!transport.eventTrace.some(row=>row.event.runId===third&&row.order>drop.order));assert.deepEqual(transport.notified.filter(event=>event.runId===third).map(event=>event.sequence),Array.from({length:lost[0].sequence-1},(_,index)=>index+1));assert(transport.pages.some(row=>row.input.runId===third&&row.order>drop.order&&row.input.after===lost[0].sequence-1&&row.page.events.some(event=>event.sequence===lost[0].sequence)));for(const id of runs)assert.equal(transport.peaks[id],1);report.transport=transport;
 check('A terminal notification with no successor is recovered by the existing tail poll from the real journal');
 for(const id of runs){const rows=query('SELECT sequence,event_json,event_hash FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence',[id]);assert(rows.every((row,index)=>row.sequence===index+1&&sha256(row.event_json)===row.event_hash));for(const read of transport.pages.filter(row=>row.input.runId===id))for(const event of read.page.events){const saved=rows.find(row=>row.sequence===event.sequence);assert(saved);assert.deepEqual(JSON.parse(saved.event_json),event);}}
 check('All replayed public events match contiguous actual SQLite payloads and hashes without fabricated projection writes');
 for(const [width,height]of [[1366,768],[1920,1080]]){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});await page.screenshot({path:path.join(output,'gap-restored-'+width+'.png')});for(const id of runs)assert((await view(id).innerText()).includes(expected));}check('Three exact restored turns remain available at both native window sizes');
 const ledger=query('SELECT event_hash FROM xiaozhi_event_journal ORDER BY run_id,sequence').map(row=>row.event_hash),native=query('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[idA]);assert.equal(native.length,1);const nativeFile=path.join(data,'xiaozhi-pi',native[0].session_file),nativeHash=sha256(fs.readFileSync(nativeFile));await page.reload();await ready();for(const id of runs)assert((await view(id).innerText()).includes(expected));await close();await launch();
 assert.equal(await session(),idA);for(const id of runs)assert((await view(id).innerText()).includes(expected));assert.equal(query('SELECT count(*) n FROM ai_agent_runs')[0].n,3);assert.deepEqual(query('SELECT event_hash FROM xiaozhi_event_journal ORDER BY run_id,sequence').map(row=>row.event_hash),ledger);assert.equal(sha256(fs.readFileSync(nativeFile)),nativeHash);assert.equal(await app.evaluate(()=>globalThis.hydrationAudit.modelRequests),0);await close();assert.deepEqual(report.errors,[]);assert.equal(fingerprint(path.dirname(path.dirname(main))).sha256,fixed);report.sessionId=idA;report.runs=runs;report.ok=true;check('Renderer reload and cold process restore three turns, exact journal/native bytes and zero new model/run replay');
}
