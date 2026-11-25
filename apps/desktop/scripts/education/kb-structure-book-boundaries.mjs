import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {fixture} from './kb-book-match-boundaries.mjs';
const {MaterialStructureRepository}=await import('../../src/main/assets/material-structure-repository.ts');
const {completeQuestion}=await import('../../src/main/education/question-context-revision.ts');
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {archiveEligible}=await import('../../src/shared/question-archive.ts');

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const title='第十三、十四章 素养基础测试卷';
const otherTitle='第十三、十四章 素养提优测试卷';
const docSchema='xiaozhi.document-structure.v1';
const checked=['statement','formulas','tables','figures','choices','subquestions'];
let checks=0;

async function prepare({pages, ambiguousPage, choiceLabels, ...options}={}) {
  const f=fixture({currentAnswer:'',...(choiceLabels?{answerIssues:[]}:{}),...options});
  if(choiceLabels)f.proofs.get(f.answerBatch).unit.bookPagePolicy='answer-entry-continued-table.v5';
  const {db,pair,host}=f;
  const original={present:true};
  const structures=new MaterialStructureRepository({...host,verify:async(id,version,signal)=>{
    signal.throwIfAborted();
    if (!original.present||id!==pair.questionId||version!==pair.questionVersion) throw Error('source_changed');
  },unwrapBook:q=>f.repo.validatedSourceDocument(q)});
  await structures.migrate();
  host.structureScope=(q,signal,mockTitles)=>structures.bookScope(q,signal,mockTitles);
  const legacyValidate=host.validate;
  host.validate=q=>q.archive.structure?structures.validate(q):legacyValidate(q);
  const seed=await f.read(),generation=randomUUID(),candidateId='sq_'+hash(seed.id).slice(0,40);
  const anchor={page:2,box:[.15,.2,.8,.4]};
  const empty={origin:'missing',text:'',anchors:[]};
  const source={resourceId:pair.questionId,resourceVersion:pair.questionVersion,parserVersion:'layout-paragraph-question.v5',ocrVersion:'test-ocr'};
  const document={schemaVersion:'xiaozhi.question-document.v1',source,blocks:[
    {id:'original',kind:'image',assetId:'asset_'+randomUUID(),sha256:hash('image'),mime:'image/png',width:320,height:160,anchors:[anchor]},
    {id:'transcription',kind:'text',text:seed.stem,anchors:[anchor]},
  ],answer:empty,analysis:{...empty}};
  if(choiceLabels)document.blocks.push({kind:'choices',id:'original-choices',anchors:[anchor],
    options:[...choiceLabels].map(label=>({label,blocks:[{kind:'text',id:'option-'+label,text:'选项'+label,anchors:[anchor]}]}))});
  const paragraph=(id,rawText,role='heading',number)=>({id,rawText,role,...(number?{marker:{kind:'parent',label:number}}:{})});
  const start=paragraph('start','1. '+seed.stem,'question','1');
  const evidencePages=pages?.(paragraph,start)??[[paragraph('title',title)],[start]];
  evidencePages.forEach((paragraphs,index)=>{
    const pg={schemaVersion:docSchema,resourceId:pair.questionId,version:pair.questionVersion,page:index+1,paragraphs,
      issues:index+1===ambiguousPage?['ambiguous_columns']:[]};
    db.prepare('INSERT INTO material_structure_pages VALUES(?,?,?,?,?)').run(generation,pg.page,JSON.stringify(pg),'',hash(pg));
  });
  const question={id:candidateId,kind:'question',number:'1',pageRange:[2,2],paragraphIds:[start.id],status:'candidate',issues:[]};
  const body={question,document};
  const reference={schemaVersion:docSchema,resourceId:pair.questionId,version:pair.questionVersion,generation,candidateId,sha256:hash(body)};
  db.prepare('INSERT INTO material_structure_questions VALUES(?,?,?,?,?,?,?,?)').run(generation,candidateId,2,2,question.status,JSON.stringify(question),JSON.stringify(document),reference.sha256);
  const archive={schemaVersion:'xiaozhi.question-archive.structure.v1',extractor:'layout-question.v1',state:'teacher_edited',number:'1',
    sources:[{schemaVersion:'xiaozhi.material-source.v1',resourceId:pair.questionId,version:pair.questionVersion,offset:0,chunkId:'chunk_'+randomUUID(),bodyVersion:hash('source')}],
    issues:['missing_answer','missing_analysis'],sourceRisks:[],sourceChecked:true,answerOrigin:'missing',analysisOrigin:'missing',structure:reference};
  const draft={...seed,answer:'',analysis:'',document,archive,...(choiceLabels?{questionType:'选择题'}:{})};
  const projection=Object.fromEntries(checked.map(role=>[role,{state:role==='statement'?'provided':'not_applicable',text:role==='statement'?seed.stem:''}]));
  if(choiceLabels)projection.choices={state:'provided',text:[...choiceLabels].map(label=>label+'. 选项'+label).join('\n')};
  const q=completeQuestion(draft,projection,new Date().toISOString());
  const input={schemaVersion:'xiaozhi.question-context-edit.v1',questionId:q.id,version:questionVersion(draft),requestId:'xicontext_'+randomUUID(),projection,complete:true};
  await structures.recordContext(input,q,questionVersion(q));
  db.prepare("UPDATE question_bank_items SET answer='',analysis='',archive_json=?,document_json=?,updated_at=?,question_type=? WHERE id=?")
    .run(JSON.stringify(archive),JSON.stringify(q.document),q.updatedAt,q.questionType,q.id);
  db.prepare('DELETE FROM material_ai_members').run();
  await f.init();
  await structures.validate(await f.read());
  const query=async()=>({schemaVersion:'xiaozhi.material-structure-book-match.v1',questionId:q.id,version:questionVersion(await f.read())});
  return {...f,original,query,structures,matchStructure:async()=>f.repo.match(await query())};
}

