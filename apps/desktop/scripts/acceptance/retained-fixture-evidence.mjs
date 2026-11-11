/** Read-only publication/reader contract for the explicit NEW baseline. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {fingerprint,sha256} from './evidence.mjs';
import {fixtureCases,projectionFor,proposalFor,arithmeticPdf} from './retained-fixture-input.mjs';

// Reuse production validators and canonical question facts in memory. No build
// files, application import, new schema or alternate approval implementation.
const {build}=await import('esbuild');
const compiled=await build({stdin:{contents:
  "export {questionFacts} from './src/shared/question-facts.ts';\n"+
  "export {validMultiDraft} from './src/shared/original-multi-review.ts';\n"+
  "export {unwrapTaskArguments} from './src/main/xiaozhi-agent/tasks/tool-envelope.ts';\n"+
  "export {validQuestionDocument} from './src/shared/question-document.ts';",
  resolveDir:fileURLToPath(new URL('../..',import.meta.url)),loader:'ts'},
  bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
export const fixtureContracts=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));

export const fixtureSchema='xiaozhi.qa.retained-original-fixture.v1';
export const fixtureBudget=Object.freeze({piTasks:2,responses:9,launches:2,externalRequests:0,paidRequests:0,totalMs:240000});
export const fixtureParent=desktop=>path.join(desktop,'test-results/ui-final-content-20261111/retained-qa');
const digest=value=>sha256(JSON.stringify(value));
export function fixtureScriptHashes(desktop) {
  const files=['ui-final-retained-fixture-live.mjs','ui-final-retained-sources-live.mjs',
    ...['input','provider','evidence','selftest'].map(name=>'acceptance/retained-fixture-'+name+'.mjs')];
  return files.map(file=>({file,sha256:sha256(fs.readFileSync(path.join(desktop,'scripts',file)))}));
}
export function ownedExact(file,root) {
  const absolute=path.resolve(file),base=path.resolve(root),relative=path.relative(base,absolute);
  assert(relative&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative),'Owned exact descendant required');
  assert.equal(fs.realpathSync(base),base,'Owned root must have no redirected ancestors');
  let current=base;
  for(const segment of relative.split(path.sep)) {
    current=path.join(current,segment);const stat=fs.lstatSync(current);
    assert(!stat.isSymbolicLink(),'No symlink/reparse evidence');assert.equal(fs.realpathSync(current),current,'No redirected evidence');
    assert(stat.isDirectory()||stat.isFile(),'Only regular evidence');
    if(stat.isFile())assert.equal(stat.nlink,1,'No hard-linked evidence');
  }
  return absolute;
}
export function safeTree(root,parent) {
  ownedExact(root,parent);let count=0,bytes=0;
  function walk(dir) {
    for(const name of fs.readdirSync(dir)) {
      const file=ownedExact(path.join(dir,name),root),stat=fs.lstatSync(file);
      assert(++count<=16000,'Bounded baseline tree');bytes+=stat.size;assert(bytes<=512*1048576,'Bounded baseline bytes');
      if(stat.isDirectory())walk(file);
    }
  }
  walk(root);return fingerprint(root).sha256;
}
export function readSql(data,work) {
  const file=ownedExact(path.join(data,'app.db'),data);assert(fs.statSync(file).size>0,'Nonempty actual SQLite required');
  const db=new DatabaseSync(file,{readOnly:true});
  try {db.exec('PRAGMA query_only=ON; BEGIN;');return work((sql,args=[])=>{
    assert(/^(SELECT|PRAGMA table_info)\b/.test(sql),'Read-only QA queries');return db.prepare(sql).all(...args);
  });} finally {db.close();}
}
const tables=['teacher_resources','resource_chunks','question_bank_items','ai_confirmation_items',
  'ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions','ai_agent_events','xiaozhi_event_journal',
  'xiaozhi_pi_commands','xiaozhi_pi_usage','xiaozhi_tool_receipts','xiaozhi_pi_controls','xiaozhi_pi_session_bindings','ai_conversation_messages'];
export const snapshot=data=>readSql(data,query=>Object.fromEntries(tables.map(table=>[table,query(`SELECT * FROM ${table} ORDER BY rowid`)])));
export const snapshotHash=data=>digest(snapshot(data));
/** The formal confirmation table uses an empty JSON object before a decision. */
export function assertPendingDecision(row) {
  assert.equal(row.status,'pending');
  assert.equal(row.result_json,'{}','Pending proposal retains the formal empty decision');
  assert.equal(row.confirmed_at,null,'Pending proposal has no confirmation timestamp');
}
export function retainRows(before,after) {
  for(const table of ['teacher_resources','resource_chunks','question_bank_items','ai_confirmation_items','ai_agent_runs','xiaozhi_pi_commands','xiaozhi_pi_usage']) {
    const key=row=>row.id??row.command_id??row.run_id;
    for(const row of before[table])assert.deepEqual(after[table].find(v=>key(v)===key(row)),row,'Previously completed fact retained: '+table);
  }
}

