import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {MATH_QUANTITY_TOOL,mathQuantityParameters,validMathQuantityInput} from '../../shared/math-quantity';
import {checkQuantity} from './math-host';

export function createQuantityTools(isCurrent:()=>boolean):ToolDefinition[]{
 return [{name:MATH_QUANTITY_TOOL,label:'核验物理量与单位',
  description:'用本机固定SymPy SI单位系统进行带量纲的物理计算/单位换算并核对精确答案，识别cm到m的面积平方/体积立方比例、速度/密度/压强/电学、kg质量与N力的差异。kind=quantity；expression AST叶子{op:quantity,value:{numerator:整数文本,denominator:正整数文本},unit:单位}；二元节点{op:add/subtract/multiply/divide,args:[AST,AST]}；平方根{op:sqrt,args:[AST]}；整数幂{op:power,args:[AST],exponent:-4到4}。targetUnit为目标单位，expected为该单位下精确答案分数或null仅计算。单位ASCII大小写敏感，支持1、m/km/dm/cm/mm/um/nm、kg/g/mg/t、s/ms/min/h、L/mL、N/kN、Pa/kPa/MPa、J/kJ、W/kW、Hz、A/mA/uA、V/mV/kV、ohm/kohm/Mohm、C、S、K、mol、cd，上述SI单位还支持标准词头（如kHz、mmol，ASCII u表示微），以及*、/和^整数幂（如kg/m^3、m/s^2）；乘除从左到右，不支持括号。不要把kg直接转N：必须输入题目实际给定的重力加速度等条件，不内置或猜g。加减先核同量纲，零值也保留单位检查。mismatch/dimension_mismatch须按实际条件重新推导再核验，不可声称已通过。unsupported表示尚未核验，摄氏/华氏等仿射温度不能假当线性换算。仅核验所提交表达式，conditionsVerified=false，不能证明题意建模、公式选用或整题正确。条件变化必须用新表达式重算；本地只读，无额外审批。',
  parameters:mathQuantityParameters as ToolDefinition['parameters'],
  execute:async(_callId,args,signal)=>{
   const abort=signal||new AbortController().signal,current=()=>{abort.throwIfAborted();if(!isCurrent())throw Error('cancelled');};
   try{current();if(!validMathQuantityInput(args))throw Error('invalid_input');const result=await checkQuantity(args,abort);current();
    const message=result.state==='matched'?'精确数值与目标量纲一致。':result.state==='calculated'?'已计算目标单位下的精确值，未提交待核答案。':result.state==='mismatch'?'数值与实际单位换算结果不符，请修正后重新核验。':result.state==='dimension_mismatch'?'物理量纲不匹配，请核对单位和公式，不能作为已核验答案。':'本次数量表达式未完成核验，请按原因调整或明确尚未核验。';
    return{content:[{type:'text',text:JSON.stringify({success:true,...result,message,scope:'仅核验提交的数量表达式与单位，不证明题意建模或整题正确。'})}],details:{success:true,data:result}};
   }catch(error){current();const code=error instanceof Error&&['invalid_input','timeout','busy','unavailable'].includes(error.message)?error.message:'unavailable';
    return{content:[{type:'text',text:JSON.stringify({success:false,code,message:'本地物理量核验未完成，请检查参数或稍后重试，不能标已核验。'})}],details:{success:false,error:{code}},isError:true};
   }
  }}];
}
