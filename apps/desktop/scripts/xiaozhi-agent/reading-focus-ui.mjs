/** Original Pi and browser gestures; copied synthetic FX09 and local SSE only. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const build=path.resolve(process.argv[2]);
const source=path.resolve(process.argv[3]);
const resume=process.argv[4]?path.resolve(process.argv[4]):undefined;
const prefix=resume?JSON.parse(fs.readFileSync(path.join(resume,'report.json'))):undefined;
const original=JSON.parse(fs.readFileSync(path.join(source,'report.json')));
assert(original.ok);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-reading-focus-'));
for(const name of ['data','profile']) fs.cpSync(path.join(resume||source,name),path.join(root,name),{recursive:true});
const initial=Array.from({length:30},(_,i)=>`合成选读段落${i+1}：先观察物体所受的力，再比较运动状态。老师可以选中这一段、上翻阅读或继续编辑自己的草稿。这里只使用公开合成教学文字，不对应学生资料。`).join('\n\n')+'\n\n';
const additions=Array.from({length:16},(_,i)=>`后续课堂说明${i+1}：从现象、条件和结论三个方面说明，保持已有文字不变。新内容不应带走老师正在阅读的位置。\n\n`);
// Completion intentionally trims terminal whitespace; use an explicit final
// paragraph boundary so raw deltas and the saved public body can match exactly.
additions[additions.length-1]=additions.at(-1).trimEnd();
const expected=initial+additions.join('');
const report={ok:false,root,build,source,buildHash:fingerprint(build).sha256,
  scriptHash:sha256(fs.readFileSync(import.meta.filename)),checks:[],requests:[],errors:[],
  boundary:'Actual original Pi and native browser mouse/key actions on copied synthetic FX09. Only local controlled SSE; no paid provider, daily profile, system IME, physical pointer drag, Office or full AT acceptance. Clipboard writes are captured in this owned renderer without changing the system clipboard.'};
let app,page,id;
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
async function until(fn,ms=20000){const deadline=Date.now()+ms;while(Date.now()<deadline){if(await fn())return;await new Promise(r=>setTimeout(r,40));}throw Error('condition timeout');}
const input=()=>page.getByTestId('office-prompt-input');
const host=()=>page.getByTestId('office-conversation');
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const metrics=()=>host().evaluate(el=>({top:el.scrollTop,height:el.clientHeight,total:el.scrollHeight}));
const selected=()=>page.evaluate(()=>{const s=getSelection();return{text:s?.toString(),rect:s?.rangeCount?s.getRangeAt(0).getBoundingClientRect().toJSON():null};});
async function screenshot(name){const data=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toDataURL());fs.writeFileSync(path.join(root,name),Buffer.from(data.split(',')[1],'base64'));}
function originalFacts(){const db=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});try{return{
  journal:sha256(JSON.stringify(db.prepare('SELECT event_json,event_hash FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence').all(original.runId))),
  messages:sha256(JSON.stringify(db.prepare('SELECT id,content,metadata_json FROM ai_conversation_messages WHERE session_id=? AND id IN (SELECT id FROM ai_conversation_messages WHERE session_id=? ORDER BY created_at LIMIT 22) ORDER BY id').all(original.sessionId,original.sessionId)))
};}finally{db.close();}}
async function launch(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:path.join(root,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-reading-only',DEEPSEEK_MODEL:'deepseek-flash'};
  for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_E2E_VISIBLE']) delete env[key];
  app=await electron.launch({args:[path.join(build,'main/index.js'),'--user-data-dir='+path.join(root,'profile')],cwd:desktop,env,timeout:60000});
  await app.evaluate(({net},{initial,additions})=>{
    globalThis.readingFixture={release:0,finish:false,requests:[]};
    net.fetch=async(input,init)=>{
      const url=typeof input==='string'?input:input.url;
      if(url.endsWith('/models')) return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
      if(!url.endsWith('/chat/completions')) throw Error('No provider allowed');
      const f=globalThis.readingFixture;
      if(f.requests.length) throw Error('Unexpected duplicate model request');
      const record={local:true,released:0,done:false,aborted:false};f.requests.push(record);
      const encoder=new TextEncoder(),body=JSON.parse(init.body);
      return new Response(new ReadableStream({async start(controller){
        const emit=(delta,finish_reason=null)=>controller.enqueue(encoder.encode('data: '+JSON.stringify({id:'reading-focus',object:'chat.completion.chunk',model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n'));
        try{
          emit({role:'assistant'});emit({reasoning_content:'SYNTHETIC_PRIVATE_REASONING_ONLY'});emit({content:initial});
          for(let index=0;index<additions.length;index++){
            const phase=index<8?1:index<12?2:3;
            while(f.release<phase){init.signal?.throwIfAborted();await new Promise(r=>setTimeout(r,20));}
            init.signal?.throwIfAborted();emit({content:additions[index]});record.released++;await new Promise(r=>setTimeout(r,60));
          }
          while(!f.finish){init.signal?.throwIfAborted();await new Promise(r=>setTimeout(r,20));}
          emit({},'stop');controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close();record.done=true;
        }catch(error){record.aborted=true;controller.error(error);}
      }}),{headers:{'content-type':'text/event-stream'}});
    };
  },{initial,additions});
  page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('[data-testid=office-prompt-input]')?.disabled);
  id=await page.locator('.office-composer-container').getAttribute('data-session-id');
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setZoomFactor(1);w.setContentSize(1366,768);});
  await page.waitForFunction(()=>innerWidth===1366);
}
async function close(){if(app){report.selectionTrace ||= await page?.evaluate(()=>globalThis.readingSelectionTrace);report.requests.push(...await app.evaluate(()=>globalThis.readingFixture.requests));await app.close();app=undefined;}}
async function chooseLastParagraph(){
  const paragraph=host().locator(`[data-turn-id="${report.runId}"] [data-slot=markdown] p`).last();
  const points=await paragraph.evaluate(el=>{
    const node=document.createTreeWalker(el,NodeFilter.SHOW_TEXT).nextNode();
    if(!node||node.length<12)throw Error('No selectable public text');
    const a=document.createRange(),b=document.createRange();a.setStart(node,0);a.setEnd(node,1);b.setStart(node,9);b.setEnd(node,10);
    const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return{a:{x:x.left+1,y:x.top+x.height/2},b:{x:y.right-1,y:y.top+y.height/2}};
  });
  await page.mouse.move(points.a.x,points.a.y);await page.mouse.down();await page.mouse.move(points.b.x,points.b.y,{steps:10});await page.mouse.up();
  const value=await selected();assert(value.text?.length>=6,JSON.stringify(value));return value;
}
try{
  report.originalBefore=originalFacts();await launch();assert.equal(id,original.sessionId);
  const draft=Array.from({length:35},(_,i)=>`中文草稿${i+1}：力与运动的条件、现象和结论。`).join('\n');
  let multiline=draft+'\n换行后中文';
  if(!resume){
  assert.equal((await snapshot()).projection.turns.length,11);
  await input().fill(draft);await input().press('End');await input().press('Shift+Enter');await page.keyboard.insertText('换行后中文');
  multiline=await input().inputValue();assert(multiline.includes('\n换行后中文'));
  await input().evaluate(el=>{
    el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'中'}));
    el.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',code:'Enter',isComposing:true}));
    el.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',code:'Enter',keyCode:229}));
    el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中'}));
  });
  assert.equal(await input().inputValue(),multiline);assert.equal((await snapshot()).projection.turns.length,11);assert.equal(await app.evaluate(()=>readingFixture.requests.length),0);
  check('Original textarea preserves long Chinese paste, Shift+Enter and browser composition/229 Enter without submitting (not OS IME acceptance)');
  await input().fill('请只输出公开合成教学说明，不调用工具。');await input().press('Enter');await input().press('Enter');
  await until(async()=>{const s=await snapshot();report.runId=s.projection.turns.at(-1)?.id;return s.running&&s.projection.turns.at(-1)?.items.some(item=>item.role==='assistant'&&(item.text?.length||0)>=initial.length);});
  await until(async()=>{const m=await metrics();return m.total>m.height&&m.total-m.top-m.height<=4;});
  assert.equal(await input().inputValue(),'');assert.equal(await app.evaluate(()=>readingFixture.requests.length),1);
  report.selectionBefore=await chooseLastParagraph();report.scrollBefore=await metrics();
  assert(report.scrollBefore.total-report.scrollBefore.top-report.scrollBefore.height<=4,'Selection must start at the actual bottom, not after scrolling up');
  await screenshot('selection-before.png');check('Original Enter sends once; a real mouse drag selects the newest paragraph while the scroller is at the bottom');
  await page.evaluate(()=>{
    globalThis.readingSelectionTrace=[];
    const root=document.querySelector('[data-testid=office-conversation]');
    const original=getSelection().anchorNode.parentElement.closest('[data-item-id]').getAttribute('data-item-id');
    const record=event=>{if(readingSelectionTrace.length>=50)return;const s=getSelection(),item=[...root.querySelectorAll('[data-item-id]')].find(el=>el.getAttribute('data-item-id')===original);
      readingSelectionTrace.push({event,selected:s.toString(),connected:!!item,chars:item?.textContent?.length,top:root.scrollTop});};
    document.addEventListener('selectionchange',()=>record('selectionchange'));
    new MutationObserver(()=>record('mutation')).observe(root,{childList:true,subtree:true,characterData:true});
  });
  await app.evaluate(()=>{readingFixture.release=1;});
  await until(async()=>await app.evaluate(()=>readingFixture.requests[0]?.released===8));
  await until(async()=>{const s=await snapshot();return s.running&&s.projection.turns.at(-1)?.items.some(item=>item.role==='assistant'&&item.text===initial+additions.slice(0,8).join(''));});
  report.selectionAfter=await selected();report.scrollAfter=await metrics();
  assert.equal(report.selectionAfter.text,report.selectionBefore.text);
  assert(Math.abs(report.selectionAfter.rect.top-report.selectionBefore.rect.top)<=4,JSON.stringify({before:report.selectionBefore.rect,after:report.selectionAfter.rect,scrollBefore:report.scrollBefore,scrollAfter:report.scrollAfter}));
  await screenshot('selection-after.png');check('The selected public passage and its visible position survive later streaming text without automatic pursuit');
  await page.evaluate(()=>{globalThis.selectionCopy='';document.addEventListener('copy',event=>{globalThis.selectionCopy=getSelection()?.toString()||'';event.preventDefault();},{once:true});});
  await page.keyboard.press('Control+C');assert.equal(await page.evaluate(()=>globalThis.selectionCopy),report.selectionBefore.text);
  check('Keyboard copy contains exactly the selected public passage without changing the system clipboard');
  const box=await host().boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-30000);
  await until(async()=>(await metrics()).top<=4);const top=await metrics();
  await app.evaluate(()=>{readingFixture.release=2;});
  await until(async()=>await app.evaluate(()=>readingFixture.requests[0]?.released===12));
  await until(async()=>{const s=await snapshot();return s.running&&s.projection.turns.at(-1)?.items.some(item=>item.role==='assistant'&&item.text===initial+additions.slice(0,12).join(''));});
  assert(Math.abs((await metrics()).top-top.top)<=4);assert.equal((await selected()).text,report.selectionBefore.text);
  check('Actual wheel-up releases selection pinning while more text arrives, retaining the selected text and upper reading position');
  await page.getByRole('button',{name:'回到最新消息',exact:true}).click();await until(async()=>{const m=await metrics();return m.total-m.top-m.height<=4;});
  await app.evaluate(()=>{readingFixture.release=3;});
  await until(async()=>await app.evaluate(()=>readingFixture.requests[0]?.released===16));
  await until(async()=>{const m=await metrics();return m.total-m.top-m.height<=4;});
  report.completionSelectionBefore=await chooseLastParagraph();
  await app.evaluate(()=>{readingFixture.finish=true;});await until(async()=>!(await snapshot()).running);
  report.completionSelectionAfter=await selected();
  assert.equal(report.completionSelectionAfter.text,report.completionSelectionBefore.text);
  assert(Math.abs(report.completionSelectionAfter.rect.top-report.completionSelectionBefore.rect.top)<=4);
  check('Original latest resumes following; a fresh selection survives the final streaming-to-completed transition at the same visible position');
  }else{
    assert.equal(prefix.buildHash,report.buildHash);assert.equal(prefix.checks.length,6);
    assert(prefix.error.startsWith('locator.click: Timeout')&&prefix.error.includes("name: '回到最新消息'"));assert(prefix.requests.length===1&&prefix.requests[0].done&&!prefix.requests[0].aborted);
    report.runId=prefix.runId;
    report.reusedPrefix={report:path.join(resume,'report.json'),sha256:sha256(fs.readFileSync(path.join(resume,'report.json'))),checks:prefix.checks,buildHash:prefix.buildHash,
      boundary:'The six prefix checks passed before an unnecessary hidden-button lookup; retain that failure and resume only the unchecked tail, without regenerating.'};
  }
  const completedMetrics=await metrics();report.completedMetrics=completedMetrics;
  if(completedMetrics.total-completedMetrics.top-completedMetrics.height>4){
    await page.getByRole('button',{name:'回到最新消息',exact:true}).click();await until(async()=>{const m=await metrics();return m.total-m.top-m.height<=4;});
  }
  const final=await snapshot(),turn=final.projection.turns.find(turn=>turn.id===report.runId);
  assert.equal(turn.status,'completed');assert.equal(turn.items.filter(item=>item.role==='assistant'&&item.kind==='message').map(item=>item.text||'').join(''),expected);
  await page.evaluate(()=>{globalThis.replyCopy='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{globalThis.replyCopy=text;}}});});
  await host().locator(`[data-turn-id="${report.runId}"]`).getByTestId('reply-copy').click();
  assert.equal(await page.evaluate(()=>globalThis.replyCopy),expected);assert(!expected.includes('SYNTHETIC_PRIVATE_REASONING_ONLY'));
  check('Original reply-copy action copies the exact public answer and excludes separately recorded native reasoning');
  const db=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});try{
    const events=db.prepare('SELECT event_json FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence').all(report.runId).map(row=>JSON.parse(row.event_json));
    assert.equal(events.filter(event=>event.kind==='text_delta').map(event=>event.delta).join(''),expected);
    const messages=db.prepare('SELECT content,metadata_json FROM ai_conversation_messages WHERE session_id=? AND role=?').all(id,'assistant').filter(row=>JSON.parse(row.metadata_json||'{}').agentRunId===report.runId);
    assert.equal(messages.length,1);assert.equal(messages[0].content,expected);report.publicTextSha256=sha256(expected);
  }finally{db.close();}
  report.originalAfter=originalFacts();assert.deepEqual(report.originalAfter,report.originalBefore);
  check('Original FX09 facts are unchanged; the new run public UI text, SQLite message and full text_delta journal agree exactly');
  await input().fill(multiline);const durable=JSON.stringify(final.projection.turns);await close();await launch();
  assert.equal(JSON.stringify((await snapshot()).projection.turns),durable);assert.equal(await input().inputValue(),multiline);assert.equal((await selected()).text,'');assert.equal(await app.evaluate(()=>readingFixture.requests.length),0);
  check('Cold restore retains the exact original session, long Chinese draft and durable answer without restoring transient selection or replaying generation');
  await close();assert.equal(report.requests.length,resume?0:1);assert(report.requests.every(r=>r.local&&r.done&&!r.aborted));assert.deepEqual(report.errors,[]);
  assert.equal(fingerprint(build).sha256,report.buildHash);assert.equal(sha256(fs.readFileSync(import.meta.filename)),report.scriptHash);report.ok=true;
}catch(error){report.error=String(error.stack||error);await screenshot('failure.png').catch(()=>{});process.exitCode=1;}
finally{await close().catch(()=>{});fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,root,checks:report.checks.length,error:report.error}));}
