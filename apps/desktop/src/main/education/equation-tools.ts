import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {MATH_EQUATION_TOOL,mathEquationParameters,validMathEquationInput} from '../../shared/math-equation';
import {checkEquation} from './math-host';

/** A local read-only proof of the submitted formal equation, not of its translation from a question. */
export function createEquationTools(isCurrent:()=>boolean):ToolDefinition[]{
 return [{name:MATH_EQUATION_TOOL,label:'核验原方程与定义域',
  description:'用本机固定SymPy核验单变量x的原方程及完整有限实数解集，包括分式分母非零、根号内非负、负整数幂底数非零。必须输入原式，不能先约分/通分/平方消根，否则会丢原条件。kind=equation；left/right是AST：{op:number,numerator:整数文本,denominator:正整数文本}、{op:variable}(x)，或{op:add/subtract/multiply/divide/power/sqrt,args:AST[]}，加减乘除/幂两项，sqrt一项；整数幂-8到8，保守四次代数复杂度，至多两处变量平方根。小数写精确分数。domain=real/positive/nonnegative，roots为你提出的全部候选根AST（至多4），无解填[]。返回原式定义域限制、实际有限根集、各候选是否在定义域且代回成立；mismatch必须按原条件重新推导，不可声称已核验。non_finite表示并非有限解集，不能猜唯一解；undetermined表示超范围，须明确尚未核验。conditionsVerified=false表示未核对题意建模、未见图示/物理条件或讲解步骤，不证明整题正确。修改条件后须用新原式重算，旧回执不能复用。本地只读、不写题库，不需要额外审批。',
  parameters:mathEquationParameters as ToolDefinition['parameters'],
  execute:async(_callId,args,signal)=>{
   const abort=signal||new AbortController().signal,current=()=>{abort.throwIfAborted();if(!isCurrent())throw Error('cancelled');};
   try{current();if(!validMathEquationInput(args))throw Error('invalid_input');const result=await checkEquation(args,abort);current();
    const message=result.state==='matched'?'提交候选与原式的完整有限解集一致。':result.state==='mismatch'?'候选与原式解集不一致，请按定义域和代回结果修正。':result.solutionStatus==='non_finite'?'原式并非有限解集，不能声称存在唯一解。':'本次原式超出可确定核验范围，尚未核验。';
    return{content:[{type:'text',text:JSON.stringify({success:true,...result,message,scope:'仅核验提交的形式化原方程与指定定义域，不证明题意翻译或整题正确。'})}],details:{success:true,data:result}};
   }catch(error){current();const code=error instanceof Error&&['invalid_input','timeout','busy','unavailable'].includes(error.message)?error.message:'unavailable';
    const message={invalid_input:'方程参数无效，请保留完整原式并按AST格式重试。',timeout:'原方程核验超时，尚未核验。',busy:'本地核验正在处理其他计算，请稍后重试。',unavailable:'本地原方程核验暂不可用，尚未核验。'}[code];
    return{content:[{type:'text',text:JSON.stringify({success:false,code,message})}],details:{success:false,error:{code}},isError:true};
   }
  }}];
}
