import type {QuestionReviewDraft} from '../../shared/question-review';
import {parseVariationEquation,type VariationEquationEvidence} from '../../shared/variation-equation';
import {checkEquation} from './math-host';

export async function assessVariationEquations(draft:QuestionReviewDraft,signal:AbortSignal,run=true):Promise<VariationEquationEvidence[]>{
 const evidence:VariationEquationEvidence[]=[];
 for(const q of draft.items){
  signal.throwIfAborted();const parsed=parseVariationEquation(q);
  if(parsed.state!=='ready'){evidence.push(parsed);continue;}
  const {input,...quotes}=parsed;
  if(!run){evidence.push({...quotes,state:'not_run'});continue;}
  const result=await checkEquation(input,signal);signal.throwIfAborted();
  evidence.push({state:result.state,sourceText:parsed.sourceText,answerText:parsed.answerText,result});
 }
 return evidence;
}
