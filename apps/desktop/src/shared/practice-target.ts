import type {QuestionBankItem,ExerciseSet} from './contracts';
import {validLearningDiagnosis,type LearningDiagnosis} from './learning-diagnosis';
import {validVariationEquationEvidence,variationEquationMatches,type VariationEquationEvidence} from './variation-equation';
import {plainStudentInput} from './student-context';
import {trainingArray} from './training-plan';

export const PRACTICE_TARGET_SCHEMA='xiaozhi.education.practice-target.v1' as const;
export type PracticeTarget={schemaVersion:typeof PRACTICE_TARGET_SCHEMA;basic:number;advanced:number};
export type PracticeTargetSource={recordId:string;version:string;reviewVersion?:number};
export type PracticeTargetBasis=Omit<PracticeTargetSource,'reviewVersion'>&{subject:string;knowledgePoint:string;assessmentVersion:number|null;diagnosis?:LearningDiagnosis};
export type PracticeTargetReview={basis:PracticeTargetBasis;answers:VariationEquationEvidence[]};
export function validPracticeTarget(v:unknown):v is PracticeTarget{
 return plainStudentInput(v,['schemaVersion','basic','advanced'])&&v.schemaVersion===PRACTICE_TARGET_SCHEMA&&Number.isSafeInteger(v.basic)&&Number.isSafeInteger(v.advanced)&&Number(v.basic)>=0&&Number(v.advanced)>=0&&Number(v.basic)+Number(v.advanced)>=1&&Number(v.basic)+Number(v.advanced)<=8;
}
export function validPracticeTargetReview(v:unknown,questions:QuestionBankItem[]):v is PracticeTargetReview{
 if(!plainStudentInput(v,['basis','answers'])||!plainStudentInput(v.basis,['recordId','version','subject','knowledgePoint','assessmentVersion','diagnosis'])||!trainingArray(v.answers)||v.answers.length!==questions.length)return false;
 const b=v.basis;
 return typeof b.recordId==='string'&&b.recordId.length>0&&b.recordId.length<=128&&typeof b.version==='string'&&/^[a-f0-9]{64}$/.test(b.version)&&['subject','knowledgePoint'].every(k=>typeof b[k]==='string'&&(b[k] as string).trim().length>0&&(b[k] as string).length<=160)&&(b.assessmentVersion===null||Number.isSafeInteger(b.assessmentVersion)&&Number(b.assessmentVersion)>0)&&(b.diagnosis===undefined||b.assessmentVersion!==null&&validLearningDiagnosis(b.diagnosis))&&v.answers.every((a,i)=>validVariationEquationEvidence(a)&&a.state!=='mismatch'&&a.state!=='answer_unreadable'&&a.state!=='not_run'&&variationEquationMatches(questions[i],a));
}
export const practiceTargetCount=(v:PracticeTarget)=>v.basic+v.advanced;
const label=(s:string)=>s.normalize('NFKC').trim();
/** Exact saved labels and difficulty quotas, not a semantic similarity verdict. */
export function practiceTargetIssues(target:PracticeTarget,subject:string,knowledgePoint:string,questions:Pick<QuestionBankItem,'subject'|'knowledgePoint'|'difficulty'>[],basis?:PracticeTargetBasis):string[]{
 const issues:string[]=[];
 if(questions.length!==practiceTargetCount(target))issues.push(`需要 ${practiceTargetCount(target)} 题，当前 ${questions.length} 题。`);
 if(!subject.trim()||!knowledgePoint.trim()||questions.some(q=>label(q.subject)!==label(subject)||label(q.knowledgePoint)!==label(knowledgePoint))||basis&&(label(basis.subject)!==label(subject)||label(basis.knowledgePoint)!==label(knowledgePoint)))issues.push('学科和知识点须与本次学习证据一致。');
 if(questions.filter(q=>q.difficulty==='easy').length!==target.basic||questions.filter(q=>q.difficulty==='hard').length!==target.advanced)issues.push(`需要基础 ${target.basic} 题（简单）、提高 ${target.advanced} 题（困难）；按已保存难度核对。`);
 return issues;
}
/** Student projection deliberately has no answer, analysis, observation, source or identity field. */
export function studentPractice(exercise:Pick<ExerciseSet,'title'|'subject'|'knowledgePoint'|'items'>){
 return{title:exercise.title,subject:exercise.subject,knowledgePoint:exercise.knowledgePoint,items:exercise.items.map(q=>({stem:q.stem}))};
}
export function practiceDocuments(exercise:ExerciseSet){
 const student=studentPractice(exercise);
 return{student:{title:student.title,content:`# ${student.title}\n\n${student.items.map((q,i)=>`## 第${i+1}题\n\n${q.stem}\n\n作答：\n\n\n\n`).join('\n')}`},teacher:{title:exercise.title+' · 教师版',content:exercise.contentMd}};
}
