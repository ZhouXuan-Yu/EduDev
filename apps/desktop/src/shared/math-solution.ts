import {plainStudentInput} from './student-context';
import {aggregateMathSteps,type MathStepState} from './math-check';
import {validMathEquationInput,validMathEquationResult,mathEquationParameters,type MathEquationInput,type MathEquationResult} from './math-equation';

export const MATH_SOLUTION_SCHEMA='xiaozhi.education.math-check.v5' as const;
export const MATH_SOLUTION_TOOL='education_verify_solution' as const;
export type MathSolutionRelation='equivalent'|'candidate_expansion'|'original_filter';
export type MathSolutionInput=Omit<MathEquationInput,'kind'>&{kind:'solution';steps:(Pick<MathEquationInput,'left'|'right'>&{relation:MathSolutionRelation})[]};
export type MathSolutionResult={state:MathStepState;conditionsVerified:false;domainRetained:true;engine:'sympy-1.14.0';original:MathEquationResult;answerState:MathStepState;firstMismatch:number|null;steps:{step:number;relation:MathSolutionRelation;state:MathStepState;solutionStatus:MathEquationResult['solutionStatus'];restrictions:string[];solutions:string[];removed:string[];added:string[]}[]};
const relations=['equivalent','candidate_expansion','original_filter'];
export function validMathSolutionInput(v:unknown):v is MathSolutionInput{
 if(!plainStudentInput(v,['kind','left','right','domain','roots','steps'])||v.kind!=='solution')return false;
 const {steps,...original}=v;
 return validMathEquationInput({...original,kind:'equation'})&&Array.isArray(steps)&&steps.length>=1&&steps.length<=5&&steps.every(s=>plainStudentInput(s,['left','right','relation'])&&relations.includes(String(s.relation))&&validMathEquationInput({kind:'equation',left:s.left,right:s.right,domain:v.domain,roots:[]}));
}
export function validMathSolutionResult(v:unknown):v is MathSolutionResult{
 if(!plainStudentInput(v,['state','conditionsVerified','domainRetained','engine','original','answerState','firstMismatch','steps'])||v.conditionsVerified!==false||v.domainRetained!==true||v.engine!=='sympy-1.14.0'||!validMathEquationResult(v.original)||!['matched','mismatch','unsupported'].includes(String(v.answerState))||!Array.isArray(v.steps)||v.steps.length>5)return false;
 const texts=(a:unknown,max:number):a is string[]=>Array.isArray(a)&&a.length<=max&&a.every(s=>typeof s==='string'&&s.length<=1024);
 if(!v.steps.every((s,i)=>plainStudentInput(s,['step','relation','state','solutionStatus','restrictions','solutions','removed','added'])&&s.step===i+1&&relations.includes(String(s.relation))&&['matched','mismatch','unsupported'].includes(String(s.state))&&['finite','non_finite','undetermined'].includes(String(s.solutionStatus))&&texts(s.restrictions,32)&&texts(s.solutions,4)&&texts(s.removed,4)&&texts(s.added,4)&&(s.state!=='matched'||s.solutionStatus==='finite'&&(s.relation==='equivalent'?s.removed.length===0&&s.added.length===0:s.relation==='candidate_expansion'?s.removed.length===0:s.added.length===0))))return false;
 if(v.original.state==='unsupported')return v.state==='unsupported'&&v.answerState==='unsupported'&&v.firstMismatch===null&&v.steps.length===0;
 const first=v.steps.find(s=>s.state==='mismatch');
 return v.steps.length>=1&&v.firstMismatch===(first?first.step:null)&&v.state===aggregateMathSteps([v.answerState,...v.steps.map(s=>s.state)])&&(v.original.state!=='mismatch'||v.answerState==='mismatch');
}
export const mathSolutionParameters={type:'object',additionalProperties:false,required:[...mathEquationParameters.required,'steps'],properties:{...mathEquationParameters.properties,kind:{type:'string',enum:['solution']},steps:{type:'array',minItems:1,maxItems:5,description:'按推导顺序提交每步完整方程，不是独立计算列表。原定义域自动继承。',items:{type:'object',additionalProperties:false,required:['left','right','relation'],properties:{left:{type:'object'},right:{type:'object'},relation:{type:'string',enum:relations,description:'equivalent等价；candidate_expansion显式可能增根的候选扩展；original_filter按原式代回筛除非原解。'}}}}}} as const;

/** A bounded host summary of a validated proof, never model-authored prose. */
export function mathSolutionSummary(result:MathSolutionResult):string{
 const values=(items:string[])=>items.length?items.map(s=>s.length>80?s.slice(0,80)+'…':s).join('、'):'空集';
 const lines=[result.state==='matched'?'形式化推导链及最终原解集一致。':result.firstMismatch?`第${result.firstMismatch}步首次不符合声明的变形关系。`:result.state==='mismatch'?'最终方程或提交答案与原解集不一致。':'部分推导尚未核验。',
  `原解集：${result.original.solutionStatus==='finite'?values(result.original.solutions):'未确定'}；最终答案${result.answerState==='matched'?'一致':result.answerState==='mismatch'?'不一致':'未核验'}。`,
  `原式限制：${result.original.restrictions.length?values(result.original.restrictions):'无附加限制'}；原定义域保持。`];
 for(const step of result.steps){
  const relation=step.relation==='equivalent'?'等价变形':step.relation==='candidate_expansion'?'候选扩展':'原式代回筛选';
  lines.push(`第${step.step}步（${relation}）${step.state==='matched'?'成立':step.state==='mismatch'?'不成立':'未核验'}${step.removed.length?'；减少候选：'+values(step.removed):''}${step.added.length?'；新增候选：'+values(step.added):''}。`);
 }
 const scope='仅证明提交的形式化方程链；题意翻译与整题解释仍待核对。',body=lines.join(' ');
 return (body.length>1400?body.slice(0,1400)+'…摘要已截短，完整证明保留在工具记录。':body)+' '+scope;
}
