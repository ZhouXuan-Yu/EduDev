import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-read-scheduler-web-ui-')),data=path.join(output,'data'),profile=path.join(output,'profile');
const buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out'),main=testMain(process.cwd()),fixed=fingerprint(buildRoot);
const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const token=randomBytes(5).toString('hex'),gold=Array.from({length:13},(_,i)=>({url:`https://www.moe.gov.cn/?xiaozhi_scheduler_fixture=${token}_${i}`,marker:`WEB${randomBytes(4).toString('hex').toUpperCase()}`}));
fs.writeFileSync(path.join(output,'gold.json'),JSON.stringify(gold,null,2));
const report={success:false,checks:[],humanAccepted:false,build:{root:buildRoot,sha256:fixed.sha256,files:fixed.files.length},scriptSha256:sha256(fs.readFileSync(new URL(import.meta.url))),scope:'Formal Pi/Electron and genuine DeepSeek requests, controlled held web transport at 13 exact owned fixture URLs. Bodies are SYNTHETIC and never fetched from MOE; proves production scheduling/UI/journal, not real site availability or natural throughput. No daily/VPN-off/image/network quality claim.'};
let app,page,session;const errors=[],pass=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
async function until(fn,ms=180000){const end=Date.now()+ms;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(error){if(!String(error).includes('Resulting promise was garbage collected'))throw error;(report.observationErrors??=[]).push(String(error));}await new Promise(r=>setTimeout(r,100));}throw Error('Held web scheduler observation timed out');}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
function query(q,args=[]){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...args);}finally{db.close();}}
try{
 const env={...process.env,DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:'deepseek-flash',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());session=await page.locator('.office-composer-container').getAttribute('data-session-id');report.session=session;report.launch=await assertIsolatedPiMain(app,main,profile);
 await app.evaluate((_electron,options)=>{
  const req=process.getBuiltinModule('module').createRequire(options.main),u=req('undici'),original=u.Agent.prototype.dispatch;
  globalThis.heldReads={entries:[],active:0,peak:0,trace:[]};
  u.Agent.prototype.dispatch=function(opts,handler){
   let i=-1;try{i=options.gold.findIndex(g=>new URL(g.url).href===new URL(String(opts.origin)+opts.path).href);}catch{}
   if(i<0)return original.call(this,opts,handler);
   const state=globalThis.heldReads,record={index:i,finished:false};state.entries.push(record);state.active++;state.peak=Math.max(state.peak,state.active);state.trace.push({event:"dispatch",index:i});handler.onConnect(()=>{},null);
   record.finish=()=>{if(record.finished)return;record.finished=true;state.active--;state.trace.push({event:"response",index:i});const body=Buffer.from(`# 受控教学页面 ${i}\n此页面是调度验收夹具，不是教育部网站内容。\n核对码：${options.gold[i].marker}\n`);handler.onHeaders(200,[Buffer.from('content-type'),Buffer.from('text/plain; charset=utf-8')],()=>{},'OK');handler.onData(body);handler.onComplete([]);};return true;
  };
 },{main,gold});
 await page.getByTestId('office-prompt-input').fill(`这是13个独立网页读取的受控验收任务。请对下列每个完整地址分别实际调用 office_web_fetch 读取，每个都要执行；请尽可能同一批并行请求，网址完整保留，不合并、不改用搜索、不打开浏览器、不重复请求、不追问。全部返回后逐行列出每页实际核对码。\n${gold.map(g=>g.url).join('\n')}`);
 await page.getByRole('button',{name:'发送消息',exact:true}).click();assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');
 await until(async()=>await app.evaluate(()=>globalThis.heldReads.entries.length===12),90000);
 const waiting=await until(async()=>{const s=await snapshot(),t=s.projection.turns.at(-1),queued=t?.items.filter(i=>i.toolAttempt?.tool==='office_web_fetch'&&i.toolAttempt.state==='queued')||[];return queued.length?t:undefined;},30000);
 const before=await app.evaluate(()=>({count:globalThis.heldReads.entries.length,active:globalThis.heldReads.active,peak:globalThis.heldReads.peak,trace:globalThis.heldReads.trace}));assert.equal(before.count,12);assert.equal(before.active,12);assert.equal(before.peak,12);
 const queued=waiting.items.filter(i=>i.toolAttempt?.state==='queued');assert.equal(queued.length,1);const receipt=query('SELECT admitted FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?',[waiting.id,queued[0].id])[0];assert.equal(receipt.admitted,0);report.pending={runId:waiting.id,callId:queued[0].id,before};
 const row=page.getByTestId('pi-web-search-process').filter({has:page.locator(`[data-testid="office-tool-step"][data-item-id="${queued[0].id}"]`)});assert((await row.innerText()).includes('等待读取'));await row.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'twelve-active-one-queued.png'),animations:'disabled'});pass('Real provider creates 13 production calls; exactly 12 transport requests are held active and the visible 13th remains unadmitted');
 await app.evaluate(()=>globalThis.heldReads.entries[0].finish());await until(async()=>await app.evaluate(()=>globalThis.heldReads.entries.length===13));const freed=await app.evaluate(()=>({active:globalThis.heldReads.active,peak:globalThis.heldReads.peak,trace:globalThis.heldReads.trace}));assert.equal(freed.active,12);assert.equal(freed.peak,12);report.afterOneRelease=freed;pass('Only after one held response returns does the queued 13th reach transport; held transport peak stays 12');
 await app.evaluate(()=>globalThis.heldReads.entries.forEach(e=>e.finish()));const turn=await until(async()=>{const s=await snapshot(),t=s.projection.turns.at(-1);return !s.running?t:undefined;});assert.equal(turn.status,'completed',turn.error);report.runId=turn.id;
 const final=await app.evaluate(()=>({active:globalThis.heldReads.active,peak:globalThis.heldReads.peak,count:globalThis.heldReads.entries.length,trace:globalThis.heldReads.trace}));assert.equal(final.active,0);assert.equal(final.count,13);assert.equal(final.peak,12);report.final=final;const answer=turn.items.filter(i=>i.role==='assistant').map(i=>i.text).join('\n');for(const g of gold)assert(answer.includes(g.marker));pass('All 13 controlled bodies reach the genuine model; final markers match and all reads return');
 const rows=query('SELECT event_json FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence',[turn.id]).map(r=>JSON.parse(r.event_json)),attempts=rows.filter(e=>e.kind==='tool_attempt');const calls=turn.items.filter(i=>i.toolAttempt?.tool==='office_web_fetch');assert.equal(calls.length,13);for(const call of calls){assert.equal(call.status,'completed');assert.deepEqual(attempts.filter(e=>e.attempt.callId===call.id).map(e=>e.attempt.state),['queued','started','succeeded']);assert.deepEqual(call.toolAttempt,attempts.findLast(e=>e.attempt.callId===call.id).attempt);}
 assert(calls.find(i=>i.id===queued[0].id).toolAttempt.queueWaitMs>0);report.attempts=attempts;pass('Queue/admission/execution timing and all final statuses agree in typed snapshot and SQLite');
 assert.deepEqual(errors,[]);assert.equal(fingerprint(buildRoot).sha256,fixed.sha256);report.success=true;
}catch(error){report.error=String(error.stack).replaceAll(key,'[credential]').slice(0,4500);process.exitCode=1;if(page&&session)report.lastSnapshot=await snapshot().catch(()=>undefined);await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});}finally{if(app)await app.evaluate(()=>{for(const e of globalThis.heldReads?.entries||[])try{e.finish();}catch{}}).catch(()=>{});await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
