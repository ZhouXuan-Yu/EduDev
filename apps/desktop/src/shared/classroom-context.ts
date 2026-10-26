import {validMaterialSource,type MaterialSource} from './materials';

export const CLASSROOM_CONTEXT_SCHEMA='xiaozhi.classroom-context.v1' as const;
/** Evidence of a delivered excerpt, never a claim that a whole book was read. */
export type ClassroomMaterial={source:MaterialSource;title:string;characters:number;truncated:boolean;recognition:'saved_text'|'local_ocr_unreviewed'};
export type ClassroomContext={schemaVersion:typeof CLASSROOM_CONTEXT_SCHEMA;materials:ClassroomMaterial[];preferenceRevision:number};
export function validClassroomMaterial(value:unknown):value is ClassroomMaterial{
 const v=value as ClassroomMaterial;
 return !!v&&typeof v==='object'&&Object.keys(v).length===5&&validMaterialSource(v.source)&&typeof v.title==='string'&&v.title.trim().length>0&&v.title.length<=200&&!/[\x00-\x1f]/.test(v.title)&&Number.isSafeInteger(v.characters)&&v.characters>0&&v.characters<=12000&&typeof v.truncated==='boolean'&&['saved_text','local_ocr_unreviewed'].includes(v.recognition);
}
export function validClassroomContext(value:unknown):value is ClassroomContext{
 const v=value as ClassroomContext;
 return !!v&&typeof v==='object'&&Object.keys(v).length===3&&v.schemaVersion===CLASSROOM_CONTEXT_SCHEMA&&Number.isSafeInteger(v.preferenceRevision)&&v.preferenceRevision>=0&&Array.isArray(v.materials)&&v.materials.length<=24&&v.materials.every(validClassroomMaterial)&&new Set(v.materials.map(m=>m.source.resourceId+'/'+m.source.chunkId)).size===v.materials.length;
}
