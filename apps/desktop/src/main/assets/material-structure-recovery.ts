import type {MaterialStructureRecoveryAction,MaterialStructureRecoveryState,MaterialStructureRecoveryView} from '../../shared/material-import-batch';
import {MATERIAL_STRUCTURE_EXTENSIONS,type MaterialStructureRepository} from './material-structure-repository';
import type {MaterialParseQueue} from './material-parse-queue';

type Value=string|number|null;
type Row=Record<string,unknown>;
type Host={
  all:(sql:string,values?:Value[])=>Promise<Row[]>;
  run:(sql:string,values?:Value[])=>Promise<void>;
  structures:()=>MaterialStructureRepository;
  queue:()=>MaterialParseQueue;
  writer:<T>(action:(target:MaterialStructureRecovery)=>Promise<T>)=>Promise<T>;
};

const windowSize=4;
const supportedFiles=`FROM material_import_entries e JOIN teacher_resources r ON r.id=e.resource_id
  WHERE e.batch_id=? AND e.kind='file' AND e.status='saved'
  AND (${MATERIAL_STRUCTURE_EXTENSIONS.map(extension=>`lower(r.original_file_name) LIKE '%${extension}'`).join(' OR ')})`;

const liveClaim=`EXISTS(SELECT 1 FROM material_structure_jobs j JOIN ai_tasks t
  ON t.id=json_extract(CASE WHEN json_valid(j.lease) THEN j.lease ELSE '{}' END,'$.taskId')
  WHERE j.resource_id=s.resource_id AND j.version=s.version AND j.status='running'
    AND t.task_type='resource_parse' AND t.status='running'
    AND t.payload_json=json_extract(CASE WHEN json_valid(j.lease) THEN j.lease ELSE '{}' END,'$.payload'))`;
export const structureRecoveryFileState=`CASE WHEN s.state='active' THEN CASE WHEN ${liveClaim} THEN 'running' ELSE 'pending' END ELSE s.state END`;
const allowedErrors=['source_changed','missing','unsupported','cancelled','disk_full','configuration','timeout'];
function errorCode(error:unknown) {
  const code=error instanceof Error?error.message:String(error??'');
  return code==='material_not_found'?'missing':allowedErrors.includes(code)?code:'parse_failed';
}
export function structureRecoveryFailure(code:string) {
  const messages:Record<string,string>={
    source_changed:'原件或版本已变化，请打开资料核对。',
    missing:'归档原件不可用，请打开资料检查文件。',
    unsupported:'当前资料格式无法恢复文档结构。',
    cancelled:'本地解析已停止，可重试此项。',
    disk_full:'磁盘空间不足，已保存的结果仍可使用。',
    configuration:'本地解析组件尚不可用，请检查组件后重试。',
    timeout:'本地结构恢复超时，可重试此项。',
  };
  return messages[code]??'本地结构恢复未完成，请打开资料检查原件与解析组件。';
}

/** Coordinates directory intents. Resource parsing and publication stay in the existing queue. */
export class MaterialStructureRecovery {
  private timer?:ReturnType<typeof setInterval>;
  private pumping?:Promise<void>;
  private closing=false;

  constructor(private readonly host:Host) {}

  async migrate(){
    await this.host.run(`CREATE TABLE IF NOT EXISTS material_structure_recovery_batches(
      batch_id TEXT PRIMARY KEY REFERENCES material_import_batches(id),enabled INTEGER NOT NULL CHECK(enabled IN (0,1)))`);
    await this.host.run(`CREATE TABLE IF NOT EXISTS material_structure_recovery_items(
      batch_id TEXT NOT NULL REFERENCES material_structure_recovery_batches(batch_id),resource_id TEXT NOT NULL,version TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('pending','active','complete','partial','failed')),generation TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',PRIMARY KEY(batch_id,resource_id))`);
    await this.host.run('CREATE INDEX IF NOT EXISTS material_structure_recovery_work ON material_structure_recovery_items(state,batch_id)');
  }

  start(){
    if(this.timer)return;
    this.closing=false;
    this.timer=setInterval(()=>this.wake(),650);
    this.timer.unref();
    this.wake();
  }

  async close(){
    this.closing=true;
    if(this.timer)clearInterval(this.timer);
    this.timer=undefined;
    await this.pumping;
  }

  pauseAll(){
    return this.host.run('UPDATE material_structure_recovery_batches SET enabled=0 WHERE enabled=1');
  }

  private wake(){
    if(!this.timer||this.closing||this.pumping)return;
    this.pumping=this.tick().catch(()=>undefined).finally(()=>{this.pumping=undefined;});
  }

  async action(batchId:string,action:MaterialStructureRecoveryAction){
    await this.host.writer(async target=>{
      if(action==='structure_start'){
        // Include only saved managed originals. Repeated starts can append late arrivals.
        await target.host.run('INSERT OR IGNORE INTO material_structure_recovery_batches(batch_id,enabled) VALUES(?,1)',[batchId]);
        await target.host.run(`INSERT OR IGNORE INTO material_structure_recovery_items(batch_id,resource_id,version,state)
          SELECT DISTINCT e.batch_id,r.id,r.content_hash,'pending' ${supportedFiles}`,[batchId]);
        if(!(await target.host.all('SELECT 1 FROM material_structure_recovery_items WHERE batch_id=? LIMIT 1',[batchId])).length)
          throw Error('unsupported');
        return;
      }
      if(!(await target.host.all('SELECT 1 FROM material_structure_recovery_batches WHERE batch_id=?',[batchId])).length)
        throw Error('invalid_input');
      if(action==='structure_retry'){
        await target.host.run(`UPDATE material_structure_recovery_items SET state='pending',error=''
          WHERE batch_id=? AND state='failed'`,[batchId]);
      }
      await target.host.run('UPDATE material_structure_recovery_batches SET enabled=? WHERE batch_id=?',
        [action==='structure_pause'?0:1,batchId]);
    });
    this.wake();
  }

