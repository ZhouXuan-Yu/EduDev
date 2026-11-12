import type {WordBlock} from '../../shared/material-word';
import {wordParagraphMap,wordSourceBlocks,type WordSourceSpan} from '../../shared/material-word-question';
import {bookletMetadataLine,bookletSectionHeading} from './word-booklet';

export type PreambleEntry={block:WordBlock;span:WordSourceSpan};
const subjects='语文|数学|英语|物理|化学|生物|历史|地理|科学';
const compact=(value:string)=>value.normalize('NFKC').replace(/[ \t\u00a0\u3000]/gu,'').trim();
const examTitle=new RegExp('^[\\p{Script=Han}A-Za-z·—-]{0,40}\\d{4}(?:[-—]\\d{4})?(?:学年度|学年|年度|年)(?:第?[一二三四1-4]学期|[上下]学期)?(?:[初高][一二三1-3](?:年级)?|\\d{1,2}年级)?(?:'+subjects+')?(?:等级|学业水平|质量调研|教学质量检测|学生学习能力诊断|期中|期末|模拟|适应性|阶段性)?(?:考试|试卷|试题|测试|检测)$','u');
const subjectTitle=new RegExp('^(?:[初高][一二三1-3](?:年级)?)?(?:'+subjects+')(?:学科)?(?:(?:质量监测|质量检测|模拟)?(?:试卷|试题|练习卷|测试卷|检测卷|模拟卷))?$','u');
const paperTitle=/^[\p{Script=Han}\dA-Za-z·—\-.、]{0,140}(?:试卷|试题|练习卷|测试卷|检测卷|模拟卷)(?:\((?:含答案|附答案|学生用|教师用|答案与解析)\))?$/u;
const classification=/^(?:学科|科目|年级|知识点|题型|难度)[：:]\s*[^\r\n]{1,128}$/u;
const attention=/^(?:考生(?:注意|须知)|注意事项|考试说明)[：:]?$/u;
const firstSection=/^(?:一[、.．]|第一(?:部分|大题)|[（(]一[）)])(?:单项|多项|不定项)?(?:选择题|填空题|计算题|实验题|解答题|综合题)/u;
const ordinal=/^(?:\d{1,3}[.．、)）]|[（(]\d{1,3}[)）])\s*/u;
function administrativeSection(text:string,expanded=false):boolean{
 const match=text.match(/^(?:[一二三四五六七八九十]+[、.]|第[一二三四五六七八九十]+(?:部分|大题))?(?:单项|多项|不定项)?(?:选择题|填空题|计算题|实验题|解答题|综合题)(?:\((.*)\))?$/u);
 if(!match)return false;
 if(!match[1])return true;
 return match[1].split(expanded?/[，,。.;；:：]/u:/[，,。.;；]/u).filter(Boolean).every(part=>/^(?:共\d{1,3}分|(?:本题|本大题)?共\d{1,3}小题|第?\d{1,3}(?:至|～|—|-)\d{1,3}(?:小题|题)|(?:第?\d{1,3}(?:至|～|—|-)\d{1,3}(?:小题|题))?每(?:小)?题\d{1,3}分|每(?:小)?题(?:的四个选项中)?只有一个正确(?:答案|选项)?|把正确的选项填写在题后的括号内|不选|多选或错选均不得分)$/u.test(part));
}

/** Complete educational headings, confined to the pre-question source prefix. */
function educationalHeading(text:string):boolean{
 const characters=/^[\p{Script=Han}A-Za-z\d·—()\-]{1,160}$/u;
 const year=/\d{4}(?:[-—]\d{4})?(?:学年度|学年|年度|年)/u;
 const ending=/(?:期中|期末|期终|等级考|(?:质量|学业质量|模拟质量)?(?:调研|监控)|考试|测试|检测|诊断卷|物理卷|数学卷|物理学科|数学学科)$/u;
 return characters.test(text)&&year.test(text)&&ending.test(text)
  &&!/(?:已知|如图|假设|若|求|证明|质量为|速度为|等于|取值|仅当)/u.test(text);
}

