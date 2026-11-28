import {randomUUID} from 'node:crypto';
import {HANDOUT_EDIT_SCHEMA,type HandoutEditDiff,type HandoutEditInput,type HandoutEditStatus,type HandoutEditSummary} from '../../shared/teaching-handout-edit';
import type {TeachingBookVersion} from '../../shared/teaching-book-version';
import {protocolHash} from '../xiaozhi-agent/capabilities/validation';
import type {TaskView} from '../../shared/xiaozhi-task';
import type {Sql} from '../xiaozhi-agent/session-state';
import {createTaskState} from '../xiaozhi-agent/tasks/task-state';
import type {createTeachingBookVersions} from './teaching-book-versions';
import type {HandoutOwner} from './teaching-handout-state';

type VersionState=ReturnType<typeof createTeachingBookVersions>;
type EditRow={
  id:string;owner:HandoutOwner;callId:string;title:string;input:HandoutEditInput;diffs:HandoutEditDiff[];
  fingerprint:string;state:HandoutEditStatus;version?:TeachingBookVersion;
};
const conflict=(error:unknown)=>error instanceof Error&&['version_conflict','source_changed','book_unavailable'].includes(error.message);
const ownerHash=(owner:HandoutOwner)=>protocolHash(owner);
const fingerprint=(owner:HandoutOwner,callId:string,input:HandoutEditInput,diffs:HandoutEditDiff[])=>
  protocolHash([ownerHash(owner),callId,input,protocolHash(diffs)]);
export const handoutEditSummary=(row:EditRow):HandoutEditSummary=>({
  schemaVersion:HANDOUT_EDIT_SCHEMA,id:row.id,bookId:row.input.bookId,title:row.title,callId:row.callId,taskId:row.owner.taskId,
  runId:row.owner.runId,count:row.diffs.length,state:row.state,fingerprint:row.fingerprint,
  ...(row.version?{version:row.version}:{}),
});
const decode=(row:Record<string,unknown>):EditRow=>{
  const detail=JSON.parse(String(row.value_json)) as Pick<EditRow,'owner'|'title'|'input'|'diffs'>;
  const id=String(row.id),callId=String(row.call_id);
  const revision=String(row.fingerprint);
  if(detail.owner.sessionId!==row.session_id||detail.owner.runId!==row.run_id||detail.input.bookId!==row.book_id||
      !Array.isArray(detail.diffs)||!detail.diffs.length||revision!==fingerprint(detail.owner,callId,detail.input,detail.diffs))throw Error('configuration');
  return {...detail,id,callId,fingerprint:revision,state:row.state as HandoutEditStatus,
    ...(row.version_json?{version:JSON.parse(String(row.version_json)) as TeachingBookVersion}:{})};
};

async function assertOwner(work:Sql,owner:HandoutOwner) {
  const tasks=createTaskState(work,{sanitize:async text=>text});
  const [binding,task,rows]=await Promise.all([
    tasks.ownerForRun(owner.sessionId,owner.runId),tasks.get(owner.taskId),
    work.all('SELECT status FROM ai_agent_runs WHERE id=? AND session_id=?',[owner.runId,owner.sessionId]),
  ]);
  if(binding?.taskId!==owner.taskId||binding.generation!==owner.generation||
     binding.requirementsVersion!==owner.requirementsVersion||task?.binding?.runId!==owner.runId||
     task.requirementsVersion!==owner.requirementsVersion||rows[0]?.status!=='running')throw Error('version_conflict');
}

