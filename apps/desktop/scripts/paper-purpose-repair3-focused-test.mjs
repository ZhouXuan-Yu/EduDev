import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),out=path.join(root,'test-results/a24-a26','repair3-'+Date.now());await mkdir(out,{recursive:true});
await build({stdin:{contents:`export {compilePaperOffice} from './src/main/education/paper-export';export {compileInstancePaperOffice} from './src/main/education/paper-instance-export';export {purposeFulfillmentBlocksConfirmation} from './src/shared/paper-purpose';export {PaperBasketV2Repository} from './src/main/education/paper-basket-v2-repository';export {PaperRepository} from './src/main/education/paper-repository';export {migratePaperBaskets} from './src/main/education/paper-basket-state';export {questionVersion} from './src/main/education/question-context-provider';export {validPaperBasketV2Create,validPaperBasketV2Mutation} from './src/shared/paper-basket-v2';`,resolveDir:root},outfile:path.join(out,'test.mjs'),bundle:true,packages:'external',platform:'node',format:'esm'});
const m=await import(pathToFileURL(path.join(out,'test.mjs')).href),db=new DatabaseSync(path.join(out,'actual.sqlite'));
db.exec(`CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT);CREATE TABLE students(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE questions(id TEXT PRIMARY KEY,data TEXT);CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,student_id TEXT,action_type TEXT,status TEXT,title TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT,result_json TEXT,confirmed_at TEXT,rejected_at TEXT);`);
const file=path.join(out,'source.txt'),source='真实教师题库原文';await writeFile(file,source);const sourceHash=createHash('sha256').update(source).digest('hex');
let cancelled=false,afterWrite=async()=>{},transactions=0;
const sql={all:async(q,p=[])=>db.prepare(q).all(...p),run:async(q,p=[])=>db.prepare(q).run(...p),read:async id=>{const r=db.prepare('SELECT data FROM questions WHERE id=?').get(id);return r?JSON.parse(r.data):undefined;},validate:async()=>{if(createHash('sha256').update(await readFile(file)).digest('hex')!==sourceHash)throw Error('source_changed');},page:async(blueprint,after)=>db.prepare('SELECT id,data FROM questions WHERE id>? ORDER BY id LIMIT 200').all(after).map(r=>({id:r.id,question:JSON.parse(r.data)}))};
const transaction=async fn=>{transactions++;db.exec('BEGIN IMMEDIATE');try{const r=await fn(sql);db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
await m.migratePaperBaskets(sql);
const session='aisession_'+randomUUID(),other='aisession_'+randomUUID(),student='student_'+randomUUID();
db.prepare('INSERT INTO students VALUES (?,?)').run(student,'active');for(const id of [session,other])db.prepare('INSERT INTO ai_conversation_sessions VALUES (?,?,NULL)').run(id,student);
const host={...sql,transaction,readTransaction:transaction,approvedGenerations:async()=>[],afterWrite:()=>afterWrite(),saveSnapshot:async()=>{throw Error('legacy_snapshot');},readSnapshot:async()=>{throw Error('legacy_snapshot');},verifyTemplates:async()=>{}};
const papers=new m.PaperRepository({...sql,transaction,readTransaction:transaction}),repo=new m.PaperBasketV2Repository(host,papers),V2='xiaozhi.paper-basket.v2',req=()=>randomUUID();
let b;const read=()=>repo.read({schemaVersion:V2,sessionId:session,basketId:b.id});
const raw=()=>JSON.parse(db.prepare('SELECT data_json FROM paper_baskets WHERE id=?').get(b.id).data_json);
const input=operation=>({schemaVersion:V2,sessionId:session,basketId:b.id,expectedRevision:b.revision,requestId:req(),operation});
const mutate=async operation=>b=await repo.mutate(input(operation));
const report=[];const pass=s=>{report.push(s);console.log('PASS '+s);};
function question(n,patch={}){const q={id:'question_'+randomUUID(),subject:'数学',grade:'初二',knowledgePoint:'加法',questionType:'选择题',difficulty:'easy',stem:`${n}+1=? A.${n+1} B.${n+2}`,answer:'A',analysis:`${n}+1=${n+1}`,sourceTitle:'真实教师题库',sourceKind:'local_bank',tags:[],createdAt:'now',updatedAt:'now',...patch};db.prepare('INSERT INTO questions VALUES (?,?)').run(q.id,JSON.stringify(q));return q;}
const add=q=>mutate({type:'add',questionId:q.id,expectedSourceVersion:m.questionVersion(q),sectionId:b.blueprint.sections[0].id});
try{
 b=await repo.create({schemaVersion:V2,sessionId:session,requestId:req(),purpose:'practice',practice:{title:'三题练习',subject:'数学',grade:'初二'}});const defaultBlueprint=structuredClone(b.blueprint);
 for(const n of [1,2,3])await add(question(n));
 const confirmInput=()=>({schemaVersion:V2,sessionId:session,basketId:b.id,expectedRevision:b.revision,requestId:req()});
 b=(await repo.confirm(confirmInput())).basket;
 const before=structuredClone(raw().entries),middle=b.entries[1].entryId;
 const pointsInput=input({type:'setEntryPoints',entryId:middle,points:3});b=await repo.mutate(pointsInput);
 assert.equal(b.entries.length,3);assert.equal(b.blueprint.sections.reduce((n,s)=>n+s.count*s.points,0),b.blueprint.totalPoints);
 assert.deepEqual(raw().entries.map(({sectionId,position,...e})=>e),before.map(({sectionId,position,...e})=>e));
 assert.deepEqual(b.entries.map(e=>b.blueprint.sections.find(s=>s.id===e.sectionId).points),[1,3,1]);assert.equal(b.complete,true);
 const scoreReceipt=b.operationReceipt;assert.deepEqual((await repo.mutate(pointsInput)).operationReceipt,scoreReceipt);
 const confirmed=await repo.confirm(confirmInput());b=confirmed.basket;assert.equal(confirmed.paper.totalPoints,5);assert.equal(confirmed.paper.blueprint.sections.length,3);pass('three same-type practice entries with default count=1 can change middle score, preserve instances/reviews, and confirm actual total=5');
 for(const audience of ['student','teacher']){
  for(const compile of [m.compilePaperOffice,m.compileInstancePaperOffice]){
   const draft=compile(confirmed.paper,audience);const text=JSON.stringify(draft);assert.match(text,/用途：练习/);assert.doesNotMatch(text,/30 分钟|考试信息|考试结束|满分|座位号/);assert.match(draft.title,/练习|参考答案/);
  }
  const absent={...confirmed.paper};delete absent.purpose;const legacy=m.compilePaperOffice(absent,audience);assert.deepEqual(legacy,m.compilePaperOffice({...absent,purpose:'paper'},audience));assert.deepEqual(legacy.sections[0],{heading:'试卷说明',paragraphs:[`初二 · 数学 · 30 分钟 · 满分 5 分`,audience==='student'?'学生卷 · 请在答题纸上作答。':'教师答案卷 · 参考答案和解析尚未独立核验，请逐题核对。']});
  const plain={...confirmed.paper,selection:{...confirmed.paper.selection,items:confirmed.paper.selection.items.map(({instance,...item})=>item)}};assert.match(JSON.stringify(m.compilePaperOffice(plain,audience)),/用途：练习/);assert.doesNotMatch(JSON.stringify(m.compilePaperOffice(plain,audience)),/30 分钟|满分/);
 }
 const answer=m.compilePaperOffice(confirmed.paper,'student','answer_sheet');assert.equal(answer.title,'练习答题纸');assert.match(JSON.stringify(answer),/用途：练习/);assert.doesNotMatch(JSON.stringify(answer),/考试|30 分钟|满分|考生|座位号/);
 const oldSheet={...confirmed.paper};delete oldSheet.purpose;const oldAnswer=m.compilePaperOffice(oldSheet,'student','answer_sheet');assert.equal(oldAnswer.title,'答题卡');assert.ok(oldAnswer.sections.some(s=>s.heading==='考试信息'));pass('compiled student/teacher/answer-sheet practice drafts omit host exam defaults; absent-purpose and explicit paper output remain identical');
 await mutate({type:'setPurpose',purpose:'paper'});
 const target={...confirmed.paper.blueprint,totalPoints:6,sections:confirmed.paper.blueprint.sections.map((s,i)=>i===0?{...s,count:2}:s)};
 await mutate({type:'saveFulfillmentPlan',blueprint:target});assert.deepEqual(b.fulfillment.issues,[]);await mutate({type:'confirmFulfillmentPlan',planId:b.fulfillment.planId,digest:b.fulfillment.digest});await mutate({type:'fulfillPlan',planId:b.fulfillment.planId,digest:b.fulfillment.digest,confirmedRevision:b.revision});
 assert.equal(b.fulfillment.report.shortages.reduce((n,s)=>n+s.missing,0),1);assert.equal(b.complete,false);await assert.rejects(repo.confirm(confirmInput()),/conflict/);
 const historical=JSON.stringify(raw().fulfillment),receipts=JSON.stringify(raw().fulfillmentReceipts),members=JSON.stringify(raw().entries);
 await mutate({type:'setPurpose',purpose:'practice'});assert.equal(b.complete,true);const practice=await repo.confirm(confirmInput());b=practice.basket;assert.equal(practice.paper.count,3);assert.equal(practice.paper.totalPoints,5);assert.equal(JSON.stringify(raw().fulfillment),historical);assert.equal(JSON.stringify(raw().fulfillmentReceipts),receipts);assert.equal(JSON.stringify(raw().entries),members);pass('historical fulfilled paper shortage remains byte-exact but does not block current practice confirmation');
 await mutate({type:'setPurpose',purpose:'paper'});assert.equal(b.complete,false);await assert.rejects(repo.confirm(confirmInput()),/conflict/);
 await mutate({type:'saveFulfillmentPlan',blueprint:target});await mutate({type:'confirmFulfillmentPlan',planId:b.fulfillment.planId,digest:b.fulfillment.digest});const pending=JSON.stringify(raw().fulfillment);await mutate({type:'setPurpose',purpose:'practice'});b=(await repo.confirm(confirmInput())).basket;assert.equal(JSON.stringify(raw().fulfillment),pending);
 assert.equal(m.purposeFulfillmentBlocksConfirmation(undefined,b.fulfillment),true);assert.equal(m.purposeFulfillmentBlocksConfirmation('paper',b.fulfillment),true);assert.equal(m.purposeFulfillmentBlocksConfirmation('practice',b.fulfillment),false);pass('confirmed pending paper plan is historical in practice; paper and legacy still block');
 await writeFile(file,'changed');await assert.rejects(repo.confirm(confirmInput()),/source_changed/);await writeFile(file,source);pass('ignoring historical quotas does not relax source validation');
 // Real SQL compatibility fixtures exercise paper quota rollback and C2 score sync.
 const reset={...raw(),blueprint:defaultBlueprint,entries:before,purpose:'paper',paperRequirements:'provided'};delete reset.fulfillment;delete reset.fulfillmentReceipts;db.prepare('UPDATE paper_baskets SET data_json=? WHERE id=?').run(JSON.stringify(reset),b.id);b=await read();const rollback=db.prepare('SELECT data_json FROM paper_baskets WHERE id=?').get(b.id).data_json;await assert.rejects(repo.mutate(input({type:'setEntryPoints',entryId:middle,points:3})),/shortage/);assert.equal(db.prepare('SELECT data_json FROM paper_baskets WHERE id=?').get(b.id).data_json,rollback);pass('paper default quota mismatch still rejects score split and rolls back');
 const c2={entryPoints:Object.fromEntries(before.map(e=>[e.entryId,1])),retainedSections:[],unknownRetainedSections:[]};db.prepare('UPDATE paper_baskets SET schema_version=?,data_json=? WHERE id=?').run('xiaozhi.paper-basket.c2.v1',JSON.stringify({...reset,purpose:'practice',c2}),b.id);b=await read();await mutate({type:'setEntryPoints',entryId:middle,points:3});assert.equal(b.persistedSchemaVersion,'xiaozhi.paper-basket.c2.v1');assert.equal(b.c2.entryPoints[middle],3);assert.equal(b.complete,true);assert.deepEqual(raw().entries.map(({sectionId,position,...e})=>e),before.map(({sectionId,position,...e})=>e));pass('C2 practice score split synchronizes entryPoints, keeps reviews and schema, and has no permanent score conflict');
 await writeFile(path.join(out,'report.json'),JSON.stringify({status:'passed',checks:report,sqlite:path.join(out,'actual.sqlite'),scope:'real SQLite repository + OfficeDraft compiler; no Office generator or Electron acceptance'},null,2));console.log('REPORT '+path.join(out,'report.json'));
}catch(e){await writeFile(path.join(out,'report.json'),JSON.stringify({status:'failed',checks:report,error:String(e),stack:e.stack},null,2));console.error('REPORT '+path.join(out,'report.json'));throw e;}finally{db.close();}
