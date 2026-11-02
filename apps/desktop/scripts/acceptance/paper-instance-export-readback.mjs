/**
 * Offline U4-B evidence helpers. Import from Pasteur's live script AFTER its real
 * UI approval/save. This module never starts Electron, sends Pi, proposes or
 * approves an Office draft, writes the app DB, or changes a product API.
 *
 * const before = captureExportInvariants({dbPath, sessionId, basketId, otherBasketId, paperId});
 * // Existing product UI approves six real pending drafts and waits for saved.
 * const manifest = collectSavedExportManifest({dbPath, sessionId, workspace, paper, basket,
 *   files: [{kind:'student',format:'docx',draftId}, ...], expectations: {
 *     student:{required:['current stem'],forbidden:['private answer'],ordered:[['before','table','after']]},
 *     teacher:{required:['current stem','private answer','private analysis','尚未独立核验']},
 *     answer_sheet:{required:['甲 □'],forbidden:['current stem','private answer','private analysis']}
 *   }, before});
 * const report = await readBackExportFiles({manifest, output, python});
 *
 * Expectations are teacher/fixture assertions from the edited instance, NOT
 * compiler-generated expected text. Use distinctive answer/analysis markers;
 * single-letter answers cannot prove isolation by substring search. Image and
 * formula appearance still require the parent's actual visual review.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

export const SIX_EXPORTS = Object.freeze(['student','teacher','answer_sheet'].flatMap(kind =>
  ['docx','pdf'].map(format => Object.freeze({kind, format, audience:kind==='teacher'?'teacher':'student', template:kind==='answer_sheet'?'answer_sheet':'paper'}))));
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));
const equal = (a,b,label) => assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),label);
const compact = value => String(value).normalize('NFC').replace(/\s/gu,'');
const key = x => x.kind+'.'+x.format;
const fileHash = file => sha(fs.readFileSync(file));
function readDb(dbPath, work) {
  assert(fs.statSync(dbPath).isFile(),'Existing app DB required');
  const db = new DatabaseSync(dbPath,{readOnly:true});
  try { db.exec('PRAGMA query_only=ON; BEGIN'); return work(db); }
  finally { db.close(); }
}
function one(db,sql,args,label) {
  const rows = db.prepare(sql).all(...args);
  assert.equal(rows.length,1,label); return rows[0];
}
function inside(root,file) {
  const base=fs.realpathSync(root), target=fs.realpathSync(file), rel=path.relative(base,target);
  assert(rel && rel!=='..' && !rel.startsWith('..'+path.sep) && !path.isAbsolute(rel),'Output escapes workspace');
  assert(fs.statSync(target).isFile(),'Output must be a regular file'); return target;
}
/** Snapshot real full bank rows, both baskets, current and requested historical
 * paper facts. All reads use one SQLite read transaction; this never migrates. */
export function captureExportInvariants({dbPath,sessionId,basketId,otherBasketId,paperId,historyPaperIds=[]}) {
  assert(basketId && otherBasketId && basketId!==otherBasketId,'A distinct real comparison basket is required');
  const scope={dbPath:path.resolve(dbPath),sessionId,basketId,otherBasketId,paperId,historyPaperIds:[...historyPaperIds]};
  return readDb(dbPath,db=>{
    const bank=db.prepare('SELECT * FROM question_bank_items ORDER BY id').all();
    assert(bank.length,'Empty bank cannot prove original-bank isolation');
    const basket=one(db,'SELECT * FROM paper_baskets WHERE id=? AND session_id=?',[basketId,sessionId],'Target basket absent');
    const other=one(db,'SELECT * FROM paper_baskets WHERE id=? AND session_id=?',[otherBasketId,sessionId],'Comparison basket absent');
    const papers=[paperId,...historyPaperIds].map(id=>one(db,'SELECT * FROM ai_confirmation_items WHERE id=? AND session_id=?',[id,sessionId],'Paper fact absent'));
    return {schemaVersion:'u4b.export-invariants.v1',scope,bank:{count:bank.length,sha256:digest(bank)},basket:{id:basketId,sha256:digest(basket)},otherBasket:{id:otherBasketId,sha256:digest(other)},papers:papers.map(p=>({id:p.id,sha256:digest(p)}))};
  });
}
export function assertExportInvariants(before) {
  const after=captureExportInvariants(before.scope);
  equal(after,before,'Bank, baskets or immutable paper facts changed during export'); return after;
}
export function assertSixExportMatrix(files) {
  assert(Array.isArray(files) && files.length===6,'Exactly six actual outputs required');
  equal(files.map(key).sort(),SIX_EXPORTS.map(key).sort(),'Missing/duplicate output kind or format');
  for(const field of ['draftId','path']) if(files.some(f=>f[field]!==undefined)) {
    assert(files.every(f=>typeof f[field]==='string' && f[field]),'Missing '+field);
    assert.equal(new Set(files.map(f=>field==='path'?path.resolve(f[field]).toLowerCase():f[field])).size,6,'Repeated '+field);
  }
}
/** Re-read typed views just before collecting. Persisted review records and
 * exact content/bindings are compared; a renderer-provided boolean alone fails. */
