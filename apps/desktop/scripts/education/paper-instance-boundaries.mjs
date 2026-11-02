import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
const {basketFixture} = await import('./paper-basket-fixture.mjs');
const {PaperBasketV2Repository} = await import('../../src/main/education/paper-basket-v2-repository.ts');
const {PAPER_BASKET_SCHEMA} = await import('../../src/shared/paper-basket.ts');
const {PAPER_BASKET_V2_SCHEMA, validPaperBasketV2Mutation} = await import('../../src/shared/paper-basket-v2.ts');
const {validPaperInstanceContent, sourcePaperInstanceContent} = await import('../../src/shared/paper-instance.ts');
const {compilePaperOffice,assertPaperOffice} = await import('../../src/main/education/paper-export.ts');
const {createOfficeArtifactService} = await import('../../src/main/xiaozhi-agent/office-artifact-service.ts');
const {createOfficeArtifactState} = await import('../../src/main/xiaozhi-agent/office-artifact-state.ts');
const {createPaperBasketApi,registerPaperBasketIpc} = await import('../../src/main/education/paper-basket-api.ts');
const {instanceRoleText} = await import('../../src/main/education/paper-instance.ts');
const output=fs.mkdtempSync(path.join(tmpdir(),'omni-paper-instance-'));
const f=await basketFixture(path.join(output,'owned'));
const {host,papers,baskets,sid,db,question,put}=f;
const v2=new PaperBasketV2Repository({...host,saveSnapshot:(...a)=>papers.createBasketSnapshotInTransaction(...a),readSnapshot:(...a)=>papers.reviewInTransaction(...a),afterWrite:async()=>afterWrite?.()},papers);
let afterWrite;
const schema={schemaVersion:PAPER_BASKET_V2_SCHEMA,sessionId:sid};
const oldSchema={...schema,schemaVersion:PAPER_BASKET_SCHEMA};
const blueprint={title:'卷内编辑受控合同',subject:'数学',grade:'初二',durationMinutes:40,totalPoints:10,mode:'source_only',sections:[{id:'a',label:'选择题',questionType:'选择题',count:1,points:10}]};
const q=question('V2',{questionType:'选择题'});
const ref=b=>({...schema,basketId:b.id});
const intent=(b,operation)=>({...ref(b),expectedRevision:b.revision,requestId:randomUUID(),operation});
const mutate=(b,op)=>v2.mutate(intent(b,op));
const snapshot=b=>v2.createSnapshot({...ref(b),expectedRevision:b.revision,requestId:randomUUID()});
const confirm=p=>papers.decide({schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:sid,id:p.id,revision:1,action:'confirm'},()=>true);
const review=(b,action='confirm')=>mutate(b,{type:'reviewEntry',entryId:b.entries[0].entryId,expectedInstanceRevision:b.entries[0].instance.instanceRevision,expectedContentDigest:b.entries[0].instance.contentDigest,action});
const edit=(b,content)=>mutate(b,{type:'editEntry',entryId:b.entries[0].entryId,expectedInstanceRevision:b.entries[0].instance.instanceRevision,content});
const all=t=>db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all();
const content={question:{mode:'edited',blocks:[{type:'text',text:'本卷题干哨兵：求下列结果。'},{type:'options',items:[{label:'甲',text:'选项甲哨兵'},{label:'乙',text:'选项乙哨兵'},{label:'丙',text:'选项丙哨兵'}]},{type:'subquestions',items:[{label:'1',text:'本卷小问哨兵'}]},{type:'table',rows:[['变量','值'],['x','2']]},{type:'text',text:'表后文字哨兵'}]},answer:{mode:'edited',blocks:[{type:'text',text:'本卷答案哨兵乙'}]},analysis:{mode:'edited',blocks:[{type:'text',text:'本卷解析哨兵：比较条件。'}]}};
const report={success:false,output,checks:[],boundary:'Source-only real SQLite/Office; controlled source adapters; no Electron/model/build; not product acceptance'};
async function check(name,action){await action();report.checks.push({name,pass:true});console.log('PASS '+name);}
let b,other,oldRequest,oldSnapshotRequest,priorPaper,sourceRows;
try {
 await check('Strict roles and operation schemas reject unknowns, getter, sparse, cycles, HTML, path, URL, data and byte overflow without invoking coercion',async()=>{
  assert(validPaperInstanceContent(content));assert(validPaperInstanceContent({...content,question:{mode:'edited',blocks:[{type:'text',text:'条件为0<x<1，计算x的范围。'}]}}));let invoked=false;
  for(const block of [{type:'text',text:'<img src=x>'},{type:'text',text:'https://example.com'},{type:'text',text:'C:\\secret.txt'},{type:'text',get text(){invoked=true;return 'x';}},{type:'formula',latex:'\\input{secret}'},{type:'sourceImage',role:{toString(){invoked=true;return 'question';}},blockId:'x',sourceVersion:'a'.repeat(64)}])assert(!validPaperInstanceContent({...content,question:{mode:'edited',blocks:[block]}}));
  assert(!validPaperInstanceContent({...content,question:{mode:'edited',blocks:new Array(2)}}));
  const cycle={mode:'edited'};cycle.blocks=[cycle];assert(!validPaperInstanceContent({...content,question:cycle}));
  assert(!validPaperInstanceContent({...content,question:{mode:'edited',blocks:Array.from({length:12},()=>({type:'text',text:'汉'.repeat(10000)}))}}));
  const hidden={type:'archive'};Object.defineProperty(hidden,'type',{value:'archive',enumerable:false});assert(!validPaperBasketV2Mutation({...schema,basketId:'xibasket_'+randomUUID(),expectedRevision:1,requestId:randomUUID(),operation:hidden}));
  assert(!invoked);
 });
 await check('V2 reads old basket without writes; v1 receipt/schema/history remain unchanged and two baskets share only parent source',async()=>{
  const original=await baskets.create({...oldSchema,requestId:randomUUID(),blueprint});
  const c=await baskets.candidate({...oldSchema,basketId:original.id,questionId:q.id});
  oldRequest={...oldSchema,basketId:original.id,requestId:randomUUID(),expectedRevision:original.revision,operation:{type:'add',questionId:q.id,sectionId:'a',expectedSourceVersion:c.contentVersion}};
  b=await baskets.mutate(oldRequest);oldSnapshotRequest={...oldSchema,basketId:b.id,requestId:randomUUID(),expectedRevision:b.revision};priorPaper=await confirm(await baskets.createSnapshot(oldSnapshotRequest));
  other=await v2.create({...schema,requestId:randomUUID(),blueprint});other=await mutate(other,{type:'add',questionId:q.id,sectionId:'a',expectedSourceVersion:c.contentVersion});
  const rows=all('paper_baskets'),receipts=all('paper_basket_operations');b=await v2.read(ref(b));
  assert.equal(b.persistedSchemaVersion,PAPER_BASKET_SCHEMA);assert.equal(b.entries[0].reviewCurrent,false);
  assert.deepEqual(all('paper_baskets'),rows);assert.deepEqual(all('paper_basket_operations'),receipts);sourceRows=all('questions');
  const measure=async action=>{const times=[];for(let n=0;n<12;n++){const start=performance.now();await action();times.push(performance.now()-start);}return times.sort((a,b)=>a-b)[6];};
  report.performance={scope:'12 sequential cold-connection reads per API, one controlled question, same v1 basket; not production P95',v1MedianMs:await measure(()=>baskets.read({...oldSchema,basketId:b.id})),v2AdapterMedianMs:await measure(()=>v2.read(ref(b)))};
 });
 await check('Edit atomically upgrades one basket; independent identities, original facts, other basket and old confirmed payload remain byte-identical',async()=>{
  const oldPaper=all('ai_confirmation_items');const otherBefore=await v2.read(ref(other));const entryId=b.entries[0].entryId;
  b=await edit(b,content);assert.equal(b.persistedSchemaVersion,PAPER_BASKET_V2_SCHEMA);assert.equal(b.entries[0].entryId,entryId);assert.equal(b.entries[0].instance.instanceRevision,2);
  assert.equal(b.entries[0].question.stem,q.stem);assert.notEqual(b.entries[0].instance.contentDigest,b.entries[0].contentVersion);
  assert.deepEqual(all('questions'),sourceRows);assert.deepEqual(await v2.read(ref(other)),otherBefore);assert.deepEqual(all('ai_confirmation_items'),oldPaper);
  assert.equal((await papers.review(sid,priorPaper.id)).sourceCurrent,false);
  await assert.rejects(snapshot(b),/conflict/);
 });
 await check('V1 list filters v2 with consistent total; v2 list includes both; v1 writes and old receipt retries never downgrade v2',async()=>{
  const old=await baskets.list(oldSchema),both=await v2.list(schema);assert.equal(old.total,0);assert.equal(both.total,2);
  await assert.rejects(baskets.mutate(oldRequest),/conflict/);assert.equal(all('paper_basket_operations').filter(r=>r.request_id===oldRequest.requestId).length,1);
  await assert.rejects(baskets.read({...oldSchema,basketId:b.id}),/conflict/);
  const retry=await baskets.createSnapshot(oldSnapshotRequest);assert.equal(retry.id,priorPaper.id);assert.equal(retry.sourceCurrent,false);
 });
 await check('Content and basket CAS, canonical retry, no-op save, changed request conflict and review digest binding',async()=>{
  const input=intent(b,{type:'editEntry',entryId:b.entries[0].entryId,expectedInstanceRevision:2,content:{...content,analysis:{mode:'edited',blocks:[{type:'text',text:'核对前解析哨兵'}]}}});
  b=await v2.mutate(input);const events=all('paper_instance_events').length,rev=b.revision;
  assert.equal((await v2.mutate(input)).revision,rev);assert.equal(all('paper_instance_events').length,events);
  await assert.rejects(v2.mutate({...input,requestId:randomUUID()}),/conflict/);
  await assert.rejects(v2.mutate({...input,operation:{...input.operation,content}}),/conflict/);
  b=await edit(b,b.entries[0].instance.content);assert.equal(b.revision,rev);assert.equal(all('paper_instance_events').length,events);
  await assert.rejects(mutate(b,{type:'reviewEntry',entryId:b.entries[0].entryId,expectedInstanceRevision:b.entries[0].instance.instanceRevision,expectedContentDigest:'0'.repeat(64),action:'confirm'}),/conflict/);
  b=await review(b);assert(b.complete);assert(b.entries[0].reviewCurrent);
 });
 await check('Exact immutable v2 snapshot contains edit, review and source binding; comparison sees same-source edits and answer/review differences',async()=>{
  const p=await confirm(await snapshot(b));assert.equal(p.selection.items[0].instance.contentDigest,b.entries[0].instance.contentDigest);assert.equal(p.selection.items[0].source.version,b.entries[0].contentVersion);assert.equal(p.answerVerified,false);
  const d=await papers.compare({schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:sid,leftId:priorPaper.id,rightId:p.id});assert.equal(d.items.changed.length,1);assert(d.items.changed[0].changes.some(c=>c.field==='instance.contentDigest'));assert(d.items.changed[0].changes.some(c=>c.field==='instance.answer'));
  const student=compilePaperOffice(p,'student'),teacher=compilePaperOffice(p,'teacher'),sheet=compilePaperOffice(p,'student','answer_sheet');
  assert(JSON.stringify(student).includes('本卷题干哨兵'));assert(!JSON.stringify(student).includes('本卷答案哨兵'));assert(JSON.stringify(teacher).includes('本卷答案哨兵'));assert(JSON.stringify(sheet).includes('甲 □'));assert(!JSON.stringify(sheet).includes('A □'));
  assertPaperOffice(p,teacher);const bad=structuredClone(teacher);bad.sections[2].paragraphs.push('任意改卷');assert.throws(()=>assertPaperOffice(p,bad),/conflict/);
  assert.equal(instanceRoleText(q,p.selection.items[0].instance,'answer'),'本卷答案哨兵乙');
 });
 await check('Reject invalidates delivery independently; restore increments content revision, clears review and restores pinned source only',async()=>{
  const previous=b.entries[0].instance.instanceRevision;b=await review(b,'reject');assert(!b.complete);assert.equal(b.entries[0].instance.instanceRevision,previous);await assert.rejects(snapshot(b),/conflict/);
  b=await mutate(b,{type:'restoreEntrySource',entryId:b.entries[0].entryId,expectedInstanceRevision:previous});assert.equal(b.entries[0].instance.instanceRevision,previous+1);assert.equal(b.entries[0].instance.review,undefined);assert.deepEqual(b.entries[0].instance.content,sourcePaperInstanceContent());
 });
 await check('Replacement preserves entryId, rejects duplicate or wrong-section source, and explicit same-question source update rebases only after candidate version check',async()=>{
  const id=b.entries[0].entryId,q2=question('replace',{questionType:'选择题'}),wrong=question('wrong');
  await assert.rejects(mutate(b,{type:'replaceEntry',entryId:id,expectedInstanceRevision:b.entries[0].instance.instanceRevision,questionId:wrong.id,expectedSourceVersion:(await v2.candidate({...ref(b),questionId:wrong.id})).contentVersion}),/invalid_input/);
  b=await mutate(b,{type:'replaceEntry',entryId:id,expectedInstanceRevision:b.entries[0].instance.instanceRevision,questionId:q2.id,expectedSourceVersion:(await v2.candidate({...ref(b),questionId:q2.id})).contentVersion});assert.equal(b.entries[0].entryId,id);assert.equal(b.entries[0].questionId,q2.id);
  b=await edit(b,content);const before=structuredClone(b.entries[0].instance);put({...q2,answer:'来源新答案'});
  b=await v2.read(ref(b));assert(!b.entries[0].availability.available);assert.deepEqual(b.entries[0].instance,before);await assert.rejects(review(b),/source_changed/);await assert.rejects(snapshot(b),/source_changed/);
  const c=await v2.candidate({...ref(b),questionId:q2.id});
  b=await mutate(b,{type:'replaceEntry',entryId:id,expectedInstanceRevision:before.instanceRevision,questionId:q2.id,expectedSourceVersion:c.contentVersion});assert.equal(b.entries[0].instance.content.answer.mode,'source');assert.equal(b.entries[0].contentVersion,c.contentVersion);
 });
 await check('Cancellation, loss of permission and write faults roll back state, instance events and receipt atomically',async()=>{
  const before=all('paper_baskets'),events=all('paper_instance_events'),receipts=all('paper_basket_operations');
  let live=true;afterWrite=async()=>{live=false;};await assert.rejects(v2.mutate(intent(b,{type:'editEntry',entryId:b.entries[0].entryId,expectedInstanceRevision:b.entries[0].instance.instanceRevision,content}),()=>live),/cancelled/);afterWrite=undefined;
  assert.deepEqual(all('paper_baskets'),before);assert.deepEqual(all('paper_instance_events'),events);assert.deepEqual(all('paper_basket_operations'),receipts);
  afterWrite=async()=>{throw Error('disk_failure');};await assert.rejects(edit(b,content),/disk_failure/);afterWrite=undefined;assert.deepEqual(all('paper_baskets'),before);
  await assert.rejects(v2.read({...ref(b),sessionId:f.other}),/permission_denied/);
 });
 await check('History has separate review events, bounded count/bytes and no inline unbounded history; cold repository reconstructs exact instance',async()=>{
  b=await edit(b,content);b=await review(b);const before=await v2.read(ref(b));
  const cold=new PaperBasketV2Repository({...host,saveSnapshot:(...a)=>papers.createBasketSnapshotInTransaction(...a),readSnapshot:(...a)=>papers.reviewInTransaction(...a)},papers);
  assert.deepEqual(await cold.read(ref(b)),before);assert(all('paper_instance_events').some(e=>e.operation_kind==='reviewEntry'));assert.equal('history' in before.entries[0],false);
  const probe=new DatabaseSync(f.file,{readOnly:true});assert(JSON.parse(probe.prepare('SELECT data_json FROM paper_baskets WHERE id=?').get(b.id).data_json).entries[0].instance.review);probe.close();
 });
 await check('Typed v2 IPC rejects untrusted frame and forged owner before acquiring write lease',async()=>{
  let calls=0;const api=createPaperBasketApi(baskets,()=>{calls++;return()=>true;},v2),handlers=new Map();registerPaperBasketIpc({ipcMain:{handle:(c,a)=>handlers.set(c,a)},allowed:e=>e==='main',host:api});assert.equal(handlers.size,12);
  assert.equal((await api.mutatePaperBasketV2({...intent(b,{type:'archive'}),studentId:f.student})).error,'invalid_input');assert.equal(calls,0);
  assert.equal((await handlers.get('education:paper-basket-v2-read')('other',ref(b))).error,'permission_denied');
 });

 await check('Edited answer excludes old answer screenshot, source roles keep source version, unsafe whole-image reuse stays a blocked draft',async()=>{
  const {nativeTestPng}=await import('./native-test-png.mjs');const {createHash}=await import('node:crypto');
  const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
  const {validQuestionDocument}=await import('../../src/shared/question-document.ts');
  const png=nativeTestPng(),sha=createHash('sha256').update(png).digest('hex');
  const rq=question('role-images',{questionType:'选择题'}),image=role=>({id:'source_'+role+'_0',kind:'image',anchors:[{page:1,box:[0,0,1,1]}],assetId:'asset_'+randomUUID(),sha256:sha,mime:'image/png',width:png.readUInt32BE(16),height:png.readUInt32BE(20)});
  const images=['question','answer','analysis'].map(image);
  rq.document={schemaVersion:'xiaozhi.question-document.v2',source:{resourceId:'resource_'+randomUUID(),resourceVersion:'c'.repeat(64),parserVersion:'teacher-transcription.v2+fixture',ocrVersion:''},blocks:images,answer:{origin:'source',text:rq.answer,anchors:images[1].anchors},analysis:{origin:'source',text:rq.analysis,anchors:images[2].anchors},context:{schemaVersion:'xiaozhi.question-projection.v1',projection:Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(k=>[k,k==='statement'?{state:'provided',text:rq.stem}:{state:'not_applicable',text:''}])),sourceBlockIds:[images[0].id]}};
  assert(validQuestionDocument(rq.document));put(rq);
  let rich=await v2.create({...schema,requestId:randomUUID(),blueprint});rich=await mutate(rich,{type:'add',questionId:rq.id,sectionId:'a',expectedSourceVersion:questionVersion(rq)});
  rich=await edit(rich,{question:{mode:'source'},answer:content.answer,analysis:{mode:'source'}});rich=await review(rich);
  const p=await confirm(await snapshot(rich)),student=compilePaperOffice(p,'student'),teacher=compilePaperOffice(p,'teacher');
  const figs=teacher.sections.flatMap(s=>s.figures||[]);assert.deepEqual(figs.map(i=>i.role),['question','analysis']);assert(figs.every(i=>i.version===questionVersion(rq)));assert(student.sections.flatMap(s=>s.figures||[]).every(i=>i.role==='question'));assert(!figs.some(i=>i.blockId===images[1].id));
  const {generateOfficeDocument}=await import('../../src/main/xiaozhi-agent/office-generator.ts');
  const imageData=path.join(output,'image-data');fs.mkdirSync(imageData);const imageFile=path.join(output,'role-edited-teacher.docx');
  const imageBytes=await generateOfficeDocument('docx',teacher,{dataRoot:imageData,images:new Map(images.map(i=>[i.assetId,png]))});fs.writeFileSync(imageFile,imageBytes);
  const imageXml=execFileSync('python',['-c',"import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read('word/document.xml'))",imageFile],{encoding:'utf8',windowsHide:true});
  assert(imageXml.includes('source_question_0'));assert(imageXml.includes('source_analysis_0'));assert(!imageXml.includes('source_answer_0'));assert(imageXml.includes('本卷答案哨兵乙'));report.richDocx=imageFile;
  rich=await edit(rich,{...content,question:{mode:'edited',blocks:[{type:'text',text:'显式修改'},{type:'sourceImage',role:'question',blockId:images[0].id,sourceVersion:questionVersion(rq)},...content.question.blocks.filter(b=>b.type==='options')]}});rich=await review(rich);assert.equal(rich.entries[0].deliveryBlock,'image_dependency');await assert.rejects(snapshot(rich),/conflict/);
 });
 await check('History cap rejects atomically without pruning prior events or consuming a receipt',async()=>{
  const cap=await v2.create({...schema,requestId:randomUUID(),blueprint});let c=await mutate(cap,{type:'add',questionId:q.id,sectionId:'a',expectedSourceVersion:(await v2.candidate({...ref(cap),questionId:q.id})).contentVersion});c=await edit(c,content);
  const event=db.prepare('SELECT * FROM paper_instance_events WHERE basket_id=? LIMIT 1').get(c.id);
  db.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<9999) INSERT INTO paper_instance_events SELECT session_id,student_id,basket_id,entry_id,event_id||n.x,instance_revision+n.x,operation_kind,before_digest,after_digest,data_json,created_at FROM paper_instance_events,n WHERE basket_id=? AND event_id=?`).run(c.id,event.event_id);
  const rows=all('paper_baskets'),receipts=all('paper_basket_operations');await assert.rejects(review(c),/unavailable/);assert.deepEqual(all('paper_baskets'),rows);assert.deepEqual(all('paper_basket_operations'),receipts);assert.equal(db.prepare('SELECT COUNT(*) n FROM paper_instance_events WHERE basket_id=?').get(c.id).n,10000);
 });

 await check('V2 edited generated parent still requires current owner/group/effect proof and source quota; approval loss keeps edited draft but refuses confirmation',async()=>{
  const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
  const generated=question('generated-v2',{questionType:'选择题',sourceKind:'generated'}),group=f.group([generated]);
  let g=await v2.create({...schema,requestId:randomUUID(),blueprint:{...blueprint,mode:'ai_original'}});
  g=await mutate(g,{type:'add',questionId:generated.id,sectionId:'a',expectedSourceVersion:questionVersion(generated)});g=await edit(g,content);g=await review(g);
  const pending=await snapshot(g),pinned=structuredClone(g.entries[0].instance);
  db.prepare('UPDATE generations SET body=? WHERE id=?').run(JSON.stringify({...group,effectDigest:'b'.repeat(64)}),group.id);
  g=await v2.read(ref(g));assert.equal(g.entries[0].availability.reason,'generation_unavailable');assert.deepEqual(g.entries[0].instance,pinned);await assert.rejects(snapshot(g),/source_changed/);await assert.rejects(confirm(pending),/source_changed/);
  db.prepare('UPDATE generations SET body=? WHERE id=?').run(JSON.stringify(group),group.id);
  const c=await v2.candidate({...ref(b),questionId:generated.id});assert(!c.eligibility.available);
 });
 await check('V2 UI preferences retain reviewed content revision and do not consume full domain allocation; domain receipt cap rolls back edits',async()=>{
  const before=b.revision,i=structuredClone(b.entries[0].instance);
  const row=db.prepare("SELECT * FROM paper_basket_operations WHERE session_id=? AND operation_kind='domain:mutate' LIMIT 1").get(sid);
  const current=db.prepare("SELECT COUNT(*) n FROM paper_basket_operations WHERE session_id=? AND operation_kind LIKE 'domain:%'").get(sid).n;
  db.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<?) INSERT INTO paper_basket_operations SELECT session_id,'capacity-v2-'||n.x,student_id,operation_kind,input_hash,basket_id,paper_id,result_revision,created_at FROM paper_basket_operations,n WHERE session_id=? AND request_id=?`).run(10000-current,sid,row.request_id);
  b=await mutate(b,{type:'updateUiState',uiState:{stage:'preview',filters:{},offset:0,scrollTop:25}});assert.equal(b.revision,before);assert.deepEqual(b.entries[0].instance,i);
  const beforeRows=all('paper_baskets');await assert.rejects(edit(b,{...content,analysis:{mode:'edited',blocks:[{type:'text',text:'不得保存'}]}}),/unavailable/);assert.deepEqual(all('paper_baskets'),beforeRows);
  // Owned synthetic capacity rows are removed after this boundary so subsequent actual Office checks exercise ordinary capacity.
  db.prepare("DELETE FROM paper_basket_operations WHERE request_id LIKE 'capacity-v2-%'").run();
 });
 // Use the actual Office state/service/installer, not a generator substitute.
 const workspace=path.join(output,'workspace'),dataRoot=path.join(output,'data');fs.mkdirSync(workspace);fs.mkdirSync(dataRoot);
 db.exec(`CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT,message_id TEXT,title TEXT,artifact_type TEXT,file_name TEXT,mime_type TEXT,description TEXT,content_md TEXT,file_path TEXT,file_size INTEGER,content_hash TEXT,status TEXT,error_message TEXT,created_at TEXT,updated_at TEXT)`);
 const state=createOfficeArtifactState({run:async(s,p=[])=>db.prepare(s).run(...p),all:async(s,p=[])=>db.prepare(s).all(...p),change:async(s,p=[])=>Number(db.prepare(s).run(...p).changes)});await state.migrate();let beforeCommit;
 const service=createOfficeArtifactService({state,dataRoot,resolvePaperImages:async()=>new Map(),workspace:async()=>workspace,isCurrent:()=>true,validatePaperDraft:async(owner,draft)=>assertPaperOffice(await papers.review(owner,draft.paperSource.paperId),draft),commitPaperDraft:async(owner,draft,install)=>{await beforeCommit?.();await papers.withConfirmedSource(owner,draft.paperSource.paperId,draft.paperSource.digest,p=>{assertPaperOffice(p,draft);install();});}});
 let paper=await confirm(await snapshot(b));
 await check('Actual Office pipeline saves and opens edited student/teacher/answer-sheet DOCX XML, preserving ordered blocks and answer isolation',async()=>{
  const files=[];
  for(const [audience,template] of [['student','paper'],['teacher','paper'],['student','answer_sheet']])for(const format of ['docx']) {
   const name=audience+'-'+template+'.'+format,draft=compilePaperOffice(paper,audience,template);
   const row=await service.propose(sid,'owned-instance-office',randomUUID(),{path:name,format,draft,sources:[]});
   await service.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:sid,draftId:row.id,revision:row.revision,action:'approve'});
   const result=await service.apply(sid,row.id);assert.equal(result.state,'saved');const file=path.join(workspace,name),bytes=fs.readFileSync(file);assert(bytes.length>100);assert.equal(bytes.subarray(0,format==='pdf'?4:2).toString(),format==='pdf'?'%PDF':'PK');files.push(file);
   const xml=execFileSync('python',['-c',"import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read('word/document.xml'))",file],{encoding:'utf8',windowsHide:true});
   if(template==='answer_sheet'){assert(xml.includes('甲 □'));assert(!xml.includes('本卷答案哨兵'));assert(!xml.includes('本卷题干哨兵'));}
   else {assert(xml.includes('本卷题干哨兵'));assert(xml.indexOf('本卷题干哨兵')<xml.indexOf('变量'));assert(xml.indexOf('变量')<xml.indexOf('表后文字哨兵'));assert(xml.includes('10 分'));assert.equal(xml.includes('本卷答案哨兵'),audience==='teacher');assert.equal(xml.includes('本卷解析哨兵'),audience==='teacher');}
  }
  report.files=files;report.deferred=['Three actual PDF outputs and visual Office/WPS opening require Electron, explicitly prohibited in this task'];
 });
 await check('Actual prepared-to-install refuses an instance edit, creates no file/fact, and retains all prior delivered bytes',async()=>{
  const beforeFiles=new Map(report.files.map(f=>[f,fs.readFileSync(f)])),facts=all('document_artifacts').length;
  const row=await service.propose(sid,'owned-instance-office',randomUUID(),{path:'must-refuse.docx',format:'docx',draft:compilePaperOffice(paper,'student'),sources:[]});await service.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:sid,draftId:row.id,revision:row.revision,action:'approve'});
  beforeCommit=async()=>{b=await edit(b,{...content,answer:{mode:'edited',blocks:[{type:'text',text:'安装前已修改'}]}});};
  await assert.rejects(service.apply(sid,row.id),/conflict/);assert(!fs.existsSync(path.join(workspace,'must-refuse.docx')));assert.equal(all('document_artifacts').length,facts);for(const [file,bytes]of beforeFiles)assert(fs.readFileSync(file).equals(bytes));
 });
 report.success=true;
} catch(error) {report.error=String(error?.stack||error);console.error(report.error);process.exitCode=1;}
finally{f.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:report.checks.length,output}));}
