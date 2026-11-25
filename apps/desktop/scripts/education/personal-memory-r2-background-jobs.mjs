import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
const { createPersonalMemoryJobs }=await import('../../src/main/education/personal-memory/background-jobs.ts');
const { createPersonalMemoryBackgroundConsumer }=await import('../../src/main/education/personal-memory/background-consumer.ts');
const { createPersonalMemoryCandidateState,personalMemoryCandidateSchema }=await import('../../src/main/education/personal-memory/candidate-state.ts');
const { createPersonalMemorySourceAuthority,personalMemoryExtractSchema }=await import('../../src/main/education/personal-memory/source-authority.ts');
const { historyMemorySchema }=await import('../../src/main/xiaozhi-agent/history/schema.ts');
const { historyId }=await import('../../src/main/xiaozhi-agent/history/state.ts');
const { teacherRequestSourceVersion }=await import('../../src/main/xiaozhi-agent/request-sources.ts');
const {createPersonalMemoryRecordState,personalMemoryRecordSchema}=await import('../../src/main/education/personal-memory/record-state.ts');
const {createPersonalMemoryOrganization}=await import('../../src/main/education/personal-memory/organization.ts');
const {preparePersonalMemoryExtraction,bindPersonalMemoryProposals}=await import('../../src/main/education/personal-memory/candidate-admission.ts');

