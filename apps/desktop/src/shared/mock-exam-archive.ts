import {catalogId,mockExamDigest,mockExamRevision} from './mock-exam-compilation';
import {plainStudentInput} from './student-context';

export const MOCK_EXAM_ARCHIVE_SCHEMA='xiaozhi.mock-exam-archive.v1';
export const MOCK_EXAM_ARCHIVE_MAX_BYTES=64*1024*1024;
export type MockExamArchiveRequest={schemaVersion:typeof MOCK_EXAM_ARCHIVE_SCHEMA;sessionId:string;catalogId:string;revision:number;digest:string};
export type MockExamArchiveConfirm=MockExamArchiveRequest&{previewDigest:string};
export type SavedMockExamArchive={artifactId:string;fileName:string;fileSize:number;sha256:string};
export type MockExamArchiveOmission='not_selected'|'permission_unknown'|'permission_denied'|'unsupported'|'paper_omitted'|'answer_missing'|'answer_stale'|'answer_embedded';
export type MockExamArchiveItem={title:string;resourceId?:string;sha256?:string;path?:string;shared?:true;omission?:MockExamArchiveOmission};
export type MockExamArchivePreview={
  schemaVersion:typeof MOCK_EXAM_ARCHIVE_SCHEMA;catalogId:string;revision:number;digest:string;title:string;previewDigest:string;
  entries:{district:string;round:string;paper:MockExamArchiveItem;answer:MockExamArchiveItem}[];
  paperCount:number;answerCount:number;embeddedCount:number;
};
export const mockExamArchiveOmissions:Record<MockExamArchiveOmission,string>={
  not_selected:'未收录到目录',permission_unknown:'本地使用许可待核对',permission_denied:'未允许本地打包',
  unsupported:'此原件格式暂不支持打包',paper_omitted:'对应试卷未入包',answer_missing:'缺答案',
  answer_stale:'答案册配对已过期',answer_embedded:'卷内答案随试卷原样保留',
};
export function validMockExamArchiveRequest(value:unknown,confirm?:false):value is MockExamArchiveRequest;
export function validMockExamArchiveRequest(value:unknown,confirm:true):value is MockExamArchiveConfirm;
export function validMockExamArchiveRequest(value:unknown,confirm=false):value is MockExamArchiveConfirm {
  return plainStudentInput(value,['schemaVersion','sessionId','catalogId','revision','digest',...(confirm?['previewDigest']:[])])&&
    value.schemaVersion===MOCK_EXAM_ARCHIVE_SCHEMA&&typeof value.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/u.test(value.sessionId)&&
    catalogId(value.catalogId)&&mockExamRevision(value.revision)&&mockExamDigest(value.digest)&&(!confirm||mockExamDigest(value.previewDigest));
}