export function administrativeTitle(line:string):boolean{
 const text=compact(line);
 return examTitle.test(text)||subjectTitle.test(text)||paperTitle.test(text);
}
function calendarDate(text:string):boolean{
 const match=text.match(/^(\d{4})(?:年|[./-])(\d{1,2})(?:(?:月|[./-])(\d{1,2})日?|月)?$/u);
 if(!match)return false;
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]||1),date=new Date(Date.UTC(year,month-1,day));
 return year>=1900&&year<=2199&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
/** Each complete clause has an administrative meaning; unknown conditions remain source. */
export function administrativeLine(line:string,hasTitle:boolean,expanded=false):boolean{
 let text=compact(line).replace(ordinal,'').replace(/．/gu,'.');
 if(!text)return true;
 if(administrativeTitle(text)||expanded&&educationalHeading(text)||classification.test(text)||attention.test(text)||bookletMetadataLine(text)||bookletSectionHeading(text)||administrativeSection(text,expanded))return true;
 if(expanded&&/^(?:请考生注意|考生请注意)[：:]?$/u.test(text))return true;
 if(hasTitle&&calendarDate(text))return true;
 const wrapped=text.match(/^\(([^()]*)\)(.*)$/u);
 if(wrapped){if(wrapped[2]&&(!hasTitle||!calendarDate(wrapped[2])))return false;text=wrapped[1];}
 if(expanded&&hasTitle&&calendarDate(text))return true;
 // Treat full-stop variants as sentence boundaries, preserving decimals in dates above.
 const sentences=text.split(/[。.;；]/u).filter(Boolean);
 if(sentences.length&&(sentences.length>1||sentences[0]!==text))return sentences.every(sentence=>administrativeLine(sentence,hasTitle,expanded));
 if(expanded&&hasTitle&&text.split(/[，,：:]/u).filter(Boolean).every(part=>/^(?:(?:本卷|本试卷)?(?:测试|考试|答题|完卷)时间(?:为)?\d{1,3}分钟|(?:本卷|本试卷)?满分(?:为)?\d{1,3}分)$/u.test(part)))return true;
 const nameFields='(?:姓名|班级|学校|准考证号|考试号|报名号|考场号|座位号)';
 if(new RegExp('^(?:答题|答卷)前[，,](?:务必|请)(?:用(?:钢笔或圆珠笔|钢笔|圆珠笔))?在(?:试卷与答题纸|答题纸)(?:正面)?(?:上)?(?:清楚地)?填写'+nameFields+'(?:[、,，和]'+nameFields+')*(?:等)?(?:[，,]并将(?:核对后的)?条形码贴在(?:指定|规定)位置(?:上|处))?$','u').test(text))return true;
 if(/^(?:第\d{1,3}(?:[、,]\d{1,3})*题要求写出必要的文字说明、方程式和重要的演算步骤|只写出最后答案[，,]而未写出主要演算过程的[，,]不能得分|(?:有关物理量的数值计算问题|有数字计算的问题)[，,]答案中必须明确写出数值和单位|第[IⅠⅡⅢIVV一二三四五六七八九十]+卷\(共\d{1,3}分\))$/u.test(text))return true;
 const clauses=text.split(/[，,：:]/u).filter(Boolean);
 return clauses.length>0&&clauses.every(part=>bookletMetadataLine(part)||
  /^(?:(?:试卷|本卷|本试卷)?满分(?:为)?\d{1,3}分|(?:考试|答题)时间(?:为)?\d{1,3}分钟|(?:本卷|试卷|本试卷)?共\d{1,3}页|(?:全卷|本卷|试卷)?(?:包括|共)[一二三四五六七八九十\d]+(?:大题|大部分|部分)|第[一二三四五六七八九十第和\d、]+(?:部分|大题)为(?:单项选择题|多项选择题|选择题|填空题|综合题|综合应用题|简答题|解答题|计算题|实验题)|作答必须(?:涂或)?写在答题纸上(?:相应的位置)?|在试卷上作答(?:一律)?(?:不得分|不给分|无效)[！!]?|第[一二三四五六七八九十第和\d、]+(?:部分|大题)的作答必须(?:用2B铅笔涂|涂|用蓝色或黑色的钢笔或圆珠笔写|写)在答题纸上(?:相应的区域|与试卷题号?对应的位置(?:[（(]作图可用铅笔[）)])?))$/u.test(part));
}
export function plainPreambleText(block:WordBlock):string|undefined{
 if(block.kind!=='paragraph'||block.warnings?.length||block.inlines.some(inline=>inline.kind!=='text'))return;
 return wordParagraphMap(block);
}
export function preambleWindow(blocks:WordBlock[],expanded=false){
 const texts=blocks.map(plainPreambleText);
 const bodyAt=blocks.findIndex((block,index)=>block.kind==='table'||!!block.numbering||texts[index]===undefined||!!texts[index]?.match(/(?:[?？]|[（(][ \t]*[）)]|_{2,}|^\s*[（(]?[A-D][)）.．、])/u));
 const prefix=texts.slice(0,bodyAt<0?texts.length:bodyAt);
 const attentionAt=prefix.findIndex(text=>text!==undefined&&attention.test(compact(text)));
 const headerEnd=attentionAt>=0?attentionAt:prefix.findIndex(text=>text!==undefined&&/^\s*\d{1,5}[.．、)）]/u.test(text));
 const hasTitle=prefix.slice(0,headerEnd<0?prefix.length:headerEnd).some(text=>text!==undefined&&text.split('\n').some(line=>administrativeTitle(line)||expanded&&educationalHeading(compact(line))));
 const sectionAt=hasTitle&&attentionAt>=0?prefix.findIndex((text,index)=>index>attentionAt&&text!==undefined&&firstSection.test(compact(text))):-1;
 return {hasTitle,attentionAt,sectionAt};
}

