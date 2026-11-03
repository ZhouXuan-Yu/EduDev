import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import {createQuestionContextProvider,questionVersion} from '../../src/main/education/question-context-provider.ts';
import {createQuestionSearchContinuation,questionSearchScope} from '../../src/main/education/question-search-continuation.ts';
import {validQuestionContextQuery,QUESTION_CONTEXT_SCHEMA} from '../../src/shared/question-context.ts';
import {validQuestionDocument,readQuestionDocument,QUESTION_DOCUMENT_SCHEMA} from '../../src/shared/question-document.ts';
import {mapQuestionSearchCandidates} from '../../src/main/education/question-retrieval.ts';

const output=fs.mkdtempSync(path.join(os.tmpdir(),'kb-question-search-continuation-'));
const report={success:false,checks:[],output,scope:'Production shared contract/provider, SQLite-owned synthetic facts and bounded per-run continuation. No model response or natural recall benchmark.'};
const check=async(name,action)=>{await action();report.checks.push(name);console.log('PASS '+name);};
const db=new DatabaseSync(path.join(output,'facts.db'));db.exec('CREATE TABLE facts(id TEXT PRIMARY KEY,body TEXT)');
const put=q=>db.prepare('INSERT OR REPLACE INTO facts VALUES(?,?)').run(q.id,JSON.stringify(q));
const get=id=>{const row=db.prepare('SELECT body FROM facts WHERE id=?').get(id);return row&&JSON.parse(row.body);};
const rows=()=>db.prepare('SELECT body FROM facts ORDER BY rowid').all().map(r=>JSON.parse(r.body));
const digest=()=>createHash('sha256').update(JSON.stringify(rows())).digest('hex');
const question=i=>({id:'question_'+randomUUID(),subject:'物理',grade:'初三',knowledgePoint:'力的平衡',questionType:'计算题',difficulty:'medium',stem:`合成检索题${i}：物体受到平衡力，已知向左力为${i+1}N，求向右力。`,answer:`${i+1}N`,analysis:'二力平衡，大小相等。',sourceTitle:'接续检索合成材料',sourceKind:'local_bank',tags:[],createdAt:'2026-11-03',updatedAt:'2026-11-03'});
let searches=0,current=true,failStore=false,sanitizeHook;
const store={listStudents:async()=>[],sanitizeProblemText:async text=>{await sanitizeHook?.();return{sanitizedText:text};},
 getQuestionNotebookEntry:async id=>{if(failStore)throw Error('private-storage-detail');return get(id);},
 searchQuestionBank:async()=>{searches++;return rows().slice(0,50);},
 searchQuestionsForAnswerEnrichment:async({offset=0})=>{searches++;return rows().slice(offset,offset+50);}};
