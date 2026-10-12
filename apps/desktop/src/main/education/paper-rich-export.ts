import {paperTextBlocks} from './paper-table-blocks';
import type {PaperView} from '../../shared/paper-blueprint';
import {QUESTION_DOCUMENT_COMPLETE_SCHEMA,validQuestionDocument} from '../../shared/question-document';
import {PAPER_RICH_OFFICE_SCHEMA,PAPER_MATH_OFFICE_SCHEMA,PAPER_TABLE_OFFICE_SCHEMA,type PaperOfficeFigure,type PaperExportInput} from '../../shared/paper-export';
import {validOfficeDraft,type OfficeDraft,type OfficeSection} from '../../shared/xiaozhi-office-draft';
import {containsOfficeMath,officeMathChunks,officeMathHtml,officeMathParts} from '../../shared/office-math';
export const containsLatex=(text:string)=>/\\(?:frac|sqrt|begin|sum|int|left|right)|\$[^$]+\$/.test(text);
const chunks=(text:string)=>{const values:string[]=[];let value='';for(const c of text){if(value.length+c.length>1000){values.push(value);value='';}value+=c;}if(value)values.push(value);return values;};
/** Exact confirmed source crops, never the scalar/OCR summary of a rich question. */
export function compileRichPaperOffice(paper:PaperView,audience:PaperExportInput['audience']):OfficeDraft{
 const math=paper.selection.items.some(i=>[...(i.question.document?[]:[i.question.stem]),...(audience==='teacher'?(['answer','analysis'] as const).filter(role=>!(i.question.document?.[role].origin==='source'&&i.question.document.blocks.some(b=>b.kind==='image'&&b.id.startsWith('source_'+role+'_')))).map(role=>i.question[role]):[])].some(containsOfficeMath));
 const plainSplit=math?officeMathChunks:chunks;const split=(text:string)=>paperTextBlocks(text).some(b=>!!b.table)?[text]:plainSplit(text);
 const sections:OfficeSection[]=[{heading:'试卷说明',paragraphs:[`${paper.blueprint.grade} · ${paper.blueprint.subject} · ${paper.blueprint.durationMinutes} 分钟 · 满分 ${paper.totalPoints} 分`,
  audience==='student'?'学生卷 · 请在答题纸上作答。':'教师答案卷 · 参考答案和解析尚未独立核验，请逐题核对。',
  math?'图文题保留教师确认的原图。Word中的排版公式以图片交付，非可编辑公式。请核对题面、公式、清晰度及答案和个人信息隔离。':'图文题保留教师确认的原图，公式不是可编辑数学对象。请核对全部题面、清晰度与图片中的答案和个人信息。']}];
 for(const group of paper.blueprint.sections){
  sections.push({heading:group.label,paragraphs:[]});
  for(const item of paper.selection.items.filter(i=>i.sectionId===group.id)){
   const q=item.question,doc=q.document,paragraphs:string[]=[],figures:PaperOfficeFigure[]=[];
   const addImage=(id:string,role:PaperOfficeFigure['role'])=>{if(!doc)throw new Error('unsupported');const b=doc.blocks.find(b=>b.id===id);if(!b||b.kind!=='image'||b.mime!=='image/png')throw new Error('unsupported');figures.push({questionId:q.id,version:item.source.version,blockId:b.id,role,assetId:b.assetId,sha256:b.sha256,width:b.width,height:b.height,afterParagraph:paragraphs.length});};
   if(doc){
    if(!validQuestionDocument(doc)||doc.schemaVersion!==QUESTION_DOCUMENT_COMPLETE_SCHEMA)throw new Error('unsupported');
    paragraphs.push('完整题面（原图，按顺序阅读）：');
    for(const id of doc.context.sourceBlockIds)addImage(id,'question');
   }else{if(!math&&containsLatex(q.stem))throw new Error('unsupported');paragraphs.push(...split(q.stem));}
   if(audience==='teacher'){
    for(const role of ['answer','analysis'] as const){
     const title=role==='answer'?'参考答案':'解析',text=q[role],evidence=doc?.[role],roleImages=doc?.blocks.filter(b=>b.kind==='image'&&b.id.startsWith('source_'+role+'_'))||[];
     if(containsLatex(text)&&evidence?.origin==='source'&&roleImages.length){
      if(evidence?.origin!=='source'||!roleImages.length)throw new Error('unsupported');
      paragraphs.push(title+'（来源原图，尚未独立核验）：');
     }else paragraphs.push(...split(title+'：'+text));
     for(const b of roleImages)addImage(b.id,role);
     if(evidence)paragraphs.push(title+'来源：'+({source:'原资料',teacher:'教师补充',ai_generated:'AI补充（待核验）',missing:'缺失'}[evidence.origin]));
    }
    paragraphs.push(...chunks('题目来源：'+(q.sourceTitle||'教师本地题库')+'；答案、解析尚未独立核验。'));
   }
   sections.push({heading:`${item.number}.（${item.points} 分）`,paragraphs,...(figures.length?{figures}:{})});
  }
 }
 let tables=false;
 // Split in display order using the existing section/table contract. Do not move
 // the question after a table or teacher explanations into the student paper.
 const ordered:OfficeSection[]=[];
 for(const section of sections){
  if(section.figures){ordered.push(section);continue;}
  let current:OfficeSection={heading:section.heading,paragraphs:[]};let part=0;
  for(const paragraph of section.paragraphs)for(const block of paperTextBlocks(paragraph)){
   if(block.table){tables=true;current.table=block.table;ordered.push(current);current={heading:section.heading+'（续'+(++part)+'）',paragraphs:[]};}
   else current.paragraphs.push(...split(block.text));
  }
  if(current.paragraphs.length||part===0)ordered.push(current);
 }
 sections.splice(0,sections.length,...ordered);
 // Empty group headings get one accessible label; keep the strict old schema unchanged.
 for(const s of sections)if(!s.paragraphs.length&&!s.figures)s.paragraphs.push(s.heading);
 if(math){let count=0;for(const s of sections)for(const p of [...s.paragraphs,...(s.table?[s.table.columns,...s.table.rows].flat().map(String):[])]){count+=officeMathParts(p).filter(v=>v.kind==='math').length;if(count>200)throw Error('too_large');officeMathHtml(p);}}
 const draft:OfficeDraft={schemaVersion:tables?PAPER_TABLE_OFFICE_SCHEMA:math?PAPER_MATH_OFFICE_SCHEMA:PAPER_RICH_OFFICE_SCHEMA,title:paper.title+(audience==='teacher'?' · 教师答案卷':' · 学生卷'),sections,paperSource:{paperId:paper.id,digest:paper.digest!,audience}};
 if(!validOfficeDraft(draft))throw new Error('too_large');return draft;
}
