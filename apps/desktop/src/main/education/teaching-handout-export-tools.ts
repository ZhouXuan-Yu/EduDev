import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {READ_TEACHING_HANDOUT,EXPORT_TEACHING_HANDOUT,handoutAudience,handoutBookId,handoutDigest,handoutVersionId,
  type TeachingHandoutVersionRef,type TeachingHandoutOfficeOutput} from '../../shared/teaching-handout-export';
import {plainStudentInput} from '../../shared/student-context';
import {officeRelativePath,type OfficeArtifactProposal} from '../../shared/xiaozhi-office-artifacts';
import type {createTeachingBookVersions} from './teaching-book-versions';
import {compileHandoutOffice} from './teaching-handout-office';
import {assertHandoutOutputScope,handoutOutputScope,handoutTitleKey} from './teaching-handout-output-scope';

export type HandoutExportFile=OfficeArtifactProposal&{kind:'office';fileId:string};
export function handoutExportRequest(prompt:string){
  const text=prompt.normalize('NFKC');
  if(!/(?:讲义|学案|学生版|教师版)/u.test(text))return false;
  if(handoutContinuationRequest(text)&&/(?:暂不|不要|不用|无需|不必|不需要|先不)(?:再|立即)?(?:导出|另存|保存|交付|生成文件)/u.test(text))return false;
  const explicitExport=/(?:导出|另存)/u.test(text);
  const existingHandout=/(?:已确认|已有|现有|当前|刚才|这份|上述)/u.test(text);
  return explicitExport||existingHandout&&/(?:保存|交付|生成文件|Word|DOCX)/iu.test(text);
}

