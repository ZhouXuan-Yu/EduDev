/** Fixed B01 acceptance through production Pi/typed preload and an owned SQLite root. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';

const desktop=path.resolve(import.meta.dirname,'../..'),baseline=process.argv.includes('--baseline');
const stopOnly=process.argv.includes('--stop-only');
const remaining=process.argv.includes('--remaining');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-foundation-b01-'));
const data=path.join(root,'data'),profile=path.join(root,'profile'),workspace=path.join(root,'workspace');
fs.mkdirSync(workspace);fs.writeFileSync(path.join(workspace,'retained.txt'),'Synthetic retained teacher result.');
const sha=b=>createHash('sha256').update(b).digest('hex');
const fingerprint=file=>({sha256:sha(fs.readFileSync(file)),mtimeMs:fs.statSync(file).mtimeMs});
const retained=fingerprint(path.join(workspace,'retained.txt'));
const report={ok:false,baseline,root,source:execFileSync('git',['rev-parse','HEAD'],{cwd:desktop,encoding:'utf8'}).trim(),
 sourceFiles:Object.fromEntries(['src/main/xiaozhi-agent/events/publisher.ts','src/main/xiaozhi-agent/events/journal.ts'].map(f=>[f,sha(fs.readFileSync(path.join(desktop,f)))])),
 mainSha256:sha(fs.readFileSync(path.join(desktop,'out/main/index.js'))),checks:[],errors:[],paidRequests:0,
 scope:'Original production Pi runtime, real typed preload/journal/SQLite/files/native history. Local SSE with fake key; no provider quality or renderer redesign acceptance.'};
let app,page;
const query=(q,p=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...p);}finally{db.close();}};
const save=()=>fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
const check=(id,detail)=>{report.checks.push({id,detail});save();console.log('PASS '+id);};
async function until(fn,ms=60000){const end=Date.now()+ms;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(error){if(!String(error).includes('Resulting promise was garbage collected')||app?.process()?.exitCode!==null)throw error;(report.inspectionRetries??=[]).push(String(error));}await new Promise(r=>setTimeout(r,40));}throw Error('Owned B01 observation deadline');}
const snapshot=id=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const wire=(probe=false)=>app.evaluate((_,probe)=>({mode:b01.mode,calls:b01.calls,emitted:b01.emitted,aborted:b01.aborted,toolRequests:b01.toolRequests,blocked:b01.blocked,started:b01.started,scheduledMs:b01.scheduledMs,...(probe?{sqlProbe:b01.sqlProbe}:{})}),probe);
async function configure(mode){await app.evaluate((_,mode)=>{Object.assign(globalThis.b01,{mode,stage:0,emitted:0,aborted:false,waiting:false});},mode);}
async function launch(cold=false){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 app.process().stdout?.on('data',b=>fs.appendFileSync(path.join(root,'main.log'),b));app.process().stderr?.on('data',b=>fs.appendFileSync(path.join(root,'main.log'),b));
 await app.evaluate(({net},settings)=>{
  const {cold,probe}=settings;
  globalThis.b01={mode:cold?'cold':'idle',stage:0,calls:[],toolRequests:[],blocked:[],emitted:0,aborted:false};
  if(probe){const require=process.getBuiltinModule('node:module').createRequire(process.env.OMNI_EDU_REPO_ROOT+'/apps/desktop/package.json'),sqlite=require('sqlite3');
   for(const method of ['run','all','exec']){const original=sqlite.Database.prototype[method];sqlite.Database.prototype[method]=function(...args){const at=Date.now(),collect=globalThis.b01.mode==='stop',callback=args.at(-1);if(collect&&typeof callback==='function')args[args.length-1]=function(...values){const rows=globalThis.b01.sqlProbe??=[];if(rows.length<4000)rows.push({method,sql:String(args[0]).slice(0,150),at,ms:Date.now()-at});return callback.apply(this,values);};return original.apply(this,args);};}
  }
  net.fetch=async(input,init)=>{
   const w=globalThis.b01,url=typeof input==='string'?input:input.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
   if(!url.endsWith('/chat/completions')||w.mode==='cold'){w.blocked.push(url);throw Error('Unconfigured external transport blocked');}
   const body=JSON.parse(init.body),stage=w.stage++,mode=w.mode;w.calls.push({mode,stage,at:Date.now()});
   const c=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'b01-'+mode+'-'+stage,object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   const tool=(id,name,args)=>({index:0,id,type:'function',function:{name,arguments:JSON.stringify(args)}});
   const response=(calls,text)=>{if(calls)w.toolRequests.push(...calls.map(x=>({mode,id:x.id,name:x.function.name})));return new Response(c({role:'assistant'})+c(calls?{tool_calls:calls}:{content:text})+c({},calls?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});};
   if(mode==='dedupe')return stage===0?response([tool('dedupe-read-'+w.calls.length,'office_read_text',{path:'retained.txt'})]):response(null,'The retained result has been read.');
   if(mode==='initial'){
    if(stage===0)return response([tool('plan','update_task_plan',{schemaVersion:'xiaozhi.task-plan.v3',expectedRevision:0,requirementsVersion:1,reason:'Save three synthetic teaching results in order.',steps:[{id:'first',text:'保存第一份讲义',kind:'saved_text',target:'first.md',reported:'in_progress',dependsOn:[]},{id:'second',text:'保存第二份练习',kind:'saved_text',target:'second.md',reported:'pending',dependsOn:['first']},{id:'third',text:'保存第三份解析',kind:'saved_text',target:'third.md',reported:'pending',dependsOn:['second']},{id:'review',text:'教师核对教学表达',kind:'human',reported:'pending',dependsOn:['third']}]} )]);
    if(stage<=2)return response([tool('save-'+stage,'office_create_text',{taskStepId:stage===1?'first':'second',path:stage===1?'first.md':'second.md',content:'Synthetic completed result '+stage})]);
    w.waiting=true;return new Promise((_resolve,reject)=>{const abort=()=>{w.aborted=true;reject(Error('cancelled'));};if(init.signal?.aborted)abort();else init.signal?.addEventListener('abort',abort,{once:true});});
   }
   if(mode==='resume')return stage===0?response([tool('save-third','office_create_text',{taskStepId:'third',path:'third.md',content:'Synthetic remaining result 3'})]):response(null,'三份成果已保存，请教师核对。');
   if(!['stream','stop'].includes(mode))throw Error('Unexpected B01 mode '+mode);
   const encoder=new TextEncoder();w.started=Date.now();w.scheduledMs=10000;
   return new Response(new ReadableStream({async start(controller){try{
    controller.enqueue(encoder.encode(c({role:'assistant'})));
    if(mode==='stop')controller.enqueue(encoder.encode(c({tool_calls:[tool('must-not-start','office_read_text',{path:'retained.txt'})]})));
    // Schedule 10,000 five-character chunks at 1ms offsets. Catch up after OS timer jitter.
    while(w.emitted<10000){init.signal?.throwIfAborted();const due=Math.min(10000,Date.now()-w.started+1);
     while(w.emitted<due){controller.enqueue(encoder.encode(c({content:'abcde'})));w.emitted++;}
     await new Promise(r=>setTimeout(r,1));
    }
    controller.enqueue(encoder.encode(c({},mode==='stop'?'tool_calls':'stop')+'data: [DONE]\n\n'));controller.close();
   }catch(error){w.aborted=true;controller.error(error);}}}),{headers:{'content-type':'text/event-stream'}});
  };
 },{cold,probe:stopOnly});
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.waitForFunction(()=>Boolean(window.omniEdu?.startXiaozhi),{timeout:60000});
 await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
 await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 await page.evaluate(()=>{globalThis.b01Events=[];globalThis.b01Unsubscribe?.();globalThis.b01Unsubscribe=window.omniEdu.onXiaozhiEvent(event=>b01Events.push(event));});
 report.launches??=[];report.launches.push(await app.evaluate(({app})=>({pid:process.pid,version:app.getVersion(),dataRoot:process.env.OMNI_EDU_DATA_ROOT,entry:process.argv[1]})));
}
async function session(title){const created=await page.evaluate(title=>window.omniEdu.createAiConversationSession({title}),title);const id=created.session.id;
 await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},workspace);
 assert((await page.evaluate(id=>window.omniEdu.selectXiaozhiWorkspace(id),id)).ok);return id;
}
async function start(id,prompt,count=1){const input={sessionId:id,commandId:'xicmd_'+randomUUID(),prompt};const results=[];
 for(let i=0;i<count;i++)results.push(await page.evaluate(input=>window.omniEdu.startXiaozhi(input),input));
 for(const value of results)assert(value.ok,JSON.stringify(value));return{input,results,runId:results[0].runId};
}
const idle=id=>until(async()=>{const s=await snapshot(id);return !s.running&&s.projection.turns.length?s:undefined;});
async function approve(id){const row=await until(()=>query("SELECT id,revision FROM xiaozhi_pi_text_changes WHERE conversation_id=? AND state='pending'",[id])[0]);
 const result=await page.evaluate(input=>window.omniEdu.decideXiaozhiChange(input),{schemaVersion:'xiaozhi.change.v1',sessionId:id,changeId:row.id,revision:row.revision,action:'approve'});assert(result.ok,JSON.stringify(result));
}
async function close(){if(app){await app.close();app=undefined;}}
try{
 await launch();
 // Test-only trigger records actual writes in this owned synthetic DB. It never supplies product facts.
 {const db=new DatabaseSync(path.join(data,'app.db'));db.exec('CREATE TABLE foundation_write_probe(run_id TEXT PRIMARY KEY,n INTEGER NOT NULL); CREATE TRIGGER foundation_write_probe_update AFTER UPDATE OF turn_json ON xiaozhi_event_runs BEGIN INSERT INTO foundation_write_probe VALUES(NEW.run_id,1) ON CONFLICT(run_id) DO UPDATE SET n=n+1; END;');db.close();}
 if(!baseline&&!stopOnly&&!remaining){
  await configure('dedupe');const id=await session('B01 duplicate'),first=await start(id,'Read retained.txt once.',5);assert(first.results.every(r=>r.runId===first.runId));await idle(id);
  const duplicate=await page.evaluate(input=>window.omniEdu.startXiaozhi(input),first.input);assert.equal(duplicate.runId,first.runId);
  const other=await session('B01 independent');await configure('dedupe');const next=await start(other,first.input.prompt);await idle(other);assert.notEqual(next.runId,first.runId);
  const receipts=query('SELECT run_id,call_id,admitted,success FROM xiaozhi_tool_receipts WHERE run_id IN (?,?)',[first.runId,next.runId]);assert.equal(receipts.length,2);assert(receipts.every(r=>r.admitted===1&&r.success===1));
  assert.equal(query('SELECT COUNT(*) n FROM ai_agent_runs WHERE session_id=?',[id])[0].n,1);report.deduplication={first,next,receipts};check('FAT-B01-01','Five same-command sends plus settled retry use one run/read effect; another session independently reads once.');
 }
 let streamed,streamId;
 if(!stopOnly&&!remaining){
 streamId=await session('B01 10000 chunks');await configure('stream');const at=Date.now();
 let peak=0;const memoryTimer=setInterval(async()=>{if(app){const value=await app.evaluate(()=>process.memoryUsage().rss).catch(()=>0);peak=Math.max(peak,value);}},250);
 try{streamed=await start(streamId,'Generate exactly the controlled synthetic stream.');await idle(streamId);}finally{clearInterval(memoryTimer);}
 const row=query('SELECT turn_json,sequence,revision,status FROM xiaozhi_event_runs WHERE run_id=?',[streamed.runId])[0];assert.equal(row.status,'completed');const turn=JSON.parse(row.turn_json),body=turn.items.filter(i=>i.kind==='message'&&i.role==='assistant').map(i=>i.text||'').join('');
 const delivered=await page.evaluate(runId=>b01Events.filter(e=>e.runId===runId),streamed.runId);assert.equal(delivered.filter(e=>e.kind==='text_delta').length,10000);assert.equal(sha(delivered.filter(e=>e.kind==='text_delta').map(e=>e.delta).join('')),sha('abcde'.repeat(10000)));assert.equal(body,'abcde'.repeat(10000));
 assert.equal(new Set(delivered.map(e=>e.sequence)).size,delivered.length);assert.equal(delivered.at(-1).sequence,row.sequence);
 const writes=query('SELECT n FROM foundation_write_probe WHERE run_id=?',[streamed.runId])[0].n;
 report.streaming={elapsedMs:Date.now()-at,peakMainRssBytes:peak,bodyWrites:writes,chars:body.length,bodySha256:sha(body),preloadEvents:delivered.length,journal:row.sequence,revision:row.revision,wire:await wire()};save();
 if(!baseline)assert(writes<=250,'Body projection writes '+writes+' exceed 250');
 }
 const stopId=await session('B01 stopped stream');await configure('stop');const stopped=await start(stopId,'Stream with the later read queued, then stop.');await until(async()=>(await wire()).emitted>0);const startedAt=(await wire()).started;await new Promise(r=>setTimeout(r,Math.max(0,startedAt+2000-Date.now())));
 const stopAt=Date.now(),stopPromise=page.evaluate(id=>window.omniEdu.stopXiaozhi(id),stopId);
 await until(()=>query('SELECT status FROM xiaozhi_event_runs WHERE run_id=?',[stopped.runId])[0]?.status==='interrupted');
 const durableTerminalMs=Date.now()-stopAt;assert((await stopPromise).ok);const stopResponseMs=Date.now()-stopAt;const settled=await idle(stopId);const terminalMs=Date.now()-stopAt;
 report.stop={durableTerminalMs,stopResponseMs,snapshotCompleteMs:terminalMs,stopAt,wire:await wire(true)};save();
 assert.equal(settled.projection.turns.at(-1).status,'interrupted');assert(durableTerminalMs<=2000,'Durable stop terminal took '+durableTerminalMs+'ms');
 const sequence=query('SELECT sequence FROM xiaozhi_event_runs WHERE run_id=?',[stopped.runId])[0].sequence;await page.evaluate(id=>window.omniEdu.stopXiaozhi(id),stopId);await new Promise(r=>setTimeout(r,200));assert.equal(query('SELECT sequence FROM xiaozhi_event_runs WHERE run_id=?',[stopped.runId])[0].sequence,sequence);
 assert.equal(query('SELECT COUNT(*) n FROM xiaozhi_tool_receipts WHERE run_id=?',[stopped.runId])[0].n,0);assert.deepEqual(fingerprint(path.join(workspace,'retained.txt')),retained);
 report.stop={...report.stop,sequence};check('FAT-B01-02','Stop at two seconds settles within two seconds; deferred tool starts zero times, repeated stop adds no events and original file hash/mtime stay exact.');
 // Settled journal is stable and a later session can run: no lingering stream/persistence owner.
 if(streamed){const stable=query('SELECT sequence,revision,status FROM xiaozhi_event_runs WHERE run_id=?',[streamed.runId]);await new Promise(r=>setTimeout(r,250));assert.deepEqual(query('SELECT sequence,revision,status FROM xiaozhi_event_runs WHERE run_id=?',[streamed.runId]),stable);}
 if(!baseline&&!stopOnly){
  const resumeId=await session('B01 three-result continuation');await configure('initial');const initial=await start(resumeId,'依次保存first.md、second.md、third.md三份成果，每份保存前让我确认。');await approve(resumeId);await approve(resumeId);await until(()=>app.evaluate(()=>b01.waiting));
  assert(!fs.existsSync(path.join(workspace,'third.md')));await page.evaluate(id=>window.omniEdu.stopXiaozhi(id),resumeId);const interrupted=await idle(resumeId);assert.equal(interrupted.task.state,'interrupted');
  const oldMessages=query('SELECT * FROM ai_conversation_messages WHERE session_id=? ORDER BY created_at,id',[resumeId]);
  const files=['first.md','second.md'].map(name=>({name,...fingerprint(path.join(workspace,name))}));const binding=JSON.parse(query('SELECT binding_json FROM xiaozhi_native_run_bindings WHERE run_id=?',[initial.runId])[0].binding_json);const native=path.join(data,'xiaozhi-pi',binding.file);await close();const prefix=fs.readFileSync(native),priorEvents=query('SELECT event_hash FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence',[initial.runId]);
  await launch(true);const cold=await snapshot(resumeId);assert.deepEqual(cold.task,interrupted.task);assert.equal((await wire()).calls.length,0);assert.deepEqual(query('SELECT event_hash FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence',[initial.runId]),priorEvents);
  assert.deepEqual(query('SELECT * FROM ai_conversation_messages WHERE session_id=? ORDER BY created_at,id',[resumeId]),oldMessages);
  await configure('resume');const input={schema:'xiaozhi.task.v1',sessionId:resumeId,taskId:cold.task.id,revision:cold.task.revision,requirementsVersion:cold.task.requirementsVersion,commandId:'xicmd_'+randomUUID()};const result=await page.evaluate(input=>window.omniEdu.resumeXiaozhiTask(input),input);assert(result.ok,JSON.stringify(result));await approve(resumeId);const finished=await idle(resumeId);
  for(const f of files)assert.deepEqual(fingerprint(path.join(workspace,f.name)),{sha256:f.sha256,mtimeMs:f.mtimeMs});assert.equal(fs.readFileSync(path.join(workspace,'third.md'),'utf8'),'Synthetic remaining result 3');assert(fs.readFileSync(native).subarray(0,prefix.length).equals(prefix));
  assert.equal(query("SELECT COUNT(*) n FROM xiaozhi_tool_receipts WHERE tool='office_create_text' AND admitted=1 AND run_id IN (?,?)",[initial.runId,result.runId])[0].n,3);assert.equal(finished.task.id,interrupted.task.id);assert.equal(finished.task.origin.runId,initial.runId);assert.equal(finished.task.lastRunId,result.runId);
  for(const message of oldMessages)assert.deepEqual(query('SELECT * FROM ai_conversation_messages WHERE id=?',[message.id])[0],message);
  report.continuation={initialRun:initial.runId,resumedRun:result.runId,task:finished.task.id,files,unchangedHistoricalMessages:oldMessages.length,nativePrefix:{bytes:prefix.length,sha256:sha(prefix)},requests:await wire()};check('FAT-B01-03','Cold restart makes zero model calls; explicit resume only creates third file, preserving prior file hashes/mtime, messages, native prefix and original task/run lineage.');
  if(report.streaming)check('FAT-B01-04','10000 five-character chunks survive preload and durable projection exactly; at most 250 projection writes, stable settled queue and independently cancelled same-size stream.');
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual((await wire()).blocked,[]);report.ok=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;console.error(report.error);report.failureWire=app?await wire().catch(()=>null):undefined;}
finally{await close().catch(()=>{});save();console.log(JSON.stringify({ok:report.ok,baseline,checks:report.checks.length,root,streaming:report.streaming&&{elapsedMs:report.streaming.elapsedMs,bodyWrites:report.streaming.bodyWrites},error:report.error}));}
