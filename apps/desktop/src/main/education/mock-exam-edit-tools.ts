import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {catalogId,mockExamDigest,mockExamErrors,MOCK_EXAM_GRADES,MOCK_EXAM_ROUNDS,MOCK_EXAM_SUBJECTS,SHANGHAI_DISTRICTS,
  type MockExamResult} from '../../shared/mock-exam-compilation';
import {MOCK_EXAM_EDIT_SCHEMA,MOCK_EXAM_EDIT_LIMIT,PROPOSE_MOCK_EXAM_EDIT,READ_MOCK_EXAM_EDIT,mockExamEditId,
  type MockExamEditReview,type MockExamEditSummary} from '../../shared/mock-exam-edit';
import {plainStudentInput} from '../../shared/student-context';
import {validMockExamEdit} from './mock-exam-edit-plan';
import type {createMockExamEditState} from './mock-exam-edit-state';
import type {createMockExamState} from './mock-exam-state';
import type {HandoutOwner} from './teaching-handout-state';

export function mockExamEditRequest(prompt:string){
  const text=prompt.normalize('NFKC');
  return /(?:模考|[一二三四1234]模|模拟(?:试卷|卷|考试))/u.test(text)&&
    /(?:修改|只改|仅改|改为|改成|改一下|更正|修订|修正|调整|移出|移除|删掉|取消收录|不收录|恢复收录|重新收录|登记为)/u.test(text);
}

const messages={...mockExamErrors,
  ambiguous:'找到多份同会话汇编，请老师指定要改的目录。',
  source_required:'请先读取这份目录的当前版本和老师指定的条目。',
  unchanged:'所给字段与当前目录一致。',
  review_waiting:'请等小智完成这一轮，再处理这份建议。',
} as Record<string,string>;
const sessionId=(value:unknown):value is string=>typeof value==='string'&&/^aisession_[a-f0-9-]{36}$/u.test(value);
const failure=(error:unknown)=>{
  const code=error instanceof Error&&Object.hasOwn(messages,error.message)?error.message:'configuration';
  return {ok:false as const,error:code,message:messages[code]};
};
const receipt=(data:object,ok:boolean)=>({content:[{type:'text' as const,text:JSON.stringify({success:ok,...data})}],
  details:{success:ok},isError:!ok});
const id={type:'string',pattern:'^mock_catalog_[a-f0-9-]{36}$'};
const unknown={type:'null'};
const proposeParameters={type:'object',additionalProperties:false,required:['catalogId','revision','digest','changes'],properties:{
  catalogId:id,revision:{type:'integer',minimum:1},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},
  changes:{type:'array',minItems:1,maxItems:MOCK_EXAM_EDIT_LIMIT,items:{type:'object',additionalProperties:false,required:['resourceId'],minProperties:2,properties:{
    resourceId:{type:'string',maxLength:128},include:{type:'boolean'},
    district:{anyOf:[{type:'string',enum:SHANGHAI_DISTRICTS},unknown]},grade:{anyOf:[{type:'string',enum:MOCK_EXAM_GRADES},unknown]},
    subject:{anyOf:[{type:'string',enum:MOCK_EXAM_SUBJECTS},unknown]},round:{anyOf:[{type:'string',enum:MOCK_EXAM_ROUNDS},unknown]},
    year:{anyOf:[{type:'integer',minimum:1990,maximum:2100},unknown]},
  }}},
}};

