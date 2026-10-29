import {MATERIAL_FOLDER_AI_SCHEMA as schema,validFolderAiGrant,validFolderAiAction,type FolderAiGrant,type FolderAiAction,type FolderAiView} from '../../shared/material-folder-ai';
import {materialBatchId} from '../../shared/material-import-batch';
import {createHash} from 'node:crypto';
import type {MaterialAiRepository} from './material-ai-repository';
import type {MaterialWordRepository} from './material-word-repository';
type Row=Record<string,unknown>;type Value=string|number|null;
type Host={all:(sql:string,p?:Value[])=>Promise<Row[]>;run:(sql:string,p?:Value[])=>Promise<void>;ai:()=>MaterialAiRepository;word:()=>MaterialWordRepository;writer:<T>(action:(target:MaterialFolderAiRepository)=>Promise<T>)=>Promise<T>};
export class MaterialFolderAiRepository{
 private timer?:ReturnType<typeof setInterval>;private pumping?:Promise<void>;private closing=false;
 constructor(private host:Host){}
 async migrate(){
  for(const sql of [
   `CREATE TABLE IF NOT EXISTS material_folder_ai(batch_id TEXT PRIMARY KEY,status TEXT NOT NULL,revision INTEGER NOT NULL,settings_revision INTEGER NOT NULL,max_calls INTEGER NOT NULL,cursor INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '')`,
   `CREATE TABLE IF NOT EXISTS material_folder_ai_resources(batch_id TEXT NOT NULL,resource_id TEXT NOT NULL,version TEXT NOT NULL,cursor INTEGER NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT -1,status TEXT NOT NULL DEFAULT 'waiting',error TEXT NOT NULL DEFAULT '',PRIMARY KEY(batch_id,resource_id))`,
   `CREATE INDEX IF NOT EXISTS idx_folder_ai_resources ON material_folder_ai_resources(batch_id,status)`,
   `CREATE TABLE IF NOT EXISTS material_folder_ai_units(batch_id TEXT NOT NULL,resource_id TEXT NOT NULL,version TEXT NOT NULL,unit INTEGER NOT NULL,state TEXT NOT NULL,ai_batch_id TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '',PRIMARY KEY(batch_id,resource_id,unit))`,
   `CREATE INDEX IF NOT EXISTS idx_folder_ai_units ON material_folder_ai_units(batch_id,state)`,
   `CREATE INDEX IF NOT EXISTS idx_folder_ai_keys ON material_ai_task_keys(folder_id)`,
   `CREATE INDEX IF NOT EXISTS idx_folder_ai_discovery ON material_import_entries(batch_id,seq)`
  ])await this.host.run(sql);
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
   if(prior&&Number(prior.settings_revision)!==input.settingsRevision)throw Error('configuration_changed');
   const reserved=Number((await target.host.all("SELECT COALESCE(SUM(json_extract(b.config_json,'$.maxCalls')),0) n FROM material_ai_task_keys k JOIN material_ai_batches b ON b.id=k.batch_id WHERE k.folder_id=?",[input.batchId]))[0]?.n||0);if(input.maxCalls<reserved)throw Error('budget_exhausted');
   await target.host.run("INSERT INTO material_folder_ai(batch_id,status,revision,settings_revision,max_calls) VALUES(?,'running',1,?,?) ON CONFLICT(batch_id) DO UPDATE SET status='running',max_calls=excluded.max_calls,error=''",[input.batchId,input.settingsRevision,input.maxCalls]);
  });return (await this.view(input.batchId))!;
 }
 async action(input:FolderAiAction):Promise<FolderAiView>{
  if(!validFolderAiAction(input))throw Error('invalid_input');const grant=(await this.host.all('SELECT * FROM material_folder_ai WHERE batch_id=?',[input.batchId]))[0];if(!grant)throw Error('invalid_input');
  if(input.action==='resume'){if(grant.error==='scope_changed')throw Error('consent_required');await this.configured(Number(grant.settings_revision));}
  await this.host.run('UPDATE material_folder_ai SET status=? WHERE batch_id=?',[input.action==='pause'?'paused':'running',input.batchId]);
  if(input.action==='pause'){
   const rows=await this.host.all("SELECT b.id FROM material_ai_task_keys k JOIN material_ai_batches b ON b.id=k.batch_id WHERE k.folder_id=? AND b.status='running'",[input.batchId]);
   for(const row of rows)await this.host.ai().action({schemaVersion:'xiaozhi.material-ai.v1',batchId:String(row.id),action:'pause'});
  }return (await this.view(input.batchId))!;
 }
 async pauseAll(){for(const row of await this.host.all("SELECT batch_id FROM material_folder_ai WHERE status IN ('running','budget_exhausted')"))await this.action({schemaVersion:schema,batchId:String(row.batch_id),action:'pause'});}
 async view(id:string):Promise<FolderAiView|undefined>{
  if(!materialBatchId(id))throw Error('invalid_input');const grant=(await this.host.all('SELECT * FROM material_folder_ai WHERE batch_id=?',[id]))[0];if(!grant)return;
  const sums=(await this.host.all("SELECT COUNT(*) units,SUM(state='complete') complete,SUM(state='review') review,SUM(state='failed') failed,SUM(state IN ('pending','running')) waiting FROM material_folder_ai_units WHERE batch_id=?",[id]))[0];
  const billing=(await this.host.all("SELECT COALESCE(SUM(b.calls),0) calls,COALESCE(SUM(json_extract(b.config_json,'$.maxCalls')),0) reserved FROM material_ai_task_keys k JOIN material_ai_batches b ON b.id=k.batch_id WHERE k.folder_id=?",[id]))[0];
  const count=(await this.host.all('SELECT COUNT(*) n FROM material_folder_ai_resources WHERE batch_id=?',[id]))[0];
  const questions=(await this.host.all("SELECT SUM(json_extract(q.archive_json,'$.state')='ai_final') ready,SUM(json_extract(q.archive_json,'$.state')='ai_needs_review') review FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id JOIN material_ai_task_keys k ON k.batch_id=m.batch_id WHERE k.folder_id=? AND json_valid(q.archive_json)",[id]))[0];
  const issues=await this.host.all("SELECT u.resource_id,r.title,u.unit,u.error FROM material_folder_ai_units u LEFT JOIN teacher_resources r ON r.id=u.resource_id WHERE u.batch_id=? AND u.state IN ('failed','review') ORDER BY u.rowid LIMIT 5",[id]);
  return{schemaVersion:schema,batchId:id,status:String(grant.status),revision:Number(grant.revision),maxCalls:Number(grant.max_calls),calls:Number(billing.calls),reserved:Number(billing.reserved),resources:Number(count.n),units:Number(sums.units),complete:Number(sums.complete||0),review:Number(sums.review||0),failed:Number(sums.failed||0),waiting:Number(sums.waiting||0),readyQuestions:Number(questions.ready||0),reviewQuestions:Number(questions.review||0),error:String(grant.error),issues:issues.map(r=>({resourceId:String(r.resource_id),title:String(r.title||'本地资料'),unit:Number(r.unit),error:String(r.error)}))};
 }
 private async discover(grant:Row){
  const id=String(grant.batch_id),rows=await this.host.all('SELECT e.seq,e.status,e.resource_id,r.content_hash FROM material_import_entries e LEFT JOIN teacher_resources r ON r.id=e.resource_id WHERE e.batch_id=? AND e.seq>? ORDER BY e.seq LIMIT 32',[id,Number(grant.cursor)]);
  for(const row of rows){if(row.status==='saved'&&row.resource_id&&row.content_hash)await this.host.run('INSERT OR IGNORE INTO material_folder_ai_resources(batch_id,resource_id,version) VALUES(?,?,?)',[id,String(row.resource_id),String(row.content_hash)]);await this.host.run('UPDATE material_folder_ai SET cursor=MAX(cursor,?) WHERE batch_id=?',[Number(row.seq),id]);}
 }
 private async refresh(grant:Row){
  const id=String(grant.batch_id),rows=await this.host.all("SELECT u.resource_id,u.unit,u.ai_batch_id,a.status,a.error,b.status batch_status FROM material_folder_ai_units u JOIN material_ai_units a ON a.batch_id=u.ai_batch_id AND a.ordinal=1 JOIN material_ai_batches b ON b.id=a.batch_id WHERE u.batch_id=? AND u.state IN ('pending','running') ORDER BY u.rowid LIMIT 32",[id]);
  for(const row of rows){
   const state=['complete','no_questions'].includes(String(row.status))?'complete':row.status==='review'||row.status==='outcome_unknown'?'review':row.status==='failed'?'failed':undefined;
   if(state)await this.host.run('UPDATE material_folder_ai_units SET state=?,error=? WHERE batch_id=? AND resource_id=? AND unit=?',[state,String(row.error||(state==='complete'?'':'needs_review')),id,String(row.resource_id),Number(row.unit)]);
   else if(row.batch_status==='paused'&&grant.status==='running'&&['pending','first_saved'].includes(String(row.status)))await this.host.ai().action({schemaVersion:'xiaozhi.material-ai.v1',batchId:String(row.ai_batch_id),action:'resume'});
  }
 }
 private async finishUnit(resource:Row,unit:number,state:string,error='',aiBatch=''){
  await this.host.run("INSERT INTO material_folder_ai_units(batch_id,resource_id,version,unit,state,ai_batch_id,error) VALUES(?,?,?,?,?,?,?) ON CONFLICT(batch_id,resource_id,unit) DO UPDATE SET state=excluded.state,ai_batch_id=excluded.ai_batch_id,error=excluded.error",[String(resource.batch_id),String(resource.resource_id),String(resource.version),unit,state,aiBatch,error]);
  await this.host.run("UPDATE material_folder_ai_resources SET cursor=MAX(cursor,?),status=CASE WHEN ?>=total THEN 'complete' ELSE 'running' END WHERE batch_id=? AND resource_id=?",[unit,unit,String(resource.batch_id),String(resource.resource_id)]);
 }
 private async plan(grant:Row,resource:Row){
  const id=String(resource.resource_id),row=(await this.host.all('SELECT * FROM teacher_resources WHERE id=?',[id]))[0],unit=Number(resource.cursor)+1;
  if(!row||row.content_hash!==resource.version){await this.host.run('UPDATE material_folder_ai_resources SET total=? WHERE batch_id=? AND resource_id=?',[unit,String(grant.batch_id),id]);await this.finishUnit(resource,unit,'review','source_changed');return;}
  const name=String(row.original_file_name),pdf=/\.pdf$/i.test(name),word=/\.docx$/i.test(name),image=/\.(?:png|jpe?g|webp)$/i.test(name),text=/\.(?:txt|md)$/i.test(name);
  const fail=async(code:string)=>{await this.host.run('UPDATE material_folder_ai_resources SET total=? WHERE batch_id=? AND resource_id=?',[unit,String(grant.batch_id),id]);await this.finishUnit(resource,unit,'review',code);};
  if(!pdf&&!word&&!image&&!text)return fail('unsupported');
  if(!pdf&&!['ready','parsed','chunked','indexed','graph_extracted'].includes(String(row.parse_status))){if(['failed','partial','needs_ocr'].includes(String(row.parse_status))||row.parse_status==='needs_parser'&&!String(row.parse_engine).endsWith(':pending'))await fail('local_parse_failed');return;}
  let total=Number(resource.total);
  if(pdf){
   const job=(await this.host.all('SELECT * FROM material_pdf_jobs WHERE resource_id=? AND version=?',[id,String(resource.version)]))[0];if(!job){if(row.parse_status==='failed')await fail('local_parse_failed');return;}total=Number(job.total);
   if(unit<=total){const page=(await this.host.all('SELECT status FROM material_pdf_pages WHERE generation=? AND page=?',[String(job.generation),unit]))[0];if(!page||page.status==='pending'||page.status==='running')return;
    if(page.status!=='complete'){await this.host.run('UPDATE material_folder_ai_resources SET total=? WHERE batch_id=? AND resource_id=?',[total,String(grant.batch_id),id]);return this.finishUnit({...resource,total},unit,'review',page.status==='blank'?'blank_page_requires_check':'local_page_failed');}
   }
  }else if(total<0){total=word?(await this.host.word().questions({schemaVersion:'xiaozhi.word-question-source.v1',resourceId:id,version:String(resource.version),offset:0}))?.total??0:image?1:Number((await this.host.all('SELECT COUNT(*) n FROM resource_chunks WHERE resource_id=?',[id]))[0]?.n||0);}
  await this.host.run('UPDATE material_folder_ai_resources SET total=? WHERE batch_id=? AND resource_id=?',[total,String(grant.batch_id),id]);
  if(!total)return fail('no_structured_content');if(unit>total){await this.host.run("UPDATE material_folder_ai_resources SET status='complete' WHERE batch_id=? AND resource_id=?",[String(grant.batch_id),id]);return;}
  const input={schemaVersion:'xiaozhi.material-ai.v1' as const,resourceId:id,version:String(resource.version),settingsRevision:Number(grant.settings_revision),start:unit,count:1,maxCalls:2,images:!text,cloudConsent:true as const,publicMaterial:true as const};
  const key=createHash('sha256').update(JSON.stringify([schema,grant.batch_id,grant.revision,id,resource.version,unit])).digest('hex');
  try{const child=await this.host.ai().create(input,{key,folderId:String(grant.batch_id),revision:Number(grant.revision)});await this.finishUnit({...resource,total},unit,'running','',child);}
  catch(error){const code=this.error(error);
   if(['budget_exhausted','configuration','configuration_changed','paused'].includes(code)){await this.host.run('UPDATE material_folder_ai SET status=?,error=? WHERE batch_id=?',[code==='paused'?'paused':code==='budget_exhausted'?'budget_exhausted':'configuration_changed',code,String(grant.batch_id)]);return;}
   if(['busy','index_busy'].includes(code))return;await this.finishUnit({...resource,total},unit,'review',code);
  }
 }
 private error(error:unknown){const code=(error as Error)?.message;return ['budget_exhausted','configuration','configuration_changed','paused','source_changed','source_incomplete','unit_too_large','privacy_blocked','unsupported','busy','index_busy','ocr_failed','ocr_unavailable','font_unavailable','font_missing_glyph','disk_full','invalid_response'].includes(code)?code:'unavailable';}
 async tick(){
  for(const grant of await this.host.all("SELECT * FROM material_folder_ai WHERE status IN ('running','budget_exhausted') ORDER BY rowid LIMIT 16")){
   if(this.closing)return;try{
    await this.configured(Number(grant.settings_revision));await this.discover(grant);await this.refresh(grant);
    if(grant.status==='budget_exhausted')continue;
    if((await this.host.all("SELECT 1 FROM material_folder_ai_units WHERE batch_id=? AND state IN ('pending','running') LIMIT 1",[String(grant.batch_id)])).length)continue;
    const rows=await this.host.all("SELECT * FROM material_folder_ai_resources WHERE batch_id=? AND status IN ('waiting','running') ORDER BY rowid LIMIT 8",[String(grant.batch_id)]);
    for(const row of rows){await this.plan(grant,row);if((await this.host.all("SELECT 1 FROM material_folder_ai_units WHERE batch_id=? AND state IN ('pending','running') LIMIT 1",[String(grant.batch_id)])).length)break;}
    const batch=(await this.host.all('SELECT status FROM material_import_batches WHERE id=?',[String(grant.batch_id)]))[0];
    if(!batch||!['completed','partial','failed'].includes(String(batch.status)))continue;
    const snapshot=(await this.view(String(grant.batch_id)))!;
    await this.host.run(`UPDATE material_folder_ai SET status=? WHERE batch_id=? AND status='running' AND cursor>=(SELECT COALESCE(MAX(seq),0) FROM material_import_entries WHERE batch_id=?) AND NOT EXISTS(SELECT 1 FROM material_folder_ai_resources WHERE batch_id=? AND status IN ('waiting','running')) AND NOT EXISTS(SELECT 1 FROM material_folder_ai_units WHERE batch_id=? AND state IN ('pending','running'))`,[snapshot.review||snapshot.failed||batch.status!=='completed'?'attention':'complete',String(grant.batch_id),String(grant.batch_id),String(grant.batch_id),String(grant.batch_id)]);
   }catch(error){const code=this.error(error);if(['configuration','configuration_changed'].includes(code))await this.host.run("UPDATE material_folder_ai SET status='configuration_changed',error=? WHERE batch_id=?",[code,String(grant.batch_id)]);}
  }
 }
}
