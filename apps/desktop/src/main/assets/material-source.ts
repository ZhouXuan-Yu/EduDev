import {createHash} from 'node:crypto';
import type {ResourceChunk} from '../../shared/contracts';
import {MATERIAL_SOURCE_SCHEMA,type MaterialSource} from '../../shared/materials';
export type MaterialReadingUnit={resourceId:string;version:string;title:string;offset:number;chunk:ResourceChunk};
export const materialBodyVersion=(chunk:ResourceChunk)=>{
 const fields:unknown[]=[chunk.id,chunk.chunkIndex,chunk.contentMd,chunk.containsPersonalData];
 // Preserve historical unknown-page receipts; real page identity must be CAS-protected.
 if(chunk.pageNumber)fields.push({pageNumber:chunk.pageNumber});
 return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
};
export function materialSource(unit:MaterialReadingUnit):MaterialSource{return {schemaVersion:MATERIAL_SOURCE_SCHEMA,resourceId:unit.resourceId,version:unit.version,offset:unit.offset,chunkId:unit.chunk.id,bodyVersion:materialBodyVersion(unit.chunk)};}
