import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';

const desktop=process.cwd(),sourceProfile=path.join(process.env.APPDATA||'','OmniEduAgent'),sourceData=path.join(sourceProfile,'OmniEduData');
assert(fs.existsSync(path.join(sourceData,'app.db')),'Daily profile database is missing');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-daily-network-copy-')),profile=path.join(output,'profile'),data=path.join(profile,'OmniEduData');
const buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out'),fixed=fingerprint(buildRoot),main=testMain(desktop);
fs.mkdirSync(data,{recursive:true});
const copyFile=(from,to)=>{if(!fs.existsSync(from))return false;fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);return true;};
const copied={localState:copyFile(path.join(sourceProfile,'Local State'),path.join(profile,'Local State')),
  preferences:copyFile(path.join(sourceProfile,'Preferences'),path.join(profile,'Preferences'))};
for(const name of ['app.db','app.db-wal','app.db-shm'])copied[name]=copyFile(path.join(sourceData,name),path.join(data,name));
if(fs.existsSync(path.join(sourceData,'xiaozhi-pi')))fs.cpSync(path.join(sourceData,'xiaozhi-pi'),path.join(data,'xiaozhi-pi'),{recursive:true});
const sourceDbHash=sha256(fs.readFileSync(path.join(sourceData,'app.db')));
const report={success:false,checks:[],build:{root:buildRoot,sha256:fixed.sha256,files:fixed.files.length},source:{dbSha256:sourceDbHash},copy:{...copied},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  layer:'D: owned read-only copy of user daily profile / frozen formal Electron / real saved DeepSeek configuration / real public network',
  humanAccepted:false,
  boundary:'Current-network daily configuration copy search/two bodies/internal browser. VPN-off, DNS faults, installer, real teacher, curriculum quality and Office/WPS playback remain unverified.'};
