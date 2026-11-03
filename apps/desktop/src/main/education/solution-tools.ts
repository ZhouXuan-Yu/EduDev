import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {MATH_SOLUTION_TOOL,mathSolutionParameters,validMathSolutionInput} from '../../shared/math-solution';
import {checkSolution} from './math-host';

/** A formal chain proof uses original-domain sets, never a model confidence score. */
export function createSolutionTools(isCurrent:()=>boolean):ToolDefinition[]{
 return [{name:MATH_SOLUTION_TOOL,label:'核验解题步骤与增根丢根',
  description:'用本机固定SymPy核对单变量x解题链，定位首个不成立变形，即使最终答案碰巧正确也保留中间失败。kind=solution；原方程left/right、domain、roots的AST格式同education_verify_equation（number精确分数、variable、add/subtract/multiply/divide/power/sqrt），必须保留原式；steps为1至5步{left,right,relation}完整方程，原分母/根号/定义域始终继承，新增除数也必须有效。relation=equivalent要求等价且不增丢根；candidate_expansion仅用于明确可能增根的变形（如平方），不得丢候选；original_filter表示按原式代回，只能筛掉非原解。扩展的候选须最终回到原解集，不能以“允许增根”跳过代回。roots是提出的全部最终原解，至多4；每式保守四次复杂度和至多两处变量平方根；不支持的步骤/无限解集明确未核验。返回每步增/丢候选、首错位置、原式限制及最终答案状态。mismatch须修正推导再核验，不能只修最后一行。conditionsVerified=false：证明提交的形式化方程链，不证明题意翻译、未见图形或自然讲解；不同题目/条件须重新提交。本地只读，不写题库，无额外审批。',
  parameters:mathSolutionParameters as ToolDefinition['parameters'],
  execute:async(_callId,args,signal)=>{
   const abort=signal||new AbortController().signal,current=()=>{abort.throwIfAborted();if(!isCurrent())throw Error('cancelled');};
   try{current();if(!validMathSolutionInput(args))throw Error('invalid_input');const result=await checkSolution(args,abort);current();
    const message=result.state==='matched'?'形式化推导链及最终原解集一致；原定义域已保留。':result.state==='mismatch'?result.firstMismatch?`第${result.firstMismatch}步首次不符合声明的变形关系，请结合增根/丢根修正整条推导。`:'最终方程或提交答案与原解集不一致，请修正并代回。':'部分推导超出可确定范围，尚未核验，不能标整条通过。';
    return{content:[{type:'text',text:JSON.stringify({success:true,...result,message,scope:'仅核验提交的形式化推导链及原定义域，不证明题意翻译或整题正确。'})}],details:{success:true,data:result}};
   }catch(error){current();const code=error instanceof Error&&['invalid_input','timeout','busy','unavailable'].includes(error.message)?error.message:'unavailable';
    return{content:[{type:'text',text:JSON.stringify({success:false,code,message:'本地解题链核验未完成，请检查完整原式、步骤及变形关系；不能标已核验。'})}],details:{success:false,error:{code}},isError:true};
   }
  }}];
}
