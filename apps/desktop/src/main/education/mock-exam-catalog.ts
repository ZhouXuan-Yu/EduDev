import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {BUILD_MOCK_EXAM_CATALOG,MOCK_EXAM_SCHEMA,catalogId,mockExamDigest,mockExamErrors,mockExamParameters,mockExamRevision,
  validMockExamMetadata,validMockExamScope,type MockExamCatalog,type MockExamCatalogChange,type MockExamCatalogSummary,
  type MockExamHistoryEntry,type MockExamResult} from '../../shared/mock-exam-compilation';
import {materialId} from '../../shared/materials';
import {plainStudentInput} from '../../shared/student-context';
import type {createMockExamState} from './mock-exam-state';
import type {HandoutOwner} from './teaching-handout-state';

export const mockExamRequest=(prompt:string)=>/(?:模考|[一二三四1234]模|模拟(?:卷|试卷|考试))/u.test(prompt)&&
  /(?:汇编|目录|整理|归档|收录|盘点|汇总)/u.test(prompt);
const validSession=(value:unknown):value is string=>typeof value==='string'&&/^aisession_[a-f0-9-]{36}$/u.test(value);
const failure=(error:unknown)=>{
  const code=error instanceof Error&&Object.hasOwn(mockExamErrors,error.message)?error.message:'configuration';
  return {ok:false as const,error:code,message:mockExamErrors[code]};
};
function validChange(value:unknown):value is MockExamCatalogChange {
  return plainStudentInput(value,['resourceId','metadata','permission','include'])&&materialId(value.resourceId)&&
    validMockExamMetadata(value.metadata)&&typeof value.include==='boolean'&&
    (value.permission==='unknown'||value.permission==='local_only'||value.permission==='excluded');
}
const receipt=(body:object,success:boolean)=>({content:[{type:'text' as const,text:JSON.stringify({success,...body})}],
  details:{success},isError:!success});

export function createMockExamCatalog(options:{state:ReturnType<typeof createMockExamState>;
  notify:(sessionId:string,runId:string,summary:MockExamCatalogSummary)=>void;
  verify:(id:string,version:string,signal:AbortSignal)=>Promise<void>}) {
  return {
    async view(input:unknown):Promise<MockExamResult<MockExamCatalog>> {
      if(!plainStudentInput(input,['schemaVersion','sessionId','id','revision'])||input.schemaVersion!==MOCK_EXAM_SCHEMA||
        !validSession(input.sessionId)||!catalogId(input.id)||input.revision!==undefined&&!mockExamRevision(input.revision))return failure(Error('invalid_input'));
      try{return {ok:true,value:await options.state.view(input.sessionId,input.id,input.revision as number|undefined)};}
      catch(error){return failure(error);}
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
    tool(owner:()=>HandoutOwner,current:()=>boolean):ToolDefinition {
      return {name:BUILD_MOCK_EXAM_CATALOG,label:'整理上海模考目录',
        description:'从教师本地资料库整理上海各区某一年模考目录。year 必填，未明确年份时请先问老师。subject、grade 只在老师限定时填写。宿主会识别地区、轮次、来源、重复、答案册和解析状态并保存待老师核对的目录，不会复制原件，不会标记题目已核验。请告知实际成功的候选数及审阅入口，勿称已经确认或导出。',
        parameters:mockExamParameters as ToolDefinition['parameters'],
        execute:async(callId,raw,signal)=>{
          const fence=()=>{signal?.throwIfAborted();if(!current())throw Error('cancelled');};
          try{
            fence();
            if(!plainStudentInput(raw,['year','subject','grade'])||!validMockExamScope(raw))throw Error('invalid_input');
            const scope=owner(),result=await options.state.generate(scope,callId,raw,fence);
            options.notify(scope.sessionId,scope.runId,result);
            return receipt({id:result.id,title:result.title,count:result.count,revision:result.revision,
              state:result.state,location:'本轮模考目录卡',message:'目录已保存，等待老师核对。题目、答案和使用许可须分别查看。'},true);
          }catch(error){fence();return receipt(failure(error),false);}
        },
      };
    },
  };
}