let app,page,session;const errors=[];
const until=async(fn,timeout=180000)=>{const end=Date.now()+timeout;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Daily network copy condition timed out');};
const snapshot=id=>page.evaluate(value=>window.omniEdu.getXiaozhiSnapshot(value),id);
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
function native(sessionId){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{const row=db.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(sessionId);return fs.readFileSync(path.join(data,'xiaozhi-pi',row.session_file));}finally{db.close();}}
async function run(prompt){const before=(await snapshot(session)).projection.turns.at(-1)?.id;await page.getByTestId('office-prompt-input').fill(prompt);await page.locator('.office-composer [data-slot="prompt-input-send"]').click();assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');return until(async()=>{const state=await snapshot(session),turn=state.projection.turns.at(-1);return turn?.id!==before&&!state.running&&['completed','failed','interrupted'].includes(turn.status)?turn:undefined;});}
async function centralScreenshot(name){const target=page.getByTestId('office-conversation');await target.waitFor({state:'visible'});await target.screenshot({path:path.join(output,name),animations:'disabled'});}
try{
  const env={...process.env};
  for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_'))delete env[key];
  for(const key of ['DEEPSEEK_API_KEY','DEEPSEEK_MODEL','OMNI_EDU_DATA_ROOT','OMNI_EDU_TEST_BUILD_ROOT','ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','OMNI_EDU_XIAOZHI_PI'])delete env[key];
  env.NODE_ENV='development';env.OMNI_EDU_REPO_ROOT=path.resolve('../..');
  app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});
  page=await app.firstWindow();page.on('pageerror',error=>errors.push(String(error)));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!(await page.getByTestId('office-prompt-input').isDisabled()));
  (report.launches||=[]).push(await assertIsolatedPiMain(app,main,profile));
  const settings=await page.evaluate(()=>window.omniEdu.getXiaozhiSettings());
  report.settings={provider:settings.value.provider,model:settings.value.defaultModel,configured:settings.value.configured,web:settings.value.web};
  assert(settings.value.configured);assert(settings.value.web?.enabled);assert.equal(settings.value.web?.dnsMode,'auto');
  assert(!env.DEEPSEEK_API_KEY&&!env.DEEPSEEK_MODEL);
  if(!await page.getByTestId('ai-conversation-sidebar').isVisible())await page.getByTestId('pi-sidebar-toggle').click();
  const previous=await page.locator('.office-composer-container').getAttribute('data-session-id');await page.getByTestId('ai-conversation-new').click();
  session=await until(async()=>{const value=await page.locator('.office-composer-container').getAttribute('data-session-id');return value&&value!==previous?value:undefined;});
  assert.equal((await snapshot(session)).projection.turns.length,0);
  check('Owned daily-profile copy restores the saved DeepSeek configuration with web enabled and auto DNS, without environment overrides');

  const official='http://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html';
  const search=await run(`这是联网功能验收，只处理公开教育政策，不访问本地资料。请实际联网搜索“教育部 义务教育课程方案 2022年版 秋季学期”，再读取两个不同来源网页正文，其中一个为 ${official}。分别列出通知落款、网页发布日期、实施时间及真实来源链接；失败请如实说明。`);
  report.searchTurn={runId:search.id,status:search.status};assert.equal(search.status,'completed',search.error);
  const tools=search.items.filter(item=>item.kind==='tool');
  assert(tools.some(item=>item.toolAttempt?.tool==='office_web_search'&&item.status==='completed'&&item.sources?.length));
  const sources=tools.filter(item=>item.toolAttempt?.tool==='office_web_fetch'&&item.status==='completed').flatMap(item=>item.sources?.filter(source=>source.kind==='read')||[]);
  assert(new Set(sources.map(source=>source.url)).size>=2);
  const answer=search.items.filter(item=>item.phase==='final_answer').map(item=>item.text).join('\n');
  assert(/2022\s*年\s*3\s*月\s*25\s*日|2022[-/.]0?3[-/.]25/.test(answer));
  assert(/2022[-/.]0?4[-/.]21|2022\s*年\s*4\s*月\s*21\s*日/.test(answer));
  assert(/2022年.{0,12}秋季.{0,8}学期/s.test(answer));assert(answer.includes(official));
  const messages=native(session).toString().trim().split('\n').map(JSON.parse).filter(entry=>entry.message?.role==='toolResult').map(entry=>entry.message);
  const body=messages.flatMap(message=>message.content.filter(content=>content.type==='text').flatMap(content=>{try{const data=JSON.parse(content.text);return data.url===official?[data]:[];}catch{return[];}}))[0];
  assert(body?.success&&body.text.includes('2022年3月25日'));report.publicSources=sources;report.bodySha256=sha256(body.text);
  check('Daily saved configuration performs real public search plus two body reads and the persisted official body matches the answer dates');

  const browser=await run(`继续在内置浏览器实际打开 ${official}，读取页面快照并截取当前页面，不从上一轮文字推断。`);report.browserTurn={runId:browser.id,status:browser.status};
  assert(browser.items.some(item=>item.browserCapture));
  const browserPage=await until(async()=>app.context().pages().find(candidate=>candidate.url().startsWith(official)),30000);
  assert((await browserPage.locator('body').innerText()).includes('义务教育'));
  await browserPage.screenshot({path:path.join(output,'daily-browser.png'),animations:'disabled'});
  check('Daily saved configuration opens the official page in the internal browser and captures a real local screenshot');

  const projected=(await snapshot(session)).projection.turns;
  await page.setViewportSize({width:1366,height:768});await page.emulateMedia({colorScheme:'light'});await centralScreenshot('daily-network-light-1366.png');
  await page.setViewportSize({width:1920,height:1080});await page.emulateMedia({colorScheme:'dark'});await centralScreenshot('daily-network-dark-1920.png');
  const beforeNative=native(session);await page.reload();await page.getByTestId('xiaozhi-pi-workspace').waitFor();await until(async()=>!(await page.getByTestId('office-prompt-input').isDisabled()));
  assert.deepEqual((await snapshot(session)).projection.turns,projected);assert(native(session).equals(beforeNative));
  check('Renderer reload preserves the copied-profile network receipts and native bytes without replaying search, fetch or browser actions');

  assert.equal(sha256(fs.readFileSync(path.join(sourceData,'app.db'))),sourceDbHash);assert.equal(fingerprint(buildRoot).sha256,fixed.sha256);assert.deepEqual(errors,[]);report.success=true;
  check('Source daily database and frozen build remain exact; renderer has no errors');
}catch(error){
  report.error=String(error.stack).replace(/sk-[A-Za-z0-9]+/g,'[credential]').slice(0,5000);process.exitCode=1;
  await page?.getByTestId('office-conversation').screenshot({path:path.join(output,'failure-central.png'),animations:'disabled'}).catch(()=>{});
  if(session)report.lastSnapshot=await snapshot(session).catch(()=>undefined);
}finally{
  await app?.close().catch(()=>{});
  report.sourceDbUnchanged=sha256(fs.readFileSync(path.join(sourceData,'app.db')))===sourceDbHash;
  fs.rmSync(profile,{recursive:true,force:true});report.ephemeralProfileRemoved=!fs.existsSync(profile);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));
}
