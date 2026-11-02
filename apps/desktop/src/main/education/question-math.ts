import {createHash} from 'node:crypto';
import {validMathCheckInput,type MathCheckInput,type MathExpression} from '../../shared/math-check';
import type {QuestionReviewDraft} from '../../shared/question-review';
import type {QuestionMathReceipt} from '../../shared/question-quality';
import {checkMath,checkEquation,checkQuantity,checkSolution} from './math-host';
import {mathSystemBoundToQuestion,MATH_SYSTEM_MESSAGES,type MathRational} from '../../shared/math-system';
import {validQuestionScienceCheck,questionScienceBoundToQuestion,type QuestionScienceCheck} from '../../shared/question-science';
import {validQuestionSolutionCheck,questionSolutionBoundToQuestion,type QuestionSolutionCheck} from '../../shared/question-solution';
import type {QuantityExpression} from '../../shared/math-quantity';
type ReviewMathInput=MathCheckInput|QuestionScienceCheck|QuestionSolutionCheck;
export type QuestionMathPlan={basisHash:string;input:ReviewMathInput}|null;
const science=(v:ReviewMathInput):v is QuestionScienceCheck|QuestionSolutionCheck=>v.kind==='solution'||v.kind==='equation'||v.kind==='quantity';
const validInput=(v:unknown,allowScience:boolean,allowSolution=false):v is ReviewMathInput=>validMathCheckInput(v)||allowScience&&validQuestionScienceCheck(v)||allowSolution&&validQuestionSolutionCheck(v);
const bound=(v:ReviewMathInput,q:QuestionReviewDraft['items'][number])=>v.kind==='solution'?questionSolutionBoundToQuestion(v,q):science(v)?questionScienceBoundToQuestion(v,q):v.kind!=='linear_system'||mathSystemBoundToQuestion(v,q);
export const questionMathBasis=(q:QuestionReviewDraft['items'][number],input?:ReviewMathInput)=>createHash('sha256').update(JSON.stringify({questionType:q.questionType,stem:q.stem,options:q.options,answer:q.answer,...((input?.kind==='identity'||input?.kind==='steps'||input&&science(input))?{analysis:q.analysis}:{})})).digest('hex');
export function createQuestionMathPlans(draft:QuestionReviewDraft,inputs?:unknown):QuestionMathPlan[]{
 if(inputs===undefined)return draft.items.map(()=>null);
 if(!Array.isArray(inputs)||inputs.length!==draft.items.length||inputs.some(v=>v!==null&&!validInput(v,true,true)))throw new Error('invalid_input');
 return inputs.map((input,i)=>{
  if(input!==null&&!bound(input,draft.items[i]))throw new Error('invalid_input');
  return input===null?null:{basisHash:questionMathBasis(draft.items[i],input),input};
 });
}
export function validQuestionMathPlans(value:unknown,draft:QuestionReviewDraft,allowScience=false,allowSolution=false):value is QuestionMathPlan[]{
 return Array.isArray(value)&&value.length===draft.items.length&&value.every((v,i)=>v===null||v&&typeof v==='object'&&Object.keys(v).length===2&&validInput(v.input,allowScience,allowSolution)&&bound(v.input,draft.items[i])&&v.basisHash===questionMathBasis(draft.items[i],v.input));
}
function expression(v:MathExpression):string{
 if(v.op==='number')return v.denominator==='1'?v.numerator:`(${v.numerator}/${v.denominator})`;
 if(v.op==='variable')return 'x';
 if(v.op==='sqrt')return `√(${expression(v.args[0])})`;
 return `(${expression(v.args[0])} ${ {add:'+',subtract:'−',multiply:'×',divide:'÷',power:'^'}[v.op]} ${expression(v.args[1])})`;
}
const rationalText=(v:MathRational)=>v.denominator==='1'?v.numerator:`(${v.numerator}/${v.denominator})`;
const quantityExpression=(v:QuantityExpression):string=>v.op==='quantity'?`${rationalText(v.value)} ${v.unit}`:v.op==='sqrt'?`√(${quantityExpression(v.args[0])})`:v.op==='power'?`(${quantityExpression(v.args[0])})^${v.exponent}`:`(${quantityExpression(v.args[0])} ${{add:'+',subtract:'−',multiply:'×',divide:'÷'}[v.op]} ${quantityExpression(v.args[1])})`;
export function questionMathCalculation(v:ReviewMathInput):string{
 if(v.kind==='solution')return `题干依据「${v.sourceText}」\n答案依据「${v.answerText}」\n原方程：${expression(v.left)} = ${expression(v.right)}；${{real:'实数',positive:'正数',nonnegative:'非负数'}[v.domain]}解集 {${v.roots.map(expression).join(', ')}}\n`+v.steps.map((s,i)=>`第${i+1}步解析依据「${v.stepTexts[i]}」\n${expression(s.left)} = ${expression(s.right)}（${{equivalent:'等价变形',candidate_expansion:'候选扩展',original_filter:'原式代回筛选'}[s.relation]}）`).join('\n');
 if(science(v))return `题干依据「${v.sourceText}」\n答案依据「${v.answerText}」\n`+(v.kind==='equation'?`原方程：${expression(v.left)} = ${expression(v.right)}；${{real:'实数',positive:'正数',nonnegative:'非负数'}[v.domain]}解集 {${v.roots.map(expression).join(', ')}}`:`物理量：${quantityExpression(v.expression)}；目标 ${rationalText(v.expected!)} ${v.targetUnit}`);
 if(v.kind==='linear_system')return [
  '线性条件模型（不验证题意翻译、单位或图义）：',
  ...v.equations.map((e,i)=>`条件${i+1}「${e.sourceText}」\n${e.coefficients.map((c,j)=>`${rationalText(c)}×${v.variables[j]}`).join(' + ')} = ${rationalText(e.constant)}`),
  ...v.targets.map(t=>`所求 ${t.variable} = ${rationalText(t.expected)}；答案片段「${t.answerText}」`),
 ].join('\n');
 if(v.kind==='steps')return v.checks.map((c,i)=>`步骤${i+1}：${questionMathCalculation(c)}`).join('\n');
 return v.kind!=='polynomial'?`${v.kind==='identity'?'恒等式：':''}${expression(v.left)} = ${expression(v.right)}`:`${expression(v.left)} = ${expression(v.right)}；${{real:'实数',positive:'正数',nonnegative:'非负数'}[v.domain]}解集 {${v.roots.map(expression).join(', ')}}`;
}
/** History checks both the immutable equations and the state-specific solver summary. */
export function questionMathCalculationMatches(input:ReviewMathInput,receipt:QuestionMathReceipt):boolean{
 const calculation=questionMathCalculation(input);
 if(science(input)){
  if(receipt.calculation!==calculation)return false;
  if(receipt.state==='basis_changed')return receipt.science===undefined;
  const s=receipt.science;if(!s||s.kind!==input.kind)return false;
  if(input.kind==='solution')return s.kind==='solution'&&(s.result.original.state==='unsupported'||s.result.steps.length===input.steps.length&&s.result.steps.every((step,i)=>step.relation===input.steps[i].relation)&&s.result.original.candidates.length===input.roots.length);
  return input.kind==='equation'?s.kind==='equation'&&(s.result.state==='unsupported'||s.result.candidates.length===input.roots.length):s.kind==='quantity'&&s.result.targetUnit===input.targetUnit&&s.result.state!=='calculated';
 }
 if(receipt.science!==undefined)return false;
 if(input.kind!=='linear_system'||receipt.state==='basis_changed'||receipt.state==='unsupported')return receipt.calculation===calculation;
 const statuses=receipt.state==='matched'?['unique_targets'] as const:receipt.state==='mismatch'?['inconsistent','underdetermined','answer_mismatch'] as const:[];
 return statuses.some(status=>receipt.calculation===`${MATH_SYSTEM_MESSAGES[status]}\n${calculation}`);
}
/** The immutable plan belongs to its original stem/options/answer, never to later teacher edits. */
export async function assessQuestionMath(draft:QuestionReviewDraft,plans:QuestionMathPlan[],signal:AbortSignal):Promise<QuestionMathReceipt[]>{
 const receipts:QuestionMathReceipt[]=[];
 for(let i=0;i<plans.length;i++){
  signal.throwIfAborted();const plan=plans[i];
  if(!plan){receipts.push({state:'not_run',conditionsVerified:false});continue;}
  const calculation=questionMathCalculation(plan.input);
  if(plan.basisHash!==questionMathBasis(draft.items[i],plan.input)){receipts.push({state:'basis_changed',conditionsVerified:false,calculation});continue;}
  if(science(plan.input)){
   const input=plan.input;
   const value=input.kind==='solution'?{kind:'solution' as const,result:await checkSolution((({sourceText:_source,answerText:_answer,stepTexts:_texts,...v})=>v)(input),signal)}:input.kind==='equation'?{kind:'equation' as const,result:await checkEquation((({sourceText:_source,answerText:_answer,...v})=>v)(input),signal)}:{kind:'quantity' as const,result:await checkQuantity((({sourceText:_source,answerText:_answer,...v})=>v)(input),signal)};
   const state=value.result.state==='dimension_mismatch'?'mismatch':value.result.state==='calculated'?'unsupported':value.result.state;
   receipts.push({state,conditionsVerified:false,engine:value.result.engine,calculation,science:value});
  }else{const result=await checkMath(plan.input,signal);receipts.push({state:result.state,conditionsVerified:false,engine:result.engine,calculation:result.systemStatus?`${MATH_SYSTEM_MESSAGES[result.systemStatus]}\n${calculation}`:calculation,...(result.stepStates?{stepStates:result.stepStates}:{})});}
 }
 return receipts;
}

