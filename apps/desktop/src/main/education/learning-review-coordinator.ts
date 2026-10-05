import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {OmniEduStore} from '../db';
import type {StudentContextRepository} from '../students/context-repository';
import {resolveTrainingPlan} from './training-plan';
import {collectLearningEvidence} from './learning-evidence';
import {LEARNING_REVIEW_ERRORS,validLearningDraft,validLearningReview,type LearningReviewInput,type LearningReviewDecision,type LearningReviewResult,type LearningReviewView,type LearningReviewSummary,type LearningReviewError} from '../../shared/learning-review';
import {plainStudentInput} from '../../shared/student-context';
import {validLearningGradeInput} from '../../shared/student-learning';
import {gradeLearningAnswer} from './learning-host';
import {validLearningHistory,type LearningHistoryInput,type LearningHistoryPage} from '../../shared/learning-review';
type Snapshot=Awaited<ReturnType<StudentContextRepository['learningSnapshot']>>&{reviewVersion:number};
/** Same Pi tool wait, same confirmation store; only an explicit teacher action commits an annotation. */
export function createLearningReviewCoordinator(options:{store:OmniEduStore;isCurrent:(sessionId:string,runId:string)=>boolean;canDecide:(sessionId:string,runId:string)=>boolean;emit:(sessionId:string,runId:string,value:LearningReviewSummary)=>void;afterWrite?:(isCurrent:()=>boolean)=>Promise<void>}){
 const waits=new Map<string,{sessionId:string;runId:string;finish:()=>void}>();
 const failure=(error:unknown):LearningReviewError=>{const code=(error as Error)?.message;return Object.prototype.hasOwnProperty.call(LEARNING_REVIEW_ERRORS,code)?code as LearningReviewError:'unavailable';};
 const publish=async(sessionId:string,id:string)=>{const item=(await options.store.learningReviews.list(sessionId)).find(e=>e.id===id);if(!item)throw new Error('permission_denied');options.emit(sessionId,item.runId,item);return item;};
 return{
  async history(raw:LearningHistoryInput):Promise<LearningReviewResult<LearningHistoryPage>>{if(!validLearningHistory(raw))return{ok:false,error:'invalid_input'};try{return{ok:true,value:await options.store.learningReviews.history(raw)};}catch(error){return{ok:false,error:failure(error)};}},
  async review(raw:LearningReviewInput):Promise<LearningReviewResult<LearningReviewView>>{if(!validLearningReview(raw))return{ok:false,error:'invalid_input'};try{return{ok:true,value:await options.store.learningReviews.review(raw.sessionId,raw.id)};}catch(error){return{ok:false,error:failure(error)};}},
  async decide(raw:LearningReviewDecision,lease:()=>boolean=()=>true):Promise<LearningReviewResult<LearningReviewSummary>>{
   if(!validLearningReview(raw,true))return{ok:false,error:'invalid_input'};
   try{const row=(await options.store.learningReviews.list(raw.sessionId)).find(e=>e.id===raw.id);if(!row)throw new Error('permission_denied');
    const value=await options.store.learningReviews.decide(raw,()=>lease()&&options.canDecide(raw.sessionId,row.runId),options.afterWrite);options.emit(raw.sessionId,value.runId,value);waits.get(raw.id)?.finish();return{ok:true,value};
   }catch(error){return{ok:false,error:failure(error)};}
  },
  cancel(runId:string){for(const [,waiting]of waits)if(waiting.runId===runId)waiting.finish();},
  tools(sessionId:string,runId:string,observed:()=>Snapshot|undefined):ToolDefinition[]{return[{name:'education_propose_learning_change',label:'请教师核对学习建议',description:'需要接下来两周训练时，strategy附plan：title、startDate（YYYY-MM-DD）、days恰好14天按day=1..14排列；每项pointReference只能使用刚读取的知识点N，休息为null；activity为review/practice/reflection/rest，count为1..20（休息0），difficulty为warmup/standard/challenge，notes为1..300字。依据已读取的真实风险、到期顺序和证据不足安排，不能编造题目来源、未来成绩或把计划当完成。宿主固定知识点目录；教师可以改安排并保存版本。先使用education_analyse_learning实读证据，再提出需要教师核对的学习结果校正或复习保留率策略。assessment提供本次读取的sourceReference（学习证据N）和correction正确/错误/部分正确、粗粒度errorType及feedback；strategy只提供desiredRetention 0.7至0.99。两类都附reason。校正保留原记录和发生时间，不增加练习次数。仅提出建议，工具等待教师编辑确认或拒绝；不得自行宣称已评分、已确认或复习策略已生效。停止后不要重复提交。',
   parameters:{type:'object',additionalProperties:false,required:['kind','reason'],properties:{kind:{type:'string',enum:['assessment','strategy']},reason:{type:'string',minLength:1,maxLength:1000},sourceReference:{type:'string',pattern:'^学习证据[1-9][0-9]*$'},desiredRetention:{type:'number',minimum:.7,maximum:.99},plan:{type:'object',additionalProperties:false,required:['title','startDate','days'],properties:{title:{type:'string',minLength:1,maxLength:160},startDate:{type:'string',pattern:'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'},days:{type:'array',minItems:14,maxItems:14,items:{type:'object',additionalProperties:false,required:['day','pointReference','activity','count','difficulty','notes'],properties:{day:{type:'integer',minimum:1,maximum:14},pointReference:{type:['string','null']},activity:{type:'string',enum:['review','practice','reflection','rest']},count:{type:'integer',minimum:0,maximum:20},difficulty:{type:'string',enum:['warmup','standard','challenge']},notes:{type:'string',minLength:1,maxLength:300}}}}}},correction:{type:'object',additionalProperties:false,required:['result','errorType','feedback'],properties:{result:{type:'string',enum:['correct','incorrect','partial']},errorType:{type:'string',enum:['none','metacognitive','application']},feedback:{type:'string',minLength:1,maxLength:2000}}}}} as ToolDefinition['parameters'],
   execute:async(callId,raw,signal)=>{
    const abort=signal||new AbortController().signal;let pending:LearningReviewSummary|undefined;
    try{abort.throwIfAborted();if(!options.isCurrent(sessionId,runId))throw new Error('permission_denied');
     if(!plainStudentInput(raw,['kind','reason','sourceReference','desiredRetention','correction','plan']))throw new Error('invalid_input');
     const facts=observed();if(!facts)throw new Error('source_changed');
     const {sourceReference,plan,...fields}=raw;if(plan!==undefined&&fields.kind!=='strategy')throw new Error('invalid_input');
     const draft:unknown={...fields,...(plan!==undefined?{plan:resolveTrainingPlan(plan,facts)}:{})};if(!validLearningDraft(draft)||draft.kind==='strategy'&&sourceReference!==undefined||draft.kind==='assessment'&&(typeof sourceReference!=='string'||!/^学习证据[1-9][0-9]*$/.test(sourceReference)))throw new Error('invalid_input');
     const record=draft.kind==='assessment'?facts.records[Number(String(sourceReference).slice(4))-1]:undefined;
     if(draft.kind==='assessment'&&(!record||!collectLearningEvidence(facts,Date.now()/1000).points.some(p=>p.records.some(e=>e.record.id===record.record.id))))throw new Error('invalid_input');
     let heuristic:LearningReviewView['heuristic'],proposal=draft;
     if(record&&draft.kind==='assessment'){
      const meta=JSON.parse(record.record.content),grade={userAnswer:meta.userAnswer,expectedAnswer:meta.expectedAnswer,questionType:meta.questionType};
      if(validLearningGradeInput(grade)){heuristic=await gradeLearningAnswer(grade,abort);proposal={...draft,correction:{result:heuristic.isCorrect?'correct':'incorrect',errorType:heuristic.errorType||'none',feedback:heuristic.isCorrect?'本地参考评分认为答案匹配，请教师核对。':'本地参考评分认为答案未匹配，请教师核对具体原因。'}};}
     }
     abort.throwIfAborted();if(!options.isCurrent(sessionId,runId))throw new Error('permission_denied');
     pending=await options.store.learningReviews.propose(sessionId,runId,callId,facts,proposal,record?.record.id,heuristic);abort.throwIfAborted();
     const submitted=pending.state==='pending'?await options.store.learningReviews.review(sessionId,pending.id):undefined;
     if(pending.state==='pending'){const item=pending;await new Promise<void>(resolve=>{
      let finished=false;const finish=()=>{if(finished)return;finished=true;waits.delete(item.id);abort.removeEventListener('abort',finish);resolve();};
      waits.set(item.id,{sessionId,runId,finish});abort.addEventListener('abort',finish,{once:true});
      if(abort.aborted||!options.isCurrent(sessionId,runId))finish();else void publish(sessionId,item.id).catch(finish);
     });}
     abort.throwIfAborted();if(!options.isCurrent(sessionId,runId))throw new Error('cancelled');
     const result=await publish(sessionId,pending.id),confirmed=result.state==='confirmed';
     const submittedProposal=submitted?{kind:submitted.draft.kind,localHeuristicApplied:!!submitted.heuristic,...(submitted.draft.kind==='assessment'?{result:submitted.draft.correction.result,errorType:submitted.draft.correction.errorType}:{desiredRetention:submitted.draft.desiredRetention})}:undefined;
     return{content:[{type:'text',text:JSON.stringify({success:confirmed,state:result.state,kind:result.kind,version:result.version,submittedProposal,message:confirmed?'教师已核对并确认，校正或策略已在本地原子保存。submittedProposal仅是宿主实际提交的编辑前候选，不是教师最终结果，也可能不同于你最初提出的内容。教师最终编辑正文未回传；本轮必须重新调用education_analyse_learning实读后再报告最终结论。原学习事实未被覆盖。':'教师拒绝，本次没有生效的校正或策略；submittedProposal只是被拒绝的编辑前候选。'})}],details:{success:confirmed},isError:!confirmed};
    }catch(error){if(abort.aborted)throw new Error('cancelled');const code=failure(error);
     const text=code==='invalid_input'?JSON.stringify({success:false,code,submittedForTeacherReview:false,retryHint:'工具参数未通过结构校验，尚未提交教师核对或保存。请按工具schema自行修正后重新提交。strategy提供desiredRetention 0.7..0.99、reason，可附完整14天plan；每个rest休息日必须pointReference=null且count=0，其他活动必须使用本次读取的知识点N且count=1..20。day按1..14完整排列，difficulty只能warmup/standard/challenge，notes为1..300字。assessment只提供本次学习证据N、correction和reason，不带plan或desiredRetention。参数校验问题应自行修正，教师只需核对教育内容。'}):LEARNING_REVIEW_ERRORS[code];
     return{content:[{type:'text',text}],details:{success:false,error:{code}},isError:true};}
   }
  }];}
 };
}
