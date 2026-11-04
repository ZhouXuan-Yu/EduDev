import {paperTextBlocks} from './paper-table-blocks';
import {containsOfficeMath, officeMathChunks} from '../../shared/office-math';
import {validOfficeDraft, type OfficeDraft, type OfficeSection} from '../../shared/xiaozhi-office-draft';
import {PAPER_TABLE_OFFICE_SCHEMA, PAPER_OFFICE_SCHEMA, PAPER_RICH_OFFICE_SCHEMA, type PaperOfficeFigure, type PaperExportInput} from '../../shared/paper-export';
import type {PaperView} from '../../shared/paper-blueprint';
import type {PaperInstanceBlock, PaperInstanceRole} from '../../shared/paper-instance';
import {instanceReviewed, instanceDeliveryBlock, instanceSourceImage, instanceBlockText} from './paper-instance';
import {questionWebSourceParagraphs} from '../../shared/question-answer-attribution';
import {validNativeQuestionDocument, nativeQuestionComplete} from '../../shared/native-question';
import {hasTeacherTextPresentation,isCompleteQuestionDocument,validQuestionDocument} from '../../shared/question-document';
const roleOriginLabels={source:'原资料',teacher:'教师补充',ai_generated:'AI补充（待核验）',book_extracted:'独立答案册原文',web_extracted:'网页原文摘取（待核验）',missing:'缺失'} as const;
/** Compile ordered role blocks directly. Parent QuestionDocuments remain untouched. */
export function compileInstancePaperOffice(paper:PaperView,audience:PaperExportInput['audience']):OfficeDraft {
  const sections:OfficeSection[]=[{heading:'试卷说明',paragraphs:[`${paper.blueprint.grade} · ${paper.blueprint.subject} · ${paper.blueprint.durationMinutes} 分钟 · 满分 ${paper.totalPoints} 分`,audience==='student'?'学生卷 · 请在答题纸上作答。':'教师答案卷 · 参考答案和解析尚未独立核验，请逐题核对。']}];
  for(const group of paper.blueprint.sections) {
    sections.push({heading:group.label,paragraphs:[group.label]});
    for(const item of paper.selection.items.filter(i=>i.sectionId===group.id)) {
      const q=item.question,i=item.instance;
      if(!i||!instanceReviewed(i)||instanceDeliveryBlock(q,i)) throw Error('conflict');
      const heading=`${item.number}.（${item.points} 分）`;
      let continuation=0;
      const emit=(s:OfficeSection)=>{if(s.heading===heading){if(continuation++)s.heading=`${item.number} 题（续 ${continuation-1}）`;}sections.push(s);};
      const text=(value:string,title=heading)=>{
        for(const b of paperTextBlocks(value)) {
          if(b.table) emit({heading:title,paragraphs:[],table:b.table});
          else {const chunks=officeMathChunks(b.text);if(chunks.length) for(let n=0;n<chunks.length;n+=128) emit({heading:title,paragraphs:chunks.slice(n,n+128)});}
        }
      };
      const figure=(b:{blockId:string;assetId:string;sha256:string;width:number;height:number},role:PaperInstanceRole):PaperOfficeFigure=>({questionId:item.source.questionId,version:item.source.version,blockId:b.blockId,role,assetId:b.assetId,sha256:b.sha256,width:b.width,height:b.height,afterParagraph:0});
      const source=(role:PaperInstanceRole)=>{
        const doc=q.document,native=q.archive?.native,title=role==='question'?heading:role==='answer'?'参考答案':'解析';
        if(native) {
          if(!validNativeQuestionDocument(native)||!nativeQuestionComplete(native))throw Error('unsupported');
          const body=native.roles[role];
          if(body.figures.length) emit({heading:title,paragraphs:[],figures:body.figures.map(b=>figure(b,role))});
          else text(body.text,title);
          text(title+'来源：'+roleOriginLabels[body.origin],'来源');
          return;
        }
        if(doc) {
          if(!validQuestionDocument(doc)||!isCompleteQuestionDocument(doc))throw Error('unsupported');
          if(role==='question') {
            if(doc.context.presentation?.mode==='needs_review')throw Error('unsupported');
            const corrected=hasTeacherTextPresentation(doc);
            if(corrected)text(q.stem,title);
            const figures=(corrected?doc.context.presentation!.figureBlockIds:doc.context.sourceBlockIds).map(id=>{const b=doc.blocks.find(b=>b.id===id);if(!b||b.kind!=='image'||b.mime!=='image/png')throw Error('unsupported');return figure({...b,blockId:b.id},role);});
            if(figures.length)emit({heading:title,paragraphs:[],figures});return;
          }
          const evidence=doc[role];
          const images=doc.blocks.filter(b=>b.kind==='image'&&b.id.startsWith('source_'+role+'_'));
          if(images.length) {
            const figures=images.map(b=>{if(b.kind!=='image'||b.mime!=='image/png')throw Error('unsupported');return figure({...b,blockId:b.id},role);});
            // Match the old role semantics without retaining a screenshot after edit.
            if(evidence.origin!=='source'||!/\\(?:frac|sqrt|begin|sum|int|left|right)|\$[^$]+\$/.test(q[role]))text(q[role],title);
            emit({heading:title,paragraphs:[],figures});
            text(title+'来源：'+roleOriginLabels[evidence.origin],'来源');return;
          }
          text(q[role],title);
          text(title+'来源：'+roleOriginLabels[evidence.origin],'来源');return;
        }
        text(q[role==='question'?'stem':role],title);
      };
      for(const role of (audience==='student'?['question']:['question','answer','analysis']) as PaperInstanceRole[]) {
        const content=i.content[role];
        if(content.mode==='source'){source(role);continue;}
        const title=role==='question'?heading:role==='answer'?'参考答案（本卷编辑）':'解析（本卷编辑）';
        for(const b of content.blocks) {
          if(b.type==='sourceImage') {const image=instanceSourceImage(q,i,role,b);emit({heading:title,paragraphs:[],figures:[figure({...image,blockId:image.id},role)]});}
          else if(b.type==='table') {if(b.rows.length<2) text(b.rows[0].join('　'),title);else emit({heading:title,paragraphs:[],table:{columns:b.rows[0],rows:b.rows.slice(1)}});}
          else text(instanceBlockText(b),title);
        }
      }
      if(audience==='teacher')text([...questionWebSourceParagraphs(q),'题目来源：'+(q.sourceTitle||'教师本地题库')+'；本卷编辑已经教师核对，答案、解析尚未独立核验。'].join('\n'),'来源');
    }
  }
  const figures=sections.some(s=>!!s.figures?.length),tables=sections.some(s=>!!s.table);
  const math=sections.some(s=>[...s.paragraphs,...(s.table?[s.table.columns,...s.table.rows].flat().map(String):[])].some(containsOfficeMath));
  const simple=sections.length<=20 && !figures && !math;
  const draft:OfficeDraft={schemaVersion:figures&&!tables&&!math?PAPER_RICH_OFFICE_SCHEMA:simple?PAPER_OFFICE_SCHEMA:PAPER_TABLE_OFFICE_SCHEMA,title:paper.title+(audience==='teacher'?' · 教师答案卷':' · 学生卷'),sections,paperSource:{paperId:paper.id,digest:paper.digest!,audience}};
  if(!validOfficeDraft(draft))throw Error('too_large');
  return draft;
}
