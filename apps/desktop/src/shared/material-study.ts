import {materialId,validMaterialSource,type MaterialSource,type MaterialSourceView} from './materials';
export const MATERIAL_STUDY_SCHEMA='xiaozhi.material-study.v1' as const;
export type MaterialStudyEntry={id:string;source:MaterialSource;note:string;completed:boolean;updatedAt:string};
export type MaterialStudyView={schemaVersion:typeof MATERIAL_STUDY_SCHEMA;entry?:MaterialStudyEntry;stale:boolean};
export type MaterialStudyQuery={schemaVersion:typeof MATERIAL_STUDY_SCHEMA;resourceId:string};
export type MaterialStudySave={schemaVersion:typeof MATERIAL_STUDY_SCHEMA;source:MaterialSource;expectedRevision:string|null;note:string;completed:boolean};
export type MaterialStudyQuestion={schemaVersion:typeof MATERIAL_STUDY_SCHEMA;source:MaterialSource;question:string};
export type MaterialStudyPage=MaterialSourceView&{savedNote?:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
export const studyRevision=(v:unknown):v is string=>typeof v==='string'&&/^read_[a-f0-9-]{36}$/i.test(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
export function validStudyQuery(v:unknown):v is MaterialStudyQuery{return object(v)&&Object.keys(v).length===2&&v.schemaVersion===MATERIAL_STUDY_SCHEMA&&materialId(v.resourceId);}
export function validStudySave(v:unknown):v is MaterialStudySave{return object(v)&&Object.keys(v).length===5&&v.schemaVersion===MATERIAL_STUDY_SCHEMA&&validMaterialSource(v.source)&&(v.expectedRevision===null||studyRevision(v.expectedRevision))&&text(v.note,8000)&&typeof v.completed==='boolean';}
export function validStudyQuestion(v:unknown):v is MaterialStudyQuestion{return object(v)&&Object.keys(v).length===3&&v.schemaVersion===MATERIAL_STUDY_SCHEMA&&validMaterialSource(v.source)&&text(v.question,2000)&&!!v.question.trim();}
