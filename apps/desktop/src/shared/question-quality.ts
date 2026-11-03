import {validVariationEquationEvidence,type VariationEquationEvidence} from './variation-equation';
import {validQuestionBuoyancyProof,type QuestionBuoyancyProof} from './question-buoyancy';
import type {GeneratedQuestionCompletenessIssue} from './generated-question-completeness';
import {validMathStepStates,aggregateMathSteps,type MathStepState} from './math-check';
import type {QuestionDraftIssue} from './question-draft';
import {plainStudentInput} from './student-context';
import {validQuestionSolutionResult,type QuestionSolutionResult} from './question-solution';
import {validQuestionScienceResult,type QuestionScienceResult} from './question-science';

export const QUESTION_QUALITY_SCHEMA='xiaozhi.education.question-quality.v1' as const;
export const QUESTION_QUALITY_RECORD_SCHEMA='xiaozhi.education.question-review-record.v2' as const;
export const QUESTION_MATH_QUALITY_SCHEMA='xiaozhi.education.question-quality.v2' as const;
export const QUESTION_MATH_RECORD_SCHEMA='xiaozhi.education.question-review-record.v3' as const;
export const QUESTION_SCIENCE_QUALITY_SCHEMA='xiaozhi.education.question-quality.v3' as const;
export const QUESTION_SOLUTION_QUALITY_SCHEMA='xiaozhi.education.question-quality.v4' as const;
export const QUESTION_BUOYANCY_QUALITY_SCHEMA='xiaozhi.education.question-quality.v5' as const;
export const QUESTION_VARIATION_QUALITY_SCHEMA='xiaozhi.education.question-quality.v6' as const;
export type QuestionMathReceipt={state:'matched'|'mismatch'|'unsupported'|'basis_changed'|'not_run';conditionsVerified:false;calculation?:string;stepStates?:MathStepState[];engine?:'sympy-1.14.0'|'exact-rational-cube-v1';science?:QuestionScienceResult|QuestionSolutionResult;buoyancy?:QuestionBuoyancyProof};
export type QuestionQualityIssue=QuestionDraftIssue|GeneratedQuestionCompletenessIssue|'choice_embedded_options_conflict'|'duplicate_batch'|'duplicate_parent'|'answer_conflict'|'math_mismatch'|'variation_equation_mismatch'|'variation_answer_unreadable';
export type QuestionQualityReview={
 schemaVersion:typeof QUESTION_QUALITY_SCHEMA|typeof QUESTION_MATH_QUALITY_SCHEMA|typeof QUESTION_SCIENCE_QUALITY_SCHEMA|typeof QUESTION_SOLUTION_QUALITY_SCHEMA|typeof QUESTION_BUOYANCY_QUALITY_SCHEMA|typeof QUESTION_VARIATION_QUALITY_SCHEMA;
 revisionHash:string;
 state:'blocked'|'manual_review';
 duplicateScope:'batch_and_read_parents';
 answerVerification:'not_run';
 items:{state:'blocked'|'manual_review';issues:QuestionQualityIssue[];math?:QuestionMathReceipt;equation?:VariationEquationEvidence}[];
};
export type QuestionQualityConfirmation={revisionHash:string;reviewed:true};
export const QUESTION_QUALITY_MESSAGES:Record<QuestionQualityIssue,string>={
 generated_part_answer_missing:'参考答案未按题干小问编号完整填写，请逐问用(1)、(2)…编号并补齐内容；本检查仅核对结构',
 generated_part_analysis_missing:'解析未按题干小问编号完整填写，请逐问用(1)、(2)…编号并补齐讲解；数学正确性仍需核对',
 generated_figure_not_delivered:'生成题引用了未交付的图示，请根据真实已知条件改为完整文字题；不能猜图或自动借用父题原图',
 generated_table_not_delivered:'生成题引用了缺失的数据表，请补全表头、单位及全部数据，不能猜测数据',
 choice_embedded_options_conflict:'题干内的A–D与选项字段冲突，请删除题干中的选项或统一内容后重新检查',
 missing_question:'题干缺失',missing_correct_answer:'参考答案缺失',missing_explanation:'解析缺失',
 choice_options_must_be_a_to_d:'选择题需要完整的A–D选项',choice_correct_answer_must_be_option_key:'选择题答案需要填写A、B、C或D',
 concept_must_not_have_options:'判断题不能包含选择题选项',concept_correct_answer_must_be_true_or_false:'判断题答案需要填写true或false',
 fill_in_blank_must_not_have_options:'填空题不能包含选择题选项',fill_in_blank_question_must_contain_blank_token:'填空题需要用____标记空格',
 non_choice_must_not_have_options:'本题型不能包含选择题选项',non_choice_correct_answer_looks_like_option_key:'本题型需要完整答案，不能只写选项字母',
 duplicate_batch:'与本组另一道题完全重复，请删除重复内容或重新出题',duplicate_parent:'与实读原题完全重复，不能作为变式题保存',
 answer_conflict:'完全相同的题面出现不同参考答案，请核对并解决冲突',
 variation_equation_mismatch:'本题完整字面方程与参考答案不符，请按逐题实际解集修正，不能沿用父题答案',
 variation_answer_unreadable:'本题可自动复算，请把完整答案写为x=数值、x={各根}或无实数解，再检查当前版本',
 math_mismatch:'提交的计算或条件检查未通过，候选不可保存；请核对下方具体结果',
};
export function validQuestionQuality(v:unknown,count:number):v is QuestionQualityReview{
 if(!plainStudentInput(v,['schemaVersion','revisionHash','state','duplicateScope','answerVerification','items'])||![QUESTION_QUALITY_SCHEMA,QUESTION_MATH_QUALITY_SCHEMA,QUESTION_SCIENCE_QUALITY_SCHEMA,QUESTION_SOLUTION_QUALITY_SCHEMA,QUESTION_BUOYANCY_QUALITY_SCHEMA,QUESTION_VARIATION_QUALITY_SCHEMA].includes(v.schemaVersion as typeof QUESTION_QUALITY_SCHEMA)||typeof v.revisionHash!=='string'||!/^[a-f0-9]{64}$/.test(v.revisionHash)||!['blocked','manual_review'].includes(String(v.state))||v.duplicateScope!=='batch_and_read_parents'||v.answerVerification!=='not_run'||!Array.isArray(v.items)||v.items.length!==count)return false;
 const variation=v.schemaVersion===QUESTION_VARIATION_QUALITY_SCHEMA;
 const science=variation||[QUESTION_SCIENCE_QUALITY_SCHEMA,QUESTION_SOLUTION_QUALITY_SCHEMA,QUESTION_BUOYANCY_QUALITY_SCHEMA].includes(v.schemaVersion as typeof QUESTION_SCIENCE_QUALITY_SCHEMA);
 return v.items.every(i=>{
  if(!plainStudentInput(i,v.schemaVersion===QUESTION_QUALITY_SCHEMA?['state','issues']:variation?['state','issues','math','equation']:['state','issues','math'])||!Array.isArray(i.issues)||i.issues.length>Object.keys(QUESTION_QUALITY_MESSAGES).length||new Set(i.issues).size!==i.issues.length||!i.issues.every(k=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(QUESTION_QUALITY_MESSAGES,k))||i.state!==(i.issues.length?'blocked':'manual_review'))return false;
  if(variation){if(!validVariationEquationEvidence(i.equation)||i.issues.includes('variation_equation_mismatch')!==(i.equation.state==='mismatch')||i.issues.includes('variation_answer_unreadable')!==(i.equation.state==='answer_unreadable'))return false;}
  else if(i.issues.includes('variation_equation_mismatch')||i.issues.includes('variation_answer_unreadable'))return false;
  return v.schemaVersion===QUESTION_QUALITY_SCHEMA?!i.issues.includes('math_mismatch'):validQuestionMathReceipt(i.math,science,variation||v.schemaVersion===QUESTION_SOLUTION_QUALITY_SCHEMA||v.schemaVersion===QUESTION_BUOYANCY_QUALITY_SCHEMA,variation||v.schemaVersion===QUESTION_BUOYANCY_QUALITY_SCHEMA)&&i.issues.includes('math_mismatch')===(i.math.state==='mismatch');
 })&&v.state===(v.items.some(i=>i.state==='blocked')?'blocked':'manual_review');
}
function validQuestionMathReceipt(v:unknown,science=false,solution=false,buoyancy=false):v is QuestionMathReceipt{
 if(!plainStudentInput(v,buoyancy?['state','conditionsVerified','calculation','engine','stepStates','science','buoyancy']:science?['state','conditionsVerified','calculation','engine','stepStates','science']:['state','conditionsVerified','calculation','engine','stepStates'])||v.conditionsVerified!==false)return false;
 if(v.buoyancy!==undefined&&(!buoyancy||!validQuestionBuoyancyProof(v.buoyancy)||v.science!==undefined||v.stepStates!==undefined||v.state!==v.buoyancy.state||v.engine!=='exact-rational-cube-v1'))return false;
 if(v.science!==undefined&&(!science||!(validQuestionScienceResult(v.science)||solution&&validQuestionSolutionResult(v.science))||v.stepStates!==undefined||v.state!== (v.science.result.state==='dimension_mismatch'?'mismatch':v.science.result.state)))return false;
 if(v.stepStates!==undefined&&(!validMathStepStates(v.stepStates)||aggregateMathSteps(v.stepStates)!==v.state))return false;
 if(v.state==='not_run')return v.calculation===undefined&&v.engine===undefined&&v.buoyancy===undefined;
 if(typeof v.calculation!=='string'||v.calculation.length>(solution||buoyancy?48000:science?24000:8000))return false;
 return v.state==='basis_changed'?v.engine===undefined&&v.buoyancy===undefined:['matched','mismatch','unsupported'].includes(String(v.state))&&(v.buoyancy!==undefined?buoyancy&&v.engine==='exact-rational-cube-v1':v.engine==='sympy-1.14.0');
}
