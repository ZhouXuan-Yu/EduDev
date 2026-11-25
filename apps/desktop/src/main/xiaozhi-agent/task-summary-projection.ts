import {setTimeout as delay} from 'node:timers/promises';
import type sqlite3 from 'sqlite3';
import {workbenchTaskGroup,type WorkbenchSourceFailure} from '../../shared/xiaozhi-workbench';
import {publishBackground,type BackupPublicationBarrier} from '../backup/publication-barrier';
import {sqliteExec} from '../sqlite-connections';
import type {Sql} from './session-state';
import {taskDocumentPrefix,taskPrefix,taskSummaryObjects,taskSummaryPrefix,taskSummarySchema} from './task-summary-schema';
import {readWorkbenchTaskApprovals,type TaskApprovalIdentity} from './workbench-approvals';
import {workbenchText,type WorkbenchRead} from './workbench-state';
import {readWorkbenchTasks} from './workbench-tasks';
import {taskSummaryRowColumns,validatedTaskSummaryRow} from './task-summary-read';
import {taskSummaryRowBlocked} from './task-summary-row';
import {taskSummaryMaintenanceObjects,taskSummaryMaintenanceV6,taskSummaryRowCountTable as rowCount} from './task-summary-maintenance-v6';

const control=taskSummaryPrefix+'control';
const rows=taskSummaryPrefix+'rows';
const dirty=taskSummaryPrefix+'dirty';
const sessions=taskSummaryPrefix+'dirty_sessions';
const failures=taskSummaryPrefix+'failures';
const owners=taskSummaryPrefix+'owners';
const dependencies=taskSummaryPrefix+'dependencies';
const batchSize=40;
const maxWriteBatchMs=100;
const yieldBetweenBatchesMs=15;

const currentSchema=taskSummarySchema+'\n'+taskSummaryMaintenanceV6;
// SQLite removes IF NOT EXISTS and the trailing semicolon. The last published
// definition of a name is the one expected on disk.
const definitions=(schema:string)=>new Map([...schema.matchAll(
  /^CREATE (TABLE|INDEX|TRIGGER) (?:IF NOT EXISTS )?(\w+)[\s\S]*?(?=^(?:CREATE |INSERT |DROP )|$(?![\s\S]))/gmu,
)].map(([definition,type,name])=>[name,{type:type.toLowerCase(),sql:definition.trimEnd().replace(/;$/u,'').replace(' IF NOT EXISTS ',' ')}]));
const v2Definitions=definitions(taskSummarySchema),currentDefinitions=definitions(currentSchema);

export async function ensureTaskSummarySchema(db: sqlite3.Database, options?:{beforeV6:true}) {
  type Definition={name:string;type:string;sql:string};
  const existing=await new Promise<Definition[]>((resolve,reject)=>db.all<Definition>(
    "SELECT name,type,sql FROM sqlite_schema WHERE name GLOB 'xiaozhi_task_summary_*'",(error,items)=>
      error?reject(error):resolve(items)));
  const expectedDefinitions=options?.beforeV6?v2Definitions:currentDefinitions;
  if([...expectedDefinitions].every(([name,expected])=>existing.some(actual=>
    actual.name===name && actual.type===expected.type && actual.sql===expected.sql)))return;
  if(!options?.beforeV6)await sqliteExec(db,'BEGIN IMMEDIATE');
  try {
    const remove=[
      ...taskSummaryObjects.triggers.map(name=>'DROP TRIGGER IF EXISTS '+name+';'),
      ...taskSummaryMaintenanceObjects.triggers.map(name=>'DROP TRIGGER IF EXISTS '+name+';'),
      ...taskSummaryObjects.indexes.map(name=>'DROP INDEX IF EXISTS '+name+';'),
      ...taskSummaryObjects.tables.map(name=>'DROP TABLE IF EXISTS '+name+';'),
      ...taskSummaryMaintenanceObjects.tables.map(name=>'DROP TABLE IF EXISTS '+name+';'),
    ].join('\n');
    await sqliteExec(db,remove);
    await sqliteExec(db,options?.beforeV6?taskSummarySchema:currentSchema);
    if(!options?.beforeV6)await sqliteExec(db,'COMMIT');
  } catch(error) {
    if(!options?.beforeV6)await sqliteExec(db,'ROLLBACK').catch(()=>undefined);
    throw error;
  }
}

type SourceData={title:string;approvals:TaskApprovalIdentity[];failures:WorkbenchSourceFailure[];unavailable:number};
export class TaskSummaryProjection {
  private pumping?:Promise<void>;
  private stopped=true;
  private timer?:ReturnType<typeof setTimeout>;
  private sourceIdentity?:string;
  private readonly sourceCache=new Map<string,SourceData>();
  constructor(private readonly state:Sql, private readonly publications:BackupPublicationBarrier) {}

