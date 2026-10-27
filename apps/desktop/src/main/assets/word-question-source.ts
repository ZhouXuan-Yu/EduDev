import {createHash} from 'node:crypto';
import {validWordDocument,type WordDocument,type WordBlock} from '../../shared/material-word';
import {WORD_QUESTION_SCHEMA,WORD_QUESTION_BYTES,WORD_QUESTION_ROLES,wordParagraphMap,wordQuestionBlocks,wordQuestionText,validWordQuestionSource,type WordQuestionSource,type WordQuestionRole,type WordSourceSpan,type WordQuestionIssue,type WordQuestionSummary} from '../../shared/material-word-question';

type Builder={number:string;blocks:WordBlock[];parts:Record<WordQuestionRole,WordSourceSpan[]>;issues:Set<WordQuestionIssue>};
type Event={at:number;after:number;number?:string;role?:WordQuestionRole};
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const numberOf=(text:string)=>text.match(/^\s*(?:第\s*(\d{1,5})\s*题|([0-9]{1,5})[.．、)）])/u)?.slice(1).find(Boolean);
const roleOf=(text:string):WordQuestionRole=>/解析|分析|解答/u.test(text)?'analysis':'answer';
const questionEvents=(text:string):Event[]=>[...text.matchAll(/(?:^|\n)[ \t]*(?:第\s*(\d{1,5})\s*题[.．、:：]?|([0-9]{1,5})[.．、][ \t]*(?![0-9]))/gu)].map(m=>({at:m.index!+(m[0].startsWith('\n')?1:0),after:m.index!+(m[0].startsWith('\n')?1:0),number:m[1]||m[2]}));
const roleEvents=(text:string):Event[]=>[...text.matchAll(/【(?:参考答案|答案|解析|分析|解答)】|\[(?:参考答案|答案|解析|分析|解答)\]|(?:^|\n)[ \t]*(?:参考答案|答案|解析|分析|解答)[：:]/gu)].map(m=>({at:m.index!,after:m.index!+m[0].length,role:roleOf(m[0])}));
const walk=(blocks:WordBlock[]):WordBlock[]=>blocks.flatMap(b=>b.kind==='table'?[b,...b.rows.flatMap(r=>r.cells.flatMap(c=>walk(c.blocks)))]:[b]);