export function nativeMessages(data) {
  return readSql(data,query=>query('SELECT conversation_id,session_file FROM xiaozhi_pi_session_bindings ORDER BY conversation_id').map(row=>{
    const root=path.join(data,'xiaozhi-pi'),file=ownedExact(path.resolve(root,row.session_file),root);
    assert(fs.statSync(file).size<=16*1048576,'Bounded native session');
    return {sessionId:row.conversation_id,file,sha256:sha256(fs.readFileSync(file)),
      messages:fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)).map(e=>e.message).filter(Boolean)};
  }));
}

export function inspectCases(sourceRoot,resourceId) {
  const data=path.join(sourceRoot,'data'),history=nativeMessages(data);
  return readSql(data,query=>{
    const resources=query('SELECT * FROM teacher_resources');assert.equal(resources.length,1,'Only teacher-authored PDF imported');
    const source=resources[0];assert.equal(source.id,resourceId);assert.equal(source.parse_status,'ready');
    const original=ownedExact(source.local_path,data);assert.equal(path.extname(original).toLowerCase(),'.pdf');
    assert.equal(sha256(fs.readFileSync(original)),source.content_hash,'Actual imported PDF SHA');
    assert.equal(source.content_hash,sha256(arithmeticPdf()),'Only this explicitly teacher-authored PDF');
    const ledger=query("SELECT * FROM ai_confirmation_items WHERE action_type='pi_original_question_multi_candidate' ORDER BY created_at,id");
    assert.equal(ledger.length,3,'Exactly the three genuinely proposed cases');
    const runs=query('SELECT * FROM ai_agent_runs ORDER BY created_at,id');assert.equal(runs.length,2,'At most two actual tasks');
    assert.equal(runs.filter(r=>r.status==='succeeded').length,1);assert.equal(runs.filter(r=>r.status==='blocked').length,1);
    assert(query('SELECT * FROM xiaozhi_pi_commands').every(r=>['finished','interrupted'].includes(r.status)),'No running command');
    return fixtureCases.map(item=>{
      const rows=ledger.filter(r=>r.title===item.title);assert.equal(rows.length,1,'Distinct new case identity');
      const row=rows[0],payload=JSON.parse(row.payload_json),pending=item.role==='pending';
      assert.equal(row.status,pending?'pending':'confirmed');assert.equal(payload.schemaVersion,'xiaozhi.education.original-review.v2');
      assert(fixtureContracts.validMultiDraft(payload.draft,false),'Original production proposal schema');
      assert.equal(payload.draft.sourceChecked,false);assert.equal(payload.draft.answer,'');assert.equal(payload.draft.analysis,'');
      assert.equal(payload.draft.answerOrigin,'missing');assert.equal(payload.draft.analysisOrigin,'missing');
      assert.equal(payload.draft.title,item.title);assert.equal(payload.draft.stem,item.statement);
      if(payload.draft.projection)assert(Object.values(payload.draft.projection).every(p=>p.state==='missing'),'Candidate has no teacher coverage');
      assert.equal(payload.images.length,item.pages.length);assert.deepEqual(payload.images.map(x=>x.image.page),item.pages);
      const native=history.find(h=>h.sessionId===row.session_id);assert(native,'Actual native session');
      const calls=native.messages.flatMap(m=>m.role==='assistant'?m.content||[]:[]).filter(c=>c.type==='toolCall');
      const proposal=calls.filter(c=>c.id===payload.callId&&c.name==='education_propose_original_question');assert.equal(proposal.length,1);
      const {stepId,input:domainInput}=fixtureContracts.unwrapTaskArguments(proposal[0].arguments);
      assert(typeof stepId==='string'&&stepId.length>0,'Actual native task routing envelope');
      assert.deepEqual(domainInput,proposalFor(item,source.id),'Exact teacher-supplied tool input after production host unwrap');
      const {resourceId:requestedResource,page,box,regions,transcription,...fields}=domainInput;
      assert.equal(payload.proposalDigest,digest({draft:{...fields,answer:'',analysis:''},resourceId:requestedResource,version:source.content_hash,
        regions:(regions||[{page,box}]).map(r=>({...r,role:'question'})),transcription}),'Original source-bound proposal digest');
      assert.equal(proposal[0].arguments.resourceId,source.id);assert.equal(proposal[0].arguments.stem,item.statement);
      if(item.role==='single'){assert.equal(proposal[0].arguments.page,1);assert.deepEqual(proposal[0].arguments.box,[0,0,1,1]);assert.equal(proposal[0].arguments.regions,undefined);}
      else assert.deepEqual(proposal[0].arguments.regions,item.pages.map(page=>({page,box:[0,0,1,1]})));
      assert(calls.some(c=>c.name==='office_read_material'&&c.arguments.resourceId===source.id),'Real original read in native history');
      const taskRows=query("SELECT key,value_json FROM app_settings WHERE key LIKE 'xiaozhi.task.v1:xitask_%' AND key NOT LIKE '%:revision:%'");
      const matching=taskRows.map(r=>JSON.parse(r.value_json)).filter(doc=>doc.admissions?.some(a=>a.runId===row.run_id&&a.callId===payload.callId));
      assert.equal(matching.length,1,'Exactly one actual host task admission');
      const task=matching[0],admission=task.admissions.find(a=>a.runId===row.run_id&&a.callId===payload.callId);
      assert.equal(task.view.origin.runId,row.run_id,'New requirement owns this task');
      assert.equal(admission.stepId,stepId);assert.equal(admission.tool,'education_propose_original_question');
      assert.equal(admission.inputDigest,digest(['education_propose_original_question',domainInput]),'Original host unwrapped input digest');
      const actualStep=task.view.steps.find(s=>s.id===stepId);assert(actualStep);
      assert(actualStep.criterionIds.every(id=>task.view.criteria.find(c=>c.id===id)?.kind==='saved_questions'));
      const planReceipts=native.messages.filter(m=>m.role==='toolResult'&&m.toolName==='update_task_plan'&&!m.isError)
        .flatMap(m=>(m.content||[]).filter(p=>p.type==='text').flatMap(p=>{try{return [JSON.parse(p.text)];}catch{return [];}}))
        .filter(v=>v.success===true&&v.adopted===true&&v.taskId===task.view.id&&v.revision===admission.planRevision&&v.requirementsVersion===admission.requirementsVersion);
      assert.equal(planReceipts.length,1,'Actual adopted plan version for this admission');
      assert(planReceipts[0].steps.some(s=>s.id===stepId&&s.state==='executing'),'Native envelope names the actual adopted executing step');
      const images=payload.images.map(({role,image})=>{
        assert.equal(role,'question');assert.equal(image.resourceId,source.id);assert.equal(image.version,source.content_hash);
        assert.equal(image.schemaVersion,'xiaozhi.material-page-preview.v1');assert.equal(image.ok,true);
        assert.equal(image.engine,'pdfium-5.14.0-page.v1');assert.equal(image.total,3);
        assert(image.width>0&&image.height>0);assert.deepEqual(image.box,[0,0,1,1]);
        assert.match(image.assetId,/^asset_[a-f0-9-]{36}$/);assert.match(image.sha256,/^[a-f0-9]{64}$/);
        const file=ownedExact(path.join(data,pending?'cache/question-candidates/v1':'question-assets/v1',image.assetId+'.png'),data);
        const bytes=fs.readFileSync(file);assert(bytes.length>=57&&bytes.length<=4*1048576);assert.equal(sha256(bytes),image.sha256);
        assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
        assert.equal(bytes.readUInt32BE(8),13);assert.equal(bytes.toString('ascii',12,16),'IHDR');
        assert(bytes.subarray(-12).equals(Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130])));
        assert.equal(bytes.readUInt32BE(16),image.width);assert.equal(bytes.readUInt32BE(20),image.height);
        const identity=digest([image.version,image.engine,image.page,image.box,image.sha256]);
        assert.equal(image.assetId,`asset_${identity.slice(0,8)}-${identity.slice(8,12)}-${identity.slice(12,16)}-${identity.slice(16,20)}-${identity.slice(20,32)}`,'Original host asset identity');
        return {page:image.page,assetId:image.assetId,sha256:image.sha256,width:image.width,height:image.height,engine:image.engine,file};
      });
      const record={role:item.role,name:item.name,sourceRoot,dataRoot:data,profileRoot:path.join(sourceRoot,'profile'),
        resourceId:source.id,sourceVersion:source.content_hash,original,proposalId:row.id,sessionId:row.session_id,runId:row.run_id,
        proposalSha256:digest(payload),status:row.status,images};
      if(pending) {assertPendingDecision(row);return record;}
      const effect=JSON.parse(row.result_json);assert.equal(effect.complete,true);assert(row.confirmed_at);
      assert(fixtureContracts.validMultiDraft(effect.draft),'Original production approval schema');
      assert.equal(effect.schemaVersion,'xiaozhi.education.original-review.v2');assert.equal(effect.draft.sourceChecked,false);
      assert.equal(effect.draft.answerOrigin,'missing');assert.equal(effect.draft.analysisOrigin,'missing');
      assert.equal(effect.draft.answer,'');assert.equal(effect.draft.analysis,'');
      assert.deepEqual(effect.draft.projection,projectionFor(item));
      assert.equal(effect.digest,digest({id:row.id,sessionId:row.session_id,runId:row.run_id,proposal:payload,draft:effect.draft,saved:effect.saved}),'Original approval digest');
      const questions=query('SELECT * FROM question_bank_items WHERE id=?',[effect.saved.questionId]);assert.equal(questions.length,1);
      const question=questions[0],document=JSON.parse(question.document_json);
      assert(!question.archive_json,'Original manually reviewed document has no competing archive');
      assert(fixtureContracts.validQuestionDocument(document),'Original production document schema');
      assert.equal(question.source_kind,'teacher_resource');assert.equal(question.stem,item.statement);assert.equal(question.answer,'');assert.equal(question.analysis,'');
      assert.equal(document.schemaVersion,'xiaozhi.question-document.v2');assert.equal(document.source.resourceId,source.id);assert.equal(document.source.resourceVersion,source.content_hash);
      assert.deepEqual(document.context.projection,projectionFor(item));assert.equal(document.blocks.length,images.length+1);
      const facts=fixtureContracts.questionFacts({id:String(question.id),subject:String(question.subject),grade:String(question.grade),
        knowledgePoint:String(question.knowledge_point),questionType:String(question.question_type),difficulty:String(question.difficulty),
        stem:String(question.stem),answer:String(question.answer),analysis:String(question.analysis),sourceTitle:String(question.source_title),
        sourceKind:String(question.source_kind),tags:JSON.parse(question.tags),createdAt:String(question.created_at),updatedAt:String(question.updated_at),document});
      assert.equal(digest(facts),effect.saved.version,'Production canonical saved question version');
      for(const [i,image]of images.entries()){assert.equal(document.blocks[i].kind,'image');assert.equal(document.blocks[i].assetId,image.assetId);assert.equal(document.blocks[i].sha256,image.sha256);}
      const results=native.messages.filter(m=>m.role==='toolResult'&&m.toolCallId===payload.callId);
      assert.equal(results.length,1,'Real completed proposal tool receipt');assert(!results[0].isError);
      assert(results[0].content.some(p=>p.type==='text'&&p.text.includes('"state":"confirmed"')));
      return {...record,questionId:question.id,questionVersion:effect.saved.version,questionSha256:digest(question),effectDigest:effect.digest};
    });
  });
}

