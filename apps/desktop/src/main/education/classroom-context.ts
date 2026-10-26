import {CLASSROOM_CONTEXT_SCHEMA,validClassroomContext,validClassroomMaterial,type ClassroomContext,type ClassroomMaterial} from '../../shared/classroom-context';
import {materialBodyVersion} from '../assets/material-source';
import type {ResourceChunk} from '../../shared/contracts';
import type {Sql} from '../xiaozhi-agent/session-state';

/** Host-owned run evidence: the model cannot supply or replace these references. */
export function createClassroomContext(preferenceRevision:number){
 const delivered=new Map<string,ClassroomMaterial>();
 return {
  observe(material:ClassroomMaterial){
   if(!validClassroomMaterial(material))throw Error('invalid_input');
   const key=material.source.resourceId+'/'+material.source.chunkId;
   if(!delivered.has(key)&&delivered.size>=24)throw Error('too_large');
   delivered.set(key,structuredClone(material));
  },
  snapshot():ClassroomContext{return {schemaVersion:CLASSROOM_CONTEXT_SCHEMA,materials:structuredClone([...delivered.values()]),preferenceRevision};},
 };
}

/** Reuse the exact MaterialSource body hash while on the classroom's private SQL transaction. */
export async function assertClassroomContext(sql:Sql,context:ClassroomContext){
 if(!validClassroomContext(context))throw Error('invalid_input');
 for(const material of context.materials){
  const s=material.source;
  const row=(await sql.all(`SELECT c.id,c.chunk_index,c.content_md,c.contains_personal_data,c.page_number
   FROM teacher_resources r JOIN resource_chunks c ON c.resource_id=r.id
   WHERE r.id=? AND r.content_hash=? AND r.parse_status IN ('ready','parsed','chunked','indexed','graph_extracted')
   AND c.id=? AND c.id=(SELECT id FROM resource_chunks WHERE resource_id=r.id ORDER BY chunk_index,id LIMIT 1 OFFSET ?)`,[s.resourceId,s.version,s.chunkId,s.offset]))[0];
  if(!row||Number(row.contains_personal_data)!==0)throw Error('source_changed');
  const chunk={id:String(row.id),chunkIndex:Number(row.chunk_index),contentMd:String(row.content_md),containsPersonalData:false,...(row.page_number?{pageNumber:Number(row.page_number)}:{})} as ResourceChunk;
  if(materialBodyVersion(chunk)!==s.bodyVersion)throw Error('source_changed');
 }
}
