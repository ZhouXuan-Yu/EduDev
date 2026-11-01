/** Original Pi and Hana reads, local SSE only, owned files/profile. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import '../office-agent/register-source.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
import {assertIsolatedPiMain} from '../acceptance/build-root.mjs';
const {conversationOutputLocation}=await import('../../src/main/xiaozhi-agent/conversation-output-path.ts');
const desktop=path.resolve(import.meta.dirname,'../..'),build=path.resolve(process.argv[2]);
const baseline=process.argv.includes('--baseline');
const resume=process.argv.find(arg=>arg.startsWith('--resume='))?.slice('--resume='.length);
if(resume)assert(path.resolve(resume).startsWith(path.join(os.tmpdir(),'xiaozhi-run-receipts-')));
const prefix=resume?JSON.parse(fs.readFileSync(path.join(resume,'report.json'))):undefined;
if(prefix){assert.equal(prefix.ok,true);assert.equal(prefix.checks.length,4);assert.equal(prefix.baseline,false);assert.deepEqual(prefix.errors,[]);}
const root=resume?path.resolve(resume):fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-run-receipts-')),data=path.join(root,'data');
const report={ok:false,baseline,root,build,buildHash:fingerprint(build).sha256,scriptHash:sha256(fs.readFileSync(import.meta.filename)),checks:[],requests:[],errors:[],boundary:'Original formal Pi, Hana IO, typed snapshot and native SQLite/journal. Synthetic local SSE only; zero paid requests, no daily profile or physical desktop input. No model-quality or full E06/E07 acceptance claim.'};
let app,page,id=prefix?.sessionId,workspace;
const input=()=>page.getByTestId('office-prompt-input');
const snap=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){const end=Date.now()+30000;while(Date.now()<end){const value=await fn();if(value)return value;await delay(30);}throw Error('Run receipts fixture timed out');}
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
async function screenshot(name){const uri=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toDataURL());fs.writeFileSync(path.join(root,name),Buffer.from(uri.split(',')[1],'base64'));}
function facts(){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return{events:sha256(JSON.stringify(db.prepare('SELECT run_id,sequence,event_json,event_hash FROM xiaozhi_event_journal ORDER BY run_id,sequence').all())),messages:sha256(JSON.stringify(db.prepare('SELECT id,content,metadata_json FROM ai_conversation_messages WHERE session_id=? ORDER BY id').all(id)))};}finally{db.close();}}
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-receipts-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','OMNI_EDU_E2E_VISIBLE'])delete env[key];
 app=await electron.launch({args:[path.join(build,'main/index.js'),'--user-data-dir='+path.join(root,'profile')],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net})=>{
  globalThis.receiptFixture={requests:[],results:[]};
  globalThis.receiptFixture.coldOnly=false;
  net.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url.endsWith('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
   if(!url.endsWith('/chat/completions'))throw Error('External network disabled in fixture');
   if(globalThis.receiptFixture.coldOnly)throw Error('Model dispatch forbidden during receipt-only continuation');
   const body=JSON.parse(init.body),s=globalThis.receiptFixture,index=s.requests.length;
   if(index>=3)throw Error('Unexpected model replay');
   const last=body.messages.filter(m=>m.role==='tool').at(-1);
   if(last){const text=typeof last.content==='string'?last.content:last.content.filter(p=>p.type==='text').map(p=>p.text).join('\n');let value;for(const line of text.split('\n')){try{const v=JSON.parse(line);if(v&&typeof v==='object'&&'success'in v)value=v;}catch{}}if(!value)throw Error('Actual tool result not found');s.results.push(value);}
   const tool=index<2?{name:'office_read_text',arguments:JSON.stringify({path:index===0?'合成资料.txt':'缺失资料.txt'})}:undefined;
   if(tool&&!body.tools?.some(t=>t.function.name===tool.name))throw Error('Original tool not available');
   s.requests.push({index,local:true,tool:tool?.name||null});
   // Deliberately untrustworthy model prose must never certify real host effects.
   const delta=tool?{tool_calls:[{index:0,id:'receipt_tool_'+index,type:'function',function:tool}]}:{content:'合成模型回复：两份资料均已处理完毕。'};
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'receipt-'+index,object:'chat.completion.chunk',model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant'})+chunk(delta)+chunk({},tool?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
 });
 page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await input().isDisabled());
 const current=await page.locator('.office-composer-container').getAttribute('data-session-id');if(id)assert.equal(current,id);id=current;
 workspace=path.join(conversationOutputLocation(data).path,id);fs.mkdirSync(workspace,{recursive:true});
 report.runtime=await assertIsolatedPiMain(app,path.join(build,'main/index.js'),path.join(root,'profile'));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1));
 if(prefix)await app.evaluate(()=>{receiptFixture.coldOnly=true;});
}
async function close(){if(app){report.requests.push(...await app.evaluate(()=>receiptFixture.requests));await app.close();app=undefined;}}
try{
 await launch();report.sessionId=id;
 if(prefix){
  assert.deepEqual(facts(),prefix.facts);const t=(await snap()).projection.turns.find(t=>t.id===prefix.turn.id);assert.deepEqual(t.verification,prefix.turn.verification);
  const card=page.locator(`[data-turn-id="${t.id}"]`).getByTestId('office-run-receipts');const trigger=card.getByRole('button',{name:/部分操作未完成.*本轮记录/});
  assert.equal(await trigger.getAttribute('aria-expanded'),'false');await trigger.focus();await page.keyboard.press('Enter');await card.getByTestId('office-verification').waitFor();
  assert.equal(await card.getByTestId('office-verification').evaluate(el=>getComputedStyle(el).display),'flex');await screenshot('final-styled-receipt.png');
  check('Same completed Pi run opens the original scoped verification with application styles and keyboard focus; no generation replay');
  assert.deepEqual(facts(),prefix.facts);assert.equal(sha256(fs.readFileSync(path.join(workspace,'合成资料.txt'))),prefix.sourceHash);assert.equal(await app.evaluate(()=>receiptFixture.requests.length),0);assert.deepEqual(report.errors,[]);
  report.prefix={file:path.join(root,'report.json'),sha256:sha256(fs.readFileSync(path.join(root,'report.json'))),buildHash:prefix.buildHash};report.ok=true;
  check('Final styled build leaves exact native journal/messages and source bytes unchanged with zero provider calls');
 }else{
 const source=path.join(workspace,'合成资料.txt');fs.writeFileSync(source,'合成课堂资料：浮力方向竖直向上。核对码37。\n');const sourceHash=sha256(fs.readFileSync(source));
 await input().fill('合成核对测试：读取合成资料.txt和缺失资料.txt，分别报告真实结果。');await input().press('Enter');
 const turn=await until(async()=>{const s=await snap(),t=s.projection.turns.at(-1);return !s.running&&t?.status==='completed'?t:undefined;});
 report.turn=turn;report.results=await app.evaluate(()=>receiptFixture.results);
 assert.equal(report.results.length,2);assert.equal(report.results[0].success,true);assert(report.results[0].data.text.includes('37'));assert.equal(report.results[1].error.code,'not_found');
 assert.equal(turn.verification.state,'partial');assert.equal(turn.verification.operations.succeeded,1);assert.equal(turn.verification.operations.failed,1);assert(!fs.existsSync(path.join(workspace,'缺失资料.txt')));
 check('Real Hana reads retain one success and one missing-file failure even when controlled model prose claims both finished');
 const scope=page.locator(`[data-turn-id="${turn.id}"]`),receipts=scope.getByTestId('office-run-receipts');
 if(baseline){assert.equal(await receipts.count(),0);await screenshot('baseline-missing-entry.png');report.expectedFailure='Host partial verification exists but current agentTrace conversation has no receipt entry';process.exitCode=1;}
 else{
  await receipts.waitFor();const trigger=receipts.getByRole('button',{name:/部分操作未完成.*本轮记录/});
  await trigger.waitFor();assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert.equal(await scope.getByTestId('office-verification').isVisible(),false);
  await trigger.focus();await page.keyboard.press('Enter');await until(async()=>await scope.getByTestId('office-verification').isVisible());
  assert((await scope.getByTestId('office-verification').innerText()).includes('回复结束不代表任务已完成'));assert((await scope.getByTestId('office-verification-scope').innerText()).includes('仅本轮执行记录'));
  check('Partial-operation summary stays visible outside the sealed process; Enter reveals the existing exact-scope verification without another confirmation');
  for(const [width,height]of [[1366,768],[1920,1080]]){
   await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setContentSize(width,height),{width,height});await page.waitForFunction(w=>innerWidth===w,width);
   await trigger.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await screenshot(width+'.png');
  }
  await trigger.focus();await page.keyboard.press('Space');await until(async()=>await trigger.getAttribute('aria-expanded')==='false');assert(await trigger.evaluate(el=>document.activeElement===el));
  assert.equal(await app.evaluate(()=>receiptFixture.requests.length),3);check('Both required desktop sizes keep the disclosure reachable; keyboard closing preserves focus and sends no tool/model request');
  await input().fill('未发送合成草稿：只核对已有记录。');const draft=await input().inputValue(),projection=(await snap()).projection,before=facts();
  await close();await launch();assert.equal(await input().inputValue(),draft);assert.deepEqual((await snap()).projection,projection);assert.deepEqual(facts(),before);
  const cold=page.locator(`[data-turn-id="${turn.id}"]`).getByTestId('office-run-receipts');await cold.getByRole('button',{name:/部分操作未完成.*本轮记录/}).click();await cold.getByTestId('office-verification').waitFor();
  assert.equal(await app.evaluate(()=>receiptFixture.requests.length),0);assert.equal(sha256(fs.readFileSync(source)),sourceHash);assert(!fs.existsSync(path.join(workspace,'缺失资料.txt')));report.facts=before;report.sourceHash=sourceHash;
  check('Cold launch preserves native messages/events, source bytes and draft; reopening the same receipt replays zero requests and no missing file is invented');
  report.ok=true;
 }
 assert.deepEqual(report.errors,[]);assert.equal(fingerprint(build).sha256,report.buildHash);
 }
}catch(error){report.error=String(error.stack);process.exitCode=1;await screenshot('failure.png').catch(()=>{});if(page)report.lastSnapshot=await snap().catch(()=>undefined);}
finally{await close();const file=path.join(root,resume?`report-tail-${Date.now()}.json`:'report.json');fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,baseline,root,file,checks:report.checks.length,error:report.error,expectedFailure:report.expectedFailure}));}
