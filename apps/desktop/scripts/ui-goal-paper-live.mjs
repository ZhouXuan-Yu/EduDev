/** Real formal-Pi acceptance runner, NO build. Running costs model calls.
 * Reuses paperExportJourney: its exact 20-question fixture, six real exports,
 * Office approval, independent verify-paper-export.py, rejection/source/stop/
 * cold-readback assertions stay in the original journey. No replacement host.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {productEntry} from './product-navigation.mjs';
import {paperExportJourney} from './education/paper-export-journey.mjs';
import {admitPaperEnter} from './education/paper-ui-admission.mjs';
import {openPaperHistory} from './education/paper-ui-disclosure.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=fs.mkdtempSync(path.join(desktop,'test-results/ui-goal-paper-'));
const data=path.join(output,'data'),profile=path.join(output,'electron-profile');
const main=testMain(desktop),buildRoot=path.dirname(path.dirname(main)),fixed=fingerprint(buildRoot);
// Parent supplies the credential in its process environment. Never read another
// worktree's private .env.local or copy it into this isolated acceptance profile.
const key=process.env.DEEPSEEK_API_KEY;
const fixturePython=process.env.OMNI_EDU_FIXTURE_PYTHON||'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const report={success:false,scenario:'U4-PAPER-UI',command:'node scripts/ui-goal-paper-live.mjs',
  build:{sha256:fixed.sha256,main},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  originalJourneySha256:sha256(fs.readFileSync(path.join(desktop,'scripts/education/paper-export-journey.mjs'))),
  admissionHelperSha256:sha256(fs.readFileSync(path.join(desktop,'scripts/education/paper-ui-admission.mjs'))),
  checks:[],visuals:[],launches:[],rendererErrors:[],consoleErrors:[],
  additionalBoundaries:['Controlled original text fixture, not model-generated questions or rich scan parity.',
    'Three blueprint modes: field/context/quota and no-confirmed-group refusal only; not hybrid/original generation quality.',
    'System dark preference must still render light product theme; no requested dark product UI.',
    'Python reads actual six DOCX/PDF signatures/content/A4; not manual Word/WPS visual acceptance.']};
let app,page,session;
const redact=s=>String(s).replace(/sk-[a-zA-Z0-9_-]+/g,'[credential]').slice(0,1500);
const check=(name)=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
async function until(predicate,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){if(await predicate())return;await new Promise(r=>setTimeout(r,80));}throw Error('U4 condition timeout');}
async function launch(){
  const env={...process.env,DEEPSEEK_API_KEY:key,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_E2E_DIALOG_MODE:'1'};
  delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.OMNI_EDU_E2E_LEGACY_AI;delete env.OMNI_EDU_E2E_VISIBLE;
  app=await electron.launch({args:[main,`--user-data-dir=${profile}`,'--force-device-scale-factor=1'],env,timeout:60000});
  const evidence=await assertIsolatedPiMain(app,main,profile);report.launches.push(evidence);
  page=await app.firstWindow();page.setDefaultTimeout(30000);
  page.on('pageerror',error=>report.rendererErrors.push(redact(error.message)));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(redact(message.text()));});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
  session=await page.locator('.office-composer-container:visible').getAttribute('data-session-id');
  assert.equal(await page.evaluate(()=>devicePixelRatio),1);
  assert.equal(await page.locator('.edu-shell:visible').getAttribute('data-theme'),'light');
}
async function navigate(space){await productEntry(page.locator('.edu-shell:visible'),space).click();await until(async()=>await productEntry(page.locator('.edu-shell:visible'),space).getAttribute('aria-current')==='page');}
const teachingEntry=id=>page.locator('.edu-shell:visible').locator(`[data-testid="hub-entry-${id}"]:visible,[data-testid="nav-${id}"]:visible`);
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),session);
function rows(sql,params=[]){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...params);}finally{db.close();}}
async function capture(name){
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height),{width,height});
    await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,{width,height});
    const productTheme=await page.locator('.edu-shell:visible').getAttribute('data-theme');assert.equal(productTheme,'light');
    const png=`u4-${name}-${width}x${height}.png`;await page.screenshot({path:path.join(output,png),animations:'disabled'});
    report.visuals.push({png,width,height,productTheme,dpr:await page.evaluate(()=>devicePixelRatio)});
  }
}
async function openSaved(id){
  await navigate('teaching');await teachingEntry('paper').click();
  await page.getByTestId('paper-history').waitFor();await openPaperHistory(page);
  await page.locator(`[data-testid="paper-saved"][data-paper-id="${id}"]`).click();
  await page.getByTestId('paper-confirmed').waitFor();
}
async function beforeBlueprint(){
  assert(await page.getByTestId('paper-step-review').isDisabled());
  assert(await page.getByTestId('paper-step-delivery').isDisabled());
  assert((await page.locator('#paper-step-help').innerText()).includes('先按蓝图组卷'));
  for(const mode of ['hybrid','ai_original']){
    await page.getByTestId('paper-mode').selectOption(mode);
    await page.getByTestId('paper-generation-empty').waitFor();
    assert.equal(await page.getByTestId('paper-section-generated-count').count(),mode==='hybrid'?3:0);
    assert(await page.getByTestId('paper-generation-context').isVisible());
    await page.getByTestId('paper-generate').click();
    await page.getByTestId('paper-error').waitFor();
    assert((await page.getByTestId('paper-error').innerText()).includes('已确认题组'));
    assert.equal(rows("SELECT id FROM ai_confirmation_items WHERE action_type='pi_paper_candidate'").length,0);
  }
  await page.getByTestId('paper-mode').selectOption('source_only');
  assert.equal(await page.getByTestId('paper-generation-context').count(),0);
  await capture('three-mode-blueprint');check('Three blueprint modes preserve quota/context fields and refuse unapproved generated groups without model or paper writes');
}
async function afterConfirmed({paper,canonical}){
  const before=rows('SELECT * FROM ai_confirmation_items WHERE id=?',[paper.id])[0];
  await page.getByTestId('paper-step-blueprint').click();
  await page.getByTestId('paper-title').fill('未保存的蓝图');
  await page.getByTestId('paper-draft-status').waitFor();
  await page.getByTestId('paper-step-review').click();
  assert(await page.getByTestId('paper-step-delivery').isDisabled());
  await capture('dirty-review');
  await page.getByTestId('paper-step-blueprint').click();
  assert.equal(await page.getByTestId('paper-title').inputValue(),'未保存的蓝图');
  await openPaperHistory(page);
  await page.locator(`[data-testid="paper-saved"][data-paper-id="${paper.id}"]`).click();
  await page.getByTestId('paper-discard-continue').waitFor();
  await page.getByRole('button',{name:'继续编辑',exact:true}).click();
  assert.equal(await page.getByTestId('paper-title').inputValue(),'未保存的蓝图');
  await page.getByTestId('paper-title').fill(paper.title);
  await page.getByTestId('paper-step-review').click();
  assert(!await page.getByTestId('paper-step-delivery').isDisabled());
  assert.deepEqual(rows('SELECT * FROM ai_confirmation_items WHERE id=?',[paper.id])[0],before);
  check('Stage switching preserves dirty edits, history requires explicit discard, restoring exact blueprint keeps original confirmation bytes');
  // Equality restores export eligibility, but draft ownership intentionally stays
  // dirty until explicit discard. Release it before testing any cross-page flow.
  await page.getByTestId('paper-discard-edits').click();
  await page.getByTestId('paper-discard-continue').click();
  assert.equal(await page.getByTestId('paper-discard-edits').count(),0);
  assert.deepEqual(rows('SELECT * FROM ai_confirmation_items WHERE id=?',[paper.id])[0],before);
  const source=canonical[0];
  function sourceAnswer(value){const db=new DatabaseSync(path.join(data,'app.db'));try{db.prepare('UPDATE question_bank_items SET answer=? WHERE id=?').run(value,source.id);}finally{db.close();}}
  try {
    sourceAnswer('U4隔离fixture来源变化');await openSaved(paper.id);
    await page.getByTestId('paper-source-changed').waitFor();
    assert(await page.getByTestId('paper-step-delivery').isDisabled());
    assert.equal(await page.getByTestId('paper-export-entry').count(),0);
    await capture('source-invalid-review');
  } finally {sourceAnswer(source.answer);}
  assert.deepEqual(rows('SELECT * FROM question_bank_items ORDER BY id'),canonical);
  check('Reopening a confirmed paper after isolated source mutation blocks delivery; finally restores exact source facts');
  const root=path.join(output,'teacher-workspace');
  await app.evaluate(({dialog},directory)=>{const original=dialog.showOpenDialog;dialog.showOpenDialog=async function(...args){const options=args.length>1?args[1]:args[0];return /试卷保存文件夹|教学工作目录/.test(options?.title||'')?{canceled:false,filePaths:[directory]}:original.apply(dialog,args);};},root);
  for(const kind of ['student','teacher','answer_sheet'])for(const format of ['docx','pdf']){
    await openSaved(paper.id);await page.getByTestId('paper-to-delivery').click();
    await page.getByTestId(`paper-export-${kind}-${format}`).click();
    await page.getByTestId('office-prompt-input').waitFor();
    session=await page.locator('.office-composer-container:visible').getAttribute('data-session-id');assert.equal(session,paper.session_id);
    const draft=await page.getByTestId('office-prompt-input').inputValue();
    assert(draft.includes('education_export_paper')&&draft.includes(format));
    assert(draft.includes(kind==='answer_sheet'?'template=answer_sheet':kind==='teacher'?'教师答案卷':'学生卷'));
    assert.equal((await snapshot()).running,false);await page.getByTestId('office-prompt-input').fill('');
  }
  await openSaved(paper.id);await page.getByTestId('paper-to-delivery').click();
  await capture('six-entry-delivery');check('All six real UI buttons enter the same Pi session with correct audience/format/template draft and never auto-send');
}
async function piReviewEntry(){
  const bankBefore=rows('SELECT * FROM question_bank_items ORDER BY id');
  const artifactsBefore=rows('SELECT * FROM document_artifacts ORDER BY id');
  const original=rows('SELECT * FROM ai_confirmation_items WHERE id=?',[report.result.paperId])[0];
  const blueprint=JSON.parse(original.payload_json).input.blueprint;
  await navigate('ask');await page.getByTestId('office-prompt-input').waitFor();
  session=await page.locator('.office-composer-container:visible').getAttribute('data-session-id');
  const composer=page.locator('.office-composer-container:visible'),input=composer.getByTestId('office-prompt-input');
  await input.fill('请实际调用 education_propose_paper 按下面蓝图做纯题库组卷，等待我逐题核对确认，再调用 education_read_paper 读取保存结果。不要创建文件，不生成新题。蓝图：'+JSON.stringify({...blueprint,title:'U4聊天核题入口'}));
  const runId=await admitPaperEnter({input,send:composer.getByRole('button',{name:'发送消息',exact:true}),snapshot,commands:()=>rows('SELECT command_id,run_id,status FROM xiaozhi_pi_commands WHERE conversation_id=?',[session]),until,report,label:'PiPaperReview'});
  let paperReview;
  await until(async()=>{const found=((await snapshot()).paperReviews||[]).filter(review=>review.runId===runId&&review.title==='U4聊天核题入口'&&review.state==='pending');assert(found.length<=1,'Ambiguous Pi paper review in admitted run');paperReview=found[0];return !!paperReview;},180000);
  const reviewCard=page.locator('.edu-shell:visible').locator(`[data-turn-id="${runId}"]`).locator('[data-testid="pi-paper-review"]:visible').filter({hasText:'U4聊天核题入口'});
  await reviewCard.getByTestId('pi-paper-preview').click();
  const dialog=page.locator('[data-testid="pi-paper-dialog"]:visible');await dialog.waitFor();
  assert.equal(await dialog.getByTestId('paper-question').count(),20);
  await capture('pi-review-dialog');await dialog.getByTestId('paper-confirm').click();
  await dialog.getByTestId('paper-confirmed').waitFor();await dialog.getByRole('button',{name:'关闭',exact:true}).click();
  await until(async()=>{const s=await snapshot();return !s.running&&s.projection.turns.some(t=>t.id===runId&&['completed','failed','interrupted'].includes(t.status));},180000);
  const turn=(await snapshot()).projection.turns.find(t=>t.id===runId);assert.equal(turn.status,'completed');
  const row=rows('SELECT * FROM ai_confirmation_items WHERE id=? AND session_id=?',[paperReview.id,session])[0];
  assert(row&&row.status==='confirmed'&&row.run_id===runId);assert.equal(JSON.parse(row.payload_json).selection.items.length,20);
  assert.deepEqual(rows('SELECT * FROM question_bank_items ORDER BY id'),bankBefore);
  assert.deepEqual(rows('SELECT * FROM document_artifacts ORDER BY id'),artifactsBefore);
  report.piReview={id:row.id,sessionId:row.session_id,status:row.status};
  check('Original PiPaperReview entry shows all 20 questions and confirms through the real native tool wait without fake review UI');
}
try {
  assert(key,'Configure DEEPSEEK_API_KEY locally before running (never pass it in argv)');
  // Fail before Electron launch and paid turns if the independent readback
  // interpreter is missing its packages. Product DOCX/PDF generation is Node /
  // Chromium based; OMNI_EDU_PYTHON is not the readback interpreter override.
  execFileSync(fixturePython,['-c','from PIL import Image; from docx import Document; from pypdf import PdfReader; import pypdfium2'],{stdio:'pipe',windowsHide:true,timeout:30000});
  check('Independent readback Python imports succeed before launching Electron or making model requests');
  await paperExportJourney({desktop,data,output,report,launch,navigate,until,check,
    page:()=>page,app:()=>app,selectSession:async()=>{session=await page.locator('.office-composer-container:visible').getAttribute('data-session-id');return session;},
    restart:async()=>{await app.close();app=undefined;await launch();},beforeBlueprint,afterConfirmed});
  assert.equal(report.result.deliveries.length,6);
  for(const file of report.result.deliveries){const bytes=fs.readFileSync(path.join(output,'teacher-workspace',file.path));
    assert.equal(sha256(bytes),file.sha256);assert.equal(bytes.subarray(0,file.format==='pdf'?5:2).toString(),file.format==='pdf'?'%PDF-':'PK');}
  await piReviewEntry();
  assert.equal(report.rendererErrors.length,0,'Renderer exceptions must remain visible as a failure');
  assert.equal(report.consoleErrors.length,0,'Console errors are preserved and fail acceptance');
  assert.equal(fingerprint(buildRoot).sha256,fixed.sha256,'Build changed during acceptance');
  report.success=true;
} catch(error){report.error=redact(error?.stack||error);process.exitCode=1;}
finally {await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'ui-goal-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,success:report.success,error:report.error}));}
