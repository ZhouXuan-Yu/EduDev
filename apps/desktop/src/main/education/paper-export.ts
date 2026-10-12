import {paperTextBlocks} from './paper-table-blocks';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {PaperView} from '../../shared/paper-blueprint';
import {PAPER_EXPORT_TOOL,PAPER_OFFICE_SCHEMA,isPaperOfficeSchema,validPaperExport,type PaperExportInput} from '../../shared/paper-export';
import {containsOfficeMath} from '../../shared/office-math';
import {compileRichPaperOffice} from './paper-rich-export';
import {validOfficeDraft,type OfficeDraft,type OfficeSection} from '../../shared/xiaozhi-office-draft';
import type {OfficeArtifactProposal} from '../../shared/xiaozhi-office-artifacts';
import type {PaperRepository} from './paper-repository';

/** Deterministic compilation. Rich documents stay fail-closed until image/math delivery is accepted. */
export function compilePaperOffice(paper:PaperView,audience:PaperExportInput['audience']):OfficeDraft{
 if(paper.state!=='confirmed'||!paper.complete||!paper.sourceCurrent||!paper.digest)throw new Error('conflict');
 if(!['student','teacher'].includes(audience))throw new Error('invalid_input');
 if(paper.selection.items.some(i=>!!i.question.document||[i.question.stem,...(audience==='teacher'?[i.question.answer,i.question.analysis]:[])].some(text=>containsOfficeMath(text)||paperTextBlocks(text).some(block=>!!block.table))))return compileRichPaperOffice(paper,audience);
 const sections:OfficeSection[]=[{heading:'试卷说明',paragraphs:[`${paper.blueprint.grade} · ${paper.blueprint.subject} · ${paper.blueprint.durationMinutes} 分钟 · 满分 ${paper.totalPoints} 分`,
  audience==='student'?'学生卷 · 请在答题纸上作答。':'教师答案卷 · 参考答案和解析尚未独立核验，请逐题核对。']}];
 const chunks=(text:string)=>{const result:string[]=[];let value='';for(const c of text){if(value.length+c.length>1000){result.push(value);value='';}value+=c;}if(value)result.push(value);return result;};
 for(const section of paper.blueprint.sections){
  const paragraphs:string[]=[];
  for(const item of paper.selection.items.filter(i=>i.sectionId===section.id)){
   const q=item.question;
   // Never export a scanned/structured question as its abbreviated scalar stem.
   if(q.document||/\\(?:frac|sqrt|begin|sum|int|left|right)|\$[^$]+\$/.test([q.stem,...(audience==='teacher'?[q.answer,q.analysis]:[])].join('\n')))throw new Error('unsupported');
   paragraphs.push(...chunks(`${item.number}.（${item.points} 分）${q.stem}`));
   if(audience==='teacher')paragraphs.push(...chunks('参考答案：'+q.answer),...chunks('解析：'+q.analysis),...chunks('题目来源：'+(q.sourceTitle||'教师本地题库')+'；答案、解析尚未独立核验。'));
  }
  for(let offset=0;offset<paragraphs.length;offset+=20)sections.push({heading:section.label+(offset?'（续）':''),paragraphs:paragraphs.slice(offset,offset+20)});
 }
 const draft:OfficeDraft={schemaVersion:PAPER_OFFICE_SCHEMA,title:paper.title+(audience==='teacher'?' · 教师答案卷':' · 学生卷'),sections,paperSource:{paperId:paper.id,digest:paper.digest,audience}};
 if(!validOfficeDraft(draft))throw new Error('too_large');return draft;
}
export function assertPaperOffice(paper:PaperView,draft:OfficeDraft){
 if(!isPaperOfficeSchema(draft.schemaVersion)||!('paperSource'in draft)||paper.id!==draft.paperSource.paperId||paper.digest!==draft.paperSource.digest)throw new Error('conflict');
 const expected=compilePaperOffice(paper,draft.paperSource.audience);
 if(expected.schemaVersion!==draft.schemaVersion||JSON.stringify(expected.sections)!==JSON.stringify(draft.sections))throw new Error('conflict');
}
type Wait=(action:()=>Promise<boolean>)=>Promise<boolean>;
type RunOffice=(sessionId:string,runId:string,wait:Wait,callId:string,raw:OfficeArtifactProposal,signal?:AbortSignal)=>ReturnType<ToolDefinition['execute']>;
export function createPaperExportTool(options:{papers:Pick<PaperRepository,'latest'>;sessionId:string;runId:string;current:()=>boolean;wait:Wait;runOffice:RunOffice}):ToolDefinition[]{
 return [{name:PAPER_EXPORT_TOOL,label:'导出已确认试卷',description:'将本会话最新已确认的完整试卷确定性导出为学生卷或教师答案卷，并等待教师办公文档审批。只提供format(docx/pdf)、audience(student/teacher)、path(授权目录内不存在的相对文件名)。不提供题目、答案、ID或版本；不重新抄题或补题。需要先选择教学工作目录。已确认完整图文题保留本地原图，教师逐版本核对图片后批准；不支持或不完整的题面明确拒绝，不能退回摘要生成。拒绝或停止后不重复写入。',
  parameters:{type:'object',additionalProperties:false,required:['format','audience','path'],properties:{format:{type:'string',enum:['docx','pdf']},audience:{type:'string',enum:['student','teacher']},path:{type:'string',minLength:1,maxLength:500}}} as ToolDefinition['parameters'],
  execute:async(callId,raw,signal)=>{
   const current=()=>{signal?.throwIfAborted();if(!options.current())throw new Error('permission_denied');};
   try{current();if(!validPaperExport(raw))throw new Error('invalid_input');const paper=await options.papers.latest(options.sessionId);current();if(!paper)throw new Error('not_found');
    const draft=compilePaperOffice(paper,raw.audience);current();return await options.runOffice(options.sessionId,options.runId,options.wait,callId,{path:raw.path,format:raw.format,draft,sources:[]},signal);
   }catch(error){if(signal?.aborted||(error as Error).message==='cancelled')throw error;
    const messages:Record<string,string>={not_found:'本会话没有已确认试卷，请先组卷并核对确认。',conflict:'试卷未完整确认或题目来源已变化，请回到组卷核对后重新确认。',unsupported:'此卷含未确认完整题面或缺少可用公式原图的答案，不能完整导出，未生成文件；请返回题库补全核对。',too_large:'完整试卷超过当前文档容量，未截断或生成文件。请拆分试卷后重试。',invalid_input:'请选择学生卷或教师答案卷、Word或PDF，并提供授权目录内的新文件名。',permission_denied:'当前任务或工作目录授权已失效。'};
    const code=(error as Error).message;return{content:[{type:'text',text:JSON.stringify({success:false,message:messages[code]||'试卷导出未完成，请检查实际状态后重试。'})}],details:{success:false},isError:true};}
  }}];
}
