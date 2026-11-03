/** Parent-launched C2 Office fixture. All business writes use visible product UI. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprint,sha256} from './evidence.mjs';
import {readPort,until,jsonEqual} from './paper-export-intent-evidence.mjs';
import {openBasket,selectOwnOutput} from './paper-export-intent-ui.mjs';
import {readInstanceBasket,instanceStage} from './paper-instance-ui-driver.mjs';
import {prepareFreshOfficePaperUi} from './paper-instance-office-fixture-ui.mjs';
import {choose} from './paper-basket-ui-driver.mjs';
import {entryCard} from './paper-basket-ui-locators.mjs';
import {productEntry} from '../product-navigation.mjs';
import {makeReferenceFixtures,readReferenceTruth} from './paper-reference-fixtures.mjs';
import {templatePanel,extractCandidate,confirmCandidate,closeCandidate,mapSections,readTemplates,assertMembers,assertDerivedStates,assertDisplayedRole,expand} from './paper-template-ui.mjs';
import {runPaperInstanceExportJourney} from './paper-instance-export-live.mjs';
import {assertCurrentC2Snapshot} from './paper-template-office-evidence.mjs';
export const c2OfficeBudget=Object.freeze({launchesByAdapter:0,modelSubmissions:6,successfulFiles:6,automaticRetries:0,imports:2,templateSaves:2,templateApplications:3});
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export function copyC2OfficeBaseline({output,from='test-results/ui-goal-paper-export-intent-mOHpzM'}){
  assert.equal(from,'test-results/ui-goal-paper-export-intent-mOHpzM');const owned=fs.realpathSync(path.join(desktop,'test-results')),original=fs.realpathSync(path.resolve(desktop,from));assert.equal(path.dirname(original),owned);
  output=fs.realpathSync(output);assert(output.startsWith(owned+path.sep)&&output!==original&&!output.startsWith(original+path.sep));const sourceReport=JSON.parse(fs.readFileSync(path.join(original,'report.json')));assert.equal(sourceReport.success,true);
  const originalBefore=fingerprint(original).sha256;
  for(const name of ['data','profile']){const source=fs.realpathSync(path.join(original,name));assert.equal(path.dirname(source),original);fs.cpSync(source,path.join(output,name),{recursive:true,errorOnExist:true,force:false});assert.equal(fingerprint(path.join(output,name)).sha256,fingerprint(source).sha256);}
  const proof={original,originalBefore,output,data:path.join(output,'data'),profile:path.join(output,'profile'),owner:sourceReport.normal.sessionId,basketId:sourceReport.normal.basketId};
  fs.writeFileSync(path.join(output,'c2-office-baseline.json'),JSON.stringify(proof,null,2),{flag:'wx'});return proof;
}
async function prepare({page,app,data,output,report,check=name=>report.checks.push({name,pass:true})}){
  const proof=JSON.parse(fs.readFileSync(path.join(output,'c2-office-baseline.json')));assert.equal(path.resolve(data),proof.data);assert.equal(fingerprint(proof.original).sha256,proof.originalBefore);assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),proof.data);
  const read=readPort(path.join(data,'app.db')),existingSessionIds=read('SELECT id FROM ai_conversation_sessions ORDER BY id').map(r=>r.id);
  const old=await openBasket(page,proof.owner,proof.basketId);assert(old.entries.length);const question=old.entries[0].question;
  await productEntry(page,'ask').click();
  const fresh=await prepareFreshOfficePaperUi({page,app,data,output,report,question,marker:path.basename(output).slice(-6),check,existingSessionIds,prepareCreatedBasketUi:prepareFormalBasketUi});
  const target={sessionId:fresh.sessionId,basketId:fresh.basketId},get=()=>readInstanceBasket(page,target.sessionId,target.basketId);let basket=await get();const originalEntries=structuredClone(basket.entries);assertFormalC2Purpose(basket);
  const stored=()=>JSON.parse(read('SELECT data_json FROM paper_baskets WHERE id=? AND session_id=?',[target.basketId,target.sessionId])[0].data_json);
  const receipts=()=>read('SELECT * FROM paper_template_receipts ORDER BY session_id,request_id');
  const inputs=path.join(output,'c2-office-inputs');fs.mkdirSync(inputs);const fixtures=await makeCurrentC2OfficeInputs(question),truth=readReferenceTruth(fixtures,{python:process.env.OMNI_EDU_FIXTURE_PYTHON??'python'});
  fs.writeFileSync(path.join(inputs,'independent-input-truth.json'),JSON.stringify(truth,null,2),{flag:'wx'});
  const files=fixtures.map(f=>({path:path.join(inputs,f.fileName),bytes:f.bytes}));for(const f of files)fs.writeFileSync(f.path,f.bytes,{flag:'wx'});
  await page.getByTestId('paper-basket-materials').click();const resources=[];
  for(const f of files){const digest=sha256(f.bytes);assert.equal(read('SELECT id FROM teacher_resources WHERE content_hash=?',[digest]).length,0);
    await app.evaluate(({dialog},file)=>{if(globalThis.__c2OfficePicker)throw Error('Chooser occupied');const s={original:dialog.showOpenDialog,calls:0};globalThis.__c2OfficePicker=s;dialog.showOpenDialog=async function(...args){const o=args.at(-1);if(o?.title!=='选择教学资料'||!o.properties?.includes('openFile'))return s.original.apply(this,args);assertOne();return {canceled:false,filePaths:[file]};};function assertOne(){if(s.calls++)throw Error('Repeated import chooser');dialog.showOpenDialog=s.original;}},f.path);
    try{await page.getByTestId('materials-import').click();await until(async()=>await app.evaluate(()=>globalThis.__c2OfficePicker.calls===1),'One real material chooser');await until(async()=>!await page.getByTestId('materials-import').isDisabled(),'Import UI settled');}finally{await app.evaluate(({dialog})=>{dialog.showOpenDialog=globalThis.__c2OfficePicker.original;delete globalThis.__c2OfficePicker;});}
    let resource;await until(()=>{[resource]=read('SELECT * FROM teacher_resources WHERE content_hash=?',[digest]);return !!resource&&['ready','parsed','chunked','indexed','graph_extracted'].includes(resource.parse_status);},'Real parser ready',90000);await until(()=>{const jobs=read('SELECT status FROM material_question_jobs WHERE resource_id=?',[resource.id]);return jobs.length===1&&jobs[0].status==='complete';},'Real material archive settled',90000);resources.push(resource);
  }
  await openBasket(page,target.sessionId,target.basketId);const saved={};
  for(const [i,kind]of [[0,'structure'],[1,'layout']]){
    basket=await get();const storedBefore=stored(),oldReceipts=receipts();const candidate=await extractCandidate(page,resources[i],target,basket.revision);
    if(kind==='structure'){assert.equal(candidate.sections.length,1,'Real TXT must extract one section');assert.equal(candidate.sections[0].count.value,'1');assert.equal(candidate.sections[0].points.value,'100');}
    if(kind==='layout'){await choose(page,page.getByTestId('paper-reference-input-layout.orientation'),'portrait');candidate.layout.orientation.teacherValue='portrait';candidate.layout.orientation.confirmed=false;assert.equal(candidate.layout.columns.value,'2','Native DOCX must supply actual two-column evidence');}
    await confirmCandidate(page,candidate,kind);const p=await templatePanel(page),name='C2 Office '+kind+' '+path.basename(output);await p.getByTestId('paper-template-name').fill(name);const before=read('SELECT * FROM paper_template_versions ORDER BY template_id,version');await p.getByTestId('paper-template-save-'+kind).click();await until(()=>read('SELECT template_id FROM paper_template_versions').length===before.length+1,'One actual template saved');await until(async()=>!await p.getByTestId('paper-template-refresh').isDisabled(),'Saved version readback');const versions=await readTemplates(page,target);saved[kind]=versions.find(v=>v.name===name);assert(saved[kind]);jsonEqual(stored(),storedBefore,'Saving templates never mutates persisted basket');jsonEqual((await get()).entries,basket.entries);assert.equal(receipts().length,oldReceipts.length+1,'One save receipt');await closeCandidate(page);
  }
  for(const kind of ['structure','layout','both']){
    const before=await get(),rawBefore=stored(),oldReceipts=receipts(),p=await templatePanel(page);if(kind!=='layout')await mapSections(page,saved.structure,before,kind==='structure'?'new':'existing');if(kind!=='structure')await choose(page,p.getByTestId('paper-template-layout'),saved.layout.templateId+':'+saved.layout.version);await p.getByTestId('paper-template-apply-'+kind).click();await until(async()=>{basket=await get();return basket.revision===before.revision+1;},'Exactly one '+kind+' application');await until(async()=>!await p.getByTestId('paper-template-refresh').isDisabled(),'Apply UI settled');assertMembers(before,basket);await assertDerivedStates(before,basket);jsonEqual(stored().entries,rawBefore.entries,'Full original SQL entries preserved by apply');assert.equal(receipts().length,oldReceipts.length+1,'Exactly one apply receipt');const receipt=receipts().find(r=>!oldReceipts.some(o=>o.session_id===r.session_id&&o.request_id===r.request_id));assert.equal(JSON.parse(receipt.result_json).basketRevision,basket.revision);(report.observedReceipts??=[]).push({kind,receipt:JSON.parse(receipt.result_json)});const ref=v=>({templateId:v.templateId,version:v.version,digest:v.digest});if(kind==='layout'){jsonEqual(basket.blueprint,before.blueprint);jsonEqual(basket.c2.structureTemplate,before.c2.structureTemplate);}else jsonEqual(basket.c2.structureTemplate,ref(saved.structure));if(kind==='structure'){jsonEqual(basket.c2.layout,before.c2?.layout);jsonEqual(basket.c2.layoutTemplate,before.c2?.layoutTemplate);}else{jsonEqual(basket.c2.layoutTemplate,ref(saved.layout));jsonEqual(basket.c2.layout,saved.layout.layout);}
  }
  const ctx={page,app,data,output,report};await instanceStage(ctx,target.sessionId,target.basketId,'organize');basket=await get();assert.equal(basket.entries.length,1);const entryId=basket.entries[0].entryId,section=basket.blueprint.sections[0],beforeMove=basket;
  await choose(page,entryCard(page,entryId).getByTestId('paper-basket-move'),section.id);await until(async()=>{basket=await get();return basket.revision===beforeMove.revision+1;},'Teacher explicitly moves retained member');assert.equal(basket.entries[0].sectionId,section.id);assert.equal(basket.c2.entryPoints[entryId],100);jsonEqual(basket.entries.map(e=>({...e,sectionId:beforeMove.entries[0].sectionId,availability:beforeMove.entries[0].availability})),beforeMove.entries,'Explicit movement changes section and derived availability only');
  for(const r of basket.c2.retainedSections.filter(r=>!r.released)){assert.equal(r.entryIds.length,0);const rev=(await get()).revision;await page.getByTestId('paper-template-retained-section').filter({hasText:r.section.label}).getByTestId('paper-template-release-empty').click();await until(async()=>(await get()).revision===rev+1,'Explicit empty retained release');}
  const card=entryCard(page,entryId);if(!await card.getByTestId('paper-instance-form').count())await card.getByTestId('paper-instance-open').click();if(await card.getByTestId('paper-instance-edit-question').count())await card.getByTestId('paper-instance-edit-question').click();const text=card.getByTestId('paper-instance-role-question').getByTestId('paper-instance-text').first();await text.fill((await text.inputValue())+'\nC2确认题面 '+path.basename(output));let rev=(await get()).revision;await card.getByTestId('paper-instance-save').click();await until(async()=>(await get()).revision===rev+1,'Real C2 edit saved');rev=(await get()).revision;await card.getByTestId('paper-instance-confirm').click();await until(async()=>(await get()).revision===rev+1,'Real exact instance review');basket=await get();assert(basket.complete&&basket.entries.every(e=>e.reviewCurrent));
  await instanceStage(ctx,target.sessionId,target.basketId,'preview');await page.getByTestId('paper-basket-teacher').click();const preview=page.getByTestId('paper-basket-preview-entry').and(page.locator(`[data-entry-id="${entryId}"]`));await assertDisplayedRole(preview.getByTestId('paper-basket-question-stem'),basket.entries[0],'question');await expand(preview.getByTestId('paper-basket-answer'),'本卷参考答案与解析');for(const role of ['answer','analysis'])await assertDisplayedRole(preview.getByTestId('paper-instance-'+role+'-view'),basket.entries[0],role);await preview.screenshot({path:path.join(output,'c2-reviewed-teacher-preview.png')});await page.getByTestId('paper-basket-snapshot').click();await page.getByTestId('paper-basket-confirm').click();await page.getByTestId('paper-export-entry').waitFor();
  const list=await page.evaluate(()=>window.omniEdu.listPapers());assert(list.ok);const candidates=list.value.filter(p=>p.sessionId===target.sessionId&&p.state==='confirmed'&&p.id!==fresh.paperId);assert.equal(candidates.length,1);const result=await page.evaluate(i=>window.omniEdu.reviewPaper(i),{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:target.sessionId,id:candidates[0].id});assert(result.ok);const paper=result.value;basket=await get();assertFormalC2Purpose(basket,paper);assertCurrentC2Snapshot(paper,basket);
  for(const source of paper.templateSources){const row=read('SELECT data_json FROM paper_template_versions WHERE template_id=? AND version=?',[source.template.templateId,source.template.version])[0];const v=JSON.parse(row.data_json);jsonEqual(source.source,v.candidate.source);assert.equal(source.candidateDigest,v.candidateDigest);}
  assert.equal(fingerprint(proof.original).sha256,proof.originalBefore);check('Actual TXT/DOCX templates, independent/both apply, explicit retained movement/release, edited instance review and confirmed C2 snapshot');
  const fixture={dbPath:path.join(data,'app.db'),sessionId:target.sessionId,basketId:target.basketId,otherBasketId:fresh.otherBasketId,paperId:paper.id,paper,basket,historyPaperIds:[fresh.paperId],importedResources:resources.map(r=>({id:r.id,path:r.local_path,sha256:r.content_hash})),baselineProof:proof,originalEntryIds:originalEntries.map(e=>e.entryId)};fs.writeFileSync(path.join(output,'current-c2-office-fixture.json'),JSON.stringify(fixture,null,2),{flag:'wx'});return fixture;
}
export async function runCurrentC2OfficeUi(options){
  assert(options.app,'Parent actual Electron handle required for native output chooser');assertC2OfficePins(options.pins);assert.equal(fs.realpathSync(options.output),options.baselineProof.output);assert.equal(path.resolve(options.dbPath),path.join(options.baselineProof.data,'app.db'));const matrixGate=readC2OfficeMatrixGate(options.matrixReportPath,options.pins);fs.writeFileSync(path.join(options.output,'c2-matrix-gate.json'),JSON.stringify(matrixGate,null,2),{flag:'wx'});
  const result=await runPaperInstanceExportJourney({...options,evidenceProtocol:'c2-v7',ensureOutputGrant:undefined,sourceFiles:[...(options.sourceFiles??[]),...['paper-template-office-ui.mjs','paper-template-office-evidence.mjs','paper-template-office-layout.py','paper-instance-ui-driver.mjs','paper-instance-office-fixture-ui.mjs','paper-template-ui.mjs','paper-reference-fixtures.mjs','../xiaozhi-agent/paper-layout-pdf-readback.py'].map(f=>fileURLToPath(new URL(f,import.meta.url)))],enterComposer:async({page})=>{await selectOwnOutput(options.app,page,readPort(options.dbPath),options.sessionId,options.workspace);await page.getByTestId('paper-export-student-docx').click();}});
  assert(result.success&&result.deliveries.length===6&&result.admissions.length===6);assert.equal(fingerprint(options.baselineProof.original).sha256,options.baselineProof.originalBefore);assertC2OfficePins(options.pins);return result;
}

export async function prepareCurrentC2PaperUi(options){
  const {page,output,report}=options;assert(report&&Array.isArray(report.checks));assertC2OfficePins(options.pins);
  try{const value=await prepare(options);assertC2OfficePins(options.pins);return value;}catch(error){
    report.error={phase:'prepare-current-C2-Office',name:error.name,message:String(error.message).slice(0,2500)};
    try{const read=readPort(path.join(options.data,'app.db'));report.observedReceiptsOnFailure=read('SELECT session_id,request_id,result_json FROM paper_template_receipts ORDER BY session_id,request_id');}catch(e){report.receiptObservationError=String(e.message);}
    try{const file=path.join(output,'c2-office-prepare-failure.png');await page.screenshot({path:file});(report.screens??=[]).push({file,kind:'failure'});}catch(e){report.failureScreenshotError=String(e.message);}
    fs.writeFileSync(path.join(output,'c2-office-prepare-failure.json'),JSON.stringify(report,null,2),{flag:'wx'});throw error;
  }
}

export const c2OfficeContractFiles=Object.freeze(['src/shared/paper-purpose.ts','src/shared/paper-fulfillment.ts','src/shared/paper-basket-v2.ts','src/shared/paper-blueprint.ts','src/shared/paper-export.ts','src/renderer/components/paper-ui/PaperPurposeControls.tsx','src/renderer/components/paper-ui/PaperBasketWorkspace.tsx','src/renderer/components/paper-ui/PaperBasketBlueprintForm.tsx','src/shared/paper-basket-c2.ts','src/shared/paper-template.ts','src/shared/paper-instance.ts','src/shared/paper-layout.ts','src/shared/xiaozhi-office-draft.ts','src/main/education/paper-instance-export.ts','src/renderer/components/paper-ui/PaperTemplatePanel.tsx','src/renderer/components/paper-ui/PaperTemplateRetained.tsx','src/renderer/components/paper-ui/PaperInstanceEditor.tsx','src/renderer/components/paper-ui/PaperBasketPreview.tsx','src/renderer/components/PaperExportEntry.tsx']);
export const c2OfficeContractHash=()=>sha256(JSON.stringify(c2OfficeContractFiles.map(file=>({file,sha256:sha256(fs.readFileSync(path.join(desktop,file)))}))));
export function assertC2OfficePins(pins){
  assert(pins,'Parent frozen build/source/contract pins required before UI work');for(const name of ['build','source','contract'])assert.match(pins[name]??'',/^[a-f0-9]{64}$/);
  assert.equal(fingerprint(pins.buildRoot).sha256,pins.build);assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.equal(c2OfficeContractHash(),pins.contract);
}
/** LAST only: owned source byte fault, restored even on refusal/assertion failure.
 * No model request, SQL write or API submission. This cannot replace six exports. */
