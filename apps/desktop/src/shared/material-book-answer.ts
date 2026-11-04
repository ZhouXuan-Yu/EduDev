import type {AiIssue} from './material-ai';
export const MATERIAL_BOOK_ANSWER_SCHEMA='xiaozhi.material-book-answer-page.v1' as const;
export type BookAnswerIssue='missing_section'|'duplicate_number'|'missing_answer'|'missing_analysis'|'transcription_disagreement'|'page_uncertainty'|AiIssue;
export type BookAnswerPass={answer:string;analysis:string;quote:string};
export type BookAnswerEntry=BookAnswerPass&{section:string;sectionKey:string;number:string;start:number;end:number;first?:BookAnswerPass;agrees:boolean;issues:BookAnswerIssue[]};
export type BookAnswerPage={schemaVersion:typeof MATERIAL_BOOK_ANSWER_SCHEMA;policy:'section-number-two-pass.v1'|'section-number-two-pass.v2'|'section-number-inherited.v1';entries:BookAnswerEntry[];firstOnly:{section:string;number:string}[];status:'compared'|'unstructured'|'too_large';pageUncertain:boolean;sectionSource?:{page:number;section:string}};
/** Normalize layout only. Different exam/chapter words must never fuzzy-match. */
export const bookSectionKey=(text:string)=>text.normalize('NFKC').replace(/[\s·•]/gu,'');
export const bookAnswerIssueLabels:Record<BookAnswerIssue,string>={missing_section:'本页缺少所属试卷标题，不猜测上一页归属',duplicate_number:'同一试卷题号重复，不能唯一定位',missing_answer:'未找到明确答案',missing_analysis:'未找到明确解析',cross_page:'页尾内容可能跨页，需查看相邻页',transcription_disagreement:'两遍条目不一致或一遍遗漏',page_uncertainty:'原页转录仍有疑点，不能自动写回',uncertain_ocr:'本条原字仍有疑点，不能自动写回',requires_image:'本条需要核对图形，不能自动写回',incomplete_question:'本条原文不完整，不能自动写回',answer_conflict:'本条原答案存在冲突，不能自动写回'};
