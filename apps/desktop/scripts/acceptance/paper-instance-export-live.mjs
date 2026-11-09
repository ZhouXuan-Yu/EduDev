/**
 * Pasteur integration (import is inert; no app/model is started):
 *
 * await runPaperInstanceExportJourney({page, dbPath, workspace, output,
 *   sessionId, basketId, otherBasketId, paperId,
 *   argv:process.argv.slice(2), python:process.env.OMNI_EDU_FIXTURE_PYTHON,
 *   // optional: expectations, enterComposer, ensureOutputGrant, inspectImages,
 *   // historyPaperIds, sourceFiles, buildFiles
 * });
 *
 * Parent must launch its own B-capable application and confirm/review the real
 * B fixture FIRST. Explicit --run-ui --live is required. The parent launcher
 * inherits DEEPSEEK_API_KEY from its own process.env, never a private env file.
 * This module checks only presence; no key/config is printed or persisted.
 * No old canonical-20 fixture, DB mutation, IPC send/approve or model stub.
 *
 * Optional standalone ATTACH (does not launch/build):
 * node scripts/acceptance/paper-instance-export-live.mjs --run-ui --live \
 *   --cdp http://127.0.0.1:9222 --fixture EXISTING_B_FIXTURE.json
 * Fixture: {dbPath,workspace,output,sessionId,basketId,otherBasketId,paperId,
 *   python?,expectations?,historyPaperIds?,sourceFiles?,buildFiles?}.
 * Grant the actual output directory through the existing UI before attaching.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {admitPaperEnter} from '../education/paper-ui-admission.mjs';
import {loadPaperOfficeCompiler} from './paper-office-source.mjs';
import {readPartialOffice, showExactOfficeOwner} from './paper-office-partial.mjs';
import {SIX_EXPORTS,assertReviewedSnapshot,captureExportInvariants,assertExportInvariants,collectSavedExportManifest,readBackExportFiles} from './paper-instance-export-readback.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const compact = value => String(value).normalize('NFC').replace(/\s/gu,'');
const math = text => /\\[a-z]+|\$/.test(text);
const hashFiles = files => files.map(file=>({path:path.resolve(file),sha256:sha(fs.readFileSync(file))}));
const coreSourceFiles=['../../src/shared/paper-instance.ts','../../src/shared/paper-basket-v2.ts','../../src/main/education/paper-repository.ts','../../src/main/education/paper-instance-export.ts','../../src/main/education/paper-export.ts','../education/paper-instance-boundaries.mjs','../education/paper-instance-astra-regressions.mjs','../education/paper-instance-options-required.mjs'].map(f=>fileURLToPath(new URL(f,import.meta.url)));
const same = (a,b) => assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
export function assertLiveExportOptIn(argv=process.argv.slice(2)) {
  assert(argv.includes('--run-ui') && argv.includes('--live'),'Actual UI/model work requires explicit --run-ui --live');
  assert(Boolean(process.env.DEEPSEEK_API_KEY),'Parent DEEPSEEK_API_KEY must already exist; no env file is read');
}
async function until(predicate,timeout=30000) {
  const end=Date.now()+timeout;
  while(Date.now()<end) {if(await predicate())return; await new Promise(resolve=>setTimeout(resolve,100));}
  throw Error('B export condition timeout');
}
/** Independent expectation projection from CURRENT instances. Source image or
 * formula-only roles must use explicit caller probes/image comparisons plus
 * visual evidence; abbreviated source scalars are never used as image proof. */
