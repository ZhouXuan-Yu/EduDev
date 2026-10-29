import '../office-agent/register-source.mjs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {createHash,randomUUID} from 'node:crypto';
const {MaterialAiRepository}=await import('../../src/main/assets/material-ai-repository.ts');
const sha=x=>createHash('sha256').update(x).digest('hex'),pageSchema='xiaozhi.material-ai-page-response.v1';
const stem='计算7+8。',text='学科：数学\n年级：初二\n知识点：算术\n题型：解答题\n难度：中等\n第1题 '+stem+'\n【答案】15\n【解析】7与8相加得到15。';
const q={number:'1',stem,answer:'15',analysis:'7与8相加得到15。',subject:'数学',grade:'初二',knowledgePoint:'算术',questionType:'解答题',difficulty:'medium',answerOrigin:'source',analysisOrigin:'source',requiresImage:false,issues:[],projection:Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(k=>[k,{state:k==='statement'?'provided':'not_applicable',text:k==='statement'?stem:''}]))};
function fixture(status='blank'){
 const db=new DatabaseSync(':memory:'),id='resource_'+randomUUID(),version=sha('owned-original'),generation=randomUUID(),saved=[],state={calls:0,mode:'normal',stamp:'owned-stamp'};let repo;
 db.exec(`CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,archive_json TEXT);
 CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,original_file_name TEXT,parse_status TEXT);CREATE TABLE resource_chunks(id TEXT,resource_id TEXT,page_number INTEGER,contains_personal_data INTEGER);
 CREATE TABLE material_pdf_jobs(resource_id TEXT,version TEXT,total INTEGER,generation TEXT,state TEXT);CREATE TABLE material_pdf_pages(generation TEXT,page INTEGER,status TEXT,result_json TEXT,error TEXT);`);
 db.prepare("INSERT INTO teacher_resources VALUES(?,?,'原页.pdf','partial')").run(id,version);db.prepare("INSERT INTO material_pdf_jobs VALUES(?,?,1,?,'partial')").run(id,version,generation);db.prepare('INSERT INTO material_pdf_pages VALUES(?,1,?,?,?)').run(generation,status,JSON.stringify({nativeText:'',ocrText:'',text:''}),status==='failed'?'ocr_failed':'');
 const materials={resource:async()=>({id,contentHash:version,originalFileName:'原页.pdf',title:'原页',parseStatus:'partial'}),originalStamp:async()=>state.stamp,verify:async()=>{},readingWindow:async()=>{throw Error('unavailable');},source:async()=>{throw Error('Unexpected fabricated body source');}};
 const host={all:async(s,p=[])=>db.prepare(s).all(...p),run:async(s,p=[])=>{db.prepare(s).run(...p);},materials:()=>materials,map:r=>r,create:async fields=>{const v={...fields,id:'question_'+randomUUID(),createdAt:'x',updatedAt:'x'};db.prepare("INSERT INTO question_bank_items VALUES(?,'')").run(v.id);saved.push(v);return v;},writer:async(action,before)=>{db.exec('BEGIN IMMEDIATE');try{const result=await action(repo);before?.();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};repo=new MaterialAiRepository(host);
 repo.configure({codec:{available:()=>true,seal:v=>v,open:v=>v},clean:async v=>v,image:async()=>({mime:'image/png',data:Buffer.from('controlled-owned-image').toString('base64')}),complete:async input=>{
  state.calls++;assert(input.image);assert.equal(input.page,true);assert.equal(input.text,'');
  if(state.mode==='unknown')throw Error('outcome_unknown');
  let result={schemaVersion:pageSchema,outcome:'questions',pageText:text,pageIssues:[],questions:[structuredClone(q)]};
  if(state.mode==='ordinary')result={schemaVersion:pageSchema,outcome:'no_questions',pageText:'光在同种均匀介质中沿直线传播。',pageIssues:[],questions:[]};
  if(state.mode==='blank')result={schemaVersion:pageSchema,outcome:'no_questions',pageText:'',pageIssues:[],questions:[]};
  if(state.mode==='unclear')result={...result,pageIssues:['uncertain_ocr']};
  if(state.mode==='omitted')result={...result,questions:[],outcome:'no_questions'};
  if(state.mode==='mismatch'&&input.previous)result={...result,pageText:text.replace('7+8','7+9')};
  return JSON.stringify(result);
 }});
 const input={schemaVersion:'xiaozhi.material-ai.v1',resourceId:id,version,settingsRevision:1,start:1,count:1,maxCalls:4,images:true,cloudConsent:true,publicMaterial:true};
 return{db,id,version,state,input,repo,async init(){await repo.migrate();await repo.saveSettings({schemaVersion:input.schemaVersion,revision:0,model:'deepseek-flash',apiKey:'controlled-no-network'});},async question(){const r=db.prepare('SELECT * FROM question_bank_items').get();return r?{...saved.find(v=>v.id===r.id),archive:JSON.parse(r.archive_json)}:undefined;}};
}
const f=fixture();try{await f.init();const batch=await f.repo.create(f.input);await f.repo.drain();await f.repo.drain();assert.equal(f.state.calls,2,'A blank OCR receipt with explicit image authorization must get both real executor phases instead of zero-call no_questions');const question=await f.question();assert(question);assert.equal(question.archive.schemaVersion,'xiaozhi.question-archive.v5');assert.equal(question.archive.sources.length,0);assert.equal(question.archive.pageSource.page,1);await f.repo.validate(question);const view=await f.repo.page({schemaVersion:'xiaozhi.material-ai-page.v1',batchId:batch,ordinal:1});assert.equal(view.text,text);assert.equal(view.ocrText,'');console.log(JSON.stringify({success:true,checks:1,scope:'Actual durable executor/SQLite with a controlled image/model; not visual or mathematical quality'}));}finally{f.db.close();}
