import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {READ_TEACHING_HANDOUT,EXPORT_TEACHING_HANDOUT,handoutAudience,handoutBookId,handoutDigest,handoutVersionId,
  type TeachingHandoutVersionRef,type TeachingHandoutOfficeOutput} from '../../shared/teaching-handout-export';
import {plainStudentInput} from '../../shared/student-context';
import {officeRelativePath,type OfficeArtifactProposal} from '../../shared/xiaozhi-office-artifacts';
import type {createTeachingBookVersions} from './teaching-book-versions';
import {compileHandoutOffice} from './teaching-handout-office';

export type HandoutExportFile=OfficeArtifactProposal&{kind:'office';fileId:string};
export function handoutExportRequest(prompt:string){
  const text=prompt.normalize('NFKC');
  if(!/(?:讲义|学案|学生版|教师版)/u.test(text))return false;
  const explicitExport=/(?:导出|另存)/u.test(text);
  const existingHandout=/(?:已确认|已有|现有|当前|刚才|这份|上述)/u.test(text);
  return explicitExport||existingHandout&&/(?:保存|交付|生成文件|Word|DOCX)/iu.test(text);
}

const messages:Record<string,string>={
  invalid_input:'请用本轮读到的讲义版本，选择学生版或教师版，并提供新的 Word 文件名。',
  book_unavailable:'本会话没有找到这份讲义。请核对原对话或讲义名称。',
  ambiguous:'找到多份讲义，请老师指定要导出的稿件。',
  not_confirmed:'当前草稿需要老师确认后才能导出。',
  version_conflict:'讲义已修订或版本已变化，请从当前讲义核对确认后再导出。',
  source_changed:'讲义引用已发生变化，请核对原文并重新确认当前讲义。',
  source_required:'请先实读老师指定的讲义及确认版本。',
  draft_incomplete:'指定受众的讲义内容尚未齐备。',
  unsupported_section:'讲义含未能转换的内容块，请在讲义编辑器核对后再导出。',
  unsupported:'讲义有无法排版的公式，请在编辑器核对格式后重试。',
  too_large:'讲义超过单份 Word 的生成容量，请在编辑器拆分后重试。',
  file_writes_disabled:'文件写入已暂停，当前讲义仍可查看。',
  configuration:'讲义 Word 尚未提交或保存，请核对当前记录。',
};
const result=(data:object,ok:boolean)=>({content:[{type:'text' as const,text:JSON.stringify({success:ok,...data})}],details:{success:ok},isError:!ok});

