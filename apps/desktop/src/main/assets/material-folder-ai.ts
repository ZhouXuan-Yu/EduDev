import {nonQuestionPagePurpose} from './material-page-purpose';
import {materialAiProcessingPolicy} from './material-ai-processing-policy';
import {MATERIAL_CROP_CORRECTION_POLICY} from '../../shared/material-ai-page-fragments';
import {validPdfFilePage} from '../../shared/material-pdf-file';
import {MATERIAL_FOLDER_AI_SCHEMA as schema,validFolderAiGrant,validFolderAiAction,type FolderAiGrant,type FolderAiAction,type FolderAiView} from '../../shared/material-folder-ai';
import {materialBatchId} from '../../shared/material-import-batch';
import {createHash} from 'node:crypto';
import type {MaterialAiRepository} from './material-ai-repository';
import type {MaterialWordRepository} from './material-word-repository';
type Row=Record<string,unknown>;type Value=string|number|null;
const folderTaskKey=(grant:Row,resource:Row,unit:number)=>createHash('sha256').update(JSON.stringify([schema,grant.batch_id,grant.revision,resource.resource_id,resource.version,unit])).digest('hex');
function verifiedCover(page:Row){
 if(page.status!=='complete'||page.error!==''||typeof page.result_json!=='string'||Buffer.byteLength(page.result_json)>1048576)return false;
 try{const receipt:unknown=JSON.parse(page.result_json);return validPdfFilePage(receipt)&&receipt.status==='complete'&&receipt.error===''&&nonQuestionPagePurpose([...new Set([receipt.text,receipt.nativeText,receipt.ocrText].filter(Boolean))].join('\n'))==='cover';}catch{return false;}
}
const readable="'ready','partial','parsed','chunked','indexed','graph_extracted'";
const unreserved=`NOT EXISTS(SELECT 1 FROM material_ai_task_keys k LEFT JOIN material_ai_batches b ON b.id=k.batch_id WHERE k.folder_id=u.batch_id AND CASE
 WHEN b.id IS NULL OR NOT json_valid(b.config_json) THEN 1
 WHEN json_type(b.config_json,'$.resourceId') IS NOT 'text' OR json_type(b.config_json,'$.start') IS NOT 'integer' OR json_extract(b.config_json,'$.start')<1 THEN 1
 ELSE json_extract(b.config_json,'$.resourceId')=u.resource_id AND json_extract(b.config_json,'$.start')=u.unit END)`;
// Only unbilled legacy scheduling errors may be re-queued, after the same page was actually published.
const recoverable=`u.state='review' AND u.ai_batch_id='' AND u.error IN ('local_page_failed','unavailable','blank_page_requires_check')
 AND r.content_hash=u.version AND j.version=u.version AND j.state IN ('complete','partial')
 AND p.status IN ('complete','blank','failed','needs_review') AND u.unit BETWEEN 1 AND j.total AND r.parse_status IN (${readable})
 AND (p.status<>'complete' OR EXISTS(SELECT 1 FROM resource_chunks c WHERE c.resource_id=r.id AND c.page_number=u.unit))
 AND ${unreserved}`;
const recoveryJoin='FROM material_folder_ai_units u JOIN material_folder_ai_resources fr ON fr.batch_id=u.batch_id AND fr.resource_id=u.resource_id AND fr.version=u.version JOIN teacher_resources r ON r.id=u.resource_id JOIN material_pdf_jobs j ON j.resource_id=r.id JOIN material_pdf_pages p ON p.generation=j.generation AND p.page=u.unit';
const parseRecoveryJoin='FROM material_folder_ai_units u INDEXED BY idx_folder_ai_local_parse_retry JOIN material_folder_ai_resources fr ON fr.batch_id=u.batch_id AND fr.resource_id=u.resource_id AND fr.version=u.version JOIN teacher_resources r ON r.id=u.resource_id LEFT JOIN material_pdf_jobs j ON j.resource_id=r.id';
const parseRecoverable=`u.state='review' AND u.ai_batch_id='' AND u.error='local_parse_failed' AND u.unit>=1 AND r.content_hash=u.version
 AND (r.parse_status IN ('ready','parsed','chunked','indexed','graph_extracted') OR r.parse_status='partial' AND lower(r.original_file_name) LIKE '%.pdf')
 AND (lower(r.original_file_name) LIKE '%.pdf' AND j.version=u.version AND j.state IN ('complete','partial') AND u.unit<=j.total
 OR lower(r.original_file_name) NOT LIKE '%.pdf' AND EXISTS(SELECT 1 FROM resource_chunks c WHERE c.resource_id=r.id))
 AND ${unreserved}`;
