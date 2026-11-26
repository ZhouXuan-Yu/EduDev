import {createHash} from 'node:crypto';
import path from 'node:path';
import {inspectBackupDatabaseVersion,MAX_DATABASE_SCHEMA_VERSION} from '../database-migrations';
import {closeSqlite,openSqlite,sqliteExec} from '../sqlite-connections';
import {invalidateHistoryProjections} from '../xiaozhi-agent/history/state';
import {readHistorySource,validHistoryRef} from '../xiaozhi-agent/history/source';
import type {Sql} from '../xiaozhi-agent/session-state';
import {readTeacherMemoryPolicy,TEACHER_MEMORY_POLICY_KEY} from '../education/teacher-memory-policy';
import {createTeacherPreferenceState} from '../education/teacher-preference-state';

type Row=Record<string,unknown>;
const historyTable='memory_source_access';
const grantsTable='personal_memory_extract_grants';
const recordsTable='personal_memory_records';
const scopeTable='xiaozhi_pi_memory_scopes';
const scopeQuery=`SELECT p.conversation_id,p.version,p.schema_version,p.payload_json,COALESCE(s.archived_at,'') AS archived_at
  FROM xiaozhi_pi_memory_scopes p JOIN ai_conversation_sessions s ON s.id=p.conversation_id ORDER BY p.conversation_id`;
const preferencesQuery=`SELECT key,value_json FROM app_settings WHERE key IN ('xiaozhi.teacher-preference.v1:head', '${TEACHER_MEMORY_POLICY_KEY}') ORDER BY key`;
const historyQuery=`SELECT source_id,kind,session_id,record_id,source_version,access_revision,generation,
  index_allowed,discover_allowed,memory_state FROM memory_source_access ORDER BY source_id`;
const grantsQuery=`SELECT source_id,source_version,history_generation,grant_revision,extract_allowed,scope_kind,scope_id,term
  FROM personal_memory_extract_grants ORDER BY source_id`;
const recordsQuery=`SELECT r.memory_id,v.revision,v.state,v.draft_key,v.value
  FROM personal_memory_records r JOIN personal_memory_versions v ON v.memory_id=r.memory_id AND v.revision=r.current_revision
  ORDER BY r.memory_id`;
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same=(left:Row,right:Row|undefined)=>!!right&&digest(left)===digest(right);
type Ledger={hash:string;history:Map<string,Row>;grants:Map<string,Row>;records:Map<string,Row>;
  scopes:Map<string,Row>;preferences:string};
const by=(rows:Row[],key:string)=>new Map(rows.map(row=>[String(row[key]),row]));

async function currentSource(sql:Sql,row:Row|undefined,version:unknown) {
  const ref={kind:row?.kind,sessionId:row?.session_id,recordId:row?.record_id,sourceVersion:version};
  if (!validHistoryRef(ref)) return false;
  try {await readHistorySource(sql,ref);return true;}
  catch(error) {
    if (error instanceof Error && ['source_unavailable','source_changed'].includes(error.message)) return false;
    throw error;
  }
}

/** Read a consistent comparison ledger from the live, managed SQLite file. */
export async function readMemoryRestoreLedger(root:string):Promise<Ledger|null> {
  let db:Awaited<ReturnType<typeof openSqlite>>|undefined;
  try {
    db=await openSqlite(path.join(root,'app.db'),'liveRead');
    await sqliteExec(db,'BEGIN;');
    const version=await inspectBackupDatabaseVersion(db);
    if (version===0 || version>MAX_DATABASE_SCHEMA_VERSION) return null;
    const opened=db;
    const all=(query:string,values:unknown[]=[])=>new Promise<Row[]>((resolve,reject)=>
      opened.all<Row>(query,values,(error,rows)=>error?reject(error):resolve(rows)));
    const sql:Sql={all,run:async()=>{throw Error('read_only_transaction');}};
    const tables=new Set((await all("SELECT name FROM sqlite_schema WHERE type='table'")).map(row=>row.name));
    const history=tables.has(historyTable)?await all(historyQuery):[];
    const grants=tables.has(grantsTable)?await all(grantsQuery):[];
    const historyBySource=by(history,'source_id');
    for (const row of history) {
      if (row.memory_state==='active' && !await currentSource(sql,row,row.source_version)) row.unavailable=true;
    }
    for (const row of grants) {
      if (row.extract_allowed===1 && !await currentSource(sql,historyBySource.get(String(row.source_id)),row.source_version))
        row.unavailable=true;
    }
    // The comparison needs a content fingerprint and never copies a live record.
    const records=tables.has(recordsTable)?(await all(recordsQuery)).map(record=>({...record,value:digest(record.value)})):[];
    const scopes=tables.has(scopeTable)?await all(scopeQuery):[];
    const preferences=tables.has('app_settings')?digest(await all(preferencesQuery)):digest([]);
    return {hash:digest([history,grants,records,scopes,preferences]),history:historyBySource,
      grants:by(grants,'source_id'),records:by(records,'memory_id'),scopes:by(scopes,'conversation_id'),preferences};
  } catch {
    return null;
  } finally {
    if (db) {
      await sqliteExec(db,'ROLLBACK;').catch(()=>undefined);
      await closeSqlite(db).catch(()=>undefined);
    }
  }
}

