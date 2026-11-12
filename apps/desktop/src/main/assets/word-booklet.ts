import {isWordBookletPolicy,type WordBlock} from '../../shared/material-word';
import {wordQuestionText,type WordQuestionSource} from '../../shared/material-word-question';

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

export function nativeChoiceAnswerConflict(source:WordQuestionSource,answers:string[]):boolean{
 if(!isWordBookletPolicy(source.indexPolicy))return false;
 const expected=choiceLetters(source.canonical.answer);
 return !!expected&&answers.some(answer=>choiceLetters(answer)!==expected);
}