export function readFixtureManifest(file,desktop,pins) {
  const parent=fixtureParent(desktop),manifestFile=ownedExact(file,parent);
  assert(fs.statSync(manifestFile).size<=65536,'Bounded manifest');
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8')),output=path.dirname(manifestFile);
  assert.equal(manifest.schemaVersion,fixtureSchema);assert.equal(manifest.success,true);assert.deepEqual(manifest.budget,fixtureBudget);
  assert.deepEqual(manifest.pins,{source:pins.source,build:pins.build});
  const reportFile=ownedExact(manifest.reportFile,output);assert.equal(reportFile,path.join(output,'report.json'));
  const bytes=fs.readFileSync(reportFile);assert(bytes.length<=512*1024,'Bounded real report');assert.equal(sha256(bytes),manifest.reportSha256);
  const report=JSON.parse(bytes);assert.equal(report.schemaVersion,fixtureSchema);assert.equal(report.success,true);
  assert.equal(report.integrityVerified,true);assert.equal(report.coldVerified,true);assert.deepEqual(report.budget,fixtureBudget);
  assert.deepEqual(report.pins,manifest.pins);assert.equal(report.output,output);
  assert.deepEqual(report.scripts,fixtureScriptHashes(desktop),'Actual producer and reader scripts pinned');
  assert.equal(report.submissions,2);assert.equal(report.launches,2);assert.equal(report.provider.responses,9);
  assert.equal(report.provider.tasks,2);assert.equal(report.provider.externalAttempts,0);assert.equal(report.provider.rendererErrors,0);assert.equal(report.provider.fatal,null);
  assert.equal(report.coldProvider.tasks,0);assert.equal(report.coldProvider.responses,0);assert.equal(report.coldProvider.externalAttempts,0);assert.equal(report.coldProvider.rendererErrors,0);assert.equal(report.coldProvider.fatal,null);
  assert.equal(report.provider.policyProof,'FORMAL_FRAME_AND_ZERO_WIRE');assert.equal(report.coldProvider.policyProof,'FORMAL_FRAME_AND_ZERO_WIRE');
  assert.deepEqual(report.errors,[]);assert(report.elapsedMs>0&&report.elapsedMs<=fixtureBudget.totalMs);
  assert.deepEqual(report.checks.map(c=>c.id),['IMPORTED_PDF','SINGLE_APPROVED','MULTI_APPROVED','PENDING_STOPPED','COLD_CONSERVED']);
  assert(report.checks.every(c=>c.pass===true));
  const screenIds=['imported-pdf','single-before-confirm','multi-before-confirm','pending-before-stop','cold-pending'];
  assert.deepEqual(report.screens.map(s=>s.id),screenIds,'Actual UI evidence for every generation step');
  for(const screen of report.screens) {
    const screenshot=ownedExact(screen.file,output);assert.equal(screenshot,path.join(output,screen.id+'.png'));
    const image=fs.readFileSync(screenshot);assert(image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    assert.equal(sha256(image),screen.sha256,'Actual UI screenshot bytes');
  }
  const sourceRoot=ownedExact(manifest.sourceRoot,output);assert.equal(sourceRoot,path.join(output,'baseline'));
  assert.equal(safeTree(sourceRoot,output),manifest.sourceTreeSha256,'Whole genuine baseline byte conservation');
  assert.equal(snapshotHash(path.join(sourceRoot,'data')),manifest.sqliteSha256,'Current SQLite facts match publication');
  assert.equal(report.sqliteSha256,manifest.sqliteSha256);assert.equal(report.sourceRoot,sourceRoot);
  assert.equal(ownedExact(report.input.file,sourceRoot),path.join(sourceRoot,'workspace/teacher-authored-arithmetic.pdf'));
  assert.deepEqual(fs.readFileSync(report.input.file),arithmeticPdf());assert.equal(report.input.sha256,sha256(arithmeticPdf()));
  const cases=inspectCases(sourceRoot,manifest.resourceId);assert.deepEqual(cases,manifest.cases,'SQL/native/image identities, not report-only claims');
  assert.deepEqual(report.cases,cases);assert.deepEqual(cases.map(c=>c.role),['single','multi','pending']);
  return {manifest,reference:sourceRoot,cases,manifestFile};
}

/** Qualify persisted genuine cases independently of the failed producer verifier.
 * The current reader supplies the cold-start evidence through its three launches.
 */
export function readPersistedFixtureSource(file,desktop,pins) {
  const parent=fixtureParent(desktop),reportFile=ownedExact(file,parent);
  assert.equal(path.basename(reportFile),'report.json');
  const output=path.dirname(reportFile),bytes=fs.readFileSync(reportFile);
  assert(bytes.length<=512*1024);
  const report=JSON.parse(bytes);
  assert.equal(report.schemaVersion,fixtureSchema);
  assert.equal(report.success,false,'Original producer failure is preserved');
  assert.equal(report.output,output);
  assert.deepEqual(report.pins,{source:pins.source,build:pins.build});
  assert.deepEqual(report.budget,fixtureBudget);
  assert.equal(report.launches,1);assert.equal(report.submissions,2);
  assert.equal(report.failure?.phase,'cold');
  assert.equal(report.failure?.message,'Pending proposal has no fabricated decision');
  assert.deepEqual(report.checks,[{id:'IMPORTED_PDF',pass:true},{id:'SINGLE_APPROVED',pass:true},
    {id:'MULTI_APPROVED',pass:true},{id:'PENDING_STOPPED',pass:true}]);
  const provider=report.provider;
  assert.equal(provider.responses,9);assert.equal(provider.tasks,2);
  assert.equal(provider.externalAttempts,0);assert.equal(provider.rendererErrors,0);
  assert.equal(provider.fatal,null);assert.equal(provider.policyProof,'FORMAL_FRAME_AND_ZERO_WIRE');
  assert.deepEqual(report.errors,[]);
  const sourceRoot=ownedExact(report.sourceRoot,output);
  assert.equal(sourceRoot,path.join(output,'baseline'));
  assert.equal(ownedExact(report.input.file,sourceRoot),path.join(sourceRoot,'workspace/teacher-authored-arithmetic.pdf'));
  assert.deepEqual(fs.readFileSync(report.input.file),arithmeticPdf());
  assert.equal(report.input.sha256,sha256(arithmeticPdf()));
  const cases=inspectCases(sourceRoot,readSql(path.join(sourceRoot,'data'),query=>{
    const resources=query('SELECT id FROM teacher_resources');assert.equal(resources.length,1);return resources[0].id;
  }));
  const screenIds=['imported-pdf','single-before-confirm','multi-before-confirm','pending-before-stop'];
  assert.deepEqual(report.screens.map(screen=>screen.id),screenIds);
  for(const screen of report.screens) {
    assert.equal(ownedExact(screen.file,output),path.join(output,screen.id+'.png'));
    assert.equal(sha256(fs.readFileSync(screen.file)),screen.sha256);
  }
  return {reference:sourceRoot,cases,producerReportFile:reportFile,qualification:{
    producerStatus:'FAIL',reportSha256:sha256(bytes),sourceTreeSha256:safeTree(sourceRoot,output),
    sqliteSha256:snapshotHash(path.join(sourceRoot,'data')),
    independentlyVerified:'Actual native calls, adopted plan/admission, approvals, canonical question versions, PNG identities and original bytes',
    coldVerification:'Required in the current retained reader; producer cold start was not executed'}};
}
