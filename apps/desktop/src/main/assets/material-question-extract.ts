import type {QuestionBankItemInput} from '../../shared/contracts';
import {QUESTION_ARCHIVE_SCHEMA,archiveMissing,type QuestionArchive,type ArchiveFields} from '../../shared/question-archive';
import {materialIsOcr} from '../../shared/materials';
import {materialSource,type MaterialReadingUnit} from './material-source';
export type ExtractedQuestion={fields:QuestionBankItemInput;archive:QuestionArchive;key:string};
/** Ignore layout-only blanks, never digits, signs, choices or algebra subscripts. */
export const normalizeMaterialStem=(text:string)=>text.normalize('NFKC').replace(/(?<![A-Za-z0-9])_{3,}(?![A-Za-z0-9])/g,'').replace(/\s/g,'').replace(/。(?=A[.、])/g,'');
const stripMetadata=(s:string)=>s.replace(/^\s*(?:【(?:学科|年级|知识点|题型|难度)】|\[(?:学科|年级|知识点|题型|难度)\]|(?:学科|年级|知识点|题型|难度)\s*[:：])[^\n]*\n?/gm,'').trim();
/** Conservative source extraction. Never supplies an answer/analysis or an AI confirmation. */
export function extractMaterialQuestions(units:MaterialReadingUnit[],engine:string):ExtractedQuestion[]{
 const ranges:{start:number;end:number;unit:MaterialReadingUnit}[]=[];let text='';
 // Only an explicit page-leading advertisement notice can discard text; a question may quote that notice.
 for(const unit of units){const start=text.length;text+=(/^\s*(?:【\s*温馨提示\s*】\s*)?本页为广告页[，,、\s]*打印(?:前|时)(?:可以|可)?(?:把这页|将本页|把这页删掉)/.test(unit.chunk.contentMd)?'':unit.chunk.contentMd)+'\n\n';ranges.push({start,end:text.length,unit});}
 // A separate answer book needs an explicit matching stage; do not turn its numbered answers into new questions.
 const answerSection=/^\s*(?:#{1,6}\s*)?(?:参考答案|答案与解析|答案及解析)\s*[:：]?\s*$/m.exec(text);if(answerSection)text=text.slice(0,answerSection.index);
 const heading=/^\s{0,3}(?:#{1,6}\s*)?(?:第(\d{1,5})题\s*[:：]?|(\d{1,5})[.、．](?!\d))\s*/gm;
 const rawMatches=[...text.matchAll(heading)];
 // Keep offsets into the original units. Only an explicit leading instruction
 // section ending at a formal exam heading can exclude its list numbering.
 const instructions=/^\s*(?:特别提示|注意事项|考试说明)\s*[:：]?\s*$/m.exec(text);
 let bodyStart=0;
 if(instructions&&instructions.index<(rawMatches[0]?.index??0)){
  const tail=text.slice(instructions.index+instructions[0].length),section=/^\s*[一二三四五六七八九十]+[、．.]\s*[^\n]+$/m.exec(tail);
  if(section){
   const end=instructions.index+instructions[0].length+section.index+section[0].length;
   const restart=rawMatches.find((m,i)=>i>0&&Number(m[1]||m[2])<=Number(rawMatches[i-1][1]||rawMatches[i-1][2]));
   const prefix=rawMatches.filter(m=>m.index!<end);
   const examRule=/每题|只能选|至少.*选项|写出.*过程|考试|答题|试卷|标注|作图外|需写出/;
   if(prefix.length&&(!restart||end<=restart.index!)&&prefix.every(m=>examRule.test(text.slice(m.index!+m[0].length).split('\n')[0])))bodyStart=end;
  }
 }
 const allMatches=rawMatches.filter(m=>m.index!>=bodyStart);
 const questionCue=/[?？]|求|计算|解方程|选择|选涂|填空|判断|已知|多少|证明|下列|回答|写出|如图|简述|说明理由/;
 const matches=allMatches.filter((m,i)=>!!m[1]||questionCue.test(text.slice(m.index!+m[0].length,allMatches[i+1]?.index??text.length)));if(matches.length>1000)throw new Error('too_many_questions');
 // Numbering can restart for subquestions/sections. Plain text cannot establish the hierarchy reliably.
 const hierarchyUncertain=matches.some((m,i)=>i>0&&Number(m[1]||m[2])<=Number(matches[i-1][1]||matches[i-1][2]))||matches.some(m=>/回答以下|回答下列|完成下列|以下问题|下列问题|分别求|各小题/.test(text.slice(m.index!+m[0].length).split('\n')[0]));
 const metadata=(body:string,label:string)=>body.match(new RegExp('(?:^|\\n)\\s*(?:【'+label+'】|\\['+label+'\\]|'+label+'\\s*[:：])\\s*([^\\n]+)'))?.[1]?.trim()||'';
 const header=text.slice(0,matches[0]?.index??0),numbers=new Map<string,number>();for(const m of matches){const n=m[1]||m[2]||m[3];numbers.set(n,(numbers.get(n)||0)+1);}
 const result:ExtractedQuestion[]=[];
 for(let i=0;i<matches.length;i++){
  const m=matches[i],start=m.index!,number=m[1]||m[2]||m[3],sourceRange=ranges.find(r=>r.start<=start&&r.end>start);
  let end=matches[i+1]?.index??text.length;
  const nextRange=matches[i+1]&&ranges.find(r=>r.start<=end&&r.end>end);
  // A following page's metadata-only preamble belongs to that page, not to the preceding question.
  // Unknown/same-page boundaries and actual continuation text retain their complete source spans.
  if(sourceRange?.unit.chunk.pageNumber&&nextRange?.unit.chunk.pageNumber&&sourceRange.unit.chunk.pageNumber!==nextRange.unit.chunk.pageNumber&&stripMetadata(text.slice(nextRange.start,end))==='')end=nextRange.start;
  const body=text.slice(start+m[0].length,end).trim();if(!body)continue;
  const markers=[...body.matchAll(/(?:^|\n)\s*(?:【(答案|参考答案|解析|解答|分析)】|\[(答案|参考答案|解析|解答|分析)\]|(答案|参考答案|解析|解答|分析)\s*[:：])\s*/g)];
  let answer='',analysis='';for(let j=0;j<markers.length;j++){const marker=markers[j],kind=marker[1]||marker[2]||marker[3],value=body.slice(marker.index!+marker[0].length,markers[j+1]?.index??body.length).trim();if(['答案','参考答案'].includes(kind))answer+=(answer?'\n':'')+value;else analysis+=(analysis?'\n':'')+value;}
  const stem=stripMetadata(body.slice(0,markers[0]?.index??body.length));if(stem.length<4)continue;
  const localHeader=sourceRange?text.slice(sourceRange.start,matches.find(h=>h.index!>=sourceRange.start&&h.index!<sourceRange.end)?.index??start):'';
  const get=(label:string)=>metadata(body,label)||metadata(localHeader,label)||metadata(header,label),difficulty=get('难度');
  const fields:ArchiveFields={stem,answer:stripMetadata(answer),analysis:stripMetadata(analysis),subject:get('学科'),grade:get('年级'),knowledgePoint:get('知识点'),questionType:get('题型'),difficulty:/难|hard/.test(difficulty)?'hard':/基础|简单|easy/.test(difficulty)?'easy':'medium'};
  const touched=ranges.filter(r=>r.start<end&&r.end>start),issues=archiveMissing(fields);
  if(touched.length>64||Math.max(stem.length,answer.length,analysis.length)>12000){issues.push('long_question');fields.stem='原题内容过长，需打开原资料拆分整理。\n'+stem.slice(0,200);fields.answer='';fields.analysis='';issues.push('missing_answer','missing_analysis');}
  if(!/^(?:基础|简单|中等|困难|easy|medium|hard)$/.test(difficulty))issues.push('missing_difficulty');
  if(hierarchyUncertain||numbers.get(number)!==1)issues.push('ambiguous_number');
  const subquestions=[...body.matchAll(/^\s*[（(](\d+)[）)]/gm)];
  if(subquestions.some((item,index)=>Number(item[1])!==index+1)||markers.filter(v=>['答案','参考答案'].includes(v[1]||v[2]||v[3])).length>1)issues.push('ambiguous_number');
  if(allMatches.some(other=>other.index!>start&&other.index!<end))issues.push('ambiguous_number');
  if(touched.length>1)issues.push('cross_chunk');
  if(engine!=='local-text-v1'||materialIsOcr(engine)||/如图|下图|图中|图示|下表|表中|几何图|\!\[|<img/.test(body))issues.push('visual_unchecked');
  result.push({key:String(start),fields:{...fields,sourceTitle:units[0].title,sourceKind:'teacher_resource',tags:['自动抽题']},archive:{schemaVersion:QUESTION_ARCHIVE_SCHEMA,extractor:'numbered-text.v1',state:'rule_extracted',number,sources:touched.slice(0,64).map(r=>materialSource(r.unit)),issues:[...new Set(issues)],sourceRisks:[...new Set(issues.filter(code=>!code.startsWith('missing_')))],sourceChecked:false,answerOrigin:fields.answer?'source':'missing',analysisOrigin:fields.analysis?'source':'missing'}});
 }
 return result;
}
