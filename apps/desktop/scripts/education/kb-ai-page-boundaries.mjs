import '../office-agent/register-source.mjs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {createHash,randomUUID} from 'node:crypto';
const {MaterialAiRepository}=await import('../../src/main/assets/material-ai-repository.ts');
const {archiveEligible,validQuestionArchive}=await import('../../src/shared/question-archive.ts');
const {parseAiPageResponse,validAiPageQuery,validMaterialPageSource,validAiPagePrompt,MATERIAL_PAGE_PROMPT}=await import('../../src/shared/material-ai-page.ts');
const {materialSource}=await import('../../src/main/assets/material-source.ts');
const sha=x=>createHash('sha256').update(x).digest('hex'),pageSchema='xiaozhi.material-ai-page-response.v1';
const stem='计算7+8。',text='学科：数学\n年级：初二\n知识点：算术\n题型：解答题\n难度：中等\n第1题 '+stem+'\n【答案】15\n【解析】7与8相加得到15。';
const q={number:'1',stem,answer:'15',analysis:'7与8相加得到15。',subject:'数学',grade:'初二',knowledgePoint:'算术',questionType:'解答题',difficulty:'medium',answerOrigin:'source',analysisOrigin:'source',requiresImage:false,issues:[],projection:Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(k=>[k,{state:k==='statement'?'provided':'not_applicable',text:k==='statement'?stem:''}]))};
function fixture(status='blank'){
 const db=new DatabaseSync(':memory:'),id='resource_'+randomUUID(),version=sha('owned-original'),generation=randomUUID(),saved=[],state={calls:0,mode:'normal',stamp:'owned-stamp'};let repo;
 db.exec(`CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,archive_json TEXT,document_json TEXT NOT NULL DEFAULT '');
 CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,original_file_name TEXT,parse_status TEXT);CREATE TABLE resource_chunks(id TEXT,resource_id TEXT,page_number INTEGER,contains_personal_data INTEGER,chunk_index INTEGER,content_md TEXT);
 CREATE TABLE material_pdf_jobs(resource_id TEXT,version TEXT,total INTEGER,generation TEXT,state TEXT);CREATE TABLE material_pdf_pages(generation TEXT,page INTEGER,status TEXT,result_json TEXT,error TEXT);`);
 const error=status==='failed'?'ocr_failed':status==='needs_review'?'ocr_unreliable':'',ocr=status==='complete'?'本地乱码#???':'';
 db.prepare("INSERT INTO teacher_resources VALUES(?,?,'原页.pdf','partial')").run(id,version);db.prepare("INSERT INTO material_pdf_jobs VALUES(?,?,1,?,'partial')").run(id,version,generation);db.prepare('INSERT INTO material_pdf_pages VALUES(?,1,?,?,?)').run(generation,status,JSON.stringify({status,error,method:status==='blank'?'blank':status==='failed'?'failed':'ocr',nativeText:'',ocrText:ocr,text:ocr,width:status==='failed'?0:100,height:status==='failed'?0:100,imageArea:1,nativeBoxes:[]}),error);
 const bodyId='chunk_'+randomUUID();if(status==='complete')db.prepare('INSERT INTO resource_chunks VALUES(?,?,1,0,0,?)').run(bodyId,id,ocr);
 const unit=()=>{const row=db.prepare('SELECT * FROM resource_chunks WHERE id=?').get(bodyId);return row?{resourceId:id,version,title:'原页',offset:0,chunk:{id:bodyId,resourceId:id,chunkIndex:0,contentMd:row.content_md,pageNumber:row.page_number,containsPersonalData:!!row.contains_personal_data}}:undefined;};
 const materials={resource:async()=>({id,contentHash:version,originalFileName:'原页.pdf',title:'原页',parseStatus:'partial'}),originalStamp:async()=>state.stamp,verify:async()=>{},readingWindow:async(_id,offset)=>({units:offset===0&&unit()?[unit()]:[],hasMore:false}),source:async source=>{const u=unit();if(!u||JSON.stringify(materialSource(u))!==JSON.stringify(source))throw Error('source_changed');return{body:{chunks:[u.chunk]}};}};
 const host={all:async(s,p=[])=>db.prepare(s).all(...p),run:async(s,p=[])=>{db.prepare(s).run(...p);},materials:()=>materials,map:r=>r,create:async fields=>{const v={...fields,id:'question_'+randomUUID(),createdAt:'x',updatedAt:'x'};db.prepare("INSERT INTO question_bank_items(id,archive_json) VALUES(?,'')").run(v.id);saved.push(v);return v;},writer:async(action,before)=>{db.exec('BEGIN IMMEDIATE');try{const result=await action(repo);before?.();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};repo=new MaterialAiRepository(host);
 repo.configure({codec:{available:()=>true,seal:v=>v,open:v=>v},clean:async v=>state.mode==='privacy'?v.replaceAll('张同学','[个人信息]'):v,image:async()=>{if(state.mode==='busy_image_once'){state.mode='normal';throw Error('busy');}return{mime:'image/png',data:Buffer.from('controlled-owned-image').toString('base64')};},complete:async input=>{
  state.calls++;(state.prompts??=[]).push(input.pagePrompt??null);assert(input.image);assert.equal(input.page,true);assert.equal(input.text,ocr);
  if(state.mode==='unknown')throw Error('outcome_unknown');
  let result={schemaVersion:pageSchema,outcome:'questions',pageText:text,pageIssues:[],questions:[structuredClone(q)]};
  if(state.mode==='ordinary')result={schemaVersion:pageSchema,outcome:'no_questions',pageText:'光在同种均匀介质中沿直线传播。',pageIssues:[],questions:[]};
  if(state.mode==='ordinary_long')result={schemaVersion:pageSchema,outcome:'no_questions',pageText:'甲'.repeat(11999)+'😀'+'乙'.repeat(2000)+'尾部证据：色散与折射。',pageIssues:[],questions:[]};
  if(state.mode==='blank')result={schemaVersion:pageSchema,outcome:'no_questions',pageText:'',pageIssues:[],questions:[]};
  if(state.mode==='numeric_spacing')result={schemaVersion:pageSchema,outcome:'no_questions',pageText:input.previous?'两项记录：12':'两项记录：1 2',pageIssues:[],questions:[]};
  if(state.mode==='math_notation_changed')result={schemaVersion:pageSchema,outcome:'no_questions',pageText:input.previous?'公式：x2 + y1':'公式：x² + y₁',pageIssues:[],questions:[]};
  if(state.mode==='math_stem_changed'){result.pageText='第1题 写出x²。\n【答案】x²\n【解析】原式为x²。';Object.assign(result.questions[0],{stem:'写出x2。',answer:'x²',analysis:'原式为x²。'});result.questions[0].projection.statement.text='写出x2。';}
  if(state.mode==='unclear')result={...result,pageIssues:['uncertain_ocr']};
  if(state.mode==='omitted')result={...result,questions:[],outcome:'no_questions'};
  if(state.mode==='mismatch'&&input.previous)result={...result,pageText:text.replace('7+8','7+9')};
  if(state.mode==='source_answer')result.questions[0].answer='99';
  if(state.mode==='outcome_changed'&&input.previous)result.outcome='needs_review';
  if(state.mode==='question_final_uncertain'&&input.previous)result.questions[0].issues=['uncertain_ocr'];
  if(state.mode==='question_uncertain')result.questions[0].issues=['uncertain_ocr'];
  if(state.mode==='question_cross_page')result.questions[0].issues=['cross_page'];
  if(state.mode==='question_incomplete')result.questions[0].issues=['incomplete_question'];
  if(state.mode==='figure'){result.questions[0].requiresImage=true;result.questions[0].projection.figures={state:'provided',text:'原图中的几何图'};}
  if(state.mode==='privacy')result.pageText+='\n张同学';
  if(state.mode==='changed_final'&&input.previous)db.prepare("UPDATE material_pdf_pages SET error='changed'").run();
  if(state.mode==='extra')result.fakeTeacherConfirmed=true;
  return JSON.stringify(result);
 }});
 const input={schemaVersion:'xiaozhi.material-ai.v1',resourceId:id,version,settingsRevision:1,start:1,count:1,maxCalls:4,images:true,cloudConsent:true,publicMaterial:true};
 return{db,id,version,state,input,repo,host,saved,async init(){await repo.migrate();await repo.saveSettings({schemaVersion:input.schemaVersion,revision:0,model:'deepseek-flash',apiKey:'controlled-no-network'});},async question(){const r=db.prepare('SELECT * FROM question_bank_items').get();return r?{...saved.find(v=>v.id===r.id),archive:JSON.parse(r.archive_json)}:undefined;}};
}
async function imageFixture(status='blank'){
 const f=fixture(status);await f.init();f.db.prepare("UPDATE teacher_resources SET original_file_name='题目.png',parse_status=?").run(status==='complete'?'ready':'failed');
 const resource=f.host.materials().resource;f.host.materials().resource=async()=>({...await resource(),originalFileName:'题目.png',parseStatus:status==='complete'?'ready':'failed',chunkCount:status==='complete'?1:0});
 const {saveImageOcr}=await import('../../src/main/assets/material-image-ocr.ts');
 const {LOCAL_OCR_SCHEMA,LOCAL_OCR_ENGINE}=await import('../../src/shared/xiaozhi-ocr.ts');
 const receipt={schemaVersion:LOCAL_OCR_SCHEMA,ok:true,engine:LOCAL_OCR_ENGINE,text:'本地乱码#???',lines:1,width:100,height:100,scores:[.9]};
 await saveImageOcr({all:f.host.all,change:async(s,p=[])=>Number(f.db.prepare(s).run(...p).changes)},f.id,f.version,status==='complete'?receipt:Error(status==='blank'?'empty':'parse_failed'),new AbortController().signal);return f;
}
let checks=0;const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
async function completed(status='blank',mode='normal'){const f=fixture(status);await f.init();f.state.mode=mode;f.batch=await f.repo.create(f.input);await f.repo.drain();await f.repo.drain();await f.repo.drain();return f;}
const query=f=>({schemaVersion:'xiaozhi.material-ai-page.v1',batchId:f.batch,ordinal:1});
await check('Authorized blank/failed/needs-review OCR pages run both original-image phases, retain empty OCR and publish source-backed v5 questions',async()=>{for(const status of ['blank','failed','needs_review']){const f=await completed(status);try{assert.equal(f.state.calls,2,'An authorized blank OCR page cannot become zero-call no_questions');const question=await f.question();assert(question);assert(validQuestionArchive(question.archive));assert(archiveEligible(question));assert.equal(question.archive.schemaVersion,'xiaozhi.question-archive.v5');assert.equal(question.archive.sources.length,0);assert.equal(question.archive.pageSource.page,1);await f.repo.validate(question);const view=await f.repo.page(query(f));assert.equal(view.text,text);assert.equal(view.ocrText,'');assert.equal(f.db.prepare('SELECT COUNT(*) n FROM resource_chunks').get().n,0,'Do not fabricate an OCR body chunk');assert(!validQuestionArchive({...question.archive,schemaVersion:'xiaozhi.question-archive.v2'}));}finally{f.db.close();}}});
await check('Ordinary textbook and truly blank pages retain two-pass full-page results without inventing questions',async()=>{for(const mode of ['ordinary','blank']){const f=await completed('blank',mode);try{assert.equal(f.state.calls,2);assert.equal(await f.question(),undefined);const view=await f.repo.page(query(f));assert.equal(view.status,mode==='blank'?'blank':'complete');assert.equal(!!view.text,mode!=='blank');assert.equal(f.db.prepare('SELECT status FROM material_ai_units').get().status,'no_questions');}finally{f.db.close();}}});
await check('Omitted questions, mismatched page transcripts, unclear pages, figure dependence and invented source answers stay held',async()=>{for(const mode of ['omitted','mismatch','unclear','figure','source_answer']){const f=await completed('blank',mode);try{assert.equal(f.db.prepare('SELECT status FROM material_ai_units').get().status,'review',mode);const question=await f.question();if(question){assert(validQuestionArchive(question.archive));assert(!archiveEligible(question),mode);await f.repo.validate(question);if(mode==='source_answer')await assert.rejects(f.repo.validate({...question,archive:{...question.archive,state:'ai_final',issues:[]}}),/source_changed/);}assert.equal((await f.repo.page(query(f))).status,'needs_review');}finally{f.db.close();}}});
await check('No image authorization, current private or unknown-page private flags stop creation before any model call',async()=>{for(const page of [1,0,null]){const f=fixture();try{await f.init();f.db.prepare('INSERT INTO resource_chunks(id,resource_id,page_number,contains_personal_data) VALUES(?,?,?,1)').run('private',f.id,page);await assert.rejects(f.repo.create(f.input),/privacy_blocked/);assert.equal(f.state.calls,0);}finally{f.db.close();}}const f=fixture();try{await f.init();await assert.rejects(f.repo.create({...f.input,images:false}),/source_incomplete/);assert.equal(f.state.calls,0);}finally{f.db.close();}});
await check('Private data found in first page transcription blocks the second image dispatch',async()=>{const f=await completed('blank','privacy');try{assert.equal(f.state.calls,1);assert.equal(await f.question(),undefined);assert.equal(f.db.prepare('SELECT error FROM material_ai_units').get().error,'privacy_blocked');}finally{f.db.close();}});
await check('Unknown transport, extra response fields and source change during final dispatch never auto-replay or publish',async()=>{for(const mode of ['unknown','extra','changed_final']){const f=await completed('blank',mode);try{assert.equal(await f.question(),undefined);const calls=f.state.calls;for(let i=0;i<3;i++)await f.repo.drain();assert.equal(f.state.calls,calls);assert.equal(f.db.prepare('SELECT status FROM material_ai_units').get().status,'outcome_unknown');}finally{f.db.close();}}});
await check('Revoked source receipts, stored images, publication metadata and raw final receipts invalidate readback',async()=>{for(const mode of ['source','image','slot','raw']){const f=await completed();try{const question=await f.question();if(mode==='source')f.db.prepare("UPDATE material_pdf_pages SET error='changed'").run();if(mode==='image')f.db.exec('DELETE FROM material_ai_image_inputs');if(mode==='slot')f.db.prepare("UPDATE material_ai_page_units SET final_sha=?").run('b'.repeat(64));if(mode==='raw')f.db.prepare("UPDATE material_ai_units SET final_json=?").run(JSON.stringify({...JSON.parse(f.db.prepare('SELECT final_json FROM material_ai_units').get().final_json),pageText:text+'extra'}));await assert.rejects(f.repo.validate(question),/source_changed|source_incomplete/);await assert.rejects(f.repo.page(query(f)),/source_changed|source_incomplete/);}finally{f.db.close();}}});
await check('Strict page schemas and query/source descriptors reject forged fields and getters',async()=>{assert.throws(()=>parseAiPageResponse(JSON.stringify({schemaVersion:pageSchema,outcome:'no_questions',questions:[],pageText:'',pageIssues:[],confirmed:true})),/invalid_response/);let read=false;assert(!validAiPageQuery({schemaVersion:'xiaozhi.material-ai-page.v1',batchId:'aibatch_'+randomUUID(),get ordinal(){read=true;return 1;}}));assert(!read);assert(!validMaterialPageSource({schemaVersion:'fake'}));});
await check('Real retrieval source links and revision clocks bind page-backed questions and invalidate an asynchronous old hit',async()=>{
 const f=fixture();try{
  await f.init();const {RetrievalRepository}=await import('../../src/main/retrieval/repository.ts');let retrieval;
  retrieval=new RetrievalRepository({all:f.host.all,run:f.host.run,chunk:r=>r,question:r=>({...f.saved.find(q=>q.id===r.id),archive:JSON.parse(r.archive_json)}),fullText:()=>({}),keyword:async()=>[],writer:async action=>{f.db.exec('BEGIN IMMEDIATE');try{const v=await action(retrieval);f.db.exec('COMMIT');return v;}catch(e){f.db.exec('ROLLBACK');throw e;}}});await retrieval.migrate();await retrieval.migrate();
  f.batch=await f.repo.create(f.input);await f.repo.drain();await f.repo.drain();const question=await f.question(),fact=await retrieval.fact('question',question.id);assert(!fact.fact.deleted);assert.equal(fact.sources[0].id,f.id);assert.equal(f.db.prepare('SELECT resource_id FROM retrieval_question_sources WHERE question_id=?').get(question.id).resource_id,f.id);
  const oldRevision=fact.sources[0].revision,raw=JSON.parse(f.db.prepare('SELECT result_json FROM material_pdf_pages').get().result_json);raw.width++;
  f.db.prepare('UPDATE material_pdf_pages SET result_json=?').run(JSON.stringify(raw));assert(f.db.prepare('SELECT revision FROM retrieval_source_revisions WHERE resource_id=?').get(f.id).revision>oldRevision);
  const current=await retrieval.filterCurrent('question',[{id:question.id,seq:fact.fact.seq,sources:fact.sources}]);assert(!current.has(question.id));assert((await retrieval.fact('question',question.id)).fact.deleted);
 }finally{f.db.close();}
});
await check('Page-backed v5 questions remain readable through the real Pi question-context gate with no false teacher attribution',async()=>{
 const f=await completed();try{const question=await f.question();const {readQuestionContextSource,questionVersion}=await import('../../src/main/education/question-context-provider.ts');const result=await readQuestionContextSource({getQuestionNotebookEntry:async()=>question,readArchivedQuestionContext:async q=>f.repo.validate(q)},{schemaVersion:'xiaozhi.question-context.v1',questionId:question.id,version:questionVersion(question)});assert(result);assert(!JSON.stringify(result).includes('教师已确认'));}finally{f.db.close();}
});
await check('Read-preserving rollback disables new and queued page production while existing v5 receipts remain readable',async()=>{
 const old=process.env.OMNI_EDU_AI_PAGE_RESTORATION,f=await completed(),pending=fixture();try{
  await pending.init();await pending.repo.create(pending.input);process.env.OMNI_EDU_AI_PAGE_RESTORATION='0';
  await pending.repo.drain();assert.equal(pending.state.calls,0);assert.equal(pending.db.prepare('SELECT error FROM material_ai_units').get().error,'page_restoration_disabled');
  await assert.rejects(pending.repo.create(pending.input),/page_restoration_disabled/);await f.repo.validate(await f.question());assert.equal((await f.repo.page(query(f))).text,text);
 }finally{if(old===undefined)delete process.env.OMNI_EDU_AI_PAGE_RESTORATION;else process.env.OMNI_EDU_AI_PAGE_RESTORATION=old;f.db.close();pending.db.close();}
});
await check('A complete but unreadable OCR body is preserved while the original page supplies a readable source-backed question',async()=>{
 const f=await completed('complete');try{const question=await f.question();assert(archiveEligible(question));assert.equal(question.archive.sources.length,1);await f.repo.validate(question);assert.equal((await f.repo.page(query(f))).ocrText,'本地乱码#???');assert.equal(f.db.prepare('SELECT content_md FROM resource_chunks').get().content_md,'本地乱码#???');f.db.prepare("UPDATE resource_chunks SET content_md='changed'").run();await assert.rejects(f.repo.validate(question),/source_changed/);}finally{f.db.close();}
});
await check('Actual provider requests carry one page schema, unchanged OCR, an original image and the complete first transcript',async()=>{
 const {completeMaterialAi}=await import('../../src/main/assets/material-ai-provider.ts'),ordinary=globalThis.fetch,requests=[];
 try{const raw=JSON.stringify({schemaVersion:pageSchema,outcome:'questions',pageText:text,pageIssues:[],questions:[q]});globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:raw}}]}),{status:200});};
  const args={model:'deepseek-flash',apiKey:'controlled-test-only',text:'原始OCR乱码',page:true,imageCoverage:true,image:{mime:'image/png',data:Buffer.from('controlled-page').toString('base64')}};await completeMaterialAi(args,new AbortController().signal);await completeMaterialAi({...args,previous:parseAiPageResponse(raw)},new AbortController().signal);
  assert.equal(requests.length,2);for(const r of requests){const s=r.messages[0].content;assert(s.includes(pageSchema));assert(s.includes('schemaVersion/outcome/questions/pageText/pageIssues五个字段'));assert(!s.includes('xiaozhi.material-ai-image-response.v1'));assert(!s.includes('xiaozhi.material-ai-response.v1'));assert.equal(JSON.parse(r.messages[1].content[0].text).material,args.text);assert.equal(r.messages[1].content.filter(c=>c.type==='image_url').length,1);}assert.equal(JSON.parse(requests[1].messages[1].content[0].text).firstDraft.pageText,text);
 }finally{globalThis.fetch=ordinary;}
});
await check('New original-page units freeze the actual PDF and image OCR status for both passes',async()=>{
 for(const status of ['complete','blank','failed','needs_review']){const f=fixture(status);try{await f.init();const batch=await f.repo.create(f.input),unit=JSON.parse(f.db.prepare('SELECT input_json FROM material_ai_units WHERE batch_id=?').get(batch).input_json);assert.deepEqual(unit.pagePrompt,{policy:MATERIAL_PAGE_PROMPT,ocrStatus:status});await f.repo.drain();await f.repo.drain();assert.deepEqual(f.state.prompts,[unit.pagePrompt,unit.pagePrompt]);}finally{f.db.close();}}
 for(const status of ['complete','blank','failed']){const f=await imageFixture(status);try{const batch=await f.repo.create(f.input),unit=JSON.parse(f.db.prepare('SELECT input_json FROM material_ai_units WHERE batch_id=?').get(batch).input_json);assert.deepEqual(unit.pagePrompt,{policy:MATERIAL_PAGE_PROMPT,ocrStatus:status});await f.repo.drain();await f.repo.drain();assert.deepEqual(f.state.prompts,[unit.pagePrompt,unit.pagePrompt]);}finally{f.db.close();}}
});
await check('Invalid, forged or changed prompt metadata is rejected before a paid dispatch',async()=>{
 let invoked=false;assert(!validAiPagePrompt({policy:MATERIAL_PAGE_PROMPT,get ocrStatus(){invoked=true;return 'complete';}}));assert(!invoked);
 for(const value of [{policy:'future',ocrStatus:'complete'},{policy:MATERIAL_PAGE_PROMPT,ocrStatus:'failed'},{policy:MATERIAL_PAGE_PROMPT,ocrStatus:'complete',force:true}]){const f=fixture('complete');try{await f.init();const batch=await f.repo.create(f.input),row=f.db.prepare('SELECT input_json FROM material_ai_units WHERE batch_id=?').get(batch),unit=JSON.parse(row.input_json);unit.pagePrompt=value;f.db.prepare('UPDATE material_ai_units SET input_json=? WHERE batch_id=?').run(JSON.stringify(unit),batch);await f.repo.drain();assert.equal(f.state.calls,0);assert.equal(f.db.prepare('SELECT calls FROM material_ai_batches WHERE id=?').get(batch).calls,0);assert.equal(f.db.prepare('SELECT error FROM material_ai_units WHERE batch_id=?').get(batch).error,'source_changed');}finally{f.db.close();}}
});
await check('A legacy stored first pass resumes without silently changing its prompt policy; saved v2 receipts retain strict provenance',async()=>{
 const f=fixture('complete');try{await f.init();const batch=await f.repo.create(f.input),row=f.db.prepare('SELECT input_json FROM material_ai_units WHERE batch_id=?').get(batch),unit=JSON.parse(row.input_json);delete unit.pagePrompt;const first=JSON.stringify({schemaVersion:pageSchema,outcome:'questions',pageText:text,pageIssues:[],questions:[q]}),image=Buffer.from('controlled-owned-image'),imageSha=sha(image);f.db.prepare("UPDATE material_ai_units SET input_json=?,status='first_saved',first_json=?,image_sha=? WHERE batch_id=?").run(JSON.stringify(unit),first,imageSha,batch);f.db.prepare('INSERT INTO material_ai_image_inputs(batch_id,ordinal,image_sha,mime,data_base64) VALUES(?,1,?,?,?)').run(batch,imageSha,'image/png',image.toString('base64'));f.db.prepare('UPDATE material_ai_batches SET calls=1 WHERE id=?').run(batch);await f.repo.drain();assert.equal(f.db.prepare('SELECT status FROM material_ai_units WHERE batch_id=?').get(batch).status,'complete');assert.deepEqual(f.state.prompts,[null]);assert.equal(f.state.calls,1);assert.equal(f.db.prepare('SELECT first_json FROM material_ai_units WHERE batch_id=?').get(batch).first_json,first);assert.equal(f.db.prepare('SELECT calls FROM material_ai_batches WHERE id=?').get(batch).calls,2);await f.repo.validate(await f.question());}finally{f.db.close();}
 const v=await completed('complete');try{await v.repo.validate(await v.question());const row=v.db.prepare('SELECT input_json FROM material_ai_units').get(),unit=JSON.parse(row.input_json);unit.pagePrompt={policy:'forged',ocrStatus:'complete'};v.db.prepare('UPDATE material_ai_units SET input_json=?').run(JSON.stringify(unit));await assert.rejects(v.repo.page(query(v)),/source_changed/);}finally{v.db.close();}
});
await check('Versioned provider prompt conveys success truthfully, preserves source metadata and keeps real doubts and strict output',async()=>{
 const {completeMaterialAi}=await import('../../src/main/assets/material-ai-provider.ts'),ordinary=globalThis.fetch,requests=[];
 try{const raw=JSON.stringify({schemaVersion:pageSchema,outcome:'questions',pageText:text,pageIssues:[],questions:[q]});globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:raw}}]}),{status:200});};
  const args={model:'deepseek-flash',apiKey:'controlled-only',text:'成功识别但仍可能错字',page:true,imageCoverage:true,image:{mime:'image/png',data:Buffer.from('controlled-page').toString('base64')},pagePrompt:{policy:MATERIAL_PAGE_PROMPT,ocrStatus:'complete'}};
  await completeMaterialAi(args,new AbortController().signal);await completeMaterialAi({...args,previous:parseAiPageResponse(raw)},new AbortController().signal);
  for(const r of requests){const s=r.messages[0].content;assert(s.includes(MATERIAL_PAGE_PROMPT));assert(!s.includes('本次本地OCR为空、失败或待核'));assert(s.includes('出处、年份、难度标记'));assert(s.includes('原图仍有模糊'));assert(s.includes('图题仍按现规则requiresImage=true'));assert(s.includes(pageSchema));assert.deepEqual(JSON.parse(r.messages[1].content[0].text).pageContext,args.pagePrompt);}
  for(const bad of [{...args,pagePrompt:{policy:'future',ocrStatus:'complete'}},{...args,page:false}])await assert.rejects(completeMaterialAi(bad,new AbortController().signal),/invalid_input/);assert.equal(requests.length,2);
 }finally{globalThis.fetch=ordinary;}
});
await check('Transient local worker contention stays pending without a charge; due work bypasses it and the original resumes once',async()=>{
 const f=fixture();try{await f.init();f.state.mode='busy_image_once';const first=await f.repo.create(f.input);await f.repo.drain();assert.equal(f.state.calls,0);assert.equal(f.db.prepare('SELECT status FROM material_ai_units WHERE batch_id=?').get(first).status,'pending','A busy local worker is not a permanent AI failure');const second=await f.repo.create(f.input);await f.repo.drain();await f.repo.drain();assert.equal(f.db.prepare('SELECT status FROM material_ai_units WHERE batch_id=?').get(second).status,'complete');assert.equal(f.state.calls,2);f.db.prepare('UPDATE material_ai_units SET retry_at=0 WHERE batch_id=?').run(first);await f.repo.drain();await f.repo.drain();assert.equal(f.state.calls,4);assert.equal(f.db.prepare('SELECT calls FROM material_ai_batches WHERE id=?').get(first).calls,2);}finally{f.db.close();}
});
await check('Superscript/subscript loss is a mathematical change, never whitespace-compatible page or question agreement',async()=>{
 for(const mode of ['math_notation_changed','math_stem_changed']){const f=await completed('blank',mode);try{assert.equal(f.db.prepare('SELECT status FROM material_ai_units WHERE batch_id=?').get(f.batch).status,'review','x²/x2 and y₁/y1 cannot qualify as identical source content');const question=await f.question();if(question)assert(!archiveEligible(question));assert.equal((await f.repo.page(query(f))).status,'needs_review');}finally{f.db.close();}}
});
await check('Independent images with blank, failed or garbled OCR reuse the durable two-pass page path, bank source proof and exact original OCR',async()=>{
 for(const status of ['blank','failed','complete']){const f=await imageFixture(status);try{const before=f.db.prepare('SELECT * FROM material_image_ocr_receipts').get();f.batch=await f.repo.create(f.input);await f.repo.drain();await f.repo.drain();const question=await f.question();assert(question&&validQuestionArchive(question.archive)&&archiveEligible(question));assert.equal(question.archive.pageSource.schemaVersion,'xiaozhi.material-image-source.v1');await f.repo.validate(question);assert.equal(f.state.calls,2);const view=await f.repo.page(query(f));assert.equal(view.text,text);assert.equal(view.ocrText,status==='complete'?'本地乱码#???':'');assert(!('inputImage'in view),'Index/Pi reads must not carry a Base64 image');const pictured=await f.repo.page({...query(f),includeImage:true});assert(pictured.inputImage.dataUrl.startsWith('data:image/png;base64,'));assert.deepEqual(f.db.prepare('SELECT * FROM material_image_ocr_receipts').get(),before);f.db.prepare("UPDATE material_image_ocr_receipts SET generation=?").run(randomUUID());await assert.rejects(f.repo.validate(question),/source_changed/);await assert.rejects(f.repo.page(query(f)),/source_changed/);}finally{f.db.close();}}
});
await check('New image source cannot masquerade as PDF; malformed opt-in, stop flag and private images cannot dispatch',async()=>{
 assert(!validAiPageQuery({schemaVersion:'xiaozhi.material-ai-page.v1',batchId:'aibatch_'+randomUUID(),ordinal:1,includeImage:false}));
 for(const mode of ['private','stop','pdf_alias']){const f=await imageFixture();try{if(mode==='private'){f.db.prepare('INSERT INTO resource_chunks VALUES(?,?,1,1,0,?)').run('chunk_'+randomUUID(),f.id,'private');await assert.rejects(f.repo.create(f.input),/privacy_blocked/);}
 else if(mode==='stop'){process.env.OMNI_EDU_AI_PAGE_RESTORATION='0';await assert.rejects(f.repo.create(f.input),/source_incomplete/);delete process.env.OMNI_EDU_AI_PAGE_RESTORATION;}
 else{f.batch=await f.repo.create(f.input);const r=f.db.prepare('SELECT input_json FROM material_ai_units').get(),unit=JSON.parse(r.input_json);unit.pageSource.schemaVersion='xiaozhi.material-page-source.v1';f.db.prepare('UPDATE material_ai_units SET input_json=?').run(JSON.stringify(unit));await f.repo.drain();assert.equal(await f.question(),undefined);}assert.equal(f.state.calls,0);}finally{delete process.env.OMNI_EDU_AI_PAGE_RESTORATION;f.db.close();}}
});
async function indexedPage(mode='ordinary'){
 const f=await completed('blank',mode);
  const {MaterialFullTextSearch}=await import('../../src/main/assets/material-full-text.ts'),{RetrievalRepository}=await import('../../src/main/retrieval/repository.ts');
  f.db.exec("ALTER TABLE teacher_resources ADD COLUMN title TEXT NOT NULL DEFAULT '原页';");
  let rag;const map=r=>({id:r.id,resourceId:r.resource_id,chunkIndex:r.chunk_index||0,pageNumber:r.page_number,contentMd:r.content_md,containsPersonalData:!!r.contains_personal_data});
  const lexical=new MaterialFullTextSearch({...f.host,map,restored:()=>rag?.restoredText});await lexical.migrate();
  rag=new RetrievalRepository({...f.host,chunk:map,question:r=>r,fullText:()=>lexical,keyword:async()=>[],page:(batchId,ordinal)=>f.repo.page({schemaVersion:'xiaozhi.material-ai-page.v1',batchId,ordinal}),clean:async t=>t,writer:async action=>{f.db.exec('BEGIN IMMEDIATE');try{const v=await action(rag);f.db.exec('COMMIT');return v;}catch(e){f.db.exec('ROLLBACK');throw e;}}});await rag.migrate();
  if(rag.restoredText)for(let i=0;i<3;i++)await rag.restoredText.drain();
  // The full repository imports Electron worker hosts. Its typed IPC/source adapter is exercised in Electron;
  // this source-only fixture delegates directly to the actual index receipt reader, without creating body chunks.
  const materials={source:async source=>{const {view}=await rag.restoredText.read(source);return{source,restored:view,body:{resource:view.resource,chunks:[],total:0,offset:0,hasMore:false}};}};
  const store={materials,retrieval:rag,materialSearch:lexical,sanitizeProblemText:async text=>{f.state.onSanitize?.();return{sanitizedText:text};},listStudents:async()=>[]};
  return{...f,rag,lexical,store,async index(){for(let i=0;i<3;i++)await rag.restoredText.drain();}};
}
await check('A fully agreeing mixed figure page enters text retrieval while its question remains held and Pi states the boundary',async()=>{
 const f=await indexedPage('figure');try{
  const question=await f.question();assert(!archiveEligible(question));assert.equal(f.db.prepare('SELECT status FROM material_ai_units').get().status,'review');
  const result=await f.lexical.candidates('7+8');assert.equal(result.units.length,1,'A held figure question cannot hide an independently complete transcript');
  const view=await f.repo.page(query(f));assert.equal(view.status,'needs_review');assert.equal(view.transcriptionStatus,'complete');
  const {createMaterialTools}=await import('../../src/main/assets/material-tools.ts');const tool=createMaterialTools(f.store,()=>true).find(t=>t.name==='office_read_material');
  const read=await tool.execute('mixed',{resourceId:f.id,offset:0,restoredSource:result.units[0].restored},new AbortController().signal);assert(!read.isError);const body=JSON.parse(read.content[0].text);assert.equal(body.teacherConfirmed,false);assert.equal(body.questionExtractionStatus,'needs_review');assert(body.warning.includes('题目'));assert.equal(body.text,text);assert.equal(f.state.calls,2);
 }finally{f.db.close();}
});
await check('Question outcome revisions do not hide an unchanged transcript or qualify the held extraction',async()=>{
 const f=await indexedPage('outcome_changed');try{assert.equal((await f.repo.page(query(f))).transcriptionStatus,'complete');assert.equal((await f.lexical.candidates('7+8')).units.length,1);assert(!archiveEligible(await f.question()));assert.equal(f.state.calls,2);}finally{f.db.close();}
});
await check('Whitespace cannot merge separate numbers or algebraic tokens into a different source value',async()=>{
 const f=await indexedPage('numeric_spacing');try{assert.equal((await f.repo.page(query(f))).transcriptionStatus,'needs_review','1 2 cannot become12 through whitespace removal');assert.equal((await f.rag.restoredText.status()).ready,0);assert.equal(f.state.calls,2);}finally{f.db.close();}
});
await check('Transcription uncertainty in either pass, mathematical changes and page-level doubts remain excluded from text retrieval',async()=>{
 for(const mode of ['question_uncertain','question_final_uncertain','question_cross_page','question_incomplete','mismatch','math_notation_changed','unclear']){const f=await indexedPage(mode);try{
  const view=await f.repo.page(query(f));assert.equal(view.transcriptionStatus,'needs_review',mode);assert.equal((await f.lexical.candidates('7+8')).units.length,0,mode);assert.equal((await f.rag.restoredText.status()).ready,0,mode);assert.equal(f.state.calls,2);
 }finally{f.db.close();}}
});
await check('Old blocked-page policy migrates once, requeues only a bounded cursor and keeps privacy/source blocks and question facts',async()=>{
 const f=await indexedPage('figure');try{
  const before=f.db.prepare('SELECT archive_json FROM question_bank_items').all();
  f.db.prepare('UPDATE material_ai_text_documents_v1 SET active=0').run();f.db.prepare('UPDATE material_ai_text_control_v1 SET transcription_policy=1,cursor=9999').run();
  f.db.prepare("INSERT INTO material_ai_text_dirty_v1(batch_id,ordinal,error) VALUES(?,1,'page_needs_review')").run(f.batch);
  const privateId='aibatch_'+randomUUID();f.db.prepare("INSERT INTO material_ai_text_dirty_v1(batch_id,ordinal,error) VALUES(?,1,'privacy_blocked')").run(privateId);
  await f.rag.restoredText.migrate();assert.equal(f.db.prepare('SELECT cursor FROM material_ai_text_control_v1').get().cursor,0);assert.equal(f.db.prepare('SELECT error FROM material_ai_text_dirty_v1 WHERE batch_id=?').get(f.batch).error,'page_needs_review','Migration must not rewrite the whole blocked queue');
  await f.index();assert.equal((await f.lexical.candidates('7+8')).units.length,1);const cursor=f.db.prepare('SELECT cursor FROM material_ai_text_control_v1').get().cursor;
  await f.rag.restoredText.migrate();assert.equal(f.db.prepare('SELECT cursor FROM material_ai_text_control_v1').get().cursor,cursor);assert.equal(f.db.prepare('SELECT error FROM material_ai_text_dirty_v1 WHERE batch_id=?').get(privateId).error,'privacy_blocked');assert.deepEqual(f.db.prepare('SELECT archive_json FROM question_bank_items').all(),before);assert.equal(f.state.calls,2);
 }finally{f.db.close();}
});
await check('A source-backed ordinary AI page with zero questions enters existing full-text and hybrid material retrieval without fabricating OCR',async()=>{
 const f=await indexedPage();try{const {lexical,rag}=f;
  const result=await lexical.candidates('均匀介质');assert.equal(result.units.length,1,'A successfully restored textbook page is currently invisible to material retrieval');assert(result.units[0].restored,'AI transcription must carry its own reference rather than an OCR-body receipt');
  const hybrid=await rag.materials('均匀介质');assert.equal(hybrid.units.length,1);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM resource_chunks').get().n,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM question_bank_items').get().n,0);assert.equal(f.state.calls,2,'Indexing must not call the model again');
 }finally{f.db.close();}
});
await check('Pi reads the full long restored page with exact source, tail continuation and Unicode-safe boundaries; original-body and classroom authority stay separate',async()=>{
 const f=await indexedPage('ordinary_long');try{
  const {createMaterialTools}=await import('../../src/main/assets/material-tools.ts'),{validAiTextSource}=await import('../../src/shared/material-ai-text.ts'),{validMaterialSource}=await import('../../src/shared/materials.ts'),{createAnswerEvidence}=await import('../../src/main/xiaozhi-agent/answer-evidence.ts'),{validClassroomMaterial}=await import('../../src/shared/classroom-context.ts');
  const source=(await f.lexical.candidates('尾部证据')).units[0].restored;assert(validAiTextSource(source));assert(!validMaterialSource(source));assert(!validClassroomMaterial({source,title:'AI页',characters:10,truncated:false,recognition:'saved_text'}));
  const tool=createMaterialTools(f.store,()=>true).find(t=>t.name==='office_read_material'),pieces=[];let start=0,last;
  do{last=await tool.execute('read-'+start,{resourceId:f.id,offset:0,restoredSource:source,characterOffset:start},new AbortController().signal);assert(!last.isError);const body=JSON.parse(last.content[0].text);assert.equal(body.teacherConfirmed,false);assert.equal(body.recognition,'ai_page_two_pass_unreviewed');pieces.push(body.text);start=body.nextCharacterOffset;}while(start!==null);
  const view=await f.rag.restoredText.read(Object.fromEntries(Object.entries(source).reverse()));assert.equal(pieces.join(''),view.view.text);assert(pieces[1].startsWith('😀'));assert(pieces.join('').endsWith('尾部证据：色散与折射。'));
  const evidence=createAnswerEvidence('test-restored');assert(evidence.attach('office_read_material',last).details.data.sources[0].citationId);assert.equal(evidence.sources().length,1);
  const split=await tool.execute('bad',{resourceId:f.id,offset:0,restoredSource:source,characterOffset:12000},new AbortController().signal);assert(split.isError);assert.equal(f.state.calls,2);
 }finally{f.db.close();}
});
await check('A revised AI page is held instead of serving an older transcript, then a new valid page clears obsolete blocked state',async()=>{
 const f=await indexedPage();try{
  const old=(await f.lexical.candidates('均匀介质')).units[0].restored;
  f.state.mode='unclear';await f.repo.create(f.input);await f.repo.drain();await f.repo.drain();await f.repo.drain();await f.index();assert.equal((await f.rag.materials('均匀介质')).units.length,0);await assert.rejects(f.rag.restoredText.read(old),/source_changed/);assert((await f.rag.restoredText.status()).blocked>0);
  f.state.mode='ordinary';await f.repo.create(f.input);await f.repo.drain();await f.repo.drain();await f.repo.drain();await f.index();assert.equal((await f.rag.materials('均匀介质')).units.length,1);assert.equal((await f.rag.restoredText.status()).blocked,0,'Obsolete failed drafts must not leave the current valid page permanently incomplete');assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_ai_text_documents_v1').get().n,1);
 }finally{f.db.close();}
});
await check('Rebuilding derived indexes restores a corrupted AI text cache from saved receipts with no paid replay; stop-production preserves existing reads',async()=>{
 const f=await indexedPage(),old=process.env.OMNI_EDU_AI_TEXT_INDEX;try{
  const source=(await f.lexical.candidates('均匀介质')).units[0].restored;f.db.prepare("UPDATE material_ai_text_documents_v1 SET content_md='corrupted'").run();await assert.rejects(f.rag.restoredText.read(source),/source_changed/);await f.rag.action('rebuild');await f.index();assert.equal((await f.rag.materials('均匀介质')).units.length,1,'A replaceable cache must recover from immutable AI receipts');process.env.OMNI_EDU_AI_TEXT_INDEX='0';assert.equal(await f.rag.restoredText.drain(),0);assert((await f.rag.restoredText.read(source)).view.text.includes('均匀介质'));assert.equal(f.state.calls,2);
 }finally{if(old===undefined)delete process.env.OMNI_EDU_AI_TEXT_INDEX;else process.env.OMNI_EDU_AI_TEXT_INDEX=old;f.db.close();}
});
await check('A chunk moved into a resource as private during reranking revokes both restored-page hits before the asynchronous search returns',async()=>{
 const f=await indexedPage();try{
  const generation=f.db.prepare('SELECT generation FROM material_pdf_jobs').get().generation;f.db.prepare('UPDATE material_pdf_jobs SET total=2').run();const receipt=f.db.prepare('SELECT result_json FROM material_pdf_pages WHERE page=1').get().result_json;f.db.prepare("INSERT INTO material_pdf_pages VALUES(?,2,'blank',?,'')").run(generation,receipt);await f.repo.create({...f.input,start:2});await f.repo.drain();await f.repo.drain();await f.repo.drain();await f.index();assert.equal((await f.rag.materials('均匀介质')).units.length,2);
  const other='resource_'+randomUUID(),chunk='chunk_'+randomUUID();f.db.prepare("INSERT INTO teacher_resources VALUES(?,?,'other.pdf','partial','other')").run(other,'c'.repeat(64));f.db.prepare("INSERT INTO resource_chunks VALUES(?,?,1,1,0,'private')").run(chunk,other);
  f.rag.configure({rerank:async(_q,items)=>{f.db.prepare('UPDATE resource_chunks SET resource_id=?,page_number=NULL WHERE id=?').run(f.id,chunk);return{scores:items.map(i=>({id:i.id,score:1,complete:true}))};}});
  const result=await f.rag.materials('均匀介质');assert.equal(result.units.length,0,'Late privacy changes at the new parent cannot escape the source fence');assert.equal(result.semantic.reason,'source_changed');
 }finally{f.db.close();}
});
await check('An explicitly linked answer book retains original-page transcription and never publishes numbered answers as questions',async()=>{
 const f=fixture('blank');try{
  await f.init();assert(f.repo.books,'Answer-book identity must use the durable role repository');
  f.repo.books.role=async()=>({kind:'answers',questionId:'resource_'+randomUUID(),questionVersion:f.input.version,answerId:f.input.resourceId,answerVersion:f.input.version,revision:1});
  // Keep a stable snapshot just like the persisted pair.
  const role=await f.repo.books.role();f.repo.books.role=async()=>role;
  const runtime=f.repo.runtime;runtime.complete=async input=>{f.state.calls++;assert.equal(input.answerBook,true);return JSON.stringify({schemaVersion:pageSchema,outcome:'no_questions',pageText:'第十三章 内能\n1. A\n2. C\n3. 热传递',pageIssues:[],questions:[]});};
  const id=await f.repo.create(f.input);await f.repo.drain();await f.repo.drain();assert.equal(f.state.calls,2);assert.equal(await f.question(),undefined);
  const view=await f.repo.page({schemaVersion:'xiaozhi.material-ai-page.v1',batchId:id,ordinal:1});assert.equal(view.status,'complete');assert(view.text.includes('1. A'));assert.equal(f.db.prepare('SELECT status FROM material_ai_units').get().status,'no_questions');
  f.repo.books.role=async()=>null;await assert.rejects(f.repo.page({schemaVersion:'xiaozhi.material-ai-page.v1',batchId:id,ordinal:1}),/source_changed/);
  f.repo.books.role=async()=>({...role,revision:3});assert.equal((await f.repo.page({schemaVersion:'xiaozhi.material-ai-page.v1',batchId:id,ordinal:1})).bookAnswers.entries.length,3);assert.equal(f.state.calls,2);
  f.repo.books.role=async()=>({...role,questionVersion:'b'.repeat(64),revision:3});await assert.rejects(f.repo.page({schemaVersion:'xiaozhi.material-ai-page.v1',batchId:id,ordinal:1}),/source_changed/);
 }finally{f.db.close();}
});
await check('Restoring a saved receipt never permits a stale revision to dispatch or publish an in-flight unit',async()=>{
 const f=fixture('blank');try{await f.init();let role={kind:'answers',questionId:'resource_'+randomUUID(),questionVersion:f.input.version,answerId:f.input.resourceId,answerVersion:f.input.version,revision:1};f.repo.books.role=async()=>role;
 f.repo.runtime.complete=async()=>{f.state.calls++;role={...role,revision:3};return JSON.stringify({schemaVersion:pageSchema,outcome:'no_questions',pageText:'第十三章 素养基础测试卷\n1. A 解析：原文。',pageIssues:[],questions:[]});};
 await f.repo.create(f.input);await f.repo.drain();assert.equal(f.state.calls,1);role={...role,revision:3};await f.repo.drain();assert.equal(f.state.calls,1);assert.equal(await f.question(),undefined);assert.equal(f.db.prepare('SELECT error FROM material_ai_units').get().error,'source_changed');
 }finally{f.db.close();}
});
await check('An answer-book provider that invents a question is rejected without publishing it',async()=>{
 const f=fixture('blank');try{
  await f.init();const role={kind:'answers',questionId:'resource_'+randomUUID(),questionVersion:f.input.version,answerId:f.input.resourceId,answerVersion:f.input.version,revision:1};f.repo.books.role=async()=>role;
  f.repo.runtime.complete=async()=>{f.state.calls++;return JSON.stringify({schemaVersion:pageSchema,outcome:'questions',pageText:text,pageIssues:[],questions:[q]});};
  await f.repo.create(f.input);await f.repo.drain();assert.equal(await f.question(),undefined);assert.equal(f.state.calls,1);const row=f.db.prepare('SELECT status,error FROM material_ai_units').get();assert.equal(row.status,'outcome_unknown');assert.equal(row.error,'invalid_response');await f.repo.drain();assert.equal(f.state.calls,1);
 }finally{f.db.close();}
});
await check('An explicit advertisement cannot publish a provider-invented miniature question',async()=>{
 const f=fixture('blank');try{
  await f.init();f.repo.runtime.complete=async()=>{f.state.calls++;return JSON.stringify({schemaVersion:pageSchema,outcome:'questions',pageText:'本页为广告页，打印前可以把这页删掉。\n'+text,pageIssues:[],questions:[q]});};
  await f.repo.create(f.input);await f.repo.drain();await f.repo.drain();assert.equal(await f.question(),undefined);const row=f.db.prepare('SELECT status,error FROM material_ai_units').get();assert.equal(row.status,'outcome_unknown');assert.equal(row.error,'invalid_response');await f.repo.drain();assert.equal(f.state.calls,2);
 }finally{f.db.close();}
});
await check('Declared declarative MCQs and fill-ins preserve their full source bodies without promoting decimal headings or undeclared lists',async()=>{
 const {restoredPageQuestions}=await import('../../src/main/assets/material-ai-page-content.ts');const f=await completed();try{const source=(await f.repo.page(query(f))).source;
 const mcq='物体的内能变化（ ）。\nA.温度升高\nB.温度降低\nC.温度不变\nD.不能确定',fill='分子在不停地做______运动。',raw='1. '+mcq+'\n11. '+fill;
 const result=restoredPageQuestions(raw,source,['1','11']);assert.deepEqual(result.map(v=>v.number),['1','11']);assert.equal(result[0].fields.stem,mcq);assert.equal(result[1].fields.stem,fill);assert.deepEqual(result.map(v=>v.risks),[[],[]]);assert.equal(raw,'1. '+mcq+'\n11. '+fill);
 assert.equal(restoredPageQuestions('1. 目录\n2. 前言\n5.3 练习版本',source).length,0);assert.equal(restoredPageQuestions('5.3 练习版本',source,['5']).length,0);
 const duplicate=restoredPageQuestions('1. '+mcq+'\n1. '+fill,source,['1']);assert(duplicate.every(v=>v.risks.includes('ambiguous_number')));assert.equal(restoredPageQuestions(raw,source,['12']).some(v=>v.number==='12'),false);
 const {assessAiPage}=await import('../../src/main/assets/material-ai-page-publish.ts');const response={schemaVersion:pageSchema,outcome:'questions',pageText:raw+'\n第12题 计算7+8。',pageIssues:[],questions:[{...q,number:'1'},{...q,number:'11'}]};assert(assessAiPage(response,response,source).omitted,'Undeclared visible questions must still block completeness');
 }finally{f.db.close();}
});
await check('Coverage stored only outside the canonical stem cannot qualify choices, subquestions, tables or formulas',async()=>{
 const {pageQuestionEvidence}=await import('../../src/shared/material-ai-page.ts');
 for(const [field,body] of Object.entries({choices:'A.甲\nB.乙\nC.丙\nD.丁',subquestions:'（1）写出结果。\n（2）说明理由。',tables:'温度/℃ 20 30\n时间/s 1 2',formulas:'Q=cmΔt'})){
  const item=structuredClone(q);item.projection[field]={state:'provided',text:body};const response={schemaVersion:pageSchema,outcome:'questions',pageText:'第1题 '+stem+'\n'+body,pageIssues:[],questions:[item]};assert.equal(pageQuestionEvidence(response,response,'1',sha('pixels'),stem+'\n'+body),undefined,field+' omitted from stem');
  item.stem+='\n'+body;item.projection.statement.text=item.stem;assert.equal(pageQuestionEvidence(response,response,'1',sha('pixels'),stem),undefined,field+' absent from actual page candidate');
  if(field!=='tables')assert(pageQuestionEvidence(response,response,'1',sha('pixels'),item.stem),field+' complete source must remain usable');
 }
});
console.log(JSON.stringify({success:true,checks,scope:'Actual durable executor/SQLite and strict page schemas with controlled image/model only; not natural visual or mathematical quality'}));