async function check(name,options,run) {
  const f=await prepare(options);
  try{await run(f);checks++;console.log('PASS '+name);}
  finally{f.db.close();}
}
await check('Prior-page title and authenticated teacher structure reuse the exact answer index and provenance',{},async f=>{
  const before=await f.read(),view=await f.matchStructure(),after=await f.read();
  assert.equal(view.rows[0].state,'applied');
  assert.equal(view.rows[0].section,title);
  assert.equal(after.answer,'D');
  assert.equal(after.document.answer.book.source.resourceId,f.pair.answerId);
  assert.deepEqual(after.document.blocks,before.document.blocks);
  assert.deepEqual(after.document.context,before.document.context);
  assert(archiveEligible(after));
  await f.structures.validate(after);
  assert.equal((await f.matchStructure()).rows[0].state,'applied');
  assert.equal(f.db.prepare('SELECT count(*) n FROM material_book_answer_journal_v1').get().n,1);
  f.original.present=false;
  await assert.rejects(f.structures.validate(after),/source_changed/);
});
await check('A Shanghai mock exam and its independent answer heading identify the same numbered entry',{
  pages:(p,q)=>[[p('title','2025年上海市徐汇区九年级数学一模试卷（A卷）')],[q]],
  answerText:'2025年上海徐汇区初三数学一模参考答案（A卷）\n1. D\n解析：条件与选项一致。',
},async f=>{
  const view=await f.matchStructure(),after=await f.read();
  assert.equal(view.rows[0].state,'applied');
  assert.equal(after.answer,'D');
  assert.equal(after.document.answer.book.source.resourceId,f.pair.answerId);
  await f.structures.validate(after);
});
const mockPaper='2025年上海市徐汇区九年级数学一模试卷（A卷）';
const mockAnswer='2025年上海徐汇区初三数学一模参考答案（A卷）';
const withMockTitle=(p,q)=>[[p('title',mockPaper)],[q]];
const numberedAnswer='\n1. 答案：48平方米\n解析：8乘以6得48。';
for(const shared of [true,false]){
 await check(shared?'A second paper reuses a verified answer original under a complete exam identity':
   'An ordinary section cannot use a different paper’s answer transcription',{
  pages:shared?withMockTitle:undefined,answerText:(shared?mockAnswer:title)+numberedAnswer,
 },async f=>{
  const anchor={...f.pair,kind:'answers',questionId:'resource_'+randomUUID()};
  f.proofs.get(f.answerBatch).unit.bookRole=anchor;
  const oldRole=f.host.role;
  f.host.role=id=>id===anchor.answerId?Promise.resolve(anchor):oldRole(id);
  const result=(await f.matchStructure()).rows[0];
  if(shared){
   assert.equal(result.state,'applied');
   assert.equal((await f.read()).answer,'48平方米');
   const row=f.db.prepare('SELECT evidence_json FROM material_book_answer_journal_v1').get();
   assert.equal(JSON.parse(row.evidence_json).answerSharing,'shared-exam-answer.v1');
   await f.structures.validate(await f.read());
  }else{
   assert.equal(result.state,'held');
   assert.equal((await f.read()).answer,'');
  }
 });
}
for(const [paper,answer] of [
 ['2025 年上海市徐汇区\n九年级数学一模试卷（A卷）','2025 年上海徐汇区初三数学一模\n参考答案（A卷）'],
 ['2025 年上海市\n奉贤区高二物理二模\n试题（乙卷）','2025年上海奉贤区高二年级物理2模\n参考解答\n（乙卷）'],
]){
 await check('A printed heading wrapped over adjacent lines preserves the exact exam identity',{
  pages:(p,q)=>[paper.split('\n').map((line,index)=>p('line-'+index,line)),[q]],
  answerText:mockAnswer.replace('徐汇','虹口')+'\n1. B\n解析：另一份。\n'+answer+numberedAnswer,
 },async f=>{
  const view=await f.matchStructure(),after=await f.read();
  assert.equal(view.rows[0].state,'applied');
  assert.equal(after.answer,'48平方米');
  await f.structures.validate(after);
 });
}
await check('An incomplete wrapped heading ends the previous exam scope',{
 pages:withMockTitle,answerText:mockAnswer+'\n1. 答案：D\n解析：上一份。\n2025年上海虹口区\n初三一模参考答案（A卷）\n2. 答案：B\n解析：另一份。',
},async f=>{
 const rows=f.db.prepare("SELECT number,section_key FROM material_book_answer_index_v1 WHERE start>=0 ORDER BY start").all();
 assert.deepEqual(rows.map(row=>[row.number,row.section_key]),[['1',mockAnswer.normalize('NFKC')],['2','']]);
 assert.equal((await f.matchStructure()).rows[0].state,'applied');
});
await check('Upgrading a v5 index replays the saved pages without changing the original receipts',{
 pages:(p,q)=>[[p('prefix','2025年上海市徐汇区'),p('main','九年级数学一模试卷（A卷）')],[q]],
 answerText:'2025年上海徐汇区\n初三数学一模参考答案（A卷）'+numberedAnswer,
},async f=>{
 const original=JSON.stringify([...f.proofs]);
 f.db.exec("UPDATE material_book_answer_index_v1 SET lookup_key='' WHERE start>=0;UPDATE material_book_answer_control_v1 SET section_policy=5;");
 assert.equal(await f.repo.index.pending(),false);
 await f.repo.migrate();
 assert.equal(await f.repo.index.pending(),true);
 await f.init();
 assert.equal(f.db.prepare('SELECT section_policy FROM material_book_answer_control_v1').get().section_policy,8);
 assert.equal((await f.matchStructure()).rows[0].state,'applied');
 assert.equal(JSON.stringify([...f.proofs]),original);
});
await check('Printed term identity ignores other events but preserves source validation and the v3 receipt',{
 pages:(p,q)=>[[p('front','松江区2024学年度第一学期期末质量监控试卷'),p('grade','高三数学')],[q]],
 answerText:'松江区2024学年度第二学期期末质量监控试卷\n高三数学答案\n1. B\n解析：第二学期。\n'+
   '松江区2024学年度第一学期期末质量监控试卷\n高三数学答案'+numberedAnswer,
},async f=>{
 const original=JSON.stringify([...f.proofs]);
 const view=await f.matchStructure(),after=await f.read();
 assert.equal(view.rows[0].state,'applied');
 assert.equal(after.answer,'48平方米');
 assert.equal(JSON.parse(f.db.prepare('SELECT evidence_json FROM material_book_answer_journal_v1').get().evidence_json).sectionProjection,'shanghai-mock-sections.v3');
 await f.structures.validate(after);
 assert.equal(JSON.stringify([...f.proofs]),original);
});
await check('A compact key waits for its independent choice range, then applies and verifies its exact PDF receipt',{
 choiceLabels:'ABCD',answerText:title+'\n选择题答案（第1～2题）：D、D',
},async f=>{
 f.db.exec('CREATE TABLE material_pdf_jobs(resource_id TEXT PRIMARY KEY,generation TEXT,version TEXT);'+
   'CREATE TABLE material_pdf_pages(generation TEXT,page INTEGER,status TEXT,result_json TEXT,PRIMARY KEY(generation,page));');
 assert.equal((await f.matchStructure()).rows[0].reason,'choice_range_unchecked');
 assert.equal((await f.read()).answer,'');
 const {questionId,questionVersion:version}=f.pair,generation=randomUUID();
 const body='二、单项选择题（本大题共2题，第1～2题每题4分）\n1. 该题印刷原文\n2. 相邻题';
 const ocr={status:'complete',error:'',method:'ocr',text:body,nativeText:'',ocrText:body,width:1697,height:2400,imageArea:1,nativeBoxes:[]};
 f.db.prepare('INSERT INTO material_pdf_jobs VALUES(?,?,?)').run(questionId,generation,version);
 f.db.prepare("INSERT INTO material_pdf_pages(generation,page,status,result_json) VALUES(?,2,'complete',?)").run(generation,JSON.stringify(ocr));
 assert.equal((await f.matchStructure()).rows[0].state,'applied');
 const saved=await f.read();
 assert.equal(saved.answer,'D');
 assert.equal(saved.analysis,'');
 const journal=JSON.parse(f.db.prepare("SELECT evidence_json FROM material_book_answer_journal_v1 WHERE after_json<>''").get().evidence_json);
 assert.deepEqual(journal.compactChoice.range,[1,2]);
 assert.equal(journal.compactChoice.page,2);
 await f.structures.validate(saved);
 f.db.prepare('UPDATE material_pdf_pages SET result_json=? WHERE generation=?').run(JSON.stringify({...ocr,text:body.replace('第1～2题','第2～3题')}),generation);
 await assert.rejects(()=>f.structures.validate(saved),/source_changed/);
});
await check('Ordinary explanations on the same page freeze the compact row boundary for later source readback',{
 choiceLabels:'ABCD',answerText:title+'\n1. D\n解析：原文到此结束。\n选择题答案（第13～16题）：DCCA',
},async f=>{
 assert.equal((await f.matchStructure()).rows[0].state,'applied');
 const saved=await f.read();
 assert.equal(saved.analysis,'原文到此结束。');
 const proof=JSON.parse(f.db.prepare('SELECT evidence_json FROM material_book_answer_journal_v1').get().evidence_json);
 assert.equal(proof.answerParsing,'printed-compact-choice.v1');
 assert(!proof.compactChoice);
 await f.structures.validate(saved);
});
await check('Mixed district answer pages retain exact numeric text for the correct matching edition',{
 pages:withMockTitle,answerText:mockAnswer.replace('徐汇','虹口')+'\n1. B\n解析：另一份。\n'+mockAnswer+numberedAnswer,
},async f=>{
 assert.equal((await f.matchStructure()).rows[0].state,'applied');
 const q=await f.read();
 assert.equal(q.answer,'48平方米');
 assert.equal(q.analysis,'8乘以6得48。');
 await f.structures.validate(q);
});
for(const [label,replacement] of [['district','虹口区'],['round','二模'],['edition','B卷'],['unlabeled edition',''],['year','2024']]){
 const other=label==='district'?mockAnswer.replace('徐汇区',replacement):label==='round'?mockAnswer.replace('一模',replacement):
   label==='edition'?mockAnswer.replace('A卷',replacement):label==='year'?mockAnswer.replace('2025',replacement):mockAnswer.replace('（A卷）','');
 await check('Matching number cannot cross '+label,{pages:withMockTitle,answerText:other+numberedAnswer},async f=>{
  assert.equal((await f.matchStructure()).rows[0].reason,'answer_not_found');
  assert.equal((await f.read()).answer,'');
 });
}
await check('A missing question number is explicit even with a fully matching cover',{
 pages:withMockTitle,answerText:mockAnswer+numberedAnswer.replace('1.','2.'),
},async f=>{
 assert.equal((await f.matchStructure()).rows[0].reason,'answer_not_found');
 assert.equal((await f.read()).answer,'');
});
await check('Aliases that resolve to two printed copies of the same number remain ambiguous',{
 pages:withMockTitle,answerText:mockAnswer+numberedAnswer+'\n'+mockAnswer.replace('初三','九年级')+numberedAnswer,
},async f=>{
 assert.equal((await f.matchStructure()).rows[0].reason,'ambiguous_answer');
 assert.equal((await f.read()).answer,'');
});
await check('A visibly incomplete mock heading blocks inheritance from a different preceding exam',{
 pages:(p,q)=>[[p('old',title)],[p('new','2025年上海徐汇区九年级一模试卷（A卷）'),q]],
},async f=>{
 assert.equal((await f.matchStructure()).rows[0].reason,'missing_section');
 assert.equal((await f.read()).answer,'');
});
await check('A historical applied chapter answer still authenticates in legacy scope',{},async f=>{
 assert.equal((await f.matchStructure()).rows[0].state,'applied');
 const receipt=f.db.prepare('SELECT id,evidence_json FROM material_book_answer_journal_v1').get();
 const evidence=JSON.parse(receipt.evidence_json);
 delete evidence.sectionProjection;
 f.db.prepare('UPDATE material_book_answer_journal_v1 SET evidence_json=? WHERE id=?').run(JSON.stringify(evidence),receipt.id);
 await f.structures.validate(await f.read());
});
await check('A standalone edition line prevents linking to an edition-free answer key',{
 pages:(p,q)=>[[p('heading',mockPaper.replace('（A卷）','')),p('edition','（A卷）')],[q]],
 answerText:mockAnswer.replace('（A卷）','')+numberedAnswer,
},async f=>{
 assert.equal((await f.matchStructure()).rows[0].reason,'answer_not_found');
 assert.equal((await f.read()).answer,'');
});
await check('A conflicting edition line prevents automatic matching',{
 pages:(p,q)=>[[p('heading',mockPaper),p('edition','B卷')],[q]],answerText:mockAnswer+numberedAnswer,
},async f=>{
 assert.equal((await f.matchStructure()).rows[0].reason,'missing_section');
 assert.equal((await f.read()).answer,'');
});
await check('A historical single-line Shanghai match validates with its original parsing policy',{
 pages:withMockTitle,answerText:mockAnswer+numberedAnswer,
},async f=>{
 assert.equal((await f.matchStructure()).rows[0].state,'applied');
 const receipt=f.db.prepare('SELECT id,evidence_json FROM material_book_answer_journal_v1').get();
 const evidence=JSON.parse(receipt.evidence_json);
 evidence.sectionProjection='shanghai-mock-sections.v1';
 f.db.prepare('UPDATE material_book_answer_journal_v1 SET evidence_json=? WHERE id=?').run(JSON.stringify(evidence),receipt.id);
 await f.structures.validate(await f.read());
});
await check('Same number and different section return no answer',{answerText:otherTitle+'\n1. B 解析：另一份试卷。'},async f=>{
  assert.equal((await f.matchStructure()).rows[0].reason,'answer_not_found');
  assert.equal((await f.read()).answer,'');
});
await check('Unsupported new title terminates the previous section',{pages:(p,q)=>[[p('old',title)],[p('new','第十五章'),q]]},async f=>{
  assert.equal((await f.matchStructure()).rows[0].reason,'missing_section');
  assert.equal((await f.read()).answer,'');
});
await check('An ambiguous column order cannot supply an inherited section',{ambiguousPage:1},async f=>{
  assert.equal((await f.matchStructure()).rows[0].reason,'missing_section');
  assert.equal((await f.read()).answer,'');
});
await check('Duplicate parent number under the same title is held',{pages:(p,q)=>[[p('title',title),p('old','1. 另一道同号题','question','1')],[q]]},async f=>{
  assert.equal((await f.matchStructure()).rows[0].reason,'missing_section');
  assert.equal((await f.read()).answer,'');
});
await check('Answer receipt from another book cannot authorize a write',{},async f=>{
  f.proofs.get(f.answerBatch).unit.bookRole={...f.pair,kind:'answers',questionId:'resource_'+randomUUID()};
  assert.equal((await f.matchStructure()).rows[0].reason,'source_changed');
  assert.equal((await f.read()).answer,'');
});
await check('Source mutation between index lookup and the fact transaction rolls back the journal',{},async f=>{
  const original=f.host.structureScope;
  let calls=0;
  f.host.structureScope=(q,signal)=>{
    if(++calls===2) f.original.present=false;
    return original(q,signal);
  };
  const version=questionVersion(await f.read());
  await assert.rejects(f.matchStructure(),/source_changed/);
  assert.equal(questionVersion(await f.read()),version);
  assert.equal(f.db.prepare('SELECT count(*) n FROM material_book_answer_journal_v1').get().n,0);
});
await check('Stale teacher version is rejected and no facts change',{},async f=>{
  const input=await f.query();
  f.db.prepare("UPDATE question_bank_items SET updated_at='2026-11-21'").run();
  await assert.rejects(f.repo.match(input),/source_changed/);
  assert.equal((await f.read()).answer,'');
});
async function settle(f,repo=f.repo){
  const signal=new AbortController().signal;
  for(let count=0;count<20;count++)if(!await repo.drain(signal))return;
  assert.fail('Did not drain the local book work');
}
await check('A pre-existing checked structure has durable discovery and resumes in a new repository instance',{},async f=>{
  const before=await f.read();
  assert(await f.repo.work.structures.discoveryPending());
  const stopped=new AbortController();
  stopped.abort();
  await assert.rejects(f.repo.drain(stopped.signal));
  assert(await f.repo.work.structures.discoveryPending());
  const resumed=new f.repo.constructor(f.host);
  await resumed.migrate();
  await settle(f,resumed);
  const after=await f.read();
  assert.equal(after.answer,'D');
  assert.equal(after.archive.analysisOrigin,'book_extracted');
  assert.deepEqual(after.document.blocks,before.document.blocks);
  assert.deepEqual(after.document.context,before.document.context);
  assert.equal(f.db.prepare('SELECT count(*) n FROM material_ai_members').get().n,0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM material_book_answer_journal_v1').get().n,1);
});
await check('A late indexed original answer wakes an already checked structure after a held attempt',{},async f=>{
  const answer=f.db.prepare('SELECT * FROM material_ai_page_units WHERE batch_id=?').get(f.answerBatch);
  f.db.prepare('DELETE FROM material_ai_page_units WHERE batch_id=?').run(f.answerBatch);
  await settle(f);
  assert.equal((await f.repo.list(await f.query())).rows[0].reason,'answer_not_found');
  assert.equal((await f.read()).answer,'');
  f.db.prepare('INSERT INTO material_ai_page_units VALUES(?,?,?)').run(answer.batch_id,answer.ordinal,answer.final_sha);
  while(await f.repo.indexOne()){}
  assert.deepEqual(f.db.prepare('SELECT number FROM material_structure_book_sweeps_v1').all().map(row=>row.number),['1']);
  await settle(f);
  assert.equal((await f.read()).answer,'D');
  assert.equal((await f.repo.list(await f.query())).rows[0].state,'applied');
  assert.equal(f.db.prepare("SELECT count(*) n FROM material_book_answer_journal_v1 WHERE after_json<>''").get().n,1);
});
await check('A teacher save refreshes the work token and a stale worker cannot finish it',{},async f=>{
  await f.repo.work.structures.discover();
  const old=await f.repo.work.structures.next();
  f.db.prepare('UPDATE question_bank_items SET document_json=document_json WHERE id=?').run(f.questionId);
  const current=await f.repo.work.structures.next();
  assert.notEqual(current.ticket,old.ticket);
  assert.equal(await f.repo.work.structures.current(old),false);
  await f.repo.work.structures.finish(old);
  assert.deepEqual(await f.repo.work.structures.next(),current);
  await settle(f);
  assert.equal((await f.read()).answer,'D');
});
await check('An unlinked pair invalidates a running match and relinking the same originals wakes it',{},async f=>{
  const find=f.repo.index.find.bind(f.repo.index);
  let interrupted=false;
  f.repo.index.find=async(...args)=>{
    const result=await find(...args);
    if(!interrupted){
      interrupted=true;
      f.db.prepare('UPDATE material_book_pairs SET active=0,revision=2').run();
    }
    return result;
  };
  await settle(f);
  assert(interrupted);
  assert.equal((await f.read()).answer,'');
  assert.equal(f.db.prepare('SELECT count(*) n FROM material_book_answer_journal_v1').get().n,0);
  f.pair.revision=3;
  f.db.prepare('UPDATE material_book_pairs SET active=1,revision=3').run();
  await settle(f);
  assert.equal((await f.read()).answer,'D');
});
await check('Hidden and unconfirmed drafts never consume answers, including a hidden change during matching',{},async f=>{
  const q=await f.read();
  f.db.prepare('UPDATE question_bank_items SET archive_json=? WHERE id=?').run(JSON.stringify({...q.archive,sourceChecked:false}),q.id);
  await settle(f);
  assert.equal((await f.read()).answer,'');
  f.db.prepare('UPDATE question_bank_items SET archive_json=? WHERE id=?').run(JSON.stringify(q.archive),q.id);
  const find=f.repo.index.find.bind(f.repo.index);
  f.repo.index.find=async(...args)=>{
    const result=await find(...args);
    f.db.prepare("INSERT OR IGNORE INTO material_structure_hidden_questions VALUES(?,?,?,'superseded')").run(q.id,q.archive.structure.resourceId,q.archive.structure.generation);
    return result;
  };
  await settle(f);
  assert.equal((await f.read()).answer,'');
  assert.equal(f.db.prepare('SELECT count(*) n FROM material_book_answer_journal_v1').get().n,0);
});
await check('A local worker fills a missing explanation and preserves the teacher answer and its attribution',{},async f=>{
  const q=await f.read();
  const document={...q.document,answer:{origin:'teacher',text:'D',anchors:[]}};
  const archive={...q.archive,answerOrigin:'teacher',issues:['missing_analysis']};
  f.db.prepare('UPDATE question_bank_items SET answer=?,archive_json=?,document_json=? WHERE id=?').run('D',JSON.stringify(archive),JSON.stringify(document),q.id);
  await settle(f);
  const after=await f.read();
  assert.equal(after.answer,'D');
  assert.equal(after.archive.answerOrigin,'teacher');
  assert.deepEqual(after.document.answer,document.answer);
  assert.equal(after.archive.analysisOrigin,'book_extracted');
  assert(await f.structures.validate(after));
});
await check('Disagreement with a teacher answer is journaled without preventing a corrected answer page from filling the gap',{},async f=>{
  const q=await f.read();
  const document={...q.document,answer:{origin:'teacher',text:'B',anchors:[]}};
  const archive={...q.archive,answerOrigin:'teacher',issues:['missing_analysis']};
  f.db.prepare('UPDATE question_bank_items SET answer=?,archive_json=?,document_json=? WHERE id=?').run('B',JSON.stringify(archive),JSON.stringify(document),q.id);
  const before=questionVersion(await f.read());
  await settle(f);
  assert.equal((await f.repo.list(await f.query())).rows[0].reason,'existing_answer_conflict');
  assert.equal(questionVersion(await f.read()),before);
  const proof=f.proofs.get(f.answerBatch);
  const restored=title+'\n1. B 解析：这是重新核对的参考解析。';
  proof.first={...proof.first,pageText:restored};
  proof.final={...proof.final,pageText:restored};
  proof.firstSha=hash(proof.first);
  proof.finalSha=hash(proof.final);
  f.db.prepare('UPDATE material_ai_page_units SET final_sha=? WHERE batch_id=?').run(proof.finalSha,f.answerBatch);
  await settle(f);
  const after=await f.read();
  assert.equal(after.answer,'B');
  assert.equal(after.archive.answerOrigin,'teacher');
  assert.equal(after.archive.analysisOrigin,'book_extracted');
});
await check('An answer is held when it cannot be reconciled with the existing teacher explanation',{},async f=>{
  const q=await f.read();
  const existing='由题意知，正确选项为 B。';
  const document={...q.document,analysis:{origin:'teacher',text:existing,anchors:[]}};
  const archive={...q.archive,analysisOrigin:'teacher',issues:['missing_answer']};
  f.db.prepare('UPDATE question_bank_items SET analysis=?,archive_json=?,document_json=? WHERE id=?').run(existing,JSON.stringify(archive),JSON.stringify(document),q.id);
  await settle(f);
  assert.equal((await f.read()).answer,'');
  assert.equal((await f.read()).analysis,existing);
  assert.equal((await f.repo.list(await f.query())).rows[0].reason,'protected_analysis_mismatch');
});
await check('Stable original identity shares whole-file hashing across book jobs; a changed file forces reauthentication',{},async ()=>{
  const {verifyStampedOriginal}=await import('../../src/main/assets/material-original.ts');
  let stamp='original',hashes=0;
  const signal=new AbortController().signal,key=randomUUID();
  const verify=()=>verifyStampedOriginal(key,async()=>stamp,async()=>{hashes++;if(stamp!=='original')throw Error('source_changed');},signal);
  for(let i=0;i<100;i++)await verify();
  assert.equal(hashes,1);
  stamp='different';
  await assert.rejects(verify(),/source_changed/);
  assert.equal(hashes,2);
});
console.log('Structure and independent book answer checks: '+checks);
