import {createHash} from 'node:crypto';
import {WORD_PARSER,WORD_PREAMBLE_QUESTION_POLICY,isWordPreamblePolicy,isWordBookletPolicy,validWordDocument,type WordDocument,type WordBlock} from '../../shared/material-word';
import {bookletMetadataLine,bookletSectionHeading,bookletChoiceAnswers} from './word-booklet';
import {preambleWindow,plainPreambleText,administrativeLine,partitionWordPreamble,explicitGlobalParameters,globalParameterText} from './word-preamble';
import {WORD_SCOPED_QUESTION_POLICY,WORD_QUESTION_SCHEMA,WORD_QUESTION_BYTES,WORD_QUESTION_ROLES,wordParagraphMap,wordSourceBlocks,wordQuestionBlocks,wordQuestionText,validWordQuestionSource,type WordQuestionSource,type WordQuestionRole,type WordSourceSpan,type WordQuestionIssue,type WordQuestionSummary} from '../../shared/material-word-question';

type Builder={number:string;section:string;preambleOnly:boolean;blocks:WordBlock[];blockIds:Set<string>;parts:Record<WordQuestionRole,WordSourceSpan[]>;issues:Set<WordQuestionIssue>};
type Event={at:number;after:number;number?:string;role?:WordQuestionRole;content?:number;explicit?:boolean;parenthesized?:boolean;combined?:boolean};
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const numberOf=(text:string)=>text.match(/^\s*(?:第\s*(\d{1,5})\s*题|([0-9]{1,5})[.．、)）])/u)?.slice(1).find(Boolean);
const roleOf=(text:string):WordQuestionRole=>/解析|分析|解答/u.test(text)?'analysis':'answer';
const questionEvents=(text:string):Event[]=>[...text.matchAll(/(?:^|\n)[ \t]*(?:第\s*(\d{1,5})\s*题[.．、:：]?|([0-9]{1,5})(?:[.．](?=\s|[^0-9])|[、)）]))[ \t]*/gu)].map(m=>({at:m.index!+(m[0].startsWith('\n')?1:0),after:m.index!+(m[0].startsWith('\n')?1:0),content:m.index!+m[0].length,number:m[1]||m[2],explicit:!!m[1],parenthesized:/[)）]/u.test(m[0])}));
const roleEvents=(text:string):Event[]=>[...text.matchAll(/【(?:参考)?(?:答案(?:与|及)?解析|答案|解析|分析|解答)】|\[(?:参考)?(?:答案(?:与|及)?解析|答案|解析|分析|解答)\]|(?:^|\n)[ \t]*(?:参考)?(?:答案(?:与|及)?解析|答案|解析|分析|解答)[：:]/gu)].map(m=>({at:m.index!,after:m.index!+m[0].length,combined:/答案(?:与|及)?解析/u.test(m[0]),role:/答案(?:与|及)?解析/u.test(m[0])?'answer':roleOf(m[0])}));
const walk=(blocks:WordBlock[]):WordBlock[]=>blocks.flatMap(b=>b.kind==='table'?[b,...b.rows.flatMap(r=>r.cells.flatMap(c=>walk(c.blocks)))]:[b]);
const classificationLine=/^(?:学科|科目|年级|知识点|题型|难度)[：:]\s*[^\r\n]{1,128}$/u;
const paperTitle=/^[\p{Script=Han}\dA-Za-z\s·—\-.、]{0,140}(?:试卷|试题|练习卷|测试卷|检测卷|模拟卷)(?:[（(](?:含答案|附答案|学生用|教师用|答案与解析)[）)])?$/u;
const sectionTitle=/^(?:[一二三四五六七八九十]+[、.．]\s*)?(?:单项|多项|不定项)?(?:选择题|填空题|计算题|实验题|解答题|综合题)(?:[（(](?:\d+|第|至|每|小题|题|分|共|本大题|只有一个正确答案|[，,。.:：、\s\-～]){1,80}[）)])?$/u;
/** Only an entirely plain, recognized preamble can leave the question body. */
function metadataPreamble(blocks:WordBlock[],text:string,booklet=false){
 if(blocks.some(b=>b.kind!=='paragraph'||b.warnings?.length||b.inlines.some(i=>i.kind!=='text')))return false;
 const lines=text.split('\n').map(line=>line.trim()).filter(Boolean);
 if(!lines.length||!lines.some(line=>classificationLine.test(line)||paperTitle.test(line)||sectionTitle.test(line)||booklet&&bookletMetadataLine(line)))return false;
 return lines.every(line=>{
  const gradingParts=line.split(/[，,。；;]/u).map(part=>part.trim()).filter(Boolean);
  return classificationLine.test(line)||paperTitle.test(line)||sectionTitle.test(line)
  ||/^(?:语文|数学|英语|物理|化学|生物|历史|地理|科学)$/u.test(line)
  ||/^(?:\d{4}年(?:\d{1,2}月(?:\d{1,2}日)?)?|\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?)$/u.test(line)
  ||/^考生(?:注意|须知)[：:]?$/u.test(line)
  ||gradingParts.length>0&&gradingParts.every(part=>/^(?:(?:试卷|本卷)?满分(?:为)?\d{1,3}分|(?:考试|答题)时间(?:为)?\d{1,3}分钟)$/u.test(part))
  ||booklet&&bookletMetadataLine(line);
 });
}
const globalWarning=(warning:string)=>!['supplemental_part','formula_incomplete','image_missing','external_image','unsupported_image'].includes(warning);

