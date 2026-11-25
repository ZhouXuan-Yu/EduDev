import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {workbenchTaskGroup,type WorkbenchQuery,type WorkbenchSourceFailure,type WorkbenchSummary,type WorkbenchTaskRow} from '../../shared/xiaozhi-workbench';
import type {Sql} from './session-state';
import {taskSummaryPrefix as prefix} from './task-summary-schema';
import {workbenchText} from './workbench-state';
import {taskSummaryRowBlocked} from './task-summary-row';
import {taskSummaryRowCountTable} from './task-summary-maintenance-v6';

type TaskQuery=Extract<WorkbenchQuery,{kind:'tasks'}>;
type TaskPage=Extract<WorkbenchSummary,{kind:'tasks'}>;
type Value=string|number;
type Cursor={epoch:string;generation:number;scope:string;updatedAt:string;id:string};
const states=['active','review_required','paused','interrupted','completed','ended'] as const;
export const taskSummaryRowColumns='r.task_id,r.session_id,r.revision,r.updated_at,r.state,r.task_group,r.resumable,r.blocked,r.row_json';
const secret=randomBytes(32);
const authenticate=(value:string)=>createHmac('sha256',secret).update(value).digest();

function decode(cursor:string,expected:Pick<Cursor,'epoch'|'generation'|'scope'>):Cursor {
  try {
    const [body,signature,extra]=cursor.split('.');
    if(extra!==undefined || !/^[\w-]+$/u.test(body) || !/^[\w-]{43}$/u.test(signature))throw Error();
    if(!timingSafeEqual(authenticate(body),Buffer.from(signature,'base64url')))throw Error();
    const value=JSON.parse(Buffer.from(body,'base64url').toString('utf8')) as Cursor;
    if(value.epoch!==expected.epoch || value.generation!==expected.generation || value.scope!==expected.scope ||
      typeof value.updatedAt!=='string' || !/^xitask_[a-f0-9]{64}$/u.test(value.id))throw Error();
    return value;
  }catch {throw Error('changed');}
}

function encode(cursor:Cursor) {
  const body=Buffer.from(JSON.stringify(cursor)).toString('base64url');
  return body+'.'+authenticate(body).toString('base64url');
}

const positive = (value:unknown) => Number.isSafeInteger(value) && Number(value)>0;
const count = (value:unknown) => value===null || Number.isSafeInteger(value) && Number(value)>=0;

// This checks structure and redundant columns of the bounded result page. It
// cannot attest to the provenance of a consistently rewritten derived document.
export function validatedTaskSummaryRow(row:Record<string,unknown>):WorkbenchTaskRow|null {
  if(typeof row.row_json!=='string')return null;
  let item:WorkbenchTaskRow;
  try {item=JSON.parse(row.row_json);}catch{return null;}
  if(!item || typeof item.taskId!=='string' || !/^xitask_[a-f0-9]{64}$/u.test(item.taskId) || item.taskId!==row.task_id ||
    typeof item.sessionId!=='string' || !item.sessionId || item.sessionId!==row.session_id ||
    !positive(item.revision) || item.revision!==row.revision || !positive(item.requirementsVersion) ||
    typeof item.updatedAt!=='string' || !Number.isFinite(Date.parse(item.updatedAt)) || item.updatedAt!==row.updated_at ||
    item.state!==row.state || !states.includes(item.state) || workbenchTaskGroup(item.state)!==row.task_group ||
    typeof item.lastRunId!=='string' || !item.lastRunId || typeof item.sessionTitle!=='string' ||
    typeof item.isLatestForSession!=='boolean' || typeof item.resumeCandidate!=='boolean' || typeof item.continuationCandidate!=='boolean' ||
    Number(item.resumeCandidate || item.continuationCandidate)!==row.resumable ||
    !Array.isArray(item.blockedReasons) || !item.blockedReasons.every(reason=>typeof reason==='string') ||
    !count(item.pendingApprovalCount) || !count(item.unknownEffectCount) || ![null,1,2,3].includes(item.planningLevel) ||
    item.nativeInspection!=='not_checked' || taskSummaryRowBlocked(item)!==row.blocked ||
    (item.goalExcerpt!==undefined && typeof item.goalExcerpt!=='string') ||
    (item.steps!==undefined && (!item.steps || !Number.isSafeInteger(item.steps.total) || !Number.isSafeInteger(item.steps.verified) ||
      item.steps.verified<0 || item.steps.total<item.steps.verified))) return null;
  return item;
}

