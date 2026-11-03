import type {PaperReferenceCandidate} from '../../shared/paper-reference';
import type {ReferenceMaterials} from './paper-reference-source';
import {readReferenceBody} from './paper-reference-source';
import {extractReferenceStructure, referenceHash} from './paper-reference-extract';
import {extractReferenceWordLayout} from './paper-reference-word';
import type {PaperSql} from './paper-sql';
export type TemplateMaterials = ReferenceMaterials & {originalStamp(id:string,version:string):Promise<string>};
/** Caller holds the normal IMMEDIATE source writer lease. File stamp/hash are separately checked. */
export async function extractTemplateSource(sql:PaperSql, materials:TemplateMaterials, resourceId:string, version:string, signal:AbortSignal, trace:(stage:string)=>void=()=>{}):Promise<PaperReferenceCandidate> {
  signal.throwIfAborted();
  if((await sql.all('SELECT 1 FROM resource_chunks WHERE resource_id=? AND contains_personal_data<>0 LIMIT 1',[resourceId])).length) throw Error('permission_denied');
  const row=(await sql.all('SELECT content_hash FROM teacher_resources WHERE id=?',[resourceId]))[0];
  if(row?.content_hash!==version) throw Error('source_changed');
  trace('source-stamp');const stamp=await materials.originalStamp(resourceId,version);
  trace('source-body');
  const body=await readReferenceBody(materials,resourceId,version,signal), candidate=extractReferenceStructure(body);
  const resource=await materials.resource(resourceId); candidate.source.filename=resource.originalFileName;
  trace('source-layout');
  if(/\.docx$/i.test(resource.originalFileName)) await extractReferenceWordLayout(await materials.original(resourceId,version,signal),candidate,signal);
  else candidate.warnings.push('此来源没有可可靠提取的DOCX页面设置；空白版式项须由教师明确填写。');
  trace('source-verify');await materials.verify(resourceId,version,signal);
  if(await materials.originalStamp(resourceId,version)!==stamp) throw Error('source_changed');
  trace('source-recheck');const after=await readReferenceBody(materials,resourceId,version,signal);
  if(after.bodyDigest!==body.bodyDigest || after.complete!==body.complete || after.totalChunks!==body.totalChunks || after.parseEngine!==body.parseEngine) throw Error('source_changed');
  signal.throwIfAborted(); candidate.digest=referenceHash({...candidate,digest:''});trace('source-complete');return candidate;
}
