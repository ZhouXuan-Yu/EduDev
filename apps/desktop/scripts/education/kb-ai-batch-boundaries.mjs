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
  // Production always creates the resource parent before AI migrations (including receipt cleanup triggers).
  db.exec('CREATE TABLE teacher_resources(id TEXT PRIMARY KEY);CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,archive_json TEXT);');
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
  return{db,repo,state,input,id,runtime,unit,async init(){await repo.migrate();await repo.saveSettings({schemaVersion:MATERIAL_AI_SCHEMA,revision:0,model:'qwen3-vl-plus',apiKey:'secret-only-for-controlled-test'});},async q(){const row=db.prepare('SELECT * FROM question_bank_items').get();return row?{...state.saved.find(q=>q.id===row.id),archive:JSON.parse(row.archive_json)}:undefined;}};
}
const imageProjection=stem=>Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(field=>[field,{state:field==='statement'?'provided':'not_applicable',text:field==='statement'?stem:''}]));
const imageResponse=q=>JSON.stringify({schemaVersion:'xiaozhi.material-ai-image-response.v1',outcome:'questions',questions:[{...q,projection:imageProjection(q.stem)}]});
const {completeMaterialAi}=await import('../../src/main/assets/material-ai-provider.ts');
const ordinaryFetch=globalThis.fetch;let providerImage=true,providerNative=false,wrongVersion=false,requests=0;const providerRequests=[];
try{
 globalThis.fetch=async(url,options)=>{
  requests++;assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(options.redirect,'error');const body=JSON.parse(options.body),system=body.messages[0].content;providerRequests.push(body);
  assert.equal(system.includes('xiaozhi.material-ai-image-response.v1'),providerImage);
  assert.equal(system.includes('xiaozhi.material-ai-response.v1'),!providerImage&&!providerNative,'An actual provider request cannot contain competing response schema names');
  let raw=providerNative?JSON.stringify({schemaVersion:'xiaozhi.material-ai-native-response.v1',outcome:'questions',questions:[{...question,projection:imageProjection(question.stem)}]}):providerImage?imageResponse(question):response(question);
  if(wrongVersion)raw=JSON.stringify({...JSON.parse(raw),schemaVersion:MATERIAL_AI_RESPONSE});
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:raw}}]}),{status:200});
 };
 const args={model:'deepseek-flash',apiKey:'controlled-test-only-key',text:source,image:{mime:'image/png',data:Buffer.from('owned-image').toString('base64')},imageCoverage:true};
 assert.equal(JSON.parse(await completeMaterialAi(args,new AbortController().signal)).schemaVersion,'xiaozhi.material-ai-image-response.v1');
 assert(providerRequests[0].messages[0].content.includes('[OCR还原规则 v1]'),'Actual DeepSeek request must include the dedicated conservative OCR restoration instructions');
 assert.equal(JSON.parse(providerRequests[0].messages[1].content[0].text).material,source,'Restoration must not overwrite the original OCR input before dispatch');
 wrongVersion=true;await assert.rejects(completeMaterialAi(args,new AbortController().signal),/invalid_response/);wrongVersion=false;
 providerImage=false;assert.equal(JSON.parse(await completeMaterialAi({...args,imageCoverage:false},new AbortController().signal)).schemaVersion,MATERIAL_AI_RESPONSE);
 providerImage=true;await completeMaterialAi({...args,previous:JSON.parse(imageResponse(question))},new AbortController().signal);
 providerImage=false;providerNative=true;
 const nativeArgs={...args,image:undefined,native:true,images:[{role:'question',index:0,mime:'image/png',data:args.image.data}]};
 const nativeFirst=await completeMaterialAi(nativeArgs,new AbortController().signal);await completeMaterialAi({...nativeArgs,previous:JSON.parse(nativeFirst)},new AbortController().signal);
 assert.equal(requests,6);
 for(const body of providerRequests){assert(body.messages[0].content.includes('[OCR还原规则 v1]'));assert(body.messages[0].content.includes('数字、正负号'));assert(body.messages[0].content.includes('无原图时'));assert(body.messages[0].content.includes('题面还原与解题标注是两项工作'));assert(body.messages[0].content.includes('schema内analysis是需要完成的解析'));assert.equal(JSON.parse(body.messages[1].content[0].text).material,source);}
 check('Actual image, legacy and native first/final requests retain the OCR restoration rules, original OCR and one strict response version');
}finally{globalThis.fetch=ordinaryFetch;}
const scheduled=fixture();try{
 await scheduled.init();const task={key:sha('same-folder-resource-version-unit')};
 const [first,second]=await Promise.all([scheduled.repo.create(scheduled.input,task),scheduled.repo.create(scheduled.input,task)]);
 assert.equal(first,second,'A folder task replay after child creation must reuse the durable AI batch instead of creating another paid workflow');
 assert.equal(scheduled.db.prepare('SELECT count(*) n FROM material_ai_batches').get().n,1);assert.equal(scheduled.state.calls,0);
 await assert.rejects(scheduled.repo.create({...scheduled.input,maxCalls:6},task),/conflict/);
 const reopened=new MaterialAiRepository(scheduled.repo.host);reopened.configure(scheduled.runtime);await reopened.migrate();assert.equal(await reopened.create(scheduled.input,task),first);
 check('Concurrent folder task creation and restart replay share one durable child batch; changed authorization input conflicts');
}finally{scheduled.db.close();}
const folderBound=fixture();try{
 await folderBound.init();const folderId='batch_'+randomUUID(),input={...folderBound.input,maxCalls:2},task={key:sha('folder-unit-one'),folderId,revision:1};
 folderBound.db.exec('CREATE TABLE material_folder_ai(batch_id TEXT PRIMARY KEY,status TEXT,revision INTEGER,settings_revision INTEGER,max_calls INTEGER)');
 folderBound.db.prepare("INSERT INTO material_folder_ai VALUES(?,'running',1,1,2)").run(folderId);
 folderBound.db.exec('CREATE TABLE material_import_entries(batch_id TEXT,kind TEXT,status TEXT,resource_id TEXT)');folderBound.db.prepare("INSERT INTO material_import_entries VALUES(?,'file','saved',?)").run(folderId,folderBound.id);
 await assert.rejects(folderBound.repo.create({...input,resourceId:'resource_'+randomUUID()},{...task,key:sha('outside-folder')}),/source_changed/);
 const batch=await folderBound.repo.create(input,task);
 await assert.rejects(folderBound.repo.create(input,{...task,key:sha('folder-unit-two')}),/budget_exhausted/);
 assert.equal(folderBound.db.prepare('SELECT count(*) n FROM material_ai_batches').get().n,1);
 folderBound.db.prepare("UPDATE material_folder_ai SET status='paused'").run();await folderBound.repo.drain();assert.equal(folderBound.state.calls,0);
 folderBound.db.prepare("UPDATE material_folder_ai SET status='running',revision=2").run();await folderBound.repo.drain();assert.equal(folderBound.state.calls,0);
 folderBound.db.prepare('UPDATE material_folder_ai SET revision=1').run();
 folderBound.runtime.clean=async text=>{if(folderBound.db.prepare("SELECT 1 FROM material_ai_units WHERE status='dispatched'").get())folderBound.db.prepare("UPDATE material_folder_ai SET status='paused'").run();return text;};
 await folderBound.repo.drain();assert.equal(folderBound.state.calls,0);assert.equal(folderBound.db.prepare('SELECT calls FROM material_ai_batches WHERE id=?').get(batch).calls,0);
 check('Folder reservations enforce a hard shared budget; pause, stale authorization and last-moment revocation prevent transport without a charge');
}finally{folderBound.db.close();}
const corrected=fixture();try{
 await corrected.init();corrected.state.fileName='原图文字题.png';
 const q={...question,stem:'计算 7 + 8，结果单位为米。',answerOrigin:'ai_generated',analysisOrigin:'ai_generated'};
 corrected.runtime.complete=async(input,signal)=>{signal.throwIfAborted();corrected.state.calls++;assert(input.image);return imageResponse(q);};
 await corrected.repo.create({...corrected.input,images:true});await corrected.repo.drain();await corrected.repo.drain();
 const saved=await corrected.q();assert.equal(saved?.archive?.state,'ai_final','Two complete matching visual transcriptions must correct missing OCR without teacher impersonation');
 assert.equal(saved.archive.ai.policy,'image-text-complete.v1');assert.equal(saved.archive.sourceChecked,false);assert.equal(saved.archive.ai.imageSha,sha('owned-image'));assert(archiveEligible(saved));await corrected.repo.validate(saved);
 assert.equal(corrected.state.images,1);await corrected.repo.migrate();assert.equal(corrected.db.prepare('SELECT count(*) n FROM material_ai_image_inputs').get().n,1);
 const reopened=new MaterialAiRepository(corrected.repo.host);await reopened.validate(saved);assert.equal(corrected.state.images,1,'Source readback must reuse the exact durable model image without launching an OCR/PDF worker');
 corrected.db.prepare("UPDATE material_ai_image_inputs SET data_base64=?").run(Buffer.from('changed').toString('base64'));await assert.rejects(reopened.validate(saved),/source_changed/);
 check('Original-image two-pass complete text transcription can repair OCR omissions while preserving AI authority, image digest and current source');
}finally{corrected.db.close();}
for(const mode of ['missing_projection','figure_dependency','analysis_disagreement','missing_choice_coverage','old_first_draft']){
 const e=fixture();try{
  await e.init();e.state.fileName='图文复核.png';const q={...question,answerOrigin:'ai_generated',analysisOrigin:'ai_generated'};
  if(mode==='figure_dependency')e.unit.chunk.contentMd=e.unit.chunk.contentMd.replace('计算 7 + 8。','计算 7 + 8，如图所示。');
  if(mode==='missing_choice_coverage')e.unit.chunk.contentMd=e.unit.chunk.contentMd.replace('计算 7 + 8。','计算 7 + 8。选涂“A十五”或“B十六”。');
  e.runtime.complete=async input=>{
   e.state.calls++;let value=JSON.parse(imageResponse(q));
   if(mode==='missing_projection')value.questions[0].projection.formulas={state:'missing',text:''};
   if(mode==='analysis_disagreement'&&input.previous)value.questions[0].analysis+='补充的不同分析。';
   if(mode==='old_first_draft'&&!input.previous)return response(q);
   return JSON.stringify(value);
  };
  await e.repo.create({...e.input,images:true});await e.repo.drain();const saved=await e.q();assert.equal(saved?.archive?.state,'ai_needs_review',mode);assert(!archiveEligible(saved));
  assert.equal(saved.archive.ai.policy,'text-complete.v1');check('Image completeness cannot fall back to legacy release for '+mode);
 }finally{e.db.close();}
}
const noImage=fixture();try{
 await noImage.init();noImage.runtime.complete=async()=>imageResponse(question);await noImage.repo.create(noImage.input);await noImage.repo.drain();
 assert.equal(await noImage.q(),undefined);assert.equal((await noImage.repo.list(noImage.id))[0].units[0].error,'invalid_response');
 check('A model claiming visual coverage without any actual image is refused before publication');
}finally{noImage.db.close();}
const invalidImage=fixture();try{
 await invalidImage.init();invalidImage.state.fileName='不合格图.png';invalidImage.runtime.image=async()=>({mime:'image/png',data:'***not-base64***'});await invalidImage.repo.create({...invalidImage.input,images:true});await invalidImage.repo.drain();
 assert.equal(invalidImage.state.calls,0);assert.equal((await invalidImage.repo.list(invalidImage.id))[0].units[0].error,'unit_too_large');
 check('Invalid image bytes cannot be persisted as image authority or dispatched to a provider');
}finally{invalidImage.db.close();}
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
const unified=fixture();try{await unified.init();unified.repo.configure({...unified.runtime,account:async()=>({revision:42,model:'deepseek-flash',apiKey:'controlled-unified-key'})});unified.repo.host.writer=async(action,beforeCommit)=>{const target=new MaterialAiRepository(unified.repo.host);unified.db.exec('BEGIN IMMEDIATE');try{const value=await action(target);beforeCommit?.();unified.db.exec('COMMIT');return value;}catch(error){unified.db.exec('ROLLBACK');throw error;}};await unified.repo.create({...unified.input,settingsRevision:42});assert.equal(unified.db.prepare('SELECT COUNT(*) n FROM material_ai_batches').get().n,1);check('A fresh production writer repository inherits the shared DeepSeek account instead of falling back to legacy credentials');}finally{unified.db.close();}
console.log(JSON.stringify({success:true,checks,scope:'Actual repository source, SQLite transactions and strict schemas; controlled codec/provider only. No real provider quality or billing verification.'}));
