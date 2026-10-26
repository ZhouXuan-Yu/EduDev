import {createHash} from 'node:crypto';
import type {Sql} from '../xiaozhi-agent/session-state';
import {createEventJournal} from '../xiaozhi-agent/events/journal';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Local-only authority. Student identifiers and message/goal content never leave this module. */
export async function teacherLearningUser(sql:Sql,sessionId:string,runId:string,maxCharacters=8000){
 if(!Number.isSafeInteger(maxCharacters)||maxCharacters<1||maxCharacters>32768)throw Error('configuration');
 const rows=await sql.all(`SELECT m.id,m.content,m.metadata_json,r.status,r.student_id AS runStudent,s.student_id AS sessionStudent
 FROM ai_conversation_messages m JOIN ai_agent_runs r ON r.session_id=m.session_id AND r.id=json_extract(m.metadata_json,'$.agentRunId')
 JOIN ai_conversation_sessions s ON s.id=m.session_id AND s.archived_at IS NULL
 WHERE m.session_id=? AND r.id=? AND m.role='user' AND r.sub_intent='pi_education' AND r.status IN ('running','succeeded') LIMIT 2`,[sessionId,runId]);
 if(rows.length!==1)return;const row=rows[0];if(typeof row.content!=='string'||row.content.length>maxCharacters)return;
 if(String(row.runStudent||'')!==String(row.sessionStudent||''))return;
 const metadata=JSON.parse(String(row.metadata_json));if(metadata.preferenceSourceVersion!==1)return;let goal:unknown=null;
 if(metadata.goalId!==undefined){
  if(typeof metadata.goalId!=='string'||metadata.goalId.length>120)return;
  const found=(await sql.all('SELECT conversation_id,payload_json FROM xiaozhi_pi_goals WHERE id=?',[metadata.goalId]))[0];
  if(!found||found.conversation_id!==sessionId)return;const payload=JSON.parse(String(found.payload_json));
  if(typeof payload.objective!=='string'||!Array.isArray(payload.criteria)||!payload.criteria.every((v:unknown)=>typeof v==='string'))return;
  goal=[metadata.goalId,payload.objective,payload.criteria];
 }
 return {id:String(row.id),text:row.content,scopeDigest:hash([String(row.runStudent||''),String(row.sessionStudent||'')]),goalId:String(metadata.goalId||''),digest:hash([sessionId,runId,row.id,row.content,String(row.runStudent||''),String(row.sessionStudent||''),goal])};
}
export type TeacherLearningResponse={id:string;runId:string;content:string;prompt:string;digest:string};
export async function teacherLearningResponse(sql:Sql,sessionId:string,runId:string):Promise<TeacherLearningResponse|undefined>{
 const source=await teacherLearningUser(sql,sessionId,runId);if(!source)return;
 const rows=await sql.all(`SELECT m.id,m.content FROM ai_conversation_messages m JOIN ai_agent_runs r ON r.id=? AND r.session_id=m.session_id
 WHERE m.session_id=? AND m.role='assistant' AND json_extract(m.metadata_json,'$.agentRunId')=r.id AND r.status='succeeded'
 AND json_extract(m.metadata_json,'$.ok')=1 AND json_extract(m.metadata_json,'$.status')='completed' LIMIT 2`,[runId,sessionId]);
 if(rows.length!==1||typeof rows[0].content!=='string'||rows[0].content.length>24000)return;
 // The final assistant row can contain only a closing summary. Measure the same
 // durable public segments that the teacher actually read, never native reasoning.
 const saved=await createEventJournal(sql).snapshot(sessionId,runId);
 if(!saved||saved.status!=='completed'||saved.turn.id!==runId||saved.turn.status!=='completed'||!Array.isArray(saved.turn.items))return;
 const messages=saved.turn.items.filter(item=>item.kind==='message'&&item.role==='assistant');
 if(!messages.length||messages.length>32||messages.some(item=>item.kind!=='message'||typeof item.text!=='string'))return;
 const content=messages.map(item=>item.kind==='message'?item.text:'').join('\n');if(content.length>24000)return;
 return{id:String(rows[0].id),runId,content,prompt:source.text,digest:hash([source.digest,rows[0].id,rows[0].content,messages])};
}
export async function teacherSampleSource(sql:Sql,sample:{sessionId:string;runId:string;messageId:string;sha256:string;taskRunId:string;taskHash:string}){
 const user=await teacherLearningUser(sql,sample.sessionId,sample.runId),task=await teacherLearningResponse(sql,sample.sessionId,sample.taskRunId);
 if(!user||!task||user.id!==sample.messageId||createHash('sha256').update(user.text).digest('hex')!==sample.sha256||createHash('sha256').update(task.prompt).digest('hex')!==sample.taskHash)return;
 return hash([user.digest,task.digest]);
}
