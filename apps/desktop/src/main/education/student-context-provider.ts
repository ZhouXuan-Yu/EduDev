import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {OmniEduStore} from '../db';
import {createStudentContextSanitizer} from '../students/context-sanitizer';
import {STUDENT_CONTEXT_SCHEMA,validStudentContextQuery,type StudentContextSource} from '../../shared/student-context';
/** Read selected SQLite facts through Pi; no student selector or education loop. */
export function createStudentContextProvider(store:OmniEduStore,sessionId:string,studentId:string,isCurrent:()=>boolean):ToolDefinition[]{
 const current=(signal:AbortSignal)=>{signal.throwIfAborted();if(!isCurrent())throw new Error('permission_denied');};
 return [{name:'education_read_student_context',label:'读取当前学生学习记录',description:'只读教师为本对话选定学生的真实档案和学习记录，匿名返回年级/科目/目标/当前问题与最近10条记录。可按type/subject/keyword筛选及offset翻页；type使用实际保存值，常用错题mistake、试卷或测验exam、课堂class、作业homework、沟通communication、阶段总结summary。total为筛选匹配数，totalRecords为该学生全部记录数。错题或成绩只按记录正文报告，不推测成绩、掌握度或教师确认状态。不能自行选择学生、读取图片/附件/学校/家长私密字段。',
  parameters:{type:'object',additionalProperties:false,properties:{offset:{type:'integer',minimum:0,maximum:1000000},type:{type:'string',maxLength:128},subject:{type:'string',maxLength:128},keyword:{type:'string',maxLength:128}}}as ToolDefinition['parameters'],
  execute:async(_callId,args,signal)=>{
   const abort=signal||new AbortController().signal;
   try{
    current(abort);if(!validStudentContextQuery(args))throw new Error('invalid_input');
    if(!studentId)throw new Error('no_student');
    const authorize=async()=>{const {session}=await store.getAiConversationSession(sessionId);current(abort);if(session.archivedAt||session.studentId!==studentId)throw new Error('permission_denied');};
    await authorize();const facts=await store.studentContext.snapshot(studentId,args);current(abort);
    const clean=await createStudentContextSanitizer(store);current(abort);
    if([facts.student.grade,...facts.student.subjects,facts.student.goals,facts.student.currentIssues].some(text=>text.length>2000)||facts.records.some(({record:r})=>[r.title,r.content,r.summary].some(text=>(text||'').length>8000)))throw new Error('too_large');
    const profile={student:'当前学生',grade:await clean(facts.student.grade),subjects:await Promise.all(facts.student.subjects.map(clean)),goals:await clean(facts.student.goals),currentIssues:await clean(facts.student.currentIssues)};
    const records=await Promise.all(facts.records.map(async({record:r},index)=>({reference:`学习记录${facts.offset+index+1}`,type:await clean(r.recordType),subject:await clean(r.subject),title:await clean(r.title),content:await clean(r.content),summary:await clean(r.summary),occurredAt:r.occurredAt,confirmationProvenance:'not_verified_by_host'})));
    const observedAt=new Date().toISOString(),payload={schemaVersion:STUDENT_CONTEXT_SCHEMA,success:true,profile,records,total:facts.total,totalRecords:facts.totalRecords,offset:facts.offset,nextOffset:facts.nextOffset,observedAt,confirmationState:'not_recorded',scope:'selected_student_saved_records'};
    const text=JSON.stringify(payload);if(Buffer.byteLength(text,'utf8')>65536)throw new Error('too_large');
    current(abort);await authorize();const after=await store.studentContext.snapshot(studentId,args);current(abort);if(after.fingerprint!==facts.fingerprint)throw new Error('source_changed');await authorize();
    const source=(version:string,recordId?:string):StudentContextSource=>({schemaVersion:STUDENT_CONTEXT_SCHEMA,sessionId,version,...(recordId?{recordId}:{})});
    return {content:[{type:'text',text}],details:{success:true,data:{sources:[{title:'当前学生 · 档案',student:source(facts.profileVersion)},...facts.records.map((r,index)=>({title:`学习记录${facts.offset+index+1} · ${records[index].title}`,student:source(r.version,r.record.id)}))]}}};
   }catch(error){
    const messages:Record<string,string>={invalid_input:'记录查询条件不正确，请调整后重试。',no_student:'本对话尚未选择学生。请教师从学生档案发起学习对话。',student_unavailable:'学生不存在或已经归档，未提供学习事实。',permission_denied:'当前学生范围或任务已失效，未提供学习事实。',cancelled:'已停止读取学生记录。',source_changed:'学生记录已变化，请重新读取后再分析。',too_large:'必要记录超过本次读取范围，请按科目或关键词缩小范围，或先拆分过长记录。',unavailable:'学生记录暂时无法读取，请重试。'};
    const code=abort.aborted?'cancelled':(error as Error).message,safe=messages[code]?code:'unavailable';return {content:[{type:'text',text:messages[safe]}],isError:true,details:{success:false,error:{code:safe,message:messages[safe]}}};
   }
  }}];
}
