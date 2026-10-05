import type {OmniEduStore} from '../db';
import {STUDENT_CONTEXT_SCHEMA,validStudentConversation,validStudentContextSource,type StudentContextSourceView} from '../../shared/student-context';
export async function createStudentConversation(store:OmniEduStore,input:unknown){
 if(!validStudentConversation(input))throw new Error('invalid_input');
 const {student}=await store.studentContext.snapshot(input.studentId);
 return store.createAiConversationSession({title:`${student.displayName} · 学习对话`,studentId:student.id});
}
export async function getStudentContextSource(store:OmniEduStore,input:unknown):Promise<StudentContextSourceView>{
 if(!validStudentContextSource(input))throw new Error('invalid_input');
 const {session}=await store.getAiConversationSession(input.sessionId);if(session.archivedAt||!session.studentId)throw new Error('permission_denied');
 const value=await store.studentContext.snapshot(session.studentId,{},input.recordId);
 const record=value.records[0];if(input.recordId? !record||record.version!==input.version : value.profileVersion!==input.version)throw new Error('source_changed');
 return {source:{...input,schemaVersion:STUDENT_CONTEXT_SCHEMA},student:value.student,...(input.recordId?{record:record.record}:{})};
}
