import {createHash} from 'node:crypto';
import type {ResourceChunk} from '../../shared/contracts';
import {MATERIAL_SOURCE_SCHEMA,materialCitation,type MaterialSource,type MaterialReference} from '../../shared/materials';
import type {AiTextSource} from '../../shared/material-ai-text';
export type MaterialReadingUnit={resourceId:string;version:string;title:string;offset:number;chunk:ResourceChunk;restored?:AiTextSource};
export const materialBodyVersion=(chunk:ResourceChunk)=>{
 const fields:unknown[]=[chunk.id,chunk.chunkIndex,chunk.contentMd,chunk.containsPersonalData];
 // Preserve historical unknown-page receipts; real page identity must be CAS-protected.
 if(chunk.pageNumber)fields.push({pageNumber:chunk.pageNumber});
 return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
};
export function materialSource(unit:MaterialReadingUnit):MaterialSource{return {schemaVersion:MATERIAL_SOURCE_SCHEMA,resourceId:unit.resourceId,version:unit.version,offset:unit.offset,chunkId:unit.chunk.id,bodyVersion:materialBodyVersion(unit.chunk)};}
export const materialReference=(unit:MaterialReadingUnit):MaterialReference=>unit.restored||materialSource(unit);
export const materialReferenceCitation=(title:string,unit:MaterialReadingUnit)=>unit.restored?`${title} · AI还原正文（原件第${unit.restored.page}页，未经教师逐字核验）`:materialCitation(title,unit.chunk);
export const materialUnitDigest=(unit:MaterialReadingUnit)=>createHash('sha256').update(JSON.stringify([unit.resourceId,unit.version,unit.restored?.bodyVersion||materialBodyVersion(unit.chunk)])).digest('hex');
