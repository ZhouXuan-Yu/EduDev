import {createHash} from 'node:crypto';
import type {Sql} from '../xiaozhi-agent/session-state';
import {TEACHER_PREFERENCE_SCHEMA,validTeacherPreferenceValues,type TeacherPreferenceSnapshot,type TeacherPreferenceValues} from '../../shared/teacher-preferences';
import {evaluateTeacherPreference,teacherPreferenceSignal} from './teacher-preference-policy';
import {abandonTeacherLearning,observeTeacherLearning,type TeacherLearningEvidence} from './teacher-preference-learning';

const namespace='xiaozhi.teacher-preference.v1:',headKey=namespace+'head';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const empty=():TeacherPreferenceSnapshot=>({schemaVersion:TEACHER_PREFERENCE_SCHEMA,revision:0,values:{}});
type Outcome='none'|'learned'|'rolled_back'|'rejected'|'no_previous'|'observed'|'trial';
type Version=TeacherPreferenceSnapshot&{parentRevision:number;activeRevision:number;parentActiveRevision:number;kind:'promote'|'rollback';
 evidence:{sessionId:string;runId:string;messageId:string;sha256:string};evaluation:ReturnType<typeof evaluateTeacherPreference>['evaluation'];learning?:TeacherLearningEvidence};
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const publicSnapshot=(v:TeacherPreferenceSnapshot):TeacherPreferenceSnapshot=>({schemaVersion:TEACHER_PREFERENCE_SCHEMA,revision:v.revision,values:{...v.values}});
async function setting(sql:Sql,key:string){const row=(await sql.all('SELECT value_json FROM app_settings WHERE key=?',[key]))[0];return row?String(row.value_json):undefined;}
async function version(sql:Sql,revision:number):Promise<Version|undefined>{
 if(!revision)return undefined;
 const raw=await setting(sql,namespace+'version:'+revision);if(!raw||Buffer.byteLength(raw)>16384)throw Error('configuration');
 const v=JSON.parse(raw) as Version;
 if(v.schemaVersion!==TEACHER_PREFERENCE_SCHEMA||v.revision!==revision||!positive(v.revision)||!integer(v.parentRevision)||v.parentRevision>=revision
  ||!integer(v.activeRevision)||v.activeRevision>revision||!integer(v.parentActiveRevision)||v.parentActiveRevision>=revision
  ||!['promote','rollback'].includes(v.kind)||!validTeacherPreferenceValues(v.values)||!v.evidence||!/^run_[a-f0-9-]{36}$/i.test(v.evidence.runId)
  ||!/^aisession_[a-f0-9-]{36}$/i.test(v.evidence.sessionId)||typeof v.evidence.messageId!=='string'||!v.evidence.messageId||v.evidence.messageId.length>150||!/^[a-f0-9]{64}$/.test(v.evidence.sha256)
  ||v.evaluation?.metric!=='teacher_preference_contract.v1'||v.evaluation.passed!==true||v.evaluation.preserved!==true||!integer(v.evaluation.matched)||!integer(v.evaluation.total)||v.evaluation.matched!==v.evaluation.total
  ||v.evaluation.educationalCorrectness!=='not_evaluated'||v.learning&&(!['teacher_presentation_observed.v1','teacher_presentation_observed.v2','teacher_presentation_observed.v3'].includes(v.learning.metric)||!/^run_[a-f0-9-]{36}$/i.test(v.learning.candidateId)||!/^run_[a-f0-9-]{36}$/i.test(v.learning.holdoutRunId)||!Array.isArray(v.learning.trainRuns)||v.learning.trainRuns.length!==2||new Set(v.learning.trainRuns).size!==2||v.learning.trainRuns.some(r=>!/^run_[a-f0-9-]{36}$/i.test(r)||r===v.learning!.holdoutRunId)))throw Error('configuration');
 return v;
}
async function current(sql:Sql){
 const raw=await setting(sql,headKey);if(raw===undefined)return{raw,record:undefined};
 const h=JSON.parse(raw);if(h.schemaVersion!==TEACHER_PREFERENCE_SCHEMA||!positive(h.revision)||!/^[a-f0-9]{64}$/.test(h.sha256))throw Error('configuration');
 const record=await version(sql,h.revision),saved=await setting(sql,namespace+'version:'+h.revision);
 if(!record||digest(saved!)!==h.sha256)throw Error('configuration');return{raw,record};
}
/** Main-only exact historical baseline for local candidate replay. */
export async function teacherPreferenceAt(sql:Sql,revision:number):Promise<TeacherPreferenceSnapshot>{
 if(!integer(revision))throw Error('configuration');const record=await version(sql,revision);return record?publicSnapshot(record):empty();
}
/** App-local preference namespace reuses existing SQLite settings, transactions and CAS.
 * No education-memory selection is changed and no raw feedback is copied to model context.
 */
