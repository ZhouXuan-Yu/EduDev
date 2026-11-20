import type {NativeAiQuestion} from '../../shared/material-ai-native-response';
import {validWordQuestionSource,wordQuestionBlocks,wordQuestionText,wordParagraphMap,type WordQuestionSource,type WordSourceSpan} from '../../shared/material-word-question';
import {administrativeLine,plainPreambleText,preambleWindow} from './word-preamble';

const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const compact=(text:string)=>text.replace(/[ \t\r\n\u3000]+/gu,(space,at:number)=>{
 // Keep a separator between non-Han word/number tokens. In particular, 1 0 and 10
 // or two adjacent Latin variables cannot be treated as a presentation difference.
 const token=/[\p{Script=Latin}\p{Script=Greek}\p{Number}]/u;
 return token.test(text[at-1]??'')&&token.test(text[at+space.length]??'')?' ':'';
});
function body(text:string,number:string){
 const prefix=text.match(/^[ \t\r\n\u3000]*(\d{1,5})(?:[.．](?![0-9０-９])|[、)）])[ \t\u3000]*/u);
 return compact(prefix?.[1]===number?text.slice(prefix[0].length):text);
}
function sameRanges(before:WordQuestionSource,after:WordQuestionSource,spans:WordSourceSpan[]){
 return spans.every(span=>{
  const left=before.blocks.find(block=>block.id===span.blockId),right=after.blocks.find(block=>block.id===span.blockId);
  return !!left&&!!right&&left.kind==='paragraph'&&right.kind==='paragraph'
   &&equal(left.anchor,right.anchor)&&equal(left.numbering,right.numbering)&&equal(left.inlines,right.inlines)
   &&equal(left.warnings??[],right.warnings??[]);
 });
}
function plainRole(source:WordQuestionSource,role:'question'|'answer'|'analysis'){
 const blocks=wordQuestionBlocks(source,role);
 if(blocks.some(block=>plainPreambleText(block)===undefined))return;
 return wordQuestionText(blocks);
}
function optionTail(text:string){
 const marks=[...text.matchAll(/(?:^|[ \t\r\n\u3000])(?:[（(]([A-H])[）)]|([A-H])[.．、])/gu)];
 if(marks.length<2||marks.length>8)return;
 const labels=marks.map(mark=>mark[1]||mark[2]);
 if(labels.some((label,index)=>label!==String.fromCharCode(65+index)))return;
 for(let index=0;index<marks.length;index++){
  const start=marks[index].index!+marks[index][0].length,end=marks[index+1]?.index??text.length;
  if(!compact(text.slice(start,end)))return;
 }
 return {text:text.slice(marks[0].index!).trim(),labels};
}

/** Caller must re-read the same resource/version's current v5 document and derive
 * current from indexWordQuestions. Validate the actual parser policy at that boundary.
 * This deliberately supports only text-only choice questions with printed answers.
 */
export function nativeLayoutProof(frozen:WordQuestionSource,current:WordQuestionSource,first:NativeAiQuestion,final:NativeAiQuestion):boolean{
 try{
  if(!validWordQuestionSource(frozen)||!validWordQuestionSource(current)
   ||frozen.ordinal!==current.ordinal||frozen.number!==current.number||frozen.documentSha===current.documentSha
   ||current.issues.length||!frozen.issues.includes('shared_context')
   ||frozen.issues.some(issue=>!['shared_context','source_warning','separate_answers'].includes(issue)))return false;
  // Reject all media, tables and formulas rather than comparing their text projections.
  if([frozen,current].some(source=>source.assets.length||source.blocks.some(block=>block.kind!=='paragraph'||block.inlines.some(inline=>inline.kind!=='text'))))return false;
  const oldSpans=frozen.parts.question,newSpans=current.parts.question,removed=oldSpans.length-newSpans.length;
  if(removed<=0||!newSpans.length||!equal(oldSpans.slice(removed),newSpans)||!sameRanges(frozen,current,newSpans))return false;
  const extras=oldSpans.slice(0,removed).map(span=>{
   const block=frozen.blocks.find(block=>block.id===span.blockId);
   if(!block||block.kind!=='paragraph'||block.numbering||plainPreambleText(block)===undefined
    ||(span.from??0)!==0||(span.to??wordParagraphMap(block).length)!==wordParagraphMap(block).length)throw Error('unsupported_prefix');
   return block;
  });
  const hasTitle=preambleWindow(extras,true).hasTitle;
  if(!hasTitle||extras.some(block=>!wordParagraphMap(block).split('\n').every(line=>administrativeLine(line,hasTitle,true))))return false;
  const question=plainRole(current,'question'),answer=plainRole(current,'answer'),analysis=plainRole(current,'analysis');
  const oldAnswer=plainRole(frozen,'answer'),oldAnalysis=plainRole(frozen,'analysis');
  if(question===undefined||answer===undefined||analysis===undefined||oldAnswer===undefined||oldAnalysis===undefined
   ||!current.parts.answer.length||!/^[A-H]$/u.test(answer.trim())
   ||frozen.parts.answer.length>0&&(oldAnswer!==answer||!equal(frozen.parts.answer,current.parts.answer)||!sameRanges(frozen,current,current.parts.answer))
   ||!equal(frozen.parts.analysis,current.parts.analysis)||!sameRanges(frozen,current,current.parts.analysis)||analysis!==oldAnalysis)return false;
  const options=optionTail(question);
  if(!options||!options.labels.includes(answer.trim()))return false;
  if(first.analysis!==final.analysis)return false;
  return [first,final].every(result=>{
   const projection=result.projection;
   return result.number===current.number&&!result.requiresImage&&!result.issues.length
    &&result.answer===answer.trim()&&body(result.stem,current.number)===body(question,current.number)
    &&projection.statement.state==='provided'&&projection.statement.text===result.stem
    &&projection.choices.state==='provided'&&compact(projection.choices.text)===compact(options.text)
    &&(['formulas','tables','figures','subquestions'] as const).every(role=>projection[role].state==='not_applicable'&&projection[role].text==='')
    &&(!analysis||result.analysis===analysis);
  });
 }catch{return false;}
}
