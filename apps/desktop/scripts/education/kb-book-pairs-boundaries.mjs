import '../office-agent/register-source.mjs';import {DatabaseSync} from 'node:sqlite';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const {MaterialBookPairs,migrateMaterialBookPairs,answerRuleCandidateHidden}=await import('../../src/main/assets/material-book-pairs.ts');
const {MaterialQuestionArchive}=await import('../../src/main/assets/material-question-archive.ts');
const {MaterialAiRepository}=await import('../../src/main/assets/material-ai-repository.ts');
const {migrateWordPageSources}=await import('../../src/main/assets/material-word-page-source.ts');
const {validMaterialBookPairInput,sameMaterialBookIdentity}=await import('../../src/shared/material-book-pair.ts');
const db=new DatabaseSync(':memory:'),ids=Array.from({length:4},()=>`resource_${randomUUID()}`),sha='a'.repeat(64),resources=new Map(ids.map((id,i)=>[id,{id,contentHash:sha,originalFileName:`${i}.pdf`}]));let books;let checks=0;
db.exec(`
 CREATE TABLE material_question_members(resource_id TEXT,question_id TEXT UNIQUE,needs_attention INTEGER DEFAULT 1);
 CREATE TABLE material_ai_batches(id TEXT PRIMARY KEY,resource_id TEXT,status TEXT,calls INTEGER DEFAULT 0);
 CREATE TABLE material_ai_units(batch_id TEXT,status TEXT,input_json TEXT,ordinal INTEGER DEFAULT 1,
  error TEXT DEFAULT '',first_json TEXT DEFAULT '',final_json TEXT DEFAULT '',image_sha TEXT DEFAULT '',
  owner_pid INTEGER DEFAULT 0,lease TEXT DEFAULT '',dispatched_at INTEGER DEFAULT 0,
  retry_at INTEGER DEFAULT 0,local_retries INTEGER DEFAULT 0);
 CREATE TABLE material_ai_page_units(batch_id TEXT,first_sha TEXT DEFAULT '',final_sha TEXT DEFAULT '',image_sha TEXT DEFAULT '');
 CREATE TABLE material_ai_task_keys(batch_id TEXT,folder_id TEXT,folder_revision INTEGER DEFAULT 1);
 CREATE TABLE material_folder_ai(batch_id TEXT,status TEXT);
 CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,archive_json TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT);
 CREATE TABLE question_notebook_bookmarks(question_id TEXT PRIMARY KEY,bookmarked INTEGER);
 CREATE TABLE question_notebook_category_links(question_id TEXT);
 CREATE TABLE question_bank_usage(question_id TEXT);
`);
const evidenceTables=['response_receipts','members','image_inputs','page_crops','page_verifications','bound_answers','book_references','native_inputs'];
for(const table of evidenceTables)db.exec('CREATE TABLE material_ai_'+table+'(batch_id TEXT)');
const addBatch=db.prepare('INSERT INTO material_ai_batches(id,resource_id,status) VALUES(?,?,?)');
const addUnit=db.prepare('INSERT INTO material_ai_units(batch_id,status,input_json,error) VALUES(?,?,?,?)');
for(const id of ids)db.prepare('INSERT INTO teacher_resources VALUES(?,?)').run(id,sha);
db.exec('CREATE INDEX idx_material_question_members_resource ON material_question_members(resource_id)');
const host={all:async(s,p=[])=>db.prepare(s).all(...p),run:async(s,p=[])=>{db.prepare(s).run(...p);},resource:async id=>{const r=resources.get(id);if(!r)throw Error('missing');return r;},writer:async fn=>{db.exec('BEGIN IMMEDIATE');try{const v=await fn(books);db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}};books=new MaterialBookPairs(host);
const input={schemaVersion:'xiaozhi.material-book-pair.v1',action:'link',resourceId:ids[0],version:sha,revision:0,answerId:ids[1],answerVersion:sha};
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
try{
 await books.migrate();await books.migrate();await migrateWordPageSources(host);
 await check('An installed one-to-one database upgrades in place, preserving original identity and revision',async()=>{
  const legacy=new DatabaseSync(':memory:');
  try{
   legacy.exec(`CREATE TABLE material_book_pairs(question_id TEXT PRIMARY KEY,question_version TEXT,answer_id TEXT,answer_version TEXT,revision INTEGER,active INTEGER);
     CREATE UNIQUE INDEX idx_material_book_answer ON material_book_pairs(answer_id) WHERE active=1;`);
   const insert=legacy.prepare('INSERT INTO material_book_pairs VALUES(?,?,?,?,?,1)');
   insert.run(ids[0],sha,ids[1],sha,7);
   const old=legacy.prepare('SELECT * FROM material_book_pairs').get();
   const oldHost={all:async s=>legacy.prepare(s).all(),run:async s=>legacy.exec(s)};
   await migrateMaterialBookPairs(oldHost);await migrateMaterialBookPairs(oldHost);
   assert.deepEqual(legacy.prepare('SELECT * FROM material_book_pairs').get(),old);
   insert.run(ids[2],sha,ids[1],sha,1);
   assert.equal(legacy.prepare('SELECT COUNT(*) n FROM material_book_pairs WHERE answer_id=?').get(ids[1]).n,2);
   assert.equal(legacy.prepare('SELECT revision FROM material_book_answer_roles WHERE answer_id=?').get(ids[1]).revision,7);
  }finally{legacy.close();}
 });
 await check('Strict input refuses same file, forged fields, accessors, absent versions and stale bounds',async()=>{assert(validMaterialBookPairInput(input));for(const bad of [{...input,answerId:ids[0]},{...input,extra:true},{...input,revision:-1},{...input,answerVersion:undefined},{...input,action:'unlink'}])assert(!validMaterialBookPairInput(bad));let called=false;assert(!validMaterialBookPairInput({...input,get revision(){called=true;return 0;}}));assert(!called);});
 await check('Two durable versioned roles, idempotent retry and restart readback',async()=>{const v=await books.change(input);assert.equal(v.role.kind,'questions');assert.equal(v.role.revision,1);assert.equal((await books.role(ids[1])).kind,'answers');assert.deepEqual(await books.change(input),v);const reopened=new MaterialBookPairs(host);assert.deepEqual(await reopened.view(ids[0]),v);});
 await check('Two papers share one answer file with independently managed links',async()=>{
  const source=await books.role(ids[1]),second={...input,resourceId:ids[2]};
  const pair=await books.change(second);
  assert.equal(pair.role.questionId,ids[2]);
  assert.equal((await books.view(ids[1])).linkedQuestionCount,2);
  assert.deepEqual(await books.role(ids[1]),source);
  assert.deepEqual(await books.change(second),pair);
  await assert.rejects(books.change({...input,resourceId:ids[1],answerId:ids[2]}),/conflict/);
  await assert.rejects(books.change({...input,answerVersion:'b'.repeat(64)}),/source_changed/);
  assert.equal((await books.role(ids[0])).answerId,ids[1]);
  await books.change({schemaVersion:input.schemaVersion,action:'unlink',resourceId:ids[2],version:sha,revision:1});
  assert.equal((await books.view(ids[1])).linkedQuestionCount,1);
  assert.deepEqual(await books.role(ids[1]),source);
 });
 await check('Unlink increments a persistent tombstone; a stale replay cannot clear a new pairing',async()=>{const unlink={schemaVersion:input.schemaVersion,action:'unlink',resourceId:ids[0],version:sha,revision:1};await books.change(unlink);assert.equal(await books.role(ids[1]),null);await assert.rejects(books.change(input),/conflict/);await books.change({...input,revision:2});await assert.rejects(books.change(unlink),/conflict/);assert.equal((await books.role(ids[0])).revision,3);});
 await check('Late role assignment preserves rule memberships; empty billable batches still block',async()=>{db.prepare('INSERT INTO material_question_members(resource_id,question_id) VALUES(?,?)').run(ids[3],'prior-rule');const before=db.prepare('SELECT * FROM material_question_members').all();await books.change({...input,resourceId:ids[2],answerId:ids[3],revision:2});assert.deepEqual(db.prepare('SELECT * FROM material_question_members').all(),before);await books.change({schemaVersion:input.schemaVersion,action:'unlink',resourceId:ids[2],version:sha,revision:3});db.exec('DELETE FROM material_question_members');addBatch.run('empty',ids[3],'paused');await assert.rejects(books.change({...input,resourceId:ids[2],answerId:ids[3],revision:4}),/answer_already_processed/);assert.equal(await books.role(ids[2]),null);});

 await check('Only fully saved answer-role units of the identical pair can restore a removed association',async()=>{
  db.exec('DELETE FROM material_ai_batches');const role={kind:'answers',questionId:ids[0],questionVersion:sha,answerId:ids[1],answerVersion:sha,revision:3};
  addBatch.run('saved',ids[1],'attention');
  addUnit.run('saved','review',JSON.stringify({bookRole:role}),'');
  await books.change({schemaVersion:input.schemaVersion,action:'unlink',resourceId:ids[0],version:sha,revision:3});
  for(const status of ['pending','first_saved','dispatched','failed','outcome_unknown']){db.prepare('UPDATE material_ai_units SET status=?').run(status);await assert.rejects(books.change({...input,revision:4}),/answer_already_processed/);}
  db.prepare('UPDATE material_ai_units SET status=?').run('review');
  for(const raw of ['invalid','{}',JSON.stringify({bookRole:{...role,kind:'questions'}}),JSON.stringify({bookRole:{...role,questionId:ids[2]}}),JSON.stringify({bookRole:{...role,answerVersion:'b'.repeat(64)}})]){db.prepare('UPDATE material_ai_units SET input_json=?').run(raw);await assert.rejects(books.change({...input,revision:4}),/answer_already_processed/);}
  db.prepare('UPDATE material_ai_units SET input_json=?').run(JSON.stringify({bookRole:role}));const restored=await books.change({...input,revision:4});assert.equal(restored.role.revision,5);assert(sameMaterialBookIdentity(role,{...role,revision:5}));
 });
 const retryPair={...input,resourceId:ids[2],answerId:ids[3],revision:4};
 addBatch.run('private',ids[3],'attention');
 addUnit.run('private','failed','{}','privacy_blocked');
 db.exec(`INSERT INTO material_ai_page_units(batch_id) VALUES('private');
  INSERT INTO material_ai_task_keys(batch_id,folder_id) VALUES('private','retained-folder');
  INSERT INTO material_folder_ai VALUES('retained-folder','paused')`);
 const frozen=()=>['material_ai_batches','material_ai_units','material_ai_page_units','material_ai_task_keys','material_folder_ai']
  .map(table=>db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all());
 await check('One dispatch marker, unknown ownership, folder work or stored output can block a whole historic batch',async()=>{
  const reject=()=>assert.rejects(books.change(retryPair),/answer_already_processed/);
  for(const [table,column,changed,original]of [
   ['material_ai_batches','calls',1,0],['material_ai_batches','status','running','attention'],
   ['material_ai_units','status','pending','failed'],['material_ai_units','status','outcome_unknown','failed'],
   ['material_ai_units','error','timeout','privacy_blocked'],['material_ai_units','dispatched_at',1,0],
   ['material_ai_units','owner_pid',100,0],['material_ai_units','lease','retained',''],
   ['material_ai_units','first_json','{}',''],['material_ai_units','final_json','{}',''],['material_ai_units','image_sha','not-empty',''],
   ['material_ai_units','input_json','{','{}'],['material_ai_units','input_json','{"bookRole":null}','{}'],
   ['material_ai_page_units','first_sha','recorded',''],
  ]){
   const key=table==='material_ai_batches'?'id':'batch_id';
   const update=db.prepare(`UPDATE ${table} SET ${column}=? WHERE ${key}='private'`);
   update.run(changed);await reject();update.run(original);
  }
  for(const table of evidenceTables){
   db.exec(`INSERT INTO material_ai_${table} VALUES('private')`);await reject();
   db.exec(`DELETE FROM material_ai_${table} WHERE batch_id='private'`);
  }
  db.exec("UPDATE material_folder_ai SET status='running'");await reject();
  db.exec("UPDATE material_folder_ai SET status='paused'");
  addUnit.run('private','failed','{}','privacy_blocked');
  db.exec("UPDATE material_ai_units SET ordinal=2,dispatched_at=1 WHERE rowid=last_insert_rowid()");
  await reject();
  db.exec("DELETE FROM material_ai_units WHERE batch_id='private' AND ordinal=2");
  addBatch.run('second',ids[3],'paused');await reject();
  db.exec("DELETE FROM material_ai_batches WHERE id='second'");
  assert.equal(await books.role(ids[3]),null);
 });
 await check('A settled zero-send privacy refusal links without changing any original task, and its input is still refused at dispatch',async()=>{
  const prior=frozen(),assoc=await books.change(retryPair);
  assert.equal(assoc.role.kind,'questions');
  assert.equal((await books.role(ids[3])).kind,'answers');
  assert.deepEqual(await books.change(retryPair),assoc);
  assert.deepEqual(frozen(),prior);

  // Force a stale retry in the fixture to exercise the production writer guard
  // even if another caller changes scheduling state after the book is linked.
  db.exec("UPDATE material_ai_batches SET status='running' WHERE id='private'; UPDATE material_ai_units SET status='pending' WHERE batch_id='private'");
  const repo=Object.create(MaterialAiRepository.prototype);
  repo.host=host;
  repo.books=books;
  repo.configuration=async()=>({revision:1});
  repo.write=async action=>host.writer(()=>action(repo));
  repo.validateOriginalInput=async()=>{throw Error('old role reached input checks');};
  await assert.rejects(repo.dispatch('private',1,{resourceId:ids[3],settingsRevision:1,maxCalls:2},{},'pending',new AbortController().signal),/source_changed/);
  const [{calls}]=await host.all("SELECT calls FROM material_ai_batches WHERE id='private'");
  assert.equal(calls,0);
  assert.equal((await host.all("SELECT COUNT(*) n FROM material_ai_response_receipts WHERE batch_id='private'"))[0].n,0);
  db.exec("UPDATE material_ai_batches SET status='attention' WHERE id='private'; UPDATE material_ai_units SET status='failed' WHERE batch_id='private'");
  assert.deepEqual(frozen(),prior);
 });
 await check('Archived role identity rejects forged shapes and accessors without executing them',async()=>{const role=await books.role(ids[1]);for(const bad of [{...role,extra:true},{...role,revision:0},{...role,kind:'questions'},{...role,answerId:ids[2]}])assert(!sameMaterialBookIdentity(role,bad));let called=false;assert(!sameMaterialBookIdentity(role,{...role,get revision(){called=true;return 5;}}));assert(!called);});
 const base={schemaVersion:'xiaozhi.question-archive.v1',extractor:'numbered-text.v1',state:'rule_extracted',sourceChecked:false,sources:[{resourceId:ids[1],version:sha}]};
 const add=(id,archive=base,changed=false)=>{db.prepare('INSERT INTO question_bank_items VALUES(?,?,?,?)').run(id,typeof archive==='string'?archive:JSON.stringify(archive),'created',changed?'edited':'created');db.prepare('INSERT INTO material_question_members(resource_id,question_id) VALUES(?,?)').run(ids[1],id);};
 const hidden=()=>db.prepare(`SELECT q.id FROM question_bank_items q WHERE COALESCE(${answerRuleCandidateHidden},0) ORDER BY q.id`).all().map(r=>r.id);
 await check('Current answer roles hide only untouched rule candidates without changing a byte',async()=>{add('untouched');const before=db.prepare('SELECT * FROM question_bank_items').all();assert.deepEqual(hidden(),['untouched']);assert.deepEqual(db.prepare('SELECT * FROM question_bank_items').all(),before);assert.equal(db.prepare('SELECT needs_attention FROM material_question_members WHERE question_id=?').get('untouched').needs_attention,1);});
 await check('Teacher edits, confirmation, bookmarks, categories and usage all protect visibility',async()=>{add('edited',base,true);add('state',{...base,state:'teacher_edited'});add('checked',{...base,sourceChecked:true});add('bookmark');add('category');add('usage');db.prepare('INSERT INTO question_notebook_bookmarks VALUES(?,1)').run('bookmark');db.prepare('INSERT INTO question_notebook_category_links VALUES(?)').run('category');db.prepare('INSERT INTO question_bank_usage VALUES(?)').run('usage');assert.deepEqual(hidden(),['untouched']);});
 await check('Malformed, unknown, empty, scalar and mixed/stale source archives remain visible',async()=>{for(const [id,value]of [['invalid','invalid'],['null','null'],['unknown',{...base,schemaVersion:'unknown'}],['empty',{...base,sources:[]}],['scalar',{...base,sources:['bad',null,1]}],['mixed',{...base,sources:[...base.sources,{resourceId:ids[2],version:sha}]}],['stale',{...base,sources:[{resourceId:ids[1],version:'b'.repeat(64)}]}]])add(id,value);assert.deepEqual(hidden(),['untouched']);});
 await check('Stale question or answer originals restore visibility immediately',async()=>{for(const id of [ids[0],ids[1]]){db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run('b'.repeat(64),id);assert.deepEqual(hidden(),[]);db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run(sha,id);}assert.deepEqual(hidden(),['untouched']);});
 await check('Unlink, fresh instance and relink restore the same IDs and content without extraction',async()=>{const before=db.prepare('SELECT * FROM question_bank_items ORDER BY id').all();await books.change({schemaVersion:input.schemaVersion,action:'unlink',resourceId:ids[0],version:sha,revision:5});assert.deepEqual(hidden(),[]);const reopened=new MaterialBookPairs(host);assert.equal((await reopened.view(ids[0])).role,null);await books.change({...input,revision:6});assert.deepEqual(hidden(),['untouched']);assert.deepEqual(db.prepare('SELECT * FROM question_bank_items ORDER BY id').all(),before);});
 await check('Candidate ID set uses indexed answer membership and never scans all question archives',async()=>{const plan=db.prepare(`EXPLAIN QUERY PLAN SELECT q.id FROM question_bank_items q WHERE NOT COALESCE(${answerRuleCandidateHidden},0)`).all().map(r=>r.detail).join('\n');assert.match(plan,/SEARCH m USING INDEX idx_material_question_members_resource/);assert.match(plan,/SEARCH aq USING INDEX/);assert(!/SCAN aq/.test(plan));assert.match(plan,/LIST SUBQUERY/);});
 db.exec("CREATE TABLE material_question_jobs(resource_id TEXT PRIMARY KEY,version TEXT,status TEXT,cursor INTEGER,parse_token TEXT,question_count INTEGER,error TEXT,updated_at TEXT)");
 let archive,currentRole=null,flip=false,changedBody=false,reads=0;
 const job=()=>db.prepare('SELECT * FROM material_question_jobs').get();
 const reset=()=>{db.exec('DELETE FROM material_question_jobs');db.prepare('INSERT INTO material_question_jobs VALUES(?,?,?,0,?,0,?,?)').run(ids[1],sha,'pending','','','created');reads=0;};
 const archiveHost={...host,materials:()=>({resource:host.resource,originalStamp:async()=> 'stamp',verify:async()=>{},readingWindow:async()=>({units:[],hasMore:false,fingerprint:changedBody&&++reads>1?'changed':'same'})}),create:async()=>{throw Error('Unexpected publication');},read:async()=>undefined,withWriter:async fn=>{if(flip){flip=false;currentRole=await books.role(ids[1]);}db.exec('BEGIN IMMEDIATE');try{const r=await fn(archive);db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
 archive=new MaterialQuestionArchive(archiveHost);archive.configureBooks(async()=>currentRole);
 await check('Link during a local extraction window leaves the cursor pending and rereads its role without a false source failure',async()=>{reset();const existing=db.prepare('SELECT COUNT(*) n FROM material_question_members WHERE resource_id=?').get(ids[1]).n;flip=true;await archive.drain();assert.equal(job().status,'pending');assert.equal(job().cursor,0);assert.equal(job().error,'');await archive.drain();assert.equal(job().status,'complete');assert.equal(job().question_count,existing);});
 await check('A changed source window still fails closed after the role-race repair',async()=>{reset();currentRole=null;changedBody=true;await archive.drain();assert.equal(job().status,'failed');assert.equal(job().error,'source_changed');assert.equal(job().cursor,0);});
 console.log(JSON.stringify({success:true,checks}));
}finally{db.close();}
