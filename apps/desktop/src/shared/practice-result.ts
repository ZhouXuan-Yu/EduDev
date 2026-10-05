import {plainStudentInput} from './student-context';
export const PRACTICE_RESULT_SCHEMA='xiaozhi.education.practice-result.v1' as const;
export type PracticeOutcome='correct'|'incorrect'|'partial';
export type PracticeResultInput={schemaVersion:typeof PRACTICE_RESULT_SCHEMA;exerciseId:string;version:string;answers:{index:number;answer:string;result:PracticeOutcome;feedback:string}[];score?:{earned:number;max:number}};
export type SavedPracticeResult=PracticeResultInput&{title:string};
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
export function validPracticeResult(v:unknown):v is PracticeResultInput{
 if(!plainStudentInput(v,['schemaVersion','exerciseId','version','answers','score'])||v.schemaVersion!==PRACTICE_RESULT_SCHEMA||typeof v.exerciseId!=='string'||!/^exercise_set_[a-f0-9-]{36}$/i.test(v.exerciseId)||typeof v.version!=='string'||!/^[a-f0-9]{64}$/.test(v.version)||!Array.isArray(v.answers)||v.answers.length<1||v.answers.length>8)return false;
 const entries=Object.getOwnPropertyDescriptors(v.answers);
 if(Reflect.ownKeys(entries).length!==v.answers.length+1||Array.from({length:v.answers.length},(_,i)=>entries[i]).some(d=>!d||!('value' in d)))return false;
 if(!v.answers.every(a=>plainStudentInput(a,['index','answer','result','feedback'])&&Number.isSafeInteger(a.index)&&Number(a.index)>=0&&Number(a.index)<8&&text(a.answer,4000)&&text(a.feedback,1000)&&typeof a.result==='string'&&['correct','incorrect','partial'].includes(a.result))||new Set(v.answers.map(a=>a.index)).size!==v.answers.length)return false;
 if(v.score!==undefined&&(!plainStudentInput(v.score,['earned','max'])||typeof v.score.earned!=='number'||typeof v.score.max!=='number'||!Number.isFinite(v.score.earned)||!Number.isFinite(v.score.max)||v.score.earned<0||v.score.max<=0||v.score.max>1000000||v.score.earned>v.score.max))return false;
 return true;
}
export function practiceOutcome(answers:PracticeResultInput['answers']):PracticeOutcome{return answers.length&&answers.every(a=>a.result==='correct')?'correct':answers.length&&answers.every(a=>a.result==='incorrect')?'incorrect':'partial';}
export function savedPracticeResult(value:unknown):SavedPracticeResult|undefined{
 if(!plainStudentInput(value,['schemaVersion','exerciseId','version','answers','score','title'])||!text(value.title,160))return;
 const {title,...input}=value;if(!validPracticeResult(input))return;return{...input,title:title as string};
}
