import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';

const {MaterialQuestionArchive}=await import('../../src/main/assets/material-question-archive.ts');
const {materialSource}=await import('../../src/main/assets/material-source.ts');
const {QUESTION_STRUCTURE_ARCHIVE_SCHEMA}=await import('../../src/shared/question-archive.ts');
const {DOCUMENT_STRUCTURE_SCHEMA}=await import('../../src/shared/material-document-structure.ts');
const db=new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);
  CREATE TABLE material_question_members(extraction_key TEXT PRIMARY KEY,resource_id TEXT,question_id TEXT UNIQUE);
  CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,question_type TEXT,archive_json TEXT,created_at TEXT,updated_at TEXT);
  CREATE TABLE material_structure_jobs(resource_id TEXT PRIMARY KEY,version TEXT,generation TEXT,status TEXT);
  CREATE TABLE material_structure_hidden_questions(question_id TEXT);
  CREATE TABLE material_structure_reviews(question_id TEXT);
  CREATE TABLE question_notebook_bookmarks(question_id TEXT,bookmarked INTEGER);
  CREATE TABLE question_notebook_category_links(question_id TEXT);
  CREATE TABLE question_bank_usage(question_id TEXT);
`);
const all=async (sql,params=[])=>db.prepare(sql).all(...params);
const run=async (sql,params=[])=>{db.prepare(sql).run(...params)};
const timestamp='2026-01-01T00:00:00.000Z';
const units=new Map(),unreadable=new Set(),changed=new Set(),live=new Map();
const archive=new MaterialQuestionArchive({
  all,run,
  read:async id=>{
    const [row]=await all('SELECT * FROM question_bank_items WHERE id=?',[id]);
    return {...live.get(id),archive:JSON.parse(row.archive_json),questionType:row.question_type,
      createdAt:row.created_at,updatedAt:row.updated_at};
  },
  withWriter:async action=>action(archive),
  materials:()=>({
    originalStamp:async id=>changed.has(id)?'changed':'stamp',
    verifyOriginalVersion:async id=>{
      if(unreadable.has(id))throw Object.assign(Error('access denied'),{code:'EACCES'});
      if(live.get('edited-after-verify')?.archive.structure.resourceId===id){
        await run('UPDATE question_bank_items SET question_type=?,updated_at=? WHERE id=?',
          ['教师指定','2026-01-02T00:00:00.000Z','edited-after-verify']);
      }
      if(live.get('source-write-race')?.archive.structure.resourceId===id)changed.add(id);
    },
    resource:async id=>({id}),
    publishedPageSources:async resource=>[units.get(resource.id)],
  }),
});
archive.configureStructures(()=>({authenticate:async()=>({question:{
  kind:'question',status:'candidate',number:'7',stem:'已知条件，求结果。',
  section:'二、填空题',options:[],subquestions:[],pageRange:[1,1],
}})}));
archive.configureBooks(async id=>live.get('answers-only')?.archive.structure.resourceId===id?{kind:'answers'}:null);
async function seed(id,{type='',status='complete',hidden=false,sourceChecked=false,legacy='选择题'}={}){
  const resourceId='resource_'+randomUUID(),version='a'.repeat(64),generation=randomUUID();
  const structure={schemaVersion:DOCUMENT_STRUCTURE_SCHEMA,resourceId,version,generation,
    candidateId:'sq_'+'d'.repeat(40),sha256:'e'.repeat(64)};
  const unit={resourceId,version,offset:0,chunk:{id:'chunk_'+randomUUID(),chunkIndex:0,
    contentMd:'原卷试题和印刷标题',questionType:legacy,containsPersonalData:false,pageNumber:1}};
  units.set(resourceId,unit);
  const receipt={schemaVersion:QUESTION_STRUCTURE_ARCHIVE_SCHEMA,extractor:'layout-question.v1',
    state:sourceChecked?'teacher_edited':'rule_extracted',number:'7',sources:[materialSource(unit)],issues:['missing_type','missing_answer'],
    sourceRisks:[],sourceChecked,answerOrigin:'missing',analysisOrigin:'missing',structure};
  live.set(id,{id,archive:receipt,stem:'已知条件，求结果。',analysis:'',answer:'',grade:'',subject:'',
    knowledgePoint:'',difficulty:'medium',sourceKind:'teacher_resource',sourceTitle:'试卷',tags:[]});
  await run('INSERT INTO question_bank_items VALUES(?,?,?,?,?)',[id,type,JSON.stringify(receipt),timestamp,timestamp]);
  await run('INSERT INTO material_question_members VALUES(?,?,?)',[
    'structure:'+String(live.size).padStart(2,'0'),resourceId,id]);
  await run('INSERT INTO material_structure_jobs VALUES(?,?,?,?)',[resourceId,version,generation,status]);
  if(hidden)await run('INSERT INTO material_structure_hidden_questions VALUES(?)',[id]);
  return resourceId;
}
unreadable.add(await seed('denied-file'));
await seed('clear-next');
await seed('legacy-fallback',{type:'选择题'});
await seed('unexplained-type',{type:'简答题'});
await seed('bookmarked');
await run('INSERT INTO question_notebook_bookmarks VALUES(?,1)',['bookmarked']);
await seed('review-receipt');
await run('INSERT INTO material_structure_reviews VALUES(?)',['review-receipt']);
await seed('edited-after-verify');
await seed('source-write-race');
await seed('answers-only');
await seed('superseded',{hidden:true});
await seed('pending',{status:'pending'});
await seed('checked',{sourceChecked:true});

await archive.reconcilePrintedTypes();
const state=()=>all('SELECT * FROM question_bank_items ORDER BY id');
const first=await state();
for(const row of first){
  const updated=['clear-next','legacy-fallback'].includes(row.id);
  const type=updated?'填空题':{ 'edited-after-verify':'教师指定','unexplained-type':'简答题' }[row.id]??'';
  assert.equal(row.question_type,type,row.id);
  const original=live.get(row.id).archive;
  assert.deepEqual(JSON.parse(row.archive_json),
    updated?{...original,issues:['missing_answer']}:original,row.id);
}
await archive.reconcilePrintedTypes();
assert.deepEqual(await state(),first);
db.close();
console.log(JSON.stringify({ok:true,cases:first.length,corrected:2,idempotent:true}));
