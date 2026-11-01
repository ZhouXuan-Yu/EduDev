import {createHash} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import {archiveEligible,validQuestionArchive} from '../../shared/question-archive';
import {validMaterialSource,type MaterialSource} from '../../shared/materials';
import {normalizeMaterialStem} from './material-question-extract';
import {answerRuleCandidateHidden,migrateMaterialBookPairs} from './material-book-pairs';
type Row=Record<string,unknown>;type Value=string|number|null;
export type OriginHost={all:(sql:string,p?:Value[])=>Promise<Row[]>;run:(sql:string,p?:Value[])=>Promise<void>};
export type RuleOrigin={sources:MaterialSource[];number:string;stem:string;risks:string[]};
const allowed=(origin:RuleOrigin)=>origin.sources.length>0&&origin.sources.length<=64&&origin.sources.every(s=>validMaterialSource(s)&&s.resourceId===origin.sources[0].resourceId&&s.version===origin.sources[0].version)&&/^\d{1,5}$/.test(origin.number)&&!!origin.stem.trim()&&!origin.risks.some(r=>r!=='visual_unchecked');
const key=(origin:RuleOrigin)=>createHash('sha256').update(JSON.stringify(['source-question.v1',origin.sources.map(s=>[s.resourceId,s.version,s.offset,s.chunkId,s.bodyVersion]),origin.number,normalizeMaterialStem(origin.stem)])).digest('hex');
export async function migrateQuestionOrigins(host:OriginHost){
 await migrateMaterialBookPairs(host);
 const before=new Set((await host.all("SELECT name FROM sqlite_master WHERE type='table'")).map(r=>String(r.name)));
 await host.run("CREATE TABLE IF NOT EXISTS material_question_origins(question_id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('rule','ai')),origin_key TEXT NOT NULL,resource_id TEXT NOT NULL,covered INTEGER NOT NULL DEFAULT 0)");
 await host.run('CREATE INDEX IF NOT EXISTS idx_question_origins_key ON material_question_origins(origin_key,kind)');
 await host.run('CREATE INDEX IF NOT EXISTS idx_question_origins_resource ON material_question_origins(resource_id)');
 await host.run('CREATE INDEX IF NOT EXISTS idx_question_origins_covered ON material_question_origins(covered)');
 if(!before.has('material_question_origins')&&before.has('app_settings'))await host.run("UPDATE app_settings SET value_json=?,updated_at=datetime('now') WHERE key=?",[JSON.stringify({schema:1,cursor:0}),'xiaozhi.question-origins.cursor.v1']);
 for(const [event,ref] of [['INSERT','NEW'],['DELETE','OLD']])await host.run(`CREATE TRIGGER IF NOT EXISTS question_origins_${event.toLowerCase()} AFTER ${event} ON material_question_origins BEGIN
  UPDATE material_question_origins SET covered=CASE WHEN kind='rule' AND (SELECT COUNT(*) FROM material_question_origins x WHERE x.origin_key=${ref}.origin_key AND x.kind='rule')=1 AND EXISTS(SELECT 1 FROM material_question_origins x WHERE x.origin_key=${ref}.origin_key AND x.kind='ai') THEN 1 ELSE 0 END WHERE origin_key=${ref}.origin_key;
  UPDATE material_question_members SET needs_attention=CASE WHEN EXISTS(SELECT 1 FROM material_question_origins o WHERE o.question_id=material_question_members.question_id AND o.covered=1) THEN 0 ELSE 1 END WHERE question_id IN (SELECT question_id FROM material_question_origins WHERE origin_key=${ref}.origin_key AND kind='rule');
  ${event==='DELETE'?"UPDATE material_question_members SET needs_attention=1 WHERE question_id=OLD.question_id AND OLD.kind='rule';":''}
 END`);
 await host.run('DROP TRIGGER IF EXISTS question_origins_question_delete');
 for(const event of ['UPDATE','DELETE'])await host.run(`CREATE TRIGGER IF NOT EXISTS question_origins_question_${event.toLowerCase()} AFTER ${event} ON question_bank_items BEGIN DELETE FROM material_question_origins WHERE question_id=OLD.id; ${event==='DELETE'?'UPDATE material_question_members SET needs_attention=0 WHERE question_id=OLD.id;':''} END`);
 const tables=new Set((await host.all("SELECT name FROM sqlite_master WHERE type='table'")).map(r=>String(r.name)));
 if(tables.has('material_pdf_pages')&&tables.has('material_pdf_jobs'))for(const [event,name,refs,changed]of [
  ['UPDATE OF status,result_json,error,generation,page','update','OLD.generation,NEW.generation','OLD.status<>NEW.status OR OLD.result_json<>NEW.result_json OR OLD.error<>NEW.error OR OLD.generation<>NEW.generation OR OLD.page<>NEW.page'],
  ['DELETE','delete','OLD.generation','']
 ])await host.run(`CREATE TRIGGER IF NOT EXISTS question_origins_pdf_page_${name} AFTER ${event} ON material_pdf_pages ${changed?'WHEN '+changed:''} BEGIN DELETE FROM material_question_origins WHERE resource_id IN (SELECT resource_id FROM material_pdf_jobs WHERE generation IN (${refs})); END`);
 if(tables.has('material_pdf_jobs'))for(const [event,name,changed]of [['UPDATE OF generation,version','update','OLD.generation<>NEW.generation OR OLD.version<>NEW.version'],['DELETE','delete','']])await host.run(`CREATE TRIGGER IF NOT EXISTS question_origins_pdf_job_${name} AFTER ${event} ON material_pdf_jobs ${changed?'WHEN '+changed:''} BEGIN DELETE FROM material_question_origins WHERE resource_id=OLD.resource_id; END`);
 for(const [table,event,field] of [['teacher_resources','UPDATE OF content_hash','id'],['teacher_resources','DELETE','id'],['resource_chunks','UPDATE OF content_md,contains_personal_data,page_number','resource_id'],['resource_chunks','DELETE','resource_id'],['material_word_documents','UPDATE OF version,digest,document_json','resource_id'],['material_word_documents','DELETE','resource_id']])if(tables.has(table)){
  const name=`question_origins_${table}_${event.startsWith('UPDATE')?'update':'delete'}`;
  const changed=event==='DELETE'?'':table==='teacher_resources'?'OLD.content_hash<>NEW.content_hash':table==='resource_chunks'?'OLD.content_md<>NEW.content_md OR OLD.contains_personal_data<>NEW.contains_personal_data OR OLD.page_number IS NOT NEW.page_number':'OLD.version<>NEW.version OR OLD.digest<>NEW.digest OR OLD.document_json<>NEW.document_json';
  await host.run(`DROP TRIGGER IF EXISTS ${name}`);await host.run(`CREATE TRIGGER ${name} AFTER ${event} ON ${table} ${changed?'WHEN '+changed:''} BEGIN DELETE FROM material_question_origins WHERE resource_id=OLD.${field}; END`);
 }
 for(const table of ['question_notebook_bookmarks','question_notebook_category_links','question_bank_usage'])if(tables.has(table))await host.run(`CREATE TRIGGER IF NOT EXISTS question_origins_${table}_insert AFTER INSERT ON ${table} BEGIN DELETE FROM material_question_origins WHERE question_id=NEW.question_id AND kind='rule'; END`);
 if(tables.has('question_notebook_bookmarks'))await host.run("CREATE TRIGGER IF NOT EXISTS question_origins_bookmark_update AFTER UPDATE ON question_notebook_bookmarks BEGIN DELETE FROM material_question_origins WHERE question_id=NEW.question_id AND kind='rule'; END");
 if(tables.has('material_ai_units')&&tables.has('material_ai_members'))await host.run("CREATE TRIGGER IF NOT EXISTS question_origins_receipt_update AFTER UPDATE OF first_json,final_json,image_sha ON material_ai_units WHEN OLD.final_json<>'' AND (OLD.first_json<>NEW.first_json OR OLD.final_json<>NEW.final_json OR OLD.image_sha<>NEW.image_sha) BEGIN DELETE FROM material_question_origins WHERE question_id IN (SELECT question_id FROM material_ai_members WHERE batch_id=OLD.batch_id AND ordinal=OLD.ordinal); END");
 await host.run('DROP TRIGGER IF EXISTS question_origins_native_receipt_update');
 if(tables.has('material_ai_members')){
  for(const table of ['material_ai_units','material_ai_image_inputs','material_ai_native_context','material_ai_native_inputs','material_ai_page_units','material_ai_page_crops'])if(tables.has(table))for(const event of ['UPDATE','DELETE']){
   if(table==='material_ai_units'&&event==='UPDATE')continue;
   await host.run(`CREATE TRIGGER IF NOT EXISTS question_origins_${table}_${event.toLowerCase()} AFTER ${event} ON ${table} BEGIN DELETE FROM material_question_origins WHERE question_id IN (SELECT question_id FROM material_ai_members WHERE batch_id=OLD.batch_id AND ordinal=OLD.ordinal); END`);
  }
  await host.run("CREATE TRIGGER IF NOT EXISTS question_origins_member_delete AFTER DELETE ON material_ai_members BEGIN DELETE FROM material_question_origins WHERE question_id=OLD.question_id AND kind='ai'; END");
  await host.run("CREATE TRIGGER IF NOT EXISTS question_origins_member_update AFTER UPDATE ON material_ai_members BEGIN DELETE FROM material_question_origins WHERE question_id IN (OLD.question_id,NEW.question_id) AND kind='ai'; END");
 }
}
export async function recordRuleOrigin(host:OriginHost,q:QuestionBankItem){
 const a=q.archive;if(!a||!validQuestionArchive(a)||a.state!=='rule_extracted'||a.ai||q.createdAt!==q.updatedAt)return;
 const origin={sources:a.sources,number:a.number,stem:q.stem,risks:a.sourceRisks};if(!allowed(origin))return;
 for(const [table,condition] of [['question_notebook_bookmarks',' AND bookmarked=1'],['question_notebook_category_links',''],['question_bank_usage','']])if((await host.all(`SELECT 1 FROM ${table} WHERE question_id=?${condition} LIMIT 1`,[q.id])).length)return;
 await host.run("INSERT OR REPLACE INTO material_question_origins(question_id,kind,origin_key,resource_id) VALUES(?,'rule',?,?)",[q.id,key(origin),origin.sources[0].resourceId]);
}
/** Called only inside the source-guarded AI publication transaction, or after verified historical readback. */
export async function recordAiOrigin(host:OriginHost,q:QuestionBankItem,origin:RuleOrigin){
 const a=q.archive;if(!a?.ai||a.state!=='ai_final'||!archiveEligible(q)||!allowed(origin)||a.number!==origin.number)return;
 if(origin.sources.some(s=>!a.sources.some(t=>JSON.stringify([s.resourceId,s.version,s.offset,s.chunkId,s.bodyVersion])===JSON.stringify([t.resourceId,t.version,t.offset,t.chunkId,t.bodyVersion]))))return;
 await host.run("INSERT OR REPLACE INTO material_question_origins(question_id,kind,origin_key,resource_id) VALUES(?,'ai',?,?)",[q.id,key(origin),origin.sources[0].resourceId]);
}
export const sourceCandidateHidden=`(EXISTS(SELECT 1 FROM material_question_origins o WHERE o.question_id=q.id AND o.covered=1) OR COALESCE(${answerRuleCandidateHidden},0))`;
