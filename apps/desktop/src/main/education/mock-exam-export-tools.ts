import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {catalogId,mockExamDigest,mockExamRevision,mockExamErrors,type MockExamCatalogSummary} from '../../shared/mock-exam-compilation';
import {MOCK_EXAM_EXPORT_FORMATS,READ_MOCK_EXAM_EXPORT,EXPORT_MOCK_EXAM,mockExamExportFormat,
  type MockExamExportIntent,type MockExamOfficeSource} from '../../shared/mock-exam-export';
import {plainStudentInput} from '../../shared/student-context';
import {officeRelativePath,type OfficeArtifactProposal} from '../../shared/xiaozhi-office-artifacts';
import type {createMockExamState} from './mock-exam-state';
import {planMockExamArchive} from './mock-exam-archive-plan';
import {compileMockExamOffice,type createMockExamOfficeBinding} from './mock-exam-office';

export type MockExamExportFile=OfficeArtifactProposal&{kind:'office';fileId:string};
export function mockExamArchiveRequest(prompt:string){
  const text=prompt.normalize('NFKC');
  return /(?:模考|[一二三四1234]模|模拟(?:卷|试卷|考试))/u.test(text)&&
    (/(?:原件|ZIP|压缩包)/iu.test(text)&&/(?:打包|导出|另存|下载|保存)/u.test(text)||/打包.*试卷/u.test(text));
}
export function mockExamExportRequest(prompt:string){
  const text=prompt.normalize('NFKC');
  return mockExamArchiveRequest(text)||/(?:模考|[一二三四1234]模|模拟(?:卷|试卷|考试))/u.test(text)&&/(?:导出|另存)/u.test(text)&&
    !/(?:先|新建|新编|请整理).*(?:再|后|并)导出/u.test(text);
}

const messages={...mockExamErrors,ambiguous:'有多份模考目录，请选定要导出的目录。',not_confirmed:'请先在模考目录确认当前版本，再导出。',
  source_required:'请先读取老师指定目录的当前确认版本。',invalid_input:'请选定目录版本和 Word 或 PDF 文件名。',
  source_changed:'试卷原件、答案册或目录已变化。请先重新核对目录。',too_large:'目录超出单份文档支持的内容大小。'} as Record<string,string>;
const receipt=(data:object,ok:boolean)=>({content:[{type:'text' as const,text:JSON.stringify({success:ok,...data})}],details:{success:ok},isError:!ok});
const id={type:'string',pattern:'^mock_catalog_[a-f0-9-]{36}$'};
const ordinal={type:'integer',minimum:1};
const hash={type:'string',pattern:'^[a-f0-9]{64}$'};
const same=(a:MockExamOfficeSource,b:MockExamOfficeSource)=>a.catalogId===b.catalogId&&a.revision===b.revision&&a.digest===b.digest;

