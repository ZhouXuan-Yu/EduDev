import {createHash,randomUUID} from 'node:crypto';
import type {TeacherResource} from '../../shared/contracts';
import {MATERIAL_TASK_SCHEMA,materialVersion,validMaterialTaskAction,type MaterialTaskAction,type MaterialQueueView,type MaterialTaskStatus} from '../../shared/material-parse-task';
import {materialId} from '../../shared/materials';
type Value=string|number|null;
type Row=Record<string,unknown>;
type Payload={schemaVersion:typeof MATERIAL_TASK_SCHEMA;resourceId:string;version:string;priority:0|100;attempt:number;owner:null|{pid:number;nonce:string}};
export type MaterialParseLease={taskId:string;payload:string};
type Host={all:(sql:string,values?:Value[])=>Promise<Row[]>;change:(sql:string,values:Value[])=>Promise<number>;resource:(id:string)=>Promise<TeacherResource>;ensureTask?:(resource:TeacherResource)=>Promise<void>;ingest:(id:string,signal:AbortSignal,lease:MaterialParseLease)=>Promise<TeacherResource>};
const time=()=>new Date().toISOString();
const hash=(id:string)=>createHash('sha256').update(id).digest('hex');
const readable=(r:TeacherResource)=>r.chunkCount>0&&['ready','parsed','chunked','indexed','graph_extracted'].includes(r.parseStatus);
function parse(row:Row):Payload|undefined{try{const p=JSON.parse(String(row.payload_json));if(Object.keys(p).length!==6||p.schemaVersion!==MATERIAL_TASK_SCHEMA||!materialId(p.resourceId)||row.input_hash!==hash(p.resourceId)||!materialVersion(p.version)||![0,100].includes(p.priority)||!Number.isSafeInteger(p.attempt)||p.attempt<0||p.attempt>=100000||!(p.owner===null||Object.keys(p.owner).length===2&&Number.isSafeInteger(p.owner.pid)&&p.owner.pid>0&&typeof p.owner.nonce==='string'&&/^[a-f0-9-]{36}$/.test(p.owner.nonce)))return;return p;}catch{return;}}
const alive=(pid:number)=>{try{process.kill(pid,0);return true;}catch(error){return (error as NodeJS.ErrnoException).code!=='ESRCH';}};
/** Deterministic durable consumer of the existing resource_parse rows, never an Agent. */
export class MaterialParseQueue {
 private timer?:ReturnType<typeof setInterval>;
 private started=false;private closing=false;private pumping?:Promise<void>;
 private active?:{id:string;priority:number;controller:AbortController;reason?:'preempt'|'shutdown'};
 private readonly nonce=randomUUID();
 private readonly host:Host;
 constructor(host:Host){this.host=host;}
 private rows(status?:string){return this.host.all(`SELECT t.*,r.title AS resource_title FROM ai_tasks t LEFT JOIN teacher_resources r ON r.id=json_extract(CASE WHEN json_valid(t.payload_json) THEN t.payload_json ELSE '{}' END,'$.resourceId') WHERE t.task_type='resource_parse' AND json_valid(t.payload_json) AND json_extract(t.payload_json,'$.schemaVersion')=? ${status?'AND t.status=?':''} ORDER BY CASE t.status WHEN 'running' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,json_extract(t.payload_json,'$.priority') DESC,t.created_at,t.rowid LIMIT 100`,[MATERIAL_TASK_SCHEMA,...(status?[status]:[])]);}
 private byResource(id:string){return this.host.all(`SELECT * FROM ai_tasks WHERE task_type='resource_parse' AND input_hash=? ORDER BY created_at DESC,rowid DESC LIMIT 1`,[hash(id)]);}
 private cas(row:Row,status:string,payload:Payload,error='',result:string|null=null){return this.host.change(`UPDATE ai_tasks SET status=?,payload_json=?,error_message=?,result_json=?,retry_count=?,updated_at=? WHERE id=? AND task_type='resource_parse' AND status=? AND payload_json=?`,[status,JSON.stringify(payload),error,result,payload.attempt,time(),String(row.id),String(row.status),String(row.payload_json)]);}
 private quarantine(row:Row){return this.host.change(`UPDATE ai_tasks SET status='failed',error_message='invalid_task',updated_at=? WHERE id=? AND task_type='resource_parse' AND status=? AND payload_json=?`,[time(),String(row.id),String(row.status),String(row.payload_json)]);}
 async start(){if(this.started)return;this.started=true;this.closing=false;
  // UI snapshots are bounded to 100, but recovery must visit every persisted claim.
  let cursor=0;
  for(;;){
   const rows=await this.host.all(`SELECT t.rowid AS recovery_cursor,t.* FROM ai_tasks t WHERE t.task_type='resource_parse' AND t.status='running' AND json_valid(t.payload_json) AND json_extract(t.payload_json,'$.schemaVersion')=? AND t.rowid>? ORDER BY t.rowid LIMIT 100`,[MATERIAL_TASK_SCHEMA,cursor]);
   if(!rows.length)break;
   for(const row of rows){cursor=Number(row.recovery_cursor);const p=parse(row);if(!p||!p.owner){await this.quarantine(row);continue;}if(alive(p.owner.pid))continue;await this.cas(row,'pending',{...p,owner:null},'interrupted');}
  }
  this.timer=setInterval(()=>this.wake(),500);this.timer.unref();this.wake();
 }
 wake(){if(!this.started||this.closing||this.pumping)return;this.pumping=this.pump().catch(()=>undefined).finally(()=>{this.pumping=undefined;});}
 async close(){if(this.closing)return;this.closing=true;if(this.timer)clearInterval(this.timer);if(this.active){this.active.reason='shutdown';this.active.controller.abort();}await this.pumping;this.started=false;}
 async snapshot(resourceId?:string):Promise<MaterialQueueView>{
  if(resourceId!==undefined&&!materialId(resourceId))throw new Error('invalid_input');
  const rows=await this.rows(),tasks:MaterialQueueView['tasks']=[];let invalid=0;
  if(resourceId&&!rows.some(row=>parse(row)?.resourceId===resourceId)){const row=(await this.byResource(resourceId))[0];if(row&&String(row.payload_json).includes(MATERIAL_TASK_SCHEMA)){const resource=await this.host.resource(resourceId).catch(()=>undefined);rows.push({...row,resource_title:resource?.title});}}
  const counts=await this.host.all(`SELECT status,COUNT(*) AS n FROM ai_tasks WHERE task_type='resource_parse' AND json_valid(payload_json) AND json_extract(payload_json,'$.schemaVersion')=? GROUP BY status`,[MATERIAL_TASK_SCHEMA]);
  const pending=Number(counts.find(row=>row.status==='pending')?.n||0),running=Number(counts.find(row=>row.status==='running')?.n||0);
  for(const row of rows){const p=parse(row);if(!p||!['pending','running','succeeded','failed','cancelled'].includes(String(row.status))){invalid++;continue;}
   tasks.push({resourceId:p.resourceId,version:p.version,title:String(row.resource_title||'资料已不可用'),status:row.status as MaterialTaskStatus,priority:p.priority,attempt:p.attempt,error:String(row.error_message||'')});
  }
  return {schemaVersion:MATERIAL_TASK_SCHEMA,tasks,pending,running,invalid};
 }
 async enqueue(resourceId:string,version:string,priority:0|100=0,retry=false){
  if(!materialId(resourceId)||!materialVersion(version))throw new Error('invalid_input');
  const resource=await this.host.resource(resourceId);if(resource.contentHash!==version)throw new Error('source_changed');
  let row=(await this.byResource(resourceId))[0];
  if(!row&&this.host.ensureTask){await this.host.ensureTask(resource);row=(await this.byResource(resourceId))[0];}
  if(!row)throw new Error('material_task_missing');
  const existing=parse(row);if(existing&&(existing.resourceId!==resourceId||existing.version!==version))throw new Error('source_changed');
  if(!existing&&String(row.payload_json).includes(MATERIAL_TASK_SCHEMA))throw new Error('invalid_task');
  if(existing&&row.status==='running'){
   // Revoke the old immutable lease before restarting a demanded background parse.
   // Mutating a live lease would allow an old worker to commit against a new claim.
   if(priority===100&&existing.priority===0&&this.active?.id===resourceId&&existing.owner?.pid===process.pid&&existing.owner.nonce===this.nonce){
    if(!await this.cas(row,'pending',{...existing,priority:100,owner:null},'preempt'))throw new Error('material_task_conflict');
    this.active.reason='preempt';this.active.priority=100;this.active.controller.abort();this.wake();
   }
   return;
  }
  if(existing&&row.status==='succeeded'&&readable(resource))return;
  if(existing&&['failed','cancelled'].includes(String(row.status))&&!retry)return;
  const payload:Payload=existing?{...existing,priority:Math.max(priority,existing.priority) as 0|100,owner:null}:{schemaVersion:MATERIAL_TASK_SCHEMA,resourceId,version,priority,attempt:0,owner:null};
  if(!await this.cas(row,'pending',payload))throw new Error('material_task_conflict');
  if(priority===100&&this.active&&this.active.id!==resourceId&&this.active.priority===0){this.active.reason='preempt';this.active.controller.abort();}
  this.wake();
 }
 async action(input:MaterialTaskAction){
  if(!validMaterialTaskAction(input))throw new Error('invalid_input');
  const resource=await this.host.resource(input.resourceId);if(resource.contentHash!==input.version)throw new Error('source_changed');
  if(input.action!=='cancel')await this.enqueue(input.resourceId,input.version,100,input.action==='retry');
  else{
   const row=(await this.byResource(input.resourceId))[0];const p=row&&parse(row);
   if(row&&p&&p.version===input.version&&['pending','running'].includes(String(row.status))){if(!await this.cas(row,'cancelled',{...p,owner:null},'cancelled'))throw new Error('material_task_conflict');if(this.active?.id===input.resourceId)this.active.controller.abort();}
  }
  return this.snapshot();
 }
 async cancelAll(){for(const status of ['pending','running']){for(;;){const rows=await this.rows(status);if(!rows.length)break;let changes=0;for(const row of rows){const p=parse(row);if(p){changes+=await this.cas(row,'cancelled',{...p,owner:null},'cancelled');if(this.active?.id===p.resourceId)this.active.controller.abort();}else changes+=await this.quarantine(row);}if(!changes)break;}}}
 /** Pi requests this existing local parser; cancellation ends waiting, not other teacher work. */
 async prepare(id:string,version:string,signal:AbortSignal,current:()=>boolean){
  signal.throwIfAborted();if(!current())throw new Error('permission_denied');const task=(await this.byResource(id))[0];if(!task||!parse(task))return;await this.enqueue(id,version,100);
  const deadline=Date.now()+310000;
  while(Date.now()<deadline){signal.throwIfAborted();if(!current())throw new Error('permission_denied');const r=await this.host.resource(id);if(r.contentHash!==version)throw new Error('source_changed');if(readable(r))return;
   const row=(await this.byResource(id))[0];if(!row||!parse(row)||['failed','cancelled'].includes(String(row.status)))return;
   await new Promise<void>(resolve=>{const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',finish);resolve();};const timer=setTimeout(finish,200);signal.addEventListener('abort',finish,{once:true});});
  }
  throw new Error('timeout');
 }
 private async pump(){
  while(!this.closing){
   const pending=await this.rows('pending');let quarantined=0;
   for(const candidate of pending)if(!parse(candidate))quarantined+=await this.quarantine(candidate);
   const row=pending.find(row=>parse(row));if(!row){if(quarantined)continue;return;}if(this.closing)return;
   const p=parse(row)!,claim={...p,attempt:p.attempt+1,owner:{pid:process.pid,nonce:this.nonce}};if(!await this.cas(row,'running',claim))continue;
   const lease={taskId:String(row.id),payload:JSON.stringify(claim)},controller=new AbortController(),active={id:p.resourceId,priority:p.priority,controller} as NonNullable<MaterialParseQueue['active']>;this.active=active;
   if(this.closing){active.reason='shutdown';controller.abort();}
   else if(p.priority===0&&(await this.rows('pending')).some(row=>parse(row)?.priority===100)){active.reason='preempt';controller.abort();}
   let error='',result:TeacherResource|undefined;
   try{const r=await this.host.resource(p.resourceId);if(r.contentHash!==p.version)throw new Error('source_changed');result=await this.host.ingest(p.resourceId,controller.signal,lease);if(!readable(result))error=result.parseEngine.split(':').at(-1)||'parse_failed';}
   catch(e){error=controller.signal.aborted?'cancelled':e instanceof Error&&['source_changed','missing','partial_existing','material_busy'].includes(e.message)?e.message:'parse_failed';}
   finally{if(this.active===active)this.active=undefined;}
   const after=(await this.host.all('SELECT * FROM ai_tasks WHERE id=?',[lease.taskId]))[0];if(!after||after.status!=='running'||after.payload_json!==lease.payload)continue;
   const again=active.reason==='shutdown'||active.reason==='preempt';await this.cas(after,again?'pending':error?'failed':'succeeded',{...claim,owner:null},again?active.reason!:error,result&&!error?JSON.stringify({resourceId:result.id,parser:result.parseEngine}):null);
  }
 }
}
