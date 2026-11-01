import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';

// Same formal UI harness and actual undici adapter seam as pi-tool-execution-ui.
// Only the primary home-page GET is rejected; replacement GETs are real network.
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-web-alternative-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out'),fixed=fingerprint(buildRoot),main=testMain(process.cwd());
const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const primary='https://www.moe.gov.cn/';
const replacement='http://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html';
const report={success:false,checks:[],primary,replacement,build:{root:buildRoot,sha256:fixed.sha256,files:fixed.files.length},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),scope:'Isolated formal Pi/real DeepSeek, controlled actual-adapter primary403 and real public replacementGET, native/SQLite/UI source integrity and independent dates. No natural-outage/daily/VPN-off/full semantic verification claim.'};
let app,page,session;const errors=[];
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,ms=180000){const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await sleep(100);}throw Error('Alternative source observation timed out');}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
function sql(q,args=[]){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...args);}finally{db.close();}}
function native(){const binding=sql('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[session])[0];return fs.readFileSync(path.join(data,'xiaozhi-pi',binding.session_file));}
const entries=()=>native().toString().trim().split('\n').map(JSON.parse);
const final=t=>t.items.filter(i=>i.kind==='message'&&i.role==='assistant'&&i.phase==='final_answer').map(i=>i.text).join('\n');
const notice=id=>page.locator(`.office-turn[data-turn-id="${id}"] [data-testid="office-verification"]`);
function metadata(id){return sql('SELECT metadata_json FROM ai_conversation_messages WHERE session_id=? AND role=?',[session,'assistant']).map(r=>JSON.parse(r.metadata_json)).find(m=>m.agentRunId===id);}
async function launch(){
 const env={...process.env,DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:'deepseek-flash',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};
 delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();
 page.on('pageerror',e=>errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 const id=await page.locator('.office-composer-container').getAttribute('data-session-id');if(session)assert.equal(id,session);session=id;
 (report.launches??=[]).push(await assertIsolatedPiMain(app,main,profile));
 await app.evaluate(({shell})=>{const original=shell.openExternal.bind(shell);globalThis.sourceOpenRequests=[];shell.openExternal=async(url,...args)=>{const record={url};globalThis.sourceOpenRequests.push(record);await original(url,...args);record.completed=true;};});
 await app.evaluate(({net})=>{const original=net.fetch.bind(net);globalThis.alternativeModelRequests=[];net.fetch=async(...args)=>{const raw=typeof args[0]==='string'?args[0]:args[0].url;const record=/\/chat\/completions(?:\?|$)/.test(raw)?{url:new URL(raw).origin+new URL(raw).pathname}:undefined;if(record)globalThis.alternativeModelRequests.push(record);const response=await original(...args);if(record)record.status=response.status;return response;};});
 await page.evaluate(()=>{globalThis.alternativeEvents=[];window.omniEdu.onXiaozhiEvent(e=>globalThis.alternativeEvents.push(e));});
}
async function fault(){
 await app.evaluate((_electron,input)=>{
  const u=process.getBuiltinModule('module').createRequire(input.main)('undici'),original=u.Agent.prototype.dispatch;
  globalThis.alternativeTransport=[];
  u.Agent.prototype.dispatch=function(opts,handler){
   const url=new URL(opts.path,String(opts.origin)),r={url:url.origin+url.pathname};globalThis.alternativeTransport.push(r);
   if(url.href===input.primary){r.controlled=true;r.status=403;handler.onConnect(()=>{},null);queueMicrotask(()=>{handler.onHeaders(403,[Buffer.from('content-type'),Buffer.from('text/plain'),Buffer.from('content-length'),Buffer.from('0')],()=>{},'Forbidden');handler.onComplete([]);});return true;}
   const observed=new Proxy(handler,{get(target,key){if(key==='onHeaders')return(status,...args)=>{r.status=status;return target.onHeaders(status,...args);};const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});
   return original.call(this,opts,observed);
  };
 },{main,primary});
}
async function run(text){const before=(await snapshot()).projection.turns.at(-1)?.id;await page.getByTestId('office-prompt-input').fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click();assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');return until(async()=>{const s=await snapshot(),t=s.projection.turns.at(-1);return t?.id!==before&&!s.running&&['completed','failed','interrupted'].includes(t?.status)?t:undefined;});}
async function expand(item){const webRow=page.locator(`.bui-ws-row-content[data-call-id="${item.id}"]`),outer=webRow.getByRole('button',{name:'查看操作详情',exact:true});if(await outer.count()&&await outer.getAttribute('aria-expanded')!=='true')await outer.click();const group=page.getByTestId('office-tool-group').filter({has:page.locator(`[data-testid="office-tool-step"][data-item-id="${item.id}"]`)}).first();if(await group.count()){const t=group.locator('[data-slot="chat-tool-group-trigger"]');if(await t.getAttribute('aria-expanded')!=='true')await t.click();}const step=page.locator(`[data-testid="office-tool-step"][data-item-id="${item.id}"]`),t=step.locator('[data-slot="chat-tool-trigger"]');await t.scrollIntoViewIfNeeded();if(await t.getAttribute('aria-expanded')!=='true')await t.click();return step;}
try{
 await launch();assert((await page.evaluate(()=>window.omniEdu.getXiaozhiSettings())).value.web.enabled);await fault();
 const turn=await run(`请先实际读取公开首页 ${primary}。若该来源访问失败，不要重试该地址，改为实际读取我授权的另一公开来源 ${replacement} ，这是教育部2022课程方案通知。两个地址都授权读取。请区分通知正文落款日期、网页发布日期和实施时间，附实际读到的来源，并说明首来源访问失败。按此顺序执行，不搜索、不用浏览器。`);
 report.turn=turn;assert.equal(turn.status,'completed',turn.error);
 const events=(await page.evaluate(()=>globalThis.alternativeEvents)).filter(e=>e.runId===turn.id),tools=turn.items.filter(i=>i.kind==='tool');
 const bad=tools.find(i=>i.status==='failed'&&i.toolAttempt?.code==='permission_denied');assert(bad,'Primary source failure must remain visible');
 const good=tools.find(i=>i.status==='completed'&&i.sources?.some(s=>s.url===replacement&&s.kind==='read'));assert(good,'Missing actual replacement body read');
 const primaryEvents=events.filter(e=>e.kind==='tool_attempt'&&e.attempt.callId===bad.id);assert(primaryEvents.length);assert(primaryEvents.every(e=>e.attempt.attempt===1&&e.attempt.state!=='retrying'));
 assert(events.findIndex(e=>e.kind==='tool_end'&&e.callId===bad.id&&!e.success)<events.findIndex(e=>e.kind==='tool_start'&&e.callId===good.id));
 const transport=await app.evaluate(()=>globalThis.alternativeTransport);report.transport=transport;
 assert.equal(transport.filter(r=>r.url===primary).length,1);assert(transport.some(r=>r.url===primary&&r.controlled&&r.status===403));assert(transport.some(r=>r.url===replacement&&!r.controlled&&r.status===200));
 assert.equal(tools.length,2,'Natural request permits exactly the primary and replacement reads');
 check('Primary controlled403 stays failed with one attempt; same Pi run reads the authorized real replacementHTTP200');
 const results=entries().filter(e=>e.message?.role==='toolResult').map(e=>e.message),badNative=results.filter(r=>r.toolCallId===bad.id),goodNative=results.filter(r=>r.toolCallId===good.id);
 assert.equal(badNative.length,1);assert(badNative[0].isError);assert.equal(goodNative.length,1);assert(!goodNative[0].isError);
 const body=JSON.parse(goodNative[0].content.filter(c=>c.type==='text').map(c=>c.text).join('\n'));
 assert.equal(body.url,replacement);assert(body.success&&body.text.trim());assert(Number.isFinite(Date.parse(body.observedAt)));
 const answer=final(turn);for(const text of[body.text,answer]){assert(/2022\s*年\s*3\s*月\s*25\s*日|2022[-/.]0?3[-/.]25/.test(text),text.slice(0,3000));assert(/2022\s*年\s*4\s*月\s*21\s*日|2022[-/.]0?4[-/.]21/.test(text));assert(/2022年.{0,12}秋季.{0,8}学期/s.test(text));}
 assert(/网页.{0,60}(4月21|04-21)|(?:4月21|04-21).{0,60}网页/s.test(answer));assert(/落款.{0,60}(3月25|03-25)|(?:3月25|03-25).{0,60}落款/s.test(answer));assert(answer.includes(replacement));assert(/失败|拒绝|403|无法访问/.test(answer));
 report.independentAnswer={noticeSignature:'2022-03-25',pagePublication:'2022-04-21',implementation:'2022秋季学期',bodySha256:sha256(body.text),answer};
 check('Actual native replacement body and answer match independent notification dates; failed primary is not cited as read');
 const v=turn.verification;assert.equal(v.state,'partial');assert(v.operations.failed===1&&v.operations.succeeded===1);
 const source=v.checks.find(c=>c.id==='web:'+good.id);assert.equal(source?.state,'passed');assert.equal(source.evidenceIds.length,1);assert(v.checks.some(c=>c.id==='answer:human'&&c.state==='needs_human'));assert(!v.checks.some(c=>c.id==='web:'+bad.id));assert(v.evidence.some(e=>e.id===source.evidenceIds[0]&&e.callId===good.id&&e.kind==='readback'));
 assert.deepEqual(metadata(turn.id).verification,v);await notice(turn.id).waitFor();assert.equal(await notice(turn.id).getAttribute('data-state'),'partial');
 const journal=sql('SELECT event_json FROM xiaozhi_event_journal WHERE run_id=? ORDER BY sequence',[turn.id]).map(r=>JSON.parse(r.event_json));assert.deepEqual(journal.filter(e=>e.kind==='tool_attempt'&&e.attempt.callId===bad.id),primaryEvents);
 const receipts=sql('SELECT call_id,success,phase,admitted FROM xiaozhi_tool_receipts WHERE run_id=?',[turn.id]);assert.equal(receipts.length,2);assert(receipts.some(r=>r.call_id===bad.id&&!r.success&&r.admitted===1));assert(receipts.some(r=>r.call_id===good.id&&r.success&&r.admitted===1));
 check('Successful source integrity passes its criterion while actual failed operation and human answer review remain partial across UI/native/SQLite');
 const trees=page.locator(`.office-turn[data-turn-id="${turn.id}"]`).getByTestId('pi-web-search-process');
 const tree=trees.filter({has:page.locator(`[data-call-id="${good.id}"]`)}),failedTree=trees.filter({has:page.locator(`[data-call-id="${bad.id}"]`)});
 assert.equal(await failedTree.getAttribute('data-state'),'failed');assert.equal(await tree.locator(`[data-call-id="${good.id}"]`).getAttribute('data-step-state'),'completed');
 assert.equal(await trees.locator('.bui-ws-working').count(),0);
 const sources=tree.getByRole('button',{name:'引用来源',exact:true});await sources.click();assert.equal(await sources.getAttribute('aria-expanded'),'true');
 const link=tree.locator('.bui-ws-source-link');await link.waitFor();assert.equal(await link.getAttribute('href'),'#');assert.equal(await link.getAttribute('target'),null);assert((await link.innerText()).includes('已读正文'));
 await link.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'boardui-sources.png'),animations:'disabled'});
 await link.click();await until(async()=>(await app.evaluate(()=>globalThis.sourceOpenRequests)).some(r=>r.url===replacement&&r.completed),30000);report.sourceOpenRequests=await app.evaluate(()=>globalThis.sourceOpenRequests);
 check('Reused BoardUI tree retains actual failure and source kind; typed host IPC validates and hands the recorded URL to the real system browser opener (page rendering not asserted)');
 for(const [width,height]of[[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:width===1920?'dark':'light'});await tree.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`boardui-tree-${width}.png`),animations:'disabled'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const step=await expand(bad);await step.getByTestId('pi-tool-attempt').waitFor();await page.screenshot({path:path.join(output,`primary-failed-${width}.png`),animations:'disabled'});const details=notice(turn.id).getByTestId('office-verification-checks'),summary=details.locator(':scope > [data-slot="disclosure-heading"] > button[data-slot="disclosure-trigger"]');if(await details.locator(':scope > [data-slot="disclosure-heading"] > button[data-slot="disclosure-trigger"]').getAttribute('aria-expanded')!=='true')await summary.click();await summary.scrollIntoViewIfNeeded();const box=await summary.boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);assert((await details.innerText()).includes('网页正文与本轮保存记录一致'));await page.screenshot({path:path.join(output,`alternative-checked-${width}.png`),animations:'disabled'});}
 check('Both target sizes show retained primary failure and actual replacement readback scope');
 await page.reload();await page.getByTestId('xiaozhi-pi-workspace').waitFor();assert.deepEqual((await snapshot()).projection.turns.find(t=>t.id===turn.id),turn);
 check('Reload restores exact failed and successful source history with matching verification');
 await page.evaluate(()=>{globalThis.alternativeEvents=[];window.omniEdu.onXiaozhiEvent(e=>globalThis.alternativeEvents.push(e));});
 const beforeTransport=transport.length;
 const denied=await run(`请再次实际读取 ${primary} 一次，然后仅告诉我这次请求成功还是失败。本轮只允许这个地址；失败就结束，不得访问其他来源、搜索或浏览器，也不要沿用上轮内容说本轮读成功。`);
 report.denied=denied;assert.equal(denied.status,'completed',denied.error);const deniedTools=denied.items.filter(i=>i.kind==='tool');assert.equal(deniedTools.length,1);assert.equal(deniedTools[0].status,'failed');assert(!deniedTools[0].sources?.length);assert.equal(denied.verification.state,'blocked');assert.equal(denied.verification.operations.failed,1);assert(!denied.verification.checks.some(c=>c.state==='passed'));assert.deepEqual((await app.evaluate(()=>globalThis.alternativeTransport)).slice(beforeTransport).map(r=>[r.url,r.status]),[[primary,403]]);assert.deepEqual(metadata(denied.id).verification,denied.verification);
 check('Explicit primary-only counterexample performs one denied request with no replacement or stale success evidence');
 const beforeNative=native(),expected=(await snapshot()).projection.turns.map(t=>({id:t.id,verification:t.verification})),beforeRows=sql('SELECT id,metadata_json FROM ai_conversation_messages WHERE session_id=? ORDER BY id',[session]);
 await app.close();app=undefined;await launch();assert(!(await snapshot()).running);assert.deepEqual((await snapshot()).projection.turns.map(t=>({id:t.id,verification:t.verification})),expected);assert(native().equals(beforeNative));assert.deepEqual(sql('SELECT id,metadata_json FROM ai_conversation_messages WHERE session_id=? ORDER BY id',[session]),beforeRows);await sleep(350);assert.equal((await app.evaluate(()=>globalThis.alternativeModelRequests)).length,0);assert.equal((await page.evaluate(()=>globalThis.alternativeEvents)).filter(e=>e.kind==='tool_start').length,0);
 check('Cold reopen preserves exact native/SQLite source and failure facts without tool or model replay');
 assert.deepEqual(errors,[]);assert.equal(fingerprint(buildRoot).sha256,fixed.sha256);report.success=true;
 check('Immutable formal build and no renderer error; no daily or VPN-off acceptance inferred');
}catch(error){report.error=String(error.stack).replaceAll(key,'[credential]').slice(0,6000);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});if(page)report.lastSnapshot=await snapshot().catch(()=>undefined);if(app)report.transport=await app.evaluate(()=>globalThis.alternativeTransport).catch(()=>undefined);}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
