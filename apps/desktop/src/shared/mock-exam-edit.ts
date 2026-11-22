import type {MockExamCatalogRef,MockExamMetadata} from './mock-exam-compilation';

export const MOCK_EXAM_EDIT_SCHEMA='xiaozhi.mock-exam-edit.v1';
export const READ_MOCK_EXAM_EDIT='education_read_mock_exam_for_edit';
export const PROPOSE_MOCK_EXAM_EDIT='education_propose_mock_exam_edit';
export const MOCK_EXAM_EDIT_LIMIT=6;

export type MockExamPatch=Partial<MockExamMetadata>&{resourceId:string;include?:boolean};
export type MockExamEditInput={catalogId:string;revision:number;digest:string;changes:MockExamPatch[]};
export type MockExamEditDiff={resourceId:string;title:string;fields:{name:keyof MockExamMetadata|'include';before:string|number|boolean|null;after:string|number|boolean|null}[]};
export type MockExamEditStatus='pending'|'applied'|'rejected'|'conflict'|'interrupted';
export type MockExamEditSummary={id:string;catalogId:string;title:string;runId:string;revision:number;fingerprint:string;count:number;
  state:MockExamEditStatus;appliedRevision?:number};
export type MockExamEditReview={summary:MockExamEditSummary;diffs:MockExamEditDiff[]};
export type MockExamEditKey=MockExamCatalogRef&{schemaVersion:typeof MOCK_EXAM_EDIT_SCHEMA};
export type MockExamEditDecision=MockExamEditKey&{fingerprint:string;action:'approve'|'reject'};

export const mockExamEditId=(value:unknown):value is string=>typeof value==='string'&&/^mock_edit_[a-f0-9-]{36}$/u.test(value);