export function createTeachingHandoutExportTools(options:{
  sessionId:string;taskId:string;state:ReturnType<typeof createTeachingBookVersions>;
  current:()=>boolean;sanitize:(text:string)=>Promise<string>;
  publish:(files:HandoutExportFile[],args:Parameters<ToolDefinition['execute']>)=>ReturnType<ToolDefinition['execute']>;
}):ToolDefinition[] {
  let observed:TeachingHandoutVersionRef|undefined;
  const check=(signal?:AbortSignal)=>{signal?.throwIfAborted();if(!options.current())throw Error('cancelled');};
  function error(raw:unknown,signal?:AbortSignal) {
    check(signal);
    const code=raw instanceof Error&&Object.hasOwn(messages,raw.message)?raw.message:'configuration';
    return result({error:code,message:messages[code]},false);
  }
  const id={type:'string',pattern:'^teaching_book_[a-f0-9-]{36}$'};
  const versionId={type:'string',pattern:'^teaching_version_[a-f0-9-]{36}$'};
  const digest={type:'string',pattern:'^[a-f0-9]{64}$'};
  return [{
    name:READ_TEACHING_HANDOUT,label:'读取讲义确认版本',
    description:'按完整title或bookId读取当前会话里老师指定的讲义、确认版本和摘要。只有目标明确时才能取到版本；不传参数只在当前任务或会话有唯一候选时成功。歧义时将标题交给老师选择，未确认请先核对编辑器，不猜版本或改用别份。',
    parameters:{type:'object',additionalProperties:false,properties:{bookId:id,title:{type:'string',minLength:1,maxLength:200}}} as ToolDefinition['parameters'],
    execute:async(_call,raw,signal)=>{
      observed=undefined;
      try {
        check(signal);
        if(!plainStudentInput(raw,['bookId','title'])||Object.keys(raw).length>1)throw Error('invalid_input');
        const {bookId,title}=raw;
        if(bookId!==undefined&&!handoutBookId(bookId)||
          title!==undefined&&(typeof title!=='string'||!title.trim()||title.length>200||/[\x00-\x1f]/u.test(title)))throw Error('invalid_input');
        const item=await options.state.forExport(options.sessionId,options.taskId,{title,bookId});check(signal);
        if(item.kind==='ambiguous'){
          const choices=await Promise.all(item.choices.map(async row=>({...row,title:await options.sanitize(row.title)})));
          check(signal);
          return result({error:'ambiguous',message:messages.ambiguous,choices},false);
        }
        const safeTitle=await options.sanitize(item.version.title);check(signal);
        observed={bookId:item.version.bookId,versionId:item.version.id,digest:item.version.digest};
        return result({...observed,title:safeTitle,revision:item.version.revision,chapterCount:item.content.chapters.length,
          location:'讲义 → 确认与版本',teacherConfirmed:true},true);
      } catch(rawError){return error(rawError,signal);}
    },
  },{
    name:EXPORT_TEACHING_HANDOUT,label:'导出确认讲义 Word',
    description:'用本轮读到的bookId/versionId/digest导出确切讲义。outputs每项填写audience=student或teacher和新相对.docx路径，受众与路径均不重复。学生版省略独立练习答案与教师附加内容，两份用saved_bundle target=current合并一次审批，单份用saved_office target=相对路径。编辑或来源变化应重新确认，不用普通文档工具重抄。',
    parameters:{type:'object',additionalProperties:false,required:['bookId','versionId','digest','outputs'],
      properties:{bookId:id,versionId,digest,outputs:{type:'array',minItems:1,maxItems:2,items:{type:'object',
        additionalProperties:false,required:['audience','path'],properties:{audience:{type:'string',enum:['student','teacher']},path:{type:'string',minLength:1,maxLength:500}}}}}} as ToolDefinition['parameters'],
    execute:async(...args)=>{
      const [,raw,signal]=args;
      try {
        check(signal);
        if(!plainStudentInput(raw,['bookId','versionId','digest','outputs'])||Object.keys(raw).length!==4||
          !handoutBookId(raw.bookId)||!handoutVersionId(raw.versionId)||!handoutDigest(raw.digest)||
          !Array.isArray(raw.outputs)||raw.outputs.length<1||raw.outputs.length>2)throw Error('invalid_input');
        const ref={bookId:raw.bookId,versionId:raw.versionId,digest:raw.digest};
        if(!observed||observed.bookId!==ref.bookId||observed.versionId!==ref.versionId||observed.digest!==ref.digest)throw Error('source_required');
        const outputs:TeachingHandoutOfficeOutput[]=raw.outputs.map(output=>{
          if(!plainStudentInput(output,['audience','path'])||!handoutAudience(output.audience)||
            !officeRelativePath(output.path)||!output.path.toLowerCase().endsWith('.docx'))throw Error('invalid_input');
          return {audience:output.audience,path:output.path};
        });
        if(new Set(outputs.map(output=>output.audience)).size!==outputs.length||
          new Set(outputs.map(output=>output.path.toLowerCase())).size!==outputs.length)throw Error('invalid_input');
        const item=await options.state.forExport(options.sessionId,options.taskId,ref);check(signal);
        if(item.kind!=='found')throw Error('ambiguous');
        const files:HandoutExportFile[]=outputs.map(output=>({kind:'office',fileId:'handout_'+output.audience,
          format:'docx',path:output.path,sources:[],draft:compileHandoutOffice(item,output.audience)}));
        return await options.publish(files,args);
      }catch(rawError){return error(rawError,signal);}
    },
  }];
}
