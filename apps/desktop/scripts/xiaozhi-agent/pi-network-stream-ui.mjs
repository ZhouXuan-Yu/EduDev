import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';

const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-network-stream-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),root=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out'),fixed=fingerprint(root),main=testMain(process.cwd());
const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const official='http://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html';
const report={success:false,checks:[],build:{root,sha256:fixed.sha256,files:fixed.files.length},scope:'Formal isolated Pi/real DeepSeek, actual public search/read/browser without injected network result. Current OS network unchanged; daily profile/VPN-off unverified.',scriptSha256:sha256(fs.readFileSync(new URL(import.meta.url)))};
let app,page,session;const errors=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,timeout=180000){const end=Date.now()+timeout;while(Date.now()<end){const value=await fn();if(value)return value;await sleep(100);}throw Error('Actual UI condition timed out');}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
function native(){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{const binding=db.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(session);return fs.readFileSync(path.join(data,'xiaozhi-pi',binding.session_file));}finally{db.close();}}
function results(turn){return native().toString().trim().split('\n').map(JSON.parse).filter(e=>e.message?.role==='toolResult'&&turn.items.some(i=>i.id===e.message.toolCallId)).map(e=>{const m=e.message,text=m.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');let parsed;try{parsed=JSON.parse(text);}catch{parsed={failureText:text};}return{callId:m.toolCallId,error:m.isError,data:parsed};});}
async function watch(){await page.evaluate(()=>{
 globalThis.networkEvents=[];globalThis.networkDom=[];globalThis.networkObserver?.disconnect();
 window.omniEdu.onXiaozhiEvent(event=>globalThis.networkEvents.push({at:performance.now(),event}));
 const capture=()=>{for(const el of document.querySelectorAll('.office-turn')){const texts=[...el.querySelectorAll('[data-slot="chat-message-assistant"]')].map(node=>node.textContent||'').join('');const id=el.getAttribute('data-turn-id'),last=globalThis.networkDom.findLast(row=>row.id===id);if(texts.length&&(!last||last.length!==texts.length||last.state!==el.getAttribute('data-state')))globalThis.networkDom.push({at:performance.now(),id,length:texts.length,state:el.getAttribute('data-state')});}};
 globalThis.networkObserver=new MutationObserver(capture);globalThis.networkObserver.observe(document.querySelector('[data-testid="office-conversation"]'),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-state']});
 });}
async function launch(){const env={...process.env,DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:'deepseek-flash',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 const id=await page.locator('.office-composer-container').getAttribute('data-session-id');if(session)assert.equal(id,session);session=id;(report.launches??=[]).push(await assertIsolatedPiMain(app,main,profile));
 await app.evaluate(({net},main)=>{globalThis.networkTransport=[];const record=(raw,method)=>{const url=new URL(raw);const row={origin:url.origin,path:url.pathname,method,started:Date.now()};globalThis.networkTransport.push(row);return row;};const original=net.fetch.bind(net);net.fetch=async(...args)=>{const raw=typeof args[0]==='string'?args[0]:args[0].url;const row=record(raw,args[1]?.method||'GET');try{const response=await original(...args);row.status=response.status;row.headersAt=Date.now();return response;}catch(error){row.error=error.code||error.name;throw error;}};
 const u=process.getBuiltinModule('module').createRequire(main)('undici'),dispatch=u.Agent.prototype.dispatch;
 u.Agent.prototype.dispatch=function(opts,handler){const url=new URL(opts.path,String(opts.origin)),row=record(url.href,opts.method);const observed=new Proxy(handler,{get(target,key){if(key==='onHeaders')return(status,...args)=>{row.status=status;row.headersAt=Date.now();return target.onHeaders(status,...args);};if(key==='onError')return(error)=>{row.error=error.code||error.name;return target.onError(error);};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});return dispatch.call(this,opts,observed);};
 },main);await watch();}
async function run(prompt){const before=(await snapshot()).projection.turns.at(-1)?.id;await page.getByTestId('office-prompt-input').fill(prompt);await page.getByRole('button',{name:'发送消息',exact:true}).click();assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');return until(async()=>{const s=await snapshot(),t=s.projection.turns.at(-1);return t?.id!==before&&!s.running&&['completed','failed','interrupted'].includes(t?.status)?t:undefined;});}
async function check(name,fn){try{await fn();report.checks.push({name,pass:true});console.log('PASS '+name);}catch(error){report.checks.push({name,pass:false,error:String(error.stack).replaceAll(key,'[credential]').slice(0,3500)});console.log('FAIL '+name);await page?.screenshot({path:path.join(output,`failed-${report.checks.length}.png`),animations:'disabled'}).catch(()=>{});}}
try{
 await launch();const settings=await page.evaluate(()=>window.omniEdu.getXiaozhiSettings());report.web=settings.value?.web;assert(report.web?.enabled);report.session=session;
 await check('Real provider reply grows in the formal DOM before terminal status; not only received deltas',async()=>{
  const turn=await run('不用工具，不需要提问。请直接写一份约600字的小学教师一周备课建议，分成5段，每段有具体操作。');report.streamTurn=turn;assert.equal(turn.status,'completed',turn.error);
  const observed=await page.evaluate(()=>({events:globalThis.networkEvents,dom:globalThis.networkDom})),events=observed.events.filter(r=>r.event.runId===turn.id),delta=events.filter(r=>r.event.kind==='text_delta'),terminal=events.find(r=>r.event.kind==='status'&&r.event.status!=='running');
  const frames=observed.dom.filter(row=>row.id===turn.id&&row.state==='running'&&row.length>0);report.stream={deltaCount:delta.length,firstDeltaAt:delta[0]?.at,terminalAt:terminal?.at,frames};
  assert(delta.length>1);assert(frames.length>1,'No repeated assistant DOM growth while running');assert(frames[0].at<terminal.at);assert(frames.at(-1).length>frames[0].length);await page.screenshot({path:path.join(output,'stream-final.png'),animations:'disabled'});
 });
 await check('Actual search followed by two public body reads retains source receipts and independently fixed MOE dates',async()=>{
  const turn=await run(`请先说明你要进行的公开检索步骤，然后实际联网搜索“教育部 义务教育课程方案 2022年版 2022年秋季学期”，读取搜索返回的两个不同公开来源正文。请其中一个实际读取此教育部原通知 ${official}。只输出通知落款日期、网页发布日期、实施时间和来源链接。搜索失败时如实保留并说明，可以继续读我已给的公开通知，但不能把已知通知冒充搜索成功，也不能只靠摘要。`);report.networkTurn=turn;
  const tools=turn.items.filter(i=>i.kind==='tool'),search=tools.filter(i=>i.toolAttempt?.tool==='office_web_search'),reads=tools.filter(i=>i.toolAttempt?.tool==='office_web_fetch'&&i.status==='completed');report.networkResults=results(turn);
  assert(search.some(i=>i.status==='completed'&&i.sources?.length),'Actual non-empty search did not succeed');assert(new Set(reads.flatMap(i=>i.sources?.filter(s=>s.kind==='read').map(s=>s.url)||[])).size>=2,'Fewer than two actual read sources');
  const body=report.networkResults.find(r=>r.data.url===official&&r.data.success)?.data.text;assert(body);assert(/2022\s*年\s*3\s*月\s*25\s*日/.test(body));assert(/2022[-/.]0?4[-/.]21|2022\s*年\s*4\s*月\s*21\s*日/.test(body));assert(/2022年.{0,12}秋季.{0,8}学期/s.test(body));
 });
 await check('Natural internal browser navigate and snapshot have real MOE body and a nonempty native screenshot',async()=>{
  const turn=await run(`现在请使用内置浏览器实际打开 ${official} 并读取页面快照，核对通知落款日期，再截取浏览器当前页面供我查看。只操作这个公开地址，不搜索、不用已有文字冒充浏览器结果。`);report.browserTurn=turn;
  const capture=turn.items.find(i=>i.browserCapture)?.browserCapture;assert(capture,'No actual browser capture receipt');
  const browserPage=await until(async()=>app.context().pages().find(p=>p.url().startsWith(official)),30000);assert((await browserPage.locator('body').innerText()).includes('义务教育'));await browserPage.screenshot({path:path.join(output,'browser-real.png'),animations:'disabled'});
  report.browser={url:browserPage.url(),bodyLength:(await browserPage.locator('body').innerText()).length,capture};assert(capture.width>0&&capture.height>0&&capture.size>5000);
 });
 await check('Actual provider stream stop preserves an interrupted turn without new text after settlement',async()=>{
  const before=(await snapshot()).projection.turns.at(-1)?.id;await page.getByTestId('office-prompt-input').fill('不要调用工具，直接写一篇3000字的教师培训方案，逐段输出。');await page.getByRole('button',{name:'发送消息',exact:true}).click();
  await until(async()=>{const s=await snapshot(),t=s.projection.turns.at(-1);return t?.id!==before&&s.running&&t.items.some(i=>i.role==='assistant'&&i.text?.length>40);});
  const stop=page.getByRole('button',{name:'停止本轮',exact:true});await stop.click();await until(async()=>!(await snapshot()).running);report.stopped=(await snapshot()).projection.turns.at(-1);assert.equal(report.stopped.status,'interrupted');const text=JSON.stringify(report.stopped.items);await sleep(800);assert.equal(JSON.stringify((await snapshot()).projection.turns.at(-1).items),text);
 });
 report.transport=await app.evaluate(()=>globalThis.networkTransport);const expected=(await snapshot()).projection.turns,nativeBefore=native();await app.close();app=undefined;await launch();
 await check('Cold restoration retains exact native bytes/projection and no live process replay',async()=>{assert.deepEqual((await snapshot()).projection.turns,expected);assert(native().equals(nativeBefore));await sleep(400);assert.equal((await app.evaluate(()=>globalThis.networkTransport)).filter(r=>/\/chat\/completions$/.test(r.path)).length,0);assert(!(await snapshot()).running);});
 assert.deepEqual(errors,[]);assert.equal(fingerprint(root).sha256,fixed.sha256);report.success=report.checks.every(c=>c.pass);
}catch(error){report.error=String(error.stack).replaceAll(key,'[credential]').slice(0,3500);}
finally{if(app){report.lastSnapshot=await snapshot().catch(()=>undefined);report.transport??=await app.evaluate(()=>globalThis.networkTransport).catch(()=>undefined);}await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.map(c=>({name:c.name,pass:c.pass,error:c.error})),output,error:report.error}));if(!report.success)process.exitCode=1;}
