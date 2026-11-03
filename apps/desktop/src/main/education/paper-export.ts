import {readPaperExportIntent,PAPER_EXPORT_SOURCE_CHANGED} from './paper-export-intent';
import {compileInstancePaperOffice} from './paper-instance-export';
import {editedInstanceChoiceLabels} from './paper-instance';
import {paperTextBlocks} from './paper-table-blocks';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {PaperView} from '../../shared/paper-blueprint';
import {PAPER_EXPORT_TOOL,PAPER_OFFICE_SCHEMA,PAPER_ANSWER_SHEET_OFFICE_SCHEMA,isPaperOfficeSchema,validPaperExport,validPaperExportIntent,copyPaperExportIntent,type PaperExportIntent,type PaperExportInput,type PaperExportTemplate} from '../../shared/paper-export';
import {containsOfficeMath} from '../../shared/office-math';
import {PAPER_PRINT_LAYOUT,paperAnswerNumber} from '../../shared/paper-print-layout';
import {compileRichPaperOffice} from './paper-rich-export';
import {questionWebSourceParagraphs} from '../../shared/question-answer-attribution';
import {validOfficeDraft,type OfficeDraft,type OfficeSection} from '../../shared/xiaozhi-office-draft';
import type {OfficeArtifactProposal} from '../../shared/xiaozhi-office-artifacts';
import type {PaperRepository} from './paper-repository';