function database(){
  const db=new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE ai_tasks(id TEXT PRIMARY KEY,task_type TEXT NOT NULL,status TEXT NOT NULL,input_hash TEXT,
      payload_json TEXT NOT NULL,result_json TEXT,error_message TEXT,retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,title TEXT,student_id TEXT,archived_at TEXT);
    CREATE TABLE ai_conversation_messages(id TEXT PRIMARY KEY,session_id TEXT,role TEXT,content TEXT,metadata_json TEXT,created_at TEXT);`);
  db.exec(historyMemorySchema);
  db.exec(personalMemoryCandidateSchema);
  db.exec(personalMemoryExtractSchema);
  db.exec(personalMemoryRecordSchema);
  db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
  const sql={
    all:async(q,v=[])=>db.prepare(q).all(...v),
    run:async(q,v=[])=>db.prepare(q).run(...v),
    change:async(q,v=[])=>Number(db.prepare(q).run(...v).changes),
    transaction:async fn=>{
      db.exec('BEGIN IMMEDIATE');
      try{const value=await fn(sql);db.exec('COMMIT');return value;}
      catch(error){db.exec('ROLLBACK');throw error;}
    },
  };
  const state=createPersonalMemoryCandidateState(sql,async()=>true);
  const row=id=>db.prepare('SELECT * FROM ai_tasks WHERE id=?').get(id);
  return {db,sql,state,row};
}
const digest=text=>createHash('sha256').update(text).digest('hex');
const pin=n=>({id:digest('source-'+n),version:digest('version-'+n),revision:1});
const begin=Date.parse('2026-11-25T02:00:00Z');
{
  const {db,sql,state,row}=database();
  const authority=createPersonalMemorySourceAuthority(sql,async text=>text);
  const sessionId='aisession_'+randomUUID(),runId='run_'+randomUUID();
  db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,NULL,NULL)').run(sessionId,'合成课程');
  const binding={scope:{kind:'course',id:'science'},term:'unknown'};
  const refs=[];
  for (const grade of ['三','四','五']) {
    const recordId=randomUUID(),value=`我这学期教${grade}年级科学。`;
    db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?,?)')
      .run(recordId,sessionId,'user',value,JSON.stringify({piVersion:'xiaozhi.pi.education.v1',agentRunId:runId}),'2026-11-25');
    refs.push({kind:'history_request',sessionId,recordId,sourceVersion:teacherRequestSourceVersion(recordId,runId,value)});
  }
  for (const ref of refs.slice(0,2)) await authority.change(ref,0,binding);
  let tick=db.prepare('SELECT MAX(updated_at) AS updated FROM personal_memory_extract_grants').get().updated;
  const jobs=createPersonalMemoryJobs(sql,()=>tick);
  assert.equal(await jobs.planExtraction(),null);
  const enabled=await state.setEnabled(true,0);
  assert.equal(await jobs.planExtraction(),null);
  tick+=60000;
  const planned=await jobs.planExtraction();
  assert.equal(planned.created,true);
  assert.equal(await jobs.planExtraction(),null);
  assert.deepEqual(JSON.parse(row(planned.id).payload_json).sources.map(source=>source.id).sort(),
    refs.slice(0,2).map(historyId).sort());
  const lease=await jobs.claim();
  assert.equal(await sql.transaction(tx=>jobs.deferBeforeDispatch(tx,lease)),true);
  assert.equal(row(planned.id).status,'pending');
  assert.equal(await jobs.claim(),null);
  tick+=60000;
  const stopped=await state.setEnabled(false,enabled.policyRevision);
  assert.equal(await jobs.planExtraction(),null);
  await state.setEnabled(true,stopped.policyRevision);
  assert.equal(await jobs.claim(),null);
  assert.equal(row(planned.id).status,'cancelled');
  assert.deepEqual(await jobs.planExtraction(),{id:planned.id,created:false});
  assert.equal((await jobs.claim()).id,planned.id);
  console.log('PASS stable grants coalesce in one durable job, skip ungranted sources and safely resume before dispatch');
  db.close();
}
{
  const {db,sql,state,row}=database();
  const authority=await state.setEnabled(true,0);
  let tick=begin;
  const jobs=createPersonalMemoryJobs(sql,()=>tick);
  const request={kind:'extract',sources:[pin(1),pin(2)],authority,notBefore:tick+60000};
  const enqueued=await jobs.enqueue(request);
  assert.deepEqual(await jobs.enqueue({...request,sources:[pin(2),pin(1)]}),{id:enqueued.id,created:false});
  assert.equal(await jobs.claim(),null);
  tick+=60000;
  const claimed=await jobs.claim();
  assert.equal(claimed.id,enqueued.id);
  assert.equal(await jobs.claim(),null);
  tick+=241000;
  await jobs.recoverExpired();
  assert.equal(row(enqueued.id).status,'pending');
  const afterReclaim=await jobs.claim();
  assert.notEqual(afterReclaim.payload,claimed.payload);
  assert.equal(await jobs.isCurrent(sql,claimed),false);
  const dispatched=await jobs.reserve(afterReclaim);
  tick+=241000;
  await jobs.recoverExpired();
  assert.equal(row(enqueued.id).status,'failed');
  assert.equal(row(enqueued.id).error_message,'provider_effect_unknown');
  assert.equal(JSON.parse(row(enqueued.id).payload_json).dispatch.reserved,2);
  assert.equal(await jobs.claim(),null);
  assert.equal((await jobs.enqueue(request)).created,false);
  assert.equal(await jobs.isCurrent(sql,dispatched),false);
  console.log('PASS existing ai_tasks deduplicates input, honors the due time and fences restart before or after dispatch');
  db.close();
}
{
  const {db,sql,state,row}=database();
  const authority=await state.setEnabled(true,0);
  let tick=begin;
  const jobs=createPersonalMemoryJobs(sql,()=>tick);
  for(let i=0;i<15;i++){
    await jobs.enqueue({kind:'extract',sources:[pin(i)],authority,notBefore:0});
    const leased=await jobs.reserve(await jobs.claim());
    await sql.transaction(tx=>jobs.finish(tx,leased,{status:'succeeded',modelCalls:2,usage:[]}));
  }
  const pending=await jobs.enqueue({kind:'extract',sources:[pin(16)],authority,notBefore:0});
  const held=await jobs.claim();
  await assert.rejects(jobs.reserve(held),/budget_exhausted/);
  await sql.transaction(tx=>jobs.deferBudget(tx,held));
  assert.equal(row(pending.id).status,'pending');
  assert.equal(await jobs.claim(),null);
  tick+=24*60*60*1000;
  const next=await jobs.reserve(await jobs.claim());
  assert.equal(next.id,pending.id);
  await sql.transaction(tx=>jobs.finish(tx,next,{status:'succeeded',modelCalls:1}));
  console.log('PASS persisted dispatch receipts enforce 30 actual calls per day and resume an unsent job the next day');

  await jobs.enqueue({kind:'organize',sources:[pin(17)],targets:[{id:'record-1',revision:1}],authority,notBefore:0});
  const organized=await jobs.reserve(await jobs.claim());
  await sql.transaction(tx=>jobs.finish(tx,organized,{status:'succeeded',modelCalls:1}));
  await jobs.enqueue({kind:'organize',sources:[pin(18)],targets:[{id:'record-1',revision:2}],authority,notBefore:0});
  tick+=1799999;
  assert.equal(await jobs.claim(),null);
  tick++;
  assert.equal((await jobs.claim()).job.kind,'organize');
  console.log('PASS organizing obeys the 30-minute cooldown for new evidence');
  db.close();
}
{
  const {db,sql,row}=database();
  const sourceAuthority=createPersonalMemorySourceAuthority(sql,async text=>text);
  const sourceSession='aisession_'+randomUUID();
  const runId='run_'+randomUUID();
  db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,NULL,NULL)').run(sourceSession,'合成课程');
  function seed(id,value){
    db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?,?)')
      .run(id,sourceSession,'user',value,JSON.stringify({piVersion:'xiaozhi.pi.education.v1',agentRunId:runId}),'2026-11-25');
    return {kind:'history_request',sessionId:sourceSession,recordId:id,sourceVersion:teacherRequestSourceVersion(id,runId,value)};
  }
  const options={sources:sourceAuthority,targets:async()=>[],provider:{pythonExecutable:'',repoRoot:'',providerKey:''}};
  let workerCalls=0, stopDuringModel=false;
  const consumer=createPersonalMemoryBackgroundConsumer(sql,options,async(_settings,manifest)=>{
    workerCalls++;
    if(stopDuringModel)await consumer.state.setEnabled(false,(await consumer.state.processing()).policyRevision);
    const source=manifest.sources[0];
    return {status:'success',proposals:[{kind:'teaching_context',source_id:source.id,source_version:source.version,
      scope_id:source.scope.id,valid_term:source.term,supporting_quote:source.text,value:source.text,supersedes:null}],
      modelCalls:1,usage:[{prompt_tokens:100,completion_tokens:10}]};
  });
  const authority=await consumer.state.setEnabled(true,0);
  const binding={scope:{kind:'course',id:'science-4'},term:'unknown'};
  const ref=seed('first-source','我教四年级科学。');
  const grant=await sourceAuthority.change(ref,0,binding);
  const input={kind:'extract',sources:[{id:historyId(ref),version:ref.sourceVersion,revision:grant.revision}],authority,notBefore:0};
  const job=await consumer.jobs.enqueue(input);
  const active=new AbortController();
  const beforeCancelled=new AbortController();
  beforeCancelled.abort();
  assert.equal((await consumer.advance(beforeCancelled.signal)).state,'resource_wait');
  assert.equal(workerCalls,0);
  assert.equal((await consumer.advance(active.signal)).state,'processed');
  assert.equal(workerCalls,1);
  assert.equal(row(job.id).status,'succeeded');
  assert.equal(JSON.parse(row(job.id).result_json).saved,1);
  assert.equal((await consumer.state.list(20)).length,1);
  assert.equal((await consumer.advance(active.signal)).state,'idle');
  console.log('PASS background consumer commits candidates and the existing job receipt in one SQLite transaction');

  const late=seed('second-source','我教五年级科学。');
  const lateGrant=await sourceAuthority.change(late,0,binding);
  const lateJob=await consumer.jobs.enqueue({kind:'extract',sources:[{id:historyId(late),version:late.sourceVersion,revision:lateGrant.revision}],authority,notBefore:0});
  stopDuringModel=true;
  assert.equal((await consumer.advance(active.signal)).code,'cancelled');
  assert.equal(row(lateJob.id).status,'cancelled');
  assert.equal((await consumer.state.list(20)).length,1);
  console.log('PASS a worker that finishes after the teacher turns processing off cannot add a candidate');
  const beforeLegacy=await consumer.state.processing();
  const resumed=await consumer.state.setEnabled(true,beforeLegacy.policyRevision);
  const legacyKey='xiaozhi.teacher-preference.v1:personal-policy';
  function setLegacy(revision,use) {
    db.prepare('INSERT INTO app_settings VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json')
      .run(legacyKey,JSON.stringify({schemaVersion:1,revision,profile:{subject:'',grade:'',textbook:''},use}),new Date().toISOString());
  }
  const legacy=seed('legacy-setting-source','我教六年级科学。');
  const legacyGrant=await sourceAuthority.change(legacy,0,binding);
  const legacyInput={kind:'extract',sources:[{id:historyId(legacy),version:legacy.sourceVersion,revision:legacyGrant.revision}],
    authority:resumed,notBefore:0};
  const legacyJob=await consumer.jobs.enqueue(legacyInput);
  setLegacy(1,{length:'off'});
  assert.equal((await consumer.state.processing()).pausedByUsePolicy,true);
  assert.equal((await consumer.advance(active.signal)).state,'idle');
  assert.equal(workerCalls,2);
  setLegacy(2,{});
  assert.equal((await consumer.advance(active.signal)).state,'idle');
  assert.equal(row(legacyJob.id).error_message,'stale_policy');
  assert.equal((await consumer.state.processing()).teacherPolicyRevision,2);
  console.log('PASS existing off mode pauses automation and a new settings revision fences earlier claims');
  db.close();
}
{
  const {db,sql,row}=database();
  const sources=createPersonalMemorySourceAuthority(sql,async text=>text);
  const records=createPersonalMemoryRecordState(sql,sources);
  const jobs=createPersonalMemoryJobs(sql);
  const plan=createPersonalMemoryOrganization(sql,sources,records,jobs,async text=>text);
  const sessionId='aisession_'+randomUUID(),runId='run_'+randomUUID();
  db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,NULL,NULL)').run(sessionId,'合成教研交接');
  const live=process.argv.includes('--live-organize');
  const consumer=createPersonalMemoryBackgroundConsumer(sql,{
    sources,targets:plan.targets,targetsCurrent:plan.targetsCurrent,
    provider:{pythonExecutable:process.env.OMNI_EDU_R2_PYTHON??'',repoRoot:fileURLToPath(new URL('../../../../',import.meta.url)),
      providerKey:process.env.DEEPSEEK_API_KEY??''},
  },live?undefined:async(_options,manifest)=>{
    const [source]=manifest.sources,[target]=manifest.targets;
    return {status:'success',proposals:[{kind:'teaching_context',source_id:source.id,source_version:source.version,
      scope_id:source.scope.id,valid_term:source.term,supporting_quote:source.text,value:source.text,supersedes:target.id}],
      modelCalls:1,usage:[]};
  });
  const policy=await consumer.state.setEnabled(true,0);
  async function observe(value){
    const recordId=randomUUID();
    db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?,?)')
      .run(recordId,sessionId,'user',value,JSON.stringify({piVersion:'xiaozhi.pi.education.v1',agentRunId:runId}),'2026-11-25');
    const ref={kind:'history_request',recordId,sessionId,sourceVersion:teacherRequestSourceVersion(recordId,runId,value)};
    const grant=await sources.change(ref,0,{scope:{kind:'course',id:'science'},term:'本学期'});
    const liveSources=await sources.snapshot([grant.sourceId],policy);
    const manifest=preparePersonalMemoryExtraction(liveSources,policy);
    const proposal={kind:'teaching_context',source_id:grant.sourceId,source_version:grant.revision,
      scope_id:'science',valid_term:'本学期',supporting_quote:value,value,supersedes:null};
    const [draft]=bindPersonalMemoryProposals([proposal],manifest,liveSources,policy).candidates;
    await consumer.state.savePending([draft],policy);
    return draft;
  }
  const original=await observe('我本学期负责四年级科学。');
  const reviewed=await records.preview(original.key,1);
  const accepted=await records.accept({operationId:randomUUID(),key:original.key,revision:1,targetRevision:0,reviewedQuoteSha256:reviewed.quoteSha256});
  assert.equal(await plan.plan(policy),null);
  const changed=await observe('更正，本学期我负责五年级科学，原四年级已经交接。');
  const queued=await plan.plan(policy);
  assert(queued?.created);
  assert.equal(await plan.plan(policy),null);
  const outcome=await consumer.advance(new AbortController().signal);
  assert.equal(outcome.state,'processed',JSON.stringify(outcome));
  assert.equal(row(queued.id).status,'succeeded');
  const [suggestion]= (await consumer.state.list(10)).filter(item=>item.draft.replaces?.id===accepted.id);
  assert.equal(suggestion?.state,'pending');
  assert.equal(suggestion.draft.witness.sourceId,changed.witness.sourceId);
  assert.equal(suggestion.draft.replaces.revision,1);
  assert.equal((await records.read(accepted.id)).value,original.proposedValue);
  assert.equal((await records.read(accepted.id)).revision,1);
  assert.equal(await plan.plan(policy),null);
  console.log(JSON.stringify({organized:true,live,receipt:JSON.parse(row(queued.id).result_json),pendingRevision:suggestion.revision}));
  db.close();
}
if(process.argv.includes('--live')){
  const {db,sql,row}=database();
  const authority=createPersonalMemorySourceAuthority(sql,async text=>text);
  const consumer=createPersonalMemoryBackgroundConsumer(sql,{sources:authority,targets:async()=>[],
    provider:{pythonExecutable:process.env.OMNI_EDU_R2_PYTHON??'',repoRoot:fileURLToPath(new URL('../../../../',import.meta.url)),
      providerKey:process.env.DEEPSEEK_API_KEY??''}});
  const policy=await consumer.state.setEnabled(true,0);
  const sessionId='aisession_'+randomUUID(),runId='run_'+randomUUID();
  const recordId='teaching-fact',text='从下学期起我教高二物理。';
  db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,NULL,NULL)').run(sessionId,'合成教师课程声明');
  db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?,?)')
    .run(recordId,sessionId,'user',text,JSON.stringify({piVersion:'xiaozhi.pi.education.v1',agentRunId:runId}),'2026-11-25');
  const ref={kind:'history_request',recordId,sessionId,sourceVersion:teacherRequestSourceVersion(recordId,runId,text)};
  const grant=await authority.change(ref,0,{scope:{kind:'course',id:'physics'},term:'下学期'});
  const queued=await consumer.jobs.enqueue({kind:'extract',sources:[{id:historyId(ref),version:ref.sourceVersion,revision:grant.revision}],
    authority:policy,notBefore:0});
  const outcome=await consumer.advance(new AbortController().signal);
  const saved=row(queued.id);
  assert.equal(outcome.state,'processed',JSON.stringify(outcome));
  assert.equal(saved.status,'succeeded');
  const receipt=JSON.parse(saved.result_json);
  assert.equal(receipt.saved,1);
  assert(receipt.modelCalls>=1 && receipt.modelCalls<=2);
  const [draft]=await consumer.state.list(10);
  assert.equal(draft.state,'pending');
  assert.equal(draft.draft.witness.sourceVersion,ref.sourceVersion);
  console.log(JSON.stringify({live:true,provider:'deepseek-flash',receipt,scope:draft.draft.scope,term:draft.draft.term,committedState:draft.state}));
  db.close();
}
console.log(JSON.stringify({passed:8,live:process.argv.includes('--live'),liveOrganization:process.argv.includes('--live-organize')}));
