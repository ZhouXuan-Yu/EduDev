import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {QUESTION_DOCUMENT_SCHEMA,validQuestionDocument,readQuestionDocument} from '../../src/shared/question-document.ts';
import {ensureQuestionDocumentColumn} from '../../src/main/education/question-document-migration.ts';
import {questionVersion,readQuestionContextSource,createQuestionContextProvider} from '../../src/main/education/question-context-provider.ts';
import {resetQuestionProjectionCoverage,validQuestionProjection} from '../../src/shared/question-projection.ts';
import {questionFactConflicts} from '../../src/shared/question-facts.ts';
import {registerQuestionContextIpc} from '../../src/main/education/question-context-api.ts';
export function questionDocumentFixture(){
 const anchors=[{page:6,box:[0.1,0.2,0.9,0.8]}];
 return{schemaVersion:QUESTION_DOCUMENT_SCHEMA,source:{resourceId:'resource_'+randomUUID(),resourceVersion:'a'.repeat(64),parserVersion:'synthetic-contract.v1',ocrVersion:'synthetic.v1'},
  blocks:[{id:'stem',kind:'text',text:'仅合同夹具：根据表格及电路图说明电阻。',anchors},
   {id:'equation',kind:'latex',text:'R=\\frac{U}{I}',anchors},
   {id:'figure',kind:'image',assetId:'asset_'+randomUUID(),sha256:'b'.repeat(64),mime:'image/png',width:800,height:600,anchors},
   {id:'table',kind:'table',rows:[[{kind:'text',text:'U/V'},{kind:'latex',text:'I/\\mathrm{A}'}],[{kind:'text',text:'3'},{kind:'text',text:'0.3'}]],anchors},
   {id:'part',kind:'subquestion',label:'(1)',anchors,blocks:[{id:'choices',kind:'choices',anchors,options:[{label:'A',blocks:[{id:'a',kind:'text',text:'10Ω',anchors}]},{label:'B',blocks:[{id:'b',kind:'latex',text:'20\\Omega',anchors}]}]}]}],
  answer:{origin:'missing',text:'',anchors:[]},analysis:{origin:'ai_generated',text:'合成候选：尚未验证。',anchors:[],generator:{provider:'synthetic',model:'synthetic',runId:'synthetic-run'}}};
}
export async function questionDocumentBoundaries(check){
 const doc=questionDocumentFixture(),copy=()=>structuredClone(doc);
 await check('Read rejects conflicting answer or analysis mirrors even in legacy v1, without rewriting identity or stored facts',async()=>{
  const document={...copy(),answer:{origin:'source',text:'x = 3',anchors:doc.blocks[0].anchors}};
  const q={id:'question_'+randomUUID(),subject:'数学',grade:'初一',knowledgePoint:'合同夹具',questionType:'解答题',difficulty:'easy',stem:'旧摘要允许独立于原图块',answer:document.answer.text,analysis:document.analysis.text,sourceTitle:'合成合同来源',sourceKind:'teacher_resource',tags:[],createdAt:'2026-10-09',updatedAt:'2026-10-09',document};
  const initial=JSON.stringify(q),identity=questionVersion(q);
  assert.deepEqual((await readQuestionContextSource({getQuestionNotebookEntry:async()=>q},{questionId:q.id,version:identity})).question,q);
  for(const field of ['answer','analysis']){
   const bad={...q,[field]:'保密冲突文本：不得与原件出处混合'},bytes=JSON.stringify(bad),version=questionVersion(bad);
   await assert.rejects(readQuestionContextSource({getQuestionNotebookEntry:async()=>bad},{questionId:q.id,version}),/question_fact_conflict/);
   let handler;registerQuestionContextIpc({ipcMain:{handle:(name,fn)=>{assert.equal(name,'questions:context-source');handler=fn;}},allowed:()=>true,store:{getQuestionNotebookEntry:async()=>bad}});
   assert.deepEqual(await handler({}, {schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version}),{ok:false,error:'question_fact_conflict'});
   assert.deepEqual(await handler({}, {schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:identity}),{ok:false,error:'source_changed'});
   assert.equal(JSON.stringify(bad),bytes);assert.equal(questionVersion(bad),version);
  }
  let safeHandler;registerQuestionContextIpc({ipcMain:{handle:(_,fn)=>safeHandler=fn},allowed:()=>true,store:{getQuestionNotebookEntry:async()=>{throw new Error('保密内部失败：D:/private');}}});
  assert.deepEqual(await safeHandler({}, {schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:identity}),{ok:false,error:'unavailable'});
  assert.equal(JSON.stringify(q),initial);assert.equal(questionVersion(q),identity);
 });
 const completeFixture=()=>{
  const projection=Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(key=>[key,{state:key==='statement'?'provided':'not_applicable',text:key==='statement'?'合同题面：x + 2 = 5，求实数x。':''}]));
  const document={...copy(),schemaVersion:'xiaozhi.question-document.v2',answer:{origin:'source',text:'x = 3',anchors:doc.blocks[0].anchors},context:{schemaVersion:'xiaozhi.question-projection.v1',projection,sourceBlockIds:['figure']}};
  return{id:'question_'+randomUUID(),subject:'数学',grade:'初一',knowledgePoint:'合同夹具',questionType:'解答题',difficulty:'easy',stem:projection.statement.text,answer:document.answer.text,analysis:document.analysis.text,sourceTitle:'合成合同来源',sourceKind:'teacher_resource',tags:[],createdAt:'2026-10-09',updatedAt:'2026-10-09',document};
 };
 await check('Complete originals reject each statement/answer/analysis conflict before source work; matching text remains unproved',async()=>{
  const q=completeFixture(),snapshot=JSON.stringify(q);let contextCalls=0;
  const store={getQuestionNotebookEntry:async()=>q,readQuestionDocumentContext:async()=>{contextCalls++;return q.document.context.projection;}};
  assert.deepEqual((await readQuestionContextSource(store,{questionId:q.id,version:questionVersion(q)})).question,q);assert.equal(contextCalls,1);
  for(const field of ['stem','answer','analysis']){
   const bad={...q,[field]:'保密冲突文本'},calls=contextCalls;
   assert.deepEqual(questionFactConflicts(bad),[field==='stem'?'statement':field]);
   await assert.rejects(readQuestionContextSource({...store,getQuestionNotebookEntry:async()=>bad},{questionId:q.id,version:questionVersion(bad)}),/question_fact_conflict/);
   assert.equal(contextCalls,calls);
  }
  assert.equal(JSON.stringify(q),snapshot);
 });
 await check('Fact consistency preserves legacy hashes and v1 summaries and never normalizes or repairs source text',async()=>{
  const q=completeFixture(),{document,...plain}=q,bytes=JSON.stringify(q),version=questionVersion(q);
  assert.equal(questionVersion(plain),createHash('sha256').update(JSON.stringify(plain)).digest('hex'));assert.deepEqual(questionFactConflicts(plain),[]);
  assert.deepEqual(questionFactConflicts(q),[]);assert.equal(questionVersion(q),version);assert.equal(JSON.stringify(q),bytes);
  const v1={...q,stem:'旧版独立摘要',document:{...document,schemaVersion:QUESTION_DOCUMENT_SCHEMA}};delete v1.document.context;assert(validQuestionDocument(v1.document));assert.deepEqual(questionFactConflicts(v1),[]);
  const whitespace={...q,answer:q.answer+' '};assert.deepEqual(questionFactConflicts(whitespace),['answer']);assert.equal(whitespace.answer,q.answer+' ');
  const missing={...q,answer:'不得覆盖缺失答案',document:{...document,answer:{origin:'missing',text:'',anchors:[]}}};assert.deepEqual(questionFactConflicts(missing),['answer']);
 });
 await check('Pi conflict errors contain no corrupted text, source identity or alias; exact restoration recovers without fact writes',async()=>{
  const q=completeFixture();let current=q;const original=JSON.stringify(q),reads=[];
  const store={searchQuestionBank:async()=>[current],getQuestionNotebookEntry:async()=>current,readQuestionDocumentContext:async()=>current.document.context.projection,listStudents:async()=>[],sanitizeProblemText:async text=>({sanitizedText:text})};
  const signal=new AbortController().signal,tools=createQuestionContextProvider(store,()=>true,reference=>reads.push(reference));
  for(const field of ['stem','answer','analysis']){
   current={...q,[field]:'保密冲突原文-'+field};const bad=JSON.stringify(current),result=await tools[0].execute('conflict-'+field,{query:'合同夹具'},signal),publicText=result.content[0].text,value=JSON.parse(publicText);
   assert(result.isError);assert.equal(value.code,'question_fact_conflict');assert(!value.questions);assert(!publicText.includes('保密冲突'));assert(!publicText.includes(q.id));assert(!publicText.includes(q.document.source.resourceId));assert(!publicText.includes(q.document.answer.text));assert.equal(JSON.stringify(current),bad);assert.equal(reads.length,0);
  }
  current=q;const search=JSON.parse((await tools[0].execute('restored',{query:'合同夹具'},signal)).content[0].text),found=search.questions[0];
  assert.equal(found.reference,'题目1');const result=JSON.parse((await tools[1].execute('read',{reference:found.reference,version:found.version},signal)).content[0].text);
  assert(result.success);assert.equal(result.answerVerified,false);assert.equal(result.question.answerOrigin,'source');assert.equal(result.question.answer,q.answer);assert.equal(JSON.stringify(q),original);assert.deepEqual(reads,['题目1']);
 });
 await check('Changed source regions reset all six teacher coverage flags without destroying notes or mutating the previous confirmed projection',async()=>{
  const previous=Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(key=>[key,{state:key==='statement'||key==='figures'?'provided':'not_applicable',text:key==='statement'?'原条件 x+2=5':key==='figures'?'旧图义':''}]));
  assert(validQuestionProjection(previous,true));const frozen=JSON.stringify(previous),next=resetQuestionProjectionCoverage(previous);
  assert(validQuestionProjection(next));assert(!validQuestionProjection(next,true));assert(Object.values(next).every(part=>part.state==='missing'));assert.equal(next.figures.text,'旧图义');assert.equal(next.statement.text,'原条件 x+2=5');next.figures.text='新图义';assert.equal(JSON.stringify(previous),frozen);
 });
 await check('Complete projection v2 has six explicit reviewed sections; missing conditions or forged coverage never become a complete context',async()=>{
  const projection=Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(k=>[k,{state:k==='statement'?'provided':'not_applicable',text:k==='statement'?'原方程 x+2=5，求实数 x。':''}]));
  const v2={...copy(),schemaVersion:'xiaozhi.question-document.v2',context:{schemaVersion:'xiaozhi.question-projection.v1',projection,sourceBlockIds:['figure']}};
  assert(validQuestionDocument(v2));assert.deepEqual(readQuestionDocument(JSON.stringify(v2)),v2);
  for(const change of[d=>d.context.projection.statement.state='missing',d=>d.context.projection.statement.state='not_applicable',d=>d.context.projection.figures={state:'provided',text:''},d=>d.context.sourceBlockIds=['foreign'],d=>d.context.sourceBlockIds=['figure','figure'],d=>d.context.verified=true]){const bad=structuredClone(v2);change(bad);assert(!validQuestionDocument(bad));}
  const original={id:'question_'+randomUUID(),subject:'数学',grade:'初一',knowledgePoint:'方程',questionType:'解答',difficulty:'medium',stem:'摘要',answer:'',analysis:'',sourceTitle:'仅合同夹具',sourceKind:'teacher_resource',tags:[],createdAt:'x',updatedAt:'x',document:v2},before=questionVersion(original);v2.context.projection.statement.text='原方程 x+2=6，求实数 x。';assert.notEqual(questionVersion(original),before);
 });
 await check('Question document preserves formula, figure, table, choices, subquestion and independent answer origin',async()=>{
  assert(validQuestionDocument(doc));assert.deepEqual(readQuestionDocument(JSON.stringify(doc)),doc);assert.equal(readQuestionDocument(''),undefined);
  const source=copy();source.answer={origin:'source',text:'A',anchors:[{page:7,box:[0.1,0.2,0.4,0.3]}]};assert(validQuestionDocument(source));
 });
 await check('Question document rejects forged approval, unsupported version, empty source anchors, paths and invalid geometry',async()=>{
  for(const change of[d=>d.verified=true,d=>d.schemaVersion='v999',d=>d.blocks[0].anchors=[],d=>d.blocks[0].anchors[0].page=0,d=>d.blocks[0].anchors[0].box=[0.4,0.5,0.4,0.8],d=>d.blocks[0].anchors[0].box[0]=NaN,d=>d.blocks[2].assetId='D:/private/a.png',d=>d.blocks[2].width=16001,d=>d.answer={origin:'source',text:'A',anchors:[]},d=>d.answer={origin:'missing',text:'A',anchors:[]},d=>d.analysis.origin='source']){const d=copy();change(d);assert(!validQuestionDocument(d));}
  for(const value of[null,'{','null',JSON.stringify({...doc,teacherConfirmed:true})])assert.throws(()=>readQuestionDocument(value),/question_document_invalid/);
 });
 await check('Question document rejects duplicate IDs, sparse/accessor/cyclic data, excessive depth, nodes and UTF8 bytes',async()=>{
  let called=0;const d=copy();Object.defineProperty(d.blocks[0],'text',{enumerable:true,get(){called++;return'forged';}});assert(!validQuestionDocument(d));assert.equal(called,0);
  const hidden=copy();Object.defineProperty(hidden,'hidden',{value:'bad'});assert(!validQuestionDocument(hidden));
  const sparse=copy();delete sparse.blocks[0];assert(!validQuestionDocument(sparse));
  const cycle=copy();cycle.blocks.push(cycle);assert(!validQuestionDocument(cycle));
  const duplicate=copy();duplicate.blocks[1].id=duplicate.blocks[0].id;assert(!validQuestionDocument(duplicate));
  const deep=copy();let nested=deep.blocks;for(let i=0;i<5;i++){const b={id:'level'+i,kind:'subquestion',label:'1',anchors:doc.blocks[0].anchors,blocks:[]};nested.push(b);nested=b.blocks;}nested.push({...doc.blocks[0],id:'bottom'});assert(!validQuestionDocument(deep));
  const big=copy();big.blocks=Array.from({length:257},(_,i)=>({...doc.blocks[0],id:'x'+i}));assert(!validQuestionDocument(big));
  const bytes=copy();bytes.blocks=Array.from({length:4},(_,i)=>({...doc.blocks[0],id:'x'+i,text:'汉'.repeat(16000)}));assert(!validQuestionDocument(bytes));
 });
 const original={id:'question_'+randomUUID(),subject:'物理',grade:'初中',knowledgePoint:'电阻',questionType:'实验',difficulty:'medium',stem:'合成旧文本',answer:'',analysis:'',sourceTitle:'合同测试',sourceKind:'teacher_resource',tags:[],createdAt:'2026-10-09',updatedAt:'2026-10-09'};
 const oldVersion=createHash('sha256').update(JSON.stringify(original)).digest('hex');
 await check('Legacy question SHA is identical; figure, formula, page, source, engine and answer-origin changes invalidate new CAS',async()=>{
  assert.equal(questionVersion(original),oldVersion);assert.equal(questionVersion({...original,document:undefined}),oldVersion);
  const value=questionVersion({...original,document:doc});assert.notEqual(value,oldVersion);
  for(const change of[d=>d.blocks[2].sha256='c'.repeat(64),d=>d.blocks[1].text='R=U*I',d=>d.blocks[0].anchors[0].page=7,d=>d.source.resourceVersion='d'.repeat(64),d=>d.source.ocrVersion='v2',d=>d.answer={origin:'teacher',text:'A',anchors:[]}]){const d=copy();change(d);assert.notEqual(questionVersion({...original,document:d}),value);}
  await assert.rejects(readQuestionContextSource({getQuestionNotebookEntry:async()=>({...original,document:doc})},{questionId:original.id,version:oldVersion}),/source_changed/);
 });
 await check('Same SQLite additive migration preserves old rows/defaults and is idempotent for fresh and old schemas',async()=>{
  for(const fresh of[true,false]){const db=new DatabaseSync(':memory:');try{
   db.exec("CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,stem TEXT NOT NULL"+(fresh?",document_json TEXT NOT NULL DEFAULT ''":"")+")");db.prepare('INSERT INTO question_bank_items(id,stem) VALUES(?,?)').run(original.id,original.stem);
   const sql={all:async q=>db.prepare(q).all(),run:async q=>db.exec(q)};await ensureQuestionDocumentColumn(sql);await ensureQuestionDocumentColumn(sql);
   assert.deepEqual({...db.prepare('SELECT * FROM question_bank_items').get()},{id:original.id,stem:original.stem,document_json:''});
   db.prepare('UPDATE question_bank_items SET document_json=?').run(JSON.stringify(doc));await ensureQuestionDocumentColumn(sql);assert.deepEqual(readQuestionDocument(db.prepare('SELECT document_json FROM question_bank_items').get().document_json),doc);
  }finally{db.close();}}
  const drift=new DatabaseSync(':memory:');try{drift.exec('CREATE TABLE question_bank_items(id TEXT, document_json INTEGER)');await assert.rejects(ensureQuestionDocumentColumn({all:async q=>drift.prepare(q).all(),run:async q=>drift.exec(q)}),/question_document_schema_invalid/);}finally{drift.close();}
 });
 await check('Pi refuses incomplete structured original without cloud text/figure/source leakage or a correctness claim',async()=>{
  const q={...original,analysis:doc.analysis.text,document:doc},store={searchQuestionBank:async()=>[q],getQuestionNotebookEntry:async()=>q,listStudents:async()=>[],sanitizeProblemText:async text=>({sanitizedText:text})};
  const tools=createQuestionContextProvider(store,()=>true),signal=new AbortController().signal,search=JSON.parse((await tools[0].execute('s',{query:'电阻'},signal)).content[0].text);
  const found=search.questions[0],r=await tools[1].execute('r',{reference:found.reference,version:found.version},signal),text=r.content[0].text,p=JSON.parse(text);
  assert(r.isError);assert.equal(p.code,'document_context_unavailable');assert.equal(p.contextComplete,false);for(const privateValue of[doc.source.resourceId,doc.blocks[2].assetId,doc.blocks[1].text,doc.analysis.text])assert(!text.includes(privateValue));
 });
}