  start() {
    if (!this.stopped) return;
    this.stopped=false;
    this.schedule(0);
  }
  async close() {
    this.stopped=true;
    if(this.timer)clearTimeout(this.timer);
    this.timer=undefined;
    await this.pumping;
    this.sourceCache.clear();
  }
  async repairRows(ids:string[]) {
    if(!ids.length || !this.state.transaction)return;
    await this.state.transaction(async sql=>{
      const current=await sql.all(`SELECT ${taskSummaryRowColumns} FROM ${rows} r WHERE r.task_id IN (${ids.map(()=>'?').join(',')})`,ids);
      for(const row of current){
        if(validatedTaskSummaryRow(row))continue;
        await sql.run(`INSERT OR IGNORE INTO ${dirty}(task_id) VALUES(?)`,[String(row.task_id)]);
        await sql.run(`UPDATE ${control} SET generation=generation+1 WHERE id=1 AND changes()=1`);
      }
    });
  }
  private schedule(ms:number) {
    if(this.stopped)return;
    this.timer=setTimeout(()=>{
      this.timer=undefined;
      const operation=publishBackground(this.publications,async()=>{
        let more=false;
        try {more=await this.advance();}
        catch {
          // Durable dirty state still makes the user-facing projection partial.
          await delay(500);
        }
        this.schedule(more?yieldBetweenBatchesMs:500);
      });
      if(!operation){this.schedule(200);return;}
      this.pumping=operation.finally(()=>{this.pumping=undefined;});
    },ms);
    this.timer.unref();
  }

  private async advance() {
    const need=await this.state.all(`SELECT id FROM ${control} WHERE phase='rebuilding'
      OR EXISTS(SELECT 1 FROM ${dirty}) OR EXISTS(SELECT 1 FROM ${sessions})
      OR projected_rows<>COALESCE((SELECT actual_rows FROM ${rowCount} WHERE id=1),-1)`);
    if(!need.length)return false;
    if(!this.state.transaction)throw Error('task_summary_unavailable');
    return this.state.transaction(async sql=>{
      const deadline=performance.now()+maxWriteBatchMs;
      const [clock]=await sql.all(`SELECT * FROM ${control} WHERE id=1`);
      if(!clock)throw Error('task_summary_unavailable');
      const [count]=await sql.all(`SELECT actual_rows FROM ${rowCount} WHERE id=1`);
      if(count?.actual_rows!==clock.projected_rows){
        await this.reset(sql);
        return true;
      }
      const tables=new Set((await sql.all("SELECT name FROM sqlite_schema WHERE type='table'")).map(row=>String(row.name)));
      // Every source mutation updates the durable generation. Reuse validated
      // identities within the same generation without retaining a SQLite handle.
      const identity=String(clock.epoch)+':'+String(clock.generation);
      if(identity!==this.sourceIdentity){this.sourceIdentity=identity;this.sourceCache.clear();}
      if(clock.phase==='rebuilding'){
        const selected=await sql.all(
          'SELECT key,value_json FROM app_settings WHERE key>? AND key GLOB ? AND length(key)=? ORDER BY key LIMIT ?',
          [String(clock.cursor),taskDocumentPrefix+'*',taskDocumentPrefix.length+64,batchSize],
        );
        let completed=0;
        for(const row of selected){
          await this.project(sql,String(row.key).slice(taskPrefix.length),row,tables);
          completed++;
          if(performance.now()>=deadline)break;
        }
        if(selected.length===batchSize || completed<selected.length)
          await sql.run(`UPDATE ${control} SET cursor=? WHERE id=1`,[String(selected[completed-1].key)]);
        else await sql.run(`UPDATE ${control} SET phase='ready', cursor='' WHERE id=1`);
        await this.count(sql);
        return true;
      }
      const selected=await sql.all(`SELECT task_id FROM ${dirty} ORDER BY task_id LIMIT ?`,[batchSize]);
      if(selected.length){
        for(const {task_id} of selected){
          const id=String(task_id);
          const [row]=await sql.all('SELECT key,value_json FROM app_settings WHERE key=?',[taskPrefix+id]);
          await this.project(sql,id,row,tables);
          await sql.run(`DELETE FROM ${dirty} WHERE task_id=?`,[id]);
          if(performance.now()>=deadline)break;
        }
      }else{
        const [pending]=await sql.all(`SELECT session_id,after_task FROM ${sessions} ORDER BY session_id LIMIT 1`);
        if(!pending)return false;
        const session=String(pending.session_id);
        const chunk=await sql.all(`SELECT task_id FROM ${owners} WHERE session_id=? AND task_id>? ORDER BY task_id LIMIT ?`,
          [session,String(pending.after_task),batchSize]);
        let completed=0;
        for(const {task_id} of chunk){
          const id=String(task_id);
          const [row]=await sql.all('SELECT key,value_json FROM app_settings WHERE key=?',[taskPrefix+id]);
          await this.project(sql,id,row,tables);
          completed++;
          if(performance.now()>=deadline)break;
        }
        if(chunk.length===batchSize || completed<chunk.length)
          await sql.run(`UPDATE ${sessions} SET after_task=? WHERE session_id=?`,[String(chunk[completed-1].task_id),session]);
        else await sql.run(`DELETE FROM ${sessions} WHERE session_id=?`,[session]);
      }
      await this.count(sql);
      return true;
    });
  }

