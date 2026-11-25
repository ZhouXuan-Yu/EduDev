import {plainStudentInput} from './student-context';
import {aiBatchId} from './material-ai';
export const QUESTION_BOOK_ARCHIVE_SCHEMA='xiaozhi.question-archive.v6' as const;
export const QUESTION_BOOK_EVIDENCE_SCHEMA='xiaozhi.question-book-evidence.v1' as const;
export const MATERIAL_BOOK_MATCH_SCHEMA='xiaozhi.material-book-match.v1' as const;
export const STRUCTURE_BOOK_MATCH_SCHEMA='xiaozhi.material-structure-book-match.v1' as const;
export type BookRoleProof={candidateId:string;questionSha:string;textSha:string;title:string;page:number;section:string;number:string};
export type QuestionBookEvidence={schemaVersion:typeof QUESTION_BOOK_EVIDENCE_SCHEMA;roles:Partial<Record<'answer'|'analysis',BookRoleProof>>};
export type BookMatchQuery={schemaVersion:typeof MATERIAL_BOOK_MATCH_SCHEMA;batchId:string;ordinal:number;revision:number};
export type StructureBookMatchQuery={schemaVersion:typeof STRUCTURE_BOOK_MATCH_SCHEMA;questionId:string;version:string};
export type AnyBookMatchQuery=BookMatchQuery|StructureBookMatchQuery;
export type BookMatchRow={id:string;questionId:string;number:string;section:string;state:'applied'|'held'|'conflict';reason:string;answer:string;analysis:string;beforeVersion:string;afterVersion:string;source?:{batchId:string;ordinal:number;start:number;page:number;title:string;sectionPage?:number}};
export type BookMatchView={schemaVersion:typeof MATERIAL_BOOK_MATCH_SCHEMA;rows:BookMatchRow[];indexPending:boolean;automaticPending:boolean;automaticError:string};
const sha=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>plainStudentInput(v,keys)&&Object.keys(v).length===keys.length;
export function validQuestionBookEvidence(v:unknown):v is QuestionBookEvidence{
 if(!exact(v,['schemaVersion','roles'])||v.schemaVersion!==QUESTION_BOOK_EVIDENCE_SCHEMA||!plainStudentInput(v.roles,['answer','analysis']))return false;
 return Object.values(v.roles).every(p=>exact(p,['candidateId','questionSha','textSha','title','page','section','number'])&&typeof p.candidateId==='string'&&/^bookanswer_[a-f0-9-]{36}$/.test(p.candidateId)&&sha(p.questionSha)&&sha(p.textSha)&&typeof p.title==='string'&&p.title.length>0&&p.title.length<=256&&Number.isSafeInteger(p.page)&&Number(p.page)>0&&Number(p.page)<=10000&&typeof p.section==='string'&&p.section.length>0&&p.section.length<=200&&typeof p.number==='string'&&/^\d{1,5}$/.test(p.number));
}
export function validBookMatchQuery(v:unknown):v is BookMatchQuery{return exact(v,['schemaVersion','batchId','ordinal','revision'])&&v.schemaVersion===MATERIAL_BOOK_MATCH_SCHEMA&&aiBatchId(v.batchId)&&Number.isSafeInteger(v.ordinal)&&Number(v.ordinal)>0&&Number(v.ordinal)<=100&&Number.isSafeInteger(v.revision)&&Number(v.revision)>0&&Number(v.revision)<Number.MAX_SAFE_INTEGER;}
export function validStructureBookMatchQuery(v:unknown):v is StructureBookMatchQuery{
 return exact(v,['schemaVersion','questionId','version'])&&v.schemaVersion===STRUCTURE_BOOK_MATCH_SCHEMA&&typeof v.questionId==='string'&&/^question_[a-f0-9-]{36}$/i.test(v.questionId)&&sha(v.version);
}
export function validAnyBookMatchQuery(v:unknown):v is AnyBookMatchQuery{return validBookMatchQuery(v)||validStructureBookMatchQuery(v);}
export const bookMatchReasons:Record<string,string>={index_pending:'答案目录正在后台建立，请稍后重试',missing_section:'本页题目缺少可唯一定位的试卷标题',answer_not_found:'尚未找到同一试卷及题号的答案，请先整理答案册',ambiguous_answer:'找到多个答案，不能唯一匹配',question_unchecked:'题面仍有疑点，已保留已知答案供核对',answer_unchecked:'答案原页或条目仍有疑点，未覆盖题目',choice_range_unchecked:'需核对原卷的单选题范围和选项，答案暂未写入',existing_answer_conflict:'已知答案与当前答案冲突，保留两份',protected_analysis_mismatch:'已有解析与答案册文本需要一并核对，保留待核候选',protected_role:'原资料或教师提供的内容受到保护',source_changed:'原件、题目或关联已变化，请刷新',unsupported:'匹配需要有原页凭据的完整题面',no_change:'没有可以补齐或升级的答案解析',teacher_changed:'应用后题目又被修改，未重新覆盖'};
