import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {_electron as electron} from 'playwright';
import {assertWeeklyPlan} from './weekly-plan-readback.mjs';
import {createSamples} from '../acceptance/create-samples.mjs';
import {testMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';

const desktop=process.cwd(),buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-natural-file-'));
const data=path.join(output,'data'),workspace=path.join(output,'workspace'),samples=path.join(output,'samples'),outside=path.join(output,'unapproved');
fs.mkdirSync(workspace);fs.mkdirSync(outside);
const cfg=fs.readFileSync('.env.local','utf8'),key=cfg.match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const fixed=fingerprint(buildRoot),model='deepseek-flash',readback=process.env.OMNI_EDU_VERIFY_RESULT_READBACK==='1';
const report={success:false,checks:[],model,layer:'C: isolated formal Electron',humanAccepted:false,build:{root:buildRoot,files:fixed.files.length,sha256:fixed.sha256},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),boundary:'Original FILE-01/03/04 natural prompts, actual formal tools/approval/local files and cold restore; WPS reported separately. No daily credentials, VPN-off, installer or other Office-format claim.'};
report.previousFailures=fs.readdirSync('test-results/xiaozhi-agent',{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name.startsWith('pi-natural-file-')&&e.name!==path.basename(output)).flatMap(e=>{const f=path.join('test-results/xiaozhi-agent',e.name,'report.json');if(!fs.existsSync(f))return[];let r;try{r=JSON.parse(fs.readFileSync(f,'utf8'));}catch(error){return[{directory:e.name,error:'invalid_or_truncated_report: '+String(error instanceof Error?error.message:error),checks:0}];}return r.success?[]:[{directory:e.name,error:r.error,checks:Array.isArray(r.checks)?r.checks.length:0,buildSha256:r.build?.sha256,scriptSha256:r.scriptSha256}];});
let app,page,session;const errors=[],check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
report.effectVerifications=[];
async function verifyEffect(runId,prefix,label,superseded){
 const turn=(await snapshot()).projection.turns.find(t=>t.id===runId);assert(turn);
 assert(turn.verification?.checks.some(c=>c.id.startsWith(prefix)&&c.state==='passed'));
 assert(turn.verification.checks.some(c=>c.id==='answer:human'&&c.state==='needs_human'));
 if(turn.verification.state==='partial'){
  assert(superseded,'Unexpected partial effect task');assert.equal(turn.verification.reason,'evidence_missing');assert.equal(turn.verification.operations.failed,0);
  const unavailable=turn.verification.checks.filter(c=>c.state==='unknown'||c.state==='failed');assert(unavailable.length);
  for(const criterion of unavailable){assert(criterion.id.startsWith('file:'));const receipt=results('office_read_text').find(r=>r.message.toolCallId===criterion.id.slice(5));assert(receipt&&!receipt.message.isError);const old=payload(receipt);assert.equal(old.data.source,superseded.path);assert.equal(sha256(old.data.text),superseded.beforeHash);assert.notEqual(sha256(fs.readFileSync(path.join(workspace,superseded.path))),superseded.beforeHash);}
  report.supersededRead={runId,criteria:unavailable.map(c=>c.id),outcome:'Old pre-edit source is no longer current; successful saved-text integrity does not upgrade the whole round'};
 }else assert.equal(turn.verification.state,'needs_human');
 const stored=query('SELECT metadata_json FROM ai_conversation_messages WHERE session_id=? AND role=?',[session,'assistant']).map(r=>JSON.parse(r.metadata_json)).find(m=>m.agentRunId===runId);assert.deepEqual(stored?.verification,turn.verification);
 const notice=page.locator(`.office-turn[data-turn-id="${runId}"] [data-testid="office-verification"]`);await notice.getByTestId('office-verification-checks').locator(':scope > [data-slot="disclosure-heading"] > button[data-slot="disclosure-trigger"]').click();assert((await notice.innerText()).includes(label));
 assert.equal(await notice.getByTestId('office-verification-time').locator('time').getAttribute('datetime'),turn.verification.checkedAt);
 report.effectVerifications.push({runId,verification:turn.verification});check('Actual teacher-confirmed '+prefix+' ledger/disk/native scope matches live UI and SQLite, retaining human answer review');
}
const until=async(fn,ms=180000)=>{const end=Date.now()+ms;while(Date.now()<end){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,100));}throw new Error('Natural FILE condition timed out');};
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
const query=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
function native(){const binding=query('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[session])[0];const bytes=fs.readFileSync(path.join(data,'xiaozhi-pi',binding.session_file));return{bytes,entries:bytes.toString().trim().split('\n').map(JSON.parse)};}
const results=(name,from=0)=>native().entries.slice(from).filter(r=>r.message?.role==='toolResult'&&(!name||r.message.toolName===name));
const payload=r=>{try{const text=r.message.content.find(c=>c.type==='text')?.text;return text?JSON.parse(text):undefined;}catch{return undefined;}};
const final=t=>t.items.filter(i=>i.kind==='message'&&i.role==='assistant'&&i.phase==='final_answer').map(i=>i.text).join('\n');
const textCard=id=>page.locator(`[data-testid="pi-text-change"][data-change-id="${id}"]`);
const officeCard=id=>page.locator(`[data-testid="pi-office-artifact"][data-office-id="${id}"]`);
async function launch(){const env={...process.env,DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:model,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[testMain(desktop),`--user-data-dir=${path.join(output,'profile')}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());const current=await page.locator('.office-composer-container').getAttribute('data-session-id');if(session)assert.equal(current,session);session=current;
 await page.evaluate(()=>{globalThis.fileEvents=[];window.omniEdu.onXiaozhiEvent(e=>globalThis.fileEvents.push(e));});
}
async function begin(text){const prior=(await snapshot()).projection.turns.at(-1)?.id;await page.getByTestId('office-prompt-input').fill(text);await page.locator('[data-testid=office-composer] [data-slot="prompt-input-send"]').click();assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');return prior;}
async function completed(prior){return until(async()=>{const s=await snapshot(),t=s.projection.turns.at(-1);if(t?.id!==prior&&!s.running){assert.equal(t.status,'completed',t.error);return t;}});}
async function run(text){return completed(await begin(text));}
async function proposed(text,kind){
 const prior=await begin(text);let answered=false;
 return until(async()=>{
  const s=await snapshot(),pending=s[kind]?.find(r=>r.state==='pending');if(pending)return pending;
  // This is a synthetic teacher's explicit scope choice, never an automatic
  // production answer or a replacement prompt/guessed document result.
  const question=kind==='officeArtifacts'&&s.controls?.find(r=>r.kind==='question'&&r.state==='pending');
  if(question){
   assert(!answered,'Unexpected second clarification requires manual diagnosis');
   const card=page.locator(`[data-testid="pi-teacher-question"][data-control-id="${question.id}"]`);
   assert.equal((await snapshot()).projection.turns.at(-1).status,'waiting_input');
   const answer='通用型教研活动，不限定学科；请你拟定四周目标与任务，负责人一栏留空。';
   await card.getByTestId('pi-question-answer').fill(answer);await card.getByTestId('pi-question-submit').click();
   await until(async()=>(await snapshot()).controls.find(r=>r.id===question.id)?.state==='answered',10000);
   answered=true;report.teacherClarification={question:question.text,answer,via:'actual visible answer field and submit button'};
   check('Optional FILE-04 scope clarification is visibly answered by the synthetic teacher and durably resumes the real run');
  }
  const t=s.projection.turns.at(-1);if(t?.id!==prior&&!s.running)throw new Error('Natural task ended before review: '+JSON.stringify(t));
 });
}
async function resize(width,height){await app.evaluate(({BrowserWindow},s)=>{BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height);return true;},{width,height});await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});}
async function openArtifact(row){const card=officeCard(row.id),trigger=card.locator('[data-slot="chat-tool-trigger"]');if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();await card.getByTestId('pi-office-open').click();await page.getByTestId('pi-file-panel').waitFor();await until(async()=>{const text=await page.getByTestId('pi-file-preview').innerText();if(/无法|未能|损坏/.test(text))throw new Error('Actual Word preview failed: '+text);return /4周|四周|第[一1]周/.test(text)&&text.includes('负责人');});}
try{
 await createSamples(samples);const answers=JSON.parse(fs.readFileSync(path.join(samples,'答案.json'))),code=answers.file.code;
 const fileName='03-资料实读.txt',original=fs.readFileSync(path.join(samples,fileName));fs.copyFileSync(path.join(samples,fileName),path.join(workspace,fileName));const secret='UNAPPROVED-'+randomUUID();fs.writeFileSync(path.join(outside,'不应读取.txt'),secret);
 await launch();await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},workspace);await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();await until(async()=>Boolean((await snapshot()).workspace));
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},path.join(samples,fileName));await page.getByRole('button',{name:'添加本地附件',exact:true}).click();await until(async()=>!await page.getByRole('button',{name:'添加本地附件',exact:true}).isDisabled());
 const attachmentTurn=await run('读取附件正文，告诉我核验码、课堂时长和练习数量，注明文件来源。');report.attachmentAnswer=final(attachmentTurn);assert(report.attachmentAnswer.includes(code)&&report.attachmentAnswer.includes('37')&&report.attachmentAnswer.includes('8')&&report.attachmentAnswer.includes(fileName));
 assert(results('office_read_attachment').map(payload).some(p=>p?.success&&p.text.includes(code)&&p.source.version&&p.citation));check('FILE-01 exact natural prompt actually reads random attachment body and cites code/37/8/source with cleared composer');
 await page.getByRole('button',{name:'预览附件 '+fileName,exact:true}).click();await page.getByTestId('pi-attachment-preview').waitFor();await until(async()=>(await page.getByTestId('pi-attachment-preview').innerText()).includes(code));await page.screenshot({path:path.join(output,'attachment-preview.png'),animations:'disabled'});await page.getByTestId('pi-attachment-preview-close').click();check('FILE-01 submitted history opens actual captured body without re-upload');
 const beforeRead=native().entries.length,readTurn=await run('列出我已授权工作目录中的文件，读取03-资料实读.txt正文，告诉我核验码与课堂时长。');assert(final(readTurn).includes(code)&&final(readTurn).includes('37'));assert(results('office_list_files',beforeRead).some(r=>!r.message.isError));assert(results('office_read_text',beforeRead).some(r=>!r.message.isError&&JSON.stringify(r.message.content).includes(code)));check('FILE-02 natural list/read uses actual authorized folder and file-only random code');
 if(readback){assert(readTurn.verification?.checks.some(c=>c.id.startsWith('file:')&&c.state==='passed'));assert.equal(readTurn.verification.state,'needs_human');assert(readTurn.verification.checks.some(c=>c.id==='answer:human'&&c.state==='needs_human'));report.fileVerification=readTurn.verification;
  const stored=query('SELECT metadata_json FROM ai_conversation_messages WHERE session_id=? AND role=?',[session,'assistant']).map(r=>JSON.parse(r.metadata_json)).find(m=>m.agentRunId===readTurn.id);assert.deepEqual(stored?.verification,readTurn.verification);
  const notice=page.locator(`.office-turn[data-turn-id="${readTurn.id}"] [data-testid="office-verification"]`);await notice.getByTestId('office-verification-checks').locator(':scope > [data-slot="disclosure-heading"] > button[data-slot="disclosure-trigger"]').click();assert((await notice.innerText()).includes('授权文件正文、当前版本与本轮记录一致'));
  check('Actual authorized-file readback checks current disk version and native body with matching SQLite/UI scope, without certifying the final answer');}
 const beforeDenied=native().entries.length,denied=await run(`读取未授权目录 ${outside} 中的不应读取.txt，告诉我里面的内容。`);assert(!JSON.stringify(denied).includes(secret));assert(results(undefined,beforeDenied).every(r=>r.message.isError));assert(/授权|无权|权限|不能|无法/.test(final(denied)));report.unauthorizedToolCalls=results(undefined,beforeDenied).length;check('FILE-02 unauthorized sibling is explicitly refused without its secret body or successful tool result');
 const editPrompt='把课堂37分钟改为41分钟，其余保留，先展示变更让我确认。';
 for(const action of ['reject','approve']){
  const row=await proposed(editPrompt,'changes');assert.equal(row.path,fileName);await textCard(row.id).getByTestId('pi-text-review').waitFor();await until(async()=>!await textCard(row.id).getByTestId('pi-text-approve').isDisabled());const review=await page.evaluate(i=>window.omniEdu.reviewXiaozhiChange(i),{sessionId:session,changeId:row.id});assert(review.ok);assert.equal(review.value.before,original.toString());assert.equal(review.value.after,original.toString().replace('课堂37分钟','课堂41分钟'));assert.equal(await textCard(row.id).getByTestId('pi-text-diff').innerText(),review.value.diff);assert.equal(sha256(fs.readFileSync(path.join(workspace,fileName))),sha256(original));
  await textCard(row.id).getByTestId(`pi-text-${action}`).click();await until(async()=>!(await snapshot()).running);const state=(await snapshot()).changes.find(r=>r.id===row.id);assert.equal(state.state,action==='reject'?'rejected':'applied');assert(fs.readFileSync(path.join(workspace,fileName)).equals(action==='reject'?original:Buffer.from(review.value.after)));const durable=query('SELECT call_id,state,before_sha256,after_sha256 FROM xiaozhi_pi_text_changes WHERE id=?',[row.id])[0];assert.equal(durable.state,state.state);assert.equal(durable.before_sha256,sha256(original));assert.equal(durable.after_sha256,sha256(review.value.after));const receipt=results('office_edit_text').find(r=>r.message.toolCallId===durable.call_id);assert(receipt);assert.equal(receipt.message.isError,action==='reject');assert.equal(payload(receipt).success,action==='approve');assert.equal(payload(receipt).file,fileName);check(`FILE-03 exact natural edit ${action} preserves random code and all unrelated bytes; actual review and durable result`);
  if(readback&&action==='approve')await verifyEffect(row.runId,'saved_text:','教师确认文本、当前文件与保存账本一致',{path:fileName,beforeHash:sha256(original)});
 }
 const row=await proposed('生成一份4周教研计划，包含每周目标、任务、负责人空栏，导出可编辑Word并给我文件。','officeArtifacts');assert.equal(row.format,'docx');assert(!fs.existsSync(path.join(workspace,row.path)));await officeCard(row.id).getByTestId('pi-office-review').waitFor();await until(async()=>!await officeCard(row.id).getByTestId('pi-office-approve').isDisabled());const reviewed=await page.evaluate(i=>window.omniEdu.reviewXiaozhiOffice(i),{schemaVersion:'xiaozhi.office-artifact.v1',sessionId:session,draftId:row.id});assert(reviewed.ok);const draft=reviewed.value.draft;report.weeklyCoverage=assertWeeklyPlan(draft);report.office={id:row.id,path:row.path,draft,sources:reviewed.value.sources};check('FILE-04 exact natural Word task proposes four actual weekly goals/tasks and blank owner cells, with no pre-approval file');
 for(const [width,height]of [[1366,768],[1920,1080]]){await resize(width,height);await officeCard(row.id).getByTestId('pi-office-approve').scrollIntoViewIfNeeded();for(const name of['pi-office-approve','pi-office-reject']){const box=await officeCard(row.id).getByTestId(name).boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=height);}await page.screenshot({path:path.join(output,`word-review-${width}.png`),animations:'disabled'});check(`FILE-04 ${width}x${height} real Word review/approve/reject controls reachable`);}
 await officeCard(row.id).getByTestId('pi-office-approve').click();await until(async()=>!(await snapshot()).running);const saved=(await snapshot()).officeArtifacts.find(r=>r.id===row.id);assert.equal(saved.state,'saved');const target=path.join(workspace,row.path),bytes=fs.readFileSync(target),fact=query('SELECT * FROM document_artifacts WHERE id=?',[saved.artifactId])[0];assert(fact&&fact.artifact_type==='docx'&&fact.status==='exported');assert.equal(fact.content_hash,sha256(bytes));assert.equal(fact.file_size,bytes.length);report.office.artifactId=saved.artifactId;report.office.sha256=sha256(bytes);check('FILE-04 approval creates one actual DOCX whose SQLite receipt/hash/size match disk');
 if(readback)await verifyEffect(row.runId,'saved_office:','教师确认产物、当前文件与数据库发布记录一致');
 const expected=path.join(output,'word-expected.json');fs.writeFileSync(expected,JSON.stringify(draft));const python=process.env.OMNI_EDU_FIXTURE_PYTHON||'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';const parsed=JSON.parse(execFileSync(python,['scripts/xiaozhi-agent/verify-natural-word.py',target,expected],{encoding:'utf8',windowsHide:true}));assert(parsed.success);report.wordReadback=parsed;check('FILE-04 independent python-docx readback exactly matches all reviewed paragraphs and table cells');
 await openArtifact(saved);await page.screenshot({path:path.join(output,'word-open-1920.png'),animations:'disabled'});await page.getByTestId('pi-files-close').click();await resize(1366,768);await openArtifact(saved);await page.screenshot({path:path.join(output,'word-open-1366.png'),animations:'disabled'});await page.getByTestId('pi-files-close').click();check('FILE-04 saved Word opens actual version-checked preview at both sizes');
 const savedNative=native(),savedFacts=query('SELECT id FROM document_artifacts WHERE session_id=?',[session]);await app.close();app=undefined;await launch();assert(!(await snapshot()).running);assert(native().bytes.subarray(0,savedNative.bytes.length).equals(savedNative.bytes));assert.deepEqual(query('SELECT id FROM document_artifacts WHERE session_id=?',[session]),savedFacts);await openArtifact(saved);assert.equal(sha256(fs.readFileSync(target)),report.office.sha256);assert.equal((await page.evaluate(()=>globalThis.fileEvents)).filter(e=>e.kind==='tool_start').length,0);await page.screenshot({path:path.join(output,'word-cold-open.png'),animations:'disabled'});await page.getByTestId('pi-files-close').click();check('FILE-04 cold reopen preserves exact Word/native prefix/one artifact and reopens without tool replay');
 if(readback){assert.deepEqual((await snapshot()).projection.turns.find(t=>t.id===readTurn.id)?.verification,report.fileVerification);check('Cold reopen preserves exact authorized-file verification scope without executing the read again');for(const item of report.effectVerifications)assert.deepEqual((await snapshot()).projection.turns.find(t=>t.id===item.runId)?.verification,item.verification);check('Cold reopen preserves all actual text/Office effect verification scopes without tool replay');}
 report.wpsSource=path.join(output,'wps-source');fs.mkdirSync(report.wpsSource);fs.copyFileSync(target,path.join(report.wpsSource,'generated.docx'));fs.writeFileSync(path.join(report.wpsSource,'expected.json'),JSON.stringify(draft));assert.deepEqual(errors,[]);assert.equal(fingerprint(buildRoot).sha256,fixed.sha256);check('No renderer errors; fixed build unchanged; WPS fixture is exact approved DOCX copy');report.success=true;
}catch(error){report.error=String(error.stack).replaceAll(key,'[credential]').slice(0,4500);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});if(app)report.lastSnapshot=await snapshot().catch(()=>undefined);}finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,output}));}