  private async reset(sql: Sql) {
    // Explicit repair reconciles a missing or corrupt counter before delete triggers run.
    await sql.run(`INSERT INTO ${rowCount} SELECT 1,COUNT(*) FROM ${rows} WHERE true
      ON CONFLICT(id) DO UPDATE SET actual_rows=excluded.actual_rows`);
    await sql.run(`DELETE FROM ${rows}`);
    await sql.run(`DELETE FROM ${failures}`);
    await sql.run(`DELETE FROM ${dependencies}`);
    await sql.run(`DELETE FROM ${owners}`);
    await sql.run(`UPDATE ${control} SET epoch=lower(hex(randomblob(16))),generation=generation+1,
      phase='rebuilding',cursor='',projected_rows=0 WHERE id=1`);
  }
  private count(sql: Sql) {
    return sql.run(`UPDATE ${control} SET projected_rows=(SELECT actual_rows FROM ${rowCount} WHERE id=1) WHERE id=1`);
  }

  private async project(sql:Sql,id:string,row:Record<string,unknown>|undefined,tables:Set<string>) {
    await sql.run(`DELETE FROM ${failures} WHERE task_id=?`,[id]);
    await sql.run(`DELETE FROM ${dependencies} WHERE task_id=?`,[id]);
    if(!row){
      await sql.run(`DELETE FROM ${rows} WHERE task_id=?`,[id]);
      await sql.run(`DELETE FROM ${owners} WHERE task_id=?`,[id]);
      return;
    }
    let view:{sessionId?:unknown;checks?:unknown}|undefined;
    try {view=JSON.parse(String(row.value_json))?.view;} catch { /* Invalid authority is recorded below. */ }
    const owner=view?.sessionId;
    if (typeof owner!=='string' || !owner) {
      await sql.run(`DELETE FROM ${rows} WHERE task_id=?`,[id]);
      await sql.run(`INSERT INTO ${failures} VALUES(?, 'tasks', 'corrupt', 1)`,[id]);
      return;
    }
    await sql.run(`INSERT INTO ${owners} VALUES(?,?) ON CONFLICT(task_id) DO UPDATE SET session_id=excluded.session_id`,[id,owner]);
    if(Array.isArray(view?.checks)){
      for(const check of view.checks.slice(0,32)){
        if(check?.authority!=='teacher')continue;
        for(const [kind,ref] of [['action',check.confirmationId],['message',check.candidate?.messageId],['run',check.runId]]){
          if(typeof ref==='string' && ref.length<=160){
            await sql.run(`INSERT OR IGNORE INTO ${dependencies} VALUES(?,?,?)`,[id,kind,ref]);
          }
        }
      }
    }
    let source=this.sourceCache.get(owner);
    const now=new Date().toISOString();
    if(!source){
      const [session]=await sql.all('SELECT id,title FROM ai_conversation_sessions WHERE id=?',[owner]);
      const title=workbenchText(session?.title);
      const read:WorkbenchRead={sql,now,tables,sessions:new Map([[owner,{id:owner,title}]]),failures:[],unavailable:0};
      const approvals=await readWorkbenchTaskApprovals(read,owner);
      source={title,approvals,failures:read.failures,unavailable:read.unavailable};
      if(!source.failures.length){
        if(this.sourceCache.size>=64)this.sourceCache.clear();
        this.sourceCache.set(owner,source);
      }
    }
    const read:WorkbenchRead={sql,now,tables,sessions:new Map([[owner,{id:owner,title:source.title}]]),
      failures:source.failures.map(item=>({...item})),unavailable:source.unavailable};
    const [task]=await readWorkbenchTasks(read,source.approvals,[row]);
    if(task){
      await sql.run(`INSERT INTO ${rows} VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT(task_id) DO UPDATE SET session_id=excluded.session_id,revision=excluded.revision,
          updated_at=excluded.updated_at,state=excluded.state,task_group=excluded.task_group,
          resumable=excluded.resumable,blocked=excluded.blocked,row_json=excluded.row_json`,
        [task.taskId,task.sessionId,task.revision,task.updatedAt,task.state,workbenchTaskGroup(task.state),
          Number(task.resumeCandidate || task.continuationCandidate),taskSummaryRowBlocked(task),JSON.stringify(task)]);
    }else{
      await sql.run(`DELETE FROM ${rows} WHERE task_id=?`,[id]);
    }
    for(const failed of read.failures)await sql.run(`INSERT INTO ${failures} VALUES(?,?,?,?)`,
      [id,failed.source,failed.code,failed.records]);
  }
}
