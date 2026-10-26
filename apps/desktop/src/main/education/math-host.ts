import {MATH_CHECK_SCHEMA,validMathCheckInput,validMathCheckResult,type MathCheckInput,type MathCheckResult} from '../../shared/math-check';
import {runEducationWorker} from './worker-host';
import {MATH_SYSTEM_SCHEMA} from '../../shared/math-system';
/** Checks submitted formal arithmetic, never the completeness of a natural-language question. */
export async function checkMath(input:MathCheckInput,signal:AbortSignal):Promise<MathCheckResult>{
 if(!validMathCheckInput(input))throw new Error('invalid_input');
 return runEducationWorker('math',input,input.kind==='linear_system'?MATH_SYSTEM_SCHEMA:MATH_CHECK_SCHEMA,signal,16384,8192,(v):v is MathCheckResult=>{
  if(!v||typeof v!=='object')return false;
  const {schemaVersion:_schema,requestId:_id,ok:_ok,...result}=v as Record<string,unknown>;
  return validMathCheckResult(result)&&(input.kind==='steps'?result.stepStates?.length===input.checks.length:result.stepStates===undefined)&&(input.kind==='linear_system'?result.systemStatus!==undefined:result.systemStatus===undefined);
 },v=>({state:v.state,conditionsVerified:false,reason:v.reason,engine:v.engine,...(v.stepStates?{stepStates:v.stepStates}:{}),...(v.systemStatus?{systemStatus:v.systemStatus}:{})}));
}
