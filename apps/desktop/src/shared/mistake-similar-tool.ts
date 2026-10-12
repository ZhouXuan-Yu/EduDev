import {plainStudentInput} from './student-context';
export const MISTAKE_SIMILAR_TOOL='education_find_similar_questions' as const;
export type MistakeSimilarToolInput={reference:string;version:string};
export function validMistakeSimilarToolInput(value:unknown):value is MistakeSimilarToolInput{
 return plainStudentInput(value,['reference','version'])&&typeof value.reference==='string'&&/^学习证据[1-9][0-9]{0,6}$/.test(value.reference)
  &&typeof value.version==='string'&&/^[a-f0-9]{64}$/.test(value.version);
}
