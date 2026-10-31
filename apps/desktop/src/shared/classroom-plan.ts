import type {Scene} from '@openmaic/dsl';
import type {ClassroomContext} from './classroom-context';

export const CLASSROOM_PLAN_SCHEMA='xiaozhi.classroom-plan.v1' as const;
export const CLASSROOM_PLAN_ACTION='pi_classroom_plan';
export const CLASSROOM_PLAN_TOOLS=['education_propose_classroom_outline','education_read_classroom_plan','education_prepare_planned_scene','education_save_classroom_scene','education_finish_classroom_plan'] as const;
export type ClassroomPlanScene={sceneId:string;type:'slide'|'quiz';title:string;activity:string;durationMinutes:number};
export type ClassroomPlanDocument={schemaVersion:typeof CLASSROOM_PLAN_SCHEMA;title:string;objectives:string[];totalMinutes:number;scenes:ClassroomPlanScene[]};
export type ClassroomPlanBinding={mode:'generate';id:string;version:string};
export type ClassroomPlanStart={mode:'outline'}|ClassroomPlanBinding;
export type ClassroomPlanSource={id:string;version:string};
export type ClassroomCheckpoint={sceneId:string;scene:Scene;inputDigest:string;runId:string};
export type ClassroomPlanItem={id:string;sessionId:string;runId:string;revision:number;version:string;updatedAt:string;document:ClassroomPlanDocument;context:ClassroomContext;status:'draft'|'confirmed'|'generating'|'interrupted'|'ready'|'rejected';checkpoints:ClassroomCheckpoint[];classroomId?:string};
export type ClassroomPlanEdit={id:string;version:string;document:ClassroomPlanDocument};
export type ClassroomPlanDecision={id:string;version:string;decision:'confirm'|'reject'};

function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)&&Reflect.ownKeys(value).every(k=>typeof k==='string')&&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>'value'in d);}
function keys(value:Record<string,unknown>,expected:string[]){return Object.keys(value).length===expected.length&&Object.keys(value).every(k=>expected.includes(k));}
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value);
export const validClassroomPlanId=(value:unknown):value is string=>typeof value==='string'&&/^classplan_[a-f0-9-]{36}$/i.test(value);
export function validClassroomPlanSource(value:unknown):value is ClassroomPlanSource{return record(value)&&keys(value,['id','version'])&&validClassroomPlanId(value.id)&&typeof value.version==='string'&&/^[a-f0-9]{64}$/.test(value.version);}
export function validClassroomPlanStart(value:unknown):value is ClassroomPlanStart{
 if(!record(value))return false;
 return value.mode==='outline'?keys(value,['mode']):value.mode==='generate'&&keys(value,['mode','id','version'])&&validClassroomPlanSource({id:value.id,version:value.version});
}
export function validClassroomPlanDocument(value:unknown):value is ClassroomPlanDocument{
 if(!record(value)||!keys(value,['schemaVersion','title','objectives','totalMinutes','scenes'])||value.schemaVersion!==CLASSROOM_PLAN_SCHEMA||!text(value.title,160)||!Array.isArray(value.objectives)||value.objectives.length<1||value.objectives.length>8||!value.objectives.every(v=>text(v,500))||!Number.isSafeInteger(value.totalMinutes)||Number(value.totalMinutes)<2||Number(value.totalMinutes)>240||!Array.isArray(value.scenes)||value.scenes.length<2||value.scenes.length>12)return false;
 if(!value.scenes.every(s=>record(s)&&keys(s,['sceneId','type','title','activity','durationMinutes'])&&typeof s.sceneId==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(s.sceneId)&&['slide','quiz'].includes(String(s.type))&&text(s.title,160)&&text(s.activity,3000)&&Number.isSafeInteger(s.durationMinutes)&&Number(s.durationMinutes)>0&&Number(s.durationMinutes)<=120))return false;
 const scenes=value.scenes as ClassroomPlanScene[];
 return new Set(scenes.map(s=>s.sceneId)).size===scenes.length&&scenes.some(s=>s.type==='slide')&&scenes.some(s=>s.type==='quiz')&&scenes.reduce((n,s)=>n+s.durationMinutes,0)===value.totalMinutes&&!/https?:|file:|javascript:|<\s*(?:script|iframe|object|embed)/i.test(JSON.stringify(value));
}
export function validClassroomPlanEdit(value:unknown):value is ClassroomPlanEdit{return record(value)&&keys(value,['id','version','document'])&&validClassroomPlanSource({id:value.id,version:value.version})&&validClassroomPlanDocument(value.document);}
export function validClassroomPlanDecision(value:unknown):value is ClassroomPlanDecision{return record(value)&&keys(value,['id','version','decision'])&&validClassroomPlanSource({id:value.id,version:value.version})&&['confirm','reject'].includes(String(value.decision));}
