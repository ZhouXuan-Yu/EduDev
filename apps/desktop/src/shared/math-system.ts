import {plainStudentInput} from './student-context';

export const MATH_SYSTEM_SCHEMA='xiaozhi.education.math-check.v2' as const;
export type MathRational={numerator:string;denominator:string};
export type MathLinearSystem={
 kind:'linear_system';variables:string[];
 equations:{coefficients:MathRational[];constant:MathRational;sourceText:string}[];
 targets:{variable:string;expected:MathRational;answerText:string}[];
};
export type MathSystemStatus='unique_targets'|'inconsistent'|'underdetermined'|'answer_mismatch';
const rational=(v:unknown):v is MathRational=>plainStudentInput(v,['numerator','denominator'])&&typeof v.numerator==='string'&&/^(?:0|-?[1-9]\d{0,8})$/.test(v.numerator)&&typeof v.denominator==='string'&&/^[1-9]\d{0,5}$/.test(v.denominator);
const quote=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=400&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
/** Coefficient matrices only: no expression strings, function calls or implicit units. */
export function validMathLinearSystem(v:unknown):v is MathLinearSystem{
 if(!plainStudentInput(v,['kind','variables','equations','targets'])||v.kind!=='linear_system'||!Array.isArray(v.variables)||v.variables.length<1||v.variables.length>4||v.variables.some(n=>typeof n!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(n))||new Set(v.variables).size!==v.variables.length)return false;
 const variables=v.variables;
 return Array.isArray(v.equations)&&v.equations.length>=1&&v.equations.length<=8&&v.equations.every(e=>plainStudentInput(e,['coefficients','constant','sourceText'])&&Array.isArray(e.coefficients)&&e.coefficients.length===variables.length&&e.coefficients.every(rational)&&rational(e.constant)&&quote(e.sourceText))&&Array.isArray(v.targets)&&v.targets.length>=1&&v.targets.length<=4&&v.targets.every(t=>plainStudentInput(t,['variable','expected','answerText'])&&variables.includes(t.variable)&&rational(t.expected)&&quote(t.answerText))&&new Set(v.targets.map(t=>t.variable)).size===v.targets.length;
}
export function mathSystemBoundToQuestion(v:MathLinearSystem,question:{stem:string;answer:string}):boolean{
 return v.equations.every(e=>question.stem.includes(e.sourceText))&&v.targets.every(t=>question.answer.includes(t.answerText));
}
export const MATH_SYSTEM_MESSAGES:Record<MathSystemStatus,string>={
 unique_targets:'所列线性条件能确定目标值，且与提交答案一致。',
 inconsistent:'所列线性条件互相矛盾，请修正题干或条件建模。',
 underdetermined:'所列线性条件不足以唯一确定所求量，请核对缺失条件。',
 answer_mismatch:'所列线性条件推得的目标值与提交答案不符。',
};
const rationalSchema={type:'object',additionalProperties:false,required:['numerator','denominator'],properties:{numerator:{type:'string',pattern:'^(?:0|-?[1-9]\\d{0,8})$'},denominator:{type:'string',pattern:'^[1-9]\\d{0,5}$'}}} as const;
export const mathLinearSystemProperties={
 variables:{type:'array',minItems:1,maxItems:4,uniqueItems:true,items:{type:'string',pattern:'^[A-Za-z][A-Za-z0-9_]{0,15}$'}},
 equations:{type:'array',minItems:1,maxItems:8,items:{type:'object',additionalProperties:false,required:['coefficients','constant','sourceText'],properties:{coefficients:{type:'array',minItems:1,maxItems:4,items:rationalSchema},constant:rationalSchema,sourceText:{type:'string',minLength:1,maxLength:400,description:'当前题干中的逐字原文片段'}}}},
 targets:{type:'array',minItems:1,maxItems:4,items:{type:'object',additionalProperties:false,required:['variable','expected','answerText'],properties:{variable:{type:'string'},expected:rationalSchema,answerText:{type:'string',minLength:1,maxLength:400,description:'当前参考答案中的逐字片段'}}}},
} as const;
