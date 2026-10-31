export const MATERIAL_BOOK_ANSWER_SCHEMA='xiaozhi.material-book-answer-page.v1' as const;
export type BookAnswerIssue='missing_section'|'duplicate_number'|'missing_answer'|'missing_analysis'|'cross_page'|'transcription_disagreement'|'page_uncertainty';
export type BookAnswerPass={answer:string;analysis:string;quote:string};
export type BookAnswerEntry=BookAnswerPass&{section:string;sectionKey:string;number:string;start:number;end:number;first?:BookAnswerPass;agrees:boolean;issues:BookAnswerIssue[]};
export type BookAnswerPage={schemaVersion:typeof MATERIAL_BOOK_ANSWER_SCHEMA;policy:'section-number-two-pass.v1';entries:BookAnswerEntry[];firstOnly:{section:string;number:string}[];status:'compared'|'unstructured'|'too_large';pageUncertain:boolean};
export const bookAnswerIssueLabels:Record<BookAnswerIssue,string>={missing_section:'本页缺少所属试卷标题，不猜测上一页归属',duplicate_number:'同一试卷题号重复，不能唯一定位',missing_answer:'未找到明确答案',missing_analysis:'未找到明确解析',cross_page:'页尾内容可能跨页，需查看相邻页',transcription_disagreement:'两遍条目不一致或一遍遗漏',page_uncertainty:'原页转录仍有疑点，不能自动写回'};
