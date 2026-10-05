import {plainStudentInput} from '../../shared/student-context';
import {TRAINING_PLAN_SCHEMA,validTrainingPlan,trainingArray,type TrainingPlan} from '../../shared/training-plan';
import {collectLearningEvidence} from './learning-evidence';
import type {StudentContextRepository} from '../students/context-repository';
type Facts=Awaited<ReturnType<StudentContextRepository['learningSnapshot']>>;
/** Source directory is host-owned, never supplied by the model or trusted from a renderer. */
export function trainingTopics(facts:Facts){return collectLearningEvidence(facts,Date.now()/1000).points.map(({id,name,subject,type})=>({id,name,subject,type}));}
export function resolveTrainingPlan(raw:unknown,facts:Facts):TrainingPlan{
 if(!plainStudentInput(raw,['title','startDate','days'])||!trainingArray(raw.days)||raw.days.length!==14)throw new Error('invalid_input');
 const topics=trainingTopics(facts);if(!topics.length)throw new Error('no_evidence');if(topics.length>32)throw new Error('invalid_input');
 const days=raw.days.map(d=>{
  if(!plainStudentInput(d,['day','pointReference','activity','count','difficulty','notes']))throw new Error('invalid_input');
  const {pointReference,...rest}=d;
  if(pointReference!==null&&(typeof pointReference!=='string'||!/^知识点[1-9][0-9]*$/.test(pointReference)))throw new Error('invalid_input');
  const pointId=pointReference===null?null:topics[Number(String(pointReference).slice(3))-1]?.id;
  return {...rest,pointId};
 });
 const plan={schemaVersion:TRAINING_PLAN_SCHEMA,title:raw.title,startDate:raw.startDate,topics,days};
 if(!validTrainingPlan(plan))throw new Error('invalid_input');return plan;
}
export function trainingSourcesMatch(plan:TrainingPlan,facts:Facts){return JSON.stringify(plan.topics)===JSON.stringify(trainingTopics(facts));}
