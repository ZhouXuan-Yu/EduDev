import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..'), main=testMain(desktop);
const fixture=fs.realpathSync(process.argv[2]);
const sourceReport=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
const frozenIndex=process.argv.indexOf('--frozen-replay');
const frozenBytes=frozenIndex>=0?fs.readFileSync(process.argv[frozenIndex+1]):undefined;
const frozenHash=frozenBytes&&createHash('sha256').update(frozenBytes).digest('hex');
const frozen=frozenBytes&&JSON.parse(frozenBytes).cases.find(row=>row.id==='R3-FX-027');
if(frozenBytes){
  assert.equal(frozenHash,'53000255841392a5d3ef6cae264623d89e2326cfab6ac6fb114a19c28b4ade20');
  assert.equal(frozen?.sourceStateHint,'duplicate');
  assert.equal(frozen?.expectedBehavior,'deduplicate');
  assert.match(frozen.teacherRequest,/十次/u);
}
assert(sourceReport.ok&&sourceReport.checks.some(check=>check.name?.includes('Persisted reply')));
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'session-memory-event-'));
const data=path.join(root,'data'),profile=path.join(root,'profile');
fs.cpSync(path.join(fixture,'data'),data,{recursive:true,errorOnExist:true,force:false});
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1'};
for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','DEEPSEEK_API_KEY','ELECTRON_RENDERER_URL'])delete env[key];
const report={root,build:createHash('sha256').update(fs.readFileSync(main)).digest('hex'),checks:[],ok:false};
if(frozen){
  assert.equal(report.build,process.env.OMNI_EDU_R3_EVAL_BUILD_SHA256);
  assert.match(process.env.OMNI_EDU_R3_EVAL_PRODUCT_SHA??'',/^[a-f0-9]{40}$/);
  report.source=process.env.OMNI_EDU_R3_EVAL_PRODUCT_SHA;
  report.fixture={id:frozen.id,sha256:frozenHash,condition:frozen.teacherRequest};
}
function read(q,...args){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...args);}finally{db.close();}}
let app;
try{
  app=await _electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env});
  await assertIsolatedPiMain(app,main,profile);
  const chat=await app.firstWindow();
  const runId=sourceReport.checks.find(check=>check.name.includes('Persisted reply')).runId;
  const sessionId=read('SELECT session_id FROM ai_agent_runs WHERE id=?',runId)[0].session_id;
  await chat.getByTestId('xiaozhi-pi-workspace').waitFor();
  if(await chat.locator('.office-composer-container').getAttribute('data-session-id')!==sessionId)
    await chat.getByTestId('workbench-session-'+sessionId).click();
  const next=app.waitForEvent('window');
  await chat.getByTestId('nav-settings').click();const settings=await next;
  await settings.getByTestId('pi-settings-tab-teacher-memory').click();
  await settings.getByText('可修订的记忆条目',{exact:true}).click();
  await settings.getByTestId('memory-draft-l2').click({timeout:10000});
  const first=settings.getByTestId('memory-adopt-l2-0');await first.waitFor();
  const draft=await settings.evaluate(id=>window.omniEdu.previewSessionMemoryEvents(id),sessionId);
  assert.equal(draft.sourceRunId,runId);assert(draft.entries.length);
  assert.equal(draft.category,'work_experience');assert.equal(draft.evidence,'system_verified');
  const {text,refs}=draft.entries[0],eventId=refs[0].id;
  assert.equal(read('SELECT run_id FROM ai_agent_events WHERE id=?',eventId)[0].run_id,runId);
  const request={sessionId,runId,eventId,expectedText:text};
  const originalScope=read('SELECT version,payload_json FROM xiaozhi_pi_memory_scopes WHERE conversation_id=?',sessionId);
  const priorCount=read('SELECT count(*) n FROM ai_memory_entries')[0].n;
  const foreign=read('SELECT id FROM ai_conversation_sessions WHERE id<>? LIMIT 1',sessionId)[0].id;
  for(const changed of [{sessionId:foreign},{runId:'run_00000000-0000-4000-8000-000000000000'},{expectedText:text+' changed'}]){
    const denied=await settings.evaluate(async input=>{try{await window.omniEdu.adoptSessionMemoryEvent(input);return false;}catch{return true;}},{...request,...changed});
    assert(denied);
  }
  assert.equal(read('SELECT count(*) n FROM ai_memory_entries')[0].n,priorCount);
  report.checks.push('Review is bound to the current conversation, actual Run, event and displayed content');
  await first.click();
  await settings.getByText('已保存到工作记录。',{exact:true}).waitFor();
  const owned=read("SELECT id FROM ai_memory_entries WHERE json_extract(refs_json,'$[0].id')=?",eventId);
  assert.equal(owned.length,1);
  const afterFirst=read('SELECT count(*) n FROM ai_memory_entries')[0].n;
  assert.equal(afterFirst,priorCount+1);
  const replayCount=frozen?10:1;
  const ids=[];
  for(let repeat=0;repeat<replayCount;repeat++){
    const again=await settings.evaluate(input=>window.omniEdu.adoptSessionMemoryEvent(input),request);
    ids.push(again.id);
    assert.equal(read('SELECT count(*) n FROM ai_memory_entries')[0].n,afterFirst);
  }
  assert.deepEqual([...new Set(ids)],[owned[0].id]);
  const [entry]=read('SELECT id,text,refs_json,version FROM ai_memory_entries WHERE id=?',ids[0]);
  assert.equal(entry.text,text);assert.equal(entry.version,1);
  assert.equal(JSON.parse(entry.refs_json)[0].id,eventId);
  assert.equal(read('SELECT count(*) n FROM ai_memory_entries')[0].n,priorCount+1);
  assert.deepEqual(read('SELECT version,payload_json FROM xiaozhi_pi_memory_scopes WHERE conversation_id=?',sessionId),originalScope);
  report.checks.push('Teacher confirmation writes one versioned L2 event record on retry and leaves model grants unchanged');
  if(frozen)report.replay={attempts:replayCount,sourceEventId:eventId,memoryId:entry.id,version:entry.version,newEntries:afterFirst-priorCount,unchangedGrants:true};
  report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}
finally{await app?.close();fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
