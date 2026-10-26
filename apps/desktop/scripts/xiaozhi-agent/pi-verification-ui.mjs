import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';

// Formal UI, a real provider and owned synthetic data. The expected attachment
// answer is generated here, independently of both the model and its tools.
const desktop=process.cwd(),buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-verification-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const cfg=fs.readFileSync('.env.local','utf8');
const key=cfg.match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const fixed=fingerprint(buildRoot),model='deepseek-flash',main=testMain(desktop),readback=process.env.OMNI_EDU_VERIFY_RESULT_READBACK==='1';
const report={success:false,checks:[],model,readback,layer:'C: isolated formal Electron',humanAccepted:false,
 build:{root:buildRoot,files:fixed.files.length,sha256:fixed.sha256},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
 boundary:'H02-A execution versus verification, live UI / SQLite / cold projection. Real provider; no mock model or forced tool call. This is not full H02, original image acceptance, daily profile, VPN-off or installer acceptance.'};
let app,page,session;const errors=[];
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
const until=async(fn,ms=180000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,100));}throw new Error('Verification UI condition timed out');};
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
const query=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
const messages=()=>query('SELECT id,metadata_json FROM ai_conversation_messages WHERE session_id=? AND role=?',[session,'assistant']).map(r=>({...r,metadata:JSON.parse(r.metadata_json||'{}')}));
function native(){const row=query('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[session])[0];return fs.readFileSync(path.join(data,'xiaozhi-pi',row.session_file));}
const final=t=>t.items.filter(i=>i.kind==='message'&&i.role==='assistant'&&i.phase==='final_answer').map(i=>i.text).join('\n');
const notice=id=>page.locator(`.office-turn[data-turn-id="${id}"] [data-testid="office-verification"]`);
async function launch(){const env={...process.env,DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:model,OMNI_EDU_DATA_ROOT:data,
 OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};
 delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 const current=await page.locator('.office-composer-container').getAttribute('data-session-id');if(session)assert.equal(current,session);session=current;
 await page.evaluate(()=>{globalThis.verificationEvents=[];window.omniEdu.onXiaozhiEvent(e=>globalThis.verificationEvents.push(e));});
 (report.launches||=[]).push(await assertIsolatedPiMain(app,main,profile));
}
async function run(text){const prior=(await snapshot()).projection.turns.at(-1)?.id;
 await page.getByTestId('office-prompt-input').fill(text);await page.locator('.office-composer [data-slot="prompt-input-send"]').click();
 assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');
 return until(async()=>{const s=await snapshot(),t=s.projection.turns.at(-1);return t?.id!==prior&&!s.running&&['completed','failed','interrupted'].includes(t?.status)?t:undefined;});
}
async function assertDurable(turn){const row=messages().find(r=>r.metadata.agentRunId===turn.id);assert(row,'Missing actual assistant metadata');
 assert.deepEqual(row.metadata.verification,turn.verification);
 const events=await until(async()=>{const events=await page.evaluate(()=>globalThis.verificationEvents);return events.some(e=>e.runId===turn.id&&e.kind==='status'&&['completed','failed','interrupted'].includes(e.status))?events:undefined;},10000);
 const v=events.findIndex(e=>e.runId===turn.id&&e.kind==='verification'),terminal=events.findIndex(e=>e.runId===turn.id&&e.kind==='status'&&['completed','failed','interrupted'].includes(e.status));
 assert(v>=0&&terminal>v,'Verification must precede terminal event');assert.deepEqual(events[v].verification,turn.verification);
 await notice(turn.id).waitFor();assert.equal(await notice(turn.id).getAttribute('data-state'),turn.verification.state);return row;
}
try{
 await launch();check('Owned formal Pi main and Chromium profile loaded; daily window untouched');
 const chat=await run('你好，请只回复：课堂准备好了。');assert.equal(chat.status,'completed',chat.error);assert(final(chat).includes('课堂准备好了'));
 assert.equal(chat.verification?.state,'unknown');assert.equal(chat.verification.reason,'no_criteria');assert.deepEqual(chat.verification.checks,[]);
 await assertDurable(chat);check('Real normal reply ends with unknown verification, matching live event / visible notice / SQLite; composer cleared');
 const code='H02-'+randomUUID(),fileName='核验资料.txt',file=path.join(output,fileName);
 fs.writeFileSync(file,`核验码：${code}\n课堂37分钟，共8道练习。\n`);report.independentExpected={code,duration:37,exercises:8,fileName,inputSha256:sha256(fs.readFileSync(file))};
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
 await page.getByRole('button',{name:'添加本地附件',exact:true}).click();await until(async()=>!await page.getByRole('button',{name:'添加本地附件',exact:true}).isDisabled());
 const attachment=await run('读取附件正文，告诉我核验码、课堂时长和练习数量，注明文件来源。');assert.equal(attachment.status,'completed',attachment.error);
 const answer=final(attachment);assert(answer.includes(code)&&answer.includes('37')&&answer.includes('8')&&answer.includes(fileName),answer);report.fileAnswer=answer;
 const fileEvents=(await page.evaluate(()=>globalThis.verificationEvents)).filter(e=>e.runId===attachment.id);
 assert(fileEvents.some(e=>e.kind==='tool_end'&&e.tool==='office_read_attachment'&&e.success));
 assert.equal(attachment.verification?.state,readback?'needs_human':'unknown');assert(attachment.verification.operations.succeeded>=1);assert.equal(attachment.verification.operations.failed,0);
 assert(attachment.verification.evidence.some(e=>e.kind==='execution'&&e.runId===attachment.id&&/^[a-f0-9]{64}$/.test(e.digest)));
 await assertDurable(attachment);check('Natural attachment read returns independent random answer and real tool receipt, without promoting receipt or model text to verified');
 if(readback){
  assert(attachment.verification.checks.some(c=>c.id.startsWith('attachment:')&&c.state==='passed'&&c.evidenceIds.length===1));
  assert(attachment.verification.checks.some(c=>c.id==='answer:human'&&c.state==='needs_human'));
  await notice(attachment.id).getByTestId('office-verification-checks').locator('summary').click();
  assert((await notice(attachment.id).innerText()).includes('附件正文、本地版本与本轮记录一致'));
  check('Actual local attachment and native result readback pass only their declared integrity scope, with visible answer-review boundary');
  const web=await run('帮我查教育部《义务教育课程方案和课程标准（2022年版）》的官方通知，读取通知正文，告诉我发文日期和实施时间，附官网来源。请区分网页发布日期和通知正文落款日期。');
  assert.equal(web.status,'completed',web.error);
  const webEvents=(await page.evaluate(()=>globalThis.verificationEvents)).filter(e=>e.runId===web.id);
  assert(webEvents.some(e=>e.kind==='tool_end'&&e.tool==='office_web_fetch'&&e.success&&e.sources?.some(s=>{const url=new URL(s.url);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&(url.hostname==='moe.gov.cn'||url.hostname.endsWith('.moe.gov.cn'));})));
  assert(web.verification.checks.some(c=>c.id.startsWith('web:')&&c.state==='passed'));
  assert(['needs_human','partial'].includes(web.verification.state));assert(web.verification.checks.some(c=>c.id==='answer:human'&&c.state==='needs_human'));
  const answer=final(web);assert(/2022\s*年\s*3\s*月\s*25\s*日|2022[-/.]0?3[-/.]25/.test(answer));assert(/2022\s*年\s*4\s*月\s*21\s*日|2022[-/.]0?4[-/.]21/.test(answer));assert(/2022年.{0,12}秋季.{0,8}学期/s.test(answer));
  await assertDurable(web);report.webAnswer=answer;
  check('Exact NET-01 actually reads official body and matches independent dates; native source integrity scope passes, final answer still requires review');
 }
 const failed=await run('在内置浏览器打开 https://xiaozhi-test.invalid/ ，告诉我实际访问结果。');
 assert.equal(failed.status,'completed',failed.error);assert(failed.items.some(i=>i.kind==='tool'&&i.label==='浏览网页'&&i.status==='failed'&&!i.sources?.length&&!i.browserCapture));
 assert(['partial','blocked'].includes(failed.verification?.state));assert(failed.verification.operations.failed>=1);assert(!failed.items.some(i=>i.browserCapture));
 await assertDurable(failed);report.failedTask={executionStatus:failed.status,verification:failed.verification,answer:final(failed)};
 check('Actual failed browser tool followed by a normal final reply is visibly blocked/partial, never verified');
 for(const theme of ['light','dark'])for(const size of [{width:1366,height:768},{width:1920,height:1080}]){
  await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
  await app.evaluate(({BrowserWindow},size)=>{BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height);return true;},size);
  await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,size);
  await notice(failed.id).scrollIntoViewIfNeeded();const box=await notice(failed.id).boundingBox();
  assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1);
  await page.screenshot({path:path.join(output,`verification-${theme}-${size.width}.png`),animations:'disabled'});
  check(`Actual verification notice visible at ${theme} ${size.width}x${size.height}`);
 }
 const original=(await snapshot()).projection.turns.map(t=>({id:t.id,verification:t.verification})),bytes=native(),rows=messages();
 report.original=original;await app.close();app=undefined;await launch();const cold=await snapshot();assert(!cold.running);
 assert.deepEqual(cold.projection.turns.map(t=>({id:t.id,verification:t.verification})),original);assert(native().equals(bytes));assert.deepEqual(messages(),rows);
 assert.equal((await page.evaluate(()=>globalThis.verificationEvents)).filter(e=>e.kind==='tool_start').length,0);
 for(const turn of cold.projection.turns){await notice(turn.id).scrollIntoViewIfNeeded();assert.equal(await notice(turn.id).getAttribute('data-state'),turn.verification.state);}
 check('Cold reopen preserves exact verification metadata and native bytes with no tool replay; visible states match');
 await app.close();app=undefined;
 // Declared old-history fixture: only remove the new field in this owned DB,
 // preserving all original result text, identifiers and other metadata.
 const old=rows.find(r=>r.metadata.agentRunId===chat.id);const db=new DatabaseSync(path.join(data,'app.db'));
 try{const metadata={...old.metadata};delete metadata.verification;db.prepare('UPDATE ai_conversation_messages SET metadata_json=? WHERE id=?').run(JSON.stringify(metadata),old.id);}finally{db.close();}
 report.legacyFixture={assistantId:old.id,runId:chat.id,change:'remove only verification from owned synthetic DB'};
 await launch();const legacy=(await snapshot()).projection.turns.find(t=>t.id===chat.id);assert.equal(legacy.verification.state,'unknown');assert.equal(legacy.verification.reason,'legacy');
 await notice(chat.id).scrollIntoViewIfNeeded();assert.equal(await notice(chat.id).getAttribute('data-state'),'unknown');assert((await notice(chat.id).innerText()).includes('历史记录没有核验证据'));
 for(const item of original.filter(t=>t.id!==chat.id))assert.deepEqual((await snapshot()).projection.turns.find(t=>t.id===item.id)?.verification,item.verification);
 assert(native().equals(bytes));check('Old completed history downgrades to unknown without rewriting native history or other task verification');
 if(readback){
 await app.close();app=undefined;
 // Independent malformed metadata fixture: all readback checks passed, yet one
 // failed execution remains. Never alter actual native entries or saved effects.
 const source=messages().find(r=>r.metadata.agentRunId===attachment.id),invalidDb=new DatabaseSync(path.join(data,'app.db'));
 const invalid={...source.metadata.verification,state:'verified',reason:'criteria_checked',checks:source.metadata.verification.checks.filter(c=>c.state==='passed'),operations:{succeeded:1,failed:1}};
 assert(invalid.checks.length,'A real passed scope is required for the contradiction fixture');
 const contentBefore=query('SELECT content FROM ai_conversation_messages WHERE id=?',[source.id])[0].content;
 try{invalidDb.prepare('UPDATE ai_conversation_messages SET metadata_json=? WHERE id=?').run(JSON.stringify({...source.metadata,verification:invalid}),source.id);}finally{invalidDb.close();}
 report.contradictoryFixture={assistantId:source.id,runId:attachment.id,change:'verified with nonzero failed count; owned synthetic metadata only'};
 await launch();const rejected=(await snapshot()).projection.turns.find(t=>t.id===attachment.id);assert.equal(rejected.verification.state,'unknown');await notice(attachment.id).scrollIntoViewIfNeeded();assert.equal(await notice(attachment.id).getAttribute('data-state'),'unknown');assert.equal(query('SELECT content FROM ai_conversation_messages WHERE id=?',[source.id])[0].content,contentBefore);assert(native().equals(bytes));
 check('Cold production projection and visible UI reject contradictory verified-plus-failed metadata, preserving answer and native bytes');
 }
 assert.deepEqual(errors,[]);assert.equal(fingerprint(buildRoot).sha256,fixed.sha256);check('No renderer errors; exact frozen build unchanged across all launches');report.success=true;
}catch(error){report.error=String(error.stack).replaceAll(key,'[credential]').slice(0,4500);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});if(app)report.lastSnapshot=await snapshot().catch(()=>undefined);
}finally{if(page&&!page.isClosed())report.events=await page.evaluate(()=>globalThis.verificationEvents).catch(()=>undefined);await app?.close().catch(()=>{});report.rendererErrors=errors;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,output}));}
