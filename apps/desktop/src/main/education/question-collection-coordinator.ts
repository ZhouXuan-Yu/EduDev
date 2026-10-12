import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {OmniEduStore} from '../db';
import {plainStudentInput} from '../../shared/student-context';
import type {QuestionContextSource} from '../../shared/question-context';
import {QUESTION_COLLECTION_TOOLS,validCollectionReference,validCollectionBlueprint,validQuestionCollection,type QuestionCollectionInput,type QuestionCollectionDecision,type QuestionCollectionSummary,type QuestionCollectionView,type QuestionCollectionResult} from '../../shared/question-collection';
import {QUESTION_REVIEW_ERRORS,validQuestionReviewDraft,type QuestionReviewError} from '../../shared/question-review';
import {paperSectionMatches} from './paper-selection';
import {questionQualityCandidate} from './question-quality';
import {createStudentContextSanitizer} from '../students/context-sanitizer';
import type {createQuestionReviewCoordinator} from './question-review-coordinator';
import type {createPaperCoordinator} from './paper-coordinator';

type Options={store:OmniEduStore;questions:ReturnType<typeof createQuestionReviewCoordinator>;papers:ReturnType<typeof createPaperCoordinator>;isCurrent:(session:string,run:string)=>boolean;canDecide:(session:string,run:string)=>boolean;emit:(session:string,run:string,review:QuestionCollectionSummary)=>void;afterWrite?:(current:()=>boolean)=>Promise<void>};
/** Aggregation only. All generation and repairs remain native calls in the one Pi run. */
export function createQuestionCollectionCoordinator(options:Options){
 const repository=options.store.questionReviews.collections;
 const waits=new Map<string,Set<{runId:string;finish:()=>void}>>();
 const code=(e:unknown):QuestionReviewError=>Object.prototype.hasOwnProperty.call(QUESTION_REVIEW_ERRORS,(e as Error)?.message)?(e as Error).message as QuestionReviewError:'unavailable';
 const publish=async(sessionId:string,id:string,eventRun?:string)=>{const row=(await repository.list(sessionId)).find(v=>v.id===id);if(!row)throw Error('permission_denied');options.emit(sessionId,eventRun||row.runId,row);return row;};
 const receipt=async(value:unknown,current:()=>boolean,error=false)=>{const clean=await createStudentContextSanitizer(options.store),text=await clean(JSON.stringify(value));if(!current())throw Error('cancelled');return{content:[{type:'text' as const,text}],details:{success:!error},isError:error};};
 const decisionLease=(session:string,run:string,id:string,lease:()=>boolean)=>lease()&&(options.canDecide(session,run)||[...(waits.get(id)||[])].some(w=>options.canDecide(session,w.runId)));
 return{
  async review(input:QuestionCollectionInput):Promise<QuestionCollectionResult<QuestionCollectionView>>{if(!validQuestionCollection(input))return{ok:false,error:'invalid_input'};try{return{ok:true,value:await repository.review(input.sessionId,input.id)};}catch(e){return{ok:false,error:code(e)};}},
  async decide(input:QuestionCollectionDecision,lease:()=>boolean=()=>true):Promise<QuestionCollectionResult<QuestionCollectionView>>{
   if(!validQuestionCollection(input,true))return{ok:false,error:'invalid_input'};
   try{const before=await repository.review(input.sessionId,input.id),value=await repository.decide(input,()=>decisionLease(input.sessionId,before.runId,input.id,lease),options.afterWrite);await publish(input.sessionId,input.id);for(const w of waits.get(input.id)||[])await publish(input.sessionId,input.id,w.runId);for(const wait of [...(waits.get(input.id)||[])])wait.finish();return{ok:true,value};}catch(e){return{ok:false,error:code(e)};}
  },
  canEdit(sessionId:string,id:string,runId:string){return [...(waits.get(id)||[])].some(w=>w.runId===runId)&&options.canDecide(sessionId,runId);},
  cancel(runId:string){for(const set of waits.values())for(const wait of [...set])if(wait.runId===runId)wait.finish();},
  tools(sessionId:string,runId:string,observed:Map<string,QuestionContextSource>):ToolDefinition[]{
   const batch=options.questions.tools(sessionId,runId,observed)[0],paper=options.papers.tools(sessionId,runId)[0];
   const wrap=(name:string,label:string,description:string,parameters:ToolDefinition['parameters'],execute:(call:string,raw:unknown,signal:AbortSignal,current:()=>boolean)=>Promise<Awaited<ReturnType<ToolDefinition['execute']>>>):ToolDefinition=>({name,label,description,parameters,execute:async(call,raw,signal)=>{const abort=signal||new AbortController().signal,current=()=>!abort.aborted&&options.isCurrent(sessionId,runId);try{abort.throwIfAborted();if(!current())throw Error('cancelled');return await execute(call,raw,abort,current);}catch(e){if(abort.aborted)throw Error('cancelled');const error=code(e);return receipt({success:false,code:error,message:QUESTION_REVIEW_ERRORS[error]},current,true);}}});
   return[
    wrap(QUESTION_COLLECTION_TOOLS[0],'准备整卷题目','需要按蓝图或明确总题数制作混合/原创试卷时（包括8题以内的整卷），先用这个工具固定完整蓝图，字段与education_propose_paper相同，仅支持hybrid/ai_original。教师说继续未完成试卷时可仅传{resume:true}，主进程读取当前对话唯一未完成蓝图，不要求教师复述。返回宿主签发collectionReference及每部分剩余配额。复用同对话未完成且蓝图完全相同的草稿，不能重置失败题。之后连续调用education_append_paper_questions，不逐批请教师批准；最后education_review_paper_questions集中审核。纯题库直接使用现组卷工具。',{type:'object',anyOf:[paper.parameters,{type:'object',additionalProperties:false,required:['resume'],properties:{resume:{type:'boolean',const:true}}}]} as ToolDefinition['parameters'],async(call,raw,_signal,current)=>{
     const resume=plainStudentInput(raw,['resume'])&&raw.resume===true;if(!resume&&!validCollectionBlueprint(raw))throw Error('invalid_input');const value=resume?await repository.resume(sessionId,runId,current):await repository.begin(sessionId,runId,call,raw as import('../../shared/paper-blueprint').PaperBlueprint,current),continuation=await repository.continuation(sessionId,value.id),view=continuation.view;await publish(sessionId,value.id,runId);
     return receipt({success:true,collectionReference:value.reference,blueprint:view.blueprint,staged:continuation.staged,...(continuation.repair?{repair:continuation.repair}:{}),phase:view.phase,count:view.count,required:view.required,sections:view.blueprint.sections.map(s=>({id:s.id,remaining:(view.blueprint.mode==='ai_original'?s.count:s.generatedCount||0)-view.groups.filter(g=>g.sectionId===s.id).reduce((n,g)=>n+g.review.count,0)})),message:'继续内部起草。已暂存题不可重复提交；最后集中审核，未审核不保存正式题本。'},current);
    }),
    wrap(QUESTION_COLLECTION_TOOLS[1],'起草并检查整卷题目',batch.description.replace('本工具在检查通过后等待其决定；','')+' 本工具属于整卷内部阶段，每批最多8题，增加collectionReference和sectionId；必须沿开始工具的学科、年级、题型、难度和配额。沿原规则检查修复，失败仍占配额；暂存后继续下一批，最后统一审核。不等待教师逐批决定，不保存题本。',{
     ...batch.parameters,required:[...((batch.parameters as {required?:string[]}).required||[]),'collectionReference','sectionId'],properties:{...((batch.parameters as {properties?:Record<string,unknown>}).properties||{}),collectionReference:{type:'string',pattern:'^整卷_[a-f0-9]{24}$'},sectionId:{type:'string',pattern:'^[a-zA-Z0-9_-]{1,40}$'}}
    } as ToolDefinition['parameters'],async(call,raw,signal,current)=>{
     if(!plainStudentInput(raw,['collectionReference','sectionId','sourceReferences','mathChecks','repairReference','generationKind','title','reason','subject','grade','knowledgePoint','items'])||!validCollectionReference(raw.collectionReference)||typeof raw.sectionId!=='string')throw Error('invalid_input');
     const {collectionReference,sectionId,...draft}=raw,value=await repository.resolve(sessionId,collectionReference);if(value.s.phase!=='drafting')throw Error('conflict');if(!current())throw Error('cancelled');
     const section=value.p.blueprint.sections.find(s=>s.id===sectionId),{sourceReferences:_sources,mathChecks:_checks,repairReference:_repair,generationKind:_kind,...fields}=draft;
     const valid=validQuestionReviewDraft(fields),mismatched=valid&&section?fields.items.flatMap((q,i)=>paperSectionMatches(questionQualityCandidate(q,fields,i),value.p.blueprint,section)?[]:[i+1]):[];
     if(!section||!valid||mismatched.length)return receipt({success:false,code:'invalid_input',submittedForTeacherReview:false,quotaConsumed:false,expected:{subject:value.p.blueprint.subject,grade:value.p.blueprint.grade,section:section||null,itemFields:['questionType','stem','answer','analysis','options','difficulty']},mismatchedItemIndexes:mismatched,message:'本批未暂存。请修正后重新提交：subject/grade必须与蓝图相同，题型、difficulty和knowledgePoint须匹配该section；items每题只允许itemFields，数学计划置于顶层mathChecks（与items等长，不可在item内放mathCheck）。不要修改原蓝图或降低难度。'},current,true);
     const result=await options.questions.tools(sessionId,runId,observed,{id:String(value.r.id),sectionId})[0].execute(call,draft,signal,undefined,{} as never);if(!current())throw Error('cancelled');await publish(sessionId,String(value.r.id),runId);return result;
    }),
    wrap(QUESTION_COLLECTION_TOOLS[2],'集中核对整卷题目','完成所有部分生成配额后调用。仅接收collectionReference，缺题或配额不符返回错误，不能暗补；质量失败和跨批重复/答案冲突集中展示并禁止保存。工具在此一次等待教师核对当前全部题目、修改重检或拒绝；确认后方可调用education_propose_paper形成最终试卷。停止/拒绝不自动重提，不返回教师私有修改。',{type:'object',additionalProperties:false,required:['collectionReference'],properties:{collectionReference:{type:'string',pattern:'^整卷_[a-f0-9]{24}$'}}},async(_call,raw,signal,current)=>{
     if(!plainStudentInput(raw,['collectionReference'])||!validCollectionReference(raw.collectionReference))throw Error('invalid_input');const value=await repository.resolve(sessionId,raw.collectionReference),id=String(value.r.id);if(value.r.status==='pending'&&value.s.phase==='drafting')await repository.seal(sessionId,id,current);
     if((await repository.review(sessionId,id)).state==='pending')await new Promise<void>(resolve=>{let done=false;const wait={runId,finish:()=>{if(done)return;done=true;const set=waits.get(id);set?.delete(wait);if(!set?.size)waits.delete(id);signal.removeEventListener('abort',wait.finish);resolve();}};const set=waits.get(id)||new Set();set.add(wait);waits.set(id,set);signal.addEventListener('abort',wait.finish,{once:true});if(!current())wait.finish();else void publish(sessionId,id,runId).then(row=>{if(row.state!=='pending')wait.finish();},wait.finish);});
     if(!current())throw Error('cancelled');const final=await repository.review(sessionId,id),confirmed=final.state==='confirmed';return receipt({success:confirmed,state:final.state,count:final.count,answerVerified:false,message:confirmed?'教师已集中核对并保存当前整卷题目；请用原蓝图组卷，再核对最终整卷与文件。答案仍不等于独立证明。':'教师已拒绝，未保存整卷题目；不要自动重提。'},current,!confirmed);
    })
   ];
  }
 };
}