export function assertReviewedSnapshot(paper,basket) {
  assert.equal(basket.schemaVersion,'xiaozhi.paper-basket.v2');
  assert.equal(basket.persistedSchemaVersion,'xiaozhi.paper-basket.v2');
  assert.equal(paper.state,'confirmed'); assert(paper.complete && paper.sourceCurrent && paper.exportCurrent===true);
  assert.equal(paper.answerVerified,false); assert.match(paper.digest,/^[a-f0-9]{64}$/);
  assert.equal(paper.basket?.basketId,basket.id); assert.equal(paper.basket?.basketRevision,basket.revision);
  equal(paper.basket.entryIds,paper.selection.items.map(i=>i.entryId),'Snapshot entry order');
  assert.equal(basket.entries.length,paper.selection.items.length);
  assert(paper.selection.items.length>0,'Empty paper');
  for(const item of paper.selection.items) {
    const entry=basket.entries.find(e=>e.entryId===item.entryId), i=item.instance;
    assert(entry && i && entry.reviewCurrent===true && !entry.deliveryBlock,'Missing reviewed/deliverable instance');
    equal(entry.instance,i,'Basket/snapshot instance differs'); equal(entry.question,item.question,'Pinned parent differs');
    assert.equal(i.review?.action,'confirm'); assert.equal(i.review.instanceRevision,i.instanceRevision);
    assert.equal(i.review.contentDigest,i.contentDigest); equal(i.review.sourceBinding,i.sourceBinding,'Review binding differs');
    assert.equal(i.entryId,item.entryId); assert.equal(i.sourceBinding.questionId,item.source.questionId);
    assert.equal(i.sourceBinding.sourceVersion,item.source.version);
  }
}
export function validateExportExpectations(expectations) {
  for(const kind of ['student','teacher','answer_sheet']) {
    const e=expectations[kind]; assert(e && Array.isArray(e.required) && e.required.length,'Required markers missing: '+kind);
    assert(Object.keys(e).every(k=>['required','forbidden','ordered','images','forbiddenImages'].includes(k)),'Unexpected expectation field');
    for(const name of ['required','forbidden','ordered','images','forbiddenImages']) if(e[name]!==undefined) assert(Array.isArray(e[name]),name+' must be an array');
    for(const marker of e.required) assert(typeof marker==='string' && compact(marker).length>=1,'Empty required marker');
    for(const marker of e.forbidden??[]) assert(typeof marker==='string' && compact(marker).length>=2,'Use distinctive forbidden markers');
    for(const sequence of e.ordered??[]) assert(Array.isArray(sequence) && sequence.length>=2 && sequence.every(m=>typeof m==='string' && compact(m)),'Bad ordered sequence');
  }
  const privateMarkers=expectations.teacher.required.filter(m=>(expectations.student.forbidden??[]).includes(m) && (expectations.answer_sheet.forbidden??[]).includes(m));
  assert(privateMarkers.length>=2,'Require separate teacher answer AND analysis isolation markers in both student outputs');
  assert(expectations.student.required.some(m=>expectations.teacher.required.includes(m) && (expectations.answer_sheet.forbidden??[]).includes(m)),'Stem must appear in both papers and be absent from answer sheet');
  assert((expectations.student.ordered??[]).length && (expectations.teacher.ordered??[]).length,'Both papers require mixed-content order probes');
}
/** Construct a manifest only from saved real Office facts and on-disk bytes.
 * UI approval is deliberately not inferred from state='saved'. Parent records
 * its independent UI interaction evidence separately. */
