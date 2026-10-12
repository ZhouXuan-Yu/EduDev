import {createHash,randomUUID} from 'node:crypto';
import type {Sql} from './session-state';
import {validOfficeDraft,isPaperOfficeDraft,officeOutputFormat,OFFICE_OUTPUT_MAX_BYTES,type OfficeDraft} from '../../shared/xiaozhi-office-draft';
import {OFFICE_ARTIFACT_SCHEMA,officeRelativePath,officeHash,type OfficeArtifactSource,type OfficeArtifactSummary,type OfficeArtifactState} from '../../shared/xiaozhi-office-artifacts';
import {PAPER_RICH_OFFICE_SCHEMA,PAPER_MATH_OFFICE_SCHEMA,PAPER_TABLE_OFFICE_SCHEMA,isRichPaperOfficeSchema} from '../../shared/paper-export';
export const OFFICE_GENERATOR_VERSION='office1:docx9.8.1/exceljs4.4.0/pptxgenjs4.0.1/hana0.449.0';
const generatorVersion=(draft:OfficeDraft)=>isPaperOfficeDraft(draft)?(draft.schemaVersion===PAPER_TABLE_OFFICE_SCHEMA?'paper-office5:marked17.0.6:katex0.16.47:':draft.schemaVersion===PAPER_MATH_OFFICE_SCHEMA?'paper-office4:katex0.16.47:':draft.schemaVersion===PAPER_RICH_OFFICE_SCHEMA?'paper-office3:':'paper-office2:')+OFFICE_GENERATOR_VERSION:OFFICE_GENERATOR_VERSION;
export const officeSha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
export type PrivateOfficeArtifact=OfficeArtifactSummary & {sessionId:string;workspaceHash:string;inputHash:string;draft:OfficeDraft;draftHash:string;imageReviewHash:string|null;sources:OfficeArtifactSource[];parentArtifactId:string|null;output:Buffer|null;outputHash:string|null;resultPath:string|null};
const states=new Set<OfficeArtifactState>(['pending','approved','generating','prepared','committing','saved','rejected','interrupted','uncertain','conflict','failed']);
export function officeSummary(x:PrivateOfficeArtifact):OfficeArtifactSummary {
 const {schemaVersion,id,runId,callId,path,format,state,revision,artifactId,sourceCount}=x;
 return {schemaVersion,id,runId,callId,path,format,state,revision,artifactId,sourceCount:sourceCount+(isPaperOfficeDraft(x.draft)?1:0)};
}
export function officeDraftText(draft:OfficeDraft){
 return [draft.title,...draft.sections.flatMap(s=>[s.heading,...s.paragraphs,...(s.table?[s.table.columns.join(' | '),...s.table.rows.map(row=>row.join(' | '))]:[])])].join('\n\n');
}
const mime={docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pdf:'application/pdf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
/** Private draft intent. A saved CAS and its SQLite trigger atomically publish existing artifact facts. */
export function createOfficeArtifactState(sql:Sql){
 const now=()=>new Date().toISOString();
 async function parse(row:Record<string,unknown>):Promise<PrivateOfficeArtifact>{
  try{
   const draft=JSON.parse(String(row.draft_json));
   const sources=(await sql.all('SELECT * FROM xiaozhi_pi_office_draft_sources WHERE draft_id=? ORDER BY ordinal',[String(row.id)])).map((s,index)=>{
    if(Number(s.ordinal)!==index||!['workspace_file','parent_artifact'].includes(String(s.kind))||!officeRelativePath(s.relative_path)||!officeHash(s.file_version)||!officeHash(s.sha256)
     ||(s.kind==='workspace_file'?s.source_id!=='':typeof s.source_id!=='string'||!/^artifact_[a-f0-9-]{36}$/i.test(s.source_id)))throw new Error('configuration');
    return {kind:s.kind,sourceId:s.source_id,path:s.relative_path,version:s.file_version,sha256:s.sha256} as OfficeArtifactSource;
   });
   const x:PrivateOfficeArtifact={schemaVersion:OFFICE_ARTIFACT_SCHEMA,id:String(row.id),sessionId:String(row.conversation_id),runId:String(row.run_id),callId:String(row.call_id),path:String(row.relative_path),format:row.format as PrivateOfficeArtifact['format'],state:row.state as OfficeArtifactState,revision:Number(row.revision),artifactId:row.artifact_id===null?null:String(row.artifact_id),sourceCount:sources.length,workspaceHash:String(row.workspace_hash),inputHash:String(row.input_hash),draft,draftHash:String(row.draft_hash),imageReviewHash:row.image_review_hash==null?null:String(row.image_review_hash),sources,parentArtifactId:row.parent_artifact_id===null?null:String(row.parent_artifact_id),output:row.output_bytes===null?null:Buffer.from(row.output_bytes as Uint8Array),outputHash:row.output_hash===null?null:String(row.output_hash),resultPath:row.result_path===null?null:String(row.result_path)};
   if(Number(row.schema_version)!==1||!/^xioffice_[a-f0-9-]{36}$/i.test(x.id)||!/^aisession_[a-f0-9-]{36}$/i.test(x.sessionId)
    ||!x.runId||x.runId.length>128||!x.callId||x.callId.length>128||!officeRelativePath(x.path)||!officeOutputFormat(x.format)||!x.path.toLowerCase().endsWith('.'+x.format)
    ||!states.has(x.state)||!Number.isSafeInteger(x.revision)||x.revision<0||!officeHash(x.workspaceHash)||!officeHash(x.inputHash)
    ||!validOfficeDraft(draft)||officeSha(JSON.stringify(draft))!==x.draftHash||String(row.content_md)!==officeDraftText(draft)
    ||sources.length>(x.parentArtifactId?17:16)||officeSha(JSON.stringify(sources))!==row.sources_hash||officeSha(String(row.sources_json))!==row.sources_hash||new Set(sources.map(s=>s.path.toLowerCase())).size!==sources.length
    ||sources.filter(s=>s.kind==='parent_artifact').length!==(x.parentArtifactId?1:0)||sources.some(s=>s.kind==='parent_artifact'&&s.sourceId!==x.parentArtifactId)
    ||row.generator_version!==generatorVersion(draft)||row.mime_type!==mime[x.format]||row.title!==draft.title
    ||isPaperOfficeDraft(draft)&&(sources.length!==0||x.parentArtifactId!==null||!['docx','pdf'].includes(x.format))
    ||(x.imageReviewHash!==null&&(!officeHash(x.imageReviewHash)||x.imageReviewHash!==x.draftHash))
    ||isRichPaperOfficeSchema(draft.schemaVersion)&&draft.sections.some(s=>s.figures?.length)&&['approved','generating','prepared','committing','saved','uncertain'].includes(x.state)&&x.imageReviewHash!==x.draftHash
    ||x.artifactId!==null&&!/^artifact_[a-f0-9-]{36}$/i.test(x.artifactId)
    ||(x.output===null?x.outputHash!==null:!x.output.length||x.output.length>OFFICE_OUTPUT_MAX_BYTES||officeSha(x.output)!==x.outputHash)
    ||['prepared','committing','saved','uncertain'].includes(x.state)&&(!x.output||!x.artifactId||!x.resultPath))throw new Error('configuration');
   if(x.state==='saved'&&isPaperOfficeDraft(draft)){
    const lineage=await sql.all('SELECT * FROM document_artifact_paper_sources WHERE artifact_id=?',[x.artifactId!]);
    if(lineage.length!==1||lineage[0].draft_id!==x.id||lineage[0].paper_id!==draft.paperSource.paperId||lineage[0].paper_digest!==draft.paperSource.digest||lineage[0].audience!==draft.paperSource.audience||Number(lineage[0].schema_version)!==1
      ||(await sql.all('SELECT * FROM document_artifact_sources WHERE artifact_id=?',[x.artifactId!])).length)throw new Error('configuration');
   }
   return x;
  }catch{throw new Error('configuration');}
 }
 async function get(id:string){const row=(await sql.all('SELECT * FROM xiaozhi_pi_office_drafts WHERE id=?',[id]))[0];return row?parse(row):null;}
 async function call(sessionId:string,runId:string,callId:string){const row=(await sql.all('SELECT * FROM xiaozhi_pi_office_drafts WHERE conversation_id=? AND run_id=? AND call_id=?',[sessionId,runId,callId]))[0];return row?parse(row):null;}
 async function cas(row:PrivateOfficeArtifact,from:OfficeArtifactState[],to:OfficeArtifactState,extra:{draft?:OfficeDraft;output?:Buffer;resultPath?:string;imagesReviewed?:true}={}){
  if(!from.includes(row.state)||!states.has(to)||!sql.change)throw new Error('conflict');
  const draft=extra.draft??row.draft,output=extra.output??row.output;
  if(isRichPaperOfficeSchema(draft.schemaVersion)&&draft.sections.some(s=>s.figures?.length)&&to==='approved'&&extra.imagesReviewed!==true)throw new Error('invalid_input');
  const imageReviewHash=to==='pending'?null:extra.imagesReviewed===true?officeSha(JSON.stringify(draft)):row.imageReviewHash;
  if(!validOfficeDraft(draft)||output&&(!output.length||output.length>OFFICE_OUTPUT_MAX_BYTES))throw new Error('invalid_input');
  const updated=await sql.change(`UPDATE xiaozhi_pi_office_drafts SET state=?,revision=revision+1,image_review_hash=?,draft_json=?,draft_hash=?,title=?,content_md=?,output_bytes=?,output_hash=?,artifact_id=?,result_path=?,updated_at=? WHERE id=? AND conversation_id=? AND state=? AND revision=? AND schema_version=1`,
   [to,imageReviewHash,JSON.stringify(draft),officeSha(JSON.stringify(draft)),draft.title,officeDraftText(draft),output,output?officeSha(output):null,output?(row.artifactId??`artifact_${randomUUID()}`):row.artifactId,extra.resultPath??row.resultPath,now(),row.id,row.sessionId,row.state,row.revision]);
  if(updated!==1)throw new Error('conflict');return (await get(row.id))!;
 }
 return {get,call,transition:cas,
  async migrate(){
   await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_office_drafts (
    id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id),schema_version INTEGER NOT NULL CHECK(schema_version=1),run_id TEXT NOT NULL,call_id TEXT NOT NULL,workspace_hash TEXT NOT NULL,input_hash TEXT NOT NULL,
    relative_path TEXT NOT NULL,format TEXT NOT NULL CHECK(format IN ('docx','pdf','xlsx','pptx')),draft_json TEXT NOT NULL CHECK(length(CAST(draft_json AS BLOB))<=262144),draft_hash TEXT NOT NULL,image_review_hash TEXT,sources_json TEXT NOT NULL CHECK(json_valid(sources_json)),sources_hash TEXT NOT NULL,parent_artifact_id TEXT,
    title TEXT NOT NULL,content_md TEXT NOT NULL,mime_type TEXT NOT NULL,generator_version TEXT NOT NULL,
    output_bytes BLOB CHECK(output_bytes IS NULL OR length(output_bytes)<=16777216),output_hash TEXT,artifact_id TEXT UNIQUE,result_path TEXT,
    state TEXT NOT NULL CHECK(state IN ('pending','approved','generating','prepared','committing','saved','rejected','interrupted','uncertain','conflict','failed')),revision INTEGER NOT NULL CHECK(revision>=0),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(conversation_id,run_id,call_id))`);
   if(!(await sql.all('PRAGMA table_info(xiaozhi_pi_office_drafts)')).some(c=>c.name==='image_review_hash'))await sql.run('ALTER TABLE xiaozhi_pi_office_drafts ADD COLUMN image_review_hash TEXT');
   await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_office_draft_sources (draft_id TEXT NOT NULL REFERENCES xiaozhi_pi_office_drafts(id),ordinal INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('workspace_file','parent_artifact')),source_id TEXT NOT NULL,relative_path TEXT NOT NULL,file_version TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(draft_id,ordinal))`);
   await sql.run(`CREATE TABLE IF NOT EXISTS document_artifact_sources (artifact_id TEXT NOT NULL REFERENCES document_artifacts(id),ordinal INTEGER NOT NULL,source_type TEXT NOT NULL CHECK(source_type IN ('workspace_file','parent_artifact','ai_generated')),source_id TEXT NOT NULL,relative_path TEXT NOT NULL,file_version TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(artifact_id,ordinal))`);
   // Derived lineage only; the confirmed paper and draft_json remain the existing truths.
   await sql.run(`CREATE TABLE IF NOT EXISTS document_artifact_paper_sources (artifact_id TEXT PRIMARY KEY REFERENCES document_artifacts(id),draft_id TEXT NOT NULL UNIQUE REFERENCES xiaozhi_pi_office_drafts(id),paper_id TEXT NOT NULL,paper_digest TEXT NOT NULL,audience TEXT NOT NULL CHECK(audience IN ('student','teacher')),schema_version INTEGER NOT NULL CHECK(schema_version=1))`);
   // Keep the legacy publishing trigger and old rows intact. Replace its fallback
   // AI label atomically inside the same SQLite statement for a bound paper draft.
   await sql.run(`CREATE TRIGGER IF NOT EXISTS xiaozhi_office_paper_lineage_v2 AFTER INSERT ON document_artifact_sources
    WHEN NEW.source_type='ai_generated' AND EXISTS(SELECT 1 FROM xiaozhi_pi_office_drafts d WHERE d.artifact_id=NEW.artifact_id AND json_extract(d.draft_json,'$.schemaVersion')='xiaozhi.office-paper-draft.v2') BEGIN
    INSERT INTO document_artifact_paper_sources(artifact_id,draft_id,paper_id,paper_digest,audience,schema_version)
     SELECT NEW.artifact_id,id,json_extract(draft_json,'$.paperSource.paperId'),json_extract(draft_json,'$.paperSource.digest'),json_extract(draft_json,'$.paperSource.audience'),1 FROM xiaozhi_pi_office_drafts WHERE artifact_id=NEW.artifact_id;
    DELETE FROM document_artifact_sources WHERE artifact_id=NEW.artifact_id AND ordinal=NEW.ordinal AND source_type='ai_generated';
   END`);
   await sql.run(`CREATE TRIGGER IF NOT EXISTS xiaozhi_office_paper_lineage_v3 AFTER INSERT ON document_artifact_sources
    WHEN NEW.source_type='ai_generated' AND EXISTS(SELECT 1 FROM xiaozhi_pi_office_drafts d WHERE d.artifact_id=NEW.artifact_id AND json_extract(d.draft_json,'$.schemaVersion')='xiaozhi.office-paper-draft.v3') BEGIN
    INSERT INTO document_artifact_paper_sources(artifact_id,draft_id,paper_id,paper_digest,audience,schema_version)
     SELECT NEW.artifact_id,id,json_extract(draft_json,'$.paperSource.paperId'),json_extract(draft_json,'$.paperSource.digest'),json_extract(draft_json,'$.paperSource.audience'),1 FROM xiaozhi_pi_office_drafts WHERE artifact_id=NEW.artifact_id;
    DELETE FROM document_artifact_sources WHERE artifact_id=NEW.artifact_id AND ordinal=NEW.ordinal AND source_type='ai_generated';
   END`);
   await sql.run(`CREATE TRIGGER IF NOT EXISTS xiaozhi_office_paper_lineage_v4 AFTER INSERT ON document_artifact_sources
    WHEN NEW.source_type='ai_generated' AND EXISTS(SELECT 1 FROM xiaozhi_pi_office_drafts d WHERE d.artifact_id=NEW.artifact_id AND json_extract(d.draft_json,'$.schemaVersion')='xiaozhi.office-paper-draft.v4') BEGIN
    INSERT INTO document_artifact_paper_sources(artifact_id,draft_id,paper_id,paper_digest,audience,schema_version)
     SELECT NEW.artifact_id,id,json_extract(draft_json,'$.paperSource.paperId'),json_extract(draft_json,'$.paperSource.digest'),json_extract(draft_json,'$.paperSource.audience'),1 FROM xiaozhi_pi_office_drafts WHERE artifact_id=NEW.artifact_id;
    DELETE FROM document_artifact_sources WHERE artifact_id=NEW.artifact_id AND ordinal=NEW.ordinal AND source_type='ai_generated';
   END`);
   await sql.run(`CREATE TRIGGER IF NOT EXISTS xiaozhi_office_paper_lineage_v5 AFTER INSERT ON document_artifact_sources
    WHEN NEW.source_type='ai_generated' AND EXISTS(SELECT 1 FROM xiaozhi_pi_office_drafts d WHERE d.artifact_id=NEW.artifact_id AND json_extract(d.draft_json,'$.schemaVersion')='xiaozhi.office-paper-draft.v5') BEGIN
    INSERT INTO document_artifact_paper_sources(artifact_id,draft_id,paper_id,paper_digest,audience,schema_version)
     SELECT NEW.artifact_id,id,json_extract(draft_json,'$.paperSource.paperId'),json_extract(draft_json,'$.paperSource.digest'),json_extract(draft_json,'$.paperSource.audience'),1 FROM xiaozhi_pi_office_drafts WHERE artifact_id=NEW.artifact_id;
    DELETE FROM document_artifact_sources WHERE artifact_id=NEW.artifact_id AND ordinal=NEW.ordinal AND source_type='ai_generated';
   END`);
   await sql.run(`CREATE TRIGGER IF NOT EXISTS xiaozhi_office_sources_capture_v1 AFTER INSERT ON xiaozhi_pi_office_drafts BEGIN
    INSERT INTO xiaozhi_pi_office_draft_sources(draft_id,ordinal,kind,source_id,relative_path,file_version,sha256)
     SELECT NEW.id,CAST(key AS INTEGER),json_extract(value,'$.kind'),json_extract(value,'$.sourceId'),json_extract(value,'$.path'),json_extract(value,'$.version'),json_extract(value,'$.sha256') FROM json_each(NEW.sources_json);
   END`);
   await sql.run(`CREATE TRIGGER IF NOT EXISTS xiaozhi_office_saved_publish_v1 AFTER UPDATE OF state ON xiaozhi_pi_office_drafts WHEN NEW.state='saved' AND OLD.state IN ('committing','uncertain') BEGIN
    SELECT CASE WHEN NEW.output_bytes IS NULL OR NEW.output_hash IS NULL OR NEW.artifact_id IS NULL OR NEW.result_path IS NULL THEN RAISE(ABORT,'configuration') END;
    INSERT INTO document_artifacts(id,session_id,message_id,title,artifact_type,file_name,mime_type,description,content_md,file_path,file_size,content_hash,status,error_message,created_at,updated_at)
     VALUES(NEW.artifact_id,NEW.conversation_id,'',NEW.title,NEW.format,NEW.relative_path,NEW.mime_type,'教师确认的教学办公产物',NEW.content_md,NEW.result_path,length(NEW.output_bytes),NEW.output_hash,'exported','',NEW.created_at,NEW.updated_at);
    INSERT INTO document_artifact_sources(artifact_id,ordinal,source_type,source_id,relative_path,file_version,sha256)
     SELECT NEW.artifact_id,ordinal,kind,source_id,relative_path,file_version,sha256 FROM xiaozhi_pi_office_draft_sources WHERE draft_id=NEW.id;
    INSERT INTO document_artifact_sources(artifact_id,ordinal,source_type,source_id,relative_path,file_version,sha256)
     SELECT NEW.artifact_id,0,'ai_generated','','','','' WHERE NOT EXISTS(SELECT 1 FROM xiaozhi_pi_office_draft_sources WHERE draft_id=NEW.id);
   END`);
  },
  async create(input:Pick<PrivateOfficeArtifact,'sessionId'|'runId'|'callId'|'workspaceHash'|'inputHash'|'path'|'format'|'draft'|'sources'|'parentArtifactId'>){
   const previous=await call(input.sessionId,input.runId,input.callId);
   if(previous){if(previous.inputHash!==input.inputHash||previous.workspaceHash!==input.workspaceHash)throw new Error('conflict');return previous;}
   if(!sql.change)throw new Error('configuration');
   const id=`xioffice_${randomUUID()}`,stamp=now();
   const inserted=await sql.change(`INSERT OR IGNORE INTO xiaozhi_pi_office_drafts(id,conversation_id,schema_version,run_id,call_id,workspace_hash,input_hash,relative_path,format,draft_json,draft_hash,sources_json,sources_hash,parent_artifact_id,title,content_md,mime_type,generator_version,state,revision,created_at,updated_at)
    SELECT ?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',0,?,? WHERE (SELECT count(*) FROM xiaozhi_pi_office_drafts WHERE conversation_id=?)<256`,
    [id,input.sessionId,input.runId,input.callId,input.workspaceHash,input.inputHash,input.path,input.format,JSON.stringify(input.draft),officeSha(JSON.stringify(input.draft)),JSON.stringify(input.sources),officeSha(JSON.stringify(input.sources)),input.parentArtifactId,input.draft.title,officeDraftText(input.draft),mime[input.format],generatorVersion(input.draft),stamp,stamp,input.sessionId]);
   if(inserted!==1){const existing=await call(input.sessionId,input.runId,input.callId);if(!existing||existing.inputHash!==input.inputHash||existing.workspaceHash!==input.workspaceHash)throw new Error('conflict');return existing;}
   return (await get(id))!;
  },
  async list(sessionId:string){return Promise.all((await sql.all('SELECT * FROM xiaozhi_pi_office_drafts WHERE conversation_id=? ORDER BY created_at,id',[sessionId])).map(parse));},
  async parent(id:string){return (await sql.all("SELECT * FROM document_artifacts WHERE id=? AND status='exported'",[id]))[0]??null;},
  async invalidateRun(runId:string){await sql.run("UPDATE xiaozhi_pi_office_drafts SET state='interrupted',revision=revision+1,updated_at=? WHERE run_id=? AND state IN ('pending','approved','generating','prepared')",[now(),runId]);},
  async recover(){await sql.run("UPDATE xiaozhi_pi_office_drafts SET state=CASE WHEN state='committing' THEN 'uncertain' ELSE 'interrupted' END,revision=revision+1,updated_at=? WHERE schema_version=1 AND state IN ('pending','approved','generating','prepared','committing')",[now()]);}
 };
}
