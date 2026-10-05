import {createHash} from 'node:crypto';
import type {StudentContextRepository} from '../students/context-repository';
import {LEARNING_MAX_POINTS,LEARNING_TYPES,type LearningPointInput,type LearningType,type LearningOutcome} from '../../shared/student-learning';
import {buildMasteryPolicy} from '../ai-harness/mastery-policy';
import type {MasterySnapshot} from '../ai-harness/mastery-snapshot';
type Snapshot=Awaited<ReturnType<StudentContextRepository['learningSnapshot']>>;
type Point=LearningPointInput&{name:string;subject:string;records:Snapshot['records']};
/** Only explicit saved fields become evidence. A mistake label, score or title is not an outcome. */
export function collectLearningEvidence(snapshot:Snapshot,now:number,assessments:{recordId?:string;sourceVersion?:string;version:number;draft:import('../../shared/learning-review').LearningReviewDraft}[]=[]){
 const points=new Map<string,Point>();
 const coverage={records:snapshot.total,totalStudentRecords:snapshot.totalRecords,explicit:0,unknown:0,invalid:0,voided:0,qualitativeWithoutConfirmation:0,scope:snapshot.subject?'subject':'selected_student',complete:true};
 const legacy:MasterySnapshot={bookId:'local-derived-comparison',modules:[],attempts:[],evidence:{recordCount:snapshot.total,attemptCount:0,unknownEvidence:0}};
 for(const entry of snapshot.records){
  const r=entry.record;let meta:Record<string,unknown>;
  try{meta=JSON.parse(r.content);}catch{coverage.unknown++;continue;}
  if(!meta||typeof meta!=='object'||Array.isArray(meta)){coverage.unknown++;continue;}
  if(meta.voided===true){coverage.voided++;continue;}
  if(meta.voided!==undefined&&typeof meta.voided!=='boolean'){coverage.invalid++;continue;}
  const name=meta.knowledgePoint,type=meta.knowledgeType,subject=r.subject;
  if(typeof name!=='string'||!name.trim()){coverage.unknown++;continue;}
  if(name.length>160||typeof type!=='string'||!LEARNING_TYPES.includes(type as LearningType)||typeof subject!=='string'||!subject.trim()||subject.length>128){coverage.invalid++;continue;}
  const annotation=assessments.filter(e=>e.recordId===r.id&&e.sourceVersion===entry.version&&e.draft.kind==='assessment').sort((a,b)=>a.version-b.version).at(-1);
  const originalResult=meta.result!==undefined?meta.result:typeof meta.isCorrect==='boolean'?(meta.isCorrect?'correct':'incorrect'):undefined;
  const result=annotation?.draft.kind==='assessment'?annotation.draft.correction.result:originalResult;
  if(result===undefined){coverage.unknown++;continue;}
  if(typeof result!=='string'||!['correct','incorrect','partial'].includes(result)||meta.isCorrect!==undefined&&(typeof meta.isCorrect!=='boolean'||meta.result!==undefined&&(meta.isCorrect!==(originalResult==='correct')))){coverage.invalid++;continue;}
  // Exact ISO dates and dated local records are accepted; locale-dependent free text is not.
  if(typeof r.occurredAt!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(r.occurredAt)){coverage.invalid++;continue;}
  const timestamp=Date.parse(r.occurredAt)/1000;
  const [year,month,day]=r.occurredAt.slice(0,10).split('-').map(Number),calendar=new Date(Date.UTC(year,month-1,day));
  if(!Number.isFinite(timestamp)||timestamp<0||timestamp>now||calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day){coverage.invalid++;continue;}
  const qualitative=Boolean(annotation)&&['concept','design'].includes(type)||meta.type==='mastery_assessment'||r.tags.includes('mastery_assess');
  // Historical booleans alone do not establish teacher confirmation provenance.
  const teacherConfirmed=Boolean(annotation);
  if(qualitative&&!teacherConfirmed)coverage.qualitativeWithoutConfirmation++;
  const id='kp_'+createHash('sha256').update(JSON.stringify([subject.trim(),name.trim(),type])).digest('hex');
  if(!points.has(id)){if(points.size>=LEARNING_MAX_POINTS)throw new Error('too_large');points.set(id,{id,name:name.trim(),subject:subject.trim(),type:type as LearningType,outcomes:[],records:[]});}
  const point=points.get(id)!;point.outcomes.push({result:result as LearningOutcome['result'],timestamp,qualitative,teacherConfirmed});point.records.push(entry);coverage.explicit++;
 }
 const ordered=[...points.values()].sort((a,b)=>a.id.localeCompare(b.id));
 for(const point of ordered){
  const events=point.outcomes.map((outcome,index)=>({outcome,entry:point.records[index]})).sort((a,b)=>a.outcome.timestamp-b.outcome.timestamp||a.entry.record.id.localeCompare(b.entry.record.id));
  point.outcomes=events.map(e=>e.outcome);point.records=events.map(e=>e.entry);
  const moduleId='subject_'+createHash('sha256').update(point.subject).digest('hex');let module=legacy.modules.find(m=>m.id===moduleId);
  if(!module){module={id:moduleId,name:point.subject,order:legacy.modules.length,knowledge_points:[]};legacy.modules.push(module);}
  module.knowledge_points.push({id:point.id,name:point.name,type:point.type,module_id:moduleId});
  legacy.attempts.push(...events.map(({outcome,entry})=>({questionId:entry.record.id,knowledgePointId:point.id,moduleId,isCorrect:outcome.result==='correct',evidenceKind:outcome.qualitative?'assess' as const:'quiz' as const,timestamp:outcome.timestamp})));
 }
 legacy.evidence={recordCount:coverage.records,attemptCount:coverage.explicit,unknownEvidence:coverage.unknown+coverage.invalid+coverage.voided};
 return{points:ordered,coverage,legacy:buildMasteryPolicy(legacy,now)};
}