/** Runs inside the restored copy's transaction. It can remove authority but never grants it. */
export async function reconcileRestoredMemory(sql:Sql,tables:ReadonlySet<string>,ledger:Ledger|null) {
  const at=Date.now();
  let withheldHistory=0,withheldPersonal=0,withheldScopes=0,withheldPreferences=0;
  if (tables.has(historyTable)) {
    for (const row of await sql.all(historyQuery)) {
      if (row.memory_state!=='active') continue;
      const id=String(row.source_id),current=ledger?.history.get(id);
      if (same(row,current)) continue;
      const state=current?.memory_state==='forgotten'?'forgotten':'disabled';
      await sql.run(`UPDATE memory_source_access SET index_allowed=0,discover_allowed=0,
        access_revision=?,generation=?,memory_state=?,updated_at=? WHERE source_id=?`,
      [Math.max(Number(row.access_revision),Number(current?.access_revision??0))+1,
        Math.max(Number(row.generation),Number(current?.generation??0))+1,state,new Date(at).toISOString(),id]);
      await invalidateHistoryProjections(sql,id);
      withheldHistory++;
    }
  }
  if (tables.has(grantsTable)) {
    for (const row of await sql.all(grantsQuery)) {
      if (row.extract_allowed!==1 || same(row,ledger?.grants.get(String(row.source_id)))) continue;
      await sql.run(`UPDATE personal_memory_extract_grants SET extract_allowed=0,
        grant_revision=?,updated_at=? WHERE source_id=?`,[
        Math.max(Number(row.grant_revision),Number(ledger?.grants.get(String(row.source_id))?.grant_revision??0))+1,
        at,String(row.source_id)]);
      withheldPersonal++;
    }
    await sql.run(`UPDATE personal_memory_processing SET enabled=0,policy_revision=policy_revision+1,
      cancel_generation=cancel_generation+1 WHERE id=1`);
    await sql.run("UPDATE personal_memory_pending SET state='stale',revision=revision+1 WHERE state IN ('pending','conflict')");
    await sql.run(`UPDATE ai_tasks SET status='cancelled',error_message='restored_inactive'
      WHERE task_type='personal_memory' AND status IN ('pending','running')`);
  }
  if (tables.has(recordsTable)) {
    for (const row of await sql.all(recordsQuery)) {
      if (row.state==='forgotten') continue;
      const id=String(row.memory_id),current=ledger?.records.get(id);
      if (same({...row,value:digest(row.value)},current)) continue;
      const state=current?.state==='forgotten'?'forgotten':'disabled';
      if (row.state===state) continue;
      const revision=Math.max(Number(row.revision),Number(current?.revision??0))+1;
      await sql.run(`INSERT INTO personal_memory_versions(memory_id,revision,state,value,draft_key,source_occurred_at,operation,recorded_at)
        SELECT memory_id,?,?,CASE WHEN ?='forgotten' THEN '' ELSE value END,draft_key,source_occurred_at,?,?
        FROM personal_memory_versions WHERE memory_id=? AND revision=?`,
      [revision,state,state,state==='forgotten'?'forget':'disable',at,id,Number(row.revision)]);
      await sql.run('UPDATE personal_memory_records SET current_revision=? WHERE memory_id=?',[revision,id]);
      await sql.run('DELETE FROM personal_memory_catalog WHERE memory_id=?',[id]);
      await sql.run("INSERT INTO personal_memory_outbox(memory_id,revision,action) VALUES(?,?,'invalidate')",[id,revision]);
      withheldPersonal++;
    }
  }
  if (tables.has(scopeTable)) {
    for (const row of await sql.all(scopeQuery)) {
      const id=String(row.conversation_id),current=ledger?.scopes.get(id);
      const payload=JSON.parse(String(row.payload_json));
      if (same(row,current) || payload?.enabled===false && !payload.teachingTarget) continue;
      await sql.run("UPDATE xiaozhi_pi_memory_scopes SET schema_version=CASE WHEN schema_version=4 THEN 3 ELSE schema_version END,payload_json=?,version=?,updated_at=? WHERE conversation_id=?",
        [JSON.stringify({enabled:false,selections:[]}),Math.max(Number(row.version),Number(current?.version??0))+1,
          new Date(at).toISOString(),id]);
      withheldScopes++;
    }
  }
  if (tables.has('app_settings') && digest(await sql.all(preferencesQuery))!==ledger?.preferences) {
    const {snapshot}=await createTeacherPreferenceState(sql).readCurrent();
    const fields=Object.keys(snapshot.values);
    if (fields.length) {
      const {profile,revision,use}=await readTeacherMemoryPolicy(sql);
      const withheld={...use,...Object.fromEntries(fields.map(field=>[field,'off']))};
      await sql.run(`INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)
        ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`,
      [TEACHER_MEMORY_POLICY_KEY,JSON.stringify({schemaVersion:1,revision:revision+1,profile,use:withheld}),new Date(at).toISOString()]);
      withheldPreferences=fields.length;
    }
  }
  return {withheldHistory,withheldPersonal,withheldScopes,withheldPreferences};
}
