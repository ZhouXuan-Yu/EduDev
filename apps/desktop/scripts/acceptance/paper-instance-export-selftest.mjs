/** Offline targeted regression for the NEW acceptance helpers. Owned SQLite
 * source qualification is controlled. Actual production compiler/Office state,
 * service/generator/installer are used; this is explicitly NOT Pi/UI evidence.
 * No app, PDF generator, model, build, original fixture modification or DB-fact
 * injection. PDF six-way completion must remain unpassed until parent live run.
 */
import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertLiveExportOptIn,expectationsFromEditedSnapshot,runPaperInstanceExportJourney} from './paper-instance-export-live.mjs';
import {SIX_EXPORTS,assertReviewedSnapshot,assertSixExportMatrix,validateExportExpectations,compileSixExportDrafts,captureExportInvariants,assertExportInvariants,readBackExportFiles,readSavedExportFacts,assertOfficeInstallRefused} from './paper-instance-export-readback.mjs';

// Register the existing source resolver before loading any TS dependency graph.
const {basketFixture}=await import('../education/paper-basket-fixture.mjs');
const {PaperBasketV2Repository}=await import('../../src/main/education/paper-basket-v2-repository.ts');
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {compilePaperOffice,assertPaperOffice}=await import('../../src/main/education/paper-export.ts');
const {createOfficeArtifactService}=await import('../../src/main/xiaozhi-agent/office-artifact-service.ts');
const {createOfficeArtifactState}=await import('../../src/main/xiaozhi-agent/office-artifact-state.ts');

