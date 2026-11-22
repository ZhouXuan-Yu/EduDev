import {randomUUID} from 'node:crypto';
import type {Sql} from '../xiaozhi-agent/session-state';
import {protocolHash} from '../xiaozhi-agent/capabilities/validation';
import {createTaskState} from '../xiaozhi-agent/tasks/task-state';
import type {MockExamEditDecision,MockExamEditInput,MockExamEditReview,MockExamEditStatus} from '../../shared/mock-exam-edit';
import type {HandoutOwner} from './teaching-handout-state';
import {assertMockExamRun,verifyMockExamOriginals,type createMockExamState} from './mock-exam-state';
import {assertMockExamSource} from './mock-exam-sources';
import {planMockExamEdit,validMockExamEdit} from './mock-exam-edit-plan';

type Row=Record<string,unknown>;
type Verify=Parameters<typeof verifyMockExamOriginals>[1];
type PendingImage={input:MockExamEditInput;diffs:MockExamEditReview['diffs']};

function unpack(row:Row) {
  const image=JSON.parse(String(row.image_json)) as PendingImage;
  if(!validMockExamEdit(image.input)||!Array.isArray(image.diffs)||protocolHash(image)!==row.fingerprint)throw Error('configuration');
  return image;
}

function present(row:Row):MockExamEditReview {
  const {input,diffs}=unpack(row);
  return {summary:{id:String(row.id),title:String(row.title),runId:String(row.run_id),catalogId:input.catalogId,revision:input.revision,
    count:diffs.length,fingerprint:String(row.fingerprint),state:row.state as MockExamEditStatus,
    ...(row.applied_revision!==null&&{appliedRevision:Number(row.applied_revision)})},diffs};
}

async function runStatus(work:Sql,sessionId:string,runId:string){
  const [row]=await work.all('SELECT status FROM ai_agent_runs WHERE id=? AND session_id=?',[runId,sessionId]);
  return row?.status;
}

