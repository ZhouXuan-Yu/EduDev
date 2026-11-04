/** Fixed B02 acceptance through production Pi/typed preload and an owned SQLite root. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';

const desktop=path.resolve(import.meta.dirname,'../..');
// Run one fixed journey per owned root; context capacity is deliberately smaller.
const only=process.argv.find(arg=>arg.endsWith('-only'))||'--effort-only';
assert(['--effort-only','--routing-only','--context-only','--faults-only'].includes(only));
const selected=name=>only===`--${name}-only`;
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-foundation-b02-'));
const data=path.join(root,'data'),profile=path.join(root,'profile'),workspace=path.join(root,'workspace');
fs.mkdirSync(workspace);fs.writeFileSync(path.join(workspace,'retained.txt'),'Synthetic retained teacher result.');
const sha=b=>createHash('sha256').update(b).digest('hex');
const fingerprint=file=>({sha256:sha(fs.readFileSync(file)),mtimeMs:fs.statSync(file).mtimeMs});
const retained=fingerprint(path.join(workspace,'retained.txt'));
const report={ok:false,root,source:execFileSync('git',['rev-parse','HEAD'],{cwd:desktop,encoding:'utf8'}).trim(),
 sourceFiles:Object.fromEntries(['src/main/xiaozhi-agent/pi-session.ts','src/main/xiaozhi-agent/answer-quality.ts','src/main/xiaozhi-agent/model-settings.ts','src/main/xiaozhi-agent/model-request-recovery.ts','src/main/xiaozhi-agent/events/publisher.ts','src/main/xiaozhi-agent/events/journal.ts','src/main/xiaozhi-agent/production-host.ts'].map(f=>[f,sha(fs.readFileSync(path.join(desktop,f)))])),
 scriptSha256:sha(fs.readFileSync(import.meta.filename)),
 mainSha256:sha(fs.readFileSync(path.join(desktop,'out/main/index.js'))),checks:[],errors:[],paidRequests:0,
 scope:'Original production Pi runtime, real typed preload/journal/SQLite/files/native history. Local SSE with fake key; no provider quality or renderer redesign acceptance.'};
let app,page;
const query=(q,p=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...p);}finally{db.close();}};
const save=()=>fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
const check=(id,detail)=>{report.checks.push({id,detail});save();console.log('PASS '+id);};
async function until(fn,ms=60000){const end=Date.now()+ms;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(error){if(!String(error).includes('Resulting promise was garbage collected')||app?.process()?.exitCode!==null)throw error;(report.inspectionRetries??=[]).push(String(error));}await new Promise(r=>setTimeout(r,40));}throw Error('Owned B02 observation deadline');}
const snapshot=id=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const wire=(probe=false)=>app.evaluate((_,probe)=>({mode:b02.mode,calls:b02.calls,emitted:b02.emitted,aborted:b02.aborted,toolRequests:b02.toolRequests,blocked:b02.blocked,started:b02.started,scheduledMs:b02.scheduledMs,...(probe?{sqlProbe:b02.sqlProbe}:{})}),probe);
async function configure(mode){await app.evaluate((_,mode)=>{Object.assign(globalThis.b02,{mode,stage:0,emitted:0,aborted:false,waiting:false});},mode);}
async function launch(cold=false){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_PI_AUTO_COMPACTION:'1',DEEPSEEK_API_KEY:'synthetic-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 app.process().stdout?.on('data',b=>fs.appendFileSync(path.join(root,'main.log'),b));app.process().stderr?.on('data',b=>fs.appendFileSync(path.join(root,'main.log'),b));
 await app.evaluate(({net},{cold,smallWindow})=>{
  globalThis.b02={mode:cold?'cold':'ok',calls:[],blocked:[],toolRequests:[],stage:0};
  net.fetch=async(input,init)=>{
   const w=globalThis.b02,url=typeof input==='string'?input:input.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:smallWindow?524288:1048576,max_output_tokens:32768,input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'low'}},{id:'deepseek-basic',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(!url.endsWith('/chat/completions')||w.mode==='cold'){w.blocked.push(url);throw Error('Unconfigured external transport blocked');}
   const body=JSON.parse(init.body),summary=!body.tools?.length&&JSON.stringify(body.messages).includes('<conversation>');w.calls.push({mode:w.mode,summary,model:body.model,effort:body.reasoning_effort,hasEffort:Object.hasOwn(body,'reasoning_effort'),thinking:body.thinking,maxTokens:body.max_tokens,lastUserTail:JSON.stringify(body.messages.findLast(message=>message.role==='user')?.content).slice(-700),bodyBytes:JSON.stringify(body).length});
   if(w.mode==='401'||w.mode==='429')return new Response('Synthetic rejection',{status:Number(w.mode),headers:{'retry-after':'60'}});
   if(w.mode==='pre')throw TypeError('Synthetic transport failure; synthetic-private-key must never reach public diagnostics');
   const c=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'b02',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   if(summary)return new Response(c({role:'assistant',content:'【当前目标】继续合成教学核对。\n【明确约束】只读，不创建文件。\n【授权来源及版本】retained.txt，已读取一次。\n【已完成及可核验回执】原读取工具已成功，不重放。\n【未完成/失败/冲突】后续概念讲解尚未完成。\n【下一步】按教师本次请求继续。'})+c({},'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
   if(w.mode==='context-seed'&&w.stage++===0){w.toolRequests.push({name:'office_read_text',path:'retained.txt'});return new Response(c({role:'assistant',tool_calls:[{index:0,id:'context-read-once',type:'function',function:{name:'office_read_text',arguments:JSON.stringify({path:'retained.txt'})}}]})+c({},'tool_calls')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});}
   if(w.mode==='partial')return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(c({role:'assistant'})+c({content:'已保留的第一段讲解。'})));setTimeout(()=>controller.error(Error('Synthetic body interruption')),120);}}),{headers:{'content-type':'text/event-stream'}});
   if(w.mode==='hold')return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(c({role:'assistant'})+c({content:'正在继续未完成的教案。'})));init.signal?.addEventListener('abort',()=>controller.error(Error('Synthetic cancellation')),{once:true});}}),{headers:{'content-type':'text/event-stream'}});
   return new Response(c({role:'assistant'})+c({content:w.mode==='length'?'本轮讲解尚未完成，第二段未输出。':'已核对当前合成任务。'})+c({},w.mode==='length'?'length':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 },{cold,smallWindow:selected('context')});
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.waitForFunction(()=>Boolean(window.omniEdu?.startXiaozhi),{timeout:60000});
 await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
 await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 await page.evaluate(()=>{globalThis.b02Events=[];globalThis.b02Unsubscribe?.();globalThis.b02Unsubscribe=window.omniEdu.onXiaozhiEvent(event=>b02Events.push(event));});
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
async function close(){if(app){await app.close();app=undefined;}}
const settings=async id=>{const r=await page.evaluate(id=>window.omniEdu.getXiaozhiSettings(id?{sessionId:id}:undefined),id);assert(r.ok,JSON.stringify(r));return r.value;};
async function thinking(id,choice){await until(async()=>!(await settings(id)).locked);const s=await settings(id),v=id?s.thinking.session:s.thinking.global;
 const r=await page.evaluate(input=>window.omniEdu.saveXiaozhiThinking(input),{schemaVersion:'xiaozhi.settings.v1',...(id?{sessionId:id}:{}),version:v.version,choice});assert(r.ok,JSON.stringify(r));}
const calls=()=>app.evaluate(()=>b02.calls);
try{
 await launch();await settings();if(selected('effort')){const id=await session('B02 supported effort');
 await thinking(undefined,'high');assert.equal((await calls()).length,0,'Saving settings must not generate');
 for(const choice of ['low','high','max']){
  await thinking(id,choice);const n=(await calls()).length;const run=await start(id,'解释这个合成教学术语。');const s=await idle(id);assert.equal(s.projection.turns.at(-1).status,'completed');
  const sent=(await calls()).slice(n);assert.equal(sent.length,1);assert.equal(sent[0].effort,choice);assert.equal((await settings(id)).thinking.lastRun.effective,choice);
  (report.effort??=[]).push({choice,runId:run.runId,sent});
 }
 const basic=await session('B02 unsupported effort');const before=await settings(basic);const selected=await page.evaluate(input=>window.omniEdu.selectXiaozhiModel(input),{schemaVersion:'xiaozhi.settings.v1',sessionId:basic,version:before.sessionModel.version,model:'deepseek-basic'});assert(selected.ok,JSON.stringify(selected));
 const n=(await calls()).length;await start(basic,'解释当前合成概念。');const basicTurn=await idle(basic);assert.equal(basicTurn.projection.turns.at(-1).status,'completed');const sent=(await calls()).slice(n);assert.equal(sent.length,1);assert.equal(sent[0].model,'deepseek-basic');assert.equal(sent[0].hasEffort,false);const unsupported=(await settings(basic)).thinking.lastRun;assert(unsupported.reason);report.unsupported={sent,decision:unsupported};
 const persisted={supported:(await settings(id)).thinking,basic:(await settings(basic)).thinking};await close();await launch(true);assert.deepEqual((await settings(id)).thinking,persisted.supported);assert.deepEqual((await settings(basic)).thinking,persisted.basic);assert.equal((await calls()).length,0);report.persistence=persisted;
 check('FAT-B02-01','Actual low/high/max wire values; unsupported model omits effort with explicit decision; settings/cold restart produce zero chat requests; session/global choices remain scoped.');
 }
 if(selected('routing')){
  await configure('ok');await thinking(undefined,'auto');const id=await session('B02 current task routing');
  const samples=[{prompt:'好的',mode:'ok',route:'fast',effort:'none',budget:4096},{prompt:'详细设计一份40分钟浮力教案，逐步核对课堂活动与检查。',mode:'length',route:'deep',effort:'high',budget:16384},{prompt:'继续',mode:'hold',route:'deep',effort:'high',budget:16384},{prompt:'取消旧任务。新问题：用一句话解释什么是观察。',mode:'ok',route:'fast',effort:'none',budget:4096}];
  let complexTask;
  for(let i=0;i<samples.length;i++){
   const sample=samples[i];await configure(sample.mode);const n=(await calls()).length,run=await start(id,sample.prompt);
   if(sample.mode==='hold'){await until(async()=>(await calls()).length>n);assert((await page.evaluate(id=>window.omniEdu.stopXiaozhi(id),id)).ok);}
   const state=await idle(id),turn=state.projection.turns.at(-1),decision=(await settings(id)).thinking.lastRun,taskResult=await page.evaluate(id=>window.omniEdu.getXiaozhiTask({sessionId:id}),id);
   assert(taskResult.ok,JSON.stringify(taskResult));const task=taskResult.value.task,sent=(await calls()).slice(n);assert.equal(sent.length,1);assert.equal(sent[0].effort,sample.effort);assert.equal(sent[0].maxTokens,sample.budget);assert.equal(decision.mode,sample.route);assert(sent[0].lastUserTail.includes(sample.prompt));assert.equal(task.lastRunId??task.origin.runId,run.runId);assert.equal(turn.task.id,task.id);assert.equal(turn.task.requirementsVersion,task.requirementsVersion);
   if(i===1){complexTask=task;assert(turn.items.some(item=>item.truncated===true&&item.text==='本轮讲解尚未完成，第二段未输出。'));}
   if(i===2){assert.equal(task.id,complexTask.id);assert.equal(task.requirementsVersion,complexTask.requirementsVersion);assert.equal(turn.status,'interrupted');}
   if(i===3){assert.notEqual(task.id,complexTask.id);assert(task.criteria.some(c=>c.text.includes('新问题')));assert(!task.criteria.some(c=>c.text.includes('40分钟')));}
   (report.routing??=[]).push({sample,runId:run.runId,decision,task,turn,sent});save();
  }
  check('FAT-B02-02','Four current-input routes carry actual none/high/high/none wire effort and 4096/16384/16384/4096 budgets; continue retains task/version, stopped old task cannot replace new criteria.');
 }
 if(selected('context')){
  const id=await session('B02 bounded native context');await thinking(undefined,'auto');await configure('context-seed');await start(id,'读取 retained.txt 一次，后续保留这个已完成的结果，不重复读取。');let state=await idle(id);report.contextSeed=state;save();assert.equal(state.projection.turns.at(-1).status,'completed');assert.equal(state.contextPolicy.window,524288);assert.equal(state.contextPolicy.auto,true);
  const native=()=>{const binding=query('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[id])[0];return fs.readFileSync(path.join(data,'xiaozhi-pi',binding.session_file),'utf8').trim().split('\n').map(JSON.parse);};
  const toolResults=()=>native().filter(e=>e.message?.role==='toolResult'&&e.message.toolName==='office_read_text');assert.equal(toolResults().length,1);assert.equal(toolResults()[0].message.isError,false);const priorToolHash=sha(JSON.stringify(toolResults()));const counts=[];
  for(let i=0;i<7;i++){
   await configure('ok');await start(id,'阅读以下合成资料，只确认已读，不执行工具。\n'+'历史事实：浮力与排液体积有关。'.repeat(550));state=await idle(id);const turn=state.projection.turns.at(-1);
   const count=native().filter(e=>e.type==='compaction').length;counts.push({round:i,count,runId:turn.id,status:turn.status,errorCode:turn.errorCode});
   assert(turn.status==='completed'||turn.status==='failed'&&turn.errorCode==='context_limit',JSON.stringify({status:turn.status,errorCode:turn.errorCode}));if(count)break;
  }
  const compacted=native().filter(e=>e.type==='compaction');assert.equal(compacted.length,1,'Exactly one native compaction checkpoint');assert(compacted[0].summary.includes('已完成'));assert.equal(sha(JSON.stringify(toolResults())),priorToolHash);assert.equal((await wire()).toolRequests.length,1);assert.deepEqual(fingerprint(path.join(workspace,'retained.txt')),retained);
  // A single input that still cannot fit after one checkpoint must stop, not
  // loop. Follow its explicit "new conversation" recovery with a short input.
  const overflow=state.projection.turns.at(-1);const lengthId=overflow.status==='failed'?await session('B02 short-input recovery'):id;
  if(lengthId!==id){await configure('context-seed');await start(lengthId,'读取 retained.txt 一次，然后等我继续讲解。');assert.equal((await idle(lengthId)).projection.turns.at(-1).status,'completed');}
  const toolCount=(await wire()).toolRequests.length;await configure('length');const limited=await start(lengthId,'继续补充剩余的讲解。');state=await idle(lengthId);const turn=state.projection.turns.at(-1),usage=state.usage.find(u=>u.runId===limited.runId);assert.equal(turn.status,'completed');assert(turn.items.some(item=>item.truncated===true));assert.equal(usage.completeness,'unknown');assert.equal(usage.tokens,null);assert.equal(usage.cost,null);assert.equal(native().filter(e=>e.type==='compaction').length,1);assert.equal((await wire()).toolRequests.length,toolCount);assert.equal(sha(JSON.stringify(toolResults())),priorToolHash);
  assert(turn.items.some(item=>item.truncated===true&&item.text==='本轮讲解尚未完成，第二段未输出。'));
  report.context={policy:state.contextPolicy,counts,overflow:{status:overflow.status,errorCode:overflow.errorCode},compacted,priorToolHash,toolResults:toolResults(),limited:{sessionId:lengthId,runId:limited.runId,turn,usage},wire:await calls()};
  await close();await launch(true);const cold=await snapshot(lengthId),coldTurn=cold.projection.turns.find(t=>t.id===limited.runId);assert.deepEqual(coldTurn.items,turn.items);assert.equal((await calls()).length,0);report.context.cold={turn:coldTurn,chatRequests:0};
  check('FAT-B02-03','Small-window overflow makes exactly one native checkpoint then stops if still too large; explicit short-input recovery preserves length text/flag through cold start, tools never replay, usage/cost stays null/unknown.');
 }
 if(selected('faults')){await configure('ok');const faultId=await session('B02 classified faults');
 const initialCalls=(await calls()).length;await app.evaluate(()=>{delete process.env.DEEPSEEK_API_KEY;});
 const missing=await page.evaluate(input=>window.omniEdu.startXiaozhi(input),{sessionId:faultId,commandId:'xicmd_'+randomUUID(),prompt:'合成缺密钥任务。'});
 if(missing.ok){const state=await idle(faultId),turn=state.projection.turns.at(-1);assert.equal(turn.status,'failed');assert.equal(turn.errorCode,'authentication');report.missingKey={admission:missing,turn};}else{assert.equal(missing.error,'authentication');report.missingKey=missing;}assert.equal((await calls()).length,initialCalls);assert(!(await snapshot(faultId)).running);
 await app.evaluate(()=>{process.env.DEEPSEEK_API_KEY='synthetic-only';});
 for(const mode of ['401','429','pre','partial']){
  await configure(mode);const n=(await calls()).length;const run=await start(faultId,'解释合成题目的已知条件。');const state=await idle(faultId),turn=state.projection.turns.at(-1);assert.equal(turn.status,'failed');assert.equal((await calls()).length-n,1,'No ambiguous replay');
  if(['401','429'].includes(mode))assert.equal(turn.modelRequests.at(-1).status,Number(mode));assert.equal(turn.errorCode,{'401':'authentication','429':'rate_limited',pre:'transport',partial:'model_error'}[mode]);
  if(mode==='partial')assert(turn.items.some(x=>x.text?.includes('已保留的第一段讲解')));
  assert(!JSON.stringify(state).includes('synthetic-private-key'));(report.faults??=[]).push({mode,runId:run.runId,errorCode:turn.errorCode,modelRequests:turn.modelRequests});
 }
 await configure('ok');await start(faultId,'明确重试：只补充缺少的第二段。');assert.equal((await idle(faultId)).projection.turns.at(-1).status,'completed');
 check('FAT-B02-04','Missing key blocked before transport;401/429/pre-body/partial each dispatch once, partial preserved, explicit retry succeeds and private error text is redacted.');
 }
 report.wire=await calls();assert.deepEqual(report.errors,[]);assert.deepEqual((await wire()).blocked,[]);report.ok=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;console.error(report.error);}
finally{if(app)report.lastWire=await calls().catch(()=>[]);await close().catch(()=>{});save();console.log(JSON.stringify({ok:report.ok,checks:report.checks,root,error:report.error}));}