const output=fs.mkdtempSync(path.join(tmpdir(),'omni-paper-instance-acceptance-helper-'));
const report={success:false,scope:'owned-real-SQLite-production-host-3-DOCX-new-helper-regression',productAcceptance:false,output,checks:[],pending:['Actual Pi send/original UI approval and all three actual PDF outputs require the parent live run.']};
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
report.sourceHashes=Object.fromEntries(['./paper-instance-export-live.mjs','./paper-instance-export-readback.mjs','./paper-instance-export-readback.py','./paper-instance-export-selftest.mjs','../education/paper-instance-boundaries.mjs','../../src/shared/paper-instance.ts','../../src/shared/paper-basket-v2.ts'].map(relative=>{const file=fileURLToPath(new URL(relative,import.meta.url));return[file,hash(file)];}));
const check=async(name,fn)=>{const facts=await fn();report.checks.push({name,pass:true,...(facts?{facts}:{})});console.log('PASS '+name);};
let fixture;
try {
  await check('UI helper cannot send without both explicit opt-in flags, before touching page or DB',async()=>{
    for(const argv of [[],['--live'],['--run-ui']]) {
      assert.throws(()=>assertLiveExportOptIn(argv),/explicit/);
      await assert.rejects(runPaperInstanceExportJourney({argv}),/explicit/);
    }
  });
  await check('Six-way matrix rejects absent PDF, duplicates, wrong format and reused paths; no pass for three DOCX',async()=>{
    assertSixExportMatrix(SIX_EXPORTS);
    for(const invalid of [SIX_EXPORTS.filter(s=>s.format==='docx'),[...SIX_EXPORTS.slice(0,5),SIX_EXPORTS[0]],SIX_EXPORTS.map(s=>({...s,path:'same'})),SIX_EXPORTS.map(s=>({...s,format:'xlsx'}))])assert.throws(()=>assertSixExportMatrix(invalid));
  });
  fixture=await basketFixture(path.join(output,'owned'));
  const {db,host,papers,sid}=fixture;
  const v2=new PaperBasketV2Repository({...host,saveSnapshot:(...a)=>papers.createBasketSnapshotInTransaction(...a),readSnapshot:(...a)=>papers.reviewInTransaction(...a)},papers);
  const schema={schemaVersion:'xiaozhi.paper-basket.v2',sessionId:sid};
  const blueprint={title:'B helper当前实例',subject:'数学',grade:'初二',durationMinutes:20,totalPoints:10,mode:'source_only',sections:[{id:'a',label:'选择题',questionType:'选择题',count:1,points:10}]};
  const q=fixture.question('Helper original',{questionType:'选择题'}),version=questionVersion(q);
  const mutate=(b,operation)=>v2.mutate({...schema,basketId:b.id,expectedRevision:b.revision,requestId:randomUUID(),operation});
  const create=async()=>{let b=await v2.create({...schema,requestId:randomUUID(),blueprint});return mutate(b,{type:'add',questionId:q.id,sectionId:'a',expectedSourceVersion:version});};
  let basket=await create();const other=await create();
  const content={question:{mode:'edited',blocks:[{type:'text',text:'当前实例题面读回标记'},{type:'table',rows:[['变量列','取值列'],['x','2']]},{type:'text',text:'当前表后读回标记'},{type:'options',items:[{label:'甲',text:'当前选项读回甲'},{label:'乙',text:'当前选项读回乙'}]},{type:'subquestions',items:[{label:'1',text:'当前小问读回标记'}]}]},answer:{mode:'edited',blocks:[{type:'text',text:'教师答案读回私有标记'}]},analysis:{mode:'edited',blocks:[{type:'text',text:'教师解析读回私有标记'}]}};
  const edit=next=>mutate(basket,{type:'editEntry',entryId:basket.entries[0].entryId,expectedInstanceRevision:basket.entries[0].instance.instanceRevision,content:next});
  basket=await edit(content);basket=await mutate(basket,{type:'reviewEntry',entryId:basket.entries[0].entryId,expectedInstanceRevision:basket.entries[0].instance.instanceRevision,expectedContentDigest:basket.entries[0].instance.contentDigest,action:'confirm'});
  const draft=await v2.createSnapshot({...schema,basketId:basket.id,expectedRevision:basket.revision,requestId:randomUUID()});
  const paper=await papers.decide({schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:sid,id:draft.id,revision:draft.revision,action:'confirm'},()=>true);
  let intentions,expectations;
  await check('Current real SQLite reviewed instance projects into six actual production compiler drafts, custom option labels and private roles',async()=>{
    assertReviewedSnapshot(paper,basket);
    intentions=compileSixExportDrafts({paper,basket,compilePaperOffice,assertPaperOffice});assert.equal(intentions.length,6);
    expectations=expectationsFromEditedSnapshot(paper);validateExportExpectations(expectations);
    assert(expectations.answer_sheet.required.includes('甲 □'));assert(expectations.answer_sheet.required.includes('乙 □'));
    assert(!JSON.stringify(expectations.student.required).includes(q.stem));
    for(const spec of intentions){const text=JSON.stringify(spec.draft.sections);assert.equal(text.includes('教师答案读回私有标记'),spec.kind==='teacher');assert.equal(text.includes('当前实例题面读回标记'),spec.kind!=='answer_sheet');}
    for(const patch of [p=>p.basket.basketRevision++,p=>p.selection.items[0].instance.review.action='reject',p=>p.exportCurrent=false]){const broken=structuredClone(paper);patch(broken);assert.throws(()=>assertReviewedSnapshot(broken,basket));}
    const weak=structuredClone(expectations);weak.answer_sheet.forbidden=[];assert.throws(()=>validateExportExpectations(weak),/isolation/);
    const override=structuredClone(expectations);override.student.path='forged';assert.throws(()=>validateExportExpectations(override),/Unexpected/);
  });
  // Additional bank mirror only in this NEW owned fixture for read-only hash
  // helper checks; never a real-product provenance claim or Office fact insert.
  db.exec('CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,body TEXT)');
  db.prepare('INSERT INTO question_bank_items VALUES(?,?)').run(q.id,JSON.stringify(q));
  const dbPath=path.join(output,'owned','app.sqlite');
  const before=captureExportInvariants({dbPath,sessionId:sid,basketId:basket.id,otherBasketId:other.id,paperId:paper.id});
  await check('Read-only full-row invariants detect owned-bank mutation; restored bytes and original other basket/paper remain identical',async()=>{
    assertExportInvariants(before);
    try{db.prepare('UPDATE question_bank_items SET body=? WHERE id=?').run('owned-test-change',q.id);assert.throws(()=>assertExportInvariants(before),/changed/);}
    finally{db.prepare('UPDATE question_bank_items SET body=? WHERE id=?').run(JSON.stringify(q),q.id);}
    assertExportInvariants(before);
  });
  const workspace=path.join(output,'workspace'),dataRoot=path.join(output,'data');fs.mkdirSync(workspace);fs.mkdirSync(dataRoot);
  db.exec('CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT,message_id TEXT,title TEXT,artifact_type TEXT,file_name TEXT,mime_type TEXT,description TEXT,content_md TEXT,file_path TEXT,file_size INTEGER,content_hash TEXT,status TEXT,error_message TEXT,created_at TEXT,updated_at TEXT)');
  const state=createOfficeArtifactState({run:async(s,p=[])=>db.prepare(s).run(...p),all:async(s,p=[])=>db.prepare(s).all(...p),change:async(s,p=[])=>Number(db.prepare(s).run(...p).changes)});
  await state.migrate();let beforeCommit;
  const service=createOfficeArtifactService({state,dataRoot,workspace:async()=>workspace,isCurrent:()=>true,resolvePaperImages:async()=>new Map(),validatePaperDraft:async(owner,d)=>assertPaperOffice(await papers.review(owner,d.paperSource.paperId),d),commitPaperDraft:async(owner,d,install)=>{await beforeCommit?.();await papers.withConfirmedSource(owner,d.paperSource.paperId,d.paperSource.digest,p=>{assertPaperOffice(p,d);install();});}});
  const saved=[];
  await check('Production Office propose/host-decide/apply creates actual three DOCX and real trigger-published facts; explicitly no UI or Pi claim',async()=>{
    for(const spec of intentions.filter(s=>s.format==='docx')){
      const name=spec.kind+'.docx',row=await service.propose(sid,'owned-offline-helper',randomUUID(),{path:name,format:'docx',draft:spec.draft,sources:[]});
      await service.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:sid,draftId:row.id,revision:row.revision,action:'approve'});
      const result=await service.apply(sid,row.id);assert.equal(result.state,'saved');const file=path.join(workspace,name);assert(fs.statSync(file).size>100);
      saved.push({...spec,path:file,draftId:row.id,sha256:hash(file),...expectations[spec.kind]});
    }
    assertExportInvariants(before);return {files:saved.map(s=>s.path)};
  });
  await check('Read-only provenance joins real saved drafts, trigger-published artifacts and paper lineage against actual bytes, excluding reserved IDs from artifact facts',async()=>{
    const facts=readSavedExportFacts({dbPath,sessionId:sid,workspace,paper,files:saved});assert.equal(facts.length,3);
    assert(facts.every(f=>f.artifactId && f.sha256===hash(f.path)));
  });
  const python=process.env.OMNI_EDU_FIXTURE_PYTHON??'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
  const verifier=fileURLToPath(new URL('./paper-instance-export-readback.py',import.meta.url));
  await check('Independent XML readback opens actual DOCX, preserves text/table/options/subquestion order, rejects reversed order and answer leakage probes',async()=>{
    const code=`import sys,json,pathlib,importlib.util
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('b_readback',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
items=json.loads(sys.argv[2]);root=pathlib.Path(sys.argv[3]);output=pathlib.Path(sys.argv[4]);results=[]
for item in items: results.append(m.verify_file(item,root,output,False))
bad=dict(items[0]);bad['ordered']=[['当前表后读回标记','变量列']]
try:m.verify_file(bad,root,output,False);raise RuntimeError('reversed order was accepted')
except AssertionError:pass
bad=dict(items[0]);bad['required']=['教师答案读回私有标记']
try:m.verify_file(bad,root,output,False);raise RuntimeError('private answer appeared in student')
except AssertionError:pass
print(json.dumps({'scope':'actual-host-three-DOCX-independent-XML','productAcceptance':False,'files':results,'negativeOrderRejected':True,'missingPrivateAnswerRejected':True},ensure_ascii=False))`;
    const result=JSON.parse(execFileSync(python,['-B','-c',code,verifier,JSON.stringify(saved),workspace,output],{encoding:'utf8',windowsHide:true}));
    fs.writeFileSync(path.join(output,'docx-readback.json'),JSON.stringify(result,null,2));assert.equal(result.files.length,3);
  });
  await check('Full six-file verifier refuses three actual DOCX instead of manufacturing PDF/acceptance success',async()=>{
    await assert.rejects(readBackExportFiles({manifest:{files:saved},output:path.join(output,'must-not-claim-six'),python}),/Exactly six/);
    assert(!fs.existsSync(path.join(output,'must-not-claim-six')));
  });
  await check('Actual prepared output then instance mutation rejects install with conflict, no file/fact/lineage, all earlier delivered bytes intact',async()=>{
    const name='must-refuse.docx',row=await service.propose(sid,'owned-offline-helper',randomUUID(),{path:name,format:'docx',draft:compilePaperOffice(paper,'student'),sources:[]});
    await service.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:sid,draftId:row.id,revision:row.revision,action:'approve'});
    beforeCommit=async()=>{basket=await edit({...content,answer:{mode:'edited',blocks:[{type:'text',text:'prepared之后实际修改的答案'}]}});};
    report.installRefusal=await assertOfficeInstallRefused({dbPath,sessionId:sid,draftId:row.id,target:path.join(workspace,name),preservedFiles:saved.map(s=>s.path),apply:(...args)=>service.apply(...args)});
    assert.equal(report.installRefusal.error,'conflict');
  });
  report.success=true;
} catch(error) {report.error=String(error.stack??error);process.exitCode=1;console.error(report.error);}
finally {fixture?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:report.checks.length,output,productAcceptance:false}));}