export function createMockExamEditCoordinator(options:{
  state:ReturnType<typeof createMockExamEditState>;catalogs:ReturnType<typeof createMockExamState>;
  sanitize:()=>Promise<(text:string)=>Promise<string>>;
  verify:Parameters<ReturnType<typeof createMockExamEditState>['decide']>[1];
  publish:(sessionId:string,runId:string,review:MockExamEditSummary)=>void;
}) {
  return {
    async view(input:unknown):Promise<MockExamResult<MockExamEditReview>> {
      if(!plainStudentInput(input,['schemaVersion','sessionId','id'])||input.schemaVersion!==MOCK_EXAM_EDIT_SCHEMA||
        !sessionId(input.sessionId)||!mockExamEditId(input.id))return failure(Error('invalid_input'));
      try{return {ok:true,value:await options.state.view(input.sessionId,input.id)};}catch(error){return failure(error);}
    },
    async decide(input:unknown):Promise<MockExamResult<MockExamEditSummary>> {
      if(!plainStudentInput(input,['schemaVersion','sessionId','id','fingerprint','action'])||input.schemaVersion!==MOCK_EXAM_EDIT_SCHEMA||
        !sessionId(input.sessionId)||!mockExamEditId(input.id)||!mockExamDigest(input.fingerprint)||
        input.action!=='approve'&&input.action!=='reject')return failure(Error('invalid_input'));
      try{return {ok:true,value:(await options.state.decide({schemaVersion:MOCK_EXAM_EDIT_SCHEMA,sessionId:input.sessionId,id:input.id,
        fingerprint:input.fingerprint,action:input.action},options.verify)).summary};}catch(error){return failure(error);}
    },
    tools(owner:()=>HandoutOwner,current:()=>boolean):ToolDefinition[]{
      let read:{id:string;revision:number;digest:string;resources:Set<string>}|undefined;
      const fence=(signal?:AbortSignal)=>{signal?.throwIfAborted();if(!current())throw Error('cancelled');};
      return [{
        name:READ_MOCK_EXAM_EDIT,label:'读取模考目录的修订位置',
        description:'在原会话中查找要修订的模考目录，使用老师指定完整title或已知catalogId。两者不传只在原任务或会话有唯一候选时成功。读回当前版本、条目原件名以及分类和收录。歧义请老师选择。',
        parameters:{type:'object',additionalProperties:false,properties:{catalogId:id,title:{type:'string',minLength:1,maxLength:200}}} as ToolDefinition['parameters'],
        execute:async(_call,raw,signal)=>{
          read=undefined;
          try{
            fence(signal);
            if(!plainStudentInput(raw,['catalogId','title'])||Object.keys(raw).length>1||
              raw.catalogId!==undefined&&!catalogId(raw.catalogId)||raw.title!==undefined&&
              (typeof raw.title!=='string'||!raw.title.trim()||raw.title.length>200||/[\u0000-\u001f]/u.test(raw.title)))throw Error('invalid_input');
            const origin=owner(),sanitize=await options.sanitize();
            let target=raw.catalogId;
            if(!target){
              const choices=await options.catalogs.targets(origin.sessionId,origin.taskId,typeof raw.title==='string'?raw.title.trim():undefined);
              fence(signal);
              if(!choices.length)throw Error('no_sources');
              if(choices.length>1){
                const visible=await Promise.all(choices.map(async item=>({catalogId:item.id,title:await sanitize(item.title),revision:item.revision,state:item.state})));
                fence(signal);return receipt({error:'ambiguous',message:messages.ambiguous,choices:visible},false);
              }
              target=choices[0].id;
            }
            const catalog=await options.catalogs.view(origin.sessionId,target);
            const {id,revision,digest,title}=catalog.summary;
            const entries=await Promise.all(catalog.entries.map(async entry=>({resourceId:entry.resourceId,title:await sanitize(entry.title),
              ...entry.metadata,include:entry.include,restricted:entry.permission==='excluded',answer:entry.answer.state})));
            const safeTitle=await sanitize(title);fence(signal);
            read={id,revision,digest,resources:new Set(entries.map(entry=>entry.resourceId))};
            return receipt({catalogId:id,revision,digest,title:safeTitle,entries},true);
          }catch(error){fence(signal);return receipt(failure(error),false);}
        },
      },{
        name:PROPOSE_MOCK_EXAM_EDIT,label:'提交模考目录修改审阅',
        description:'只能用本轮读到的目录身份、当前revision/digest和已有resourceId。最多六份卷，只传老师要求改动的字段，可改区、年、年级、学科、轮次和是否收录。不得改变使用许可、答案册或原件。提交后给老师看差异；老师应用后保存新草稿。',
        parameters:proposeParameters as ToolDefinition['parameters'],
        execute:async(callId,raw,signal)=>{
          const guard=()=>fence(signal);
          try{
            guard();if(!validMockExamEdit(raw))throw Error('invalid_input');
            if(!read||read.id!==raw.catalogId||read.revision!==raw.revision||read.digest!==raw.digest||
              raw.changes.some(item=>!read!.resources.has(item.resourceId)))throw Error('source_required');
            const origin=owner(),review=await options.state.propose(origin,callId,raw,guard);
            options.publish(origin.sessionId,origin.runId,review.summary);
            return receipt({id:review.summary.id,state:review.summary.state,count:review.summary.count,
              message:'已保存前后差异，请在本轮审阅卡核对。目录本身未确认新的版本。'},true);
          }catch(error){guard();return receipt(failure(error),false);}
        },
      }];
    },
  };
}