export function createTeachingHandoutEditState(sql:Sql) {
  function write<T>(action:(work:Sql)=>Promise<T>):Promise<T> {
    if(!sql.transaction)throw Error('configuration');
    return sql.transaction(action);
  }
  async function get(work:Sql,sessionId:string,id:string) {
    const [row]=await work.all('SELECT * FROM teaching_handout_edit_reviews WHERE session_id=? AND id=?',[sessionId,id]);
    if(!row)throw Error('permission_denied');
    return decode(row);
  }
  async function finish(work:Sql,row:EditRow,state:HandoutEditStatus,version?:TeachingBookVersion) {
    if(!work.change)throw Error('configuration');
    if(await work.change(`UPDATE teaching_handout_edit_reviews SET state=?,version_json=? WHERE id=? AND state='pending'`,
      [state,version?JSON.stringify(version):'',row.id])!==1)throw Error('version_conflict');
    return {...row,state,version};
  }
  return {
    async migrate(){
      await sql.run(`CREATE TABLE IF NOT EXISTS teaching_handout_edit_reviews (
        id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id) ON DELETE CASCADE,
        run_id TEXT NOT NULL UNIQUE REFERENCES ai_agent_runs(id) ON DELETE CASCADE,call_id TEXT NOT NULL,
        book_id TEXT NOT NULL REFERENCES teaching_books(id) ON DELETE CASCADE,fingerprint TEXT NOT NULL,state TEXT NOT NULL,
        value_json TEXT NOT NULL,version_json TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)`);
      await sql.run('CREATE INDEX IF NOT EXISTS teaching_handout_edit_session ON teaching_handout_edit_reviews(session_id,created_at)');
    },
    recover:()=>sql.run("UPDATE teaching_handout_edit_reviews SET state='interrupted' WHERE state='pending'"),
    interrupt:(runId:string)=>sql.run("UPDATE teaching_handout_edit_reviews SET state='interrupted' WHERE run_id=? AND state='pending'",[runId]),
    async list(sessionId:string) {
      const rows=await sql.all(`SELECT id,book_id,run_id,call_id,state,fingerprint,version_json,
        json_extract(value_json,'$.title') AS title,json_extract(value_json,'$.owner.taskId') AS task_id,
        json_array_length(value_json,'$.diffs') AS change_count FROM teaching_handout_edit_reviews
        WHERE session_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100`,[sessionId]);
      return rows.map((row):HandoutEditSummary=>({
        schemaVersion:HANDOUT_EDIT_SCHEMA,id:String(row.id),bookId:String(row.book_id),runId:String(row.run_id),callId:String(row.call_id),
        title:String(row.title),taskId:String(row.task_id),state:row.state as HandoutEditStatus,count:Number(row.change_count),
        fingerprint:String(row.fingerprint),...(row.version_json?{version:JSON.parse(String(row.version_json)) as TeachingBookVersion}:{}),
      }));
    },
    view:(sessionId:string,id:string)=>get(sql,sessionId,id),
    async propose(versions:VersionState,owner:HandoutOwner,callId:string,input:HandoutEditInput,title:string,fence:()=>void) {
      return write(async work=>{
        fence();
        await assertOwner(work,owner);
        const [existing]=await work.all('SELECT * FROM teaching_handout_edit_reviews WHERE run_id=? AND session_id=?',[owner.runId,owner.sessionId]);
        if(existing){
          const previous=decode(existing);
          if(ownerHash(previous.owner)===ownerHash(owner)&&previous.callId===callId&&
            protocolHash(previous.input)===protocolHash(input))return previous;
          throw Error('review_exists');
        }
        const diffs=await versions.previewEdit(work,owner.sessionId,input);
        fence();
        const id='xihedit_'+randomUUID(),revision=fingerprint(owner,callId,input,diffs),detail={owner,title,input,diffs};
        await work.run(`INSERT INTO teaching_handout_edit_reviews (id,session_id,run_id,call_id,book_id,fingerprint,state,value_json,created_at)
          VALUES (?,?,?,?,?,?,'pending',?,?)`,
        [id,owner.sessionId,owner.runId,callId,input.bookId,revision,JSON.stringify(detail),new Date().toISOString()]);
        fence();
        return {...detail,id,callId,fingerprint:revision,state:'pending' as const};
      });
    },
    async decide(versions:VersionState,sessionId:string,id:string,revision:string,action:'approve'|'reject',fence:()=>void) {
      try{
        return await write(async work=>{
          const row=await get(work,sessionId,id);
          if(row.fingerprint!==revision)throw Error('permission_denied');
          if(row.state!=='pending')return row;
          fence();
          if(action==='reject')return finish(work,row,'rejected');
          await assertOwner(work,row.owner);
          const version=await versions.applyEdit(work,sessionId,id,row.input,protocolHash(row.diffs),fence);
          const saved=await finish(work,row,'applied',version);
          fence();
          return saved;
        });
      }catch(error){
        if(!conflict(error))throw error;
        // The source transaction rolled back. Publish a conflict in a fresh write.
        return write(async work=>{
          const row=await get(work,sessionId,id);
          return row.state==='pending'?finish(work,row,'conflict'):row;
        });
      }
    },
  };
}

export async function readHandoutEditEffect(sql:Sql,owner:Pick<HandoutOwner,'sessionId'|'runId'|'generation'>,callId:string) {
  const [stored]=await sql.all(`SELECT * FROM teaching_handout_edit_reviews WHERE session_id=? AND run_id=? AND call_id=?`,
    [owner.sessionId,owner.runId,callId]);
  if(!stored)return 'uncertain' as const;
  const row=decode(stored);
  if(row.owner.generation!==owner.generation||row.state!=='applied'||!row.version)return 'uncertain' as const;
  const [version]=await sql.all("SELECT digest FROM teaching_book_versions WHERE id=? AND book_id=? AND kind='edited_draft'",
    [row.version.id,row.input.bookId]);
  return version?.digest===row.version.digest?'matched' as const:'uncertain' as const;
}

/** A settled, teacher-approved edit of this exact version in the current scope. */
export async function confirmedHandoutEditPredecessor(sql:Sql,task:TaskView,version:TeachingBookVersion,scopeUpdatedAt:string) {
  if(task.goal||task.binding||!['review_required','completed'].includes(task.state))return;
  const runId=task.lastRunId??task.origin.runId;
  const [record]=await sql.all(`SELECT review.*,r.created_at AS run_started,e.status AS event_status,e.generation AS event_generation
    FROM teaching_handout_edit_reviews review JOIN ai_agent_runs r ON r.id=review.run_id AND r.session_id=review.session_id
    JOIN xiaozhi_event_runs e ON e.run_id=r.id AND e.session_id=r.session_id
    WHERE review.session_id=? AND review.run_id=? AND review.book_id=? AND review.state='applied'
      AND r.status='succeeded'`,[task.sessionId,runId,version.bookId]);
  if(!record||record.event_status!=='completed'||!(Date.parse(String(record.run_started))>=Date.parse(scopeUpdatedAt)))return;
  const review=decode(record);
  if(review.owner.taskId!==task.id||review.owner.requirementsVersion!==task.requirementsVersion||
    review.owner.generation!==Number(record.event_generation)||review.version?.digest!==version.digest||
    !(Date.parse(review.version.createdAt)<=Date.parse(version.createdAt)))return;
  if(await readHandoutEditEffect(sql,review.owner,review.callId)!=='matched')return;
  const [unsettled]=await sql.all("SELECT 1 FROM xiaozhi_effects_v1 WHERE task_id=? AND session_id=? AND state IN ('intent','executing','unknown','failed') LIMIT 1",
    [task.id,task.sessionId]);
  if(unsettled)return;
  return {id:task.id,revision:task.revision};
}
