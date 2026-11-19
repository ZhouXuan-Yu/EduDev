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
console.log('Structure and independent book answer checks: '+checks);