export const ANSWER_SHEET_INSTRUCTIONS='请在答题卡对应题号处作答，保持卷面整洁；选择题将所选选项涂黑或打勾，填空题和解答题在规定横线内书写，超出部分无效。考试结束后只交回答题卡，不要在答题卡上书写与作答无关的内容。';
export type AnswerSheetSpacing='compact'|'standard'|'roomy';
/** Deterministic spacing from paper size; the export tool has no extra layout input. */
export const answerSheetSpacing=(paper:PaperView):AnswerSheetSpacing=>paper.selection.items.length>30?'compact':paper.selection.items.length>12?'standard':'roomy';
const ANSWER_LINE='____________________________________________';
const choiceLabels=(question:PaperView['selection']['items'][number]['question'])=>{
 const block=question.document?.blocks.find(b=>b.kind==='choices');
 return block?.kind==='choices'?block.options.map(option=>option.label):['A','B','C','D'];
};
/** Independent student answer sheet: numbers, points and blank areas only. Never answers or analyses. */
function compileAnswerSheet(paper:PaperView,audience:PaperExportInput['audience'],digest:string):OfficeDraft{
 if(audience!=='student')throw new Error('invalid_input');
 const spacing=answerSheetSpacing(paper),lines=spacing==='compact'?1:spacing==='roomy'?4:2;
 const sections:OfficeSection[]=[
  {heading:'考生信息',paragraphs:['姓名：________________　班级：________________　学号：________________　座位号：____________']},
  {heading:'考试信息',paragraphs:[`学科：${paper.blueprint.subject}　年级：${paper.blueprint.grade}　时长：${paper.blueprint.durationMinutes} 分钟　满分：${paper.totalPoints} 分`]},
  {heading:'答题说明',paragraphs:[ANSWER_SHEET_INSTRUCTIONS]}
 ];
 for(const section of paper.blueprint.sections){
  const paragraphs:string[]=[];
  for(const item of paper.selection.items.filter(i=>i.sectionId===section.id)){
   const type=item.question.questionType;
   paragraphs.push(`${item.number}.（${item.points} 分）`);
   if(/选择|单选|多选/.test(type)){
    const edited=item.instance?editedInstanceChoiceLabels(item.question,item.instance):undefined;
    if(edited&&edited.length<2)throw new Error('conflict');
    paragraphs.push('选项：'+(edited??choiceLabels(item.question)).map(label=>`${label} □`).join('　'));
   }
   else{
    const lead=/填空/.test(type)?'答：':'解：';paragraphs.push(lead+ANSWER_LINE);
    for(let index=1;index<lines;index++)paragraphs.push(ANSWER_LINE);
   }
  }
  if(!paragraphs.length)paragraphs.push(section.label);
  for(let offset=0;offset<paragraphs.length;offset+=100)sections.push({heading:section.label+(offset?'（续）':''),paragraphs:paragraphs.slice(offset,offset+100)});
 }
 const draft:OfficeDraft={schemaVersion:PAPER_ANSWER_SHEET_OFFICE_SCHEMA,title:'答题卡',sections,paperSource:{paperId:paper.id,digest,audience:'student',template:'answer_sheet'}};
 if(!validOfficeDraft(draft))throw new Error('too_large');return draft;
}
/** Deterministic compilation. Rich documents stay fail-closed until image/math delivery is accepted. */
export function compilePaperOffice(paper:PaperView,audience:PaperExportInput['audience'],template:PaperExportTemplate='paper'):OfficeDraft{
 const draft=compileLegacyPaperOffice(paper,audience,template);
 if(!('paperSource' in draft))throw Error('configuration');
 draft.paperSource.printLayout=PAPER_PRINT_LAYOUT;
 if(template==='answer_sheet'){
  const grouped:OfficeSection[]=[];
  for(const section of draft.sections){
   if(!section.paragraphs.some(paperAnswerNumber)){grouped.push(section);continue;}
   let area:OfficeSection|undefined;
   for(const paragraph of section.paragraphs){
    if(paperAnswerNumber(paragraph)){area={heading:section.heading+' · '+paragraph,paragraphs:[],printKind:'answer_area'};grouped.push(area);}
    else{if(!area)throw Error('configuration');area.paragraphs.push(paragraph);}
   }
  }
  draft.sections=grouped;
 }else{
  const headings=new Set(paper.blueprint.sections.map(s=>s.label));
  for(const section of draft.sections)if(headings.has(section.heading)&&section.paragraphs.length===1&&section.paragraphs[0]===section.heading&&!section.figures&&!section.table){section.paragraphs=[];section.printKind='heading';}
 }
 if(!validOfficeDraft(draft))throw Error('too_large');
 return draft;
}
/** Old persisted drafts retain their exact semantic sections and renderer. */
function compileLegacyPaperOffice(paper:PaperView,audience:PaperExportInput['audience'],template:PaperExportTemplate):OfficeDraft{
 if(template!=='paper'&&template!=='answer_sheet')throw new Error('invalid_input');
 if(paper.state!=='confirmed'||!paper.complete||!paper.sourceCurrent||!paper.digest)throw new Error('conflict');
 if(!['student','teacher'].includes(audience))throw new Error('invalid_input');
 if(template==='answer_sheet')return compileAnswerSheet(paper,audience,paper.digest);
 if(paper.selection.items.some(i=>!!i.instance))return compileInstancePaperOffice(paper,audience);
 if(paper.selection.items.some(i=>!!i.question.document||!!i.question.archive?.native||[i.question.stem,...(audience==='teacher'?[i.question.answer,i.question.analysis]:[])].some(text=>containsOfficeMath(text)||paperTextBlocks(text).some(block=>!!block.table))))return compileRichPaperOffice(paper,audience);
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
   if(audience==='teacher')paragraphs.push(...chunks('参考答案：'+q.answer),...chunks('解析：'+q.analysis),...questionWebSourceParagraphs(q).flatMap(chunks),...chunks('题目来源：'+(q.sourceTitle||'教师本地题库')+'；答案、解析尚未独立核验。'));
  }
  for(let offset=0;offset<paragraphs.length;offset+=20)sections.push({heading:section.label+(offset?'（续）':''),paragraphs:paragraphs.slice(offset,offset+20)});
 }
 const draft:OfficeDraft={schemaVersion:PAPER_OFFICE_SCHEMA,title:paper.title+(audience==='teacher'?' · 教师答案卷':' · 学生卷'),sections,paperSource:{paperId:paper.id,digest:paper.digest,audience}};
 if(!validOfficeDraft(draft))throw new Error('too_large');return draft;
}
export function assertPaperOffice(paper:PaperView,draft:OfficeDraft){
 if(!isPaperOfficeSchema(draft.schemaVersion)||!('paperSource'in draft)||paper.id!==draft.paperSource.paperId||paper.digest!==draft.paperSource.digest)throw new Error('conflict');
 if(draft.paperSource.printLayout!==undefined&&draft.paperSource.printLayout!==PAPER_PRINT_LAYOUT)throw Error('conflict');
 const template=draft.paperSource.template??'paper';
 if((template==='answer_sheet')!==(draft.schemaVersion===PAPER_ANSWER_SHEET_OFFICE_SCHEMA)||template==='answer_sheet'&&draft.paperSource.audience!=='student')throw new Error('conflict');
 const expected=draft.paperSource.printLayout===undefined?compileLegacyPaperOffice(paper,draft.paperSource.audience,template):compilePaperOffice(paper,draft.paperSource.audience,template);
 if(expected.schemaVersion!==draft.schemaVersion||JSON.stringify(expected.sections)!==JSON.stringify(draft.sections))throw new Error('conflict');
}
type Wait=(action:()=>Promise<boolean>)=>Promise<boolean>;
type RunOffice=(sessionId:string,runId:string,wait:Wait,callId:string,raw:OfficeArtifactProposal,signal?:AbortSignal)=>ReturnType<ToolDefinition['execute']>;
function officeConflict(result:Awaited<ReturnType<RunOffice>>):boolean{
 return !!result.isError&&result.content.some(part=>{
  if(part.type!=='text')return false;
  try{const receipt=JSON.parse(part.text);return receipt?.error==='conflict'||receipt?.outcome==='conflict';}catch{return false;}
 });
}
export function createPaperExportTool(options:{papers:Pick<PaperRepository,'latest'> & Partial<Pick<PaperRepository,'review'>>;paperExportIntent?:PaperExportIntent;sessionId:string;runId:string;current:()=>boolean;wait:Wait;runOffice:RunOffice}):ToolDefinition[]{
 const supplied=options.paperExportIntent;
 const invalid=supplied!==undefined&&!validPaperExportIntent(supplied);
 const intent=supplied&&!invalid?copyPaperExportIntent(supplied):undefined;
 return [{name:PAPER_EXPORT_TOOL,label:'导出已确认试卷',description:(intent?'本轮已绑定老师点选的确切确认卷，只允许format='+intent.format+'、audience='+intent.audience+'、template='+intent.template+'；由宿主精确读取，失效时不可换卷或重试其他规格。':'')+'将本会话最新已确认的完整试卷确定性导出为学生卷、教师答案卷或答题卡，并等待教师办公文档审批。只提供format(docx/pdf)、audience(student/teacher)、path(授权目录内不存在的相对文件名)，可选template(paper/answer_sheet，默认paper)；答题卡固定使用学生卷且不含答案或解析。不提供题目、答案、ID或版本；不重新抄题或补题。可使用本会话已授权的试卷保存位置，无需另选教学工作目录；没有可用保存位置时请教师选择，实际授权由宿主校验。已确认完整图文题保留本地原图，教师逐版本核对图片后批准；不支持或不完整的题面明确拒绝，不能退回摘要生成。拒绝或停止后不重复写入。',
  parameters:{type:'object',additionalProperties:false,required:['format','audience','path'],properties:{format:{type:'string',enum:['docx','pdf']},audience:{type:'string',enum:['student','teacher']},path:{type:'string',minLength:1,maxLength:500},template:{type:'string',enum:['paper','answer_sheet']}}} as ToolDefinition['parameters'],
  execute:async(callId,raw,signal)=>{
   const current=()=>{signal?.throwIfAborted();if(!options.current())throw new Error('permission_denied');};
   try{current();if(invalid||!validPaperExport(raw))throw new Error('invalid_input');
    if(intent&&(raw.format!==intent.format||raw.audience!==intent.audience||(raw.template??'paper')!==intent.template))throw new Error('conflict');
    if(intent&&!options.papers.review)throw new Error('configuration');
    const paper=intent?await readPaperExportIntent(options.papers as Pick<PaperRepository,'review'>,options.sessionId,intent):await options.papers.latest(options.sessionId);
    current();if(!paper)throw new Error('not_found');
    const draft=compilePaperOffice(paper,raw.audience,raw.template??'paper');current();
    const result=await options.runOffice(options.sessionId,options.runId,options.wait,callId,{path:raw.path,format:raw.format,draft,sources:[]},signal);
    if(intent&&officeConflict(result)){
     // Classify only a proven changed binding. A target-file conflict or teacher rejection stays an Office outcome.
     try{await readPaperExportIntent(options.papers as Pick<PaperRepository,'review'>,options.sessionId,intent);}
     catch(error){if(error instanceof Error&&error.message===PAPER_EXPORT_SOURCE_CHANGED)throw error;}
     current();
    }
    return result;
   }catch(error){if(signal?.aborted||(error as Error).message==='cancelled')throw error;
    const messages:Record<string,string>={not_found:'本会话没有已确认试卷，请先组卷并核对确认。',conflict:'试卷未完整确认或题目来源已变化，请回到组卷核对后重新确认。',unsupported:'此卷含未确认完整题面或缺少可用公式原图的答案，不能完整导出，未生成文件；请返回题库补全核对。',too_large:'完整试卷超过当前文档容量，未截断或生成文件。请拆分试卷后重试。',invalid_input:'请选择学生卷、教师答案卷或答题卡、Word或PDF，并提供授权目录内的新文件名。',permission_denied:'当前任务或工作目录授权已失效。'};
    messages[PAPER_EXPORT_SOURCE_CHANGED]='这份确认卷已被替代或来源已变化，未生成新的导出文件。请回到组卷重新核对并准备请求；原文件保留。';
    const code=(error as Error).message;return{content:[{type:'text',text:JSON.stringify({success:false,...(code===PAPER_EXPORT_SOURCE_CHANGED?{error:code}:{}),message:messages[code]||'试卷导出未完成，请检查实际状态后重试。'})}],details:{success:false},isError:true};}
  }}];
}
