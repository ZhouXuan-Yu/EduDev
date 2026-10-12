import type {QuestionDraft} from './question-draft';

export type GeneratedQuestionCompletenessIssue='generated_figure_not_delivered'|'generated_table_not_delivered'|'generated_part_answer_missing'|'generated_part_analysis_missing';
/** Explicit paragraph/statement numbering only; do not interpret coordinates or function arguments. */
function numberedSections(text:string):{id:number;body:string}[]{
 const safe=text.replace(/```[^]*?```/g,'').replace(/~~~[^]*?~~~/g,'');
 const matches=Array.from(safe.matchAll(/(?:^|[\n；;。])\s*[（(]([1-9]|1[0-9]|20)[）)]\s*/g));
 return matches.map((m,i)=>({id:Number(m[1]),body:safe.slice(m.index!+m[0].length,matches[i+1]?.index??safe.length).trim().replace(/^[\s:：,，;；。]+|[\s:：,，;；。]+$/g,'')}));
}
export function generatedQuestionParts(q:Pick<QuestionDraft,'questionType'|'stem'>):number[]{
 if(!['short_answer','written'].includes(q.questionType))return [];
 const sections=numberedSections(q.stem);
 return sections.length>=2&&sections.every((s,i)=>s.id===i+1&&s.body.length>0)?sections.map(s=>s.id):[];
}
export function generatedQuestionPartCoverage(q:Pick<QuestionDraft,'questionType'|'stem'|'answer'|'analysis'>){
 const required=generatedQuestionParts(q);
 const missing=(text:string)=>{const sections=numberedSections(text);return required.filter(id=>sections.filter(s=>s.id===id&&s.body.length>0).length!==1);};
 return {required,answerMissing:missing(q.answer),analysisMissing:missing(q.analysis)};
}
export function retainsGeneratedQuestionParts(parent:Pick<QuestionDraft,'questionType'|'stem'>,child:Pick<QuestionDraft,'questionType'|'stem'>):boolean{
 const required=generatedQuestionParts(parent),next=generatedQuestionParts(child);
 return required.length===0||(next.length===required.length&&required.every((id,i)=>next[i]===id));
}
/** Generated drafts have no image attachment contract. References and remote URLs are not delivery. */
export function generatedQuestionCompleteness(q:Pick<QuestionDraft,'stem'|'options'> & Partial<Pick<QuestionDraft,'questionType'|'answer'|'analysis'>>):GeneratedQuestionCompletenessIssue[]{
 const text=[q.stem,...Object.values(q.options||{})].join('\n'),issues:GeneratedQuestionCompletenessIssue[]=[];
 if(/如图(?:所示)?|(?:见|看|参照|根据)下?图|[上下左右]图|图[甲乙丙丁]|图中|\b(?:as\s+shown\s+in|refer\s+to|see)\s+(?:the\s+)?(?:figure|diagram|graph|picture)\b|\b(?:figure|diagram|graph|picture)\s+(?:below|above)\b|!\[[^\]\n]*\]\s*\(|<\s*(?:img|svg)\b/i.test(text))issues.push('generated_figure_not_delivered');
 // Require a real Markdown table (header, separator, at least one populated data row).
 const lines=q.stem.split(/\r?\n/),table=lines.some((line,i)=>{
  const cells=(s:string)=>s.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim());
  if(i<1||i+1>=lines.length||!line.includes('|'))return false;
  const header=cells(lines[i-1]),separator=cells(line),row=cells(lines[i+1]);
  return header.length>=2&&header.every(Boolean)&&separator.length===header.length&&separator.every(c=>/^:?-{3,}:?$/.test(c))&&row.length===header.length&&row.every(Boolean);
 });
 if(/下表|见表|表中(?:所示|给出|数据)|\b(?:following\s+table|table\s+below)\b/i.test(text)&&!table)issues.push('generated_table_not_delivered');
 if(q.questionType&&q.answer!==undefined&&q.analysis!==undefined){
  const coverage=generatedQuestionPartCoverage({questionType:q.questionType,stem:q.stem,answer:q.answer,analysis:q.analysis});
  if(coverage.answerMissing.length)issues.push('generated_part_answer_missing');
  if(coverage.analysisMissing.length)issues.push('generated_part_analysis_missing');
 }
 return issues;
}
