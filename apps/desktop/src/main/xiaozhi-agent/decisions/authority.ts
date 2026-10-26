import {createHash} from 'node:crypto';import type {Sql} from '../session-state';
import {teacherLearningUser} from '../../education/teacher-preference-sources';
import {readTeacherCandidate,teacherCandidateSources} from '../../education/teacher-preference-learning';
import {routeIntent} from './route-spec';import type {RouteState} from '../../../shared/xiaozhi-routes';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function createDecisionAuthority(options:{sql:Sql;memory:(sessionId:string)=>Promise<{fingerprint:string;state:RouteState['memory']}>;files:(sessionId:string)=>Promise<{fingerprint:string;available:boolean}>;web:()=>Promise<{version:number;enabled:boolean}>}){
 return async(sessionId:string,runId:string,goalId:string)=>{
  const user=await teacherLearningUser(options.sql,sessionId,runId,32768);if(!user||user.goalId!==goalId)throw Error('permission_denied');
  let goal:unknown=null;if(goalId){const row=(await options.sql.all('SELECT revision,state FROM xiaozhi_pi_goals WHERE id=? AND conversation_id=?',[goalId,sessionId]))[0];if(!row||!Number.isSafeInteger(row.revision)||Number(row.revision)<0||!['active','waiting_teacher','paused','interrupted','review_required','completed','ended'].includes(String(row.state)))throw Error('configuration');goal=[row.revision,row.state];}
  const receiptRow=(await options.sql.all('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.teacher-preference.v1:event:'+runId]))[0];
  const receipt=receiptRow?JSON.parse(String(receiptRow.value_json)):undefined;let candidate:unknown=null,eligible=true;
  if(receipt?.candidateId){const value=await readTeacherCandidate(options.sql,receipt.candidateId),reason=await teacherCandidateSources(options.sql,value);candidate=[hash(value),reason||'current'];eligible=!reason&&(receipt.action==='observed'?value.status==='collecting':receipt.action==='trial'?value.status==='trial':receipt.action==='learned'?value.status==='accepted':false);}
  const memory=await options.memory(sessionId),files=await options.files(sessionId),web=await options.web();
  if(!/^[a-f0-9]{64}$/.test(memory.fingerprint)||!['off','empty','selected','unavailable'].includes(memory.state)||!/^[a-f0-9]{64}$/.test(files.fingerprint)||typeof files.available!=='boolean'||!Number.isSafeInteger(web.version)||web.version<0||typeof web.enabled!=='boolean')throw Error('configuration');
  const student=(await options.sql.all('SELECT student_id FROM ai_agent_runs WHERE id=? AND session_id=?',[runId,sessionId]))[0];if(!student)throw Error('permission_denied');
  const route:RouteState={intent:routeIntent(user.text),memory:memory.state,student:Boolean(student.student_id),files:files.available,web:web.enabled};
  // No raw source text, identity, credential or private reasoning is persisted or sent.
  return{digest:hash([2,user.digest,goal,candidate,memory.fingerprint,files.fingerprint,web.version,route]),route,eligible};
 };
}
