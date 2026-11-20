import type {QuestionBankItem,QuestionBankItemInput} from '../../shared/contracts';
import {archiveMissing,archiveIssuesAfterEdit,archiveEligible,plainTeacherQuestion,type ArchiveEdit,type ArchiveStatus} from '../../shared/question-archive';
import {questionVersion} from '../education/question-context-provider';
import type {MaterialRepository} from './material-repository';
import {extractMaterialQuestions,extractMaterialQuestionWindow} from './material-question-extract';
import {prepareRuleDuplicate,applyRuleDuplicate,clearRuleDuplicate,ruleDuplicateKey,reuseRuleDuplicate,recordNewRuleDuplicate,ruleDuplicateHidden,materialQuestionExtractionKey} from './material-rule-duplicates';
import {isWordPageSource,wordPageRuleCandidateHidden} from './material-word-page-source';
import {nativeQuestionComplete} from '../../shared/native-question';
import {migrateQuestionOrigins,recordRuleOrigin,recordAiOrigin,type RuleOrigin} from './material-question-origins';
import {materialSource} from './material-source';
import {validateAiPageSource} from './material-ai-page-source';
import {answerRuleCandidateHidden} from './material-book-pairs';
import type {MaterialSource} from '../../shared/materials';
import {QUESTION_STRUCTURE_ARCHIVE_SCHEMA} from '../../shared/question-archive';
import {reviseStructureDocument,type MaterialStructureRepository} from './material-structure-repository';
import {validStructureReviewInput,type StructureReviewInput} from '../../shared/material-structure-review';
import type {QuestionContextEditInput} from '../../shared/question-context-edit';
import type {QuestionContextSource} from '../../shared/question-context';
import {DOCUMENT_STRUCTURE_ENGINE,type DocumentStructureReference} from '../../shared/material-document-structure';
import {assertStructureDraftEditable,hasIdenticalVisibleStructureDraft,publishStructureDrafts,stageStructureDraft,structureDraftHidden,STRUCTURE_BANK_REVISION} from './material-structure-bank';
type Row=Record<string,unknown>;type Value=string|number|null;
type Host={all:(q:string,p?:Value[])=>Promise<Row[]>;run:(q:string,p?:Value[])=>Promise<void>;materials:()=>MaterialRepository;aiOrigin?:(q:QuestionBankItem)=>Promise<{origin:RuleOrigin;sources:MaterialSource[]}|undefined>;validateAi?:(q:QuestionBankItem)=>Promise<void>;validateAiForEdit?:(q:QuestionBankItem)=>Promise<void>;revisePage?:(q:QuestionBankItem,fields:ArchiveEdit['fields'],checked:boolean)=>Promise<QuestionBankItem['document']>;validateNative?:(q:QuestionBankItem)=>Promise<void>;withNative?:<T>(q:QuestionBankItem,action:(permit:object)=>Promise<T>)=>Promise<T>;publishNative?:(q:QuestionBankItem,permit:object)=>Promise<void>;reviseNative?:(q:QuestionBankItem,fields:ArchiveEdit['fields'],checked:boolean,permit:object)=>Promise<NonNullable<QuestionBankItem['archive']>['native']>;validateWeb?:(q:QuestionBankItem)=>Promise<void>;create:(q:QuestionBankItemInput)=>Promise<QuestionBankItem>;read:(id:string)=>Promise<QuestionBankItem|undefined>;withWriter:<T>(action:(archive:MaterialQuestionArchive)=>Promise<T>)=>Promise<T>};
/** Persistent, local-only derivative stage. Source questions remain ordinary bank items. */
export class MaterialQuestionArchive{
 private structures?:()=>MaterialStructureRepository;
 private reconcileStructureSearch?:(reference:DocumentStructureReference)=>Promise<void>;
 configureStructures(structures:()=>MaterialStructureRepository,reconcileSearch?:(reference:DocumentStructureReference)=>Promise<void>){
  this.structures=structures;
  this.reconcileStructureSearch=reconcileSearch;
 }
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
 async requeueLegacyStructureArchives(){
  await this.host.run(`UPDATE material_question_jobs AS a
    SET parse_token=a.parse_token||?,status='pending',cursor=0,error='',updated_at=datetime('now')
    FROM material_structure_jobs s WHERE a.resource_id=s.resource_id AND a.version=s.version
      AND s.engine=? AND s.status IN ('complete','partial')
      AND a.parse_token=s.engine||':'||s.generation`,[STRUCTURE_BANK_REVISION,DOCUMENT_STRUCTURE_ENGINE]);
 }
 start(){if(this.timer)return;this.controller=new AbortController();const pump=()=>{if(this.pumping)return;this.pumping=(async()=>{await this.reconcileOrigins();const began=Date.now();do{if(!await this.drain())break;await new Promise<void>(resolve=>setImmediate(resolve));}while(Date.now()-began<1000&&!this.controller.signal.aborted);})().catch(()=>undefined).finally(()=>{this.pumping=undefined;});};this.timer=setInterval(pump,900);this.timer.unref();pump();}
 async close(){if(this.timer)clearInterval(this.timer);this.timer=undefined;this.controller.abort();await this.pumping;}
 async status():Promise<ArchiveStatus>{
  const r=(await this.host.all("SELECT SUM(status='pending') pending,SUM(status='failed') failed,SUM(status='complete') documents,SUM(question_count) questions FROM material_question_jobs"))[0],n=(await this.host.all(`SELECT COUNT(*) n FROM material_question_members m JOIN question_bank_items q ON q.id=m.question_id WHERE m.needs_attention=1 AND NOT (COALESCE(${answerRuleCandidateHidden},0) OR ${wordPageRuleCandidateHidden} OR ${structureDraftHidden})`))[0];
  const duplicates=(await this.host.all(`SELECT COUNT(*) n,SUM(CASE WHEN m.needs_attention=1 AND NOT (COALESCE(${answerRuleCandidateHidden},0) OR ${wordPageRuleCandidateHidden}) THEN 1 ELSE 0 END) attention FROM material_question_members m JOIN question_bank_items q ON q.id=m.question_id WHERE m.duplicate_of<>'' AND ${ruleDuplicateHidden}`))[0];
  const associated=(await this.host.all('SELECT COUNT(*) n FROM material_question_origins WHERE covered=1'))[0];
  const state=(await this.host.all('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.question-origins.cursor.v1']))[0];let cursor=0;try{const v=JSON.parse(String(state?.value_json||'{}'));if(v.schema===2)cursor=Number(v.cursor)||0;}catch{}
  const latest=(await this.host.all('SELECT COALESCE(MAX(rowid),0) n FROM question_bank_items'))[0];
  const failures=(await this.host.all("SELECT r.original_file_name title,j.error code FROM material_question_jobs j JOIN teacher_resources r ON r.id=j.resource_id WHERE j.status='failed' ORDER BY j.updated_at DESC LIMIT 5")).map(row=>({title:String(row.title),code:String(row.code)}));
  return{failures,pending:Number(r.pending||0),failed:Number(r.failed||0),documents:Number(r.documents||0),questions:Number(r.questions||0),needsAttention:Math.max(0,Number(n.n||0)-Number(duplicates.attention||0)),associated:Number(associated.n||0),foldedDuplicates:Number(duplicates.n||0),associating:cursor<Number(latest.n)||!!(await this.host.all('SELECT 1 FROM material_question_origin_dirty_v1 LIMIT 1')).length};
 }
 async retry(){await this.host.run("UPDATE material_question_jobs SET status='pending',error='' WHERE status='failed'");}
 private async reconcileOrigins(){
  const state=(await this.host.all('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.question-origins.cursor.v1']))[0];let cursor=0;
  try{const value=JSON.parse(String(state?.value_json||'{}'));if(value.schema===2&&Number.isSafeInteger(value.cursor)&&value.cursor>=0)cursor=value.cursor;}catch{/* Derived cursor can be rebuilt. */}
  const dirty=await this.host.all('SELECT question_id id,revision FROM material_question_origin_dirty_v1 ORDER BY rowid LIMIT 4');
  const scan=await this.host.all('SELECT rowid origin_rowid,id FROM question_bank_items WHERE rowid>? ORDER BY rowid LIMIT ?',[cursor,8-dirty.length]);
  const rows:Row[]=scan.map(row=>({...row,revision:dirty.find(d=>d.id===row.id)?.revision}));
  for(const row of dirty)if(!rows.some(r=>r.id===row.id))rows.push({...row,origin_rowid:undefined});
  for(const row of rows){
   if(this.controller.signal.aborted)return;const nextCursor=Math.max(cursor,Number(row.origin_rowid||0));
   const retry=async()=>{await this.host.withWriter(async target=>{
    await target.host.run('INSERT OR IGNORE INTO material_question_origin_dirty_v1(question_id) VALUES(?)',[String(row.id)]);
    // Move a transient failure behind newer work without changing its revision or losing its retry.
    await target.host.run('UPDATE material_question_origin_dirty_v1 SET rowid=(SELECT COALESCE(MAX(rowid),0)+1 FROM material_question_origin_dirty_v1) WHERE question_id=?',[String(row.id)]);
    this.controller.signal.throwIfAborted();
    await target.host.run("INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",['xiaozhi.question-origins.cursor.v1',JSON.stringify({schema:2,cursor:nextCursor})]);
   });cursor=nextCursor;};
   let q:QuestionBankItem|undefined,origin:RuleOrigin|undefined,verifiedSources:MaterialSource[]|undefined;try{q=await this.host.read(String(row.id));}catch(error){if(error instanceof Error&&['source_incomplete','busy','index_busy'].includes(error.message)){await retry();continue;}/* Corrupt history stays visible. */}
   try{if(q?.archive?.ai&&['ai_final','book_enriched','web_enriched'].includes(q.archive.state)&&archiveEligible(q)){
    await this.validate(q,true);const extended=await this.host.aiOrigin?.(q);
    if(extended){origin=extended.origin;verifiedSources=extended.sources;}
    else{
     const units=[];
     for(const source of q.archive.sources){const window=await this.host.materials().readingWindow(source.resourceId,source.offset,1);if(window.units.length!==1||JSON.stringify(materialSource(window.units[0]))!==JSON.stringify(source))throw Error('source_changed');units.push(window.units[0]);}
     if(q.archive.native){const receipt=q.archive.ai,context=(await this.host.all('SELECT context_json FROM material_ai_native_context WHERE batch_id=? AND ordinal=?',[receipt.batchId,receipt.ordinal]))[0];if(!context||!units.length)throw Error('source_changed');const raw=JSON.parse(String(context.context_json));if(typeof raw.roles?.question!=='string')throw Error('source_changed');units[0]={...units[0],chunk:{...units[0].chunk,contentMd:raw.roles.question}};units.splice(1);}
     const candidates=extractMaterialQuestions(units,'local-text-v1').filter(c=>c.archive.number===q.archive!.number);
     if(candidates.length===1){const c=candidates[0];origin={sources:q.archive.native?q.archive.sources:c.archive.sources,number:c.archive.number,stem:c.fields.stem,risks:c.archive.sourceRisks};}
    }
   }}catch(error){if(error instanceof Error&&['source_incomplete','busy','index_busy'].includes(error.message)){await retry();continue;}/* Invalid evidence stays visible. */}
   let duplicatePlan:Awaited<ReturnType<typeof prepareRuleDuplicate>>;
   if(q)try{duplicatePlan=await prepareRuleDuplicate(this.host,q);}catch(error){if(!['source_changed','unavailable','material_not_found'].includes((error as Error).message)){await retry();continue;}}
   await this.host.withWriter(async target=>{
    let current:QuestionBankItem|undefined;if(q)try{current=await target.host.read(String(row.id));}catch{/* Changed/corrupt history stays unassociated. */}
    if(q&&current&&questionVersion(current)===questionVersion(q)){
     if(origin){await target.validate(current,true);for(const source of verifiedSources??origin.sources)await target.host.materials().source(source);this.controller.signal.throwIfAborted();await recordAiOrigin(target.host,current,origin,verifiedSources);}
     else await recordRuleOrigin(target.host,current);
     if(duplicatePlan){
      if(!await applyRuleDuplicate(target.host,duplicatePlan))await target.host.run('INSERT INTO material_question_origin_dirty_v1(question_id) VALUES(?) ON CONFLICT(question_id) DO UPDATE SET revision=revision+1',[current.id]);
     }else await clearRuleDuplicate(target.host,current.id);
    }
    this.controller.signal.throwIfAborted();
    if(row.revision!==undefined)await target.host.run('DELETE FROM material_question_origin_dirty_v1 WHERE question_id=? AND revision=?',[String(row.id),Number(row.revision)]);
    await target.host.run("INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",['xiaozhi.question-origins.cursor.v1',JSON.stringify({schema:2,cursor:nextCursor})]);
   });cursor=nextCursor;
  }
 }
 async drain(){const row=(await this.host.all("SELECT * FROM material_question_jobs WHERE status='pending' ORDER BY updated_at,resource_id LIMIT 1"))[0];if(!row||this.controller.signal.aborted)return false;const id=String(row.resource_id),version=String(row.version),cursor=Number(row.cursor),token=String(row.parse_token),verification=id+version+token;
  try{
   const resource=await this.host.materials().resource(id);if(resource.contentHash!==version)throw new Error('source_changed');
   const stamp=await this.host.materials().originalStamp(id,version);
   if(this.verified.get(verification)!==stamp){await this.host.materials().verify(id,version,this.controller.signal);if(await this.host.materials().originalStamp(id,version)!==stamp)throw new Error('source_changed');if(this.verified.size>=32)this.verified.delete(this.verified.keys().next().value!);this.verified.set(verification,stamp);}
   const role=await this.bookRole?.(id);
   const structured = await this.structures?.()
     .candidates(id, version, cursor)
     .catch(async (error) => {
       if (error instanceof Error && error.message === "source_incomplete") {
         await this.host.run(
           "UPDATE material_question_jobs SET updated_at=?,error='structure_pending' WHERE resource_id=? AND version=? AND parse_token=? AND cursor=? AND status='pending'",
           [new Date().toISOString(), id, version, token, cursor],
         );
         return null;
       }
       throw error;
     });
   if (structured === null) return false;
   if (structured) {
     await this.host.withWriter(async (target) => {
       const current = (
         await target.host.all(
           "SELECT * FROM material_question_jobs WHERE resource_id=?",
           [id],
         )
       )[0];
       if (
         !current ||
         current.version !== version ||
         current.parse_token !== token ||
         Number(current.cursor) !== cursor ||
         current.status !== "pending"
       )
         return;
       if (JSON.stringify(await target.bookRole?.(id)) !== JSON.stringify(role))
         return;
       if (structured.archiveable &&
         !(await target.structures!().currentPublication(id,version,structured.generation))) return;
       const canArchive = structured.archiveable && role?.kind !== "answers" &&
         !(await isWordPageSource(target.host, resource));
       for (const candidate of structured.items) {
         const q = candidate.question;
         if (
           !canArchive ||
           q.kind !== "question" ||
           q.status !== "candidate" ||
           !candidate.document
         )
           continue;
         const legacyKey = "structure:" + id + ":" + version + ":" + q.id;
         const key = legacyKey + ":" + structured.generation;
         if (
           (
             await target.host.all(
               `SELECT 1 FROM material_question_members m JOIN question_bank_items q ON q.id=m.question_id
                 WHERE m.extraction_key=? OR (m.extraction_key=? AND
                   CASE WHEN json_valid(q.archive_json) THEN json_extract(q.archive_json,'$.structure.generation')=? ELSE 0 END)`,
               [key, legacyKey, structured.generation],
             )
           ).length
         )
           continue;
         await target.structures!().authenticate(
           candidate.reference,
           this.controller.signal,
         );
         if(await target.structures!().archivedOwner(candidate.reference,q))continue;
         if(!await target.structures!().permitsPdfQuestion(resource,q,candidate.reference.generation,this.controller.signal))throw Error("source_changed");
         if (await hasIdenticalVisibleStructureDraft(target.host, legacyKey, candidate.reference)) continue;
         const {units}=await target.structureContext(candidate.reference,q.pageRange);
         if(!units.length)throw Error("source_changed");
         const metadata = units[0].chunk;
         const fields: QuestionBankItemInput &
           import("../../shared/question-archive").ArchiveFields = {
           stem: q.stem,
           answer: q.answer,
           analysis: q.analysis,
           subject: metadata.subject || "",
           grade: metadata.grade || "",
           knowledgePoint: metadata.knowledgePoint || "",
           questionType: metadata.questionType || "",
           difficulty: ["easy", "hard"].includes(metadata.difficulty)
             ? (metadata.difficulty as "easy" | "hard")
             : "medium",
           sourceTitle: resource.originalFileName,
           sourceKind: "teacher_resource",
           tags: ["版面恢复"],
         };
         const archive = {
           schemaVersion: QUESTION_STRUCTURE_ARCHIVE_SCHEMA,
           extractor: "layout-question.v1" as const,
           state: "rule_extracted" as const,
           number: q.number,
           sources: units.map(materialSource),
           issues: [...archiveMissing(fields), "missing_difficulty"],
           sourceRisks: [],
           sourceChecked: false,
           answerOrigin: q.answer ? ("source" as const) : ("missing" as const),
           analysisOrigin: q.analysis
             ? ("source" as const)
             : ("missing" as const),
           structure: candidate.reference,
         };
         const saved = await target.host.create(fields);
         await target.host.run(
           "UPDATE question_bank_items SET archive_json=?,document_json=? WHERE id=?",
           [
             JSON.stringify(archive),
             JSON.stringify(candidate.document),
             saved.id,
           ],
         );
         await target.host.run(
           "INSERT INTO material_question_members(extraction_key,resource_id,question_id,needs_attention) VALUES(?,?,?,1)",
           [key, id, saved.id],
         );
         await stageStructureDraft(target.host, saved.id, id, structured.generation);
         this.controller.signal.throwIfAborted();
       }
       if (structured.archiveable && !structured.hasMore)
         await publishStructureDrafts(target.host, id, structured.generation, canArchive);
       this.controller.signal.throwIfAborted();
       await target.host.run(
         `UPDATE material_question_jobs SET status=?,cursor=?,question_count=CASE WHEN ? THEN question_count ELSE (
            SELECT COUNT(*) FROM material_question_members m JOIN question_bank_items q ON q.id=m.question_id
            WHERE m.resource_id=? AND NOT ${structureDraftHidden}
          ) END,error='',updated_at=? WHERE resource_id=? AND version=? AND parse_token=?`,
         [
           structured.hasMore ? "pending" : "complete",
           cursor + structured.items.length,
           structured.hasMore ? 1 : 0,
           id,
           new Date().toISOString(),
           id,
           version,
           token,
         ],
       );
     });
     return true;
   }
   const pageSource=await isWordPageSource(this.host,resource);
   const snapshot=await this.host.materials().readingWindow(id,cursor),questions=role?.kind==='answers'||pageSource?[]:extractMaterialQuestionWindow(snapshot.units,resource.parseEngine,snapshot.hasMore,cursor);
   await this.host.withWriter(async target=>{
    const current=(await target.host.all("SELECT version,status,cursor,parse_token FROM material_question_jobs WHERE resource_id=?",[id]))[0];if(!current||current.version!==version||current.status!=='pending'||Number(current.cursor)!==cursor||current.parse_token!==token)return;
    // Linking while a local window is being read changes its purpose, not the original file.
    // Leave the cursor pending; the next drain rereads the current role before extracting anything.
    if(JSON.stringify(await target.bookRole?.(id))!==JSON.stringify(role))return;
    if(await isWordPageSource(target.host,resource)!==pageSource)return;
    const fresh=await target.host.materials().readingWindow(id,cursor);if(fresh.fingerprint!==snapshot.fingerprint||fresh.hasMore!==snapshot.hasMore||(await target.host.materials().resource(id)).parseEngine!==resource.parseEngine)throw new Error('source_changed');
    for(const q of questions){
     this.controller.signal.throwIfAborted();const key=materialQuestionExtractionKey(id,version,q.archive.sources,q.key);
     const exists=(await target.host.all('SELECT question_id FROM material_question_members WHERE extraction_key=?',[key]))[0];if(exists)continue;
     const duplicateKey=ruleDuplicateKey(q,snapshot,cursor);if(await reuseRuleDuplicate(target.host,duplicateKey))continue;
     const saved=await target.host.create(q.fields);await target.host.run('UPDATE question_bank_items SET archive_json=? WHERE id=?',[JSON.stringify(q.archive),saved.id]);await target.host.run('INSERT INTO material_question_members(extraction_key,resource_id,question_id,needs_attention) VALUES(?,?,?,?)',[key,id,saved.id,archiveEligible({...saved,archive:q.archive})?0:1]);
     await recordRuleOrigin(target.host,{...saved,archive:q.archive});
     await recordNewRuleDuplicate(target.host,{...saved,archive:q.archive},duplicateKey);
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
 private async structureContext(reference:DocumentStructureReference,pageRange:[number,number]) {
  const resource=await this.host.materials().resource(reference.resourceId);
  if(resource.contentHash!==reference.version)throw Error('source_changed');
  // Legacy archive catch-up and search migration may start together. Resolve visibility under this writer.
  await this.reconcileStructureSearch?.(reference);
  return {resource,units:await this.host.materials().publishedPageSources(resource,pageRange)};
 }

 async reviewStructure(input:StructureReviewInput) {
  if(!validStructureReviewInput(input)||!this.structures)throw Error('invalid_input');
  const fields=Object.fromEntries(Object.entries(input.fields).map(([key,value])=>[key,value.trim()])) as ArchiveEdit['fields'];
  const existing=await this.reviewedStructure(input.reference,fields);
  if(existing)return existing;
  const prepared=await this.structures().prepareReview(input.reference,new AbortController().signal);
  return this.host.withWriter(async target=>{
   const existing=await target.reviewedStructure(input.reference,fields);
   if(existing)return existing;
   if(!target.structures)throw Error('source_changed');
   await target.structures().assertReviewCurrent(input.reference);
   if(await target.structures().archivedOwner(input.reference,prepared.question))throw Error('structure_already_reviewed');
   await target.host.materials().verify(input.reference.resourceId,input.reference.version,new AbortController().signal);
   if((await target.bookRole?.(input.reference.resourceId))?.kind==='answers')throw Error('structure_source_incomplete');
   const {resource,units}=await target.structureContext(input.reference,prepared.question.pageRange);
   if(!units.length)throw Error('source_incomplete');
   const key='structure:'+resource.id+':'+resource.contentHash+':'+prepared.question.id+':'+input.reference.generation;
   if((await target.host.all('SELECT 1 FROM material_question_members WHERE extraction_key=?',[key])).length)throw Error('structure_already_reviewed');
   const saved=await target.host.create({...fields,sourceKind:'teacher_resource',sourceTitle:resource.originalFileName,tags:['教师结构核对']});
   const receipt=await target.structures().recordReview(prepared,fields,saved.id);
   const document=reviseStructureDocument(prepared.document,fields);
   const archive={schemaVersion:QUESTION_STRUCTURE_ARCHIVE_SCHEMA,extractor:'layout-question.v1' as const,state:'teacher_edited' as const,number:prepared.question.number,sources:units.map(materialSource),issues:archiveMissing(fields),sourceRisks:[],sourceChecked:true,answerOrigin:document.answer.origin,analysisOrigin:document.analysis.origin,structure:input.reference,structureReview:receipt};
   await target.host.run('UPDATE question_bank_items SET archive_json=?,document_json=? WHERE id=?',[JSON.stringify(archive),JSON.stringify(document),saved.id]);
   await target.host.run('INSERT INTO material_question_members(extraction_key,resource_id,question_id,needs_attention) VALUES(?,?,?,?)',[key,resource.id,saved.id,archiveEligible({...fields,archive})?0:1]);
   const result=await target.host.read(saved.id);
   if(!result)throw Error('source_changed');
   await target.validate(result);
   return result;
  });
 }

 private async reviewedStructure(reference:DocumentStructureReference,fields:ArchiveEdit['fields']) {
  const saved=await this.structures?.().reviewed(reference);
  if(!saved)return;
  if(saved.body.reference.generation!==reference.generation||saved.body.reference.sha256!==reference.sha256
   ||!(Object.keys(fields) as (keyof typeof fields)[]).every(key=>fields[key]===saved.body.fields[key]))throw Error('structure_already_reviewed');
  const question=await this.host.read(saved.body.questionId);
  if(!question)throw Error('source_changed');
  await this.validate(question);
  return question;
 }

 async completeStructureContext(input:QuestionContextEditInput,current:()=>boolean,verify:(q:QuestionBankItem,signal:AbortSignal)=>Promise<void>,afterWrite?:(current:()=>boolean)=>Promise<void>):Promise<QuestionContextSource>{
  const check=()=>{if(!current())throw Error('cancelled');};
  const signal=new AbortController().signal;
  return this.host.withWriter(async target=>{
   check();
   const structures=target.structures?.(),q=await target.host.read(input.questionId);
   if(!structures||!q?.archive?.structure)throw Error('source_changed');
   const retry=await structures.contextRequest(q.id,input.requestId);
   if(retry){
    if(JSON.stringify(retry.input)!==JSON.stringify(input)||questionVersion(q)!==retry.saved.version)throw Error('conflict');
    await structures.validate(q,signal);await verify(q,signal);check();return retry.saved;
   }
   if(questionVersion(q)!==input.version)throw Error('source_changed');
   await assertStructureDraftEditable(target.host,q.id);
   const next=await structures.completeContext(q,input,signal);
   await verify(q,signal);check();
   const saved=await structures.recordContext(input,next,questionVersion(next));
   await target.host.run('UPDATE question_bank_items SET stem=?,document_json=?,updated_at=? WHERE id=?',
    [next.stem,JSON.stringify(next.document),next.updatedAt,next.id]);
   await afterWrite?.(current);check();
   const latest=await target.host.read(next.id);
   if(!latest||questionVersion(latest)!==saved.version)throw Error('source_changed');
   await structures.validate(latest,signal);check();return saved;
  });
 }

 async validate(q:QuestionBankItem,requireComplete=false,teacherEdit=false){
  if(!q.archive)return;if(requireComplete&&!archiveEligible(q))throw new Error('question_archive_incomplete');
  if(q.archive.structure){if(!this.structures)throw Error('source_changed');await this.structures().validate(q);return;}
  if(q.archive.native){if(!this.host.validateNative)throw Error('source_changed');await this.host.validateNative(q);}
  if(q.archive.book){if(!this.validateBook)throw Error('source_changed');await this.validateBook(q);}
  if(q.archive.web){if(!this.host.validateWeb)throw new Error('source_changed');await this.host.validateWeb(q);}
  if(q.archive.ai){const validate=teacherEdit?this.host.validateAiForEdit||this.host.validateAi:this.host.validateAi;if(!validate)throw new Error('source_changed');await validate(q);}
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
  const q=await target.host.read(input.questionId);if(!q||questionVersion(q)!==input.version)throw new Error('source_changed');
  if(q.archive?.structure)await assertStructureDraftEditable(target.host,q.id);
  const fields=Object.fromEntries(Object.entries(input.fields).map(([k,v])=>[k,v.trim()])) as typeof input.fields;
  if(!q.archive){
   if(!plainTeacherQuestion(q))throw Error('source_changed');
   await target.host.run('UPDATE question_bank_items SET subject=?,grade=?,knowledge_point=?,question_type=?,difficulty=?,stem=?,answer=?,analysis=?,updated_at=? WHERE id=?',[fields.subject,fields.grade,fields.knowledgePoint,fields.questionType,fields.difficulty,fields.stem,fields.answer,fields.analysis,new Date().toISOString(),q.id]);
   return target.host.read(q.id);
  }
  await target.validate(q,false,true);
  if(q.archive.web&&fields.stem!==q.stem&&(['answer','analysis'] as const).some(role=>q.archive!.web!.roles[role]&&fields[role]===q[role]))throw new Error('web_answer_question_changed');
  if(q.archive.book&&fields.stem!==q.stem&&(['answer','analysis'] as const).some(role=>q.archive!.book!.roles[role]&&fields[role]===q[role]))throw Error('book_answer_question_changed');
  // A checkbox cannot restore a missing figure or expand an intentionally incomplete long-question placeholder.
  const issues=archiveIssuesAfterEdit(q.archive,q,fields,input.sourceChecked);
  const archive={...q.archive,state:'teacher_edited' as const,issues,sourceChecked:input.sourceChecked,answerOrigin:fields.answer===q.answer?q.archive.answerOrigin:fields.answer?'teacher':'missing',analysisOrigin:fields.analysis===q.analysis?q.archive.analysisOrigin:fields.analysis?'teacher':'missing'};
  const document=(archive.structure||archive.ai?.policy==='page-crop-complete.v1')?await target.host.revisePage?.(q,fields,input.sourceChecked):undefined;
  if((archive.structure||archive.ai?.policy==='page-crop-complete.v1')&&!document)throw Error('source_changed');
  if(document&&fields.stem!==q.stem&&!input.sourceChecked&&!archive.issues.includes('incomplete_question'))archive.issues.push('incomplete_question');
  if(document&&'context'in document&&document.context.presentation?.mode==='needs_review'&&!archive.issues.includes('incomplete_question'))archive.issues.push('incomplete_question');
  if(document&&'context'in document&&document.context.presentation?.mode==='teacher_text'&&input.sourceChecked)archive.issues=archive.issues.filter(code=>code!=='incomplete_question');
  if(archive.native){
   if(!permit||!target.host.reviseNative)throw Error('source_changed');archive.native=await target.host.reviseNative(q,fields,input.sourceChecked,permit);
   if(archive.native&&!nativeQuestionComplete(archive.native)&&!archive.issues.includes('incomplete_question'))archive.issues.push('incomplete_question');
   else if(archive.native&&nativeQuestionComplete(archive.native)&&input.sourceChecked)archive.issues=archive.issues.filter(code=>code!=='incomplete_question');
  }
  if(archive.book){archive.book=structuredClone(archive.book);for(const role of ['answer','analysis'] as const)if(fields[role]!==q[role]||fields.stem!==q.stem)delete archive.book.roles[role];}
  if(archive.web){archive.web=structuredClone(archive.web);for(const role of ['answer','analysis'] as const)if(fields[role]!==q[role]||fields.stem!==q.stem)delete archive.web.roles[role];}
  await target.host.run('UPDATE question_bank_items SET subject=?,grade=?,knowledge_point=?,question_type=?,difficulty=?,stem=?,answer=?,analysis=?,archive_json=?,document_json=COALESCE(?,document_json),updated_at=? WHERE id=?',[fields.subject,fields.grade,fields.knowledgePoint,fields.questionType,fields.difficulty,fields.stem,fields.answer,fields.analysis,JSON.stringify(archive),document?JSON.stringify(document):null,new Date().toISOString(),q.id]);
  await target.host.run('UPDATE material_question_members SET needs_attention=? WHERE question_id=?',[archiveEligible({...fields,archive})?0:1,q.id]);
  if (archive.structure && q.archive.sourceChecked && !input.sourceChecked) {
   // This older record may have blocked a new archive while it was verified.
   const {resourceId,version,generation}=archive.structure;
   await target.host.run(`UPDATE material_question_jobs SET status='pending',cursor=0,error='',updated_at=datetime('now')
     WHERE resource_id=? AND version=? AND parse_token LIKE ? AND parse_token<>?`,
    [resourceId,version,DOCUMENT_STRUCTURE_ENGINE + ":%" + STRUCTURE_BANK_REVISION,
      DOCUMENT_STRUCTURE_ENGINE + ":" + generation + STRUCTURE_BANK_REVISION]);
  }
  const saved=await target.host.read(q.id);if(archive.native){if(!saved||!permit||!target.host.publishNative)throw Error('source_changed');await target.host.publishNative(saved,permit);}return saved;
 });}
}
