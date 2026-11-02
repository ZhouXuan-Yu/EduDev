import {MATH_CHECK_SCHEMA,validMathCheckInput,validMathCheckResult,type MathCheckInput,type MathCheckResult} from '../../shared/math-check';
import {runEducationWorker} from './worker-host';
import {MATH_SYSTEM_SCHEMA} from '../../shared/math-system';
import {MATH_EQUATION_SCHEMA,validMathEquationInput,validMathEquationResult,type MathEquationInput,type MathEquationResult} from '../../shared/math-equation';
import {MATH_QUANTITY_SCHEMA,validMathQuantityInput,validMathQuantityResult,type MathQuantityInput,type MathQuantityResult} from '../../shared/math-quantity';
import {MATH_SOLUTION_SCHEMA,validMathSolutionInput,validMathSolutionResult,type MathSolutionInput,type MathSolutionResult} from '../../shared/math-solution';

export async function checkSolution(input:MathSolutionInput,signal:AbortSignal):Promise<MathSolutionResult>{
 if(!validMathSolutionInput(input))throw Error('invalid_input');
 return runEducationWorker('math',input,MATH_SOLUTION_SCHEMA,signal,16384,32768,(v):v is MathSolutionResult=>{
  if(!v||typeof v!=='object')return false;const {schemaVersion:_schema,requestId:_id,ok:_ok,...result}=v as Record<string,unknown>;
  return validMathSolutionResult(result)&&(result.original.state==='unsupported'||result.steps.length===input.steps.length)&&result.steps.every((s,i)=>s.relation===input.steps[i].relation);
 },v=>({state:v.state,conditionsVerified:false,domainRetained:true,engine:v.engine,original:v.original,answerState:v.answerState,firstMismatch:v.firstMismatch,steps:v.steps}));
}

export async function checkQuantity(input:MathQuantityInput,signal:AbortSignal):Promise<MathQuantityResult>{
 if(!validMathQuantityInput(input))throw Error('invalid_input');
 return runEducationWorker('math',input,MATH_QUANTITY_SCHEMA,signal,16384,8192,(v):v is MathQuantityResult=>{
  if(!v||typeof v!=='object')return false;const {schemaVersion:_schema,requestId:_id,ok:_ok,...result}=v as Record<string,unknown>;
  return validMathQuantityResult(result)&&result.targetUnit===input.targetUnit&&(result.actual===null||input.expected===null?result.state!=='matched'&&result.state!=='mismatch':result.state!=='calculated');
 },v=>({state:v.state,conditionsVerified:false,engine:v.engine,targetUnit:v.targetUnit,reason:v.reason,actual:v.actual,detail:v.detail}));
}

/** Preserve the submitted original equation domain; never imply natural-language conditions were verified. */
export async function checkEquation(input:MathEquationInput,signal:AbortSignal):Promise<MathEquationResult>{
 if(!validMathEquationInput(input))throw Error('invalid_input');
 return runEducationWorker('math',input,MATH_EQUATION_SCHEMA,signal,16384,8192,(v):v is MathEquationResult=>{
  if(!v||typeof v!=='object')return false;const {schemaVersion:_schema,requestId:_id,ok:_ok,...result}=v as Record<string,unknown>;
  return validMathEquationResult(result)&&(result.state==='unsupported'||result.candidates.length===input.roots.length);
 },v=>({state:v.state,conditionsVerified:false,engine:v.engine,solutionStatus:v.solutionStatus,restrictions:v.restrictions,solutions:v.solutions,candidates:v.candidates}));
}
/** Checks submitted formal arithmetic, never the completeness of a natural-language question. */
export async function checkMath(input:MathCheckInput,signal:AbortSignal):Promise<MathCheckResult>{
 if(!validMathCheckInput(input))throw new Error('invalid_input');
 return runEducationWorker('math',input,input.kind==='linear_system'?MATH_SYSTEM_SCHEMA:MATH_CHECK_SCHEMA,signal,16384,8192,(v):v is MathCheckResult=>{
  if(!v||typeof v!=='object')return false;
  const {schemaVersion:_schema,requestId:_id,ok:_ok,...result}=v as Record<string,unknown>;
  return validMathCheckResult(result)&&(input.kind==='steps'?result.stepStates?.length===input.checks.length:result.stepStates===undefined)&&(input.kind==='linear_system'?result.systemStatus!==undefined:result.systemStatus===undefined);
 },v=>({state:v.state,conditionsVerified:false,reason:v.reason,engine:v.engine,...(v.stepStates?{stepStates:v.stepStates}:{}),...(v.systemStatus?{systemStatus:v.systemStatus}:{})}));
}
