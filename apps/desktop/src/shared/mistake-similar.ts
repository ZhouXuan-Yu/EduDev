import type {QuestionBankItem} from './contracts';
import type {QuestionContextSource} from './question-context';
import {plainStudentInput,validStudentId} from './student-context';

export const MISTAKE_SIMILAR_SCHEMA='xiaozhi.mistake-similar.v1' as const;
export type MistakeSimilarInput={schemaVersion:typeof MISTAKE_SIMILAR_SCHEMA;studentId:string;recordId:string;receiptVersion:string;requestId:string};
export type MistakeSimilarItem={source:QuestionContextSource;question:QuestionBankItem;reasons:string[]};
export type MistakeSimilarView={schemaVersion:typeof MISTAKE_SIMILAR_SCHEMA;receiptVersion:string;method:'local_knowledge_keyword_v1';items:MistakeSimilarItem[];requested:10;scanned:number;scanComplete:true;excluded:{unsupported:number;missingAnswer:number;sourceUnavailable:number;rootOrDuplicate:number};answerVerified:false};
export const MISTAKE_SIMILAR_ERRORS={invalid_input:'查询条件不正确，请重新打开错题。',permission_denied:'此错题不属于当前有效学生，未提供题目。',source_changed:'错题、照片或候选原题已经变化，请重新核对后查询。',cancelled:'已停止查询本地关联题。',timeout:'查询超时，请稍后重试。',busy:'已有查询正在进行，请稍后重试。',unavailable:'本地关联题暂时无法读取，请重试。'} as const;
export type MistakeSimilarResult={ok:true;value:MistakeSimilarView}|{ok:false;error:keyof typeof MISTAKE_SIMILAR_ERRORS};
export function validMistakeSimilarInput(v:unknown):v is MistakeSimilarInput{
 return plainStudentInput(v,['schemaVersion','studentId','recordId','receiptVersion','requestId'])&&v.schemaVersion===MISTAKE_SIMILAR_SCHEMA&&validStudentId(v.studentId)
  &&typeof v.recordId==='string'&&/^record_[a-f0-9-]{36}$/i.test(v.recordId)&&typeof v.receiptVersion==='string'&&/^[a-f0-9]{64}$/.test(v.receiptVersion)
  &&typeof v.requestId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v.requestId);
}
