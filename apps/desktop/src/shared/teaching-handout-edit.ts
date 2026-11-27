import type {HandoutExercise} from './teaching-handout';
import type {TeachingBookVersion} from './teaching-book-version';

export const READ_HANDOUT_EDIT='education_read_handout_for_edit';
export const PROPOSE_HANDOUT_EDIT='education_propose_handout_edit';
export const HANDOUT_EDIT_SCHEMA='xiaozhi.handout-edit.v1';

export type HandoutEditChange =
  | {kind:'chapter';chapterId:string;title?:string;objectives?:string[];summary?:string}
  | {kind:'paragraph';blockId:string;selectedText:string;replacement:string}
  | {kind:'exercise';blockId:string;difficulty?:HandoutExercise['difficulty'];prompt?:string;answer?:string;explanation?:string};
export type HandoutEditInput={bookId:string;digest:string;changes:HandoutEditChange[]};
export type HandoutEditDiff={location:string;field:string;before:string;after:string};
export type HandoutEditStatus='pending'|'applied'|'rejected'|'conflict'|'interrupted';
export type HandoutEditSummary={schemaVersion:typeof HANDOUT_EDIT_SCHEMA;id:string;bookId:string;title:string;callId:string;
  taskId:string;runId:string;state:HandoutEditStatus;count:number;fingerprint:string;version?:TeachingBookVersion};
export type HandoutEditReview={summary:HandoutEditSummary;diffs:HandoutEditDiff[]};
export type HandoutEditRequest={schemaVersion:typeof HANDOUT_EDIT_SCHEMA;sessionId:string;id:string};
export type HandoutEditDecision=HandoutEditRequest&{fingerprint:string;action:'approve'|'reject'};
export type HandoutEditResult<T>={ok:true;value:T}|{ok:false;error:string;message:string};

const text=(maxLength:number,minLength=1)=>({type:'string',minLength,maxLength});
const fields=(required:string[],properties:Record<string,object>)=>({type:'object',additionalProperties:false,required,properties});
const idSchema=(kind:string)=>({type:'string',pattern:'^teaching_'+kind+'_[a-f0-9-]{36}$'});
const objectivesSchema={type:'array',minItems:1,maxItems:6,items:text(240)};
export const handoutEditParameters=fields(['bookId','digest','changes'],{
  bookId:idSchema('book'),digest:{type:'string',pattern:'^[a-f0-9]{64}$'},changes:{type:'array',minItems:1,maxItems:6,items:{anyOf:[
    fields(['kind','chapterId'],{kind:{const:'chapter'},chapterId:idSchema('chapter'),title:text(160),objectives:objectivesSchema,summary:text(800,0)}),
    fields(['kind','blockId','selectedText','replacement'],{kind:{const:'paragraph'},blockId:idSchema('block'),selectedText:text(5000),replacement:text(5000,0)}),
    fields(['kind','blockId'],{kind:{const:'exercise'},blockId:idSchema('block'),difficulty:{enum:['基础','巩固','拓展']},
      prompt:text(900),answer:text(400),explanation:text(1000)}),
  ]}},
});
export const handoutEditReadParameters=fields([],{bookId:idSchema('book'),title:text(200),
  chapterId:idSchema('chapter'),blockId:idSchema('block')});
export const handoutEditId=(value:unknown):value is string=>typeof value==='string'&&/^xihedit_[a-f0-9-]{36}$/u.test(value);
export const handoutChapterId=(value:unknown):value is string=>typeof value==='string'&&/^teaching_chapter_[a-f0-9-]{36}$/u.test(value);
export const handoutBlockId=(value:unknown):value is string=>typeof value==='string'&&/^teaching_block_[a-f0-9-]{36}$/u.test(value);
export const handoutEditPatchReview=(reason:string)=>reason.match(/^对话审阅 (xihedit_[a-f0-9-]{36})$/u)?.[1];

export const handoutEditErrors:Record<string,string>={
  invalid_input:'请使用本轮读到的讲义、章节或练习，并指定准确的修改内容。',
  book_selection_required:'当前任务尚未绑定要修改的讲义。请询问老师要修改的完整书名和具体改动。',
  book_unavailable:'本会话没有找到这份可编辑讲义。请从原对话打开它。',
  ambiguous:'找到多份讲义，请老师选择要修改的讲义。',
  source_required:'请先读取老师指定的章节和当前正文版本。',
  source_changed:'讲义引用的资料已变化，请核对后重新发起修改。',
  version_conflict:'讲义或本轮要求已变化。请重新读取当前正文后再修改。',
  selection_conflict:'选区不存在或出现多次，请扩大选区以唯一定位。',
  exercise_unavailable:'未找到唯一对应的练习和答案，请在讲义编辑器核对这道题。',
  no_change:'拟修改内容与原文相同。',
  unsupported_math:'拟修改内容含无法排版的数学公式，请修正公式。',
  exercise_scope:'请只提交老师指定的练习。若题号重复或范围不清，请老师确认讲义及具体位置。',
  scope_conflict:'多项修改同时指向同一个内容块，请合并成一项。',
  review_exists:'本轮已有一份审阅记录，请根据原决定结束本轮。',
  permission_denied:'当前窗口或会话无法处理这个讲义建议。',
  configuration:'讲义修改状态暂时无法读取，请刷新后重试。',
};
