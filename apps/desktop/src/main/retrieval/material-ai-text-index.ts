import {createHash} from 'node:crypto';
import {AI_TEXT_SOURCE,validAiTextSource,type AiTextSource} from '../../shared/material-ai-text';
import {validMaterialPageSource,type AiPageView} from '../../shared/material-ai-page';
import {materialSearchTokens} from '../assets/material-full-text';
import type {MaterialReadingUnit} from '../assets/material-source';
type Row=Record<string,unknown>;type Value=string|number|null;
type Host={all:(s:string,p?:Value[])=>Promise<Row[]>;run:(s:string,p?:Value[])=>Promise<void>;page?:(batchId:string,ordinal:number)=>Promise<AiPageView>;clean?:(text:string)=>Promise<string>;write:<T>(action:(index:MaterialAiTextIndex)=>Promise<T>)=>Promise<T>};
const docs='material_ai_text_documents_v1',dirty='material_ai_text_dirty_v1',control='material_ai_text_control_v1',fts='material_body_fts_v1';
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const safe=(alias:string,key:string)=>{const column=(alias?alias+'.':'')+'source_json';return `json_extract(CASE WHEN json_valid(${column}) THEN ${column} ELSE '{}' END,'$.${key}')`;};
const keyId=(r:string,v:string,p:number)=>{const h=digest([r,v,p]);return 'chunk_'+[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20,32)].join('-');};
const readable="('ready','partial','parsed','chunked','indexed','graph_extracted')";
/** Rebuildable page documents using the original FTS and vector event clock. No OCR rows are created. */
export class MaterialAiTextIndex{
 constructor(private host:Host){}
 async migrate(reset=false){
  for(const sql of [
   `CREATE TABLE IF NOT EXISTS ${docs}(id TEXT PRIMARY KEY,resource_id TEXT NOT NULL,version TEXT NOT NULL,page_number INTEGER NOT NULL,batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,source_json TEXT NOT NULL,content_md TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 0,UNIQUE(resource_id,version,page_number))`,
   `CREATE INDEX IF NOT EXISTS material_ai_text_unit_v1 ON ${docs}(batch_id,ordinal)`,
   `CREATE INDEX IF NOT EXISTS material_ai_text_resource_v1 ON ${docs}(resource_id,page_number,active)`,
   `CREATE TABLE IF NOT EXISTS ${dirty}(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,error TEXT NOT NULL DEFAULT '',retry_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(batch_id,ordinal))`,
   `CREATE TABLE IF NOT EXISTS ${control}(id INTEGER PRIMARY KEY CHECK(id=1),cursor INTEGER NOT NULL DEFAULT 0)`,
   `INSERT OR IGNORE INTO ${control}(id) VALUES(1)`
  ])await this.host.run(sql);
  const tables=new Set((await this.host.all("SELECT name FROM sqlite_master WHERE type='table'")).map(r=>r.name));
  if(tables.has('material_ai_page_units')){
   await this.host.run(`CREATE INDEX IF NOT EXISTS material_ai_page_origin_v1 ON material_ai_page_units(${safe('','resourceId')},${safe('','version')},${safe('','page')})`);
   const queue=(select:string)=>`INSERT INTO ${dirty}(batch_id,ordinal) ${select} ON CONFLICT(batch_id,ordinal) DO UPDATE SET revision=revision+1,error='',retry_at=0;`;
   const invalidate=(where:string)=>`${queue(`SELECT batch_id,ordinal FROM ${docs} WHERE ${where}`)} INSERT INTO retrieval_changes(kind,object_id) SELECT 'material',id FROM ${docs} WHERE ${where};`;
   for(const [table,events]of [
    ['teacher_resources',[['UPDATE OF content_hash,parse_status','old.id'],['DELETE','old.id']]],
    ['resource_chunks',[['INSERT','new.resource_id'],['UPDATE OF resource_id,content_md,contains_personal_data,page_number,chunk_index','old.resource_id'],['DELETE','old.resource_id']]],
    ['material_pdf_jobs',[['UPDATE','old.resource_id'],['DELETE','old.resource_id']]],
    ['material_pdf_pages',[['INSERT','(SELECT resource_id FROM material_pdf_jobs WHERE generation=new.generation)'],['UPDATE','(SELECT resource_id FROM material_pdf_jobs WHERE generation=old.generation)'],['DELETE','(SELECT resource_id FROM material_pdf_jobs WHERE generation=old.generation)']]]
   ] as [string,[string,string][]][]){if(!tables.has(table))continue;for(const [i,[event,resource]]of events.entries()){
    const changed=event.startsWith('UPDATE'),page=table==='material_pdf_pages'?` AND page_number ${changed?'IN (old.page,new.page)':'='+(event==='INSERT'?'new':'old')+'.page'}`:'';
    const parents=changed&&table==='material_pdf_pages'?`resource_id IN (SELECT resource_id FROM material_pdf_jobs WHERE generation IN (old.generation,new.generation))`:changed&&['resource_chunks','material_pdf_jobs'].includes(table)?`resource_id IN (old.resource_id,new.resource_id)`:`resource_id=${resource}`;
    const version=changed&&table!=='teacher_resources'?'v2':'v1';if(version==='v2')await this.host.run(`DROP TRIGGER IF EXISTS ai_text_parent_${table}_${i}_v1`);
    await this.host.run(`CREATE TRIGGER IF NOT EXISTS ai_text_parent_${table}_${i}_${version} AFTER ${event} ON ${table} BEGIN ${invalidate(`${parents}${page}`)} END`);
   }}
   for(const table of ['material_ai_page_units','material_ai_units','material_ai_image_inputs'])if(tables.has(table))for(const [i,event]of ['INSERT','UPDATE','DELETE'].entries()){
    const ref=event==='INSERT'?'new':'old';
    const affected=`SELECT p.batch_id,p.ordinal FROM material_ai_page_units p WHERE p.batch_id=${ref}.batch_id AND p.ordinal=${ref}.ordinal`;
    const samePage=`resource_id IN (SELECT ${safe('p','resourceId')} FROM material_ai_page_units p WHERE p.batch_id=${ref}.batch_id AND p.ordinal=${ref}.ordinal) AND page_number IN (SELECT ${safe('p','page')} FROM material_ai_page_units p WHERE p.batch_id=${ref}.batch_id AND p.ordinal=${ref}.ordinal)`;
    await this.host.run(`CREATE TRIGGER IF NOT EXISTS ai_text_receipt_${table}_${i}_v1 BEFORE ${event} ON ${table} BEGIN ${queue(affected)} ${event==='INSERT'&&table==='material_ai_page_units'?queue(`SELECT new.batch_id,new.ordinal WHERE true`):''} ${invalidate(`(batch_id=${ref}.batch_id AND ordinal=${ref}.ordinal) OR (${samePage})`)} END`);
   }
   if(tables.has('material_ai_batches'))for(const [i,event]of ['UPDATE OF config_json,resource_id,version','DELETE'].entries())await this.host.run(`CREATE TRIGGER IF NOT EXISTS ai_text_batch_${i}_v1 BEFORE ${event} ON material_ai_batches BEGIN ${queue('SELECT batch_id,ordinal FROM material_ai_page_units WHERE batch_id=old.id')} ${invalidate('batch_id=old.id')} END`);
  }
  for(const [event,ref]of [['INSERT','new'],['UPDATE','new'],['DELETE','old']])await this.host.run(`CREATE TRIGGER IF NOT EXISTS ai_text_clock_${event.toLowerCase()}_v1 AFTER ${event} ON ${docs} BEGIN INSERT INTO retrieval_changes(kind,object_id) VALUES('material',${ref}.id); END`);
  if(reset)await this.reset();
 }
 async reset(){await this.host.run(`UPDATE ${control} SET cursor=0 WHERE id=1`);await this.host.run(`UPDATE ${dirty} SET error='',retry_at=0,revision=revision+1`);}
 private async latest(resourceId:string,version:string,page:number){
  return(await this.host.all(`SELECT p.batch_id,p.ordinal,p.first_sha,p.final_sha,p.image_sha,u.status FROM material_ai_page_units p JOIN material_ai_batches b ON b.id=p.batch_id JOIN material_ai_units u ON u.batch_id=p.batch_id AND u.ordinal=p.ordinal WHERE ${safe('p','resourceId')}=? AND ${safe('p','version')}=? AND ${safe('p','page')}=? AND u.status NOT IN ('pending','first_saved','dispatched') ORDER BY b.created_at DESC,b.id DESC,p.ordinal DESC LIMIT 1`,[resourceId,version,page]))[0];
 }
 private async discover(){
  const exists=(await this.host.all("SELECT 1 FROM sqlite_master WHERE name='material_ai_page_units'")).length;if(!exists)return;
  const rows=await this.host.all(`SELECT rowid,batch_id,ordinal FROM material_ai_page_units WHERE rowid>(SELECT cursor FROM ${control} WHERE id=1) ORDER BY rowid LIMIT 8`);
  if(rows.length)await this.host.write(async target=>{for(const row of rows)await target.host.run(`INSERT OR IGNORE INTO ${dirty}(batch_id,ordinal) VALUES(?,?)`,[String(row.batch_id),Number(row.ordinal)]);await target.host.run(`UPDATE ${control} SET cursor=MAX(cursor,?) WHERE id=1`,[Number(rows.at(-1)!.rowid)]);});
 }
 async drain(){
  if(process.env.OMNI_EDU_AI_TEXT_INDEX==='0'||!this.host.page)return 0;
  await this.discover();const rows=await this.host.all(`SELECT * FROM ${dirty} WHERE error='' AND retry_at<=? ORDER BY rowid LIMIT 4`,[Date.now()]);
  for(const row of rows){
   const batchId=String(row.batch_id),ordinal=Number(row.ordinal),revision=Number(row.revision);
   let source:AiTextSource|undefined,view:AiPageView|undefined,error='';
   const slot=(await this.host.all('SELECT source_json FROM material_ai_page_units WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0],old=(await this.host.all(`SELECT * FROM ${docs} WHERE batch_id=? AND ordinal=? LIMIT 1`,[batchId,ordinal]))[0];
   let origin:{resourceId:string;version:string;page:number}|undefined;try{origin=slot?JSON.parse(String(slot.source_json)):old?{resourceId:String(old.resource_id),version:String(old.version),page:Number(old.page_number)}:undefined;}catch{}
   try{
    if(!origin||slot&&!validMaterialPageSource(origin))throw Error('source_changed');
    const resource=(await this.host.all('SELECT content_hash FROM teacher_resources WHERE id=?',[String(origin.resourceId)]))[0];if(!resource||resource.content_hash!==origin.version)throw Error('retired_source');
    const latest=await this.latest(String(origin.resourceId),String(origin.version),Number(origin.page));if(!latest){const current=(await this.host.all('SELECT status FROM material_ai_units WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0];throw Error(['pending','first_saved','dispatched'].includes(String(current?.status))?'busy':'source_changed');}
    view=await this.host.page!(String(latest.batch_id),Number(latest.ordinal));
    if(view.status!=='complete'&&view.status!=='blank')throw Error('page_needs_review');
    if(this.host.clean&&await this.host.clean(view.text)!==view.text)throw Error('privacy_blocked');
    const after=await this.latest(view.source.resourceId,view.source.version,view.source.page);if(JSON.stringify(after)!==JSON.stringify(latest))throw Error('source_changed');
    source={schemaVersion:AI_TEXT_SOURCE,resourceId:view.source.resourceId,version:view.source.version,page:view.source.page,offset:0,chunkId:keyId(view.source.resourceId,view.source.version,view.source.page),batchId:String(latest.batch_id),ordinal:Number(latest.ordinal),finalSha:String(latest.final_sha),bodyVersion:digest([view.source,latest.first_sha,latest.final_sha,latest.image_sha,view.text])};if(!validAiTextSource(source))throw Error('source_changed');
   }catch(e){error=['busy','index_busy'].includes((e as Error).message)?'busy':['privacy_blocked','page_needs_review','retired_source'].includes((e as Error).message)?(e as Error).message:'source_changed';}
   await this.host.write(async target=>{
    const current=(await target.host.all(`SELECT revision FROM ${dirty} WHERE batch_id=? AND ordinal=?`,[batchId,ordinal]))[0];if(current?.revision!==revision)return;
    if(error==='busy'){await target.host.run(`UPDATE ${dirty} SET retry_at=? WHERE batch_id=? AND ordinal=? AND revision=?`,[Date.now()+2000,batchId,ordinal,revision]);return;}
    if(old&&(!source||source.chunkId!==old.id))await target.disable(String(old.id));
    if(!source&&origin?.resourceId&&origin?.version&&Number.isSafeInteger(origin.page))await target.disable(keyId(String(origin.resourceId),String(origin.version),Number(origin.page)));
    if(source&&view){
     const latest=await target.latest(source.resourceId,source.version,source.page);if(!latest||latest.batch_id!==source.batchId||Number(latest.ordinal)!==source.ordinal||latest.final_sha!==source.finalSha)return;
     const same=(await target.host.all(`SELECT rowid,source_json,content_md,active FROM ${docs} WHERE id=?`,[source.chunkId]))[0];
     if(!same||same.source_json!==JSON.stringify(source)||same.content_md!==view.text||same.active!==1)await target.host.run(`INSERT INTO ${docs}(id,resource_id,version,page_number,batch_id,ordinal,source_json,content_md,active) VALUES(?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET batch_id=excluded.batch_id,ordinal=excluded.ordinal,source_json=excluded.source_json,content_md=excluded.content_md,active=1`,[source.chunkId,source.resourceId,source.version,source.page,source.batchId,source.ordinal,JSON.stringify(source),view.text]);
     const saved=(await target.host.all(`SELECT rowid FROM ${docs} WHERE id=?`,[source.chunkId]))[0];await target.host.run(`DELETE FROM ${fts} WHERE rowid=?`,[-Number(saved.rowid)]);
     if(view.text)await target.host.run(`INSERT INTO ${fts}(rowid,tokens,normalised) VALUES(?,?,?)`,[-Number(saved.rowid),materialSearchTokens(view.text),Array.from(view.text.normalize('NFKC').toLowerCase().replace(/\s+/gu,'')).join('')]);
     await target.host.run(`DELETE FROM ${dirty} WHERE error<>'' AND EXISTS(SELECT 1 FROM material_ai_page_units p WHERE p.batch_id=${dirty}.batch_id AND p.ordinal=${dirty}.ordinal AND ${safe('p','resourceId')}=? AND ${safe('p','version')}=? AND ${safe('p','page')}=?)`,[source.resourceId,source.version,source.page]);
     await target.host.run(`DELETE FROM ${dirty} WHERE batch_id=? AND ordinal=? AND revision=?`,[batchId,ordinal,revision]);
    }else if(error==='retired_source')await target.host.run(`DELETE FROM ${dirty} WHERE batch_id=? AND ordinal=? AND revision=?`,[batchId,ordinal,revision]);
    else await target.host.run(`UPDATE ${dirty} SET error=? WHERE batch_id=? AND ordinal=? AND revision=?`,[error||'source_changed',batchId,ordinal,revision]);
   });
  }
  return rows.length;
 }
 private async disable(id:string){const row=(await this.host.all(`SELECT rowid FROM ${docs} WHERE id=?`,[id]))[0];if(!row)return;await this.host.run(`DELETE FROM ${fts} WHERE rowid=?`,[-Number(row.rowid)]);await this.host.run(`UPDATE ${docs} SET active=0,content_md='' WHERE id=? AND (active<>0 OR content_md<>'')`,[id]);}
 async status(){
  const r=(await this.host.all(`SELECT (SELECT COUNT(*) FROM ${dirty} WHERE error='') pending,(SELECT COUNT(*) FROM ${dirty} WHERE error<>'') blocked,(SELECT COUNT(*) FROM ${docs} WHERE active=1 AND content_md<>'') ready`))[0];
  const slots=(await this.host.all("SELECT 1 FROM sqlite_master WHERE name='material_ai_page_units'")).length;
  const backfilling=!!(slots&&(await this.host.all(`SELECT 1 FROM material_ai_page_units WHERE rowid>(SELECT cursor FROM ${control} WHERE id=1) LIMIT 1`)).length);
  return{pending:Number(r.pending),blocked:Number(r.blocked),ready:Number(r.ready),backfilling};
 }
 async read(source:AiTextSource){
  if(!validAiTextSource(source)||!this.host.page)throw Error('invalid_input');
  const row=(await this.host.all(`SELECT d.*,r.original_file_name source_name,COALESCE(k.seq,0) seq,COALESCE(v.revision,0) source_revision FROM ${docs} d JOIN teacher_resources r ON r.id=d.resource_id LEFT JOIN retrieval_current k ON k.kind='material' AND k.object_id=d.id LEFT JOIN retrieval_source_revisions v ON v.resource_id=d.resource_id WHERE d.id=? AND d.active=1 AND r.content_hash=d.version AND r.parse_status IN ${readable}`,[source.chunkId]))[0];
  const matches=(json:unknown)=>{try{const saved=JSON.parse(String(json));return validAiTextSource(saved)&&Object.keys(source).every(k=>saved[k as keyof AiTextSource]===source[k as keyof AiTextSource]);}catch{return false;}};
  if(!row||!matches(row.source_json))throw Error('source_changed');
  const latest=await this.latest(source.resourceId,source.version,source.page);
  if(!latest||latest.batch_id!==source.batchId||Number(latest.ordinal)!==source.ordinal||latest.final_sha!==source.finalSha)throw Error('source_changed');
  const view=await this.host.page(source.batchId,source.ordinal);
  if(!['complete','blank'].includes(view.status)||view.text!==row.content_md||view.source.resourceId!==source.resourceId||view.source.version!==source.version||view.source.page!==source.page||digest([view.source,latest.first_sha,latest.final_sha,latest.image_sha,view.text])!==source.bodyVersion||this.host.clean&&await this.host.clean(view.text)!==view.text)throw Error('source_changed');
  const after=(await this.host.all(`SELECT d.source_json,d.active,COALESCE(k.seq,0) seq,COALESCE(v.revision,0) source_revision FROM ${docs} d LEFT JOIN retrieval_current k ON k.kind='material' AND k.object_id=d.id LEFT JOIN retrieval_source_revisions v ON v.resource_id=d.resource_id WHERE d.id=?`,[source.chunkId]))[0];if(after?.active!==1||!matches(after.source_json)||Number(after.seq)!==Number(row.seq)||Number(after.source_revision)!==Number(row.source_revision))throw Error('source_changed');
  return{view,seq:Number(row.seq)};
 }
 async unit(id:string):Promise<{unit:MaterialReadingUnit;seq:number}|undefined>{
  const row=(await this.host.all(`SELECT source_json FROM ${docs} WHERE id=? AND active=1 AND content_md<>''`,[id]))[0];if(!row)return;
  try{const source=JSON.parse(String(row.source_json));if(!validAiTextSource(source))return;const {view,seq}=await this.read(source),chunk={id,resourceId:source.resourceId,resourceTitle:view.resource.title,chunkIndex:0,heading:'AI还原正文',contentMd:view.text,pageNumber:source.page,subject:'',grade:'',knowledgePoint:'',questionType:'',difficulty:'',sourceTrust:'unverified' as const,containsPersonalData:false,qualityScore:0,evidenceStrength:'background' as const,embeddingStatus:'pending',createdAt:''};return{unit:{resourceId:source.resourceId,version:source.version,title:view.resource.originalFileName,offset:0,chunk,restored:source},seq};}catch{return;}
 }
}
