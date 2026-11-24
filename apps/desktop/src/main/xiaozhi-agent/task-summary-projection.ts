import {setTimeout as delay} from 'node:timers/promises';
import type sqlite3 from 'sqlite3';
import {workbenchTaskGroup,type WorkbenchApprovalRow,type WorkbenchTaskRow} from '../../shared/xiaozhi-workbench';
import {publishBackground,type BackupPublicationBarrier} from '../backup/publication-barrier';
import {sqliteExec} from '../sqlite-connections';
import type {Sql} from './session-state';
import {taskDocumentPrefix,taskPrefix,taskSummaryObjects,taskSummaryPrefix,taskSummarySchema} from './task-summary-schema';
import {readWorkbenchApprovals} from './workbench-approvals';
import {workbenchFailure,workbenchText,type WorkbenchRead} from './workbench-state';
import {readWorkbenchTasks} from './workbench-tasks';

const control=taskSummaryPrefix+'control';
const rows=taskSummaryPrefix+'rows';
const dirty=taskSummaryPrefix+'dirty';
const sessions=taskSummaryPrefix+'dirty_sessions';
const failures=taskSummaryPrefix+'failures';
const owners=taskSummaryPrefix+'owners';
const dependencies=taskSummaryPrefix+'dependencies';
const batchSize=40;

export function blockedTask(task: WorkbenchTaskRow) {
  return !['completed','ended'].includes(task.state) &&
    (task.state==='paused' || task.state==='interrupted' || task.pendingApprovalCount!==0 || task.unknownEffectCount!==0 ||
      task.blockedReasons.some(reason=>['not_latest','goal_controls','needs_new_candidate'].includes(reason)));
}

export async function ensureTaskSummarySchema(db: sqlite3.Database) {
  const existing=await new Promise<string[]>((resolve,reject)=>db.all<{name:string}>(
    "SELECT name FROM sqlite_schema WHERE name GLOB 'xiaozhi_task_summary_*'",(error,items)=>
      error?reject(error):resolve(items.map(item=>item.name))));
  const expected=Object.values(taskSummaryObjects).flat();
  if(expected.every(name=>existing.includes(name))) return;
  await sqliteExec(db,'BEGIN IMMEDIATE');
  try {
    const remove=[
      ...taskSummaryObjects.triggers.map(name=>'DROP TRIGGER IF EXISTS '+name+';'),
      ...taskSummaryObjects.indexes.map(name=>'DROP INDEX IF EXISTS '+name+';'),
      ...taskSummaryObjects.tables.map(name=>'DROP TABLE IF EXISTS '+name+';'),
    ].join('\n');
    await sqliteExec(db,remove);
    await sqliteExec(db,taskSummarySchema);
    await sqliteExec(db,'COMMIT');
  } catch(error) {
    await sqliteExec(db,'ROLLBACK').catch(()=>undefined);
    throw error;
  }
}

