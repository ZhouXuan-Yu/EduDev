import {randomUUID} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {OmniEduStore} from '../db';
import {MISTAKE_SIMILAR_SCHEMA} from '../../shared/mistake-similar';
import {MISTAKE_SIMILAR_TOOL,validMistakeSimilarToolInput} from '../../shared/mistake-similar-tool';
import {QUESTION_CONTEXT_SCHEMA} from '../../shared/question-context';
import {createStudentContextSanitizer} from '../students/context-sanitizer';
import {readQuestionContextSource} from './question-context-provider';
import {prepareQuestionAliases,type QuestionAliases} from './question-aliases';
import type {DeliveredLearningEvidence,ObservedLearningFacts} from './learning-provider';

export type ObservedMistakeLearning={facts:ObservedLearningFacts;delivered:DeliveredLearningEvidence};
type Options={store:OmniEduStore;sessionId:string;studentId:string;current:()=>boolean;observed:()=>ObservedMistakeLearning|undefined;aliases:QuestionAliases};
const errors:Record<string,string>={invalid_input:'请使用本轮已读取的学习证据编号和版本。',permission_denied:'当前学生对话已失效，未提供关联题。',source_changed:'学习证据或题目已变化，请重新读取学习证据后查询。',unsupported_record:'这条记录没有已确认的照片题目事实，请先在错题页核对保存。',too_large:'本次候选超过安全读取范围，请新一轮缩小任务后重试。',cancelled:'已停止查询关联题。',unavailable:'本地关联题暂时无法读取，请重试。'};
/** Read-only adapter inside the same Pi run. Discovery must still pass education_read_question. */
export function createMistakeSimilarProvider(options:Options):ToolDefinition[]{
 const {store,studentId,sessionId}=options;
 return[{name:MISTAKE_SIMILAR_TOOL,label:'查找错题关联原题',description:'使用本轮education_analyse_learning实际返回的学习证据reference与version，查找该已确认照片错题的本地关联原题，最多10道；同学科年级硬过滤并去重。只提供知识点/文字关联候选，不证明数学同类或答案正确。不能指定学生、记录ID或路径；不足不生成补题。返回的原题和候选用真实题目N/version交给education_read_question实读，比较完整条件后再选教学同类题并通过education_propose_practice等待教师核对。',
  parameters:{type:'object',additionalProperties:false,required:['reference','version'],properties:{reference:{type:'string',pattern:'^学习证据[1-9][0-9]{0,6}$'},version:{type:'string',pattern:'^[a-f0-9]{64}$'}}},
  async execute(_callId,args,signal){const abort=signal||new AbortController().signal,lease=()=>{abort.throwIfAborted();if(!options.current())throw Error('permission_denied');};
   try{
    lease();if(!validMistakeSimilarToolInput(args))throw Error('invalid_input');if(!studentId)throw Error('permission_denied');
    const proof=options.observed(),entry=proof?.delivered.get(args.reference);if(!proof||!entry||entry.version!==args.version)throw Error('source_changed');
    const authorize=async()=>{
     lease();const {session}=await store.getAiConversationSession(sessionId);lease();if(session.archivedAt||session.studentId!==studentId)throw Error('permission_denied');
     if(options.observed()!==proof)throw Error('source_changed');
     const after=await store.studentContext.learningSnapshot(studentId,proof.facts.subject?{subject:proof.facts.subject}:{});lease();
     if(after.fingerprint!==proof.facts.fingerprint||!after.records.some(r=>r.record.id===entry.recordId&&r.version===entry.version))throw Error('source_changed');
     const receipt=await store.mistakeFacts.forRecord(studentId,entry.recordId,abort);lease();if(!receipt)throw Error('unsupported_record');return receipt;
    };
    const receipt=await authorize(),value=await store.findMistakeSimilar({schemaVersion:MISTAKE_SIMILAR_SCHEMA,studentId,recordId:entry.recordId,receiptVersion:receipt.digest,requestId:randomUUID()},abort);lease();
    const root=(await readQuestionContextSource(store,receipt.question,abort)).question;lease();
    const clean=await createStudentContextSanitizer(store);lease();
    const rows=[{question:root,source:receipt.question,reasons:['已确认错题原题']},...value.items];
    const prepared=await Promise.all(rows.map(async row=>{const stem=await clean(row.question.stem);return{version:row.source.version,subject:await clean(row.question.subject),grade:await clean(row.question.grade),knowledgePoint:await clean(row.question.knowledgePoint),difficulty:row.question.difficulty,sourceTitle:await clean(row.question.sourceTitle),snippet:stem.slice(0,500),snippetTruncated:stem.length>500,reasons:row.reasons};}));lease();
    for(const row of rows){await readQuestionContextSource(store,row.source,abort);lease();}
    if((await authorize()).digest!==receipt.digest)throw Error('source_changed');lease();if(options.observed()!==proof)throw Error('source_changed');
    const aliases=prepareQuestionAliases(options.aliases,rows.map(row=>row.source)),publicRows=prepared.map((row,index)=>({...row,reference:aliases.references[index]}));
    const text=JSON.stringify({schemaVersion:MISTAKE_SIMILAR_SCHEMA,success:true,method:value.method,root:publicRows[0],questions:publicRows.slice(1),returned:value.items.length,requested:10,shortage:value.items.length<10,scanComplete:value.scanComplete,ranking:'knowledge_and_literal_cues_only',answerVerified:false,requiresFullQuestionRead:true,requiresTeacherReview:true});
    if(Buffer.byteLength(text,'utf8')>32000)throw Error('too_large');aliases.commit();
    return{content:[{type:'text',text}],details:{success:true,data:{sources:rows.map((row,index)=>({title:`${prepared[index].knowledgePoint||'本地题目'} · ${prepared[index].sourceTitle||'题库'}`,question:{schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:row.source.questionId,version:row.source.version}}))}}};
   }catch(e){const code=abort.aborted?'cancelled':(e as Error)?.message,safe=Object.prototype.hasOwnProperty.call(errors,code)?code:'unavailable';return{content:[{type:'text',text:JSON.stringify({success:false,code:safe,message:errors[safe]})}],isError:true,details:{success:false,error:{code:safe}}};}
  }
 }];
}
