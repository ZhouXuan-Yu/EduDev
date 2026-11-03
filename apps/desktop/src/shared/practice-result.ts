import {plainStudentInput} from './student-context';
export const PRACTICE_RESULT_SCHEMA='xiaozhi.education.practice-result.v1' as const;
export const PRACTICE_RESULT_V2_SCHEMA='xiaozhi.education.practice-result.v2' as const;
export const PRACTICE_OUTCOMES={correct:'正确',incorrect:'错误',partial:'部分正确',unanswered:'未作答，待补测'} as const;
export type PracticeOutcome=keyof typeof PRACTICE_OUTCOMES;
export type PracticeResultInput={schemaVersion:typeof PRACTICE_RESULT_SCHEMA|typeof PRACTICE_RESULT_V2_SCHEMA;exerciseId:string;version:string;answers:{index:number;answer:string;result:PracticeOutcome;feedback:string}[];score?:{earned:number;max:number}};
export type SavedPracticeResult=PracticeResultInput&{title:string};
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
export function validPracticeResult(v:unknown):v is PracticeResultInput{
 if(!plainStudentInput(v,['schemaVersion','exerciseId','version','answers','score'])||(v.schemaVersion!==PRACTICE_RESULT_SCHEMA&&v.schemaVersion!==PRACTICE_RESULT_V2_SCHEMA)||typeof v.exerciseId!=='string'||!/^exercise_set_[a-f0-9-]{36}$/i.test(v.exerciseId)||typeof v.version!=='string'||!/^[a-f0-9]{64}$/.test(v.version)||!Array.isArray(v.answers)||v.answers.length<1||v.answers.length>8)return false;
 const entries=Object.getOwnPropertyDescriptors(v.answers);
 if(Reflect.ownKeys(entries).length!==v.answers.length+1||Array.from({length:v.answers.length},(_,i)=>entries[i]).some(d=>!d||!('value' in d)))return false;
 if(!v.answers.every(a=>plainStudentInput(a,['index','answer','result','feedback'])&&Number.isSafeInteger(a.index)&&Number(a.index)>=0&&Number(a.index)<8&&text(a.answer,4000)&&text(a.feedback,1000)&&typeof a.result==='string'&&(v.schemaVersion===PRACTICE_RESULT_SCHEMA?['correct','incorrect','partial'].includes(a.result):Object.hasOwn(PRACTICE_OUTCOMES,a.result)&&(a.result==='unanswered'?!String(a.answer).trim():Boolean(String(a.answer).trim()))))||new Set(v.answers.map(a=>a.index)).size!==v.answers.length)return false;
 if(v.score!==undefined&&(!plainStudentInput(v.score,['earned','max'])||typeof v.score.earned!=='number'||typeof v.score.max!=='number'||!Number.isFinite(v.score.earned)||!Number.isFinite(v.score.max)||v.score.earned<0||v.score.max<=0||v.score.max>1000000||v.score.earned>v.score.max))return false;
 return true;
}
export function practiceOutcome(answers:PracticeResultInput['answers']):PracticeOutcome{const answered=answers.filter(a=>a.result!=='unanswered');return answers.length&&!answered.length?'unanswered':answered.length&&answered.every(a=>a.result==='correct')?'correct':answered.length&&answered.every(a=>a.result==='incorrect')?'incorrect':'partial';}
/** Actual per-question coverage, never an inferred score or whole-paper mastery. */
export function practiceCoverage(answers:PracticeResultInput['answers']){const unanswered=answers.filter(a=>a.result==='unanswered').length;return{total:answers.length,answered:answers.length-unanswered,unanswered,correct:answers.filter(a=>a.result==='correct').length,incorrect:answers.filter(a=>a.result==='incorrect').length,partial:answers.filter(a=>a.result==='partial').length};}
export function savedPracticeResult(value:unknown):SavedPracticeResult|undefined{
 if(!plainStudentInput(value,['schemaVersion','exerciseId','version','answers','score','title'])||!text(value.title,160))return;
 const {title,...input}=value;if(!validPracticeResult(input))return;return{...input,title:title as string};
}
