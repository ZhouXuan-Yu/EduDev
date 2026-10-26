import type {QuestionReviewRepository} from '../../education/question-review-repository';
import {QUESTION_REVIEW_TOOL} from '../../../shared/question-review';
import type {BoundEffect} from './effect-readback';

/** Bound to one native call and active owner, not a model-supplied question ID. */
export function createEducationReadback(options:{sessionId:string;runId:string;current:()=>boolean;questions:QuestionReviewRepository}){
 return async(callId:string,tool:string,payload:Record<string,unknown>):Promise<BoundEffect>=>{
  const snapshot=async()=>{
   if(tool!==QUESTION_REVIEW_TOOL||!options.current())throw Error('cancelled');
   const proof=await options.questions.verificationSnapshot(options.sessionId,options.runId,callId);
   if(!options.current())throw Error('cancelled');
   if(payload.success!==true||payload.state!=='confirmed'||payload.count!==proof.count||payload.generationKind!==proof.generationKind)throw Error('evidence_missing');
   return {digest:proof.digest,version:proof.version};
  };
  return Object.freeze({...await snapshot(),read:snapshot});
 };
}
