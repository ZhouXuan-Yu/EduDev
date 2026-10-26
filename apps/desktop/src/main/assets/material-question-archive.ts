import {createHash} from 'node:crypto';
import type {QuestionBankItem,QuestionBankItemInput} from '../../shared/contracts';
import {archiveMissing,archiveIssuesAfterEdit,archiveEligible,type ArchiveEdit,type ArchiveStatus} from '../../shared/question-archive';
import {questionVersion} from '../education/question-context-provider';
import type {MaterialRepository} from './material-repository';
import {extractMaterialQuestions} from './material-question-extract';
type Row=Record<string,unknown>;type Value=string|number|null;
type Host={all:(q:string,p?:Value[])=>Promise<Row[]>;run:(q:string,p?:Value[])=>Promise<void>;materials:()=>MaterialRepository;validateAi?:(q:QuestionBankItem)=>Promise<void>;create:(q:QuestionBankItemInput)=>Promise<QuestionBankItem>;read:(id:string)=>Promise<QuestionBankItem|undefined>;withWriter:<T>(action:(archive:MaterialQuestionArchive)=>Promise<T>)=>Promise<T>};
/** Persistent, local-only derivative stage. Source questions remain ordinary bank items. */
export class MaterialQuestionArchive{
 private timer?:ReturnType<typeof setInterval>;private pumping?:Promise<void>;private host:Host;
 private controller=new AbortController();private verified=new Map<string,string>();
 constructor(host:Host){this.host=host;}
 async migrate(){
  if(!(await this.host.all('PRAGMA table_info(question_bank_items)')).some(c=>c.name==='archive_json'))await this.host.run("ALTER TABLE question_bank_items ADD COLUMN archive_json TEXT NOT NULL DEFAULT ''");
  await this.host.run("CREATE TABLE IF NOT EXISTS material_question_jobs(resource_id TEXT PRIMARY KEY,version TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',question_count INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL)");
  const columns=await this.host.all('PRAGMA table_info(material_question_jobs)');
  if(!columns.some(c=>c.name==='cursor'))await this.host.run('ALTER TABLE material_question_jobs ADD COLUMN cursor INTEGER NOT NULL DEFAULT 0');
  if(!columns.some(c=>c.name==='parse_token'))await this.host.run("ALTER TABLE material_question_jobs ADD COLUMN parse_token TEXT NOT NULL DEFAULT ''");
  await this.host.run('CREATE INDEX IF NOT EXISTS material_question_jobs_pending ON material_question_jobs(status,updated_at,resource_id)');
  await this.host.run("INSERT OR IGNORE INTO material_question_jobs(resource_id,version,updated_at) SELECT id,content_hash,datetime('now') FROM teacher_resources WHERE parse_status IN ('ready','parsed','chunked','indexed','graph_extracted')");
 }
 async enqueue(id:string,version:string,parseToken=''){await this.host.run("INSERT INTO material_question_jobs(resource_id,version,parse_token,updated_at) VALUES(?,?,?,datetime('now')) ON CONFLICT(resource_id) DO UPDATE SET version=excluded.version,parse_token=excluded.parse_token,cursor=CASE WHEN material_question_jobs.version<>excluded.version OR material_question_jobs.parse_token<>excluded.parse_token THEN 0 ELSE material_question_jobs.cursor END,status=CASE WHEN material_question_jobs.version<>excluded.version OR material_question_jobs.parse_token<>excluded.parse_token THEN 'pending' ELSE material_question_jobs.status END,updated_at=excluded.updated_at",[id,version,parseToken]);}
 start(){if(this.timer)return;this.controller=new AbortController();const pump=()=>{if(this.pumping)return;this.pumping=(async()=>{const began=Date.now();do{if(!await this.drain())break;await new Promise<void>(resolve=>setImmediate(resolve));}while(Date.now()-began<1000&&!this.controller.signal.aborted);})().catch(()=>undefined).finally(()=>{this.pumping=undefined;});};this.timer=setInterval(pump,900);this.timer.unref();pump();}
 async close(){if(this.timer)clearInterval(this.timer);this.timer=undefined;this.controller.abort();await this.pumping;}
 async status():Promise<ArchiveStatus>{const r=(await this.host.all("SELECT SUM(status='pending') pending,SUM(status='failed') failed,SUM(status='complete') documents,SUM(question_count) questions FROM material_question_jobs"))[0];const n=(await this.host.all("SELECT COUNT(*) n FROM material_question_members WHERE needs_attention=1"))[0];const failures=(await this.host.all("SELECT r.original_file_name title,j.error code FROM material_question_jobs j JOIN teacher_resources r ON r.id=j.resource_id WHERE j.status='failed' ORDER BY j.updated_at DESC LIMIT 5")).map(row=>({title:String(row.title),code:String(row.code)}));return{failures,pending:Number(r.pending||0),failed:Number(r.failed||0),documents:Number(r.documents||0),questions:Number(r.questions||0),needsAttention:Number(n.n||0)};}
 async retry(){await this.host.run("UPDATE material_question_jobs SET status='pending',error='' WHERE status='failed'");}
 async drain(){const row=(await this.host.all("SELECT * FROM material_question_jobs WHERE status='pending' ORDER BY updated_at,resource_id LIMIT 1"))[0];if(!row||this.controller.signal.aborted)return false;const id=String(row.resource_id),version=String(row.version),cursor=Number(row.cursor),token=String(row.parse_token),verification=id+version+token;
  try{
   const resource=await this.host.materials().resource(id);if(resource.contentHash!==version)throw new Error('source_changed');
   const stamp=await this.host.materials().originalStamp(id,version);
   if(this.verified.get(verification)!==stamp){await this.host.materials().verify(id,version,this.controller.signal);if(await this.host.materials().originalStamp(id,version)!==stamp)throw new Error('source_changed');if(this.verified.size>=32)this.verified.delete(this.verified.keys().next().value!);this.verified.set(verification,stamp);}
   const snapshot=await this.host.materials().readingWindow(id,cursor),questions=extractMaterialQuestions(snapshot.units,resource.parseEngine);
   // A window boundary does not establish question hierarchy or a complete final solution.
   for(const [i,q]of questions.entries())if(cursor>0||snapshot.hasMore&&i===questions.length-1){if(!q.archive.issues.includes('cross_chunk'))q.archive.issues.push('cross_chunk');if(!q.archive.sourceRisks.includes('cross_chunk'))q.archive.sourceRisks.push('cross_chunk');}
   await this.host.withWriter(async target=>{
    const current=(await target.host.all("SELECT version,status,cursor,parse_token FROM material_question_jobs WHERE resource_id=?",[id]))[0];if(!current||current.version!==version||current.status!=='pending'||Number(current.cursor)!==cursor||current.parse_token!==token)return;
    const fresh=await target.host.materials().readingWindow(id,cursor);if(fresh.fingerprint!==snapshot.fingerprint)throw new Error('source_changed');
    for(const q of questions){
     this.controller.signal.throwIfAborted();const key=createHash('sha256').update(id+'\0'+version+'\0numbered-text.v1\0'+JSON.stringify(q.archive.sources)+'\0'+q.key).digest('hex');
     const exists=(await target.host.all('SELECT question_id FROM material_question_members WHERE extraction_key=?',[key]))[0];if(exists)continue;
     const saved=await target.host.create(q.fields);await target.host.run('UPDATE question_bank_items SET archive_json=? WHERE id=?',[JSON.stringify(q.archive),saved.id]);await target.host.run('INSERT INTO material_question_members(extraction_key,resource_id,question_id,needs_attention) VALUES(?,?,?,?)',[key,id,saved.id,q.archive.issues.length?1:0]);
    }
    this.controller.signal.throwIfAborted();await target.host.run("UPDATE material_question_jobs SET status=?,cursor=?,question_count=(SELECT COUNT(*) FROM material_question_members WHERE resource_id=?),error='',updated_at=datetime('now') WHERE resource_id=? AND version=? AND parse_token=?",[snapshot.hasMore?'pending':'complete',cursor+snapshot.units.length,id,id,version,token]);
   });
  }catch(error){if(this.controller.signal.aborted)return false;const code=error instanceof Error?error.message:'';await this.host.run("UPDATE material_question_jobs SET status='failed',error=?,updated_at=datetime('now') WHERE resource_id=? AND version=? AND parse_token=? AND cursor=?",[['source_changed','too_large','too_many_questions','question_too_large'].includes(code)?code:'extract_failed',id,version,token,cursor]);}return true;
 }
 async migrateMembers(){await this.host.run('CREATE TABLE IF NOT EXISTS material_question_members(extraction_key TEXT PRIMARY KEY,resource_id TEXT NOT NULL,question_id TEXT NOT NULL UNIQUE,needs_attention INTEGER NOT NULL DEFAULT 0)');await this.host.run('CREATE INDEX IF NOT EXISTS material_question_members_resource ON material_question_members(resource_id)');await this.host.run('CREATE INDEX IF NOT EXISTS material_question_members_attention ON material_question_members(needs_attention)');}
 async validate(q:QuestionBankItem,requireComplete=false){
  if(!q.archive)return;if(requireComplete&&!archiveEligible(q))throw new Error('question_archive_incomplete');
  if(q.archive.ai){if(!this.host.validateAi)throw new Error('source_changed');await this.host.validateAi(q);}
  const resource=await this.host.materials().resource(q.archive.sources[0].resourceId);if(resource.contentHash!==q.archive.sources[0].version)throw new Error('source_changed');
  await this.host.materials().verify(resource.id,resource.contentHash,new AbortController().signal);
  for(const source of q.archive.sources)await this.host.materials().source(source);
 }
 async edit(input:ArchiveEdit){return this.host.withWriter(async target=>{
  const q=await target.host.read(input.questionId);if(!q?.archive||questionVersion(q)!==input.version)throw new Error('source_changed');await target.validate(q);
  const fields=Object.fromEntries(Object.entries(input.fields).map(([k,v])=>[k,v.trim()])) as typeof input.fields;
  // A checkbox cannot restore a missing figure or expand an intentionally incomplete long-question placeholder.
  const issues=archiveIssuesAfterEdit(q.archive,q,fields,input.sourceChecked);
  const archive={...q.archive,state:'teacher_edited' as const,issues,sourceChecked:input.sourceChecked,answerOrigin:fields.answer===q.answer?q.archive.answerOrigin:fields.answer?'teacher':'missing',analysisOrigin:fields.analysis===q.analysis?q.archive.analysisOrigin:fields.analysis?'teacher':'missing'};
  await target.host.run('UPDATE question_bank_items SET subject=?,grade=?,knowledge_point=?,question_type=?,difficulty=?,stem=?,answer=?,analysis=?,archive_json=?,updated_at=? WHERE id=?',[fields.subject,fields.grade,fields.knowledgePoint,fields.questionType,fields.difficulty,fields.stem,fields.answer,fields.analysis,JSON.stringify(archive),new Date().toISOString(),q.id]);
  await target.host.run('UPDATE material_question_members SET needs_attention=? WHERE question_id=?',[archive.issues.length?1:0,q.id]);return target.host.read(q.id);
 });}
}
