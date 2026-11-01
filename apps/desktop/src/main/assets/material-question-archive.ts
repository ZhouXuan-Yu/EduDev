import {createHash} from 'node:crypto';
import type {QuestionBankItem,QuestionBankItemInput} from '../../shared/contracts';
import {archiveMissing,archiveIssuesAfterEdit,archiveEligible,type ArchiveEdit,type ArchiveStatus} from '../../shared/question-archive';
import {questionVersion} from '../education/question-context-provider';
import type {MaterialRepository} from './material-repository';
import {extractMaterialQuestions} from './material-question-extract';
import {nativeQuestionComplete} from '../../shared/native-question';
import {migrateQuestionOrigins,recordRuleOrigin,recordAiOrigin,type RuleOrigin} from './material-question-origins';
import {materialSource} from './material-source';
import {validateAiPageSource} from './material-ai-page-source';
import {answerRuleCandidateHidden} from './material-book-pairs';
type Row=Record<string,unknown>;type Value=string|number|null;
type Host={all:(q:string,p?:Value[])=>Promise<Row[]>;run:(q:string,p?:Value[])=>Promise<void>;materials:()=>MaterialRepository;validateAi?:(q:QuestionBankItem)=>Promise<void>;validateNative?:(q:QuestionBankItem)=>Promise<void>;withNative?:<T>(q:QuestionBankItem,action:(permit:object)=>Promise<T>)=>Promise<T>;publishNative?:(q:QuestionBankItem,permit:object)=>Promise<void>;reviseNative?:(q:QuestionBankItem,fields:ArchiveEdit['fields'],checked:boolean,permit:object)=>Promise<NonNullable<QuestionBankItem['archive']>['native']>;validateWeb?:(q:QuestionBankItem)=>Promise<void>;create:(q:QuestionBankItemInput)=>Promise<QuestionBankItem>;read:(id:string)=>Promise<QuestionBankItem|undefined>;withWriter:<T>(action:(archive:MaterialQuestionArchive)=>Promise<T>)=>Promise<T>};
/** Persistent, local-only derivative stage. Source questions remain ordinary bank items. */
export class MaterialQuestionArchive{
 private timer?:ReturnType<typeof setInterval>;private pumping?:Promise<void>;private host:Host;
 private controller=new AbortController();private verified=new Map<string,string>();
 constructor(host:Host){this.host=host;}
 private bookRole?:(id:string)=>Promise<import('../../shared/material-book-pair').MaterialBookRole|null>;
 private validateBook?:(q:QuestionBankItem)=>Promise<void>;
 configureBookAnswers(validate:NonNullable<MaterialQuestionArchive['validateBook']>){this.validateBook=validate;}
 configureBooks(role:NonNullable<MaterialQuestionArchive['bookRole']>){this.bookRole=role;}
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
 start(){if(this.timer)return;this.controller=new AbortController();const pump=()=>{if(this.pumping)return;this.pumping=(async()=>{await this.reconcileOrigins();const began=Date.now();do{if(!await this.drain())break;await new Promise<void>(resolve=>setImmediate(resolve));}while(Date.now()-began<1000&&!this.controller.signal.aborted);})().catch(()=>undefined).finally(()=>{this.pumping=undefined;});};this.timer=setInterval(pump,900);this.timer.unref();pump();}
 async close(){if(this.timer)clearInterval(this.timer);this.timer=undefined;this.controller.abort();await this.pumping;}
 async status():Promise<ArchiveStatus>{
  const r=(await this.host.all("SELECT SUM(status='pending') pending,SUM(status='failed') failed,SUM(status='complete') documents,SUM(question_count) questions FROM material_question_jobs"))[0],n=(await this.host.all(`SELECT COUNT(*) n FROM material_question_members m JOIN question_bank_items q ON q.id=m.question_id WHERE m.needs_attention=1 AND NOT COALESCE(${answerRuleCandidateHidden},0)`))[0];
  const associated=(await this.host.all('SELECT COUNT(*) n FROM material_question_origins WHERE covered=1'))[0];
  const state=(await this.host.all('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.question-origins.cursor.v1']))[0];let cursor=0;try{cursor=Number(JSON.parse(String(state?.value_json||'{}')).cursor)||0;}catch{}
  const latest=(await this.host.all('SELECT COALESCE(MAX(rowid),0) n FROM question_bank_items'))[0];
  const failures=(await this.host.all("SELECT r.original_file_name title,j.error code FROM material_question_jobs j JOIN teacher_resources r ON r.id=j.resource_id WHERE j.status='failed' ORDER BY j.updated_at DESC LIMIT 5")).map(row=>({title:String(row.title),code:String(row.code)}));
  return{failures,pending:Number(r.pending||0),failed:Number(r.failed||0),documents:Number(r.documents||0),questions:Number(r.questions||0),needsAttention:Number(n.n||0),associated:Number(associated.n||0),associating:cursor<Number(latest.n)};
 }
 async retry(){await this.host.run("UPDATE material_question_jobs SET status='pending',error='' WHERE status='failed'");}
 private async reconcileOrigins(){
  const state=(await this.host.all('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.question-origins.cursor.v1']))[0];let cursor=0;
  try{const value=JSON.parse(String(state?.value_json||'{}'));if(value.schema===1&&Number.isSafeInteger(value.cursor)&&value.cursor>=0)cursor=value.cursor;}catch{/* Derived cursor can be rebuilt. */}
  const rows=await this.host.all('SELECT rowid origin_rowid,id FROM question_bank_items WHERE rowid>? ORDER BY rowid LIMIT 8',[cursor]);
  for(const row of rows){
   if(this.controller.signal.aborted)return;let q:QuestionBankItem|undefined,origin:RuleOrigin|undefined;try{q=await this.host.read(String(row.id));}catch{/* A corrupt historical row cannot block later rows or new imports. */}
   try{if(q?.archive?.ai&&q.archive.state==='ai_final'&&archiveEligible(q)){
    await this.validate(q,true);const units=[];
    for(const s of q.archive.sources){const window=await this.host.materials().readingWindow(s.resourceId,s.offset,1);if(window.units.length!==1||JSON.stringify(materialSource(window.units[0]))!==JSON.stringify(s))throw Error('source_changed');units.push(window.units[0]);}
    if(q.archive.native){const receipt=q.archive.ai,context=(await this.host.all('SELECT context_json FROM material_ai_native_context WHERE batch_id=? AND ordinal=?',[receipt.batchId,receipt.ordinal]))[0];if(!context||!units.length)throw Error('source_changed');const raw=JSON.parse(String(context.context_json));if(typeof raw.roles?.question!=='string')throw Error('source_changed');units[0]={...units[0],chunk:{...units[0].chunk,contentMd:raw.roles.question}};units.splice(1);}
    const candidates=extractMaterialQuestions(units,'local-text-v1').filter(c=>c.archive.number===q.archive!.number);
    if(candidates.length===1){const c=candidates[0];origin={sources:q.archive.native?q.archive.sources:c.archive.sources,number:c.archive.number,stem:c.fields.stem,risks:c.archive.sourceRisks};}
   }}catch{/* Invalid historical evidence stays visible; never infer an association. */}
   await this.host.withWriter(async target=>{
    let current:QuestionBankItem|undefined;if(q)try{current=await target.host.read(String(row.id));}catch{/* Changed/corrupt history stays unassociated. */}if(q&&current&&questionVersion(current)===questionVersion(q)){
     if(origin){if(!target.host.validateAi)throw Error('source_changed');await target.host.validateAi(current);for(const source of origin.sources)await target.host.materials().source(source);await recordAiOrigin(target.host,current,origin);}
     else await recordRuleOrigin(target.host,current);
    }
    await target.host.run("INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",['xiaozhi.question-origins.cursor.v1',JSON.stringify({schema:1,cursor:Number(row.origin_rowid)})]);
   });
  }
 }
 async drain(){const row=(await this.host.all("SELECT * FROM material_question_jobs WHERE status='pending' ORDER BY updated_at,resource_id LIMIT 1"))[0];if(!row||this.controller.signal.aborted)return false;const id=String(row.resource_id),version=String(row.version),cursor=Number(row.cursor),token=String(row.parse_token),verification=id+version+token;
  try{
   const resource=await this.host.materials().resource(id);if(resource.contentHash!==version)throw new Error('source_changed');
   const stamp=await this.host.materials().originalStamp(id,version);
   if(this.verified.get(verification)!==stamp){await this.host.materials().verify(id,version,this.controller.signal);if(await this.host.materials().originalStamp(id,version)!==stamp)throw new Error('source_changed');if(this.verified.size>=32)this.verified.delete(this.verified.keys().next().value!);this.verified.set(verification,stamp);}
   const role=await this.bookRole?.(id);
   const snapshot=await this.host.materials().readingWindow(id,cursor),questions=role?.kind==='answers'?[]:extractMaterialQuestions(snapshot.units,resource.parseEngine);
   // A window boundary does not establish question hierarchy or a complete final solution.
   for(const [i,q]of questions.entries())if(cursor>0||snapshot.hasMore&&i===questions.length-1){if(!q.archive.issues.includes('cross_chunk'))q.archive.issues.push('cross_chunk');if(!q.archive.sourceRisks.includes('cross_chunk'))q.archive.sourceRisks.push('cross_chunk');}
   await this.host.withWriter(async target=>{
    const current=(await target.host.all("SELECT version,status,cursor,parse_token FROM material_question_jobs WHERE resource_id=?",[id]))[0];if(!current||current.version!==version||current.status!=='pending'||Number(current.cursor)!==cursor||current.parse_token!==token)return;
    // Linking while a local window is being read changes its purpose, not the original file.
    // Leave the cursor pending; the next drain rereads the current role before extracting anything.
    if(JSON.stringify(await target.bookRole?.(id))!==JSON.stringify(role))return;
    const fresh=await target.host.materials().readingWindow(id,cursor);if(fresh.fingerprint!==snapshot.fingerprint)throw new Error('source_changed');
    for(const q of questions){
     this.controller.signal.throwIfAborted();const key=createHash('sha256').update(id+'\0'+version+'\0numbered-text.v1\0'+JSON.stringify(q.archive.sources)+'\0'+q.key).digest('hex');
     const exists=(await target.host.all('SELECT question_id FROM material_question_members WHERE extraction_key=?',[key]))[0];if(exists)continue;
     const saved=await target.host.create(q.fields);await target.host.run('UPDATE question_bank_items SET archive_json=? WHERE id=?',[JSON.stringify(q.archive),saved.id]);await target.host.run('INSERT INTO material_question_members(extraction_key,resource_id,question_id,needs_attention) VALUES(?,?,?,?)',[key,id,saved.id,archiveEligible({...saved,archive:q.archive})?0:1]);
     await recordRuleOrigin(target.host,{...saved,archive:q.archive});
    }
    this.controller.signal.throwIfAborted();await target.host.run("UPDATE material_question_jobs SET status=?,cursor=?,question_count=(SELECT COUNT(*) FROM material_question_members WHERE resource_id=?),error='',updated_at=datetime('now') WHERE resource_id=? AND version=? AND parse_token=?",[snapshot.hasMore?'pending':'complete',cursor+snapshot.units.length,id,id,version,token]);
   });
  }catch(error){if(this.controller.signal.aborted)return false;const code=error instanceof Error?error.message:'';await this.host.run("UPDATE material_question_jobs SET status='failed',error=?,updated_at=datetime('now') WHERE resource_id=? AND version=? AND parse_token=? AND cursor=?",[['source_changed','too_large','too_many_questions','question_too_large'].includes(code)?code:'extract_failed',id,version,token,cursor]);}return true;
 }
 async migrateMembers(){await this.host.run('CREATE TABLE IF NOT EXISTS material_question_members(extraction_key TEXT PRIMARY KEY,resource_id TEXT NOT NULL,question_id TEXT NOT NULL UNIQUE,needs_attention INTEGER NOT NULL DEFAULT 0)');await this.host.run('CREATE INDEX IF NOT EXISTS material_question_members_resource ON material_question_members(resource_id)');await this.host.run('CREATE INDEX IF NOT EXISTS material_question_members_attention ON material_question_members(needs_attention)');
  await migrateQuestionOrigins(this.host);
  // Derived attention flags only; never rewrite historical source/teacher/AI receipts.
  await this.host.run(`UPDATE material_question_members SET needs_attention=1 WHERE needs_attention=0 AND NOT EXISTS(SELECT 1 FROM material_question_origins o WHERE o.question_id=material_question_members.question_id AND o.covered=1) AND EXISTS(SELECT 1 FROM question_bank_items q WHERE q.id=material_question_members.question_id AND json_valid(q.archive_json) AND json_type(q.archive_json,'$.ai') IS NULL AND json_array_length(q.archive_json,'$.sources')>0 AND (json_extract(q.archive_json,'$.state')='rule_extracted' OR COALESCE(json_extract(q.archive_json,'$.sourceChecked'),0)<>1))`);
 }
 async validate(q:QuestionBankItem,requireComplete=false){
  if(!q.archive)return;if(requireComplete&&!archiveEligible(q))throw new Error('question_archive_incomplete');
  if(q.archive.native){if(!this.host.validateNative)throw Error('source_changed');await this.host.validateNative(q);}
  if(q.archive.book){if(!this.validateBook)throw Error('source_changed');await this.validateBook(q);}
  if(q.archive.web){if(!this.host.validateWeb)throw new Error('source_changed');await this.host.validateWeb(q);}
  if(q.archive.ai){if(!this.host.validateAi)throw new Error('source_changed');await this.host.validateAi(q);}
  if(q.archive.pageSource){const source=q.archive.pageSource;await validateAiPageSource(this.host,source);await this.host.materials().verify(source.resourceId,source.version,new AbortController().signal);return;}
  if(!q.archive.sources.length){if(q.archive.web?.base==='manual')return;throw new Error('source_changed');}
  const resource=await this.host.materials().resource(q.archive.sources[0].resourceId);if(resource.contentHash!==q.archive.sources[0].version)throw new Error('source_changed');
  await this.host.materials().verify(resource.id,resource.contentHash,new AbortController().signal);
  for(const source of q.archive.sources)await this.host.materials().source(source);
 }
 async edit(input:ArchiveEdit){
  const current=await this.host.read(input.questionId);
  if(current?.archive?.native){if(!this.host.withNative)throw Error('source_changed');return this.host.withNative(current,permit=>this.editWriter(input,permit));}
  return this.editWriter(input);
 }
 private async editWriter(input:ArchiveEdit,permit?:object){return this.host.withWriter(async target=>{
  const q=await target.host.read(input.questionId);if(!q?.archive||questionVersion(q)!==input.version)throw new Error('source_changed');await target.validate(q);
  const fields=Object.fromEntries(Object.entries(input.fields).map(([k,v])=>[k,v.trim()])) as typeof input.fields;
  if(q.archive.web&&fields.stem!==q.stem&&(['answer','analysis'] as const).some(role=>q.archive!.web!.roles[role]&&fields[role]===q[role]))throw new Error('web_answer_question_changed');
  if(q.archive.book&&fields.stem!==q.stem&&(['answer','analysis'] as const).some(role=>q.archive!.book!.roles[role]&&fields[role]===q[role]))throw Error('book_answer_question_changed');
  // A checkbox cannot restore a missing figure or expand an intentionally incomplete long-question placeholder.
  const issues=archiveIssuesAfterEdit(q.archive,q,fields,input.sourceChecked);
  const archive={...q.archive,state:'teacher_edited' as const,issues,sourceChecked:input.sourceChecked,answerOrigin:fields.answer===q.answer?q.archive.answerOrigin:fields.answer?'teacher':'missing',analysisOrigin:fields.analysis===q.analysis?q.archive.analysisOrigin:fields.analysis?'teacher':'missing'};
  if(archive.native){
   if(!permit||!target.host.reviseNative)throw Error('source_changed');archive.native=await target.host.reviseNative(q,fields,input.sourceChecked,permit);
   if(archive.native&&!nativeQuestionComplete(archive.native)&&!archive.issues.includes('incomplete_question'))archive.issues.push('incomplete_question');
   else if(archive.native&&nativeQuestionComplete(archive.native)&&input.sourceChecked)archive.issues=archive.issues.filter(code=>code!=='incomplete_question');
  }
  if(archive.book){archive.book=structuredClone(archive.book);for(const role of ['answer','analysis'] as const)if(fields[role]!==q[role]||fields.stem!==q.stem)delete archive.book.roles[role];}
  if(archive.web){archive.web=structuredClone(archive.web);for(const role of ['answer','analysis'] as const)if(fields[role]!==q[role]||fields.stem!==q.stem)delete archive.web.roles[role];}
  await target.host.run('UPDATE question_bank_items SET subject=?,grade=?,knowledge_point=?,question_type=?,difficulty=?,stem=?,answer=?,analysis=?,archive_json=?,updated_at=? WHERE id=?',[fields.subject,fields.grade,fields.knowledgePoint,fields.questionType,fields.difficulty,fields.stem,fields.answer,fields.analysis,JSON.stringify(archive),new Date().toISOString(),q.id]);
  await target.host.run('UPDATE material_question_members SET needs_attention=? WHERE question_id=?',[archiveEligible({...fields,archive})?0:1,q.id]);const saved=await target.host.read(q.id);if(archive.native){if(!saved||!permit||!target.host.publishNative)throw Error('source_changed');await target.host.publishNative(saved,permit);}return saved;
 });}
}
