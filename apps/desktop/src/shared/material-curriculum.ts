import {materialId,validMaterialSource,type MaterialSource} from './materials';

export const MATERIAL_CURRICULUM_SCHEMA='xiaozhi.material-curriculum.v1' as const;
export type CurriculumMetadata={kind:'standard'|'textbook'|'reference';subject:string;stage:string;grade:string;publisher:string;edition:string;region:string;unit:string;qualification:'teacher_provided'|'synthetic';status:'active'|'withdrawn'};
export type CurriculumEntry={id:string;source:MaterialSource;metadata:CurriculumMetadata;createdAt:string};
export type CurriculumView={schemaVersion:typeof MATERIAL_CURRICULUM_SCHEMA;entry:CurriculumEntry|null;stale:boolean};
export type CurriculumQuery={schemaVersion:typeof MATERIAL_CURRICULUM_SCHEMA;resourceId:string};
export type CurriculumSave={schemaVersion:typeof MATERIAL_CURRICULUM_SCHEMA;source:MaterialSource;expectedRevision:string|null;metadata:CurriculumMetadata};
export type CurriculumBinding={resourceId:string;revision:string};
export type CurriculumPrepare={schemaVersion:typeof MATERIAL_CURRICULUM_SCHEMA;selected:CurriculumBinding;compare?:CurriculumBinding;question:string};
export const curriculumId=(v:unknown):v is string=>typeof v==='string'&&/^curriculum_[a-f0-9-]{36}$/i.test(v);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d);
const keys=(v:Record<string,unknown>,k:string[])=>Reflect.ownKeys(v).length===k.length&&Object.keys(v).every(n=>k.includes(n));
const text=(v:unknown,max:number,required=false):v is string=>typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0)&&!/[\x00-\x1f\x7f]/.test(v);
export function validCurriculumMetadata(v:unknown):v is CurriculumMetadata{
 return record(v)&&keys(v,['kind','subject','stage','grade','publisher','edition','region','unit','qualification','status'])&&['standard','textbook','reference'].includes(String(v.kind))&&['active','withdrawn'].includes(String(v.status))&&['teacher_provided','synthetic'].includes(String(v.qualification))&&['subject','stage','grade','publisher','edition','region','unit'].every(k=>text(v[k],160,['subject','stage','grade','publisher','edition'].includes(k)));
}
export function validCurriculumEntry(v:unknown):v is CurriculumEntry{return record(v)&&keys(v,['id','source','metadata','createdAt'])&&curriculumId(v.id)&&validMaterialSource(v.source)&&validCurriculumMetadata(v.metadata)&&text(v.createdAt,40,true);}
export function validCurriculumQuery(v:unknown):v is CurriculumQuery{return record(v)&&keys(v,['schemaVersion','resourceId'])&&v.schemaVersion===MATERIAL_CURRICULUM_SCHEMA&&materialId(v.resourceId);}
export function validCurriculumSave(v:unknown):v is CurriculumSave{return record(v)&&keys(v,['schemaVersion','source','expectedRevision','metadata'])&&v.schemaVersion===MATERIAL_CURRICULUM_SCHEMA&&validMaterialSource(v.source)&&(v.expectedRevision===null||curriculumId(v.expectedRevision))&&validCurriculumMetadata(v.metadata);}
const binding=(v:unknown):v is CurriculumBinding=>record(v)&&keys(v,['resourceId','revision'])&&materialId(v.resourceId)&&curriculumId(v.revision);
export function validCurriculumPrepare(v:unknown):v is CurriculumPrepare{return record(v)&&keys(v,['schemaVersion','selected','question',...(v.compare===undefined?[]:['compare'])])&&v.schemaVersion===MATERIAL_CURRICULUM_SCHEMA&&binding(v.selected)&&(v.compare===undefined||binding(v.compare)&&v.compare.resourceId!==v.selected.resourceId)&&text(v.question,2000,true);}
export const curriculumLabel=(m:CurriculumMetadata)=>`${{standard:'课标资料',textbook:'教材资料',reference:'参考案例'}[m.kind]} · ${m.subject} / ${m.stage} / ${m.grade} · ${m.publisher} ${m.edition}${m.region?' · '+m.region:''}${m.unit?' · '+m.unit:''}${m.status==='withdrawn'?' · 已撤回':''}${m.qualification==='synthetic'?' · 合成测试资料':''}`;
export const curriculumBoundary='这是教师登记的资料版本，仅作为待对照依据；尚未完成教学目标逐条映射，不能声称正式课标对齐。参考案例、合成资料和已撤回版本不能充当正式标准。只引用实际读取段落，不编造标准编号或页码；补充内容须另行说明。';
