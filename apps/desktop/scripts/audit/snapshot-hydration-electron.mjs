import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
const desktop=path.resolve(import.meta.dirname,'../..');
const output=fs.mkdtempSync(path.join(desktop,'test-results/audit-hydration-electron-'));
// Production Pi correctly rejects state anywhere under the global .codex root.
// Keep the real runtime in a private OS-temporary root, retaining its path as evidence.
const runtimeRoot=fs.mkdtempSync(path.join(os.tmpdir(),'edu-f14-runtime-')),data=path.join(runtimeRoot,'data'),profile=path.join(runtimeRoot,'profile');
const requestMarker=path.join(runtimeRoot,'controlled-request-count.txt');
const main=testMain(desktop),fixed=fingerprint(path.dirname(path.dirname(main))).sha256;
const expected=Array.from({length:50},(_,i)=>'f14-'+String(i).padStart(3,'0')+'|').join('');
const report={ok:false,checks:[],errors:[],build:fixed,runtimeRoot,launches:[],boundary:'Real current Electron/Pi, typed preload, journal/SQLite/native files and cold process. Explicit controlled model catalogue (1M fixture capacity) and SSE text transport; no real model/capacity/teacher answer quality. Only snapshot IPC delivery is held/rejected after its actual handler reads, no synthetic journal rows or changed product hooks.'};
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
   const state=globalThis.hydrationAudit={hold:false,target:'',rows:[],peak:0,modelRequests:0,heldModel:true,blockedExternal:[],failNext:false,events:[]};
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
   const web=BrowserWindow.getAllWindows()[0].webContents,send=web.send.bind(web);web.send=(channel,...args)=>{if(channel==='xiaozhi:event')state.events.push(args[0]);return send(channel,...args);};
   BrowserWindow.getAllWindows()[0].show();BrowserWindow.getAllWindows()[0].focus();
 },requestMarker);
 page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await ready();await page.bringToFront();
}
async function close(){if(!app)return;const owned=app,child=owned.process();let timer;
 try{await owned.evaluate(()=>{const state=globalThis.hydrationAudit;if(state){state.hold=false;state.heldModel=false;state.modelRelease?.();for(const row of state.rows)row.release?.();}}).catch(()=>undefined);
   await Promise.race([owned.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned Electron close timeout')),20000);})]);await until(()=>child.exitCode!==null,10000);assert.equal(child.exitCode,0);(report.closed||=[]).push({pid:child.pid,exitCode:child.exitCode});app=undefined;
 }catch(error){if(child.exitCode===null)child.kill();throw error;}finally{clearTimeout(timer);}}
async function select(id){if(await page.getByTestId('pi-sidebar-toggle').getAttribute('aria-expanded')!=='true')await page.getByTestId('pi-sidebar-toggle').click();await page.getByTestId('ai-conversation-session-'+id).click();await until(async()=>await session()===id);}
const release=()=>app.evaluate(()=>{const state=globalThis.hydrationAudit;state.hold=false;for(const row of state.rows)row.release?.();});
try{
 await launch();idA=await session();
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
}catch(error){report.error=String(error.stack||error);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});if(app)report.last=await app.evaluate(()=>({rows:globalThis.hydrationAudit?.rows.map(({target,sequence,held,done})=>({target,sequence,held,done})),modelRequests:globalThis.hydrationAudit?.modelRequests})).catch(()=>undefined);}
finally{await close().catch(error=>{report.ok=false;report.closeError=String(error);process.exitCode=1;});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output,error:report.error}));}