export function collectSavedExportManifest({dbPath,sessionId,workspace,paper,basket,files,expectations,before,sourceFiles=[]}) {
  assertReviewedSnapshot(paper,basket); assertSixExportMatrix(files); validateExportExpectations(expectations);
  assert(before,'Pre-export invariant snapshot is mandatory');
  equal(before.scope,{dbPath:path.resolve(dbPath),sessionId,basketId:basket.id,otherBasketId:before.scope.otherBasketId,paperId:paper.id,historyPaperIds:before.scope.historyPaperIds},'Invariant scope differs');
  const after=assertExportInvariants(before);
  const outputs=readSavedExportFacts({dbPath,sessionId,workspace,paper,files}).map(file=>({...file,...expectations[file.kind]}));
  assertSixExportMatrix(outputs);
  return {schemaVersion:'u4b.paper-instance-export-readback.v1',scope:'real-saved-artifacts-independent-readback',productAcceptance:false,
    workspace:fs.realpathSync(workspace),paper:{id:paper.id,digest:paper.digest,basket:paper.basket},files:outputs,invariants:{before,after},
    sourceHashes:sourceFiles.map(file=>({path:path.resolve(file),sha256:fileHash(file)})),
    pending:['Parent must attach actual original-UI approval evidence; saved SQLite rows alone do not prove UI approval.',
      'Parent must inspect rendered pages/formulas/figures and confirm answer isolation inside images; text probes cannot prove image semantics.']};
}
/** Per-file actual saved-byte/SQLite provenance check. A partial list is useful
 * for host evidence but can never satisfy collectSavedExportManifest's SIX gate. */
export function readSavedExportFacts({dbPath,sessionId,workspace,paper,files}) {
  return readDb(dbPath,db=>files.map(file=>{
    const spec=SIX_EXPORTS.find(s=>key(s)===key(file));
    assert(spec,'Unknown saved file kind/format');
    const d=one(db,'SELECT * FROM xiaozhi_pi_office_drafts WHERE id=? AND conversation_id=?',[file.draftId,sessionId],'Saved draft absent');
    assert.equal(d.state,'saved'); assert.equal(d.format,file.format); assert(d.artifact_id && d.result_path);
    const draft=JSON.parse(d.draft_json), source=draft.paperSource;
    equal(source,{paperId:paper.id,digest:paper.digest,audience:spec.audience,...(spec.template==='answer_sheet'?{template:spec.template}:{})},'Draft paper source mismatch');
    assert.equal(sha(d.draft_json),d.draft_hash,'Draft hash mismatch');
    if(draft.sections.some(s=>s.figures?.length)) assert.equal(d.image_review_hash,d.draft_hash,'Actual image review missing/stale');
    const lineage=one(db,'SELECT * FROM document_artifact_paper_sources WHERE artifact_id=? AND draft_id=?',[d.artifact_id,d.id],'Real paper lineage absent');
    assert.equal(lineage.paper_id,paper.id); assert.equal(lineage.paper_digest,paper.digest); assert.equal(lineage.audience,spec.audience);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM document_artifact_sources WHERE artifact_id=?').get(d.artifact_id).n,0,'Paper falsely labelled as generic/AI source');
    const artifact=one(db,'SELECT * FROM document_artifacts WHERE id=? AND session_id=?',[d.artifact_id,sessionId],'Real artifact fact absent');
    const target=inside(workspace,d.result_path); assert.equal(target,inside(workspace,path.resolve(workspace,d.relative_path)),'Draft target differs');
    if(file.path) assert.equal(inside(workspace,file.path),target);
    assert.equal(inside(workspace,artifact.file_path),target,'Artifact target differs');
    assert.equal(path.extname(target).toLowerCase(),'.'+file.format);
    const bytes=fs.readFileSync(target), hash=sha(bytes);
    assert.equal(hash,d.output_hash); assert.equal(hash,artifact.content_hash); assert.equal(bytes.length,Number(artifact.file_size));
    return {...spec,path:target,draftId:d.id,artifactId:artifact.id,sha256:hash};
  }));
}
/** Compile six intentions via ACTUAL production functions supplied by caller.
 * This is typed-host evidence only; it does not propose/approve/install or claim Pi UI. */
export function compileSixExportDrafts({paper,basket,compilePaperOffice,assertPaperOffice}) {
  assertReviewedSnapshot(paper,basket);
  return SIX_EXPORTS.map(spec=>{
    const draft=compilePaperOffice(paper,spec.audience,spec.template); assertPaperOffice(paper,draft);
    return {...spec,draft};
  });
}
/** Caller supplies an already approved real draft and production service.apply.
 * Arrange a real instance mutation in the existing prepared->commit hook first.
 * This helper neither approves nor manufactures a Pi run or mutates the DB. */