export function expectationsFromEditedSnapshot(paper) {
  const visible = (item,role) => {
    const content=item.instance.content[role];
    if(content.mode==='source') {
      if(item.question.document || item.question.archive?.native) return [];
      const value=item.question[role==='question'?'stem':role]; return value && !math(value)?[value]:[];
    }
    return content.blocks.flatMap(block=>{
      if(block.type==='text')return math(block.text)?[]:[block.text];
      if(block.type==='table')return block.rows.flat().filter(value=>value && !math(value));
      if(['options','subquestions'].includes(block.type))return block.items.filter(i=>!math(i.text)).map(i=>i.label+'. '+i.text);
      return [];
    });
  };
  const items=paper.selection.items;
  const questions=items.flatMap(i=>visible(i,'question'));
  const answers=items.flatMap(i=>visible(i,'answer')),analyses=items.flatMap(i=>visible(i,'analysis'));
  const references=[...answers,...analyses];
  const strong=values=>[...new Set(values.filter(s=>compact(s).length>=4))];
  const privateMarkers=strong(references).filter(s=>!questions.some(q=>compact(q).includes(compact(s))));
  assert(questions.length && privateMarkers.length>=2 && answers.some(s=>privateMarkers.includes(s)) && analyses.some(s=>privateMarkers.includes(s)),'Need distinct current question/answer/analysis text probes; supply explicit expectations for image/math-only roles');
  assert(items.some(i=>i.instance.content.question.mode==='edited') && items.some(i=>i.instance.content.answer.mode==='edited') && items.some(i=>i.instance.content.analysis.mode==='edited'),'B fixture must contain real question, answer AND analysis edits');
  const questionOrder=items.flatMap(i=>[`${i.number}.（${i.points} 分）`,...visible(i,'question')]);
  const teacherOrder=items.flatMap(i=>[`${i.number}.（${i.points} 分）`,...visible(i,'question'),...visible(i,'answer'),...visible(i,'analysis')]);
  const numbers=items.map(i=>`${i.number}.（${i.points} 分）`);
  const labels=items.filter(i=>/选择|单选|多选/.test(i.question.questionType) && i.instance.content.question.mode==='edited').flatMap(i=>i.instance.content.question.blocks.filter(b=>b.type==='options').flatMap(b=>b.items.map(o=>o.label+' □')));
  const old=items.filter(i=>i.instance.content.question.mode==='edited').map(i=>i.question.stem).filter(s=>s && !math(s) && compact(s).length>=8 && !questions.some(q=>compact(q).includes(compact(s))));
  return {
    student:{required:[...numbers,...questions],forbidden:[...privateMarkers,...old],ordered:[questionOrder]},
    teacher:{required:[...numbers,...questions,...references,'尚未独立核验'],forbidden:old,ordered:[teacherOrder]},
    answer_sheet:{required:['姓名：',...numbers,...labels],forbidden:[...strong(questions),...privateMarkers]}
  };
}
/** No retries/resends. Failures preserve real partial deliveries/pending cards
 * and metadata for the parent; this never fabricates a successful acceptance. */