/** One linear pass over the parsed native document; each question is materialized on demand. */
export function indexWordQuestions(document:WordDocument){
 if(!validWordDocument(document))throw Error('source_changed');
 const documentSha=digest(document),mainPart=document.blocks[0]?.anchor.part,builders:Builder[]=[],preamble:WordBlock[]=[];
 let active:Builder|undefined,role:WordQuestionRole='question',answerSection=false,unassigned=false;
 function begin(number:string){if(builders.length>=10000)throw Error('too_large');active={number,blocks:[],parts:{question:[],answer:[],analysis:[]},issues:new Set()};builders.push(active);role='question';}
 function append(block:WordBlock,from?:number,to?:number){
  if(!active){preamble.push(block);return;}
  if(block.kind==='paragraph'&&(to??0)<=(from??0))return;
  if(!active.blocks.includes(block))active.blocks.push(block);
  active.parts[role].push({blockId:block.id,...(block.kind==='paragraph'?{from,to}:{})});
 }
 for(const block of document.blocks){
  if(block.anchor.part!==mainPart)continue;
  if(block.kind==='table'){
   if(answerSection)continue;
   if(!active){unassigned=true;continue;}
   if(walk([block]).some(b=>b.kind==='paragraph'&&(roleEvents(wordParagraphMap(b)).length||questionEvents(wordParagraphMap(b)).length)))active.issues.add('mixed_table_roles');
   append(block);continue;
  }
  const text=wordParagraphMap(block);
  if(/^\s*(?:参考答案(?:与解析|及解析)?|答案与解析|答案解析|答案汇编)\s*$/u.test(text)){answerSection=true;continue;}
  if(answerSection)continue;
  const questions=block.numbering?block.numbering.level===0&&numberOf(block.numbering.label)?[{at:0,after:0,number:numberOf(block.numbering.label)!}]:[]:questionEvents(text);
  const events:Event[]=[...questions,...roleEvents(text)].sort((a,b)=>a.at-b.at);
  let cursor=0;
  for(const event of events){
   if(event.at<cursor)continue;
   if(event.at>cursor)append(block,cursor,event.at);
   if(event.number){begin(event.number);cursor=event.at;}
   else if(event.role){if(active)role=event.role;cursor=event.after;}
  }
  if(cursor<text.length)append(block,cursor,text.length);
 }
 const context=wordQuestionText(preamble),numbers=new Map<string,number>();for(const b of builders)numbers.set(b.number,(numbers.get(b.number)||0)+1);
 const globalWarnings=document.warnings.some(w=>!['supplemental_part','formula_incomplete','image_missing','external_image','unsupported_image'].includes(w));
 for(const b of builders){if(numbers.get(b.number)!>1)b.issues.add('ambiguous_number');if(answerSection)b.issues.add('separate_answers');if(globalWarnings)b.issues.add('source_warning');if(unassigned)b.issues.add('unassigned_content');if(context.length>2048)b.issues.add('context_too_large');}
 function materialize(ordinal:number){
  if(!Number.isSafeInteger(ordinal)||ordinal<1||ordinal>builders.length)throw Error('invalid_input');
  const b=builders[ordinal-1],all=walk(b.blocks),assetIds=new Set<string>();
  for(const block of all)if(block.kind==='paragraph')for(const inline of block.inlines)if(inline.kind==='image'&&inline.assetId)assetIds.add(inline.assetId);
  const source:WordQuestionSource={schemaVersion:WORD_QUESTION_SCHEMA,ordinal,number:b.number,documentSha,context:context.length<=2048?context:'',blocks:b.blocks,assets:document.assets.filter(a=>assetIds.has(a.id)),parts:b.parts,canonical:{question:'',answer:'',analysis:''},issues:[...b.issues]};
  // Inspect selected ranges rather than unrelated text elsewhere in the same source paragraph.
  const selected=walk(WORD_QUESTION_ROLES.flatMap(r=>wordQuestionBlocks(source,r)));
  const issues=new Set(source.issues);
  for(const block of selected)if(block.kind==='paragraph')for(const inline of block.inlines){
   if(inline.kind==='formula'&&!inline.complete)issues.add('formula_incomplete');
   if(inline.kind==='image'&&(!inline.assetId||inline.issue))issues.add('image_missing');
   if(inline.kind==='text'&&/\[(?:脚注|尾注)\d+\]/u.test(inline.text))issues.add('footnote_unresolved');
  }
  for(const r of WORD_QUESTION_ROLES)source.canonical[r]=wordQuestionText(wordQuestionBlocks(source,r));
  if(WORD_QUESTION_ROLES.reduce((n,r)=>n+b.parts[r].length,0)>64)issues.add('too_many_spans');
  if(source.assets.length>8)issues.add('too_many_images');source.issues=[...issues];
  if(Buffer.byteLength(JSON.stringify(source))>WORD_QUESTION_BYTES||Object.values(source.canonical).some(t=>t.length>24000))source.issues.push('too_large');
  return source;
 }
 function read(ordinal:number){const source=materialize(ordinal);if(source.issues.some(i=>['too_large','too_many_spans','too_many_images'].includes(i)))throw Error('too_large');if(!validWordQuestionSource(source))throw Error('source_changed');return structuredClone(source);}
 function summaries(offset:number,count=5):WordQuestionSummary[]{
  if(!Number.isSafeInteger(offset)||offset<0||offset>builders.length||!Number.isSafeInteger(count)||count<1||count>5)throw Error('invalid_input');
  return builders.slice(offset,offset+count).map((_,i)=>{const source=materialize(offset+i+1),selected=walk(WORD_QUESTION_ROLES.flatMap(r=>wordQuestionBlocks(source,r))),inlines=selected.flatMap(b=>b.kind==='paragraph'?b.inlines:[]);return {ordinal:source.ordinal,number:source.number,available:!source.issues.some(i=>['too_large','too_many_spans','too_many_images'].includes(i)),issues:source.issues,preview:source.canonical.question.slice(0,240),images:inlines.filter(i=>i.kind==='image').length,formulas:inlines.filter(i=>i.kind==='formula').length,tables:selected.filter(b=>b.kind==='table').length,hasAnswer:!!source.canonical.answer,hasAnalysis:!!source.canonical.analysis};});
 }
 return {documentSha,total:builders.length,read,summaries};
}
export function verifyWordQuestionSource(source:WordQuestionSource,document:WordDocument){
 try{if(!validWordQuestionSource(source))return false;const index=indexWordQuestions(document);return source.documentSha===index.documentSha&&JSON.stringify(index.read(source.ordinal))===JSON.stringify(source);}catch{return false;}
}