  async available(batchId:string){
    const [row]=await this.host.all(`SELECT COUNT(DISTINCT r.id) n ${supportedFiles}`,[batchId]);
    return Number(row.n);
  }

  async view(batchId:string):Promise<MaterialStructureRecoveryView|undefined>{
    const [row]=await this.host.all(`SELECT b.enabled,COUNT(s.resource_id) total,
      SUM(s.state='pending') pending,SUM(s.state='active') active,
      SUM(CASE WHEN s.state='active' AND ${liveClaim} THEN 1 ELSE 0 END) running,
      SUM(s.state='complete') complete,SUM(s.state='partial') partial,SUM(s.state='failed') failed
      FROM material_structure_recovery_batches b JOIN material_structure_recovery_items s USING(batch_id)
      WHERE b.batch_id=? GROUP BY b.batch_id`,[batchId]);
    if(!row)return;
    const {total,pending,active,running,complete,partial,failed}={
      total:Number(row.total),pending:Number(row.pending),active:Number(row.active),running:Number(row.running),
      complete:Number(row.complete),partial:Number(row.partial),failed:Number(row.failed),
    };
    const state=pending+active>0?(row.enabled===1?'running':'paused'):partial+failed>0?'attention':'complete';
    return {state,total,pending:pending+active-running,running,complete,partial,failed};
  }

  /** Exposed for deterministic tests. Only the scheduler invokes this in production. */
  async tick(){
    const active=await this.host.all("SELECT * FROM material_structure_recovery_items WHERE state='active' LIMIT ?",[windowSize]);
    for(const row of active){
      if(this.closing)return;
      await this.host.writer(target=>target.reconcile(row));
    }
    if(this.closing)return;
    const pending=await this.host.all(`SELECT s.* FROM material_structure_recovery_items s
      JOIN material_structure_recovery_batches b USING(batch_id) WHERE s.state='pending' AND b.enabled=1
      ORDER BY s.rowid LIMIT ?`,[windowSize]);
    for(const row of pending){
      if(this.closing)return;
      try{await this.host.writer(target=>target.admit(row));}
      catch(error){
        if(['busy','material_task_conflict','material_busy'].includes((error as Error)?.message))continue;
        if(!['source_changed','material_not_found','unsupported','invalid_task','material_task_missing'].includes((error as Error)?.message))throw error;
        await this.host.writer(target=>target.update(row,'pending','failed',errorCode(error)));
      }
    }
  }

  private async admit(row:Row){
    const keys=[String(row.batch_id),String(row.resource_id),String(row.version)];
    const [intent]=await this.host.all(`SELECT 1 FROM material_structure_recovery_items s
      JOIN material_structure_recovery_batches b USING(batch_id) WHERE s.batch_id=? AND s.resource_id=? AND s.version=?
      AND s.state='pending' AND b.enabled=1 AND
      (SELECT COUNT(*) FROM material_structure_recovery_items WHERE state='active')<?`,[...keys,windowSize]);
    if(!intent)return;
    const [,id,version]=keys;
    const job=await this.host.structures().prepareFolderRecovery(id,version);
    if(job.state==='pending'){
      const status=await this.host.queue().state(id,version);
      if(status!=='pending'&&status!=='running')await this.host.queue().enqueue(id,version,0,true);
    }
    await this.update(row,'pending',job.state==='pending'?'active':job.state,'',job.generation);
  }

  private async reconcile(row:Row){
    const id=String(row.resource_id),version=String(row.version);
    const [resource]=await this.host.all('SELECT content_hash FROM teacher_resources WHERE id=?',[id]);
    if(!resource||resource.content_hash!==version){
      await this.update(row,'active','failed','source_changed');
      return;
    }
    const [job]=await this.host.all('SELECT generation,version,status,error FROM material_structure_jobs WHERE resource_id=?',[id]);
    if(job?.version===version&&(job.status==='complete'||job.status==='partial')){
      await this.update(row,'active',job.status,'',String(job.generation));
      return;
    }
    const status=await this.host.queue().state(id,version);
    if(status==='pending'||status==='running')return;
    if(job?.version===version&&job.generation!==row.generation&&job.status==='pending'){
      // A manual rebuild superseded this intent. Repair its missing queue link on the next admission.
      await this.update(row,'active','pending','',String(job.generation));
      return;
    }
    await this.update(row,'active','failed',errorCode(job?.error||status),String(job?.generation??row.generation));
  }

  private update(row:Row,from:'pending'|'active',next:Exclude<MaterialStructureRecoveryState,'running'>|'active',
    error:string,generation=String(row.generation)){
    return this.host.run(`UPDATE material_structure_recovery_items SET state=?,error=?,generation=?
      WHERE batch_id=? AND resource_id=? AND version=? AND state=?`,
      [next,error,generation,String(row.batch_id),String(row.resource_id),String(row.version),from]);
  }
}
