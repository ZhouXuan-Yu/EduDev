import type { Sql } from '../session-state';
import type { configuredHistoryIndex } from './hindsight';
import { historyHash, type Access, type createHistoryState } from './state';

type Engine = NonNullable<ReturnType<typeof configuredHistoryIndex>>;
type Job = {job_id:string; action:'upsert'|'delete'; document_id:string; source_id:string; source_version:string;
  generation:number; index_generation:number; index_namespace:string; attempt:number; operation_id:string|null};

const checkInterval = 950;
function operationId(id:string) {
  const value=historyHash(id);
  return `${value.slice(0,8)}-${value.slice(8,12)}-4${value.slice(13,16)}-8${value.slice(17,20)}-${value.slice(20,32)}`;
}
function eligible(source:Access|null, job:Job) {
  return source?.allowed===true && source.status==='active' && source.generation===job.generation && source.ref.sourceVersion===job.source_version;
}

export function createHistoryIndexWorker(sql:Sql, engine:Engine, state:ReturnType<typeof createHistoryState>,
  read:(source:Access)=>Promise<{text:string}>) {
  const lifetime=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  let active:Promise<void>|undefined;
  async function allowed(job:Job,db=sql) {
    const index=await state.indexState(db);
    return (job.index_generation===index.active||job.index_generation===index.rebuilding) && eligible(await state.get(job.source_id,db),job);
  }
  async function claim():Promise<Job|undefined> {
    if (!sql.transaction) throw Error('configuration');
    return sql.transaction(async db=>{
      const now=Date.now();
      const [raw]=await db.all(`SELECT j.* FROM memory_index_jobs j
        WHERE (j.state IN ('pending','retry') AND j.next_attempt_at<=? OR j.state='running' AND j.lease_until<=?)
        AND (j.action='upsert' OR NOT EXISTS (SELECT 1 FROM memory_index_jobs u WHERE u.document_id=j.document_id
          AND u.action='upsert' AND u.state NOT IN ('succeeded','cancelled')))
        ORDER BY j.next_attempt_at,j.job_id LIMIT 1`,[now,now]);
      if(!raw)return;
      const job=raw as unknown as Job;
      const operation=job.action==='upsert'?(job.operation_id??operationId(job.job_id)):null;
      await db.run(`UPDATE memory_index_jobs SET state='running',attempt=attempt+1,lease_until=?,operation_id=? WHERE job_id=?`,
        [now+20000,operation,job.job_id]);
      return {...job,attempt:job.attempt+1,operation_id:operation};
    });
  }
  async function finish(job:Job, result:'succeeded'|'cancelled'|'retry'|'failed', reason:string|null=null) {
    await sql.run(`UPDATE memory_index_jobs SET state=?,lease_until=NULL,next_attempt_at=?,last_error=?
      WHERE job_id=? AND state='running' AND attempt=?`,
    [result,Date.now()+Math.min(60000,1000*2**Math.min(job.attempt,8)),reason,job.job_id,job.attempt]);
  }
  async function tick() {
    const job=await claim();
    if(!job)return;
    const signal=AbortSignal.any([lifetime.signal,AbortSignal.timeout(6000)]);
    try {
      if(job.action==='delete') {
        if(!await engine.remove(job.document_id,signal)) throw Error('cleanup_unconfirmed');
        await finish(job,'succeeded');
        return;
      }
      const source=await state.get(job.source_id);
      const initial=await allowed(job);
      const operation=job.operation_id!;
      const status=await engine.status(operation,signal);
      if(status==='pending'||status==='processing') {await finish(job,'retry','waiting_operation');return;}
      if(!initial) {
        if(job.attempt>1 && status==='not_found') {await finish(job,'retry','prior_write_unknown');return;}
        await finish(job,'cancelled');
        return;
      }
      if(status==='failed'||status==='cancelled') {await finish(job,'failed','operation_failed');return;}
      const row=await read(source!);
      const text=row.text.slice(0,12000);
      if(!text.trim()) {await finish(job,'cancelled');return;}
      if(status==='not_found') {
        if(!await allowed(job)) {await finish(job,'cancelled');return;}
        await engine.write(job.document_id,text,operation,signal);
        await finish(job,'retry','waiting_operation');
        return;
      }
      const hash=historyHash(text);
      if(status!=='completed'||!await engine.verify(job.document_id,hash,signal)) throw Error('write_unconfirmed');
      if(!sql.transaction) throw Error('configuration');
      await sql.transaction(async db=>{
        const [owned] = await db.all("SELECT state,attempt FROM memory_index_jobs WHERE job_id=?",[job.job_id]);
        if(owned?.state!=='running'||owned.attempt!==job.attempt)return;
        if(await allowed(job,db)){
          await db.run(`INSERT OR REPLACE INTO memory_index_catalog(document_id,source_id,source_version,generation,index_generation,
            index_namespace,content_hash,projection_version,sanitizer_version,status,verified_at)
            VALUES(?,?,?,?,?,?,?,1,1,'ready',?)`,[job.document_id,job.source_id,job.source_version,job.generation,job.index_generation,
            job.index_namespace,hash,new Date().toISOString()]);
        } else {
          await db.run(`INSERT OR IGNORE INTO memory_index_jobs
            (job_id,action,document_id,source_id,source_version,generation,index_generation,index_namespace,state)
            VALUES(?,'delete',?,?,?,?,?,?,'pending')`,['delete:'+job.document_id,job.document_id,job.source_id,job.source_version,
            job.generation,job.index_generation,job.index_namespace]);
        }
        await db.run("UPDATE memory_index_jobs SET state='succeeded',lease_until=NULL,last_error=NULL WHERE job_id=?",[job.job_id]);
        await state.promote(db);
      });
    } catch {
      await finish(job,job.attempt>=10?'failed':'retry','history_service_or_source_unavailable');
    }
  }
  function wake() {
    if(lifetime.signal.aborted||active)return;
    if(timer)clearTimeout(timer);
    active=tick().catch(()=>undefined).finally(()=>{
      active=undefined;
      if(!lifetime.signal.aborted){timer=setTimeout(wake,checkInterval);timer.unref();}
    });
  }
  return {wake, async close(){lifetime.abort();if(timer)clearTimeout(timer);await active;}};
}
