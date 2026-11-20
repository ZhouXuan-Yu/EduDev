import {isWordBookletPolicy,type WordBlock} from '../../shared/material-word';
import {wordParagraphMap,wordQuestionText,type WordQuestionSource,type WordSourceSpan} from '../../shared/material-word-question';

const subjects='语文|数学|英语|物理|化学|生物|历史|地理|科学';
const examTitle=new RegExp('^[\\p{Script=Han}A-Za-z·—]{0,30}\\d{4}(?:[-—]\\d{4})?(?:学年|年度|年)(?:第[一二三四1-4]学期)?(?:[初高][一二三]|\\d{1,2})?(?:年级)?(?:'+subjects+')?(?:质量调研|教学质量检测|期中|期末|模拟)?(?:考试|试卷|试题|测试)$','u');
const section=/^(?:[一二三四五六七八九十]+[、.．])?(?:单项|多项|不定项)?(?:选择题|填空题|计算题|实验题|解答题|综合题)(?:[（(](.*)[）)])?$/u;
export function bookletSectionHeading(text:string):boolean{
 const heading=text.replace(/[ \t]/g,'').match(section);
 return !!heading&&(!heading[1]||heading[1].split(/[，,。；;]/u).filter(Boolean).every(part=>
  /^(?:共\d{1,3}分|(?:\d{1,3}(?:至|～|—|-)\d{1,3}题)?每小题\d{1,3}分|每(?:小)?(?:题|个空格)\d{1,3}分|每小题只有一个正确(?:答案|选项))$/u.test(part)));
}

/** Recognize complete administrative statements, keeping unknown prose as source. */
export function bookletMetadataLine(line:string):boolean{
 const text=line.replace(/[ \t]/g,'');
 if(examTitle.test(text))return true;
 if(bookletSectionHeading(text))return true;
 const statements=text.split(/[，,。；;]/u).filter(Boolean);
 return statements.length>0&&statements.every(part=>
  /^(?:本考试分设试卷和答题纸|试卷包括[一二三四五六七八九十\d]+大部分|第[一二三四五六七八九十\d]+部分为(?:单项选择题|多项选择题|选择题|填空题|综合题|解答题|计算题|实验题))$/u.test(part));
}

type Table=Extract<WordBlock,{kind:'table'}>;
type Cell=Table['rows'][number]['cells'][number];
function plainCell(cell:Cell):string|undefined{
 if(cell.colSpan!==1||cell.merge||cell.blocks.some(block=>block.kind!=='paragraph'||block.numbering||block.warnings?.length||block.inlines.some(inline=>inline.kind!=='text')))return undefined;
 return wordQuestionText(cell.blocks).trim();
}
export function choiceLetters(text:string):string|undefined{
 const value=text.normalize('NFKC').replace(/\s+/gu,'');
 return /^[A-H]{1,8}$/.test(value)&&new Set(value).size===value.length?value:undefined;
}

/** Preserve the selected cell's original paragraph anchors, excluding neighbours. */
export function bookletChoiceAnswers(blocks:WordBlock[]):Map<string,WordBlock[]|null>{
 const answers=new Map<string,WordBlock[]|null>();
 for(const block of blocks){
  if(block.kind!=='table')continue;
  const [numbers,values]=block.rows;
  if(!numbers||wordQuestionText(numbers.cells[0]?.blocks||[]).trim()!=='题号')continue;
  const valid=block.rows.length===2&&!block.warnings?.length&&values?.cells.length===numbers.cells.length
   &&[...numbers.cells,...values.cells].every(cell=>cell.colSpan===1&&!cell.merge)
   &&plainCell(numbers.cells[0])==='题号'&&plainCell(values.cells[0])==='答案';
  for(let column=1;column<numbers.cells.length;column++){
   const cell=numbers.cells[column],number=wordQuestionText(cell.blocks).trim();
   if(!/^\d{1,5}$/u.test(number))continue;
   const value=valid?plainCell(values.cells[column]):undefined;
   const selected=value&&choiceLetters(value)&&plainCell(cell)===number?values.cells[column].blocks:null;
   answers.set(number,answers.has(number)?null:selected);
  }
 }
 return answers;
}

type Paragraph=Extract<WordBlock,{kind:'paragraph'}>;
export type PrintedChoiceSection={ordinal:string;mode:'generic'|'single'|'multiple'|'indeterminate'};
type PrintedAnswer={block:Paragraph;span:WordSourceSpan;section:PrintedChoiceSection;letters:string};
const printedSection=/^(?:([一二三四五六七八九十百0-9]{1,4})[.、])?(单项选择题|多项选择题|不定项选择题|单选题|多选题|选择题|填空题|计算题|实验题|解答题|综合题|证明题|判断题|简答题|阅读理解)\s*[:：]?(?:\(([^()]*)\))?$/u;
const unclassifiedSection=/^[一二三四五六七八九十百0-9]{1,4}[.、][\p{Script=Han}]{1,12}题[:：]?(?:\([^()]*\))?$/u;
const scoreInstruction=/^(?:本[大]?题共\d{1,3}题|共\d{1,3}(?:题|分)|满分\d{1,3}分|(?:\d{1,3}(?:至|~|—|-)\d{1,3}题)?每(?:小)?(?:题|个空格)\d{1,3}分|每(?:小)?题只有一个(?:正确(?:答案|选项)|选项是正确的))$/u;
const compactHeading=(text:string)=>text.normalize('NFKC').replace(/[\p{Zs}\t]/gu,'').trim();
const hasOnlyScoringNotes=(notes:string)=>notes.split(/[,。.;]/u).filter(Boolean).every(part=>scoreInstruction.test(part));
export const isPrintedExamTitle=(text:string)=>examTitle.test(compactHeading(text));
export function printedScoringHeading(text:string){
 const heading=printedSection.exec(compactHeading(text));
 return !!heading?.[3]&&hasOnlyScoringNotes(heading[3]);
}

