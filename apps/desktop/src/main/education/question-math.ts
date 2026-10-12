import {createHash} from 'node:crypto';
import {validMathCheckInput,type MathCheckInput,type MathExpression} from '../../shared/math-check';
import type {QuestionReviewDraft} from '../../shared/question-review';
import type {QuestionMathReceipt} from '../../shared/question-quality';
import {checkMath} from './math-host';
export type QuestionMathPlan={basisHash:string;input:MathCheckInput}|null;
export const questionMathBasis=(q:QuestionReviewDraft['items'][number],input?:MathCheckInput)=>createHash('sha256').update(JSON.stringify({questionType:q.questionType,stem:q.stem,options:q.options,answer:q.answer,...((input?.kind==='identity'||input?.kind==='steps')?{analysis:q.analysis}:{})})).digest('hex');
export function createQuestionMathPlans(draft:QuestionReviewDraft,inputs?:unknown):QuestionMathPlan[]{
 if(inputs===undefined)return draft.items.map(()=>null);
 if(!Array.isArray(inputs)||inputs.length!==draft.items.length||inputs.some(v=>v!==null&&!validMathCheckInput(v)))throw new Error('invalid_input');
 return inputs.map((input,i)=>input===null?null:{basisHash:questionMathBasis(draft.items[i],input),input});
}
export function validQuestionMathPlans(value:unknown,draft:QuestionReviewDraft):value is QuestionMathPlan[]{
 return Array.isArray(value)&&value.length===draft.items.length&&value.every((v,i)=>v===null||v&&typeof v==='object'&&Object.keys(v).length===2&&validMathCheckInput(v.input)&&v.basisHash===questionMathBasis(draft.items[i],v.input));
}
function expression(v:MathExpression):string{
 if(v.op==='number')return v.denominator==='1'?v.numerator:`(${v.numerator}/${v.denominator})`;
 if(v.op==='variable')return 'x';
 if(v.op==='sqrt')return `√(${expression(v.args[0])})`;
 return `(${expression(v.args[0])} ${ {add:'+',subtract:'−',multiply:'×',divide:'÷',power:'^'}[v.op]} ${expression(v.args[1])})`;
}
export function questionMathCalculation(v:MathCheckInput):string{if(v.kind==='steps')return v.checks.map((c,i)=>`步骤${i+1}：${questionMathCalculation(c)}`).join('\n');return v.kind!=='polynomial'?`${v.kind==='identity'?'恒等式：':''}${expression(v.left)} = ${expression(v.right)}`:`${expression(v.left)} = ${expression(v.right)}；${{real:'实数',positive:'正数',nonnegative:'非负数'}[v.domain]}解集 {${v.roots.map(expression).join(', ')}}`;}
/** The immutable plan belongs to its original stem/options/answer, never to later teacher edits. */
export async function assessQuestionMath(draft:QuestionReviewDraft,plans:QuestionMathPlan[],signal:AbortSignal):Promise<QuestionMathReceipt[]>{
 const receipts:QuestionMathReceipt[]=[];
 for(let i=0;i<plans.length;i++){
  signal.throwIfAborted();const plan=plans[i];
  if(!plan){receipts.push({state:'not_run',conditionsVerified:false});continue;}
  const calculation=questionMathCalculation(plan.input);
  if(plan.basisHash!==questionMathBasis(draft.items[i],plan.input)){receipts.push({state:'basis_changed',conditionsVerified:false,calculation});continue;}
  const result=await checkMath(plan.input,signal);receipts.push({state:result.state,conditionsVerified:false,engine:result.engine,calculation,...(result.stepStates?{stepStates:result.stepStates}:{})});
 }
 return receipts;
}

/** A repair cannot evade submitted batch checks by shrinking or changing their roles. */
export function retainsQuestionMathPlan(parent:QuestionMathPlan,child:QuestionMathPlan):boolean{
 if(!parent)return true;if(!child)return false;
 const sameRole=(a:import('../../shared/math-check').MathAtomicCheck,b:import('../../shared/math-check').MathAtomicCheck)=>a.kind===b.kind&&(a.kind!=='polynomial'||b.kind==='polynomial'&&a.domain===b.domain);
 if(parent.input.kind!=='steps')return sameRole(parent.input,child.input.kind==='steps'?child.input.checks[0]:child.input);
 return child.input.kind==='steps'&&parent.input.checks.every((c,i)=>child.input.kind==='steps'&&!!child.input.checks[i]&&sameRole(c,child.input.checks[i]));
}
