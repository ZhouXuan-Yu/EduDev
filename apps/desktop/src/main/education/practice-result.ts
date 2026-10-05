import {practiceOutcome,validPracticeResult,type PracticeResultInput,type SavedPracticeResult,type PracticeOutcome} from '../../shared/practice-result';
import type {PracticeReviewView} from '../../shared/practice-review';

/** Existing confirmed practice ledger, checked on the result writer's transaction. */
export async function preparePracticeResult(studentId:string,input:PracticeResultInput,topic:{subject:string;name:string},result:PracticeOutcome,source?: (studentId:string,exerciseId:string)=>Promise<PracticeReviewView>):Promise<SavedPracticeResult>{
 if(!validPracticeResult(input)||practiceOutcome(input.answers)!==result)throw new Error('invalid_input');
 if(!source)throw new Error('unavailable');
 const view=await source(studentId,input.exerciseId),exercise=view.exercise;
 if(view.state!=='confirmed'||!exercise||exercise.studentId!==studentId)throw new Error('permission_denied');
 if(view.exerciseVersion!==input.version)throw new Error('source_changed');
 if(exercise.subject.trim()!==topic.subject.trim()||exercise.knowledgePoint.trim()!==topic.name.trim()||input.answers.length!==exercise.items.length||input.answers.some(a=>a.index>=exercise.items.length))throw new Error('invalid_input');
 return{...input,title:exercise.title};
}
