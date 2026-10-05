import type {LearningRecord, Student} from './contracts';
export const STUDENT_CONTEXT_SCHEMA='xiaozhi.education.student-context.v1' as const;
export const STUDENT_CONTEXT_PAGE_SIZE=10;
export type StudentConversationInput={schemaVersion:typeof STUDENT_CONTEXT_SCHEMA;studentId:string};
export type StudentContextQuery={offset?:number;type?:string;subject?:string;keyword?:string};
export type StudentContextSource={schemaVersion:typeof STUDENT_CONTEXT_SCHEMA;sessionId:string;version:string;recordId?:string};
export type StudentContextSourceView={source:StudentContextSource;student:Student;record?:Omit<LearningRecord,'attachments'>};
export type StudentContextSelection={id:string;label:string;status:'active'|'archived'|'missing'};
/** Validate descriptors before reading them: IPC and tool inputs never invoke accessors. */
export function plainStudentInput(value:unknown,keys:string[]):value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 return Reflect.ownKeys(value).every(key=>typeof key==='string'&&keys.includes(key)&&'value' in Object.getOwnPropertyDescriptor(value,key)!);
}
export const validStudentId=(value:unknown):value is string=>typeof value==='string'&&/^student_[a-f0-9-]{36}$/i.test(value);
export function validStudentConversation(value:unknown):value is StudentConversationInput{
 return plainStudentInput(value,['schemaVersion','studentId'])&&value.schemaVersion===STUDENT_CONTEXT_SCHEMA&&validStudentId(value.studentId);
}
export function validStudentContextQuery(value:unknown):value is StudentContextQuery{
 if(!plainStudentInput(value,['offset','type','subject','keyword']))return false;
 return (value.offset===undefined||Number.isSafeInteger(value.offset)&&Number(value.offset)>=0&&Number(value.offset)<=1000000)
  &&['type','subject','keyword'].every(key=>value[key]===undefined||typeof value[key]==='string'&&String(value[key]).trim().length>0&&String(value[key]).length<=128&&!/[\x00-\x1f]/.test(String(value[key])));
}
export function validStudentContextSource(value:unknown):value is StudentContextSource{
 return plainStudentInput(value,['schemaVersion','sessionId','version','recordId'])&&value.schemaVersion===STUDENT_CONTEXT_SCHEMA
  &&typeof value.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(value.sessionId)&&typeof value.version==='string'&&/^[a-f0-9]{64}$/.test(value.version)
  &&(value.recordId===undefined||typeof value.recordId==='string'&&/^record_[a-f0-9-]{36}$/i.test(value.recordId));
}
