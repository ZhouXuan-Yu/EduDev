import type {QuestionWebAnswerRepository} from './question-web-answer-repository';
import type {BoundEffect} from '../xiaozhi-agent/verification/effect-readback';
/** Saved facts only. Native receipt/call and current owner are independently fenced. */
export function createQuestionWebAnswerReadback(options:{sessionId:string;runId:string;current:()=>boolean;repo:QuestionWebAnswerRepository}){
 return async(callId:string,tool:string,payload:Record<string,unknown>):Promise<BoundEffect>=>{
  const read=async()=>{
   if(!options.current())throw Error('cancelled');
   if(tool!=='education_web_answer'||payload.success!==true||payload.state!=='applied'||payload.currentVersionMatches!==true||typeof payload.id!=='string'||typeof payload.afterVersion!=='string'||payload.currentVersion!==payload.afterVersion)throw Error('evidence_missing');
   const proof=await options.repo.verificationSnapshot({sessionId:options.sessionId,runId:options.runId},callId,payload.id,payload.afterVersion);if(!options.current())throw Error('cancelled');return proof;
  };
  return Object.freeze({...await read(),read});
 };
}
