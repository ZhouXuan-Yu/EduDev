import {plainStudentInput} from './student-context';
import {validMathCheckInput,type MathExpression} from './math-check';

export const MATH_EQUATION_SCHEMA='xiaozhi.education.math-check.v3' as const;
export const MATH_EQUATION_TOOL='education_verify_equation' as const;
export type MathEquationInput={kind:'equation';left:MathExpression;right:MathExpression;domain:'real'|'positive'|'nonnegative';roots:MathExpression[]};
export type MathEquationResult={state:'matched'|'mismatch'|'unsupported';conditionsVerified:false;engine:'sympy-1.14.0';solutionStatus:'finite'|'non_finite'|'undetermined';restrictions:string[];solutions:string[];candidates:{value:string;admissible:boolean;satisfies:boolean}[]};
/** Share the original AST limits, while keeping v1 polynomial semantics unchanged. */
export function validMathEquationInput(v:unknown):v is MathEquationInput{
 return plainStudentInput(v,['kind','left','right','domain','roots'])&&v.kind==='equation'&&validMathCheckInput({...v,kind:'polynomial'});
}
export function validMathEquationResult(v:unknown):v is MathEquationResult{
 if(!plainStudentInput(v,['state','conditionsVerified','engine','solutionStatus','restrictions','solutions','candidates'])||v.conditionsVerified!==false||v.engine!=='sympy-1.14.0'||!['matched','mismatch','unsupported'].includes(String(v.state))||!['finite','non_finite','undetermined'].includes(String(v.solutionStatus)))return false;
 const texts=(a:unknown,max:number)=>Array.isArray(a)&&a.length<=max&&a.every(s=>typeof s==='string'&&s.length<=1024);
 return (v.state==='unsupported')===(v.solutionStatus!=='finite')&&texts(v.restrictions,32)&&texts(v.solutions,4)&&Array.isArray(v.candidates)&&v.candidates.length<=4&&v.candidates.every(c=>plainStudentInput(c,['value','admissible','satisfies'])&&typeof c.value==='string'&&c.value.length<=1024&&typeof c.admissible==='boolean'&&typeof c.satisfies==='boolean'&&(!c.satisfies||c.admissible));
}
export const mathEquationParameters={type:'object',additionalProperties:false,required:['kind','left','right','domain','roots'],properties:{kind:{type:'string',enum:['equation']},left:{type:'object',description:'原方程左侧完整JSON AST，不能预先约分或平方'},right:{type:'object',description:'原方程右侧完整JSON AST'},domain:{type:'string',enum:['real','positive','nonnegative']},roots:{type:'array',maxItems:4,items:{type:'object'},description:'待核验的全部候选解；无解提交空数组，不填模型信心'}}} as const;
