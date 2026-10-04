import type {Sql} from './session-state';
import type {XiaozhiGoal,GoalState} from '../../shared/xiaozhi-goal';
import {goalText} from '../../shared/xiaozhi-goal';
export type PrivateGoal=XiaozhiGoal&{lastFingerprint:string;repeats:number};
const time=()=>new Date().toISOString();
export function publicGoal({lastFingerprint:_fingerprint,repeats:_repeats,...value}:PrivateGoal):XiaozhiGoal{return value;}
function parse(row:Record<string,unknown>):PrivateGoal{
 const goal=JSON.parse(String(row.payload_json)) as PrivateGoal;
 if(!goal||goal.schemaVersion!==1||goal.id!==row.id||goal.sessionId!==row.conversation_id||goal.revision!==Number(row.revision)||!Number.isSafeInteger(goal.revision)||goal.revision<0||goal.state!==row.state||!Object.prototype.hasOwnProperty.call({active:1,waiting_teacher:1,paused:1,interrupted:1,review_required:1,completed:1,ended:1},goal.state)||!goalText(goal.objective,4000)||!Array.isArray(goal.criteria)||!goal.criteria.length||goal.criteria.length>8||!goal.criteria.every(v=>goalText(v,400))||!Array.isArray(goal.evidence)||goal.evidence.length>40||!goal.evidence.every(v=>v&&goalText(v.runId,100)&&goalText(v.callId,200)&&goalText(v.label,200))||!Number.isSafeInteger(goal.checkpoints)||goal.checkpoints<0||!Number.isSafeInteger(goal.repeats)||goal.repeats<0||!['summary','nextStep','runId','resultRunId','candidate','lastFingerprint','createdAt','updatedAt'].every(k=>typeof goal[k as keyof PrivateGoal]==='string'))throw new Error('configuration');
 return goal;
}
export function createGoalState(sql:Sql){
 const change=async(query:string,args:(string|number)[])=>{if(!sql.change)throw new Error('configuration');return (await sql.change(query,args))===1;};
 const get=async(id:string)=>{const row=(await sql.all('SELECT * FROM xiaozhi_pi_goals WHERE id=?',[id]))[0];return row?parse(row):null;};
 const latest=async(session:string)=>{const row=(await sql.all('SELECT * FROM xiaozhi_pi_goals WHERE conversation_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1',[session]))[0];return row?parse(row):null;};
 const update=async(goal:PrivateGoal,patch:Partial<Pick<PrivateGoal,'state'|'summary'|'nextStep'|'runId'|'resultRunId'|'candidate'|'evidence'|'checkpoints'|'lastFingerprint'|'repeats'>>)=>{
  const next={...goal,...patch,revision:goal.revision+1,updatedAt:time()};
  if(!await change('UPDATE xiaozhi_pi_goals SET revision=?,state=?,payload_json=?,updated_at=? WHERE id=? AND conversation_id=? AND revision=? AND state=?',[next.revision,next.state,JSON.stringify(next),next.updatedAt,goal.id,goal.sessionId,goal.revision,goal.state]))throw new Error('command_conflict');return next;
 };
 return {get,latest,update,
  async migrate(){await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_goals(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL,revision INTEGER NOT NULL,state TEXT NOT NULL,payload_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(conversation_id) REFERENCES ai_conversation_sessions(id))`);await sql.run('CREATE INDEX IF NOT EXISTS xiaozhi_goal_session ON xiaozhi_pi_goals(conversation_id,created_at)');},
  async create(id:string,sessionId:string,objective:string,criteria:string[]){
   const previous=await get(id);if(previous){if(previous.sessionId!==sessionId||previous.objective!==objective||JSON.stringify(previous.criteria)!==JSON.stringify(criteria))throw new Error('command_conflict');return previous;}
   const now=time(),goal:PrivateGoal={schemaVersion:1,id,sessionId,revision:0,state:'active',objective,criteria,summary:'',nextStep:'开始核对目标与资料',runId:'',resultRunId:'',candidate:'',evidence:[],checkpoints:0,createdAt:now,updatedAt:now,lastFingerprint:'',repeats:0};
   if(!await change("INSERT OR IGNORE INTO xiaozhi_pi_goals(id,conversation_id,revision,state,payload_json,created_at,updated_at) SELECT ?,?,0,'active',?,?,? WHERE NOT EXISTS(SELECT 1 FROM xiaozhi_pi_goals WHERE conversation_id=? AND state NOT IN ('completed','ended'))",[id,sessionId,JSON.stringify(goal),now,now,sessionId]))throw new Error('busy');return goal;
  },
  async bind(goal:PrivateGoal,runId:string){if(goal.state!=='active')throw new Error('command_conflict');return update(goal,{runId,resultRunId:'',candidate:'',lastFingerprint:'',repeats:0});},
  async recover(){const rows=await sql.all("SELECT * FROM xiaozhi_pi_goals WHERE state IN ('active','waiting_teacher')");for(const row of rows)await update(parse(row),{state:'interrupted',summary:'应用关闭时任务尚未结束。进度已保留，恢复后重新核对权限与资料。'});},
  async waiting(sessionId:string,runId:string,waiting:boolean){const goal=await latest(sessionId);if(goal&&goal.runId===runId&&['active','waiting_teacher'].includes(goal.state)&&goal.state!==(waiting?'waiting_teacher':'active'))return update(goal,{state:waiting?'waiting_teacher':'active'});return null;},
  async interrupt(sessionId:string,runId:string,summary:string){const goal=await latest(sessionId);return goal&&goal.runId===runId&&['active','waiting_teacher'].includes(goal.state)?update(goal,{state:'interrupted',summary}):null;},
  async finish(sessionId:string,runId:string,text:string,failed:boolean){const goal=await latest(sessionId);if(!goal||goal.runId!==runId)return null;if(failed&&['active','waiting_teacher','review_required'].includes(goal.state))return update(goal,{state:'interrupted',summary:'本轮未完成，进度已保存。请检查错误后恢复。',resultRunId:''});if(!failed&&goal.state==='review_required')return update(goal,{candidate:text.slice(0,32000),resultRunId:runId});return null;}
 };
}
