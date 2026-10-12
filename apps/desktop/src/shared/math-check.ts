import {plainStudentInput} from './student-context';
export const MATH_CHECK_SCHEMA='xiaozhi.education.math-check.v1' as const;
export type MathExpression={op:'number';numerator:string;denominator:string}|{op:'variable'}|{op:'add'|'subtract'|'multiply'|'divide'|'power'|'sqrt';args:MathExpression[]};
export type MathAtomicCheck={kind:'expression'|'identity';left:MathExpression;right:MathExpression}|{kind:'polynomial';left:MathExpression;right:MathExpression;domain:'real'|'positive'|'nonnegative';roots:MathExpression[]};
export type MathCheckInput=MathAtomicCheck|{kind:'steps';checks:MathAtomicCheck[]};
export type MathStepState='matched'|'mismatch'|'unsupported';
export const aggregateMathSteps=(states:MathStepState[]):MathStepState=>states.includes('mismatch')?'mismatch':states.includes('unsupported')?'unsupported':'matched';
export function validMathStepStates(value:unknown):value is MathStepState[]{return Array.isArray(value)&&value.length>=2&&value.length<=6&&value.every(s=>['matched','mismatch','unsupported'].includes(s));}
export type MathCheckResult={state:'matched'|'mismatch'|'unsupported';conditionsVerified:false;engine:'sympy-1.14.0';reason:'calculation_match'|'calculation_mismatch'|'outside_supported_scope';stepStates?:MathStepState[]};
/** Structural limits only. The fixed SymPy worker independently enforces the same bounds. */
export function validMathCheckInput(value:unknown):value is MathCheckInput{
 if(plainStudentInput(value,['kind','checks'])&&value.kind==='steps')return Array.isArray(value.checks)&&value.checks.length>=2&&value.checks.length<=6&&value.checks.every(c=>plainStudentInput(c,['kind','left','right','domain','roots'])&&c.kind!=='steps'&&validMathCheckInput(c));
 if(!plainStudentInput(value,value&&typeof value==='object'&&'kind' in value&&value.kind==='polynomial'?['kind','left','right','domain','roots']:['kind','left','right'])||!['expression','identity','polynomial'].includes(String(value.kind)))return false;
 let nodes=0;
 const expression=(v:unknown,depth:number,variable:boolean):boolean=>{
  if(++nodes>128||depth>12||!plainStudentInput(v,['op','numerator','denominator','args']))return false;
  if(v.op==='number')return plainStudentInput(v,['op','numerator','denominator'])&&typeof v.numerator==='string'&&/^(?:0|-?[1-9]\d{0,8})$/.test(v.numerator)&&typeof v.denominator==='string'&&/^[1-9]\d{0,5}$/.test(v.denominator);
  if(v.op==='variable')return variable&&plainStudentInput(v,['op']);
  if(!plainStudentInput(v,['op','args'])||!Array.isArray(v.args)||!['add','subtract','multiply','divide','power','sqrt'].includes(String(v.op))||v.args.length!==(v.op==='sqrt'?1:2))return false;
  if(v.op==='power'){const p=v.args[1];if(!plainStudentInput(p,['op','numerator','denominator'])||p.op!=='number'||p.denominator!=='1'||typeof p.numerator!=='string'||!/^[-]?[0-8]$/.test(p.numerator))return false;}
  return v.args.every(a=>expression(a,depth+1,variable));
 };
 if(!expression(value.left,0,value.kind!=='expression')||!expression(value.right,0,value.kind!=='expression'))return false;
 return value.kind!=='polynomial'||['real','positive','nonnegative'].includes(String(value.domain))&&Array.isArray(value.roots)&&value.roots.length<=4&&value.roots.every(r=>expression(r,0,false));
}
export function validMathCheckResult(v:unknown):v is MathCheckResult{
 if(!plainStudentInput(v,['state','conditionsVerified','engine','reason','stepStates'])||v.conditionsVerified!==false||v.engine!=='sympy-1.14.0')return false;
 if(v.stepStates!==undefined&&(!validMathStepStates(v.stepStates)||aggregateMathSteps(v.stepStates)!==v.state))return false;
 return(v.state==='matched'&&v.reason==='calculation_match')||(v.state==='mismatch'&&v.reason==='calculation_mismatch')||(v.state==='unsupported'&&v.reason==='outside_supported_scope');
}
