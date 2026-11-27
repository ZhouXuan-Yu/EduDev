import { createHash } from 'node:crypto';
import type { HistoryAccessAction, HistorySourceRef, HistoryMemoryMode } from '../../../shared/xiaozhi-history-memory';
import type { Sql } from '../session-state';

export const historyHash = (value: string) => createHash('sha256').update(value).digest('hex');
export const historyId = ({kind,sessionId,recordId}: HistorySourceRef) => historyHash(JSON.stringify([kind,sessionId,recordId]));
export const historyDocument = (sourceId: string, version: string, generation: number, indexGeneration = 1) =>
  'xz-' + historyHash(JSON.stringify([sourceId,version,generation,indexGeneration,1,1]));
export const historyNamespace = 'xiaozhi-history-r1';

export type Access = { sourceId: string; ref: HistorySourceRef; revision: number; generation: number; allowed: boolean; status: HistoryMemoryMode };
function fromRow(row: Record<string,unknown>): Access {
  return {
    sourceId:String(row.source_id),
    ref:{kind:row.kind as HistorySourceRef['kind'], sessionId:String(row.session_id),recordId:String(row.record_id),sourceVersion:String(row.source_version)},
    revision:Number(row.access_revision),generation:Number(row.generation),
    allowed:row.index_allowed===1 && row.discover_allowed===1, status:row.memory_state as HistoryMemoryMode,
  };
}

export async function invalidateHistoryProjections(db:Sql,id:string) {
  // A sent or ambiguous upsert can still write; cleanup waits for reconciliation.
  await db.run(`INSERT OR IGNORE INTO memory_index_jobs
    (job_id,action,document_id,source_id,source_version,generation,index_generation,index_namespace,state)
    SELECT 'delete:'||document_id,'delete',document_id,source_id,source_version,generation,index_generation,index_namespace,'pending'
    FROM memory_index_jobs WHERE action='upsert' AND source_id=? AND state IN ('running','retry','succeeded','failed')`,[id]);
  await db.run(`UPDATE memory_index_jobs SET state='cancelled' WHERE source_id=? AND action='upsert' AND state='pending'`,[id]);
  await db.run("UPDATE memory_index_catalog SET status='obsolete' WHERE source_id=?",[id]);
}

