import {QUESTION_DRAFT_SCHEMA,validQuestionDraftInput,validQuestionDraftResult,type QuestionDraftInput,type QuestionDraftResult} from '../../shared/question-draft';
import {runEducationWorker} from './worker-host';
/** Format validation only; never asserts factual correctness, authorisation or teacher confirmation. */
export async function normalizeQuestionDraft(input:QuestionDraftInput,signal:AbortSignal):Promise<QuestionDraftResult>{
 if(!validQuestionDraftInput(input))throw new Error('invalid_input');
 return runEducationWorker('question',{operation:'normalize',...input},QUESTION_DRAFT_SCHEMA,signal,256*1024,256*1024,(v):v is QuestionDraftResult=>validQuestionDraftResult(v,input.questionType),v=>({question:v.question,issues:v.issues,valid:v.valid}));
}
