import {validMaterialSource,type MaterialSource} from './materials';
import {validCurriculumEntry,type CurriculumEntry} from './material-curriculum';

export const CLASSROOM_CONTEXT_SCHEMA='xiaozhi.classroom-context.v1' as const;
/** Evidence of a delivered excerpt, never a claim that a whole book was read. */
export type ClassroomMaterial={source:MaterialSource;title:string;characters:number;truncated:boolean;recognition:'saved_text'|'local_ocr_unreviewed';curriculum?:CurriculumEntry};
export type ClassroomContext={schemaVersion:typeof CLASSROOM_CONTEXT_SCHEMA;materials:ClassroomMaterial[];preferenceRevision:number;adopted?:CurriculumEntry[]};
export function validClassroomMaterial(value:unknown):value is ClassroomMaterial{
 const v=value as ClassroomMaterial;
 return !!v&&typeof v==='object'&&Object.keys(v).length===(v.curriculum===undefined?5:6)&&Object.keys(v).every(k=>['source','title','characters','truncated','recognition','curriculum'].includes(k))&&validMaterialSource(v.source)&&typeof v.title==='string'&&v.title.trim().length>0&&v.title.length<=200&&!/[\x00-\x1f]/.test(v.title)&&Number.isSafeInteger(v.characters)&&v.characters>0&&v.characters<=12000&&typeof v.truncated==='boolean'&&['saved_text','local_ocr_unreviewed'].includes(v.recognition)&&(v.curriculum===undefined||validCurriculumEntry(v.curriculum)&&v.curriculum.source.resourceId===v.source.resourceId&&v.curriculum.source.version===v.source.version);
}
export function validClassroomContext(value:unknown):value is ClassroomContext{
 const v=value as ClassroomContext;
 return !!v&&typeof v==='object'&&Object.keys(v).length===(v.adopted===undefined?3:4)&&Object.keys(v).every(k=>['schemaVersion','materials','preferenceRevision','adopted'].includes(k))&&v.schemaVersion===CLASSROOM_CONTEXT_SCHEMA&&Number.isSafeInteger(v.preferenceRevision)&&v.preferenceRevision>=0&&Array.isArray(v.materials)&&v.materials.length<=24&&v.materials.every(validClassroomMaterial)&&new Set(v.materials.map(m=>m.source.resourceId+'/'+m.source.chunkId)).size===v.materials.length&&(v.adopted===undefined||Array.isArray(v.adopted)&&v.adopted.length<=3&&v.adopted.every(validCurriculumEntry)&&new Set(v.adopted.map(e=>e.source.resourceId)).size===v.adopted.length);
}