/** undefined is body text, null is a section boundary without choice authority. */
export function printedChoiceSection(text:string):PrintedChoiceSection|null|undefined{
 const title=compactHeading(text);
 if(examTitle.test(title))return null;
 const match=printedSection.exec(title);
 if(!match)return unclassifiedSection.test(title)?null:undefined;
 const [,ordinal='',label,notes='']=match;
 if(!/(?:选择题|选题)$/u.test(label)||!hasOnlyScoringNotes(notes))return null;
 const chinese='一二三四五六七八九十'.indexOf(ordinal);
 const scope=ordinal.length===1&&chinese>=0?String(chinese+1):ordinal;
 const mode=label==='选择题'?'generic':label.startsWith('单')?'single':label.startsWith('多')?'multiple':'indeterminate';
 return {ordinal:scope,mode};
}

/** Retain the literal offsets and recognized numbers even when a strip is incomplete. */
export function printedChoiceTokens(original:string){
 const text=original.slice(0,4096);
 const separators=/^[\s,，、;；。]*$/u;
 const tokens=[...text.matchAll(/([0-9０-９]{1,5})[.．、:：][ \t\u3000]*([A-HＡ-Ｈ]{1,8})/gu)];
 if(!tokens.length||!separators.test(text.slice(0,tokens[0].index)))return {items:[],complete:false};
 let end=0;
 let complete=original.length===text.length;
 const items:{number:string;letters:string|undefined;start:number;from:number;to:number}[]=[];
 for(const entry of tokens){
  if(!separators.test(text.slice(end,entry.index)))complete=false;
  end=entry.index+entry[0].length;
  const number=entry[1].normalize('NFKC'),letters=choiceLetters(entry[2]);
  if(!/^[1-9]\d{0,4}$/u.test(number)){complete=false;continue;}
  items.push({number,letters,start:entry.index,from:end-entry[2].length,to:end});
  if(!letters)complete=false;
 }
 return {items,complete:complete&&separators.test(text.slice(end))};
}

function inlineAnswerSpans(block:Paragraph,section:PrintedChoiceSection,plain:boolean):Array<[string,PrintedAnswer|null]>{
 const {items,complete}=printedChoiceTokens(wordParagraphMap(block));
 // An incomplete second strip is still conflicting evidence for its printed numbers.
 return items.map(({number,letters,from,to})=>[number,plain&&complete&&letters
  ?{block,section,letters,span:{blockId:block.id,from,to}}:null]);
}

/** A complete printed answer strip contributes only each entry's literal letter span. */
export function bookletPrintedChoiceAnswers(blocks:WordBlock[]){
 const answers=new Map<string,PrintedAnswer|null>();
 let scope:PrintedChoiceSection|null|undefined;
 for(const block of blocks){
  if(block.kind!=='paragraph')continue;
  const text=wordParagraphMap(block);
  const plain=!block.numbering&&!block.warnings?.length&&block.inlines.every(inline=>inline.kind==='text');
  const section=printedChoiceSection(text);
  if(section!==undefined){scope=plain?section:undefined;continue;}
  if(!scope||!text.trim())continue;
  const strip=inlineAnswerSpans(block,scope,plain);
  for(const [number,answer] of strip)answers.set(number,answers.has(number)?null:answer);
  if(!strip.length||strip.some(([,answer])=>!answer))scope=undefined;
 }
 return answers;
}

export function printedAnswerMatches(answer:PrintedAnswer,section:PrintedChoiceSection|undefined,question:string){
 if(!section||section.ordinal&&answer.section.ordinal&&section.ordinal!==answer.section.ordinal||
    section.mode!=='generic'&&answer.section.mode!=='generic'&&section.mode!==answer.section.mode||
    (section.mode==='single'||answer.section.mode==='single')&&answer.letters.length!==1||
    (section.mode==='multiple'||answer.section.mode==='multiple')&&answer.letters.length<2)return false;
 const options=[...question.matchAll(/(?:^|\s)(?:[（(]([A-HＡ-Ｈ])[）)]|([A-HＡ-Ｈ])[.．、])/gu)];
 const labels=options.map(match=>(match[1]||match[2]).normalize('NFKC'));
 return labels.length>=2&&options.every((match,index)=>
  labels[index]===String.fromCharCode(65+index)&&
  question.slice(match.index+match[0].length,options[index+1]?.index).trim())&&
  [...answer.letters].every(letter=>labels.includes(letter));
}

export function nativeChoiceAnswerConflict(source:WordQuestionSource,answers:string[]):boolean{
 if(!isWordBookletPolicy(source.indexPolicy))return false;
 const expected=choiceLetters(source.canonical.answer);
 return !!expected&&answers.some(answer=>choiceLetters(answer)!==expected);
}