// Only the teacher's direct instruction can designate a different task's book in this session.
const resumeVerb=/^(?:请(?:帮我)?|帮我|我们)?(?:继续|接着|打开|核对)/u;
function directRequest(text:string){
  return text.normalize('NFKC').trim().split(/[。！？!?；;，,\n]/u)[0].trim();
}
export function handoutContinuationRequest(prompt:string){
  const clause=directRequest(prompt);
  return resumeVerb.test(clause)&&/(?:讲义|学案)/u.test(clause)&&!/[“”「」"'？?]/u.test(clause);
}

function continuationTitle(text:string){
  // A quoted instruction, second title, or withdrawal cannot authorize a session-wide lookup.
  if(!text||Array.from(text.matchAll(/《[^《》]+》/gu)).length!==1||
    /[“”「」"']|取消|算了|撤销|(?:不要|不用|停止|别再|暂不)(?:继续|打开|核对|读取)|(?:或是|或者|还是)/u.test(text))return undefined;
  const clause=directRequest(text);
  const match=/^(?:请(?:帮我)?|帮我|我们)?(?:继续|接着|打开|核对)\s*(?:这份|讲义|学案)?\s*《([^《》\r\n]{1,160})》(?:这份)?(?:讲义|学案)?$/u.exec(clause);
  return match?.[1];
}

const messages:Record<string,string>={
  book_selection_required:'请在原讲义会话中确认要继续的稿件。可以请老师回答“请继续《完整书名》”，同名稿件请从讲义编辑器核对。',
  invalid_input:'请用本轮读到的讲义版本，选择学生版或教师版，并提供新的 Word 文件名。',
  book_unavailable:'本会话没有找到这份讲义。请核对原对话或讲义名称。',
  ambiguous:'找到多份讲义，请老师指定要导出的稿件。',
  target_mismatch:'请读取老师在本轮明确指定的讲义，依据原题名定位。',
  audience_mismatch:'输出对象与老师本轮要求不符。请只提交明确要求的学生版、教师版或两者。',
  audience_filename_conflict:'文件名里的学生版或教师版与实际受众不一致。请修正文件名后重试。',
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

/** Resume grants access to confirmation metadata only. Model arguments never expand the lookup. */
export function createConfirmedHandoutContinuationTool(options:{
  sessionId:string;taskId:string;prompt:string;state:ReturnType<typeof createTeachingBookVersions>;
  current:()=>boolean;sanitize:(text:string)=>Promise<string>;teacherSelection:()=>Promise<string|undefined>;
}):ToolDefinition {
  const check=(signal?:AbortSignal)=>{signal?.throwIfAborted();if(!options.current())throw Error('cancelled');};
  return {
    name:READ_TEACHING_HANDOUT,label:'核对已确认的讲义',
    description:'续做讲义先不传参数核对当前任务绑定的已确认版本。没有明确目标时，请老师亲自指定《完整书名》。只能读当前会话的确认信息。',
    parameters:{type:'object',additionalProperties:false,properties:{bookId:{type:'string'},title:{type:'string'}}} as ToolDefinition['parameters'],
    execute:async(_call,raw,signal)=>{
      try {
        check(signal);
        if(!plainStudentInput(raw,['bookId','title'])||Object.keys(raw).length>1||
          raw.bookId!==undefined&&!handoutBookId(raw.bookId)||
          raw.title!==undefined&&(typeof raw.title!=='string'||!raw.title.trim()||raw.title.length>200))throw Error('invalid_input');
        const answer=await options.teacherSelection();
        const title=continuationTitle(answer??options.prompt);
        if(answer!==undefined&&!title)throw Error('book_selection_required');
        const target=title?{title}:{taskOnly:true};
        const item=await options.state.forExport(options.sessionId,options.taskId,target);
        if(item.kind!=='found')throw Error('book_selection_required');
        if(raw.bookId!==undefined&&raw.bookId!==item.version.bookId||
          typeof raw.title==='string'&&handoutTitleKey(raw.title)!==handoutTitleKey(item.version.title))throw Error('target_mismatch');
        const safeTitle=await options.sanitize(item.version.title);
        const ref={bookId:item.version.bookId,versionId:item.version.id,digest:item.version.digest};
        // Recheck both the target binding and current confirmed version after asynchronous sanitization.
        const latest=await options.state.forExport(options.sessionId,options.taskId,target);
        if(latest.kind!=='found'||latest.version.bookId!==ref.bookId||latest.version.id!==ref.versionId||
          latest.version.digest!==ref.digest)throw Error('version_conflict');
        if(answer!==await options.teacherSelection())throw Error('book_selection_required');
        check(signal);
        return result({...ref,title:safeTitle,revision:item.version.revision,confirmedAt:item.version.createdAt,
          chapterCount:item.content.chapters.length,teacherConfirmed:true,location:'讲义 → 确认与版本'},true);
      }catch(error){
        check(signal);
        const reason=error instanceof Error?error.message:'';
        const code=reason==='book_unavailable'?'book_selection_required':Object.hasOwn(messages,reason)?reason:'configuration';
        return result({error:code,message:messages[code]},false);
      }
    },
  };
}

function parseHandoutOutput(raw:unknown) {
  if(!plainStudentInput(raw,['bookId','versionId','digest','outputs'])||Object.keys(raw).length!==4||
    !handoutBookId(raw.bookId)||!handoutVersionId(raw.versionId)||!handoutDigest(raw.digest)||
    !Array.isArray(raw.outputs)||raw.outputs.length<1||raw.outputs.length>2)throw Error('invalid_input');
  const ref={bookId:raw.bookId,versionId:raw.versionId,digest:raw.digest};
  const outputs:TeachingHandoutOfficeOutput[]=raw.outputs.map(output=>{
    if(!plainStudentInput(output,['audience','path'])||!handoutAudience(output.audience)||
      !officeRelativePath(output.path)||!output.path.toLowerCase().endsWith('.docx'))throw Error('invalid_input');
    return {audience:output.audience,path:output.path};
  });
  if(new Set(outputs.map(output=>output.audience)).size!==outputs.length||
    new Set(outputs.map(output=>output.path.toLowerCase())).size!==outputs.length)throw Error('invalid_input');
  return {ref,outputs};
}

export function assertTeachingHandoutExportProposal(prompt:string,raw:unknown) {
  const {outputs}=parseHandoutOutput(raw);
  assertHandoutOutputScope(handoutOutputScope(prompt),outputs);
}

export function createTeachingHandoutExportTools(options:{
  sessionId:string;taskId:string;prompt:string;state:ReturnType<typeof createTeachingBookVersions>;
  current:()=>boolean;sanitize:(text:string)=>Promise<string>;
  publish:(files:HandoutExportFile[],args:Parameters<ToolDefinition['execute']>)=>ReturnType<ToolDefinition['execute']>;
}):ToolDefinition[] {
  const scope=handoutOutputScope(options.prompt);
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
        if(scope.title!==undefined&&title!==undefined&&handoutTitleKey(title)!==handoutTitleKey(scope.title))
          throw Error('target_mismatch');
        const item=await options.state.forExport(options.sessionId,options.taskId,
          scope.title===undefined?{title,bookId}:{title:scope.title});check(signal);
        if(item.kind==='ambiguous'){
          const choices=await Promise.all(item.choices.map(async row=>({...row,title:await options.sanitize(row.title)})));
          check(signal);
          return result({error:'ambiguous',message:messages.ambiguous,choices},false);
        }
        if(scope.title!==undefined&&bookId!==undefined&&item.version.bookId!==bookId)throw Error('target_mismatch');
        const safeTitle=await options.sanitize(item.version.title);check(signal);
        observed={bookId:item.version.bookId,versionId:item.version.id,digest:item.version.digest};
        return result({...observed,title:safeTitle,revision:item.version.revision,chapterCount:item.content.chapters.length,
          location:'讲义 → 确认与版本',teacherConfirmed:true},true);
      } catch(rawError){return error(rawError,signal);}
    },
  },{
    name:EXPORT_TEACHING_HANDOUT,label:'导出确认讲义 Word',
    description:'用本轮读到的bookId/versionId/digest导出确切讲义。outputs按教师本轮指定的受众提交，audience=student或teacher和新相对.docx路径均不重复。文件名如标明学生版或教师版，必须与受众一致。学生版省略独立练习答案与教师附加内容，两份用saved_bundle target=current合并一次审批，单份用saved_office target=相对路径。编辑或来源变化应重新确认，不用普通文档工具重抄。',
    parameters:{type:'object',additionalProperties:false,required:['bookId','versionId','digest','outputs'],
      properties:{bookId:id,versionId,digest,outputs:{type:'array',minItems:1,maxItems:2,items:{type:'object',
        additionalProperties:false,required:['audience','path'],properties:{audience:{type:'string',enum:['student','teacher']},path:{type:'string',minLength:1,maxLength:500}}}}}} as ToolDefinition['parameters'],
    execute:async(...args)=>{
      const [,raw,signal]=args;
      try {
        check(signal);
        const {ref,outputs}=parseHandoutOutput(raw);
        if(!observed||observed.bookId!==ref.bookId||observed.versionId!==ref.versionId||observed.digest!==ref.digest)throw Error('source_required');
        assertHandoutOutputScope(scope,outputs);
        const item=await options.state.forExport(options.sessionId,options.taskId,ref);check(signal);
        if(item.kind!=='found')throw Error('ambiguous');
        const files:HandoutExportFile[]=outputs.map(output=>({kind:'office',fileId:'handout_'+output.audience,
          format:'docx',path:output.path,sources:[],draft:compileHandoutOffice(item,output.audience)}));
        return await options.publish(files,args);
      }catch(rawError){return error(rawError,signal);}
    },
  }];
}
