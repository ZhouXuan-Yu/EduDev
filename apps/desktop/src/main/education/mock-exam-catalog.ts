import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {BUILD_MOCK_EXAM_CATALOG,MOCK_EXAM_SCHEMA,catalogId,mockExamDigest,mockExamErrors,mockExamParameters,mockExamRevision,
  mockExamPermission,mockExamPendingCoverLabel,validMockExamMetadata,type MockExamCatalog,type MockExamCatalogChange,type MockExamCatalogSummary,
  type MockExamHistoryEntry,type MockExamEntry,type MockExamAnswerReview,type MockExamResult} from '../../shared/mock-exam-compilation';
import {materialId} from '../../shared/materials';
import {plainStudentInput} from '../../shared/student-context';
import type {createMockExamState} from './mock-exam-state';
import type {HandoutOwner} from './teaching-handout-state';
import {resolveMockExamScope} from './mock-exam-request-scope';

export const mockExamRequest=(prompt:string)=>/(?:模考|[一二三四1234]模|模拟(?:卷|试卷|考试))/u.test(prompt)&&
  /(?:汇编|目录|整理|归档|收录|盘点|汇总)/u.test(prompt);
const validSession=(value:unknown):value is string=>typeof value==='string'&&/^aisession_[a-f0-9-]{36}$/u.test(value);
const failure=(error:unknown)=>{
  const code=error instanceof Error&&Object.hasOwn(mockExamErrors,error.message)?error.message:'configuration';
  return {ok:false as const,error:code,message:mockExamErrors[code]};
};
function validAnswerPermission(value:unknown){
  return plainStudentInput(value,['resourceId','version','pairRevision','permission'])&&materialId(value.resourceId)&&
    mockExamDigest(value.version)&&mockExamRevision(value.pairRevision)&&mockExamPermission(value.permission);
}
function validChange(value:unknown):value is MockExamCatalogChange {
  return plainStudentInput(value,['resourceId','metadata','permission','include','answerPermission'])&&materialId(value.resourceId)&&
    validMockExamMetadata(value.metadata)&&typeof value.include==='boolean'&&
    mockExamPermission(value.permission)&&(value.answerPermission===undefined||validAnswerPermission(value.answerPermission));
}
const receipt=(body:object,success:boolean)=>({content:[{type:'text' as const,text:JSON.stringify({success,...body})}],
  details:{success},isError:!success});

