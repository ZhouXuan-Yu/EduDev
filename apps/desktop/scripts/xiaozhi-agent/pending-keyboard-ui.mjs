/** Formal Pi, original controls and owned synthetic files; no paid provider. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
import {assertIsolatedPiMain} from '../acceptance/build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..'),build=path.resolve(process.argv[2]);
const baseline=process.argv.includes('--baseline');
const resume=process.argv.find(arg=>arg.startsWith('--resume='))?.slice('--resume='.length);
const prefix=resume?JSON.parse(fs.readFileSync(path.join(resume,'report.json'))):undefined;
if(prefix){assert(path.resolve(resume).startsWith(path.join(os.tmpdir(),'xiaozhi-pending-keyboard-')));assert.equal(prefix.buildHash,fingerprint(build).sha256);assert.equal(prefix.checks.length,3);assert(prefix.error?.includes('0 !== 1'));assert.equal(prefix.requests.length,5);assert.deepEqual(prefix.errors,[]);}
const root=resume?path.resolve(resume):fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-pending-keyboard-'));
const report={ok:false,baseline,root,build,buildHash:fingerprint(build).sha256,scriptHash:sha256(fs.readFileSync(import.meta.filename)),checks:[],observations:[],requests:[],errors:[],boundary:'Original formal Pi, native journal/SQLite and controlled local SSE. Browser keyboard actions in an isolated synthetic instance; no daily profile, paid provider, physical desktop input, OS IME or full FX/AT acceptance.'};
if(prefix)report.prefix={file:path.join(root,'report.json'),sha256:sha256(fs.readFileSync(path.join(root,'report.json'))),checks:prefix.checks,scriptHash:prefix.scriptHash};
const lesson='# 合成课堂观察\n\n先观察浮力，再说明排开液体的体积。\n';
let app,page,id=prefix?.sessionId;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){const end=Date.now()+30000;while(Date.now()<end){const value=await fn();if(value)return value;await delay(40);}throw Error('Keyboard fixture timed out');}
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const snap=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const input=()=>page.getByTestId('office-prompt-input');
async function focused(){return page.evaluate(()=>({testId:document.activeElement?.getAttribute('data-testid'),slot:document.activeElement?.getAttribute('data-slot'),text:document.activeElement?.textContent?.slice(0,80)}));}
async function tabTo(target){for(let i=0;i<40;i++){if(await target.evaluate(el=>document.activeElement===el))return;await page.keyboard.press('Tab');}throw Error('Keyboard target is not reachable');}
async function screenshot(name){const uri=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toDataURL());fs.writeFileSync(path.join(root,name),Buffer.from(uri.split(',')[1],'base64'));}
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:path.join(root,'data'),OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-keyboard-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_E2E_VISIBLE'])delete env[key];
 app=await electron.launch({args:[path.join(build,'main/index.js'),'--user-data-dir='+path.join(root,'profile')],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net})=>{
  globalThis.keyboardFixture={requests:[]};
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.endsWith('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
   if(!url.endsWith('/chat/completions'))throw Error('External network disabled in fixture');
   const body=JSON.parse(init.body),index=globalThis.keyboardFixture.requests.length;
   if(index>=5)throw Error('Unexpected model replay');
   const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
   const requirementsVersion=Number([...system.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1);
   const tool=index===0?{name:'ask_teacher',arguments:JSON.stringify({question:'这节合成观察活动采用什么形式？',options:['小组合作','独立观察']})}:index===2?{name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion,expectedRevision:0,reason:'保存合成观察稿后交由教师核对',steps:[{id:'save',text:'保存合成观察稿',dependsOn:[],reported:'pending',kind:'saved_text',target:'keyboard-lesson.md'},{id:'review',text:'教师核对课堂观察稿',dependsOn:['save'],reported:'pending',kind:'human'}]})}:index===3?{name:'office_create_text',arguments:JSON.stringify({taskStepId:'save',path:'keyboard-lesson.md',content:'# 合成课堂观察\n\n先观察浮力，再说明排开液体的体积。\n'})}:undefined;
   if(tool&&!body.tools?.some(t=>t.function.name===tool.name))throw Error('Real tool not available: '+tool.name);
   globalThis.keyboardFixture.requests.push({index,local:true,model:body.model,tool:tool?.name,teacherAnswer:JSON.stringify(body.messages).includes('小组合作')});
   const chunks=[{role:'assistant'},tool?{content:'我会先处理教师需要参与的步骤。',tool_calls:[{index:0,id:'keyboard_tool_'+index,type:'function',function:tool}]}:{content:index===1?'已收到：小组合作。':'教学文件已由教师确认保存。'}];
   const stream=chunks.map(delta=>'data: '+JSON.stringify({id:'keyboard-'+index,object:'chat.completion.chunk',model:body.model,choices:[{index:0,delta,finish_reason:null}]})+'\n\n').join('')+'data: '+JSON.stringify({id:'keyboard-'+index,object:'chat.completion.chunk',model:body.model,choices:[{index:0,delta:{},finish_reason:tool?'tool_calls':'stop'}]})+'\n\ndata: [DONE]\n\n';
   return new Response(stream,{headers:{'content-type':'text/event-stream'}});
  };
 });
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await input().isDisabled());
 const session=await page.locator('.office-composer-container').getAttribute('data-session-id');if(id)assert.equal(session,id);id=session;
 report.runtime=await assertIsolatedPiMain(app,path.join(build,'main/index.js'),path.join(root,'profile'));
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setZoomFactor(1);w.setContentSize(1366,768);});
 await page.waitForFunction(()=>innerWidth===1366);
}
async function close(){if(app){report.requests.push(...await app.evaluate(()=>keyboardFixture.requests));await app.close();app=undefined;}}
async function send(text){await input().fill(text);await input().press('Enter');}
async function settled(){return until(async()=>{const s=await snap();return !s.running&&s.projection.turns.at(-1);});}
function facts(){const db=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});try{return{events:sha256(JSON.stringify(db.prepare('SELECT run_id,sequence,event_json,event_hash FROM xiaozhi_event_journal ORDER BY run_id,sequence').all())),messages:sha256(JSON.stringify(db.prepare('SELECT id,content,metadata_json FROM ai_conversation_messages WHERE session_id=? ORDER BY id').all(id)))};}finally{db.close();}}
try{
 await launch();report.sessionId=id;
 if(!resume){
 for(const width of [1366,480]){
  await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setContentSize(width,768),width);await page.waitForFunction(w=>innerWidth===w,width);
  const trigger=page.getByTestId('pi-aside-toggle');await trigger.focus();await trigger.press('Enter');await page.getByTestId('edu-context-panel').waitFor();
  const observed=await focused();report.observations.push({width,stage:'panel-open',focused:observed});await screenshot('panel-'+width+'.png');
  if(baseline){await page.getByTestId('workbench-panel-close').click();continue;}
  assert.equal(observed.testId,'workbench-panel-close');await page.keyboard.press('Tab');assert.equal((await focused()).testId,'workbench-tab-tasks');
  await page.keyboard.press('ArrowRight');await until(async()=>(await focused()).testId==='workbench-tab-files');await page.keyboard.press('Escape');
  await page.getByTestId('edu-context-panel').waitFor({state:'detached'});await until(async()=>(await focused()).testId==='pi-aside-toggle');
 }
 if(!baseline)check('Keyboard opens both wide/narrow right panels, reaches tabs with Tab/arrows and Esc restores the actual trigger');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));
 await send('合成键盘验证：请问活动形式，收到回答后复述。');
 const question=await until(async()=>(await snap()).controls?.find(q=>q.kind==='question'&&q.state==='pending'));
 const q=page.locator(`[data-testid="pi-teacher-question"][data-control-id="${question.id}"]`);
 await q.locator('[data-slot=chat-tool-trigger]').focus();await page.keyboard.press('Enter');
 const questionNotice=page.locator(`[data-testid="workspace-pending-approval"][data-pending-id="${question.id}"]`);await questionNotice.focus();await page.keyboard.press('Enter');
 await until(async()=>(await focused()).testId==='pi-question-answer');
 await page.keyboard.type('小组合作');await page.keyboard.press('Tab');assert.equal((await focused()).testId,'pi-question-submit');await page.keyboard.press('Enter');
 const first=await settled();assert.equal(first.status,'completed',first.error);assert.equal((await snap()).controls.find(c=>c.id===question.id).answer,'小组合作');
 assert((await app.evaluate(()=>keyboardFixture.requests))[1].teacherAnswer);check('Original Pi pending question stays reachable outside the process; keyboard answer reaches the native tool continuation exactly once');
 await send('合成键盘验证：请创建 keyboard-lesson.md 并等待确认保存。');
 const change=await until(async()=>(await snap()).changes?.find(c=>c.state==='pending'));
 const card=page.locator(`[data-testid="pi-text-change"][data-change-id="${change.id}"]`),review=card.locator('[data-slot=chat-tool-trigger]');
 await card.getByTestId('pi-text-review').waitFor();await review.focus();await review.press('Enter');
 const notification=page.locator(`[data-testid="workspace-pending-approval"][data-pending-id="${change.id}"]`);await notification.focus();await notification.press('Enter');
 await until(async()=>await review.getAttribute('aria-expanded')==='true');await delay(50);
 const reviewFocus=await focused();report.observations.push({stage:'review-notice',focused:reviewFocus});await screenshot('pending-review.png');
 if(!baseline){assert.equal(reviewFocus.slot,'chat-tool-trigger');check('Pending file notice opens its actual preview and focuses review, without selecting or executing a write decision');}
 const before=(await snap()).changes.find(c=>c.id===change.id);assert.equal(before.state,'pending');
 if(baseline)await card.getByTestId('pi-text-approve').focus();else await tabTo(card.getByTestId('pi-text-approve'));
 await page.keyboard.press('Enter');const second=await settled();assert.equal(second.status,'completed',second.error);
 const saved=(await snap()).changes.find(c=>c.id===change.id);assert.equal(saved.state,'applied');
 }
 const files=[];function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(entry.name==='keyboard-lesson.md')files.push(file);}}visit(path.join(root,'XiaozhiOutputs'));
 if(resume){assert.deepEqual((await snap()).projection,prefix.lastSnapshot.projection);assert.equal((await snap()).changes.find(c=>c.path==='keyboard-lesson.md').state,'applied');}
 assert.equal(files.length,1);assert.equal(fs.readFileSync(files[0],'utf8'),lesson);report.savedFileHash=sha256(fs.readFileSync(files[0]));check('Tab to original explicit save and Enter produce one exact owned file; SQLite remains pending before that decision');
 const fileNotice=page.getByTestId('workspace-files-available');await fileNotice.focus();await fileNotice.press('Enter');await page.getByTestId('edu-context-panel').waitFor();
 if(!baseline){assert.equal((await focused()).testId,'workbench-panel-close');await page.keyboard.press('Escape');await until(async()=>(await focused()).testId==='workspace-files-available');check('Closing the file panel returns to the saved-file notification that opened it, rather than a different header control');}
 else await page.getByTestId('workbench-panel-close').click();
 await input().fill('未发送合成草稿：继续检查课堂观察。');await input().focus();
 const draft=await input().inputValue(),originalFacts=facts(),projection=(await snap()).projection;
 await page.getByTestId('pi-files-toggle').focus();await page.keyboard.press('Enter');await page.getByTestId('edu-context-panel').waitFor();
 await input().focus();await page.reload();await page.getByTestId('xiaozhi-pi-workspace').waitFor();await until(async()=>!await input().isDisabled());
 assert.notEqual((await focused()).testId,'workbench-panel-close','Restoring a preference must not request panel focus');assert.equal(await input().inputValue(),draft);
 assert.equal(await app.evaluate(()=>keyboardFixture.requests.length),resume?0:5);await close();await launch();
 assert.equal(await input().inputValue(),draft);assert.deepEqual((await snap()).projection,projection);assert.deepEqual(facts(),originalFacts);assert.equal(await app.evaluate(()=>keyboardFixture.requests.length),0);
 assert.equal(sha256(fs.readFileSync(files[0])),report.savedFileHash);report.facts=originalFacts;check('Reload/cold launch restore the exact two native runs, saved file and unsent draft with zero replay; restored panel preferences do not steal focus');
 assert.deepEqual(report.errors,[]);assert.equal(fingerprint(build).sha256,report.buildHash);
 if(baseline){report.reproduced=report.observations.filter(o=>o.stage==='panel-open'&&o.focused.testId!=='workbench-panel-close'||o.stage==='review-notice'&&o.focused.slot!=='chat-tool-trigger');assert(report.reproduced.length);report.expectedFailure=true;process.exitCode=1;}
 else report.ok=true;
}catch(error){report.error=String(error.stack).slice(0,5000);process.exitCode=1;await screenshot('failure.png').catch(()=>{});if(page)report.lastSnapshot=await snap().catch(()=>undefined);}
finally{await close();fs.writeFileSync(path.join(root,resume?'report-tail.json':'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,baseline,root,checks:report.checks.length,error:report.error}));}