type Host={all:(sql:string,p?:Value[])=>Promise<Row[]>;run:(sql:string,p?:Value[])=>Promise<void>;ai:()=>MaterialAiRepository;word:()=>MaterialWordRepository;writer:<T>(action:(target:MaterialFolderAiRepository)=>Promise<T>)=>Promise<T>};
export class MaterialFolderAiRepository{
 private timer?:ReturnType<typeof setInterval>;private pumping?:Promise<void>;private closing=false;private lastGrantRowid=0;
 constructor(private host:Host){}
 async migrate(){
  for(const sql of [
   `CREATE TABLE IF NOT EXISTS material_folder_ai(batch_id TEXT PRIMARY KEY,status TEXT NOT NULL,revision INTEGER NOT NULL,settings_revision INTEGER NOT NULL,max_calls INTEGER NOT NULL,cursor INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '')`,
   `CREATE TABLE IF NOT EXISTS material_folder_ai_resources(batch_id TEXT NOT NULL,resource_id TEXT NOT NULL,version TEXT NOT NULL,cursor INTEGER NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT -1,status TEXT NOT NULL DEFAULT 'waiting',error TEXT NOT NULL DEFAULT '',PRIMARY KEY(batch_id,resource_id))`,
   `CREATE INDEX IF NOT EXISTS idx_folder_ai_resources ON material_folder_ai_resources(batch_id,status)`,
   `CREATE INDEX IF NOT EXISTS idx_folder_ai_plan ON material_folder_ai_resources(batch_id) WHERE status IN ('waiting','running')`,
   `CREATE TABLE IF NOT EXISTS material_folder_ai_units(batch_id TEXT NOT NULL,resource_id TEXT NOT NULL,version TEXT NOT NULL,unit INTEGER NOT NULL,state TEXT NOT NULL,ai_batch_id TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '',PRIMARY KEY(batch_id,resource_id,unit))`,
   `CREATE INDEX IF NOT EXISTS idx_folder_ai_units ON material_folder_ai_units(batch_id,state)`,
   `CREATE INDEX IF NOT EXISTS idx_folder_ai_local_retry_v2 ON material_folder_ai_units(batch_id) WHERE state='review' AND ai_batch_id='' AND error IN ('local_page_failed','unavailable','blank_page_requires_check')`,
   `CREATE INDEX IF NOT EXISTS idx_folder_ai_local_parse_retry ON material_folder_ai_units(batch_id) WHERE state='review' AND ai_batch_id='' AND error='local_parse_failed'`,
   `CREATE INDEX IF NOT EXISTS idx_folder_ai_keys ON material_ai_task_keys(folder_id)`,
   `CREATE INDEX IF NOT EXISTS idx_folder_ai_discovery ON material_import_entries(batch_id,seq)`
  ])await this.host.run(sql);
  if(!(await this.host.all('PRAGMA table_info(material_folder_ai)')).some(c=>c.name==='plan_cursor'))await this.host.run('ALTER TABLE material_folder_ai ADD COLUMN plan_cursor INTEGER NOT NULL DEFAULT 0');
  if(!(await this.host.all('PRAGMA table_info(material_folder_ai)')).some(c=>c.name==='processing_mode'))await this.host.run("ALTER TABLE material_folder_ai ADD COLUMN processing_mode TEXT NOT NULL DEFAULT 'legacy' CHECK(processing_mode IN ('legacy','standard','quality'))");
  // Catch late successful retries below the initial discovery cursor in the same archive transaction.
  for(const [name,event] of [['saved','UPDATE OF status,resource_id'],['inserted','INSERT']])await this.host.run(`CREATE TRIGGER IF NOT EXISTS folder_ai_${name} AFTER ${event} ON material_import_entries WHEN NEW.kind='file' AND NEW.status='saved' AND NEW.resource_id<>'' BEGIN
   INSERT OR IGNORE INTO material_folder_ai_resources(batch_id,resource_id,version) SELECT f.batch_id,r.id,r.content_hash FROM material_folder_ai f JOIN teacher_resources r ON r.id=NEW.resource_id WHERE f.batch_id=NEW.batch_id;
   UPDATE material_folder_ai SET status='attention',error='scope_changed' WHERE batch_id=NEW.batch_id AND status='complete' AND EXISTS(SELECT 1 FROM material_folder_ai_resources r WHERE r.batch_id=NEW.batch_id AND r.resource_id=NEW.resource_id AND r.status='waiting');
  END`);
 }
 start(){if(this.timer)return;this.closing=false;const pump=()=>{if(this.pumping||this.closing)return;this.pumping=this.tick().catch(()=>undefined).finally(()=>{this.pumping=undefined;});};this.timer=setInterval(pump,1200);this.timer.unref();pump();}
 async close(){this.closing=true;if(this.timer)clearInterval(this.timer);this.timer=undefined;await this.pumping;}
 private async configured(revision:number){const s=await this.host.ai().settings();if(!s.configured||!s.secureStorage||s.model!=='deepseek-flash'||s.revision!==revision)throw Error('configuration_changed');}
 async authorize(input:FolderAiGrant):Promise<FolderAiView>{
  if(!validFolderAiGrant(input))throw Error('invalid_input');await this.configured(input.settingsRevision);
  await this.host.writer(async target=>{
   if(!(await target.host.all('SELECT id FROM material_import_batches WHERE id=?',[input.batchId])).length)throw Error('invalid_input');
   const prior=(await target.host.all('SELECT * FROM material_folder_ai WHERE batch_id=?',[input.batchId]))[0];
   const mode=materialAiProcessingPolicy(input.processingMode??prior?.processing_mode??'legacy').mode;
   if(prior&&prior.processing_mode!==mode)throw Error('processing_mode_locked');
   if(prior&&Number(prior.settings_revision)!==input.settingsRevision)throw Error('configuration_changed');
   const reserved=Number((await target.host.all("SELECT COALESCE(SUM(json_extract(b.config_json,'$.maxCalls')),0) n FROM material_ai_task_keys k JOIN material_ai_batches b ON b.id=k.batch_id WHERE k.folder_id=?",[input.batchId]))[0]?.n||0);if(input.maxCalls<reserved)throw Error('budget_exhausted');
   await target.host.run("INSERT INTO material_folder_ai(batch_id,status,revision,settings_revision,max_calls,processing_mode) VALUES(?,'running',1,?,?,?) ON CONFLICT(batch_id) DO UPDATE SET status='running',max_calls=excluded.max_calls,error=''",[input.batchId,input.settingsRevision,input.maxCalls,mode]);
  });return (await this.view(input.batchId))!;
 }
 async action(input:FolderAiAction):Promise<FolderAiView>{
  if(!validFolderAiAction(input))throw Error('invalid_input');const grant=(await this.host.all('SELECT * FROM material_folder_ai WHERE batch_id=?',[input.batchId]))[0];if(!grant)throw Error('invalid_input');
  if(input.action==='resume'){if(grant.error==='scope_changed')throw Error('consent_required');await this.configured(Number(grant.settings_revision));}
  await this.host.run('UPDATE material_folder_ai SET status=? WHERE batch_id=?',[input.action==='pause'?'paused':'running',input.batchId]);
  if(input.action==='pause'){
   const rows=await this.host.all("SELECT b.id FROM material_ai_task_keys k JOIN material_ai_batches b ON b.id=k.batch_id WHERE k.folder_id=? AND b.status='running'",[input.batchId]);
   for(const row of rows)await this.host.ai().action({schemaVersion:'xiaozhi.material-ai.v1',batchId:String(row.id),action:'pause'},'folder');
  }return (await this.view(input.batchId))!;
 }
 async pauseAll(){const rows=await this.host.all("SELECT batch_id FROM material_folder_ai WHERE status IN ('running','budget_exhausted')");for(const row of rows)await this.action({schemaVersion:schema,batchId:String(row.batch_id),action:'pause'});return rows.length;}
 async view(id:string):Promise<FolderAiView|undefined>{
  if(!materialBatchId(id))throw Error('invalid_input');const grant=(await this.host.all('SELECT * FROM material_folder_ai WHERE batch_id=?',[id]))[0];if(!grant)return;
  const resolved=this.host.ai().bookAnswers?.index.folderReviewResolvedSql()??'0';
  const projection=`WITH units AS (SELECT u.*,(${resolved}) section_resolved FROM material_folder_ai_units u WHERE u.batch_id=?)`;
  const sums=(await this.host.all(`${projection} SELECT COUNT(*) units,SUM(state='complete' OR section_resolved) complete,SUM(section_resolved) section_resolved,SUM(state='complete' AND error='non_question_cover' AND ai_batch_id='') skipped_cover,SUM(state='review' AND NOT section_resolved) review,SUM(state='failed') failed,SUM(state IN ('pending','running','pending_local')) waiting FROM units`,[id]))[0];
  const billing=(await this.host.all("SELECT COALESCE(SUM(b.calls),0) calls,COALESCE(SUM(CASE WHEN json_valid(b.config_json) THEN json_extract(b.config_json,'$.maxCalls') END),0) reserved,SUM(NOT json_valid(b.config_json)) invalid FROM material_ai_task_keys k JOIN material_ai_batches b ON b.id=k.batch_id WHERE k.folder_id=?",[id]))[0];
  if(Number(billing.invalid)>0)throw Error('unavailable'); // Never report a fabricated zero reservation for a damaged ledger.
  const count=(await this.host.all("SELECT COUNT(*) n,SUM(status IN ('waiting','running')) planning FROM material_folder_ai_resources WHERE batch_id=?",[id]))[0];
  const questions=(await this.host.all("SELECT SUM(json_extract(q.archive_json,'$.state')='ai_final') ready,SUM(json_extract(q.archive_json,'$.state')='ai_needs_review') review,SUM(json_extract(q.archive_json,'$.state') IN ('book_enriched','web_enriched')) enriched FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id JOIN material_ai_task_keys k ON k.batch_id=m.batch_id WHERE k.folder_id=? AND json_valid(q.archive_json)",[id]))[0];
  const issues=await this.host.all(`${projection} SELECT u.resource_id,r.title,u.unit,u.error FROM units u LEFT JOIN teacher_resources r ON r.id=u.resource_id WHERE u.state IN ('failed','review') AND NOT u.section_resolved ORDER BY u.resource_id,u.unit LIMIT 5`,[id]);
  let status=String(grant.status);
  if(['complete','attention'].includes(status)&&!grant.error&&!Number(count.planning)&&!Number(sums.waiting)){
   const batch=(await this.host.all('SELECT status,(SELECT COALESCE(MAX(seq),0) FROM material_import_entries WHERE batch_id=?) last_seq FROM material_import_batches WHERE id=?',[id,id]))[0];
   if(batch&&Number(grant.cursor)>=Number(batch.last_seq))status=batch.status==='completed'&&!Number(sums.review)&&!Number(sums.failed)?'complete':'attention';
  }
  return{schemaVersion:schema,batchId:id,status,revision:Number(grant.revision),processingMode:materialAiProcessingPolicy(grant.processing_mode).mode,maxCalls:Number(grant.max_calls),calls:Number(billing.calls),reserved:Number(billing.reserved),resources:Number(count.n),units:Number(sums.units),complete:Number(sums.complete||0),sectionResolved:Number(sums.section_resolved||0),skippedCover:Number(sums.skipped_cover||0),review:Number(sums.review||0),failed:Number(sums.failed||0),waiting:Number(sums.waiting||0),readyQuestions:Number(questions.ready||0),reviewQuestions:Number(questions.review||0),enrichedQuestions:Number(questions.enriched||0),error:String(grant.error),issues:issues.map(r=>({resourceId:String(r.resource_id),title:String(r.title||'本地资料'),unit:Number(r.unit),error:String(r.error)}))};
 }
 private async discover(grant:Row){
  const id=String(grant.batch_id),rows=await this.host.all('SELECT e.seq,e.status,e.resource_id,r.content_hash FROM material_import_entries e LEFT JOIN teacher_resources r ON r.id=e.resource_id WHERE e.batch_id=? AND e.seq>? ORDER BY e.seq LIMIT 32',[id,Number(grant.cursor)]);
  for(const row of rows){if(row.status==='saved'&&row.resource_id&&row.content_hash)await this.host.run('INSERT OR IGNORE INTO material_folder_ai_resources(batch_id,resource_id,version) VALUES(?,?,?)',[id,String(row.resource_id),String(row.content_hash)]);await this.host.run('UPDATE material_folder_ai SET cursor=MAX(cursor,?) WHERE batch_id=?',[Number(row.seq),id]);}
 }
 private async refresh(grant:Row){
  const id=String(grant.batch_id),rows=await this.host.all("SELECT u.resource_id,u.unit,u.ai_batch_id,a.status,a.error,b.status batch_status,b.pause_reason FROM material_folder_ai_units u JOIN material_ai_units a ON a.batch_id=u.ai_batch_id AND a.ordinal=1 JOIN material_ai_batches b ON b.id=a.batch_id WHERE u.batch_id=? AND (u.state IN ('pending','running') OR u.state='review' AND u.error='teacher_paused' OR u.state='failed' AND a.status<>'failed') ORDER BY u.rowid LIMIT 32",[id]);
  for(const row of rows){
   const state=['complete','no_questions'].includes(String(row.status))?'complete':row.status==='review'||row.status==='outcome_unknown'?'review':row.status==='failed'?'failed':undefined;
   if(state)await this.host.run('UPDATE material_folder_ai_units SET state=?,error=? WHERE batch_id=? AND resource_id=? AND unit=?',[state,row.status==='outcome_unknown'?'outcome_unknown':String(row.error||(state==='complete'?'':'needs_review')),id,String(row.resource_id),Number(row.unit)]);
   else if(row.batch_status==='paused'&&grant.status==='running'&&['pending','first_saved'].includes(String(row.status))){
    if(['folder','startup'].includes(String(row.pause_reason)))await this.host.ai().action({schemaVersion:'xiaozhi.material-ai.v1',batchId:String(row.ai_batch_id),action:'resume'});
    else await this.host.run("UPDATE material_folder_ai_units SET state='review',error='teacher_paused' WHERE batch_id=? AND resource_id=? AND unit=?",[id,String(row.resource_id),Number(row.unit)]);
   }else if(row.batch_status==='running'&&['pending','first_saved','dispatched'].includes(String(row.status)))await this.host.run("UPDATE material_folder_ai_units SET state='running',error='' WHERE batch_id=? AND resource_id=? AND unit=?",[id,String(row.resource_id),Number(row.unit)]);
  }
 }
 private async finishUnit(resource:Row,unit:number,state:string,error='',aiBatch=''){
  await this.host.run("INSERT INTO material_folder_ai_units(batch_id,resource_id,version,unit,state,ai_batch_id,error) VALUES(?,?,?,?,?,?,?) ON CONFLICT(batch_id,resource_id,unit) DO UPDATE SET state=excluded.state,ai_batch_id=excluded.ai_batch_id,error=excluded.error",[String(resource.batch_id),String(resource.resource_id),String(resource.version),unit,state,aiBatch,error]);
  await this.host.run("UPDATE material_folder_ai_resources SET cursor=MAX(cursor,?),status=CASE WHEN ?>=total THEN 'complete' ELSE 'running' END WHERE batch_id=? AND resource_id=?",[unit,unit,String(resource.batch_id),String(resource.resource_id)]);
 }
 private async recoverLocalWait(grant:Row){
  const id=String(grant.batch_id);
  if(!(await this.host.all(`SELECT 1 ${recoveryJoin} WHERE u.batch_id=? AND ${recoverable} LIMIT 1`,[id])).length)return;
  await this.host.writer(async target=>{
   const current=(await target.host.all('SELECT status,error,settings_revision,revision,processing_mode FROM material_folder_ai WHERE batch_id=?',[id]))[0];
   if(!current||!['running','attention'].includes(String(current.status))||current.error==='scope_changed'||current.revision!==grant.revision||current.settings_revision!==grant.settings_revision||current.processing_mode!==grant.processing_mode)return;
   const rows=await target.host.all(`SELECT u.resource_id,u.unit ${recoveryJoin} WHERE u.batch_id=? AND ${recoverable} ORDER BY u.rowid LIMIT 8`,[id]);
   for(const row of rows){
    await target.host.run("UPDATE material_folder_ai_units SET state='pending_local',error='' WHERE batch_id=? AND resource_id=? AND unit=?",[id,String(row.resource_id),Number(row.unit)]);
    await target.host.run("UPDATE material_folder_ai_resources SET cursor=MIN(cursor,?),status='waiting' WHERE batch_id=? AND resource_id=? AND version=(SELECT content_hash FROM teacher_resources WHERE id=?)",[Number(row.unit)-1,id,String(row.resource_id),String(row.resource_id)]);
   }
   if(rows.length){await target.host.run("UPDATE material_folder_ai SET status='running',error='' WHERE batch_id=?",[id]);grant.status='running';}
  });
 }
 private async recoverLocalParse(grant:Row){
  const id=String(grant.batch_id);
  if(!(await this.host.all(`SELECT 1 ${parseRecoveryJoin} WHERE u.batch_id=? AND ${parseRecoverable} LIMIT 1`,[id])).length)return;
  await this.host.writer(async target=>{
   const current=(await target.host.all('SELECT status,error,settings_revision,revision,processing_mode FROM material_folder_ai WHERE batch_id=?',[id]))[0];
   if(!current||!['running','attention'].includes(String(current.status))||current.error==='scope_changed'||current.revision!==grant.revision||current.settings_revision!==grant.settings_revision||current.processing_mode!==grant.processing_mode)return;
   const rows=await target.host.all(`SELECT u.resource_id,u.unit ${parseRecoveryJoin} WHERE u.batch_id=? AND ${parseRecoverable} ORDER BY u.rowid LIMIT 8`,[id]);
   for(const row of rows){
    await target.host.run("UPDATE material_folder_ai_units SET state='pending_local',error='' WHERE batch_id=? AND resource_id=? AND unit=?",[id,String(row.resource_id),Number(row.unit)]);
    // The old total was the failure position, not the actual number of questions/pages.
    await target.host.run("UPDATE material_folder_ai_resources SET cursor=MIN(cursor,?),total=-1,status='waiting' WHERE batch_id=? AND resource_id=?",[Number(row.unit)-1,id,String(row.resource_id)]);
   }
   if(rows.length){await target.host.run("UPDATE material_folder_ai SET status='running',error='' WHERE batch_id=?",[id]);grant.status='running';}
  });
 }
 private async skipCover(grant:Row,resource:Row,total:number,unit:number,generation:string,page:Row){
  if(!verifiedCover(page))return false;
  return this.host.writer(async target=>{
   const current=(await target.host.all(`SELECT p.status,p.error,p.result_json FROM material_pdf_pages p
    JOIN material_pdf_jobs j ON j.generation=p.generation JOIN teacher_resources r ON r.id=j.resource_id
    JOIN material_folder_ai_resources fr ON fr.resource_id=r.id JOIN material_folder_ai f ON f.batch_id=fr.batch_id
    WHERE f.batch_id=? AND fr.resource_id=? AND fr.version=? AND r.content_hash=fr.version AND j.version=fr.version
    AND f.status='running' AND f.revision=? AND f.settings_revision=? AND fr.cursor=? AND fr.status IN ('waiting','running')
    AND j.state IN ('complete','partial') AND j.total=? AND p.generation=? AND p.page=? AND r.parse_status IN (${readable})
    AND NOT EXISTS(SELECT 1 FROM material_folder_ai_units u WHERE u.batch_id=f.batch_id AND u.resource_id=r.id AND u.unit=p.page AND u.ai_batch_id<>'')
    AND NOT EXISTS(SELECT 1 FROM material_ai_task_keys k WHERE k.task_key=?)`,
    [String(grant.batch_id),String(resource.resource_id),String(resource.version),Number(grant.revision),Number(grant.settings_revision),unit-1,total,generation,unit,folderTaskKey(grant,resource,unit)]))[0];
   if(!current||current.result_json!==page.result_json||!verifiedCover(current))return false;
   // This is a local decision, never an AI outcome. Cursor and disposition commit together.
   await target.host.run('UPDATE material_folder_ai_resources SET total=? WHERE batch_id=? AND resource_id=?',[total,String(grant.batch_id),String(resource.resource_id)]);
   await target.finishUnit({...resource,total},unit,'complete','non_question_cover');return true;
  });
 }
 private async plan(grant:Row,resource:Row){
  const policy=materialAiProcessingPolicy(grant.processing_mode);
  const id=String(resource.resource_id),row=(await this.host.all('SELECT * FROM teacher_resources WHERE id=?',[id]))[0],unit=Number(resource.cursor)+1;
  if(!row||row.content_hash!==resource.version){await this.host.run('UPDATE material_folder_ai_resources SET total=? WHERE batch_id=? AND resource_id=?',[unit,String(grant.batch_id),id]);await this.finishUnit(resource,unit,'review','source_changed');return;}
  const name=String(row.original_file_name),pdf=/\.pdf$/i.test(name),word=/\.docx$/i.test(name),image=/\.(?:png|jpe?g|webp)$/i.test(name),text=/\.(?:txt|md)$/i.test(name);
  const fail=async(code:string)=>{await this.host.run('UPDATE material_folder_ai_resources SET total=? WHERE batch_id=? AND resource_id=?',[unit,String(grant.batch_id),id]);await this.finishUnit(resource,unit,'review',code);};
  if(!pdf&&!word&&!image&&!text)return fail('unsupported');
  const imageRecovery=image&&policy.restoration&&['failed','partial'].includes(String(row.parse_status))&&(await this.host.all('SELECT 1 FROM material_image_ocr_receipts WHERE resource_id=? AND version=? LIMIT 1',[id,String(resource.version)])).length>0;
  if(!pdf&&!imageRecovery&&!['ready','parsed','chunked','indexed','graph_extracted'].includes(String(row.parse_status))){if(['failed','partial','needs_ocr'].includes(String(row.parse_status))||row.parse_status==='needs_parser'&&!String(row.parse_engine).endsWith(':pending'))await fail('local_parse_failed');return;}
  let total=Number(resource.total);
  if(pdf){
   const job=(await this.host.all('SELECT * FROM material_pdf_jobs WHERE resource_id=? AND version=?',[id,String(resource.version)]))[0];if(!job){if(row.parse_status==='failed')await fail('local_parse_failed');return;}total=Number(job.total);
   // Page receipts are staging facts. Canonical source chunks are available only after publication.
   if(!['complete','partial'].includes(String(job.state))||!['ready','partial','parsed','chunked','indexed','graph_extracted'].includes(String(row.parse_status))){if(row.parse_status==='failed'&&job.state!=='processing')await fail('local_parse_failed');return;}
   if(unit<=total){const page=(await this.host.all('SELECT status,result_json,error FROM material_pdf_pages WHERE generation=? AND page=?',[String(job.generation),unit]))[0];if(!page||['pending','running','processing'].includes(String(page.status)))return;
    // Skip only explicit, successfully read covers. Failed/unclear OCR can never justify discarding a page.
    if(await this.skipCover(grant,resource,total,unit,String(job.generation),page))return;
    if(!['complete','blank','failed','needs_review'].includes(String(page.status))){await this.host.run('UPDATE material_folder_ai_resources SET total=? WHERE batch_id=? AND resource_id=?',[total,String(grant.batch_id),id]);return this.finishUnit({...resource,total},unit,'review','local_page_failed');}
   }
  }else if(total<0){total=word?(await this.host.word().questions({schemaVersion:'xiaozhi.word-question-source.v1',resourceId:id,version:String(resource.version),offset:0}))?.total??0:image?1:Number((await this.host.all('SELECT COUNT(*) n FROM resource_chunks WHERE resource_id=?',[id]))[0]?.n||0);}
  await this.host.run('UPDATE material_folder_ai_resources SET total=? WHERE batch_id=? AND resource_id=?',[total,String(grant.batch_id),id]);
  if(!total)return fail('no_structured_content');if(unit>total){
   if((await this.host.all("SELECT 1 FROM material_folder_ai_units WHERE batch_id=? AND resource_id=? AND unit=? AND state='pending_local' AND ai_batch_id=''",[String(grant.batch_id),id,unit])).length)return this.finishUnit({...resource,total},unit,'review','no_structured_content');
   await this.host.run("UPDATE material_folder_ai_resources SET status='complete' WHERE batch_id=? AND resource_id=?",[String(grant.batch_id),id]);return;
  }
  const input={schemaVersion:'xiaozhi.material-ai.v1' as const,resourceId:id,version:String(resource.version),settingsRevision:Number(grant.settings_revision),start:unit,count:1,maxCalls:!word&&!text&&(pdf||policy.mode==='legacy'||image&&process.env.OMNI_EDU_AI_IMAGE_PAGE_BLOCKS!=='0')&&policy.cropReviewPolicy===MATERIAL_CROP_CORRECTION_POLICY?3:2,images:!text,cloudConsent:true as const,publicMaterial:true as const};
  const key=folderTaskKey(grant,resource,unit);
  try{const child=await this.host.ai().create(input,{key,folderId:String(grant.batch_id),revision:Number(grant.revision)});await this.finishUnit({...resource,total},unit,'running','',child);}
  catch(error){const code=this.error(error);
   if(['budget_exhausted','configuration','configuration_changed','paused'].includes(code)){await this.host.run('UPDATE material_folder_ai SET status=?,error=? WHERE batch_id=?',[code==='paused'?'paused':code==='budget_exhausted'?'budget_exhausted':'configuration_changed',code,String(grant.batch_id)]);return;}
   if(['busy','index_busy'].includes(code))return;await this.finishUnit({...resource,total},unit,'review',code);
  }
 }
 private error(error:unknown){const code=(error as Error)?.message;return ['budget_exhausted','configuration','configuration_changed','paused','source_changed','source_incomplete','unit_too_large','privacy_blocked','page_restoration_disabled','unsupported','busy','index_busy','ocr_failed','ocr_unavailable','font_unavailable','font_missing_glyph','disk_full','invalid_response','processing_mode_invalid'].includes(code)?code:'unavailable';}
 async tick(){
  // Two indexed rowid ranges bound each tick and rotate past settled attention cards.
  const eligible=`error<>'scope_changed' AND (status IN ('running','budget_exhausted') OR status='attention' AND (EXISTS(SELECT 1 FROM material_folder_ai_units u WHERE u.batch_id=material_folder_ai.batch_id AND u.state='review' AND u.error='teacher_paused') OR EXISTS(SELECT 1 ${recoveryJoin} WHERE u.batch_id=material_folder_ai.batch_id AND ${recoverable}) OR EXISTS(SELECT 1 ${parseRecoveryJoin} WHERE u.batch_id=material_folder_ai.batch_id AND ${parseRecoverable})))`;
  const grants=await this.host.all(`SELECT rowid grant_rowid,* FROM material_folder_ai WHERE ${eligible} AND rowid>? ORDER BY rowid LIMIT 16`,[this.lastGrantRowid]);
  if(grants.length<16)grants.push(...await this.host.all(`SELECT rowid grant_rowid,* FROM material_folder_ai WHERE ${eligible} AND rowid<=? ORDER BY rowid LIMIT ?`,[this.lastGrantRowid,16-grants.length]));
  for(const grant of grants){
   this.lastGrantRowid=Number(grant.grant_rowid);
   if(this.closing)return;try{
    await this.configured(Number(grant.settings_revision));await this.discover(grant);await this.refresh(grant);await this.recoverLocalWait(grant);await this.recoverLocalParse(grant);
    if(grant.status!=='running')continue;
    if((await this.host.all("SELECT 1 FROM material_folder_ai_units WHERE batch_id=? AND state IN ('pending','running') LIMIT 1",[String(grant.batch_id)])).length)continue;
    const rows=await this.host.all("SELECT rowid plan_rowid,* FROM material_folder_ai_resources WHERE batch_id=? AND status IN ('waiting','running') AND rowid>? ORDER BY rowid LIMIT 8",[String(grant.batch_id),Number(grant.plan_cursor)]);
    if(rows.length<8)rows.push(...await this.host.all("SELECT rowid plan_rowid,* FROM material_folder_ai_resources WHERE batch_id=? AND status IN ('waiting','running') AND rowid<=? ORDER BY rowid LIMIT ?",[String(grant.batch_id),Number(grant.plan_cursor),8-rows.length]));
    for(const row of rows){
     await this.host.run('UPDATE material_folder_ai SET plan_cursor=? WHERE batch_id=?',[Number(row.plan_rowid),String(grant.batch_id)]);await this.plan(grant,row);
     const current=(await this.host.all("SELECT status,EXISTS(SELECT 1 FROM material_folder_ai_units u WHERE u.batch_id=f.batch_id AND u.state IN ('pending','running')) active FROM material_folder_ai f WHERE batch_id=?",[String(grant.batch_id)]))[0];
     if(!current||current.status!=='running'||current.active)break;
    }
    const batch=(await this.host.all('SELECT status FROM material_import_batches WHERE id=?',[String(grant.batch_id)]))[0];
    if(!batch||!['completed','partial','failed'].includes(String(batch.status)))continue;
    const snapshot=(await this.view(String(grant.batch_id)))!;
    await this.host.run(`UPDATE material_folder_ai SET status=? WHERE batch_id=? AND status='running' AND cursor>=(SELECT COALESCE(MAX(seq),0) FROM material_import_entries WHERE batch_id=?) AND NOT EXISTS(SELECT 1 FROM material_folder_ai_resources WHERE batch_id=? AND status IN ('waiting','running')) AND NOT EXISTS(SELECT 1 FROM material_folder_ai_units WHERE batch_id=? AND state IN ('pending','running'))`,[snapshot.review||snapshot.failed||batch.status!=='completed'?'attention':'complete',String(grant.batch_id),String(grant.batch_id),String(grant.batch_id),String(grant.batch_id)]);
   }catch(error){const code=this.error(error);if(code==='processing_mode_invalid')await this.host.run("UPDATE material_folder_ai SET status='attention',error=? WHERE batch_id=?",[code,String(grant.batch_id)]);else if(['configuration','configuration_changed'].includes(code))await this.host.run("UPDATE material_folder_ai SET status='configuration_changed',error=? WHERE batch_id=?",[code,String(grant.batch_id)]);}
  }
 }
}
