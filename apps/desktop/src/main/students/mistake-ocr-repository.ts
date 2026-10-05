import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {MistakeImageAnalysis,SanitizedProblemText} from '../../shared/contracts';
import {validMistakeOcrProvenance,type MistakeOcrInput,type MistakeOcrCorrection} from '../../shared/mistake-ocr';
import type {LocalOcrReceipt} from '../../shared/xiaozhi-ocr';
import {createAttachmentReader} from '../xiaozhi-agent/attachment-service';
import {workspaceHash} from '../xiaozhi-agent/workspace-authority';
type Row=Record<string,unknown>;
export type MistakeOcrSql={all:(sql:string,params?:(string|number|null)[])=>Promise<Row[]>;run:(sql:string,params?:(string|number|null)[])=>Promise<void>;map:(row:Row)=>MistakeImageAnalysis;sanitize:(text:string,studentId:string)=>Promise<SanitizedProblemText>;correct:(id:string,text:string)=>Promise<MistakeImageAnalysis>};
type Host=MistakeOcrSql&{dataRoot:()=>string;transaction:<T>(action:(sql:MistakeOcrSql)=>Promise<T>)=>Promise<T>};
export function mistakeAnalysisVersion(analysis:MistakeImageAnalysis){const {version:_version,...facts}=analysis;return createHash('sha256').update(JSON.stringify(facts)).digest('hex');}
export class MistakeOcrRepository{
 private host:Host;
 constructor(host:Host){this.host=host;}
 async row(sql:MistakeOcrSql,input:MistakeOcrInput,requireVersion=true){
  const row=(await sql.all(`SELECT m.*,a.file_path AS source_path,a.content_hash AS source_hash,a.file_type AS source_type FROM mistake_image_analyses m JOIN students s ON s.id=m.student_id JOIN learning_records r ON r.id=m.record_id AND r.student_id=m.student_id JOIN attachments a ON a.id=m.attachment_id AND a.student_id=m.student_id AND a.record_id=m.record_id WHERE m.id=? AND m.student_id=? AND s.status='active' AND r.record_type='mistake'`,[input.analysisId,input.studentId]))[0];
  if(!row||row.source_type!=='image'||row.local_path!==row.source_path)throw new Error('permission_denied');
  if(typeof row.record_id!=='string'||!/^record_[a-f0-9-]{36}$/i.test(row.record_id))throw new Error('permission_denied');
  const analysis=sql.map(row);if(requireVersion&&analysis.version!==input.version)throw new Error('source_changed');return{row,analysis};
 }
 async capture(row:Row,input:MistakeOcrInput,signal:AbortSignal){
  signal.throwIfAborted();const root=path.resolve(this.host.dataRoot()),owned=path.join(root,'students',input.studentId,'records',String(row.record_id),'attachments'),target=String(row.source_path),relative=path.relative(owned,target);
  if(!path.isAbsolute(target)||!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('permission_denied');
  for(let cursor=owned;;cursor=path.dirname(cursor)){if(fs.lstatSync(cursor).isSymbolicLink()||fs.realpathSync(cursor).toLowerCase()!==path.resolve(cursor).toLowerCase())throw new Error('permission_denied');if(cursor===path.dirname(cursor))break;}
  // Reuse the exact selected-attachment byte reader, MIME check, bounded stream and file-version guards.
  const reader=createAttachmentReader({resolve:async()=>({path:owned,label:'本地错题图片',version:workspaceHash(owned)})});
  const value=await reader.readBytes('aisession_'+input.studentId.slice(8),relative.split(path.sep).join('/'),signal);
  if(value.candidate.contentSha256!==row.source_hash)throw new Error('source_changed');return value;
 }
 async recognize(input:MistakeOcrInput,signal:AbortSignal,recognize:(bytes:Buffer,signal:AbortSignal)=>Promise<Extract<LocalOcrReceipt,{ok:true}>>){
  const before=await this.row(this.host,input);if(before.analysis.ocrStatus==='teacher_corrected')throw new Error('conflict');
  const source=await this.capture(before.row,input,signal),saved=before.analysis.localOcr;
  if(saved&&saved.sourceSha256===source.candidate.contentSha256&&saved.sourceVersion===source.candidate.version)return before.analysis;
  const receipt=await recognize(source.bytes,signal);signal.throwIfAborted();
  return this.host.transaction(async sql=>{
   const current=await this.row(sql,input),latest=await this.capture(current.row,input,signal);
   if(latest.candidate.version!==source.candidate.version)throw new Error('source_changed');
   const provenance={schemaVersion:receipt.schemaVersion,engine:receipt.engine,sourceSha256:latest.candidate.contentSha256,sourceVersion:latest.candidate.version,original:receipt.text};
   if(!validMistakeOcrProvenance(provenance))throw new Error('parse_failed');
   const sanitized=await sql.sanitize(receipt.text,input.studentId);signal.throwIfAborted();
   await sql.run(`UPDATE mistake_image_analyses SET ocr_status='sanitized',extracted_text=?,sanitized_text=?,redactions_json=?,local_ocr_json=?,error_message='',updated_at=? WHERE id=?`,[receipt.text,sanitized.sanitizedText,JSON.stringify(sanitized.redactions),JSON.stringify(provenance),new Date().toISOString(),input.analysisId]);
   const final=await this.capture(current.row,input,signal);if(final.candidate.version!==latest.candidate.version)throw new Error('source_changed');signal.throwIfAborted();
   return sql.map((await sql.all('SELECT * FROM mistake_image_analyses WHERE id=?',[input.analysisId]))[0]);
  });
 }
 async correct(input:MistakeOcrCorrection,signal:AbortSignal){return this.host.transaction(async sql=>{
  const {row,analysis}=await this.row(sql,input),source=await this.capture(row,input,signal);
  if(!analysis.localOcr||analysis.localOcr.sourceSha256!==source.candidate.contentSha256||analysis.localOcr.sourceVersion!==source.candidate.version)throw new Error('source_changed');
  const value=await sql.correct(input.analysisId,input.text);signal.throwIfAborted();
  const final=await this.capture(row,input,signal);if(final.candidate.version!==source.candidate.version)throw new Error('source_changed');signal.throwIfAborted();return value;
 });}
}