export async function readTaskSummaryPage(sql:Sql,input:TaskQuery,damagedIds:string[] = []):Promise<TaskPage> {
  const [clock]=await sql.all(`SELECT epoch,generation,phase,
    EXISTS(SELECT 1 FROM ${prefix}dirty) OR EXISTS(SELECT 1 FROM ${prefix}dirty_sessions) AS out_of_date,
    projected_rows<>COALESCE((SELECT actual_rows FROM ${taskSummaryRowCountTable} WHERE id=1),-1) AS damaged
    FROM ${prefix}control WHERE id=1`);
  if(!clock)throw Error('unavailable');
  const scope={epoch:String(clock.epoch),generation:Number(clock.generation),
    scope:JSON.stringify([input.filter,input.sessionId??null,input.taskId??null,input.limit??25])};
  const cursor=input.cursor?decode(input.cursor,scope):null;
  const [session]=input.sessionId ? await sql.all(
    'SELECT typeof(title) AS title_type FROM ai_conversation_sessions WHERE id=? AND archived_at IS NULL',[input.sessionId],
  ) : [];
  if(input.sessionId && !session)throw Error('permission_denied');
  const sourceFailures=(await sql.all(`SELECT source,code,
    CASE WHEN COUNT(*)=COUNT(records) THEN SUM(records) ELSE NULL END AS records
    FROM ${prefix}failures WHERE source<>'sessions' GROUP BY source,code`)) as WorkbenchSourceFailure[];
  const badSessions=session ? Number(session.title_type!=='text') : Number((await sql.all(`
    SELECT COUNT(*) AS n FROM ai_conversation_sessions s WHERE s.archived_at IS NULL AND typeof(s.title)<>'text'
    AND EXISTS(SELECT 1 FROM ${prefix}owners WHERE session_id=s.id)`))[0]?.n);
  if(badSessions)sourceFailures.push({source:'sessions',code:'corrupt',records:badSessions});
  if(clock.phase!=='ready' || clock.out_of_date || clock.damaged){
    sourceFailures.push({source:'tasks',code:'unavailable',records:null});
  }
  if(sourceFailures.length && cursor)throw Error('changed');

  const from=`FROM ${prefix}rows r JOIN ai_conversation_sessions s ON s.id=r.session_id`;
  const base=["s.archived_at IS NULL","typeof(s.title)='text'"];
  const values:Value[]=[];
  if(input.sessionId){base.push('r.session_id=?');values.push(input.sessionId);}
  if(input.taskId){base.push('r.task_id=?');values.push(input.taskId);}
  const universe=base.join(' AND ');
  const filter:Partial<Record<TaskQuery['filter'],string>>={
    unfinished:"r.state NOT IN ('completed','ended')", resumable:'r.resumable=1',
    blocked:'r.blocked=1', active:"r.state='active'", completed:"r.state='completed'", ended:"r.state='ended'",
    overview:"r.state<>'ended'",
  };
  const filtered=[universe,filter[input.filter]].filter(Boolean).join(' AND ');
  const overview=input.filter==='overview';
  const matchedRows=overview?`WITH ranked AS (
    SELECT r.task_id,r.updated_at,r.task_group,
      row_number() OVER(PARTITION BY r.task_group ORDER BY r.updated_at DESC,r.task_id ASC) AS within_group
      ${from} WHERE ${filtered}
    ), selected AS (
      SELECT task_id,updated_at FROM ranked WHERE within_group<=CASE task_group WHEN 'completed' THEN 3 ELSE 5 END
    )`:'';
  const pageFrom=overview
    ? `FROM selected p JOIN ${prefix}rows r ON r.task_id=p.task_id JOIN ai_conversation_sessions s ON s.id=r.session_id`
    : from;
  const where=[overview?'1':filtered,cursor?'r.updated_at<=? AND (r.updated_at<? OR r.task_id>?)':'1'].join(' AND ');
  const limit=Math.min(input.limit??25,25);
  const result=await sql.all(`${matchedRows}
    SELECT ${taskSummaryRowColumns},s.title ${pageFrom} WHERE ${where}
      ORDER BY r.updated_at DESC,r.task_id ASC LIMIT ?`,
    [...values,...(cursor?[cursor.updatedAt,cursor.updatedAt,cursor.id]:[]),limit+1]);
  const page=result.slice(0,limit);
  const items:WorkbenchTaskRow[]=[];
  for(const [index,row] of result.entries()){
    const item=validatedTaskSummaryRow(row);
    if(!item)damagedIds.push(String(row.task_id));
    else if(index<limit)items.push({...item,sessionTitle:workbenchText(row.title)});
  }
  if(damagedIds.length)sourceFailures.push({source:'tasks',code:'corrupt',records:damagedIds.length});
  const partial=sourceFailures.length>0;
  if(partial && cursor)throw Error('changed');
  let counts:Record<string,number>|null=null,total:number|null=null,matched:number|null=null;
  if(!partial){
    const byState=await sql.all(`SELECT r.state,COUNT(*) AS n ${from} WHERE ${universe} GROUP BY r.state`,values);
    counts=Object.fromEntries(states.map(state=>[state,0]));
    total=0;
    for(const {state,n} of byState){counts[String(state)]=Number(n);total+=Number(n);}
    if(input.filter==='all')matched=total;
    else if(overview)matched=await sql.all(`${matchedRows} SELECT COUNT(*) AS n FROM selected`,values).then(([row])=>Number(row.n));
    else matched=await sql.all(`SELECT COUNT(*) AS n ${from} WHERE ${filtered}`,values).then(([row])=>Number(row.n));
  }
  const last=page.at(-1);
  return {schemaVersion:1,kind:'tasks',asOf:new Date().toISOString(),items,total,matched,counts,partial,
    nextCursor:!partial && result.length>limit && last
      ?encode({...scope,updatedAt:String(last.updated_at),id:String(last.task_id)}):null,
    unavailableCount:sourceFailures.reduce((sum,item)=>sum+(item.records??0),0),
    sourceFailures,scanned:result.length};
}