export function createTeacherPreferenceState(sql:Sql){
 return{
  async snapshot(){const c=await current(sql);return c.record?publicSnapshot(c.record):empty();},
  async observe(sessionId:string,runId:string,isCurrent:()=>boolean):Promise<{snapshot:TeacherPreferenceSnapshot;action:Outcome;trial?:TeacherPreferenceValues}>{
   if(!/^aisession_[a-f0-9-]{36}$/i.test(sessionId)||!/^run_[a-f0-9-]{36}$/i.test(runId)||!sql.transaction)throw Error('invalid_input');
   return sql.transaction(async work=>{
    if(!isCurrent())throw Error('cancelled');
    const sources=await work.all(`SELECT m.id,m.content FROM ai_conversation_messages m JOIN ai_conversation_sessions s ON s.id=m.session_id JOIN ai_agent_runs r ON r.id=? AND r.session_id=s.id
      WHERE m.session_id=? AND m.role='user' AND json_extract(m.metadata_json,'$.agentRunId')=? AND s.archived_at IS NULL AND r.status='running' AND r.sub_intent='pi_education' LIMIT 2`,[runId,sessionId,runId]);
    if(sources.length!==1)throw Error('permission_denied');
    const source=sources[0],text=String(source.content),hash=digest(text),eventKey=namespace+'event:'+runId;
    const prior=await setting(work,eventKey),c=await current(work),baseline=c.record||empty();
    if(prior){const receipt=JSON.parse(prior);if(receipt.schemaVersion!==TEACHER_PREFERENCE_SCHEMA||receipt.messageId!==source.id||receipt.sha256!==hash||!integer(receipt.appliedRevision)||!['none','learned','rolled_back','rejected','no_previous','observed','trial'].includes(receipt.action)||receipt.trial!==undefined&&!validTeacherPreferenceValues(receipt.trial))throw Error('configuration');const v=await version(work,receipt.appliedRevision);return{snapshot:v?publicSnapshot(v):empty(),action:receipt.action as Outcome,...(receipt.trial?{trial:receipt.trial}:{})};}
    let signal=teacherPreferenceSignal(text);let action:Outcome='none',next:Version|undefined;
    const learning=signal.kind==='none'?await observeTeacherLearning(work,{id:String(source.id),sessionId,runId,text},baseline):undefined;
    if(learning?.rollback)signal={kind:'rollback'};
    else if(learning?.patch)signal={kind:'candidate',patch:learning.patch};
    else if(learning?.trial)action='trial';
    else if(learning?.candidateId)action='observed';
    if(signal.kind!=='none'&&!learning?.patch&&!learning?.rollback)await abandonTeacherLearning(work);
    if(signal.kind==='candidate'){
     const tested=evaluateTeacherPreference(baseline.values,signal.patch);
     if(!tested.evaluation.passed)action='rejected';
     else if(JSON.stringify(tested.candidate)!==JSON.stringify(baseline.values)){
      const revision=baseline.revision+1;
      next={schemaVersion:TEACHER_PREFERENCE_SCHEMA,revision,values:tested.candidate,parentRevision:baseline.revision,activeRevision:revision,parentActiveRevision:c.record?.activeRevision||0,kind:'promote',evidence:{sessionId,runId,messageId:String(source.id),sha256:hash},evaluation:tested.evaluation,...(learning?.evidence?{learning:learning.evidence}:{})};action='learned';
     }
    }else if(signal.kind==='rollback'&&c.record?.activeRevision){
     const target=await version(work,c.record.parentActiveRevision);
     // Restore the prior active strategy; repeated undo walks history, never toggles.
     const values:TeacherPreferenceValues=target?.values||{};
     next={schemaVersion:TEACHER_PREFERENCE_SCHEMA,revision:baseline.revision+1,values,parentRevision:baseline.revision,activeRevision:target?.activeRevision||0,parentActiveRevision:target?.parentActiveRevision||0,kind:'rollback',evidence:{sessionId,runId,messageId:String(source.id),sha256:hash},evaluation:{metric:'teacher_preference_contract.v1',matched:Object.keys(values).length,total:Object.keys(values).length,baselineMatched:0,preserved:true,passed:true,educationalCorrectness:'not_evaluated'}};action='rolled_back';
    }else if(signal.kind==='rollback')action='no_previous';
    else if(signal.kind==='rejected')action='rejected';
    if(!isCurrent())throw Error('cancelled');
    const timestamp=new Date().toISOString();
    if(next){
     const raw=JSON.stringify(next);await work.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',[namespace+'version:'+next.revision,raw,timestamp]);
     const head=JSON.stringify({schemaVersion:TEACHER_PREFERENCE_SCHEMA,revision:next.revision,sha256:digest(raw)});
     // Production transactions intentionally expose only run/all on their private
     // connection. SQLite changes() reads that exact statement's CAS result.
     if(c.raw===undefined)await work.run('INSERT OR IGNORE INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',[headKey,head,timestamp]);
     else await work.run('UPDATE app_settings SET value_json=?,updated_at=? WHERE key=? AND value_json=?',[head,timestamp,headKey,c.raw]);
     const changed=Number((await work.all('SELECT changes() AS changed'))[0]?.changed);
     if(changed!==1)throw Error('conflict');
    }
    const snapshot=publicSnapshot(next||baseline);
    // Local receipt proves which version the actual run used, without copying messages.
    if(snapshot.revision||signal.kind!=='none'||learning?.candidateId)await work.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',[eventKey,JSON.stringify({schemaVersion:TEACHER_PREFERENCE_SCHEMA,sessionId,runId,messageId:String(source.id),sha256:hash,action,appliedRevision:snapshot.revision,...(learning?.trial?{trial:learning.trial}:{}),...(learning?.candidateId?{candidateId:learning.candidateId}:{})}),timestamp]);
    if(!isCurrent())throw Error('cancelled');
    return{snapshot,action,...(learning?.trial?{trial:learning.trial}:{})};
   });
  },
 };
}
