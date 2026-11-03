import {plainStudentInput} from './student-context';

export const MATH_QUANTITY_SCHEMA='xiaozhi.education.math-check.v4' as const;
export const MATH_QUANTITY_TOOL='education_verify_quantity' as const;
export type QuantityRational={numerator:string;denominator:string};
export type QuantityExpression={op:'quantity';value:QuantityRational;unit:string}
 |{op:'add'|'subtract'|'multiply'|'divide'|'sqrt';args:QuantityExpression[]}
 |{op:'power';args:QuantityExpression[];exponent:number};
export type MathQuantityInput={kind:'quantity';expression:QuantityExpression;targetUnit:string;expected:QuantityRational|null};
export type MathQuantityResult={state:'calculated'|'matched'|'mismatch'|'dimension_mismatch'|'unsupported';conditionsVerified:false;engine:'sympy-1.14.0';targetUnit:string;reason:null|'incompatible_addition'|'incompatible_target'|'undefined'|'unsupported_unit'|'outside_scope';actual:null|{exact:string;decimal:string;unit:string;dimensions:string;scaleFactor:string};detail:string};
const rational=(v:unknown):v is QuantityRational=>plainStudentInput(v,['numerator','denominator'])&&typeof v.numerator==='string'&&/^(?:0|-?[1-9]\d{0,8})$/.test(v.numerator)&&typeof v.denominator==='string'&&/^[1-9]\d{0,5}$/.test(v.denominator);
/** Syntax only; the fixed SymPy worker owns the supported unit registry. */
const unit=(v:unknown):v is string=>typeof v==='string'&&v.length<=128&&v.split(/[*/]/).length<=12&&/^(?:1|[A-Za-z]+)(?:\^-?[1-4])?(?:[*/](?:1|[A-Za-z]+)(?:\^-?[1-4])?)*$/.test(v);
export function validMathQuantityInput(v:unknown):v is MathQuantityInput{
 if(!plainStudentInput(v,['kind','expression','targetUnit','expected'])||v.kind!=='quantity'||!unit(v.targetUnit)||v.expected!==null&&!rational(v.expected))return false;
 let nodes=0;
 const expression=(e:unknown,depth:number):boolean=>{
  if(++nodes>128||depth>12||!plainStudentInput(e,['op','value','unit','args','exponent']))return false;
  if(e.op==='quantity')return plainStudentInput(e,['op','value','unit'])&&rational(e.value)&&unit(e.unit);
  if(!plainStudentInput(e,e.op==='power'?['op','args','exponent']:['op','args'])||!['add','subtract','multiply','divide','power','sqrt'].includes(String(e.op))||!Array.isArray(e.args)||e.args.length!==(['sqrt','power'].includes(String(e.op))?1:2))return false;
  return(e.op!=='power'||typeof e.exponent==='number'&&Number.isInteger(e.exponent)&&Math.abs(e.exponent)<=4)&&e.args.every(a=>expression(a,depth+1));
 };
 return expression(v.expression,0);
}
export function validMathQuantityResult(v:unknown):v is MathQuantityResult{
 if(!plainStudentInput(v,['state','conditionsVerified','engine','targetUnit','reason','actual','detail'])||v.conditionsVerified!==false||v.engine!=='sympy-1.14.0'||!unit(v.targetUnit)||typeof v.detail!=='string'||v.detail.length>1024)return false;
 if(['calculated','matched','mismatch'].includes(String(v.state)))return v.reason===null&&plainStudentInput(v.actual,['exact','decimal','unit','dimensions','scaleFactor'])&&v.actual.unit===v.targetUnit&&['exact','decimal','dimensions','scaleFactor'].every(k=>typeof (v.actual as Record<string,unknown>)[k]==='string'&&String((v.actual as Record<string,unknown>)[k]).length<=1024);
 return v.actual===null&&(v.state==='dimension_mismatch'&&['incompatible_addition','incompatible_target'].includes(String(v.reason))||v.state==='unsupported'&&['undefined','unsupported_unit','outside_scope'].includes(String(v.reason)));
}
export const mathQuantityParameters={type:'object',additionalProperties:false,required:['kind','expression','targetUnit','expected'],properties:{kind:{type:'string',enum:['quantity']},expression:{type:'object',description:'带单位的完整数量表达式AST；保留原单位及给定常数'},targetUnit:{type:'string',maxLength:128,description:'目标单位ASCII表达式，如Pa、km/h、kg/m^3、N；1表示无量纲'},expected:{anyOf:[{type:'null'},{type:'object',additionalProperties:false,required:['numerator','denominator'],properties:{numerator:{type:'string'},denominator:{type:'string'}}}],description:'已推导的精确目标单位数值，或null仅计算；小数写精确分数，不默认四舍五入容差'}}} as const;
