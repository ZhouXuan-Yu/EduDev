/** FX09 controlled production Pi stream. All provider traffic is intercepted locally. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';

const desktop=path.resolve(import.meta.dirname,'../..');
const build=path.resolve(process.argv[2]||path.join(desktop,'out'));
assert(build.startsWith(path.join(desktop,'test-results')+path.sep),'Use an immutable test build');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-complex-stream-'));
const sha=v=>createHash('sha256').update(v).digest('hex');
const paragraphs=Array.from({length:50},(_,i)=>`第${i+1}段：教学演示先明确条件，再引导学生比较证据。${'教师保留草稿并核对学生解释。'.repeat(8)}\n\n${i<10?'$$F_{'+i+'}=\\rho g V$$\n\n':''}`);
const table='| 次数 | 体积 | 浮力 | 观察记录 |\n|---|---|---|---|\n'+Array.from({length:100},(_,i)=>`| ${i+1} | ${i+1} | ${(i+1)*10} | 保持密度不变 |`).join('\n')+'\n\n';
const code='```javascript\n// 中文课堂演示：保留原始计算条件\nconst 密度 = 1000;\nconst 浮力 = 体积 => 密度 * 10 * 体积;\n```\n\n';
const text=paragraphs.slice(0,25).join('')+table+code+paragraphs.slice(25).join('')+code+'复杂流式正文完成。';
const history=Array.from({length:10},(_,i)=>`历史第${i+1}轮：\n\n`+paragraphs.slice(0,12).join('')+code+`历史${i+1}完成。`);
const fixture={revision:'fx09-complex-stream.v1',text,history,chunkCharacters:24,chunkDelayMs:20};
const report={ok:false,root,build,fixtureSha256:sha(JSON.stringify(fixture)),fixture:{revision:fixture.revision,paragraphs:50,formulas:10,tableRows:100,codeFences:2,historyTurns:10,utf8Bytes:Buffer.byteLength(text)},checks:[],errors:[],boundary:'Original UI -> production Pi -> local synthetic SSE -> original persistence/renderer. Input/scroll dispatch to next animation frame, not remote provider latency. No real provider or teacher data.'};
let app,page;
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const until=async fn=>{const end=Date.now()+90000;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,50));}throw Error('condition timeout');};
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:path.join(root,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:'synthetic-complex-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 app=await electron.launch({args:[path.join(build,'main/index.js'),'--user-data-dir='+path.join(root,'profile')],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net},fixture)=>{
  globalThis.complexRequests=[];
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
   if(!url.endsWith('/chat/completions'))throw Error('External request blocked');
   const index=globalThis.complexRequests.length;globalThis.complexRequests.push({index,aborted:false});
   const answer=fixture.history[index]??fixture.text,encoder=new TextEncoder();
   const emit=(controller,delta,finish_reason=null)=>controller.enqueue(encoder.encode('data: '+JSON.stringify({id:'complex-'+index,object:'chat.completion.chunk',model:'deepseek-flash',choices:[{index:0,delta,finish_reason}]})+'\n\n'));
   return new Response(new ReadableStream({async start(controller){try{
    emit(controller,{role:'assistant',content:''});await new Promise(r=>setTimeout(r,250));
    const size=index<fixture.history.length?answer.length:fixture.chunkCharacters;
    for(let p=0;p<answer.length;p+=size){init.signal?.throwIfAborted();emit(controller,{content:answer.slice(p,p+size)});await new Promise(r=>setTimeout(r,index<fixture.history.length?0:fixture.chunkDelayMs));}
    emit(controller,{},'stop');controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close();
   }catch(e){globalThis.complexRequests[index].aborted=true;controller.error(e);}}}),{headers:{'content-type':'text/event-stream'}});
  };
 },fixture);
 page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
try{
 await launch();
 report.environment={cpus:os.cpus().map(c=>c.model),memoryBytes:os.totalmem(),...await app.evaluate(({BrowserWindow,screen,app})=>({versions:process.versions,platform:process.platform,displays:screen.getAllDisplays(),appVersion:app.getVersion(),bounds:BrowserWindow.getAllWindows()[0].getBounds()}))};
 const prompt=page.getByTestId('office-prompt-input');
 for(let i=0;i<history.length;i++){
  await prompt.fill(`保留第${i+1}轮课堂说明，只回答正文。`);await page.getByRole('button',{name:'发送消息',exact:true}).click();
  await until(async()=>{const body=page.getByTestId('agent-reply-body').last();return await body.count()&&await body.innerText().then(s=>s.includes(`历史${i+1}完成。`))&&await page.getByRole('button',{name:'发送消息',exact:true}).count();});
 }
 check('Original composer/Pi persists ten real controlled history turns');
 report.before=await page.evaluate(async()=>{const list=await window.omniEdu.listAiConversations();return list;});
 report.resourcesBefore=await app.evaluate(({app})=>app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,memory:p.memory,cpu:p.cpu})));
 await page.evaluate(()=>{
  const probe=globalThis.complexProbe={inputs:[],scrolls:[],longTasks:[],gaps:[],mutations:0};
  const input=document.querySelector('[data-testid="office-prompt-input"]'),scroller=document.querySelector('[data-testid="office-conversation"]');
  input.addEventListener('input',event=>{const start=performance.now();requestAnimationFrame(()=>probe.inputs.push({at:start,duration:performance.now()-start,eventTimestamp:event.timeStamp}));},{capture:true});
  scroller.addEventListener('scroll',event=>{const start=performance.now();requestAnimationFrame(()=>probe.scrolls.push({at:start,duration:performance.now()-start,eventTimestamp:event.timeStamp,top:scroller.scrollTop}));},{capture:true});
  globalThis.complexLongObserver=new PerformanceObserver(list=>probe.longTasks.push(...list.getEntries().map(e=>({at:e.startTime,duration:e.duration}))));complexLongObserver.observe({type:'longtask'});
  let last=performance.now();globalThis.complexTimer=setInterval(()=>{const n=performance.now();probe.gaps.push(n-last-16);last=n;},16);
 });
 await prompt.fill('生成五十段课堂说明、公式、百行表格和中文代码，只返回正文。');
 await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await until(async()=>await app.evaluate(()=>globalThis.complexRequests.length===11));
 report.runningStart=await page.evaluate(()=>performance.now());
 report.resources=[];
 for(let i=0;i<30;i++){
  assert(await page.getByRole('button',{name:'停止本轮',exact:true}).count(),'Interactions must happen during generation');
  await prompt.fill(`生成期间的教师草稿 ${i}`);
  const scroller=page.getByTestId('office-conversation');await scroller.hover();await page.mouse.wheel(0,i%2===0?-300:120);
  if(i%5===0)report.resources.push(await app.evaluate(({app})=>app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,memory:p.memory,cpu:p.cpu}))));
  await new Promise(r=>setTimeout(r,100));
 }
 report.runningEnd=await page.evaluate(()=>performance.now());
 await until(async()=>await page.getByTestId('agent-reply-body').last().innerText().then(s=>s.includes('复杂流式正文完成。'))&&await page.getByRole('button',{name:'发送消息',exact:true}).count());
 assert.equal(await prompt.inputValue(),'生成期间的教师草稿 29');
 const snap=await page.evaluate(async()=>{const workspace=await window.omniEdu.listAiConversations();const id=workspace.sessions[0].id;return window.omniEdu.getXiaozhiSnapshot(id);});
 const last=snap.projection.turns.at(-1),body=last.items.filter(item=>item.kind==='message'&&item.role==='assistant').map(item=>item.text||'').join('');assert.equal(body,text);
 report.sessionId=snap.projection.threadId;report.runId=last.id;report.controlsDefined=Array.isArray(snap.controls);report.rawTextSha256=sha(body);report.domCounts=await page.evaluate(()=>({turns:document.querySelectorAll('[data-turn-id]').length,paragraphs:document.querySelectorAll('.office-markdown p').length,formulas:document.querySelectorAll('.katex').length,rows:document.querySelectorAll('.office-markdown tr').length}));
 report.probe=await page.evaluate(()=>{clearInterval(complexTimer);complexLongObserver.disconnect();return complexProbe;});
 const stats=a=>{const s=[...a].sort((x,y)=>x-y);return{count:s.length,p95:s[Math.max(0,Math.ceil(s.length*.95)-1)]??0,max:s.at(-1)??0};};
 const during=s=>s.filter(v=>v.at>=report.runningStart&&v.at<=report.runningEnd).map(v=>v.duration);
 report.metrics={inputToFrame:stats(during(report.probe.inputs)),scrollToFrame:stats(during(report.probe.scrolls)),longTasks:stats(report.probe.longTasks.map(e=>e.duration)),eventLoopGaps:stats(report.probe.gaps)};
 assert(report.metrics.inputToFrame.count>=30);assert(report.metrics.scrollToFrame.count>=30);
 for(const metric of [report.metrics.inputToFrame,report.metrics.scrollToFrame]){assert(metric.p95<=100,'Interaction to next-frame P95 must stay within 100ms');assert(metric.max<=250,'Interaction to next-frame max must stay within 250ms');}
 check('Mixed long stream preserves exact raw正文, ten histories and edited teacher draft');
 assert.equal(await app.evaluate(()=>globalThis.complexRequests.length),11);assert.deepEqual(report.errors,[]);
 await page.screenshot({path:path.join(root,'complete.png')});await app.close();app=undefined;
 const db=new DatabaseSync(path.join(root,'data','app.db'),{readOnly:true});try{const journal=db.prepare('SELECT event_json,event_hash FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence').all(report.runId);assert(journal.length);report.journal={rows:journal.length,sha256:sha(JSON.stringify(journal))};}finally{db.close();}
 check('Actual original SQLite journal remains readable after normal close');report.ok=true;
}catch(error){report.error=error.stack;console.error(error.stack);process.exitCode=1;await page?.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,root,metrics:report.metrics,error:report.error}));}
