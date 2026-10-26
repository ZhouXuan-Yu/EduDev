import type {PracticeReviewRepository} from '../../education/practice-review-repository';
import {PRACTICE_REVIEW_TOOLS} from '../../../shared/practice-review';
import type {BoundEffect} from './effect-readback';

/** Bound to one actual saved practice tool call, never to a model title alone. */
export function createPracticeReadback(options:{sessionId:string;runId:string;current:()=>boolean;practice:PracticeReviewRepository}){
 return async(callId:string,tool:string,payload:Record<string,unknown>):Promise<BoundEffect>=>{
  const snapshot=async()=>{
   if(tool!==PRACTICE_REVIEW_TOOLS[0]||!options.current())throw Error('cancelled');
   const proof=await options.practice.verificationSnapshot(options.sessionId,options.runId,callId);
   if(!options.current())throw Error('cancelled');
   if(payload.success!==true||payload.state!=='confirmed'||payload.count!==proof.count||payload.title!==proof.title)throw Error('evidence_missing');
   return{digest:proof.digest,version:proof.version};
  };
  return Object.freeze({...await snapshot(),read:snapshot});
 };
}