type SourceData = {read:WorkbenchRead;approvals:WorkbenchApprovalRow[]};
type Sources = Map<string,SourceData>;
export class TaskSummaryProjection {
  private pumping?:Promise<void>;
  private stopped=true;
  private timer?:ReturnType<typeof setTimeout>;
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
        this.schedule(more?0:500);
      });
      if(!operation){this.schedule(200);return;}
      this.pumping=operation.finally(()=>{this.pumping=undefined;});
    },ms);
    this.timer.unref();
  }

  private async advance() {
    const need=await this.state.all(`SELECT id FROM ${control} WHERE phase='rebuilding'
      OR EXISTS(SELECT 1 FROM ${dirty}) OR EXISTS(SELECT 1 FROM ${sessions})
      OR projected_rows<>(SELECT COUNT(*) FROM ${rows})`);
    if(!need.length)return false;
    if(!this.state.transaction)throw Error('task_summary_unavailable');
    return this.state.transaction(async sql=>{
      const [clock]=await sql.all(`SELECT * FROM ${control} WHERE id=1`);
      if(!clock)throw Error('task_summary_unavailable');
      const [count]=await sql.all(`SELECT COUNT(*) AS n FROM ${rows}`);
      if(count.n!==clock.projected_rows){
        await this.reset(sql);
        return true;
      }
      const tables=new Set((await sql.all("SELECT name FROM sqlite_schema WHERE type='table'")).map(row=>String(row.name)));
      const cache:Sources=new Map();
      if(clock.phase==='rebuilding'){
        const selected=await sql.all(
          'SELECT key,value_json FROM app_settings WHERE key>? AND key GLOB ? AND length(key)=? ORDER BY key LIMIT ?',
          [String(clock.cursor),taskDocumentPrefix+'*',taskDocumentPrefix.length+64,batchSize],
        );
        for(const row of selected) await this.project(sql,String(row.key).slice(taskPrefix.length),row,cache,tables);
        if(selected.length===batchSize) await sql.run(`UPDATE ${control} SET cursor=? WHERE id=1`,[String(selected.at(-1)!.key)]);
        else await sql.run(`UPDATE ${control} SET phase='ready', cursor='' WHERE id=1`);
        await this.count(sql);
        return true;
      }
      const selected=await sql.all(`SELECT task_id FROM ${dirty} ORDER BY task_id LIMIT ?`,[batchSize]);
      if(selected.length){
        for(const {task_id} of selected){
          const id=String(task_id);
          const [row]=await sql.all('SELECT key,value_json FROM app_settings WHERE key=?',[taskPrefix+id]);
          await this.project(sql,id,row,cache,tables);
          await sql.run(`DELETE FROM ${dirty} WHERE task_id=?`,[id]);
        }
      }else{
        const [pending]=await sql.all(`SELECT session_id,after_task FROM ${sessions} ORDER BY session_id LIMIT 1`);
        if(!pending)return false;
        const session=String(pending.session_id);
        const chunk=await sql.all(`SELECT task_id FROM ${owners} WHERE session_id=? AND task_id>? ORDER BY task_id LIMIT ?`,
          [session,String(pending.after_task),batchSize]);
        for(const {task_id} of chunk){
          const id=String(task_id);
          const [row]=await sql.all('SELECT key,value_json FROM app_settings WHERE key=?',[taskPrefix+id]);
          await this.project(sql,id,row,cache,tables);
        }
        if(chunk.length===batchSize)await sql.run(`UPDATE ${sessions} SET after_task=? WHERE session_id=?`,[String(chunk.at(-1)!.task_id),session]);
        else await sql.run(`DELETE FROM ${sessions} WHERE session_id=?`,[session]);
      }
      await this.count(sql);
      return true;
    });
  }

  private async reset(sql: Sql) {
    await sql.run(`DELETE FROM ${rows}`);
    await sql.run(`DELETE FROM ${failures}`);
    await sql.run(`DELETE FROM ${dependencies}`);
    await sql.run(`DELETE FROM ${owners}`);
    await sql.run(`UPDATE ${control} SET epoch=lower(hex(randomblob(16))),generation=generation+1,
      phase='rebuilding',cursor='',projected_rows=0 WHERE id=1`);
  }
  private count(sql: Sql) {
    return sql.run(`UPDATE ${control} SET projected_rows=(SELECT COUNT(*) FROM ${rows}) WHERE id=1`);
  }

  private async project(sql:Sql,id:string,row:Record<string,unknown>|undefined,cache:Sources,tables:Set<string>) {
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
    let source=cache.get(owner);
    if(!source){
      const [session]=await sql.all('SELECT id,title FROM ai_conversation_sessions WHERE id=?',[owner]);
      const read:WorkbenchRead={sql,now:new Date().toISOString(),tables,
        sessions:new Map([[owner,{id:owner,title:workbenchText(session?.title)}]]),failures:[],unavailable:0};
      if(session && typeof session.title!=='string')workbenchFailure(read,'sessions','corrupt');
      source={read,approvals:await readWorkbenchApprovals(read,owner)};
      cache.set(owner,source);
    }
    const read:WorkbenchRead={...source.read,failures:source.read.failures.map(item=>({...item}))};
    const [task]=await readWorkbenchTasks(read,source.approvals,[row]);
    if(task){
      await sql.run(`INSERT INTO ${rows} VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT(task_id) DO UPDATE SET session_id=excluded.session_id,revision=excluded.revision,
          updated_at=excluded.updated_at,state=excluded.state,task_group=excluded.task_group,
          resumable=excluded.resumable,blocked=excluded.blocked,row_json=excluded.row_json`,
        [task.taskId,task.sessionId,task.revision,task.updatedAt,task.state,workbenchTaskGroup(task.state),
          Number(task.resumeCandidate || task.continuationCandidate),Number(blockedTask(task)),JSON.stringify(task)]);
    }else{
      await sql.run(`DELETE FROM ${rows} WHERE task_id=?`,[id]);
    }
    for(const failed of read.failures)await sql.run(`INSERT INTO ${failures} VALUES(?,?,?,?)`,
      [id,failed.source,failed.code,failed.records]);
  }
}