export async function assertOfficeInstallRefused({dbPath,sessionId,draftId,target,preservedFiles,apply,expectedError='conflict'}) {
  assert(!fs.existsSync(target),'Refusal target already exists');
  assert(preservedFiles?.length,'Prior actual delivered files required');
  const facts=()=>readDb(dbPath,db=>({draft:one(db,'SELECT * FROM xiaozhi_pi_office_drafts WHERE id=? AND conversation_id=?',[draftId,sessionId],'Draft absent'),artifacts:db.prepare('SELECT * FROM document_artifacts ORDER BY id').all(),lineage:db.prepare('SELECT * FROM document_artifact_paper_sources ORDER BY artifact_id').all()}));
  const before=facts(); assert.equal(before.draft.state,'approved','Approval must precede this helper');
  const hashes=preservedFiles.map(file=>({path:path.resolve(file),sha256:fileHash(file)}));
  let error; try {await apply(sessionId,draftId);} catch(e) {error=e;}
  assert(error && String(error.message)===expectedError,'Actual apply must reject with '+expectedError);
  const after=facts(); assert(!fs.existsSync(target),'Rejected install left a file');
  assert(after.draft.output_hash && after.draft.output_bytes?.length>0,'No actual prepared output: cannot claim prepared-to-install refusal');
  assert.equal(path.resolve(after.draft.result_path),path.resolve(target),'Prepared output target differs');
  equal(after.artifacts,before.artifacts,'Rejected install published/changed artifact facts');
  equal(after.lineage,before.lineage,'Rejected install published/changed paper lineage');
  assert.notEqual(after.draft.state,'saved');
  // Entering committing reserves an artifact ID before final source CAS. A
  // reserved ID is not a formal artifact; it must remain absent from facts.
  if(before.draft.artifact_id) assert.equal(after.draft.artifact_id,before.draft.artifact_id);
  assert(!after.artifacts.some(a=>a.id===after.draft.artifact_id),'Rejected draft published its reserved artifact');
  for(const file of hashes) assert.equal(fileHash(file.path),file.sha256,'Prior delivery changed');
  return {scope:'typed-host-actual-install-refusal',productAcceptance:false,draftId,error:String(error.message),beforeState:before.draft.state,afterState:after.draft.state,preservedFiles:hashes,artifactsUnchanged:true,lineageUnchanged:true,targetAbsent:true};
}
/** Writes only NEW owned evidence files. No application starts; PDF is parsed
 * by pypdf and rendered offline by PDFium. Existing evidence is not overwritten. */
export async function readBackExportFiles({manifest,output,python=process.env.OMNI_EDU_FIXTURE_PYTHON??'python',renderPdf=true}) {
  assertSixExportMatrix(manifest.files);
  const probes=f=>Object.fromEntries(['required','forbidden','ordered','images','forbiddenImages'].filter(k=>f[k]!==undefined).map(k=>[k,f[k]]));
  for(const format of ['docx','pdf']) validateExportExpectations(Object.fromEntries(['student','teacher','answer_sheet'].map(k=>[k,probes(manifest.files.find(f=>f.kind===k && f.format===format))])));
  fs.mkdirSync(output,{recursive:true});
  const input=path.join(output,'manifest.json'), report=path.join(output,'readback.json');
  assert(!fs.existsSync(report),'Refusing to overwrite readback evidence');
  fs.writeFileSync(input,JSON.stringify(manifest,null,2),{flag:'wx'});
  const script=fileURLToPath(new URL('./paper-instance-export-readback.py',import.meta.url));
  try {await promisify(execFile)(python,[script,input,report,...(renderPdf?['--render-pdf']:[])],{windowsHide:true,timeout:120000,maxBuffer:1024*1024});}
  catch(error) {throw new Error('Independent readback failed; evidence: '+report,{cause:error});}
  return JSON.parse(fs.readFileSync(report,'utf8'));
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [manifestPath,output,python]=process.argv.slice(2);
  assert(manifestPath && output,'Usage: node paper-instance-export-readback.mjs MANIFEST_JSON NEW_OUTPUT_DIR [PYTHON]');
  const result=await readBackExportFiles({manifest:JSON.parse(fs.readFileSync(manifestPath,'utf8')),output,python});
  console.log(JSON.stringify({success:result.success,scope:result.scope,productAcceptance:false,output}));
}