/** A repair cannot evade submitted batch checks by shrinking or changing their roles. */
export function retainsQuestionMathPlan(parent:QuestionMathPlan,child:QuestionMathPlan):boolean{
 if(!parent)return true;if(!child)return false;
 if(parent.input.kind==='solution')return child.input.kind==='solution'&&child.input.domain===parent.input.domain&&child.input.steps.length>=parent.input.steps.length;
 if(science(parent.input))return parent.input.kind==='equation'?child.input.kind==='equation'&&parent.input.domain===child.input.domain:child.input.kind==='quantity'&&parent.input.targetUnit===child.input.targetUnit;
 if(science(child.input))return false;
 if(parent.input.kind==='linear_system')return child.input.kind==='linear_system'&&JSON.stringify(parent.input.variables)===JSON.stringify(child.input.variables)&&parent.input.equations.length<=child.input.equations.length&&parent.input.targets.every((t,i)=>child.input.kind==='linear_system'&&child.input.targets[i]?.variable===t.variable);
 if(child.input.kind==='linear_system')return false;
 const sameRole=(a:import('../../shared/math-check').MathAtomicCheck,b:import('../../shared/math-check').MathAtomicCheck)=>a.kind===b.kind&&(a.kind!=='polynomial'||b.kind==='polynomial'&&a.domain===b.domain);
 if(parent.input.kind!=='steps')return sameRole(parent.input,child.input.kind==='steps'?child.input.checks[0]:child.input);
 return child.input.kind==='steps'&&parent.input.checks.every((c,i)=>child.input.kind==='steps'&&!!child.input.checks[i]&&sameRole(c,child.input.checks[i]));
}