export function createMockExamExportTools(options:{sessionId:string;taskId:string;intent?:MockExamExportIntent;
  archive?:(catalog:MockExamCatalogSummary)=>void;
  state:ReturnType<typeof createMockExamState>;binding:ReturnType<typeof createMockExamOfficeBinding>;
  current:()=>boolean;sanitize:(value:string)=>Promise<string>;
  publish:(files:MockExamExportFile[],args:Parameters<ToolDefinition['execute']>)=>ReturnType<ToolDefinition['execute']>;}):ToolDefinition[]{
  const {sessionId,taskId,intent}=options;
  let observed:MockExamOfficeSource|undefined;
  const guard=(signal?:AbortSignal)=>{signal?.throwIfAborted();if(!options.current())throw Error('cancelled');};
  function failure(error:unknown,signal?:AbortSignal){
    guard(signal);
    const code=error instanceof Error&&Object.hasOwn(messages,error.message)?error.message:'configuration';
    return receipt({error:code,message:messages[code]},false);
  }
  const definitions:ToolDefinition[]=[{
    name:READ_MOCK_EXAM_EXPORT,label:'读取模考目录确认版本',
    description:'从当前会话读取老师指定的已确认模考目录。填写完整title或已有catalogId，可带明确revision。工作台指定时默认该目录及版本。未确认、旧版本或同名歧义均需请老师核对。',
    parameters:{type:'object',additionalProperties:false,properties:{catalogId:id,title:{type:'string',minLength:1,maxLength:200},revision:ordinal}} as ToolDefinition['parameters'],
    execute:async(_call,raw,signal)=>{
      observed=undefined;
      try{
        guard(signal);
        if(!plainStudentInput(raw,['catalogId','title','revision'])||raw.catalogId!==undefined&&!catalogId(raw.catalogId)||
          raw.title!==undefined&&(typeof raw.title!=='string'||!raw.title.trim()||raw.title.length>200||raw.catalogId!==undefined)||
          raw.revision!==undefined&&!mockExamRevision(raw.revision))throw Error('invalid_input');
        const catalog=typeof raw.catalogId==='string'?await options.state.view(sessionId,raw.catalogId):
          intent?await options.state.view(sessionId,intent.catalogId):null;
        if((raw.catalogId!==undefined||intent)&&!catalog)throw Error('no_sources');
        if(catalog&&raw.title!==undefined&&raw.title!==catalog.summary.title)throw Error('version_conflict');
        const choices=catalog?[catalog.summary]:await options.state.targets(sessionId,taskId,typeof raw.title==='string'?raw.title.trim():undefined);
        if(!choices.length)throw Error('no_sources');
        if(choices.length>1){
          const visible=await Promise.all(choices.map(async item=>({catalogId:item.id,title:await options.sanitize(item.title),revision:item.revision,state:item.state})));
          guard(signal);return receipt({error:'ambiguous',message:messages.ambiguous,choices:visible},false);
        }
        const item=choices[0],ref={catalogId:item.id,revision:item.revision,digest:item.digest};
        if(intent&&!same(intent,ref)||raw.revision!==undefined&&raw.revision!==item.revision)throw Error('version_conflict');
        if(item.state!=='confirmed')throw Error('not_confirmed');
        const confirmed=await options.state.readConfirmed(sessionId,ref);
        const title=await options.sanitize(item.title);guard(signal);
        if(options.archive){
          const {paperCount,answerCount,embeddedCount}=planMockExamArchive(confirmed);
          options.archive(item);
          return receipt({...ref,title,paperCount,answerCount,embeddedCount,state:'preview_available',
            message:'已核对目录和入包许可。请老师在本对话的模考目录卡，或教学工作台的已确认目录，选择「预览原件包」并确认保存 ZIP。尚无新文件。'},true);
        }
        observed=ref;
        return receipt({...ref,title,count:item.count,formats:intent?[intent.format]:MOCK_EXAM_EXPORT_FORMATS,
          scope:'目录文档包含出处和状态，不包含试卷及答案册原件。'},true);
      }catch(error){return failure(error,signal);}
    },
  },{
    name:EXPORT_MOCK_EXAM,label:'导出已确认模考目录',
    description:'从本轮实读的catalogId/revision/digest生成同源 Word 或 PDF 目录。outputs填一个或两个不同格式及新的相对文件名。已从工作台选定格式时只传该格式。单份计划用saved_office，双份用saved_bundle。老师核对后才保存，只根据真实回执报告结果。',
    parameters:{type:'object',additionalProperties:false,required:['catalogId','revision','digest','outputs'],properties:{catalogId:id,revision:ordinal,digest:hash,
      outputs:{type:'array',minItems:1,maxItems:2,items:{type:'object',additionalProperties:false,required:['format','path'],properties:{
        format:{type:'string',enum:MOCK_EXAM_EXPORT_FORMATS},path:{type:'string',minLength:1,maxLength:500},
      }}}}} as ToolDefinition['parameters'],
    execute:async(...args)=>{
      const [,raw,signal]=args;
      try{
        guard(signal);
        if(!plainStudentInput(raw,['catalogId','revision','digest','outputs'])||!catalogId(raw.catalogId)||!mockExamRevision(raw.revision)||
          !mockExamDigest(raw.digest)||!Array.isArray(raw.outputs)||raw.outputs.length<1||raw.outputs.length>2)throw Error('invalid_input');
        const ref={catalogId:raw.catalogId,revision:raw.revision,digest:raw.digest};
        if(!observed||!same(observed,ref)||intent&&!same(intent,ref))throw Error('source_required');
        const outputs=raw.outputs.map(file=>{
          if(!plainStudentInput(file,['format','path'])||!mockExamExportFormat(file.format)||!officeRelativePath(file.path)||
            !file.path.toLowerCase().endsWith('.'+file.format)||intent&&file.format!==intent.format)throw Error('invalid_input');
          return {format:file.format,path:file.path};
        });
        if(new Set(outputs.map(file=>file.format)).size!==outputs.length)throw Error('invalid_input');
        const catalog=await options.binding.read(sessionId,ref,signal);guard(signal);
        const draft=compileMockExamOffice(catalog),files:MockExamExportFile[]=outputs.map(file=>({...file,kind:'office',fileId:'catalog_'+file.format,draft,sources:[]}));
        return await options.publish(files,args);
      }catch(error){return failure(error,signal);}
    },
  }];
  return options.archive?definitions.slice(0,1):definitions;
}