export async function runPaperInstanceExportJourney(options) {
  assertLiveExportOptIn(options.argv);
  assert(options.evidenceProtocol===undefined||options.evidenceProtocol==='c2-v7','Unknown evidence protocol');
  const c2=options.evidenceProtocol==='c2-v7'?await import('./paper-template-office-evidence.mjs'):undefined;
  const verifySnapshot=c2?.assertCurrentC2Snapshot??assertReviewedSnapshot;
  const {page,dbPath,workspace,sessionId,basketId,otherBasketId,paperId,python,inspectImages,historyPaperIds=[]}=options;
  assert(page && dbPath && workspace && sessionId && basketId && otherBasketId && paperId,'Existing real B fixture and Playwright page required');
  const output=path.resolve(options.output); fs.mkdirSync(output,{recursive:true});
  const partial=options.partialFrom?readPartialOffice({from:options.partialFrom,output,pins:options.pins}):undefined;
  const workspaceRelative=path.relative(partial?.root??fs.realpathSync(output),fs.realpathSync(workspace));
  assert(workspaceRelative && workspaceRelative!=='..' && !workspaceRelative.startsWith('..'+path.sep) && !path.isAbsolute(workspaceRelative),'Live exports require a NEW owned workspace inside this run output; never borrow an original fixture directory');
  const reportPath=path.join(output,'pi-office-six.json'); assert(!fs.existsSync(reportPath),'Refusing to overwrite real journey evidence');
  const scriptFiles=[fileURLToPath(import.meta.url),fileURLToPath(new URL('./paper-office-source.mjs',import.meta.url)),fileURLToPath(new URL('../office-agent/register-source.mjs',import.meta.url)),fileURLToPath(new URL('./paper-instance-export-readback.mjs',import.meta.url)),fileURLToPath(new URL('./paper-instance-export-readback.py',import.meta.url)),fileURLToPath(new URL('../education/paper-ui-admission.mjs',import.meta.url))];
  const sourceFiles=[...new Set([...coreSourceFiles,...(options.sourceFiles??[])])];
  const report={success:false,scope:c2?'real-Pi-current-C2-v7-confirmed-layout-six-files':'real-Pi-current-B-snapshot-to-Office-original-UI-six-files',productAcceptance:false,sessionId,basketId,paperId,
    deliveries:[],admissions:[],checks:[],scriptHashes:hashFiles(scriptFiles),sourceHashes:hashFiles(sourceFiles),buildHashes:hashFiles(options.buildFiles??[]),pending:['Actual rendered-file visual inspection is separate from XML/PDF text/image readback.']};
  if(partial){
    report.partialContinuation={original:partial.root,archive:partial.archive,archiveSha256:partial.archiveSha256,
      originalReportSha256:partial.originalReportSha256,abandonedAdmission:partial.abandonedAdmission,
      abandonedDraftId:partial.abandonedDraftId,newSubmissions:2,priorSuccessfulSubmissions:4,totalAttemptsIncludingInterrupted:7};
    report.deliveries=structuredClone(partial.deliveries);report.admissions=structuredClone(partial.admissions);
  }
  report.navigationObservations=[];
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2),{flag:'wx'});
  const persist=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
  const check=name=>{report.checks.push({name,pass:true});persist();options.onCheck?.(name);};
  const sql=(query,args=[])=>{const db=new DatabaseSync(dbPath,{readOnly:true});try {return db.prepare(query).all(...args);}finally {db.close();}};
  const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
  const typedViews=()=>page.evaluate(async v=>{
    const [basket,paper]=await Promise.all([window.omniEdu.readPaperBasketV2({schemaVersion:'xiaozhi.paper-basket.v2',sessionId:v.sessionId,basketId:v.basketId}),window.omniEdu.reviewPaper({schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:v.sessionId,id:v.paperId})]);
    return {basket,paper};
  },{sessionId,basketId,paperId});
  const views=async()=>{const v=await typedViews();assert(v.basket.ok && v.paper.ok,'Current typed B views unavailable');verifySnapshot(v.paper.value,v.basket.value);return {basket:v.basket.value,paper:v.paper.value};};
  const review=draftId=>page.evaluate(async input=>{const r=await window.omniEdu.reviewXiaozhiOffice(input);if(!r.ok)throw Error(r.error);return r.value;},{schemaVersion:'xiaozhi.office-artifact.v1',sessionId,draftId});
  const card=id=>page.locator(`[data-testid="pi-office-artifact"][data-office-id="${id}"]`);
  try {
    // Fail a QA loader incompatibility BEFORE a real provider admission.
    const {assertPaperOffice} = await loadPaperOfficeCompiler();
    const initial=await views(), {paper,basket}=initial;
    if(partial){
      assert.equal(paper.id,partial.fixture.paper.id);assert.equal(paper.digest,partial.fixture.paper.digest);
      same(paper.selection,partial.fixture.paper.selection);same(paper.c2,partial.fixture.paper.c2);
      same(paper.templateSources,partial.fixture.paper.templateSources);same(basket.entries,partial.fixture.basket.entries);
    }
    report.digest=paper.digest; report.basketBinding=paper.basket;
    const expectations=options.expectations??expectationsFromEditedSnapshot(paper);
    // Validate probes and six-way coverage BEFORE any paid send.
    const {validateExportExpectations}=await import('./paper-instance-export-readback.mjs'); validateExportExpectations(expectations);
    const before=captureExportInvariants({dbPath,sessionId,basketId,otherBasketId,paperId,historyPaperIds});
    check('Current confirmed B snapshot and instance reviews match persistent basket before any Pi request');
    const initialSnapshot=await snapshot(); assert(!initialSnapshot.running,'Existing Pi run is active');
    if(options.enterComposer) await options.enterComposer({page,paper,basket});
    else if(!await page.locator('.office-composer-container:visible').count()) {
      const entry=page.getByTestId('paper-export-student-docx'); await entry.waitFor({state:'visible'}); await entry.click();
    }
    if(options.ensureOutputGrant) await options.ensureOutputGrant({page,sessionId,workspace});
    const composer=page.locator('.office-composer-container:visible');
    await until(async()=>await composer.getAttribute('data-session-id')===sessionId);
    const granted=await snapshot(); assert(granted.workspace || granted.paperOutput,'Grant this real output directory through the existing product UI before sending');
    // Read-only safety check BEFORE any paid send/file effect. A copied old
    // owner may still point at the ORIGINAL teacher-workspace. Never rewrite
    // that authorization or silently deliver into the original fixture.
    const bindings=sql('SELECT path FROM xiaozhi_pi_workspaces WHERE conversation_id=?',[sessionId]);
    const hasOutputTable=sql("SELECT name FROM sqlite_master WHERE type='table' AND name='xiaozhi_pi_paper_outputs'").length;
    if(hasOutputTable)bindings.push(...sql('SELECT path FROM xiaozhi_pi_paper_outputs WHERE conversation_id=?',[sessionId]));
    assert(bindings.length,'No actual persisted UI output authorization');
    for(const binding of bindings)assert.equal(fs.realpathSync(binding.path),fs.realpathSync(workspace),'Session is bound to another/original directory; use a fresh real UI session and grant this OWN workspace');
    const prefix=partial?.prefix??'B-'+randomUUID().slice(0,8);
    for(const spec of (partial?SIX_EXPORTS.slice(4):SIX_EXPORTS)) {
      same(await views(),initial); assertExportInvariants(before);
      const name=prefix+'-'+spec.kind+'.'+spec.format,target=path.join(workspace,name);
      assert(!fs.existsSync(target),'Target already exists');
      const factsBefore=sql('SELECT id FROM document_artifacts ORDER BY id');
      const input=composer.getByTestId('office-prompt-input');
      await until(async()=>!await input.isDisabled() && !(await snapshot()).running);
      await input.fill(`请实际调用 education_export_paper，将本会话最新已确认的本卷实例快照 ${paperId} 原样导出，format=${spec.format}，audience=${spec.audience}，template=${spec.template}，path=${name}。沿用已授权保存位置；题目、选项、小问、答案解析必须来自当前已确认快照。只使用 education_export_paper；不要抄题、改题或创建别的文档。等待我的文件审批，拒绝或停止后不要重新提出。`);
      const runId=await admitPaperEnter({input,send:composer.getByRole('button',{name:'发送消息',exact:true}),snapshot,commands:()=>sql('SELECT command_id,run_id,status FROM xiaozhi_pi_commands WHERE conversation_id=?',[sessionId]),until,report,label:name});
      report.active={...spec,runId,path:name};persist();
      let row;
      await until(async()=>{
        const state=await snapshot(), matches=(state.officeArtifacts??[]).filter(a=>a.runId===runId && a.state==='pending');
        assert(matches.length<=1,'Unexpected multiple Office proposals; no approval performed');
        row=matches.find(a=>a.path===name && a.format===spec.format);
        if(row)return true;
        if(matches.length)throw Error('Pi proposed a different target; no approval performed');
        const turn=state.projection.turns.find(t=>t.id===runId);
        if(turn && ['completed','failed','interrupted'].includes(turn.status))throw Error('Pi run ended before expected pending Office draft: '+turn.status);
        return false;
      },options.runTimeoutMs??180000);
      report.active.draftId=row.id;persist();
      const actual=await review(row.id);
      if(c2)c2.assertCurrentC2Draft(paper,actual.draft,spec);
      else same(actual.draft.paperSource,{paperId,digest:paper.digest,audience:spec.audience,...(spec.template==='answer_sheet'?{template:'answer_sheet'}:{})});
      assert.equal(row.sourceCount,1);
      // Source-only host import, never build or runtime/model startup. Exact
      // deterministic compiler comparison catches old canonical/source fallbacks.
      assertPaperOffice(paper,actual.draft);
      assert(!fs.existsSync(target));same(sql('SELECT id FROM document_artifacts ORDER BY id'),factsBefore);
      same(await views(),initial);assertExportInvariants(before);
      await showExactOfficeOwner(page,sessionId,report.navigationObservations);
      const pending=card(row.id);await pending.getByTestId('pi-office-review').waitFor({state:'visible'});
      await pending.scrollIntoViewIfNeeded();
      const figures=actual.draft.sections.flatMap(s=>s.figures??[]);
      if(figures.length)await until(async()=>pending.locator('[data-testid="pi-office-source-image"] img').evaluateAll((imgs,count)=>imgs.length===count && imgs.every(i=>i.complete && i.naturalWidth>0 && i.naturalHeight>0),figures.length));
      const beforeShot=path.join(output,spec.kind+'-'+spec.format+'-pending.png');await pending.screenshot({path:beforeShot});
      let imageReview;
      if(figures.length) {
        assert(typeof inspectImages==='function','Source image delivery requires parent actual image inspection callback; checkbox remains unchecked');
        imageReview=await inspectImages({page,card:pending,review:actual,figures,spec,screenshot:beforeShot});
        assert(imageReview?.reviewed===true && Array.isArray(imageReview.evidence) && imageReview.evidence.length,'Actual inspection evidence required');
        for(const evidence of imageReview.evidence) assert(fs.statSync(evidence).isFile(),'Inspection evidence absent');
        const checkbox=pending.getByTestId('pi-office-images-reviewed');await checkbox.locator('[data-slot="checkbox-content"]').click();
        assert(await checkbox.getByRole('checkbox').isChecked());
      }
      const approve=pending.getByTestId('pi-office-approve');await until(async()=>!await approve.isDisabled());
      const beforeRevision=actual.revision;assert.equal((await review(row.id)).revision,beforeRevision,'Draft revised during inspection');
      await approve.click(); // The ONLY approval operation: the original visible UI.
      report.active.approval={via:'original-ui-click',revision:beforeRevision,pendingScreenshot:beforeShot,...(imageReview?{images:imageReview}:{})};persist();
      let saved;
      await until(async()=>{
        const state=await snapshot();saved=state.officeArtifacts?.find(a=>a.id===row.id);
        if(saved && ['failed','conflict','uncertain','rejected','interrupted'].includes(saved.state))throw Error('Office did not save: '+saved.state);
        return saved?.state==='saved' && !state.running && state.projection.turns.some(t=>t.id===runId && ['completed','failed','interrupted'].includes(t.status));
      },options.runTimeoutMs??180000);
      assert.equal(saved.runId,runId);assert(saved.artifactId && fs.existsSync(target));
      const files=sql('SELECT id FROM document_artifacts ORDER BY id');assert.equal(files.length,factsBefore.length+1,'Unexpected new artifact count');
      for(const fact of factsBefore)assert(files.some(f=>f.id===fact.id),'Prior artifact removed');
      assert(files.some(f=>f.id===saved.artifactId));
      const afterShot=path.join(output,spec.kind+'-'+spec.format+'-saved.png');await card(row.id).screenshot({path:afterShot});
      report.deliveries.push({...spec,path:target,draftId:row.id,runId,artifactId:saved.artifactId,approval:report.active.approval,savedScreenshot:afterShot});
      delete report.active;assertExportInvariants(before);check(spec.kind+'/'+spec.format+': actual composer send, matching run pending draft, original UI approval and actual saved file');
    }
    same(await views(),initial);
    const manifest=(c2?.collectCurrentC2Manifest??collectSavedExportManifest)({dbPath,sessionId,workspace,paper,basket,files:report.deliveries,expectations,before,sourceFiles:[...scriptFiles,...sourceFiles]});
    manifest.uiEvidence={scope:'actual-original-ui',reportPath,deliveries:report.deliveries.map(({draftId,runId,approval,savedScreenshot})=>({draftId,runId,approval,savedScreenshot}))};
    report.fileReadback=await readBackExportFiles({manifest,output:path.join(output,'six-file-readback'),python});
    if(c2)report.layoutReadback=await c2.readCurrentC2Layout({manifest,output,python});
    assert(report.fileReadback.success);assertExportInvariants(before);
    same(hashFiles(sourceFiles),report.sourceHashes);same(hashFiles(options.buildFiles??[]),report.buildHashes);
    check('All six real saved files pass independent XML/PDF text, block order, A4 and teacher/student/answer-sheet isolation; bank, other basket and history unchanged');
    report.success=true;return report;
  } catch(error) {
    // Error metadata only. Never persist a raw provider response, key, process
    // environment, full Pi snapshot, message history or reasoning.
    let message=String(error.message);const secret=process.env.DEEPSEEK_API_KEY;
    if(secret)message=message.split(secret).join('[redacted]');
    report.error=message.replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').slice(0,2000);if(c2){try{const file=path.join(output,'c2-office-export-failure.png');await page.screenshot({path:file});report.failureScreenshot=file;}catch(e){report.failureScreenshotError=String(e.message).slice(0,500);}}throw Error('B Pi Office acceptance failed; evidence: '+reportPath);
  } finally {persist();}
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const argv=process.argv.slice(2);
  if(!argv.includes('--run-ui') && !argv.includes('--live')) {
    console.log('Dry only. Import runPaperInstanceExportJourney into Pasteur, or attach with --run-ui --live --cdp URL --fixture JSON. No app/model action performed.');
  } else {
    assertLiveExportOptIn(argv);
    const value=name=>{const n=argv.indexOf(name);assert(n>=0 && argv[n+1] && !argv[n+1].startsWith('--'),'Missing '+name);return argv[n+1];};
    const url=new URL(value('--cdp'));assert(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'Attach only to the parent local app');
    const fixture=JSON.parse(fs.readFileSync(value('--fixture'),'utf8'));
    const {chromium}=await import('playwright');
    const browser=await chromium.connectOverCDP(url.href);
    let selected;
    for(const context of browser.contexts())for(const page of context.pages())if(await page.evaluate(()=>!!window.omniEdu).catch(()=>false)){assert(!selected,'Multiple product pages; import helper with the intended page instead');selected=page;}
    assert(selected,'Parent product page not found');
    try {const report=await runPaperInstanceExportJourney({...fixture,page:selected,argv});console.log(JSON.stringify({success:report.success,deliveries:report.deliveries.length,productAcceptance:false,output:fixture.output}));}
    finally {await browser.close();} // CDP connection disconnect; no app launch.
  }
}