export async function assertCurrentC2SourceRefusalUi({page,app,data,output,fixture,exportReport,pins}){
  assertC2OfficePins(pins);assert(exportReport.success&&exportReport.deliveries.length===6);
  const source=fixture.importedResources[0],root=fs.realpathSync(path.join(data,'teacher_resources')),file=fs.realpathSync(source.path);assert.equal(path.dirname(file),root);const bytes=fs.readFileSync(file);assert.equal(sha256(bytes),source.sha256);
  const read=readPort(fixture.dbPath),facts=()=>({commands:read('SELECT * FROM xiaozhi_pi_commands ORDER BY command_id'),drafts:read('SELECT * FROM xiaozhi_pi_office_drafts ORDER BY id'),artifacts:read('SELECT * FROM document_artifacts ORDER BY id'),receipts:read('SELECT * FROM paper_template_receipts ORDER BY session_id,request_id'),baskets:read('SELECT id,revision,data_json FROM paper_baskets ORDER BY id').map(r=>{const d=JSON.parse(r.data_json);delete d.uiState;return {id:r.id,revision:r.revision,data:d};})});const before=facts(),hashes=exportReport.deliveries.map(f=>sha256(fs.readFileSync(f.path)));
  const result={success:false,modelSubmissions:0,scope:'owned template source changed after six actual exports'};
  try{
    fs.appendFileSync(file,'\nOWN C2 Office source freshness refusal\n');await openBasket(page,fixture.sessionId,fixture.basketId);await instanceStage({page,app,data,output},fixture.sessionId,fixture.basketId,'preview');
    const reviewed=await page.evaluate(i=>window.omniEdu.reviewPaper(i),{schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:fixture.sessionId,id:fixture.paperId});assert(reviewed.ok);assert.equal(reviewed.value.sourceCurrent,false);assert.equal(await page.getByTestId('paper-export-entry').count(),0,'Stale template source has no formal export entry');jsonEqual(facts(),before);jsonEqual(exportReport.deliveries.map(f=>sha256(fs.readFileSync(f.path))),hashes);await page.screenshot({path:path.join(output,'c2-source-changed-refusal.png')});result.success=true;
  }catch(error){result.error=String(error.message);try{await page.screenshot({path:path.join(output,'c2-source-refusal-failure.png')});result.failureScreenshot='c2-source-refusal-failure.png';}catch(e){result.failureScreenshotError=String(e.message);}throw error;
  }finally{fs.writeFileSync(file,bytes);assert.equal(sha256(fs.readFileSync(file)),source.sha256);fs.writeFileSync(path.join(output,'c2-source-refusal.json'),JSON.stringify(result,null,2),{flag:'wx'});assert.equal(fingerprint(fixture.baselineProof.original).sha256,fixture.baselineProof.originalBefore);assertC2OfficePins(pins);}
  return result;
}