export function createMockExamCatalog(options:{state:ReturnType<typeof createMockExamState>;
  notify:(sessionId:string,runId:string,summary:MockExamCatalogSummary)=>void;
  answerReview:(entry:MockExamEntry,signal:AbortSignal)=>Promise<MockExamAnswerReview>;
  verify:(id:string,version:string,signal:AbortSignal)=>Promise<void>}) {
  return {
    async view(input:unknown):Promise<MockExamResult<MockExamCatalog>> {
      if(!plainStudentInput(input,['schemaVersion','sessionId','id','revision'])||input.schemaVersion!==MOCK_EXAM_SCHEMA||
        !validSession(input.sessionId)||!catalogId(input.id)||input.revision!==undefined&&!mockExamRevision(input.revision))return failure(Error('invalid_input'));
      try{return {ok:true,value:await options.state.view(input.sessionId,input.id,input.revision as number|undefined)};}
      catch(error){return failure(error);}
    },
    async answerReview(input:unknown):Promise<MockExamResult<MockExamAnswerReview>> {
      if(!plainStudentInput(input,['schemaVersion','sessionId','id','revision','digest','resourceId'])||
        input.schemaVersion!==MOCK_EXAM_SCHEMA||!validSession(input.sessionId)||!catalogId(input.id)||
        !mockExamRevision(input.revision)||!mockExamDigest(input.digest)||!materialId(input.resourceId))return failure(Error('invalid_input'));
      try {
        const catalog=await options.state.view(input.sessionId,input.id);
        const requireCurrent=(value:MockExamCatalog)=>{
          if(value.summary.revision!==input.revision||value.summary.digest!==input.digest)throw Error('version_conflict');
        };
        requireCurrent(catalog);
        const entry=catalog.entries.find(item=>item.resourceId===input.resourceId);
        if(!entry||entry.permission==='excluded'||entry.answerPermission?.permission==='excluded')throw Error('permission_denied');
        if(entry.answer.state!=='linked'||!entry.answer.resourceId||!entry.answer.version)throw Error('source_changed');
        const signal=AbortSignal.timeout(20_000);
        try {
          await options.verify(entry.resourceId,entry.version,signal);
          await options.verify(entry.answer.resourceId,entry.answer.version,signal);
        }catch{throw Error('source_changed');}
        const value=await options.answerReview(entry,signal);
        requireCurrent(await options.state.view(input.sessionId,input.id));
        return {ok:true,value};
      }catch(error){return failure(error);}
    },
    async history(input:unknown):Promise<MockExamResult<MockExamHistoryEntry[]>> {
      if(!plainStudentInput(input,['schemaVersion','sessionId','id'])||input.schemaVersion!==MOCK_EXAM_SCHEMA||
        !validSession(input.sessionId)||!catalogId(input.id))return failure(Error('invalid_input'));
      try{return {ok:true,value:await options.state.history(input.sessionId,input.id)};}
      catch(error){return failure(error);}
    },
    async restore(input:unknown):Promise<MockExamResult<MockExamCatalog>> {
      if(!plainStudentInput(input,['schemaVersion','sessionId','id','revision','digest','sourceRevision','sourceDigest'])||input.schemaVersion!==MOCK_EXAM_SCHEMA||
        !validSession(input.sessionId)||!catalogId(input.id)||!mockExamRevision(input.revision)||!mockExamRevision(input.sourceRevision)||
        input.sourceRevision>=input.revision||!mockExamDigest(input.digest)||!mockExamDigest(input.sourceDigest))return failure(Error('invalid_input'));
      try{return {ok:true,value:await options.state.restore(input.sessionId,input.id,input.revision,input.digest,input.sourceRevision,input.sourceDigest,options.verify)};}
      catch(error){return failure(error);}
    },
    async confirm(input:unknown):Promise<MockExamResult<MockExamCatalog>> {
      if(!plainStudentInput(input,['schemaVersion','sessionId','id','revision','digest','changes'])||input.schemaVersion!==MOCK_EXAM_SCHEMA||
        !validSession(input.sessionId)||!catalogId(input.id)||!mockExamRevision(input.revision)||
        !mockExamDigest(input.digest)||!Array.isArray(input.changes)||input.changes.length<1||
        input.changes.length>72||!input.changes.every(validChange))return failure(Error('invalid_input'));
      try{return {ok:true,value:await options.state.confirm(input.sessionId,input.id,input.revision,input.digest,input.changes,options.verify)};}
      catch(error){return failure(error);}
    },
    async original(input:unknown):Promise<MockExamResult<{resourceId:string;version:string}>> {
      if(!plainStudentInput(input,['schemaVersion','sessionId','id','resourceId'])||input.schemaVersion!==MOCK_EXAM_SCHEMA||
        !validSession(input.sessionId)||!catalogId(input.id)||!materialId(input.resourceId))return failure(Error('invalid_input'));
      try{
        const catalog=await options.state.view(input.sessionId,input.id);
        const entry=catalog.entries.find(item=>item.resourceId===input.resourceId||item.answer.resourceId===input.resourceId);
        const version=entry?.resourceId===input.resourceId?entry.version:entry?.answer.version;
        if(!version)throw Error('permission_denied');
        await options.verify(input.resourceId,version,AbortSignal.timeout(20_000));
        return {ok:true,value:{resourceId:input.resourceId,version}};
      }catch(error){return failure(error);}
    },
    tool(owner:()=>HandoutOwner,current:()=>boolean,prompt:string):ToolDefinition {
      return {name:BUILD_MOCK_EXAM_CATALOG,label:'整理上海模考目录',
        description:'从教师本地资料库整理上海某一年模考目录。year 必填，未明确年份时先问老师。按老师原话填写 subject、grade、districts（上海区名数组）、rounds（轮次数组），未指定字段可省略。宿主从原件确认分类证据、去重及答案册状态，保存待老师核对的目录，不会复制原件，不会标记题目已核验。请告知实际候选数及审阅入口。若回执提示首页待解析，请告知老师解析完成后可重新整理。',
        parameters:mockExamParameters as ToolDefinition['parameters'],
        execute:async(callId,raw,signal)=>{
          const fence=()=>{signal?.throwIfAborted();if(!current())throw Error('cancelled');};
          try{
            fence();
            const requested=resolveMockExamScope(prompt,raw);
            const scope=owner(),{summary:result,pendingCovers}=await options.state.generate(scope,callId,requested,fence);
            options.notify(scope.sessionId,scope.runId,result);
            return receipt({id:result.id,title:result.title,count:result.count,revision:result.revision,
              state:result.state,location:'本轮模考目录卡',...(pendingCovers?{pendingCovers}:{}),
              message:pendingCovers?mockExamPendingCoverLabel(pendingCovers):'目录已保存，等待老师核对。题目、答案和使用许可须分别查看。'},true);
          }catch(error){fence();return receipt(failure(error),false);}
        },
      };
    },
  };
}