const p=result=>JSON.parse(result.content[0].text);
const invoke=(tools,index,args,signal=new AbortController().signal)=>tools[index].execute(randomUUID(),args,signal);
const query={query:'平衡力',subject:'物理',grade:'初三',limit:10};
try{
 await check('Cursor input rejects unknown/mixed scopes, forged shapes and accessors before reading descriptors',async()=>{
  const cursor='qsearch_'+randomUUID();assert(validQuestionContextQuery({...query,cursor}));
  for(const extra of [{cursor:null},{cursor:undefined},{cursor:'qsearch_guess'},{cursor,purpose:'answer_enrichment'},{cursor,offset:0},{cursor,path:'private'}])assert(!validQuestionContextQuery({...query,...extra}));
  let invoked=false;assert(!validQuestionContextQuery({...query,get cursor(){invoked=true;return cursor;}}));assert(!invoked);
 });
 const originals=Array.from({length:21},(_,i)=>question(i));originals.forEach(put);
 let tools=createQuestionContextProvider(store,()=>current),first,second,third;
 const before=digest();
 await check('One actual SQLite search yields 21 distinct candidates across 10/10/1 with no duplicate page or false whole-library count',async()=>{
  first=p(await invoke(tools,0,query));assert.equal(first.returned,10);assert(first.nextCursor);assert.equal(first.coverageComplete,false);
  second=p(await invoke(tools,0,{...query,cursor:first.nextCursor}));assert.equal(second.returned,10);assert(second.nextCursor);
  third=p(await invoke(tools,0,{...query,cursor:second.nextCursor}));assert.equal(third.returned,1);assert(!third.nextCursor);assert.equal(third.hasMore,false);assert.equal(third.coverageComplete,true);
  assert.equal(new Set([...first.questions,...second.questions,...third.questions].map(q=>q.reference)).size,21);assert.equal(searches,1);assert.equal(first.totalKnown,false);
 });
 await check('Replaying a cursor preserves aliases and next token, performs no new ANN/keyword search and changes no facts',async()=>{
  const replay=p(await invoke(tools,0,{...query,cursor:first.nextCursor}));assert.deepEqual(replay,second);assert.equal(searches,1);assert.equal(digest(),before);
  const result=await invoke(tools,1,{reference:third.questions[0].reference,version:third.questions[0].version});assert(!result.isError);assert.equal(p(result).question.answer,originals[20].answer);
  assert.equal(result.details.data.sources[0].question.questionId,originals[20].id);
 });
 await check('Cursor cannot cross query/filter/run or turn into answer-enrichment permission',async()=>{
  for(const changed of [{query:'别题'},{subject:'数学'},{grade:'初二'},{knowledgePoint:'摩擦力'},{questionType:'选择题'},{difficulty:'hard'},{sourceKind:'generated'}])assert.equal(p(await invoke(tools,0,{...query,...changed,cursor:first.nextCursor})).code,'search_cursor_scope');
  assert.equal(p(await invoke(createQuestionContextProvider(store,()=>true),0,{...query,cursor:first.nextCursor})).code,'search_cursor_expired');
  assert.equal(p(await invoke(tools,0,{...query,cursor:'qsearch_'+randomUUID()})).code,'search_cursor_expired');
  assert.equal(p(await invoke(tools,0,{...query,cursor:first.nextCursor,purpose:'answer_enrichment'})).code,'invalid_input');assert.equal(searches,1);
 });
 await check('Changed/deleted slots are excluded; a newly inserted matching row cannot replace a frozen candidate',async()=>{
  const changed={...originals[10],answer:'教师新答案'};put(changed);db.prepare('DELETE FROM facts WHERE id=?').run(originals[11].id);const newcomer=question(999);put(newcomer);
  const result=await invoke(tools,0,{...query,cursor:first.nextCursor});assert(!result.isError);const value=p(result);
  assert.equal(value.returned,9);assert.equal(value.excluded.unavailableSources,2);assert.equal(value.hasMore,false);
  assert(!result.details.data.sources.some(s=>s.question.questionId===newcomer.id));assert.equal(searches,1);
  assert.equal(p(await invoke(tools,1,{reference:second.questions[0].reference,version:second.questions[0].version})).code,'source_changed');
  put(originals[10]);put(originals[11]);db.prepare('DELETE FROM facts WHERE id=?').run(newcomer.id);
 });
 await check('Malformed individual records and mirrored answer conflicts do not poison healthy search results',async()=>{
  db.exec('DELETE FROM facts');const conflict=question(22),bad=question(23),healthy=question(24);
  conflict.document={schemaVersion:QUESTION_DOCUMENT_SCHEMA,source:{resourceId:'resource_'+randomUUID(),resourceVersion:'a'.repeat(64),parserVersion:'fixture-v1',ocrVersion:''},blocks:[{id:'original',kind:'text',text:conflict.stem,anchors:[{page:1,box:[0,0,1,1]}]}],answer:{origin:'teacher',text:'不同答案',anchors:[]},analysis:{origin:'teacher',text:conflict.analysis,anchors:[]}};
  assert(validQuestionDocument(conflict.document));bad.document={schemaVersion:'broken'};[conflict,bad,healthy].forEach(put);
  const result=await invoke(createQuestionContextProvider(store,()=>true),0,query);assert(!result.isError);const value=p(result);
  assert.equal(value.returned,1);assert.equal(value.excluded.factConflicts,2);assert.equal(value.excluded.needsAttention,2);assert.equal(result.details.data.sources[0].question.questionId,healthy.id);
  assert.equal(value.coverageComplete,false);
 });
 await check('Small partial candidate windows retain incomplete coverage through later pages and SQL-level exclusions',async()=>{
  db.exec('DELETE FROM facts');const values=Array.from({length:12},(_,i)=>question(i));values[0].document={schemaVersion:'broken'};values.forEach(put);
  const scope=createQuestionContextProvider(store,()=>true),first=p(await invoke(scope,0,query));assert(first.nextCursor);
  const last=p(await invoke(scope,0,{...query,cursor:first.nextCursor}));assert(!last.nextCursor);assert.equal(last.hasMore,false);assert.equal(last.coverageComplete,false);
  const sqlScope=createQuestionContextProvider({...store,searchQuestionBankWithCoverage:async()=>({questions:[values[1]],excludedRecords:1,candidateLimitReached:false})},()=>true);
  const mapped=p(await invoke(sqlScope,0,query));assert.equal(mapped.returned,1);assert.equal(mapped.candidateWindow.excludedRecords,1);assert.equal(mapped.coverageComplete,false);
 });
 await check('Candidate-budget exhaustion remains explicit even after all 50 known candidates were paged',async()=>{
  db.exec('DELETE FROM facts');Array.from({length:51},(_,i)=>question(i)).forEach(put);tools=createQuestionContextProvider(store,()=>true);
  let value=p(await invoke(tools,0,query));const references=[];
  for(let i=0;i<5;i++){references.push(...value.questions.map(q=>q.reference));if(value.nextCursor)value=p(await invoke(tools,0,{...query,cursor:value.nextCursor}));}
  assert.equal(new Set(references).size,50);assert(!value.nextCursor);assert.equal(value.hasMore,true);assert.equal(value.coverageComplete,false);assert.equal(value.refineRequired,true);assert(value.refineHint.includes('不能声称全库查完'));
 });
 await check('The actual row-mapping boundary isolates invalid JSON and retains the raw candidate cap after exclusions',async()=>{
  db.exec('DELETE FROM facts');const values=Array.from({length:50},(_,i)=>question(i));values[0].document={schemaVersion:'broken'};values.forEach(put);
  const mapped=mapQuestionSearchCandidates(db.prepare('SELECT body FROM facts ORDER BY rowid').all(),row=>{
   const q=JSON.parse(row.body);if(q.document)q.document=readQuestionDocument(JSON.stringify(q.document));return q;
  });assert.equal(mapped.questions.length,49);assert.equal(mapped.excludedRecords,1);
  assert.throws(()=>mapQuestionSearchCandidates([{}],()=>{throw Error('disk-failure');}),/disk-failure/);
  const scope=createQuestionContextProvider({...store,searchQuestionBankWithCoverage:async()=>({...mapped,semantic:undefined,candidateLimitReached:true})},()=>true);
  let value=p(await invoke(scope,0,query));while(value.nextCursor)value=p(await invoke(scope,0,{...query,cursor:value.nextCursor}));
  assert.equal(value.candidateWindow.excludedRecords,1);assert.equal(value.candidateWindow.budgetReached,true);assert.equal(value.coverageComplete,false);assert.equal(value.refineRequired,true);
 });
 await check('A document that becomes malformed between pages is isolated even when the canonical mapper throws',async()=>{
  db.exec('DELETE FROM facts');const values=Array.from({length:12},(_,i)=>question(i));values.forEach(put);let failedId;
  const scope=createQuestionContextProvider({...store,getQuestionNotebookEntry:async id=>{if(id===failedId)throw Error('question_document_invalid');return get(id);}},()=>true);
  const initial=p(await invoke(scope,0,query));failedId=values[10].id;
  const value=p(await invoke(scope,0,{...query,cursor:initial.nextCursor}));assert.equal(value.returned,1);assert.equal(value.excluded.factConflicts,1);assert.equal(value.questions[0].version,questionVersion(values[11]));
 });
 await check('Permission revocation/cancel/storage failure remain terminal for the call with no leaked storage detail',async()=>{
  tools=createQuestionContextProvider(store,()=>current);
  const abort=new AbortController();abort.abort();assert.equal(p(await invoke(tools,0,query,abort.signal)).code,'cancelled');current=false;assert.equal(p(await invoke(tools,0,query)).code,'permission_denied');current=true;
  failStore=true;const value=p(await invoke(tools,0,query));assert.equal(value.code,'unavailable');assert(!JSON.stringify(value).includes('private-storage-detail'));failStore=false;
 });
 await check('Bounded 32-token registry evicts explicitly and never stores source text or grants read authority',async()=>{
  const registry=createQuestionSearchContinuation(),source={schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:originals[0].id,version:questionVersion(originals[0])},scope=questionSearchScope(query);let oldest;
  for(let i=0;i<33;i++){const window={scope,sources:[source,source]},staged=registry.prepare(window,1);if(!oldest)oldest=staged.cursor;assert.throws(()=>registry.resolve(staged.cursor,query),/search_cursor_expired/);staged.commit();assert.equal(registry.resolve(staged.cursor,query).offset,1);}
  assert.throws(()=>registry.resolve(oldest,query),/search_cursor_expired/);
 });
 await check('Sanitization-time source changes publish neither stale candidates nor new alias authority',async()=>{
  db.exec('DELETE FROM facts');const a=question(1),b=question(2);[a,b].forEach(put);const aliases=new Map(),fresh=createQuestionContextProvider(store,()=>true,undefined,aliases);
  let done=false;sanitizeHook=()=>{if(!done){done=true;put({...a,answer:'已变化'});}};
  const value=p(await invoke(fresh,0,{...query,limit:1}));sanitizeHook=undefined;
  assert.equal(value.code,'source_changed');assert.equal(aliases.size,0);
 });
 if(process.argv.includes('--with-existing-boundaries')){
  registerHooks({
   resolve(specifier,context,next){if(specifier==='electron')return{url:'data:text/javascript,export const utilityProcess={};export const app=new Proxy({},{get(){throw Error("Electron unavailable in source boundary");}});export class BrowserWindow{constructor(){throw Error("Electron unavailable in source boundary");}}export const session=new Proxy({},{get(){throw Error("Electron unavailable in source boundary");}});',shortCircuit:true};return next(specifier,context);},
   load(url,context,next){if(url.endsWith('/xiaozhi-agent/ocr-runtime-manifest.json'))return{format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8')+';',shortCircuit:true};return next(url,context);},
  });
  const {questionContextBoundaries}=await import('./question-context-boundaries.mjs'),{questionDocumentBoundaries}=await import('./question-document-boundaries.mjs');
  const {createAssistantMessageEventStream}=await import('@earendil-works/pi-ai');
  const workspace=path.join(output,'workspace'),stateRoot=path.join(output,'state');fs.mkdirSync(workspace);fs.mkdirSync(stateRoot);
  fs.symlinkSync(path.resolve('node_modules'),path.join(output,'node_modules'),process.platform==='win32'?'junction':'dir');
  const options={workspace,stateRoot,apiKey:'synthetic-boundary-not-a-key',model:'deepseek-chat',approveCopy:async()=>false};
  const prime=async agent=>{agent.session.agent.streamFn=model=>{const stream=createAssistantMessageEventStream();stream.push({type:'done',reason:'stop',message:{role:'assistant',api:model.api,provider:model.provider,model:model.id,content:[{type:'text',text:'合成基线'}],stopReason:'stop',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}});stream.end();return stream;};assert((await agent.prompt('合成原生基线')).ok);};
  globalThis.fetch=async()=>{throw Error('Network disabled in source boundaries');};
  await questionContextBoundaries(check,output,options,prime);await questionDocumentBoundaries(check);
 }
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
