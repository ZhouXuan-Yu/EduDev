import {catalogId,mockExamDigest,mockExamRevision} from './mock-exam-compilation';
import {plainStudentInput} from './student-context';

export const MOCK_EXAM_OFFICE_SCHEMA='xiaozhi.mock-exam-office.v1';
export const READ_MOCK_EXAM_EXPORT='education_read_mock_exam_for_export';
export const EXPORT_MOCK_EXAM='education_export_mock_exam_catalog';
export const MOCK_EXAM_EXPORT_FORMATS=['docx','pdf'] as const;
export type MockExamExportFormat=typeof MOCK_EXAM_EXPORT_FORMATS[number];
export type MockExamOfficeSource={catalogId:string;revision:number;digest:string};
export type MockExamExportIntent=MockExamOfficeSource&{format:MockExamExportFormat};
export const mockExamExportFormat=(value:unknown):value is MockExamExportFormat=>value==='docx'||value==='pdf';

export function validMockExamOfficeSource(value:unknown):value is MockExamOfficeSource {
  return plainStudentInput(value,['catalogId','revision','digest'])&&catalogId(value.catalogId)&&
    mockExamRevision(value.revision)&&mockExamDigest(value.digest);
}

export function validMockExamExportIntent(value:unknown):value is MockExamExportIntent {
  return plainStudentInput(value,['catalogId','revision','digest','format'])&&catalogId(value.catalogId)&&
    mockExamRevision(value.revision)&&mockExamDigest(value.digest)&&mockExamExportFormat(value.format);
}
