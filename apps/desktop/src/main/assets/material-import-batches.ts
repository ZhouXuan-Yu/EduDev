import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {KnowledgeImportResult} from '../../shared/contracts';
import {MATERIAL_IMPORT_SCHEMA as schema,validBatchAction,validBatchFiles,type MaterialBatch,type MaterialBatchAction,type MaterialBatchPage,type MaterialBatchFiles,type MaterialBatchState,type MaterialBatchFileFilter,type MaterialBatchContentState} from '../../shared/material-import-batch';
type Row=Record<string,unknown>;type Value=string|number|null;
type Host={root:()=>string;all:(q:string,p?:Value[])=>Promise<Row[]>;run:(q:string,p?:Value[])=>Promise<void>;change:(q:string,p:Value[])=>Promise<number>;import:(files:string[],signal:AbortSignal,guard:()=>Promise<void>)=>Promise<Pick<KnowledgeImportResult,'items'|'resources'>>;retryParse:(id:string)=>Promise<void>};
const DISCOVERY_SLICE=128;
const supported=/\.(pdf|docx|pptx|xlsx|jpg|jpeg|png|webp|md|txt)$/i;
const now=()=>new Date().toISOString();
const inside=(root:string,target:string)=>{const p=path.relative(root,target);return p===''||p!=='..'&&!p.startsWith('..'+path.sep)&&!path.isAbsolute(p);};
const same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const alive=(pid:number)=>{if(!pid)return false;try{process.kill(pid,0);return true;}catch(e){return (e as NodeJS.ErrnoException).code!=='ESRCH';}};
const identity=(s:Awaited<ReturnType<typeof fs.stat>>)=>[s.dev,s.ino,s.birthtimeMs].join(':');
const fileVersion=(s:Awaited<ReturnType<typeof fs.stat>>)=>[s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs].join(':');
const errorText=(e:unknown)=>{const code=(e as NodeJS.ErrnoException)?.code;return code==='ENOSPC'?'磁盘空间不足，请释放空间后重试。':code==='ENOENT'?'原文件或目录已移动，请恢复后重试。':code==='EACCES'||code==='EPERM'?'无法读取，请检查文件权限后重试。':(e as Error)?.message==='source_changed'?'原文件已变化，请重试以使用新版本。':(e as Error)?.message==='invalid_root'?'授权文件夹已变化或不可读取，请恢复原文件夹。':'未能归档，请检查文件后重试。';};
const readableStatuses="'ready','parsed','chunked','indexed','graph_extracted'";
const failedParse="r.parse_status IN ('failed','partial','needs_ocr') OR r.parse_status='needs_parser' AND r.parse_engine NOT LIKE '%:pending'";
const contentState=`CASE WHEN r.id IS NULL THEN 'unavailable' WHEN r.parse_status='partial' THEN 'partial' WHEN ${failedParse} THEN 'failed' WHEN r.parse_status IN (${readableStatuses}) THEN CASE WHEN EXISTS(SELECT 1 FROM resource_chunks c WHERE c.resource_id=r.id) THEN 'readable' ELSE 'empty' END ELSE 'waiting' END`;
const fileIssue=`(e.status='failed' OR e.status='saved' AND (${contentState}) IN ('failed','partial','empty','unavailable'))`;
const retryError=(error:unknown)=>(error as Error)?.message==='source_changed'?'原件版本已变化，本地重试未启动，请打开资料核对。':['busy','material_busy','material_task_conflict'].includes((error as Error)?.message)?'资料正在处理，本地重试未启动，请稍后再试。':'本地重试未启动，请打开资料检查原件与解析组件后重试。';
function contentError(row:Row,state:MaterialBatchContentState){
 if(state==='readable'||state==='waiting')return '';
 if(state==='unavailable')return '归档记录暂不可用，请保留数据并检查。';
 if(state==='empty')return '尚未提取到正文，请打开原件核对；此项未计为等待中的任务。';
 if(row.error)return String(row.error);
 return state==='partial'?'部分正文可查，仍有内容未完成，可局部重试。':'本地正文解析未完成，请检查解析组件后重试。';
}
/** Persistent local folder grant + bounded discovery + replay-safe archive. No model or renderer paths. */
export class MaterialImportBatches{
 private timer?:ReturnType<typeof setInterval>;private pumping?:Promise<void>;private closing=false;
 private active?:{id:string;controller:AbortController;pause:boolean};private readonly nonce=randomUUID();
 private host:Host;
 constructor(host:Host){this.host=host;}
 async migrate(){for(const q of [
  `CREATE TABLE IF NOT EXISTS material_import_batches(id TEXT PRIMARY KEY,schema_version TEXT NOT NULL,root_path TEXT NOT NULL,root_identity TEXT NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL,phase TEXT NOT NULL DEFAULT 'discover',owner_pid INTEGER NOT NULL DEFAULT 0,owner_nonce TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS material_import_entries(seq INTEGER PRIMARY KEY AUTOINCREMENT,batch_id TEXT NOT NULL REFERENCES material_import_batches(id),relative_path TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,source_version TEXT NOT NULL DEFAULT '',file_size INTEGER NOT NULL DEFAULT 0,resource_id TEXT NOT NULL DEFAULT '',reused INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',UNIQUE(batch_id,relative_path))`,
  `CREATE INDEX IF NOT EXISTS idx_material_import_work ON material_import_entries(batch_id,kind,status,seq)`,
  `CREATE INDEX IF NOT EXISTS idx_material_import_resource ON material_import_entries(resource_id)`,
 ])await this.host.run(q);}
 start(){if(this.timer)return;this.closing=false;this.timer=setInterval(()=>this.wake(),700);this.timer.unref();this.wake();}
 async close(){this.closing=true;if(this.timer)clearInterval(this.timer);this.timer=undefined;this.active?.controller.abort();await this.pumping;}
 async pauseAll(){await this.host.run(`UPDATE material_import_batches SET status='paused',updated_at=? WHERE schema_version=? AND status='queued' AND owner_pid=0`,[now(),schema]);if(this.active){this.active.pause=true;this.active.controller.abort();await this.pumping;}}
 private wake(){if(this.closing||this.pumping)return;this.pumping=this.pump().catch(()=>undefined).finally(()=>{this.pumping=undefined;});}
 private async root(row:Row){
  const root=String(row.root_path),managed=await fs.realpath(this.host.root()),stat=await fs.lstat(root);
  if(!path.isAbsolute(root)||!stat.isDirectory()||stat.isSymbolicLink()||!same(await fs.realpath(root),root)||inside(managed,root)||identity(stat)!==row.root_identity)throw new Error('invalid_root');
  return root;
 }
 private async selected(selected:string){
  const root=path.resolve(selected),stat=await fs.lstat(root);const row={root_path:root,root_identity:identity(stat)};
  await this.root(row);return row;
 }
 async create(selected:string){
  const grant=await this.selected(selected),id='batch_'+randomUUID(),time=now();
  await this.host.run(`INSERT INTO material_import_batches(id,schema_version,root_path,root_identity,name,status,created_at,updated_at) VALUES (?,?,?,?,?,'paused',?,?)`,[id,schema,grant.root_path,grant.root_identity,path.basename(grant.root_path)||grant.root_path,time,time]);
  await this.host.run(`INSERT INTO material_import_entries(batch_id,relative_path,kind,status) VALUES (?,'','directory','pending')`,[id]);
  await this.host.run(`UPDATE material_import_batches SET status='queued' WHERE id=?`,[id]);this.wake();return id;
 }
 async action(input:MaterialBatchAction){
  if(!validBatchAction(input))throw new Error('invalid_input');
  const row=(await this.host.all('SELECT * FROM material_import_batches WHERE id=? AND schema_version=?',[input.batchId,schema]))[0];if(!row)throw new Error('invalid_input');
  if(input.relativePath!==undefined){
   const entry=(await this.host.all(`SELECT e.*,${contentState} content_state FROM material_import_entries e LEFT JOIN teacher_resources r ON r.id=e.resource_id WHERE e.batch_id=? AND e.relative_path=?`,[input.batchId,input.relativePath]))[0];
   if(!entry)throw new Error('invalid_input');
   // A saved original belongs to the managed library: retrying its local parser does not
   // require the external import folder to remain connected, or grant any cloud retry.
   if(entry.status==='saved'){
    if(!['failed','partial'].includes(String(entry.content_state)))throw new Error('invalid_input');
    if(!await this.retryLocal(entry))throw new Error('local_retry_failed');return this.list(0);
   }
   if(entry.status!=='failed')throw new Error('invalid_input');
  }
  if(input.action==='pause'){
   if(this.active?.id===input.batchId){this.active.pause=true;this.active.controller.abort();await this.pumping;}
   else if(row.status==='queued'||row.status==='running'&&!alive(Number(row.owner_pid)))await this.host.run(`UPDATE material_import_batches SET status='paused',owner_pid=0,owner_nonce='',updated_at=? WHERE id=? AND status=? AND owner_nonce=?`,[now(),input.batchId,String(row.status),String(row.owner_nonce)]);
   else if(row.status==='running')throw new Error('busy');
  }else{
   if(this.active?.id===input.batchId||alive(Number(row.owner_pid)))throw new Error('busy');
   await this.root(row);
   await this.host.run(`INSERT OR IGNORE INTO material_import_entries(batch_id,relative_path,kind,status) VALUES (?,'','directory','pending')`,[input.batchId]);
   // Retry is an explicit request to admit the current version of failed source files.
   if(input.action==='retry'){
    await this.host.run(`UPDATE material_import_entries SET status='pending',source_version='',error='' WHERE batch_id=? AND status='failed'${input.relativePath!==undefined?' AND relative_path=?':''}`,[input.batchId,...(input.relativePath!==undefined?[input.relativePath]:[])]);
    if(input.relativePath===undefined){let cursor=0;for(;;){const entries=await this.host.all(`SELECT e.seq,e.resource_id FROM material_import_entries e JOIN teacher_resources r ON r.id=e.resource_id WHERE e.batch_id=? AND e.status='saved' AND e.seq>? AND (${failedParse}) ORDER BY e.seq LIMIT 50`,[input.batchId,cursor]);if(!entries.length)break;for(const e of entries){cursor=Number(e.seq);await this.retryLocal(e);}}}
   }
   await this.host.run(`UPDATE material_import_batches SET status='queued',owner_pid=0,owner_nonce='',error='',updated_at=? WHERE id=? AND owner_nonce=?`,[now(),input.batchId,String(row.owner_nonce)]);this.wake();
  }
  return this.list(0);
 }
 private async retryLocal(entry:Row){
  try{await this.host.retryParse(String(entry.resource_id));}
  catch(error){await this.host.run(`UPDATE material_import_entries SET error=? WHERE seq=? AND status='saved'`,[retryError(error),Number(entry.seq)]);return false;}
  await this.host.run(`UPDATE material_import_entries SET error='' WHERE seq=? AND status='saved'`,[Number(entry.seq)]);return true;
 }
 async list(offset=0):Promise<MaterialBatchPage>{
  const total=Number((await this.host.all('SELECT COUNT(*) n FROM material_import_batches WHERE schema_version=?',[schema]))[0]?.n||0);
  const rows=await this.host.all(`SELECT * FROM material_import_batches WHERE schema_version=? ORDER BY created_at DESC,id LIMIT 10 OFFSET ?`,[schema,offset]),batches:MaterialBatch[]=[];
  for(const row of rows){
   const sums=(await this.host.all(`SELECT COUNT(*) scanned,COALESCE(SUM(file_size),0) bytes,SUM(status='saved') archived,SUM(status='saved' AND reused=0) imported,SUM(status='saved' AND reused=1) reused,SUM(status='failed') failed,SUM(status='skipped') skipped,COALESCE(SUM(CASE WHEN status='saved' THEN file_size ELSE 0 END),0) archived_bytes FROM material_import_entries WHERE batch_id=? AND kind='file'`,[String(row.id)]))[0];
   const parse=(await this.host.all(`SELECT SUM(r.parse_status IN (${readableStatuses}) AND EXISTS (SELECT 1 FROM resource_chunks c WHERE c.resource_id=r.id)) readable,SUM(r.parse_status='partial' AND EXISTS (SELECT 1 FROM resource_chunks c WHERE c.resource_id=r.id)) partial_readable,SUM(${failedParse}) failed,SUM(r.parse_status IN (${readableStatuses}) AND NOT EXISTS(SELECT 1 FROM resource_chunks c WHERE c.resource_id=r.id)) empty,COUNT(*) n FROM teacher_resources r WHERE r.id IN (SELECT resource_id FROM material_import_entries WHERE batch_id=? AND status='saved')`,[String(row.id)]))[0];
   const failures=Number((await this.host.all(`SELECT COUNT(*) n FROM material_import_entries WHERE batch_id=? AND kind='directory' AND status='failed'`,[String(row.id)]))[0]?.n||0);
   const readable=Number(parse?.readable||0),parseFailed=Number(parse?.failed||0),empty=Number(parse?.empty||0);
   batches.push({id:String(row.id),name:String(row.name),status:row.status as MaterialBatchState,phase:row.phase as MaterialBatch['phase'],createdAt:String(row.created_at),updatedAt:String(row.updated_at),error:String(row.error),scanned:Number(sums.scanned),archived:Number(sums.archived||0),imported:Number(sums.imported||0),reused:Number(sums.reused||0),failed:Number(sums.failed||0)+failures,skipped:Number(sums.skipped||0),bytes:Number(sums.bytes),archivedBytes:Number(sums.archived_bytes),readable,partialReadable:Number(parse?.partial_readable||0),empty,parseFailed,waiting:Math.max(0,Number(parse?.n||0)-readable-parseFailed-empty)});
  }
  return {schemaVersion:schema,batches,total,offset,hasMore:offset+rows.length<total};
 }
 async files(id:string,offset:number,filter:MaterialBatchFileFilter='all'):Promise<MaterialBatchFiles>{
  if(!validBatchFiles({schemaVersion:schema,batchId:id,offset,filter}))throw new Error('invalid_input');
  const from=`FROM material_import_entries e LEFT JOIN teacher_resources r ON r.id=e.resource_id WHERE e.batch_id=? AND (e.kind='file' OR e.status='failed')${filter==='issues'?` AND ${fileIssue}`:''}`;
  const total=Number((await this.host.all(`SELECT COUNT(*) n ${from}`,[id]))[0]?.n||0);
  const rows=await this.host.all(`SELECT e.*,${contentState} content_state ${from} ORDER BY CASE WHEN ${fileIssue} THEN 0 WHEN e.status='pending' THEN 1 ELSE 2 END,e.seq LIMIT 20 OFFSET ?`,[id,offset]);
  return {schemaVersion:schema,files:rows.map(r=>{
   const state=r.content_state as MaterialBatchContentState,saved=r.status==='saved';
   return{relativePath:String(r.relative_path),status:r.status as 'pending'|'saved'|'failed'|'skipped',resourceId:String(r.resource_id),bytes:Number(r.file_size),error:saved?'':String(r.error),...(saved?{contentState:state,contentError:contentError(r,state)}:{}),retryable:String(r.relative_path)!==''&&(r.status==='failed'||saved&&['failed','partial'].includes(state))};
  }),total,offset,hasMore:offset+rows.length<total};
 }
 private async pump(){
  const rows=await this.host.all(`SELECT * FROM material_import_batches WHERE schema_version=? AND status IN ('queued','running') ORDER BY created_at LIMIT 100`,[schema]);
  for(const row of rows){
   if(this.closing)return;if(alive(Number(row.owner_pid)))continue;
   const claimed=await this.host.change(`UPDATE material_import_batches SET status='running',owner_pid=?,owner_nonce=?,error='',updated_at=? WHERE id=? AND status=? AND owner_nonce=?`,[process.pid,this.nonce,now(),String(row.id),String(row.status),String(row.owner_nonce)]);if(!claimed)continue;
   this.active={id:String(row.id),controller:new AbortController(),pause:false};
   try{await this.run(row,this.active.controller.signal);}
   catch(error){const cancelled=this.active.controller.signal.aborted;await this.host.run(`UPDATE material_import_batches SET status=?,error=?,updated_at=? WHERE id=? AND owner_nonce=?`,[cancelled?(this.active.pause?'paused':'queued'):'failed',cancelled?'':errorText(error),now(),String(row.id),this.nonce]);}
   finally{await this.host.run(`UPDATE material_import_batches SET owner_pid=0,owner_nonce='',updated_at=? WHERE id=? AND owner_nonce=?`,[now(),String(row.id),this.nonce]);this.active=undefined;}
  }
 }
 private async safePath(root:string,relative:string){
  const file=path.resolve(root,relative);if(!inside(root,file))throw new Error('source_changed');
  // Root and every descendant must remain ordinary canonical paths, never links/junctions.
  let cursor=file;for(;;){const stat=await fs.lstat(cursor);if(stat.isSymbolicLink()||!same(await fs.realpath(cursor),cursor))throw new Error('source_changed');if(same(cursor,root))return {file,stat:await fs.lstat(file)};cursor=path.dirname(cursor);}
 }
 private async run(row:Row,signal:AbortSignal){
  const root=await this.root(row),id=String(row.id);let discovered=0;
  for(;;){
   signal.throwIfAborted();await this.root(row);
   const dirs=await this.host.all(`SELECT * FROM material_import_entries WHERE batch_id=? AND kind='directory' AND status='pending' ORDER BY seq LIMIT 1`,[id]);if(!dirs.length)break;
   const directory=dirs[0],relative=String(directory.relative_path);
   try{
    const source=await this.safePath(root,relative);if(!source.stat.isDirectory())throw new Error('source_changed');
    if(relative.split(path.sep).filter(Boolean).length>32)throw new Error('source_changed');
    const entries=await fs.opendir(source.file);
    for await(const entry of entries){
     signal.throwIfAborted();const child=path.join(relative,entry.name),file=path.join(root,child);let stat:Awaited<ReturnType<typeof fs.lstat>>;
     try{stat=await fs.lstat(file);}catch(error){signal.throwIfAborted();await this.host.run(`INSERT OR IGNORE INTO material_import_entries(batch_id,relative_path,kind,status,error) VALUES (?,?,'file','failed',?)`,[id,child,errorText(error)]);continue;}
     const managed=inside(path.resolve(this.host.root()),file),kind=stat.isDirectory()&&!stat.isSymbolicLink()?'directory':'file';
     const skipped=managed||stat.isSymbolicLink()||kind==='file'&&(!stat.isFile()||!supported.test(entry.name));
     await this.host.run(`INSERT OR IGNORE INTO material_import_entries(batch_id,relative_path,kind,status,source_version,file_size,error) VALUES (?,?,?,?,?,?,?)`,[id,child,kind,skipped?'skipped':'pending',stat.isFile()?fileVersion(stat):'',stat.isFile()?stat.size:0,skipped?'非支持格式、链接或应用资料目录，已跳过。':'']);
     if(++discovered>=DISCOVERY_SLICE){
      await this.host.run(`UPDATE material_import_batches SET phase='archive' WHERE id=? AND owner_nonce=?`,[id,this.nonce]);
      await this.archivePending(row,root,signal,DISCOVERY_SLICE);discovered=0;
      await this.host.run(`UPDATE material_import_batches SET phase='discover' WHERE id=? AND owner_nonce=?`,[id,this.nonce]);
     }
    }
    await this.host.run(`UPDATE material_import_entries SET status='scanned' WHERE seq=?`,[Number(directory.seq)]);
   }catch(error){signal.throwIfAborted();if((error as NodeJS.ErrnoException)?.code==='ENOSPC')throw error;await this.host.run(`UPDATE material_import_entries SET status='failed',error=? WHERE seq=?`,[errorText(error),Number(directory.seq)]);}
  }
  await this.host.run(`UPDATE material_import_batches SET phase='archive' WHERE id=? AND owner_nonce=?`,[id,this.nonce]);
  await this.archivePending(row,root,signal);
  const failed=Number((await this.host.all(`SELECT COUNT(*) n FROM material_import_entries WHERE batch_id=? AND status='failed'`,[id]))[0]?.n||0);
  await this.host.run(`UPDATE material_import_batches SET status=?,error='',updated_at=? WHERE id=? AND owner_nonce=?`,[failed?'partial':'completed',now(),id,this.nonce]);
 }
 /** Keep source/copy/ACK validation identical for both interleaved and final drains. */
 private async archivePending(row:Row,root:string,signal:AbortSignal,limit=Infinity){
  const id=String(row.id);
  for(let processed=0;processed<limit;processed++){
   signal.throwIfAborted();await this.root(row);
   const files=await this.host.all(`SELECT * FROM material_import_entries WHERE batch_id=? AND kind='file' AND status='pending' ORDER BY seq LIMIT 1`,[id]);if(!files.length)break;
   const entry=files[0];
   try{
    const source=await this.safePath(root,String(entry.relative_path));if(!source.stat.isFile()||entry.source_version&&fileVersion(source.stat)!==entry.source_version)throw new Error('source_changed');
    const guard=async()=>{signal.throwIfAborted();await this.root(row);const current=await this.safePath(root,String(entry.relative_path));if(fileVersion(current.stat)!==fileVersion(source.stat))throw new Error('source_changed');};
    if(!entry.source_version)await this.host.run(`UPDATE material_import_entries SET source_version=?,file_size=? WHERE seq=?`,[fileVersion(source.stat),source.stat.size,Number(entry.seq)]);
    const result=await this.host.import([source.file],signal,guard);signal.throwIfAborted();
    const item=result.items[0],resource=result.resources[0];if(!item?.ok||!resource)throw Object.assign(new Error(item?.errorMessage||'archive_failed'),{code:item?.errorCode});
    await this.host.run(`UPDATE material_import_entries SET status='saved',resource_id=?,file_size=?,reused=?,error='' WHERE seq=?`,[resource.id,source.stat.size,item.reused?1:0,Number(entry.seq)]);
   }catch(error){signal.throwIfAborted();await this.host.run(`UPDATE material_import_entries SET status='failed',error=? WHERE seq=?`,[errorText(error),Number(entry.seq)]);if((error as NodeJS.ErrnoException)?.code==='ENOSPC')throw error;}
  }
 }
}