export async function makeCurrentC2OfficeInputs(question){
  assert(!/[\r\n]/.test(question.subject+question.grade+question.questionType),'Single-line fixture metadata');
  const txt=Buffer.from(`试卷名称：C2正式输出结构\n学科：${question.subject}\n年级：${question.grade}\n考试时间：45分钟\n满分：100分\n一、${question.questionType}（共1题，每题100分）\n1. 实际结构参考：计算2+3。\nA. 4\nB. 5\n答案：B\n解析：2+3=5。\n`);
  const structure={key:'C2-STRUCTURE',format:'txt',fileName:'structure.txt',bytes:txt,expected:{title:'C2正式输出结构',subject:question.subject,grade:question.grade,durationMinutes:45,totalPoints:100,sections:[{label:question.questionType,count:1,points:100}],questionNumbers:[1],layout:null,difficulty:null,knowledgePoint:null}};
  return [structure,(await makeReferenceFixtures())[1]];
}

export function assertFormalC2Purpose(basket,paper){
  assert.equal(basket.purpose,'paper','Explicit real formal-paper purpose required');assert.equal(basket.paperRequirements,'provided','Teacher must explicitly save examination requirements');
  assert(!basket.fulfillment||!['confirmed','fulfilled'].includes(basket.fulfillment.status),'This narrow manually arranged C2 fixture does not exercise a fulfillment plan');
  if(paper)assert.equal(paper.purpose,'paper','Formal purpose must reach the confirmed snapshot');
}
async function prepareFormalBasketUi({page,owner,basketId}){
  const before=await readInstanceBasket(page,owner,basketId);assert.equal(before.entries.length,0,'Formal setup must precede selecting members');
  if(before.purpose!=='paper'){
    assert.equal(before.purpose,'practice','No inferred legacy purpose for the newly created basket');await choose(page,page.getByTestId('paper-basket-purpose'),'paper');
    await until(async()=>{const b=await readInstanceBasket(page,owner,basketId);return b.purpose==='paper'&&b.revision===before.revision+1;},'Real purpose switch committed exactly once');
    const after=await readInstanceBasket(page,owner,basketId);jsonEqual(after.entries,before.entries);jsonEqual(after.blueprint,before.blueprint);jsonEqual(after.c2,before.c2);assert.equal(after.paperRequirements,'required','Switching host-default practice must still require explicit exam save');
  }
  await until(async()=>!await page.getByTestId('paper-basket-purpose').isDisabled(),'Formal fields and purpose operation settled');
}

