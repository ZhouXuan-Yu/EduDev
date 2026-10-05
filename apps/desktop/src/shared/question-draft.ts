import {plainStudentInput} from './student-context';
export const QUESTION_DRAFT_SCHEMA='xiaozhi.education.question-draft.v1' as const;
export const QUESTION_DRAFT_TYPES=['choice','concept','fill_in_blank','short_answer','written','coding'] as const;
export type QuestionDraftType=typeof QUESTION_DRAFT_TYPES[number];
export type QuestionDraftInput={questionType:QuestionDraftType;raw:string};
export type QuestionDraft={questionType:QuestionDraftType;stem:string;answer:string;analysis:string;options:Record<string,string>|null};
export const QUESTION_DRAFT_ISSUES=['missing_question','missing_correct_answer','missing_explanation','choice_options_must_be_a_to_d','choice_correct_answer_must_be_option_key','concept_must_not_have_options','concept_correct_answer_must_be_true_or_false','fill_in_blank_must_not_have_options','fill_in_blank_question_must_contain_blank_token','non_choice_must_not_have_options','non_choice_correct_answer_looks_like_option_key'] as const;
export type QuestionDraftIssue=typeof QUESTION_DRAFT_ISSUES[number];
export type QuestionDraftResult={question:QuestionDraft;issues:QuestionDraftIssue[];valid:boolean};
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
export function validQuestionDraftInput(v:unknown):v is QuestionDraftInput{
 return plainStudentInput(v,['questionType','raw'])&&QUESTION_DRAFT_TYPES.includes(v.questionType as QuestionDraftType)&&typeof v.raw==='string'&&v.raw.length>0&&v.raw.length<=65536;
}
export function validQuestionDraftResult(v:unknown,expected:QuestionDraftType):v is QuestionDraftResult{
 if(!plainStudentInput(v,['schemaVersion','requestId','ok','question','issues','valid'])||typeof v.valid!=='boolean'||!Array.isArray(v.issues)||v.issues.length>QUESTION_DRAFT_ISSUES.length||v.issues.some(i=>!QUESTION_DRAFT_ISSUES.includes(i))||new Set(v.issues).size!==v.issues.length||v.valid!==(v.issues.length===0))return false;
 if((v.schemaVersion!==undefined&&v.schemaVersion!==QUESTION_DRAFT_SCHEMA)||(v.ok!==undefined&&v.ok!==true)||(v.requestId!==undefined&&(typeof v.requestId!=='string'||!v.requestId||v.requestId.length>80)))return false;
 const q=v.question;
 if(!plainStudentInput(q,['questionType','stem','answer','analysis','options'])||q.questionType!==expected||!text(q.stem,12000)||!text(q.answer,8000)||!text(q.analysis,12000))return false;
 if(q.options!==null&&(!plainStudentInput(q.options,['A','B','C','D'])||Object.values(q.options).some(x=>!text(x,2000)||!String(x).trim())))return false;
 if(expected!=='choice'&&q.options!==null)return false;
 if(v.valid){if(!String(q.stem).trim()||!String(q.answer).trim()||!String(q.analysis).trim())return false;
  if(expected==='choice'&&(q.options===null||Object.keys(q.options).length!==4||!['A','B','C','D'].includes(String(q.answer))))return false;
  if(expected==='concept'&&!['true','false'].includes(String(q.answer)))return false;
  if(expected==='fill_in_blank'&&!String(q.stem).includes('____'))return false;
 }
 return true;
}
