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

async function prepare({pages, ambiguousPage, ...options}={}) {
  const f=fixture({currentAnswer:'',...options});
  const {db,pair,host}=f;
  const original={present:true};
  const structures=new MaterialStructureRepository({...host,verify:async(id,version,signal)=>{
    signal.throwIfAborted();
    if (!original.present||id!==pair.questionId||version!==pair.questionVersion) throw Error('source_changed');
  },unwrapBook:q=>f.repo.validatedSourceDocument(q)});
  await structures.migrate();
  host.structureScope=(q,signal)=>structures.bookScope(q,signal);
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
  const draft={...seed,answer:'',analysis:'',document,archive};
  const projection=Object.fromEntries(checked.map(role=>[role,{state:role==='statement'?'provided':'not_applicable',text:role==='statement'?seed.stem:''}]));
  const q=completeQuestion(draft,projection,new Date().toISOString());
  const input={schemaVersion:'xiaozhi.question-context-edit.v1',questionId:q.id,version:questionVersion(draft),requestId:'xicontext_'+randomUUID(),projection,complete:true};
  await structures.recordContext(input,q,questionVersion(q));
  db.prepare("UPDATE question_bank_items SET answer='',analysis='',archive_json=?,document_json=?,updated_at=? WHERE id=?")
    .run(JSON.stringify(archive),JSON.stringify(q.document),q.updatedAt,q.id);
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
