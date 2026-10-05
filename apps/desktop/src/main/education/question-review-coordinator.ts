import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {OmniEduStore} from '../db';
import {plainStudentInput} from '../../shared/student-context';
import {QUESTION_DRAFT_TYPES} from '../../shared/question-draft';
import type {QuestionContextSource} from '../../shared/question-context';
import {QUESTION_REVIEW_TOOL,QUESTION_REVIEW_ERRORS,validQuestionReview,validQuestionReviewDraft,type QuestionReviewDraft,type QuestionReviewInput,type QuestionReviewDecision,type QuestionReviewResult,type QuestionReviewView,type QuestionReviewSummary,type QuestionReviewError} from '../../shared/question-review';
import {validateQuestionReviewFormat} from './question-review-repository';
import {createStudentContextSanitizer} from '../students/context-sanitizer';
type Options={store:OmniEduStore;isCurrent:(sessionId:string,runId:string)=>boolean;canDecide:(sessionId:string,runId:string)=>boolean;emit:(sessionId:string,runId:string,value:QuestionReviewSummary)=>void;afterWrite?:(current:()=>boolean)=>Promise<void>};
export function createQuestionReviewCoordinator(options:Options){
 const waits=new Map<string,{runId:string;finish:()=>void}>();
 const failure=(e:unknown):QuestionReviewError=>{const code=(e as Error)?.message;return Object.prototype.hasOwnProperty.call(QUESTION_REVIEW_ERRORS,code)?code as QuestionReviewError:'unavailable';};
 const publish=async(sessionId:string,id:string)=>{const row=(await options.store.questionReviews.list(sessionId)).find(r=>r.id===id);if(!row)throw new Error('permission_denied');options.emit(sessionId,row.runId,row);return row;};
 return{
  async review(input:QuestionReviewInput):Promise<QuestionReviewResult<QuestionReviewView>>{if(!validQuestionReview(input))return{ok:false,error:'invalid_input'};try{return{ok:true,value:await options.store.questionReviews.review(input.sessionId,input.id)};}catch(e){return{ok:false,error:failure(e)};}},
  async decide(input:QuestionReviewDecision,lease:()=>boolean=()=>true):Promise<QuestionReviewResult<QuestionReviewSummary>>{
   if(!validQuestionReview(input,true))return{ok:false,error:'invalid_input'};
   try{const row=(await options.store.questionReviews.list(input.sessionId)).find(r=>r.id===input.id);if(!row)throw new Error('permission_denied');const value=await options.store.questionReviews.decide(input,()=>lease()&&options.canDecide(input.sessionId,row.runId),options.afterWrite);options.emit(input.sessionId,value.runId,value);waits.get(value.id)?.finish();return{ok:true,value};}catch(e){return{ok:false,error:failure(e)};}
  },
  cancel(runId:string){for(const wait of waits.values())if(wait.runId===runId)wait.finish();},
  tools(sessionId:string,runId:string,observed:Map<string,QuestionContextSource>):ToolDefinition[]{return[{name:QUESTION_REVIEW_TOOL,label:'请教师核对题目',description:'根据本轮已成功 education_read_question 实读的题目起草变式题，sourceReferences 使用实际题目N别名。title/reason/subject/grade/knowledgePoint 和 items 必填；items 每题包含 questionType、stem、answer、analysis、options（非选择题 null，选择题 A–D）、difficulty easy/medium/hard。六种题型 choice/concept/fill_in_blank/short_answer/written/coding；概念判断答案 true/false，填空题 ____，选择题答案 A/B/C/D。内容必须自足，教师可编辑后确认或拒绝，本工具等待其决定；未经确认不保存，不自行声称答案正确或学生已练习。拒绝、停止后不自动重复提交。',
   parameters:{type:'object',additionalProperties:false,required:['sourceReferences','title','reason','subject','grade','knowledgePoint','items'],properties:{sourceReferences:{type:'array',minItems:1,maxItems:8,uniqueItems:true,items:{type:'string',pattern:'^题目[1-9][0-9]{0,2}$'}},title:{type:'string',minLength:1,maxLength:160},reason:{type:'string',minLength:1,maxLength:1000},subject:{type:'string',maxLength:128},grade:{type:'string',maxLength:128},knowledgePoint:{type:'string',maxLength:128},items:{type:'array',minItems:1,maxItems:8,items:{type:'object',additionalProperties:false,required:['questionType','stem','answer','analysis','options','difficulty'],properties:{questionType:{type:'string',enum:[...QUESTION_DRAFT_TYPES]},stem:{type:'string',maxLength:12000},answer:{type:'string',maxLength:8000},analysis:{type:'string',maxLength:12000},options:{anyOf:[{type:'null'},{type:'object',additionalProperties:false,properties:{A:{type:'string',maxLength:2000},B:{type:'string',maxLength:2000},C:{type:'string',maxLength:2000},D:{type:'string',maxLength:2000}}}]},difficulty:{type:'string',enum:['easy','medium','hard']}}}}}} as ToolDefinition['parameters'],
   execute:async(callId,raw,signal)=>{
    const abort=signal||new AbortController().signal,current=()=>!abort.aborted&&options.isCurrent(sessionId,runId);
    try{abort.throwIfAborted();if(!current())throw new Error('cancelled');
     if(!plainStudentInput(raw,['sourceReferences','title','reason','subject','grade','knowledgePoint','items']))throw new Error('invalid_input');
     const {sourceReferences,...fields}=raw;if(!Array.isArray(sourceReferences)||sourceReferences.length<1||sourceReferences.length>8||new Set(sourceReferences).size!==sourceReferences.length||sourceReferences.some(r=>typeof r!=='string'||!observed.has(r))||!validQuestionReviewDraft(fields))throw new Error('invalid_input');
     const normalized=await validateQuestionReviewFormat(fields,abort),draft:QuestionReviewDraft={...fields,items:normalized.map((r,i)=>({...r.question,difficulty:fields.items[i].difficulty}))};
     abort.throwIfAborted();const pending=await options.store.questionReviews.propose(sessionId,runId,callId,draft,sourceReferences.map(r=>observed.get(r)!),current);
     if(pending.state==='pending')await new Promise<void>(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;waits.delete(pending.id);abort.removeEventListener('abort',finish);resolve();};waits.set(pending.id,{runId,finish});abort.addEventListener('abort',finish,{once:true});if(!current())finish();else void publish(sessionId,pending.id).catch(finish);});
     abort.throwIfAborted();if(!current())throw new Error('cancelled');const result=await publish(sessionId,pending.id),confirmed=result.state==='confirmed';
     // No teacher edits/private local provenance are returned automatically to the cloud.
     const final=confirmed?(await options.store.questionReviews.review(sessionId,pending.id)).draft:draft;
     const clean=await createStudentContextSanitizer(options.store),title=await clean(final.title),knowledgePoint=await clean(final.knowledgePoint);
     abort.throwIfAborted();if(!current())throw new Error('cancelled');
     return{content:[{type:'text',text:JSON.stringify({success:confirmed,state:result.state,count:result.count,title,knowledgePoint,message:confirmed?'教师已编辑核对并保存题目。title和knowledgePoint是脱敏后的最终检索线索，原候选可能已修改；请重新检索、读取新题后报告最终答案。未创建练习集合，也没有学生真实作答。':'教师拒绝，题目未保存；不要再次自动提交。'})}],details:{success:confirmed},isError:!confirmed};
    }catch(e){if(abort.aborted)throw new Error('cancelled');const code=failure(e);return{content:[{type:'text',text:JSON.stringify({success:false,code,message:QUESTION_REVIEW_ERRORS[code],submittedForTeacherReview:false})}],details:{success:false,error:{code}},isError:true};}
   }
  }];}
 };
}