/** Split only plain text at original UTF16 line boundaries. Atomic media stays whole. */
export function partitionWordPreamble(entries:PreambleEntry[],hasTitle:boolean,expanded=false){
 const metadata:string[]=[],common:PreambleEntry[]=[];
 for(const entry of entries){
  const selected=wordSourceBlocks([entry.block],[entry.span],'question')[0];
  if(!selected||plainPreambleText(selected)===undefined){common.push(entry);continue;}
  const original=entry.block;if(original.kind!=='paragraph')continue;
  const start=entry.span.from??0,end=entry.span.to??wordParagraphMap(original).length,text=wordParagraphMap(original).slice(start,end);
  let at=start;
  for(const match of text.matchAll(/[^\n]*(?:\n|$)/gu)){
   const line=match[0],from=at;at+=line.length;
   if(!line.trim())continue;
   if(administrativeLine(line,hasTitle,expanded)){metadata.push(line.trim());continue;}
   const last=common.at(-1);
   if(last?.block.id===original.id&&last.span.to===from)last.span.to=at;
   else common.push({block:original,span:{blockId:original.id,from,to:at}});
  }
 }
 return {context:metadata.join('\n'),common};
}

/** Retains complete source parameter lines in every question under their explicit scope. */
export function globalParameterText(text:string):boolean{
 const lines=text.split('\n').filter(line=>line.trim());
 return lines.length>0&&lines.every(line=>
  /^(?:本卷|全卷|本试卷)(?:中)?(?:重力加速度)?g(?:取|=)\d{1,2}(?:\.\d{1,4})?(?:m\/s(?:2|\^2)|N\/kg)[。.]?$/u.test(compact(line).replace(ordinal,'')));
}
export function explicitGlobalParameters(entries:PreambleEntry[]):boolean{
 return entries.length>0&&entries.every(entry=>{
  const block=wordSourceBlocks([entry.block],[entry.span],'question')[0];
  const text=block&&plainPreambleText(block);
  return text!==undefined&&globalParameterText(text);
 });
}
