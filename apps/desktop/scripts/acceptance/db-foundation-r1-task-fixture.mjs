import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';

export const states=['active','review_required','paused','interrupted','completed','ended'];
export const prefix='xiaozhi.task.v1:';
const stamp='2026-01-01T00:00:00.000Z';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const sessionFor=index=>'aisession_00000000-0000-4000-8000-'+String(index).padStart(12,'0');

export function withSql(root,write,action) {
  const db=new DatabaseSync(join(root,'app.db'),{readOnly:!write,enableForeignKeyConstraints:true});
  try{db.exec('PRAGMA busy_timeout=3000');return action(db);}finally{db.close();}
}

export function saveTask(db,doc,latest=false) {
  const {id,updatedAt,revision,sessionId}=doc.view;
  const save=db.prepare(`INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`);
  save.run(prefix+id,JSON.stringify(doc),updatedAt);
  save.run(prefix+id+':revision:'+revision,JSON.stringify(doc),updatedAt);
  if(latest)save.run(prefix+'session:'+sessionId,JSON.stringify({schema:'xiaozhi.task.v1',taskId:id}),updatedAt);
}

export function addTask(db,index,sessions) {
  const sessionId=sessionFor(index%sessions), runId='airun_r1_'+index, messageId='aimsg_r1_'+index;
  const commandId='xicmd_r1_'+index, state=states[index%states.length];
  const updatedAt=new Date(Date.parse(stamp)+Math.floor(index/4)*1000).toISOString();
  const id='xitask_'+digest([sessionId,messageId]), owner={sessionId,runId,generation:1};
  const title='R1 合成教学会话 '+(index%sessions), content=('合成任务 '+index+' ').repeat(1+index%17);
  const version=digest([sessionId,messageId,'user',content,runId]);
  db.prepare('INSERT OR IGNORE INTO ai_conversation_sessions(id,title,created_at,updated_at) VALUES(?,?,?,?)')
    .run(sessionId,title,stamp,updatedAt);
  db.prepare("INSERT INTO ai_conversation_messages(id,session_id,role,content,metadata_json,created_at) VALUES(?,?,'user',?,?,?)")
    .run(messageId,sessionId,content,JSON.stringify({agentRunId:runId,piVersion:'xiaozhi.pi.education.v1'}),stamp);
  db.prepare("INSERT INTO ai_agent_runs(id,session_id,prompt,route,status,created_at,updated_at) VALUES(?,?,?,'office','succeeded',?,?)")
    .run(runId,sessionId,content,stamp,updatedAt);
  const doc={view:{schema:'xiaozhi.task.v1',id,sessionId,revision:1,requirementsVersion:1,planRevision:1,
    planReason:'R1 合成教学任务',state,origin:{messageId,commandId,runId},sources:[{messageId,runId,version}],
    criteria:[{id:'teacher_request',version:1,sourceId:messageId,sourceVersion:version,text:content.slice(0,240),kind:'human'}],
    steps:[{id:'teacher_check',text:'检查合成教学内容',dependsOn:[],criterionIds:['teacher_request'],reported:'pending'}],
    checks:[],binding:state==='active'?owner:null,lastRunId:runId,createdAt:stamp,updatedAt},
    retiredIds:[],lineage:[{runId,generation:1,commandId}],admissions:[]};
  saveTask(db,doc,true);
  if(index%23===0)addApproval(db,doc);
  if(index%37===0)addEffect(db,doc);
  return doc;
}

export function addApproval(db,doc) {
  const {updatedAt,sessionId,lastRunId}=doc.view;
  const id='r1_approval_'+lastRunId, payload={schemaVersion:1,callId:'r1_copy_'+lastRunId,source:'source.txt',
    target:'r1-test.txt',sourceSha256:digest('source'),workspaceHash:digest('synthetic workspace'),state:'pending'};
  db.prepare(`INSERT INTO ai_confirmation_items(id,run_id,session_id,action_type,status,title,payload_json,created_at,updated_at)
    VALUES(?,?,?,'pi_office_copy','pending','R1 synthetic approval',?,?,?)`).run(id,lastRunId,sessionId,JSON.stringify(payload),updatedAt,updatedAt);
  return id;
}

export function addEffect(db,doc) {
  const {id:taskId,sessionId,lastRunId:runId,origin:{commandId},updatedAt}=doc.view;
  const callId='r1_effect_call_'+runId, idempotencyKey='r1-effect:'+runId;
  const owner={sessionId,taskId,runId,generation:1}, id='xieffect_'+digest([sessionId,taskId,idempotencyKey]);
  const value={schemaVersion:1,id,owner,callId,commandId,tool:'office_copy',operation:'tool',idempotencyKey,
    receipt:{runId,callId},contract:{schemaVersion:1,taskId,requirementsVersion:1,inputDigest:digest('input'),
      sourceHash:digest('source'),providerHash:digest('provider'),schemaHash:digest('schema'),grantRefs:[],authorityRefs:[]},
    target:'r1-test.txt',targetVersion:null,revision:1,state:'unknown',proofs:[],createdAt:updatedAt,updatedAt};
  db.prepare(`INSERT INTO xiaozhi_event_runs(run_id,session_id,generation,revision,sequence,status,turn_json,updated_at)
    VALUES(?,?,1,1,1,'completed','{}',?)`).run(runId,sessionId,updatedAt);
  db.prepare(`INSERT INTO xiaozhi_tool_receipts(run_id,call_id,generation,tool,start_sequence,phase,updated_at)
    VALUES(?,?,1,'office_copy',1,'result',?)`).run(runId,callId,updatedAt);
  db.prepare(`INSERT INTO xiaozhi_effects_v1(effect_id,session_id,task_id,run_id,generation,call_id,command_id,operation,
    idempotency_key,receipt_run_id,receipt_call_id,revision,state,document_json,created_at,updated_at)
    VALUES(?,?,?,?,1,?,?,'tool',?,?,?,1,'unknown',?,?,?)`)
    .run(id,sessionId,taskId,runId,callId,commandId,idempotencyKey,runId,callId,JSON.stringify(value),updatedAt,updatedAt);
  return id;
}

export function seed(root,size,sessions=100) {
  return withSql(root,true,db=>{
    db.exec('BEGIN IMMEDIATE');
    try {
      const records=Array.from({length:size},(_,index)=>addTask(db,index,sessions));
      const sizes=records.map(doc=>Buffer.byteLength(JSON.stringify(doc)));
      const distribution=Object.fromEntries(states.map(state=>[state,records.filter(doc=>doc.view.state===state).length]));
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
      db.exec('COMMIT');
      return {size,sessions,distribution,jsonBytes:{min:Math.min(...sizes),max:Math.max(...sizes),median:sizes.sort((a,b)=>a-b)[Math.floor(size/2)]},
        approvals:records.filter((_,index)=>index%23===0).length,effects:records.filter((_,index)=>index%37===0).length};
    } catch(error){db.exec('ROLLBACK');throw error;}
  });
}

export function expectedTasks(root) {
  return withSql(root,false,db=>db.prepare(`SELECT value_json FROM app_settings WHERE key GLOB 'xiaozhi.task.v1:xitask_*'
    AND length(key)=87`).all().map(({value_json})=>JSON.parse(value_json).view)
    .sort((a,b)=>a.updatedAt===b.updatedAt?(a.id<b.id?-1:a.id>b.id?1:0):a.updatedAt>b.updatedAt?-1:1));
}