export function createHistoryState(sql: Sql) {
  const get = async (id: string, db = sql) => {
    const [row] = await db.all('SELECT * FROM memory_source_access WHERE source_id=?',[id]);
    return row ? fromRow(row) : null;
  };
  async function indexState(db=sql) {
    const [current]=await db.all('SELECT active_generation,rebuild_generation FROM memory_history_index_state WHERE id=1');
    return {active:Number(current.active_generation),rebuilding:current.rebuild_generation===null?null:Number(current.rebuild_generation)};
  }
  async function queueDocument(db:Sql,id:string,version:string,generation:number,indexGeneration:number) {
    const document=historyDocument(id,version,generation,indexGeneration);
    await db.run(`INSERT OR IGNORE INTO memory_index_jobs
      (job_id,action,document_id,source_id,source_version,generation,index_generation,index_namespace,state)
      VALUES(?,'upsert',?,?,?,?,?,?,'pending')`,
    ['upsert:'+document,document,id,version,generation,indexGeneration,historyNamespace]);
  }
  return {
    get,indexState,
    async rebuild() {
      if(!sql.transaction) throw Error('configuration');
      return sql.transaction(async db=>{
        const index=await indexState(db);
        if(index.rebuilding!==null)throw Error('command_conflict');
        const rows=await db.all(`SELECT * FROM memory_source_access WHERE index_allowed=1 AND discover_allowed=1 AND memory_state='active'`);
        if(!rows.length)return index;
        const next=index.active+1;
        await db.run('UPDATE memory_history_index_state SET rebuild_generation=? WHERE id=1',[next]);
        for(const row of rows.map(fromRow))await queueDocument(db,row.sourceId,row.ref.sourceVersion,row.generation,next);
        return {...index,rebuilding:next};
      });
    },
    async promote(db:Sql) {
      const index=await indexState(db);
      if(index.rebuilding===null)return;
      const missing=await db.all(`SELECT 1 FROM memory_source_access a WHERE index_allowed=1 AND discover_allowed=1 AND memory_state='active'
        AND NOT EXISTS(SELECT 1 FROM memory_index_catalog c WHERE c.source_id=a.source_id AND c.source_version=a.source_version
          AND c.generation=a.generation AND c.index_generation=? AND c.status='ready') LIMIT 1`,[index.rebuilding]);
      if(missing.length)return;
      await db.run('UPDATE memory_history_index_state SET active_generation=?,rebuild_generation=NULL WHERE id=1',[index.rebuilding]);
      await db.run(`INSERT OR IGNORE INTO memory_index_jobs
        (job_id,action,document_id,source_id,source_version,generation,index_generation,index_namespace,state)
        SELECT 'delete:'||document_id,'delete',document_id,source_id,source_version,generation,index_generation,index_namespace,'pending'
        FROM memory_index_jobs WHERE action='upsert' AND index_generation<? AND state IN ('running','retry','succeeded','failed')`,[index.rebuilding]);
      await db.run(`UPDATE memory_index_jobs SET state='cancelled' WHERE action='upsert' AND index_generation<? AND state='pending'`,[index.rebuilding]);
      await db.run(`UPDATE memory_index_catalog SET status='obsolete' WHERE index_generation<?`,[index.rebuilding]);
    },
    async permitted(): Promise<Access[]> {
      return (await sql.all(`SELECT * FROM memory_source_access WHERE index_allowed=1 AND discover_allowed=1
        AND memory_state='active' ORDER BY updated_at DESC,source_id LIMIT 500`)).map(fromRow);
    },
    async cleanup(id: string): Promise<'none'|'pending'|'done'> {
      const [row] = await sql.all(`SELECT COUNT(*) AS total, SUM(CASE WHEN state<>'succeeded' THEN 1 ELSE 0 END) AS pending
        FROM memory_index_jobs WHERE source_id=? AND action='delete'`,[id]);
      return Number(row.total)===0 ? 'none' : Number(row.pending)>0 ? 'pending' : 'done';
    },
    async change(ref: HistorySourceRef, expected: number, action: HistoryAccessAction,
      verifySource?:(work:Sql)=>Promise<void>): Promise<Access> {
      if (!sql.transaction) throw Error('configuration');
      const id = historyId(ref);
      return sql.transaction(async work => {
        const prior = await get(id,work);
        if ((prior?.revision ?? 0) !== expected) throw Error('command_conflict');
        if (!prior && action!=='allow' || prior?.status==='forgotten' && action!=='restore' ||
          action==='restore' && prior?.status==='active') throw Error('permission_denied');
        const allowed = action==='allow' || action==='restore';
        if(allowed)await verifySource?.(work);
        const status = action==='forget' ? 'forgotten' : action==='disable' ? 'disabled' : 'active';
        const revision = expected+1, generation = (prior?.generation ?? 0)+1;
        const version = allowed ? ref.sourceVersion : prior!.ref.sourceVersion;
        const timestamp = new Date().toISOString();
        await work.run(`INSERT INTO memory_source_access
          (source_id,kind,session_id,record_id,source_version,access_revision,generation,index_allowed,discover_allowed,memory_state,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(source_id) DO UPDATE SET source_version=excluded.source_version,access_revision=excluded.access_revision,
          generation=excluded.generation,index_allowed=excluded.index_allowed,discover_allowed=excluded.discover_allowed,
          memory_state=excluded.memory_state,updated_at=excluded.updated_at`,
        [id,ref.kind,ref.sessionId,ref.recordId,version,revision,generation,Number(allowed),Number(allowed),status,timestamp]);
        await invalidateHistoryProjections(work,id);
        if (allowed) {
          const index=await indexState(work);
          await queueDocument(work,id,version,generation,index.active);
          if(index.rebuilding!==null)await queueDocument(work,id,version,generation,index.rebuilding);
        }
        return {sourceId:id,ref:{...ref,sourceVersion:version},revision,generation,allowed,status};
      });
    },
  };
}
