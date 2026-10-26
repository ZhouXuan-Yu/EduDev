import '../office-agent/register-source.mjs';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {MaterialAiRepository}=await import('../../src/main/assets/material-ai-repository.ts');
const {materialSource}=await import('../../src/main/assets/material-source.ts');
const {MATERIAL_AI_SCHEMA,MATERIAL_AI_RESPONSE,parseAiResponse}=await import('../../src/shared/material-ai.ts');
const {archiveEligible,validQuestionArchive,archiveIssuesAfterEdit}=await import('../../src/shared/question-archive.ts');
const {createQuestionContextProvider}=await import('../../src/main/education/question-context-provider.ts');
const source='学科：数学\n年级：初二\n知识点：算术\n题型：解答题\n难度：中等\n\n第1题 计算 7 + 8。\n【答案】15\n【解析】7与8相加得到15。';
const question={number:'1',stem:'计算 7 + 8。',answer:'15',analysis:'7与8相加得到15。',subject:'数学',grade:'初二',knowledgePoint:'算术',questionType:'解答题',difficulty:'medium',answerOrigin:'source',analysisOrigin:'source',requiresImage:false,issues:[]};
const response=q=>JSON.stringify({schemaVersion:MATERIAL_AI_RESPONSE,outcome:'questions',questions:[q]});
const sha=s=>createHash('sha256').update(s).digest('hex');
let checks=0;
const check=name=>{checks++;console.log('PASS '+name);};
function fixture(){
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,archive_json TEXT);');
  const id='resource_'+randomUUID(),version=sha(source),unit={resourceId:id,version,title:'本地习题',offset:0,chunk:{id:'chunk_'+randomUUID(),chunkIndex:0,contentMd:source,containsPersonalData:false,pageNumber:null}};
  const state={calls:0,images:0,version,stamp:'original-stamp',fileName:'习题.md',beforeCommitAbort:false,mode:'normal',saved:[],payload:question,cleanDraft:false};let repo,queue=Promise.resolve();
  const host={all:async(sql,p=[])=>db.prepare(sql).all(...p),run:async(sql,p=[])=>{db.prepare(sql).run(...p);},map:r=>r,
    materials:()=>({resource:async()=>({id,originalFileName:state.fileName,contentHash:state.version,title:'本地习题',parseEngine:'local-text-v1'}),originalStamp:async()=>state.stamp,verify:async()=>{},readingWindow:async(_id,offset)=>({units:offset===0?[unit]:[],hasMore:false}),source:async r=>{assert.equal(r.version,state.version);assert.deepEqual(r,materialSource(unit));return{};}}),
    create:async q=>{const value={...q,id:'question_'+randomUUID()};db.prepare("INSERT INTO question_bank_items VALUES (?,'')").run(value.id);state.saved.push(value);return value;},
    writer:(action,beforeCommit)=>{const promise=queue.then(async()=>{db.exec('BEGIN IMMEDIATE');try{const value=await action(repo);if(state.beforeCommitAbort&&db.prepare('SELECT COUNT(*) n FROM question_bank_items').get().n){state.beforeCommitAbort=false;repo.active.controller.abort();}beforeCommit?.();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}});queue=promise.catch(()=>{});return promise;}
  };
  repo=new MaterialAiRepository(host);
  const runtime={codec:{available:()=>true,seal:key=>'sealed:'+Buffer.from(key).toString('base64'),open:value=>Buffer.from(value.slice(7),'base64').toString()},clean:async text=>text,image:async()=>{state.images++;return{mime:'image/png',data:Buffer.from('owned-image').toString('base64')};},complete:async(input,signal)=>{
    signal.throwIfAborted();state.calls++;
    if(input.previous&&state.cleanDraft){assert(!JSON.stringify(input.previous).includes('private'));assert(!JSON.stringify(input.previous).includes('张同学'));assert(JSON.stringify(input.previous).includes('[个人信息]'));}
    if(state.mode==='unknown'){state.mode='normal';throw Error('outcome_unknown');}
    if(state.mode==='source_change'){state.version=sha('changed');return response(state.payload);}
    if(state.mode==='pause_final'&&input.previous){state.mode='normal';await repo.action({schemaVersion:MATERIAL_AI_SCHEMA,batchId:repo.active.batchId,action:'pause'});return response(state.payload);}
    if(state.mode==='omit')return JSON.stringify({schemaVersion:MATERIAL_AI_RESPONSE,outcome:'no_questions',questions:[]});
    return response(state.payload);
  }};
  repo.configure(runtime);
  const input={schemaVersion:MATERIAL_AI_SCHEMA,resourceId:id,version,settingsRevision:1,start:1,count:1,maxCalls:4,images:false,cloudConsent:true,publicMaterial:true};
  return{db,repo,state,input,id,runtime,async init(){await repo.migrate();await repo.saveSettings({schemaVersion:MATERIAL_AI_SCHEMA,revision:0,model:'qwen3-vl-plus',apiKey:'secret-only-for-controlled-test'});},async q(){const row=db.prepare('SELECT * FROM question_bank_items').get();return row?{...state.saved.find(q=>q.id===row.id),archive:JSON.parse(row.archive_json)}:undefined;}};
}
assert.throws(()=>parseAiResponse(response({...question,untrusted:1})),/invalid_response/);
assert.throws(()=>parseAiResponse(response({...question,answerOrigin:'teacher'})),/invalid_response/);
assert.throws(()=>parseAiResponse(response({...question,answer:'',answerOrigin:'source'})),/invalid_response/);
check('Strict bounded output rejects extra keys, fake teacher attribution and empty-source answers');
const a=fixture();try{
  await a.init();assert(!a.db.prepare('SELECT value_json FROM app_settings').get().value_json.includes('secret-only-for-controlled-test'));
  await assert.rejects(a.repo.create({...a.input,cloudConsent:false}),/invalid_input/);assert.equal(a.state.calls,0);
  const id=await a.repo.create(a.input);await a.repo.drain();await a.repo.drain();const q=await a.q();assert(validQuestionArchive(q.archive));assert.equal(q.archive.state,'ai_final');assert.equal(q.archive.sourceChecked,false);assert(archiveEligible(q));assert.equal((await a.repo.list(a.id))[0].calls,2);await a.repo.validate(q);
  assert.equal(a.db.prepare('SELECT COUNT(*) n FROM material_ai_members').get().n,1);assert.equal((await a.repo.list(a.id))[0].status,'complete');
  check('Authorized two-pass batch persists budget, both raw drafts, same-bank question and non-teacher AI provenance');
  let grants=0;const tools=createQuestionContextProvider({listStudents:async()=>[],sanitizeProblemText:async text=>({sanitizedText:text}),searchQuestionBank:async()=>[q],getQuestionNotebookEntry:async()=>q,readArchivedQuestionContext:item=>a.repo.validate(item)},()=>true,()=>grants++);
  const search=JSON.parse((await tools[0].execute(randomUUID(),{query:'计算'},new AbortController().signal)).content[0].text);assert.equal(search.returned,1);assert.equal(grants,0);
  const reading=JSON.parse((await tools[1].execute(randomUUID(),{reference:search.questions[0].reference,version:search.questions[0].version},new AbortController().signal)).content[0].text);assert(reading.success);assert.equal(reading.question.archiveState,'ai_final');assert.equal(reading.teacherConfirmationKnown,false);assert.equal(grants,1);assert(!JSON.stringify(reading).includes(q.archive.ai.batchId));
  check('Actual Pi question tools read source-validated AI facts without exposing private batch IDs or claiming teacher confirmation');
  a.db.prepare("UPDATE material_ai_units SET final_json='{}' WHERE batch_id=?").run(id);await assert.rejects(a.repo.validate(q),/source_changed/);
  check('Changed raw final receipt prevents an archived AI question from passing source validation');
}finally{a.db.close();}
for(const mode of ['unknown','pause_final']){
  const f=fixture();try{await f.init();const id=await f.repo.create(f.input);f.state.mode=mode;await f.repo.drain();const view=(await f.repo.list(f.id))[0];assert.equal(view.unknown,1);assert.equal(await f.q(),undefined);const calls=f.state.calls;await f.repo.drain();assert.equal(f.state.calls,calls);
    await assert.rejects(f.repo.action({schemaVersion:MATERIAL_AI_SCHEMA,batchId:id,action:'retry_unknown'}),/invalid_input/);
    await f.repo.action({schemaVersion:MATERIAL_AI_SCHEMA,batchId:id,action:'retry_unknown',acceptDuplicateCharge:true});await f.repo.drain();assert.equal((await f.q()).archive.state,'ai_final');assert.equal(f.state.calls,3);
    check(mode==='unknown'?'Unknown response is never automatically replayed; explicit duplicate-charge retry counts all calls':'Pause during final call keeps saved first draft, blocks publication, and explicit retry sends only final phase');
  }finally{f.db.close();}
}
const b=fixture();try{await b.init();await b.repo.create(b.input);b.state.beforeCommitAbort=true;await b.repo.drain();assert.equal(b.db.prepare('SELECT COUNT(*) n FROM question_bank_items').get().n,0);assert.equal(b.db.prepare('SELECT COUNT(*) n FROM material_ai_members').get().n,0);assert.equal((await b.repo.list(b.id))[0].unknown,1);check('Cancellation at final COMMIT boundary rolls back question, provenance and publication together');}finally{b.db.close();}
const c=fixture();try{await c.init();await c.repo.create(c.input);c.state.mode='source_change';await c.repo.drain();assert.equal(c.state.calls,1);assert.equal(c.db.prepare('SELECT COUNT(*) n FROM question_bank_items').get().n,0);check('Changed source after network response cannot persist a draft or dispatch another phase');}finally{c.db.close();}
for(const payload of [{...question,stem:'计算 7 + 8'}, {...question,requiresImage:true}, {...question,issues:['cross_page']}, {...question,answer:'16',answerOrigin:'source'}]){
  const f=fixture();try{await f.init();f.state.payload=payload;await f.repo.create(f.input);await f.repo.drain();const q=await f.q();assert.equal(q.archive.state,'ai_needs_review');assert(!archiveEligible(q));}finally{f.db.close();}
}
check('Two agreeing model passes cannot qualify shortened stems, missing figures, cross-page questions or invented source answers');
const omissions=fixture();try{await omissions.init();await omissions.repo.create(omissions.input);omissions.state.mode='omit';await omissions.repo.drain();await omissions.repo.drain();const v=(await omissions.repo.list(omissions.id))[0];assert.equal(v.complete,0);assert.equal(v.review,1);assert.equal(v.status,'attention');assert.equal(v.questions,0);assert.equal(v.units[0].error,'ai_omitted_questions');check('Model no_questions cannot silently omit a deterministically discovered source question');}finally{omissions.db.close();}
const edited=fixture();try{await edited.init();edited.state.payload={...question,issues:['cross_page']};await edited.repo.create(edited.input);await edited.repo.drain();const q=await edited.q();const issues=archiveIssuesAfterEdit(q.archive,q,q,false);assert(issues.includes('cross_page'));assert(!archiveEligible({...q,archive:{...q.archive,state:'teacher_edited',issues}}));assert(archiveIssuesAfterEdit(q.archive,q,{...q,analysis:'new analysis'},true).includes('cross_page'));assert(!archiveIssuesAfterEdit(q.archive,q,{...q,stem:q.stem+'补齐下一页条件'},true).includes('cross_page'));check('Plain save and unrelated edits retain AI cross-page issues; release requires changed stem and explicit source check');}finally{edited.db.close();}
const history=fixture();try{await history.init();for(let i=0;i<12;i++)await history.repo.create(history.input);const first=await history.repo.list(history.id),second=await history.repo.list(history.id,10);assert.equal(first.length,10);assert.equal(second.length,2);assert.equal(new Set([...first,...second].map(v=>v.id)).size,12);check('Paged history keeps every active batch reachable beyond the first 10');}finally{history.db.close();}
const d=fixture();try{await d.init();await d.repo.create(d.input);d.state.mode='unknown';await d.repo.drain();d.db.prepare("UPDATE material_ai_units SET status='dispatched',owner_pid=2147483000,lease='crashed'").run();await d.repo.recover();assert.equal((await d.repo.list(d.id))[0].unknown,1);const calls=d.state.calls;await d.repo.drain();assert.equal(d.state.calls,calls);check('Dead process with dispatched request recovers to unknown without automatic resubmission');}finally{d.db.close();}
const expired=fixture();try{await expired.init();await expired.repo.create(expired.input);expired.db.prepare("UPDATE material_ai_units SET status='dispatched',owner_pid=?,lease='expired',dispatched_at=?").run(process.pid,Date.now()-180001);await expired.repo.recover();assert.equal((await expired.repo.list(expired.id))[0].unknown,1);assert.equal(expired.state.calls,0);check('Expired dispatch cannot remain running merely because its old process ID is alive');}finally{expired.db.close();}
const privacy=fixture();try{await privacy.init();privacy.state.fileName='owned.jpg';privacy.runtime.clean=async text=>text.replace('初二','[个人信息]');await privacy.repo.create({...privacy.input,images:true});await privacy.repo.drain();assert.equal(privacy.state.calls,0);assert.equal(privacy.state.images,0);assert.equal((await privacy.repo.list(privacy.id))[0].units[0].error,'privacy_blocked');check('Text redaction never masquerades as image redaction: private image unit is blocked before preparation or network');}finally{privacy.db.close();}
const draft=fixture();try{await draft.init();draft.state.payload={...question,analysis:'推导中 C:\\private\\draft.png 张同学',analysisOrigin:'ai_generated'};draft.state.cleanDraft=true;draft.runtime.clean=async text=>text.replace(/C:\\[^ ]+/g,'[本地路径]').replaceAll('张同学','[个人信息]');await draft.repo.create(draft.input);await draft.repo.drain();assert.equal(draft.state.calls,2);check('First draft is redacted per field before second dispatch without corrupting JSON or changing durable original receipt');}finally{draft.db.close();}
console.log(JSON.stringify({success:true,checks,scope:'Actual repository source, SQLite transactions and strict schemas; controlled codec/provider only. No real provider quality or billing verification.'}));
