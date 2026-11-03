import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {BUOYANCY_TOOL,buoyancyParameters,validBuoyancyInput,analyzeBuoyancy,buoyancySummary} from '../../shared/buoyancy';

export function createBuoyancyTools(isCurrent:()=>boolean):ToolDefinition[]{
 return[{name:BUOYANCY_TOOL,label:'核对浮力条件与双方法',description:'按题目实际条件计算刚性正方体浮力，用受力/排液法与等效平均密度/体积分数法交叉核对。输入边长、物块密度、液体密度、g、向下载荷，数值为最多6位整数+6位小数的非负十进制字符串，除载荷外必须大于零；单位按schema，不猜g，未给定的数值/场景为null，不能默认为0。显式声明模型条件，缺失用null，条件不适用用false，将返回具体未确定项而非猜解。free给出最终漂浮平衡，或完全浸没未触底的超载合力；bottom必须明确全浸没触底静止且底面仍受液体作用，不适用密封贴底。全浸没临界不能唯一确定悬浮深度。两方法一致仅核对声明模型，不证明原题语义/图义或自然教学质量；conditionsVerified=false。新载荷/密度必须重新调用；不内置4N/5N或默认答案，不推断速度/加速度。原只读工具，不写文件/题库，无额外审批。',parameters:buoyancyParameters as ToolDefinition['parameters'],execute:async(_id,args,signal)=>{
  const current=()=>{signal?.throwIfAborted();if(!isCurrent())throw Error('cancelled');};
  try{current();if(!validBuoyancyInput(args))throw Error('invalid_input');const result=analyzeBuoyancy(args);current();return{content:[{type:'text',text:JSON.stringify({success:true,...result,message:buoyancySummary(result)})}],details:{success:true,data:result}};}
  catch(error){current();const code=error instanceof Error&&error.message==='invalid_input'?'invalid_input':'unavailable';return{content:[{type:'text',text:JSON.stringify({success:false,code,message:'浮力模型未计算，请核对实际条件、单位及数值范围。'})}],details:{success:false,error:{code}},isError:true};}
 }}];
}
