import type {StudentContextRepository} from '../students/context-repository';
import type {StudentTrainingView} from '../../shared/student-training';
import {savedPracticeResult} from '../../shared/practice-result';

/** Existing learning_records are the sole source, across all pages and known confirmed plan versions. */
export function collectTrainingResults(facts:Awaited<ReturnType<StudentContextRepository['learningSnapshot']>>,knownPlans:ReadonlyMap<string,number>):StudentTrainingView['results']{
 return facts.records.flatMap(entry=>{
  try{
   const meta=JSON.parse(entry.record.content);
   if(meta.schemaVersion!=='xiaozhi.education.training-result.v1'||!knownPlans.has(meta.planId)||knownPlans.get(meta.planId)!==meta.planVersion||!Number.isInteger(meta.day)||meta.day<1||meta.day>14||!['correct','incorrect','partial'].includes(meta.result))return[];
   const practice=savedPracticeResult(meta.practice);
   return[{recordId:entry.record.id,...(typeof entry.version==='string'&&/^[a-f0-9]{64}$/.test(entry.version)?{tutorReference:entry.version.slice(0,16)}:{}),planVersion:meta.planVersion,day:meta.day,result:meta.result,occurredAt:entry.record.occurredAt,notes:String(meta.notes||''),...(practice?{practice}:{})}];
  }catch{return[];}
 });
}

/** A bounded source-version coordinate, never an authorization token or a second record store. */
export function focusTrainingResult(results:StudentTrainingView['results'],reference:string){
 const matches=results.filter(result=>result.tutorReference===reference);
 if(matches.length!==1)throw new Error('source_changed');
 return matches[0];
}