export function createMockExamEditState(sql:Sql,catalogs:ReturnType<typeof createMockExamState>){
  function write<T>(action:(work:Sql)=>Promise<T>){
    if(!sql.transaction)throw Error('configuration');
    return sql.transaction(action);
  }
  async function read(work:Sql,sessionId:string,id:string){
    const [row]=await work.all(`SELECT e.* FROM mock_exam_edit_reviews e JOIN ai_conversation_sessions s ON s.id=e.session_id
      WHERE e.id=? AND e.session_id=? AND COALESCE(s.student_id,'')='' AND COALESCE(s.archived_at,'')=''`,[id,sessionId]);
    if(!row)throw Error('permission_denied');
    return row;
  }
  async function finish(work:Sql,row:Row,state:MockExamEditStatus,revision:number|null=null){
    await work.run(`UPDATE mock_exam_edit_reviews SET state=?,applied_revision=?,updated_at=? WHERE id=? AND state='pending'`,
      [state,revision,new Date().toISOString(),String(row.id)]);
    return present(await read(work,String(row.session_id),String(row.id)));
  }
  async function decisionRow(work:Sql,decision:MockExamEditDecision){
    const row=await read(work,decision.sessionId,decision.id);
    if(row.fingerprint!==decision.fingerprint)throw Error('permission_denied');
    if(row.state!=='pending'){
      const target=decision.action==='approve'?'applied':'rejected';
      if(row.state!==target)throw Error('version_conflict');
      return row;
    }
    if(await runStatus(work,decision.sessionId,String(row.run_id))!=='succeeded')throw Error('review_waiting');
    const task=await createTaskState(work,{sanitize:async text=>text}).summaryRecord(String(row.task_id));
    if(task?.view.sessionId!==decision.sessionId||!task.runIds.includes(String(row.run_id)))throw Error('permission_denied');
    return row;
  }
  return {
    async migrate(){
      await sql.run(`CREATE TABLE IF NOT EXISTS mock_exam_edit_reviews (
        id TEXT PRIMARY KEY, catalog_id TEXT NOT NULL REFERENCES mock_exam_compilations(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id) ON DELETE CASCADE,
        run_id TEXT NOT NULL UNIQUE REFERENCES ai_agent_runs(id) ON DELETE CASCADE, task_id TEXT NOT NULL,
        generation INTEGER NOT NULL, call_id TEXT NOT NULL, title TEXT NOT NULL, image_json TEXT NOT NULL,
        fingerprint TEXT NOT NULL, state TEXT NOT NULL, applied_revision INTEGER, updated_at TEXT NOT NULL)`);
      await sql.run('CREATE INDEX IF NOT EXISTS mock_exam_edits_session ON mock_exam_edit_reviews(session_id,updated_at)');
    },
    async recover(){
      await sql.run(`UPDATE mock_exam_edit_reviews SET state='interrupted',updated_at=? WHERE state='pending'
        AND NOT EXISTS (SELECT 1 FROM ai_agent_runs r WHERE r.id=run_id AND r.session_id=mock_exam_edit_reviews.session_id AND r.status='succeeded')`,
      [new Date().toISOString()]);
    },
    async interrupt(runId:string){
      await sql.run("UPDATE mock_exam_edit_reviews SET state='interrupted',updated_at=? WHERE run_id=? AND state='pending'",
        [new Date().toISOString(),runId]);
    },
    async list(sessionId:string){
      const rows=await sql.all('SELECT * FROM mock_exam_edit_reviews WHERE session_id=? ORDER BY updated_at DESC,id DESC LIMIT 100',[sessionId]);
      return rows.map(row=>present(row).summary);
    },
    view:async(sessionId:string,id:string)=>present(await read(sql,sessionId,id)),
    async propose(owner:HandoutOwner,callId:string,input:MockExamEditInput,fence:()=>void){
      return write(async work=>{
        fence();await assertMockExamRun(work,owner);
        const [prior]=await work.all('SELECT * FROM mock_exam_edit_reviews WHERE run_id=? AND session_id=?',[owner.runId,owner.sessionId]);
        if(prior){
          if(prior.call_id!==callId||protocolHash(unpack(prior).input)!==protocolHash(input))throw Error('version_conflict');
          return present(prior);
        }
        const catalog=await catalogs.viewWithin(work,owner.sessionId,input.catalogId);
        const {diffs,sources}=planMockExamEdit(catalog,input);
        for(const source of sources){fence();await assertMockExamSource(work,source);}
        const id='mock_edit_'+randomUUID(),image= {input,diffs};
        await work.run(`INSERT INTO mock_exam_edit_reviews(id,catalog_id,session_id,run_id,task_id,generation,call_id,title,image_json,
          fingerprint,state,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'pending',?)`,[id,input.catalogId,owner.sessionId,owner.runId,
          owner.taskId,owner.generation,callId,catalog.summary.title,JSON.stringify(image),protocolHash(image),new Date().toISOString()]);
        fence();return present(await read(work,owner.sessionId,id));
      });
    },
    async decide(decision:MockExamEditDecision,verify:Verify){
      if(decision.action==='reject')return write(async work=>{
        const row=await decisionRow(work,decision);
        return row.state==='rejected'?present(row):finish(work,row,'rejected');
      });
      const stored=await decisionRow(sql,decision);
      if(stored.state==='applied')return present(stored);
      const {input}=unpack(stored), signal=AbortSignal.timeout(80_000);
      try{
        const catalog=await catalogs.view(decision.sessionId,input.catalogId),plan=planMockExamEdit(catalog,input);
        await verifyMockExamOriginals(plan.sources,verify,signal);
        return await write(async work=>{
          const row=await decisionRow(work,decision);
          if(row.state==='applied')return present(row);
          const current=await catalogs.viewWithin(work,decision.sessionId,input.catalogId),next=planMockExamEdit(current,input);
          for(const source of next.sources)await assertMockExamSource(work,source);
          signal.throwIfAborted();
          const result=await catalogs.installDraft(work,decision.sessionId,input.catalogId,input.revision,next.snapshot);
          return finish(work,row,'applied',result.summary.revision);
        });
      }catch(error){
        if(!(error instanceof Error)||!['source_changed','version_conflict'].includes(error.message))throw error;
        return write(async work=>{
          const row=await decisionRow(work,decision);
          return row.state==='applied'?present(row):finish(work,row,'conflict');
        });
      }
    },
  };
}

export async function readMockExamEditEffect(sql:Sql,owner:Pick<HandoutOwner,'sessionId'|'runId'|'generation'>,callId:string){
  const [row]=await sql.all('SELECT * FROM mock_exam_edit_reviews WHERE session_id=? AND run_id=? AND generation=? AND call_id=?',
    [owner.sessionId,owner.runId,owner.generation,callId]);
  if(!row)return 'uncertain' as const;
  try{unpack(row);return 'matched' as const;}catch{return 'uncertain' as const;}
}