/** One linear pass over the parsed native document; each question is materialized on demand. */
export function indexWordQuestions(document:WordDocument){
 if(!validWordDocument(document))throw Error('source_changed');
 const scoped=document.parser===WORD_PARSER&&document.unscopedWarnings!==undefined;
 const bookletPolicy=isWordBookletPolicy(document.questionPolicy)?document.questionPolicy:undefined,booklet=!!bookletPolicy;
 const modern=isWordPreamblePolicy(document.questionPolicy),expanded=document.questionPolicy===WORD_PREAMBLE_QUESTION_POLICY,intro=modern?preambleWindow(document.blocks,expanded):undefined;
 const mainParts=new Set(document.blocks.filter(b=>/^\/document(?:\[\d+\])?\/body(?:\[\d+\])?\//u.test(b.anchor.path)).map(b=>b.anchor.part));
 if(mainParts.size>1)throw Error('source_changed');
 const documentSha=digest(document),mainPart=[...mainParts][0],builders:Builder[]=[],preamble:Array<{block:WordBlock;span:WordSourceSpan}>=[];
 const answerBlocks:WordBlock[]=[];
 let active:Builder|undefined,role:WordQuestionRole='question',answerSection=false,answerSections=0,sectionContext='',unassigned=false,numberedExplanation=false,numberedOptions=false,realStarted=false;
 function begin(number:string,preambleOnly=false){if(builders.length>=10000)throw Error('too_large');active={number,section:sectionContext,preambleOnly,blocks:[],blockIds:new Set(),parts:{question:[],answer:[],analysis:[]},issues:new Set()};builders.push(active);if(!preambleOnly)realStarted=true;role='question';numberedExplanation=false;numberedOptions=false;}
 function append(block:WordBlock,from?:number,to?:number){
  if(block.kind==='paragraph'&&(to??0)<=(from??0))return;
  if(!active||active.preambleOnly){preamble.push({block,span:{blockId:block.id,...(block.kind==='paragraph'?{from,to}:{})}});if(!active)return;}
  if(!active.blockIds.has(block.id)){active.blocks.push(block);active.blockIds.add(block.id);}
  active.parts[role].push({blockId:block.id,...(block.kind==='paragraph'?{from,to}:{})});
 }
 for(const [blockIndex,block] of document.blocks.entries()){
  if(block.anchor.part!==mainPart)continue;
  if(block.kind==='table'){
   if(answerSection){answerBlocks.push(block);continue;}
   if(!active||active.preambleOnly){unassigned=true;append(block);continue;}
   if(walk([block]).some(b=>b.kind==='paragraph'&&(roleEvents(wordParagraphMap(b)).length||questionEvents(wordParagraphMap(b)).length)))active.issues.add('mixed_table_roles');
   append(block);continue;
  }
  const text=wordParagraphMap(block);
  const plain=modern?plainPreambleText(block):undefined;
  const preambleOnly=!!(modern&&!realStarted&&intro?.hasTitle&&(
   intro.sectionAt>intro.attentionAt&&intro.attentionAt>=0&&blockIndex>intro.attentionAt&&blockIndex<intro.sectionAt
   ||intro.sectionAt<0&&intro.attentionAt>=0&&blockIndex>intro.attentionAt&&plain!==undefined&&plain.split('\n').every(line=>administrativeLine(line,true,expanded))
   ||expanded&&intro.attentionAt>=0&&blockIndex>intro.attentionAt&&block.inlines.every(inline=>inline.kind==='text')&&globalParameterText(text)));
  if(/^\s*(?:参考答案(?:与解析|及解析)?|答案与解析|答案解析|答案汇编)\s*[:：]?\s*$/u.test(text)){answerSection=true;answerSections++;continue;}
  if(answerSection){answerBlocks.push(block);continue;}
  if(booklet&&!block.numbering&&!block.warnings?.length&&block.inlines.every(inline=>inline.kind==='text')&&bookletSectionHeading(text.trim())){sectionContext=text.trim();if(modern&&!realStarted)append(block,0,text.length);continue;}
  const questions=block.numbering?block.numbering.level===0&&numberOf(block.numbering.label)?[{at:0,after:0,number:numberOf(block.numbering.label)!,explicit:true}]:[]:questionEvents(text);
  const events:Event[]=[...questions,...roleEvents(text)].sort((a,b)=>a.at-b.at);
  let cursor=0;
  for(const event of events){
   if(event.at<cursor)continue;
   if(event.number&&!event.explicit&&active&&!active.preambleOnly&&role==='question'&&event.parenthesized&&(numberedOptions||Number(event.number)<=Number(active.number))){
    numberedOptions=true;active.issues.add('ambiguous_number');continue;
   }
   if(event.number&&!event.explicit&&active&&role!=='question'){
    const body=text.slice(event.content).split('\n')[0].trim();
    const query=/^(?:计算|求|化简|已知|如图|读|阅读|根据|回答|选择|判断|比较|证明|解方程|填写|填空)|[?？]$/u.test(body);
    const step=/^(?:先|再|然后|最后|由|因为|所以|解[：:]|设|代入|整理|得到)/u.test(body),reset=event.at===0&&Number(event.number)===Number(active.number)&&!step;
    if(step||numberedExplanation||query&&Number(event.number)<=Number(active.number)){
     numberedExplanation=true;if(!step)active.issues.add('ambiguous_number');continue;
    }
    if(!reset&&(!query||Number(event.number)===Number(active.number))){
     if(!step)active.issues.add('ambiguous_number');
     continue;
    }
   }
   if(event.at>cursor)append(block,cursor,event.at);
   if(event.number){const uncertain=active&&!active.preambleOnly&&!event.explicit&&(Number(event.number)!==Number(active.number)+1||event.at>0&&role!=='question');if(uncertain)active!.issues.add('ambiguous_number');begin(event.number,preambleOnly);if(uncertain)active!.issues.add('ambiguous_number');cursor=event.at;}
   else if(event.role){if(active){role=event.role;numberedExplanation=false;numberedOptions=false;if(event.combined)active.issues.add('combined_roles');}cursor=event.after;}
  }
  if(cursor<text.length)append(block,cursor,text.length);
 }
 const preambleBlocks=[...new Map(preamble.map(p=>[p.block.id,p.block])).values()];
 const partition=modern?partitionWordPreamble(preamble,intro!.hasTitle,expanded):undefined;
 const context=partition?partition.context:wordQuestionText(wordSourceBlocks(preambleBlocks,preamble.map(p=>p.span),'question'));
 const preambleSelected=wordSourceBlocks(preambleBlocks,preamble.map(p=>p.span),'question');
 const common=partition?partition.common:scoped&&metadataPreamble(preambleSelected,context,booklet)?[]:preamble.filter(p=>wordSourceBlocks([p.block],[p.span],'question').some(b=>b.kind==='table'||b.inlines.some(i=>i.kind!=='text')||wordQuestionText([b]).split('\n').some(line=>line.trim()&&!/^\s*(?:学科|科目|年级|知识点|题型|难度)[：:]/u.test(line))));
 const commonScopeKnown=expanded&&explicitGlobalParameters(common);
 if(modern){
  const actual=builders.filter(builder=>!builder.preambleOnly);
  const questionBlocks=(builder:Builder)=>wordSourceBlocks(builder.blocks,builder.parts.question,'question').filter(block=>block.kind!=='paragraph'||block.inlines.some(inline=>inline.kind!=='text'||inline.text.trim()));
  for(let position=1;position<actual.length;position++){
   const previous=actual[position-1],following=actual[position];
   const tail=questionBlocks(previous).at(-1),head=questionBlocks(following)[0];
   const standaloneImage=tail?.kind==='paragraph'&&tail.inlines.some(inline=>inline.kind==='image')&&tail.inlines.every(inline=>inline.kind==='image'||inline.kind==='text'&&!inline.text.trim());
   const unanchoredReference=head?.kind==='paragraph'&&!head.inlines.some(inline=>inline.kind==='image')&&/(?:如图|图示|图中|下图)/u.test(wordParagraphMap(head));
   if(standaloneImage&&unanchoredReference){previous.issues.add('image_scope_uncertain');following.issues.add('image_scope_uncertain');}
  }
 }
 const numbers=new Map<string,number>();for(const b of builders)if(!b.preambleOnly)numbers.set(b.number,(numbers.get(b.number)||0)+1);
 const answers=booklet&&answerSections===1?bookletChoiceAnswers(answerBlocks):new Map<string,WordBlock[]|null>();
 const globalWarnings=(scoped?document.unscopedWarnings!:document.warnings).some(globalWarning);
 for(const b of builders){
  if(b.preambleOnly)continue;
  const answer=numbers.get(b.number)===1&&!b.parts.answer.length?answers.get(b.number):undefined;
  if(answer)for(const block of answer){
   const length=block.kind==='paragraph'?wordParagraphMap(block).length:0;
   if(!length)continue;
   b.blocks.push(block);b.blockIds.add(block.id);b.parts.answer.push({blockId:block.id,from:0,to:length});
  }
  if(common.length&&!commonScopeKnown)b.issues.add('shared_context');
  if(numbers.get(b.number)!>1)b.issues.add('ambiguous_number');if(answerSection&&!answer)b.issues.add('separate_answers');if(globalWarnings)b.issues.add('source_warning');if(unassigned)b.issues.add('unassigned_content');if(context.length>2048)b.issues.add('context_too_large');
 }
 function materialize(ordinal:number){
  if(!Number.isSafeInteger(ordinal)||ordinal<1||ordinal>builders.length)throw Error('invalid_input');
  const b=builders[ordinal-1];if(b.preambleOnly)throw Error('non_question_content');
  const blocks=common.length?[...new Map([...common.map(p=>p.block),...b.blocks].map(p=>[p.id,p])).values()]:b.blocks;
  const questionContext=b.section?[context,b.section].filter(Boolean).join('\n'):context;
  const parts=common.length?{...b.parts,question:[...common.map(p=>p.span),...b.parts.question]}:b.parts,all=walk(blocks),assetIds=new Set<string>();
  for(const block of all)if(block.kind==='paragraph')for(const inline of block.inlines)if(inline.kind==='image'&&inline.assetId)assetIds.add(inline.assetId);
  const source:WordQuestionSource={schemaVersion:WORD_QUESTION_SCHEMA,...(scoped?{indexPolicy:bookletPolicy||WORD_SCOPED_QUESTION_POLICY}:{}),ordinal,number:b.number,documentSha,context:questionContext.length<=2048?questionContext:'',blocks,assets:document.assets.filter(a=>assetIds.has(a.id)),parts,canonical:{question:'',answer:'',analysis:''},issues:[...b.issues]};
  // Inspect selected ranges rather than unrelated text elsewhere in the same source paragraph.
  const selected=walk(WORD_QUESTION_ROLES.flatMap(r=>wordQuestionBlocks(source,r)));
  const issues=new Set(source.issues);
  if(questionContext.length>2048)issues.add('context_too_large');
  if(scoped&&selected.some(block=>block.warnings?.some(globalWarning)))issues.add('source_warning');
  for(const block of selected)if(block.kind==='paragraph')for(const inline of block.inlines){
   if(inline.kind==='formula'&&!inline.complete)issues.add('formula_incomplete');
   if(inline.kind==='image'&&(!inline.assetId||inline.issue))issues.add('image_missing');
   if(inline.kind==='text'&&/\[(?:脚注|尾注)\d+\]/u.test(inline.text))issues.add('footnote_unresolved');
  }
  for(const r of WORD_QUESTION_ROLES)source.canonical[r]=wordQuestionText(wordQuestionBlocks(source,r));
  if(WORD_QUESTION_ROLES.reduce((n,r)=>n+parts[r].length,0)>64)issues.add('too_many_spans');
  if(new Set(selected.flatMap(b=>b.kind==='paragraph'?b.inlines.filter(i=>i.kind==='image'&&i.assetId).map(i=>i.kind==='image'?i.assetId:''):[])).size>8)issues.add('too_many_images');source.issues=[...issues];
  if(Buffer.byteLength(JSON.stringify(source))>WORD_QUESTION_BYTES||Object.values(source.canonical).some(t=>t.length>24000))source.issues.push('too_large');
  return source;
 }
 function read(ordinal:number){const source=materialize(ordinal);if(source.issues.some(i=>['too_large','too_many_spans','too_many_images'].includes(i)))throw Error('too_large');if(!validWordQuestionSource(source))throw Error('source_changed');return structuredClone(source);}
 function summaries(offset:number,count=5):WordQuestionSummary[]{
  if(!Number.isSafeInteger(offset)||offset<0||offset>builders.length||!Number.isSafeInteger(count)||count<1||count>5)throw Error('invalid_input');
  return builders.slice(offset,offset+count).flatMap((builder,i)=>{if(builder.preambleOnly)return [];const source=materialize(offset+i+1),selected=walk(WORD_QUESTION_ROLES.flatMap(r=>wordQuestionBlocks(source,r))),inlines=selected.flatMap(b=>b.kind==='paragraph'?b.inlines:[]);return [{ordinal:source.ordinal,number:source.number,available:!source.issues.some(i=>['too_large','too_many_spans','too_many_images'].includes(i)),issues:source.issues,preview:source.canonical.question.slice(0,240),images:inlines.filter(i=>i.kind==='image').length,formulas:inlines.filter(i=>i.kind==='formula').length,tables:selected.filter(b=>b.kind==='table').length,hasAnswer:!!source.canonical.answer,hasAnalysis:!!source.canonical.analysis}];});
 }
 const nonQuestion=(ordinal:number)=>{if(!Number.isSafeInteger(ordinal)||ordinal<1||ordinal>builders.length)throw Error('invalid_input');return builders[ordinal-1].preambleOnly;};
 const bodyIdentity=(ordinal:number)=>digest({number:builders[ordinal-1].number,question:builders[ordinal-1].parts.question});
 return {documentSha,total:builders.length,questionTotal:builders.filter(builder=>!builder.preambleOnly).length,nonQuestion,bodyIdentity,read,summaries};
}
export function wordQuestionPlanCompatible(previous:WordDocument,next:WordDocument){
 const before=indexWordQuestions(previous),after=indexWordQuestions(next);
 if(before.total!==after.total)return false;
 for(let ordinal=1;ordinal<=after.total;ordinal++)if(!after.nonQuestion(ordinal)&&before.bodyIdentity(ordinal)!==after.bodyIdentity(ordinal))return false;
 return true;
}
export function verifyWordQuestionSource(source:WordQuestionSource,document:WordDocument){
 try{if(!validWordQuestionSource(source))return false;const index=indexWordQuestions(document);return source.documentSha===index.documentSha&&JSON.stringify(index.read(source.ordinal))===JSON.stringify(source);}catch{return false;}
}