export function validateC2OfficeMatrixGate(matrix,pins){
  assert.equal(matrix.scenario,'A28-C2b-real-template-UI');assert.equal(matrix.success,true,'Full C2b matrix must succeed before any paid C2 Office submission');assert.equal(matrix.integrityVerified,true);
  for(const field of ['error','integrityError','receiptObservationError'])assert(!matrix[field],'Matrix has '+field);
  assert.deepEqual(matrix.errors,[]);assert.deepEqual(matrix.networkAttempts,[]);assert.equal(matrix.launches.length,2);
  assert(matrix.checks.length>0&&matrix.checks.every(c=>c.pass===true&&!c.skipped));
  for(const [kind,count]of [['save',6],['apply',3],['arrange',2]])assert.equal(matrix.operations.filter(o=>o.kind===kind).length,count,'Matrix '+kind+' budget');
  assert(matrix.checks.some(c=>c.name.includes('Cold startup')));assert(matrix.checks.some(c=>c.name.includes('source-byte change')));
  assert.equal(matrix.pins.source,pins.source,'Historical source matrix cannot pass the current gate');assert.equal(matrix.pins.build,pins.build,'Historical build matrix cannot pass the current gate');
}
export function readC2OfficeMatrixGate(file,pins){
  assert(file,'Parent current full C2b report.json path is required before six paid submissions');const absolute=fs.realpathSync(file),owned=fs.realpathSync(path.join(desktop,'test-results'));assert(absolute.startsWith(owned+path.sep));
  const bytes=fs.readFileSync(absolute),matrix=JSON.parse(bytes);validateC2OfficeMatrixGate(matrix,pins);
  for(const [name,digest]of Object.entries(matrix.qaBefore)){assert.equal(sha256(fs.readFileSync(path.join(desktop,name))),digest,'Matrix QA source changed: '+name);}
  assert(Object.keys(matrix.qaBefore).length>=10);return {file:absolute,sha256:sha256(bytes),success:true,scenario:matrix.scenario,pins:matrix.pins};
}
export const c2OfficeDeliveryFiles=Object.freeze(['scripts/ui-final-resume-c2-office.mjs','scripts/acceptance/paper-template-office-ui.mjs','scripts/acceptance/paper-template-office-evidence.mjs','scripts/acceptance/paper-template-office-layout.py','scripts/acceptance/paper-template-office-check.mjs','scripts/acceptance/paper-instance-export-live.mjs','scripts/acceptance/paper-instance-export-readback.mjs','scripts/acceptance/paper-instance-ui-driver.mjs','scripts/acceptance/paper-instance-office-fixture-ui.mjs']);
export function c2OfficeDeliveryManifest(){
  const files=c2OfficeDeliveryFiles.map(file=>({file,sha256:sha256(fs.readFileSync(path.join(desktop,file)))}));return {scope:'QA code freeze only; actual UI/Pi acceptance NOT_RUN',files,qaBundleSha256:sha256(JSON.stringify(files)),contractHash:c2OfficeContractHash(),budget:c2OfficeBudget,predecessor:{launches:2,modelSubmissions:0,imports:2,templateSaves:6,templateApplications:3,arrangements:2},parentOfficeLaunches:1,combinedLaunchBudget:3,automaticRetries:0};
}
