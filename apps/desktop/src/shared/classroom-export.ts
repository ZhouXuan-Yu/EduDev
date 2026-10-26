import {validClassroomContext,type ClassroomContext} from './classroom-context';
import {validClassroom,type ClassroomDocument} from './classroom';
export const CLASSROOM_OFFICE_SCHEMA='xiaozhi.classroom-office.v1' as const;
export const CLASSROOM_DOCUMENT_OFFICE_SCHEMA='xiaozhi.classroom-document-office.v1' as const;
export type ClassroomDocumentPurpose='handout'|'teacher_notes';
export const CLASSROOM_EXPORT_TOOL='education_export_classroom' as const;
export const CLASSROOM_READ_TOOL='education_read_classroom' as const;
export const CLASSROOM_EXPORT_TOOLS=[CLASSROOM_READ_TOOL,CLASSROOM_EXPORT_TOOL] as const;
export type ClassroomOfficeSource={classroomId:string;version:string;revision:number;includeAnswers:boolean;document:ClassroomDocument;context?:ClassroomContext;purpose?:ClassroomDocumentPurpose};
export const isClassroomOfficeSchema=(value:unknown)=>value===CLASSROOM_OFFICE_SCHEMA||value===CLASSROOM_DOCUMENT_OFFICE_SCHEMA;
export const validClassroomOfficeFormat=(schema:unknown,format:unknown)=>schema===CLASSROOM_OFFICE_SCHEMA?format==='pptx':schema===CLASSROOM_DOCUMENT_OFFICE_SCHEMA&&(format==='docx'||format==='pdf');
export function validClassroomOfficeSource(value:unknown):value is ClassroomOfficeSource{
 const v=value as ClassroomOfficeSource;
 return !!v&&typeof v==='object'&&Object.keys(v).every(k=>['classroomId','version','revision','includeAnswers','document','context','purpose'].includes(k))&&typeof v.classroomId==='string'&&/^classroom_[a-f0-9-]{36}$/.test(v.classroomId)&&typeof v.version==='string'&&/^[a-f0-9]{64}$/.test(v.version)&&Number.isSafeInteger(v.revision)&&v.revision>0&&typeof v.includeAnswers==='boolean'&&validClassroom(v.document)&&(v.context===undefined||validClassroomContext(v.context))&&(v.purpose===undefined||v.purpose==='handout'&&!v.includeAnswers||v.purpose==='teacher_notes'&&v.includeAnswers);
}
