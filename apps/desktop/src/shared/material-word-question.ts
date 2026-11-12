import {WORD_PARSER,WORD_SCHEMA,isWordBookletPolicy,validWordDocument,type WordAsset,type WordBlock,type WordDocument,type WordQuestionPolicy} from './material-word';
import {materialId} from './materials';
import {WORD_IMAGE_POLICY} from './material-metafile';

export const WORD_QUESTION_SCHEMA='xiaozhi.word-question-source.v1' as const;
export const WORD_SCOPED_QUESTION_POLICY='word-question-scoped.v2' as const;
export const WORD_QUESTION_BYTES=96*1024;
export const WORD_QUESTION_ROLES=['question','answer','analysis'] as const;
export type WordQuestionRole=typeof WORD_QUESTION_ROLES[number];
/** Offsets count UTF16 text code units and one unit for each atomic formula/image. */
export type WordSourceSpan={blockId:string;from?:number;to?:number};
export const WORD_QUESTION_ISSUES=['ambiguous_number','separate_answers','mixed_table_roles','combined_roles','shared_context','image_scope_uncertain','formula_incomplete','image_missing','source_warning','footnote_unresolved','unassigned_content','too_large','too_many_spans','too_many_images','context_too_large'] as const;
export type WordQuestionIssue=typeof WORD_QUESTION_ISSUES[number];
export type WordQuestionSource={schemaVersion:typeof WORD_QUESTION_SCHEMA;indexPolicy?:typeof WORD_SCOPED_QUESTION_POLICY|WordQuestionPolicy;ordinal:number;number:string;documentSha:string;context:string;
 blocks:WordBlock[];assets:WordAsset[];parts:Record<WordQuestionRole,WordSourceSpan[]>;canonical:Record<WordQuestionRole,string>;issues:WordQuestionIssue[]};
export type WordQuestionSummary={ordinal:number;number:string;available:boolean;issues:WordQuestionIssue[];preview:string;images:number;formulas:number;tables:number;hasAnswer:boolean;hasAnalysis:boolean};
export type WordQuestionQuery={schemaVersion:typeof WORD_QUESTION_SCHEMA;resourceId:string;version:string;offset:number;ordinal?:number};
export type WordQuestionPage={schemaVersion:typeof WORD_QUESTION_SCHEMA;resourceId:string;version:string;documentSha:string;offset:number;total:number;questionTotal?:number;nonQuestion?:'preamble';hasMore:boolean;entries:WordQuestionSummary[];source?:WordQuestionSource};

export const wordQuestionIssueLabels:Record<WordQuestionIssue,string>={ambiguous_number:'题号重复或层级不明',separate_answers:'答案位于独立章节，尚未配对',mixed_table_roles:'表格内的题面、答案位置尚未确定',combined_roles:'原文将答案和解析合写，尚未分开',shared_context:'题前共用图文已保留，适用题目范围待核对',image_scope_uncertain:'题间浮动图片归属待核对',formula_incomplete:'有公式尚未完整识别',image_missing:'有原图缺失或暂不支持',source_warning:'原文有修订、特殊布局或未识别内容',footnote_unresolved:'题目引用的脚注尚未配对',unassigned_content:'题前表格或图文尚未归属',too_large:'题目超过单题处理范围，需要拆分',too_many_spans:'题目来源段数过多，需要拆分',too_many_images:'题目图片过多，需要拆分',context_too_large:'题前分类信息过长，尚未关联'};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[])=>obj(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const wordInlineLength=(b:Extract<WordBlock,{kind:'paragraph'}>)=>b.inlines.reduce((n,i)=>n+(i.kind==='text'?i.text.length:1),0);
export const wordParagraphMap=(b:Extract<WordBlock,{kind:'paragraph'}>)=>b.inlines.map(i=>i.kind==='text'?i.text:'\ufffc').join('');
export function validWordQuestionQuery(v:unknown):v is WordQuestionQuery{
 return obj(v)&&Object.keys(v).every(k=>['schemaVersion','resourceId','version','offset','ordinal'].includes(k))&&v.schemaVersion===WORD_QUESTION_SCHEMA&&materialId(v.resourceId)&&typeof v.version==='string'&&/^[a-f0-9]{64}$/.test(v.version)&&Number.isSafeInteger(v.offset)&&Number(v.offset)>=0&&Number(v.offset)<=10000&&(v.ordinal===undefined||Number.isSafeInteger(v.ordinal)&&Number(v.ordinal)>=1&&Number(v.ordinal)<=10000);
}
function boundary(text:string,offset:number){return offset===0||offset===text.length||!(text.charCodeAt(offset-1)>=0xd800&&text.charCodeAt(offset-1)<=0xdbff&&text.charCodeAt(offset)>=0xdc00&&text.charCodeAt(offset)<=0xdfff);}

/** Resolves real source ranges, without modifying source blocks or inventing Word pages. */
export function wordQuestionBlocks(source:WordQuestionSource,role:WordQuestionRole):WordBlock[]{
 return wordSourceBlocks(source.blocks,source.parts[role],role);
}
export function wordSourceBlocks(input:WordBlock[],spans:WordSourceSpan[],role:WordQuestionRole):WordBlock[]{
 const blocks=new Map(input.map(b=>[b.id,b]));
 return spans.map(span=>{
  const b=blocks.get(span.blockId);if(!b)throw Error('source_changed');
  if(b.kind==='table'){if(span.from!==undefined||span.to!==undefined)throw Error('source_changed');return structuredClone(b);}
  const from=span.from??0,to=span.to??wordInlineLength(b),text=wordParagraphMap(b);
  if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||to<=from||to>text.length||!boundary(text,from)||!boundary(text,to))throw Error('source_changed');
  let at=0;const inlines:typeof b.inlines=[];
  for(const inline of b.inlines){const end=at+(inline.kind==='text'?inline.text.length:1);if(from<end&&to>at)inlines.push(inline.kind==='text'?{kind:'text',text:inline.text.slice(Math.max(0,from-at),Math.min(end,to)-at)}:{...inline});at=end;}
  const result={...b,inlines};if(from!==0||role!=='question')delete result.numbering;return result;
 });
}
export function wordQuestionText(blocks:WordBlock[]):string{
 return blocks.map(b=>b.kind==='paragraph'?(b.numbering?.label||'')+b.inlines.map(i=>i.kind==='text'?i.text:i.kind==='formula'?' $'+i.latex+'$ ':' [原图'+(i.assetId?' '+i.assetId:'缺失')+'] ').join(''):b.rows.map(r=>r.cells.map(c=>wordQuestionText(c.blocks)).join(' | ')).join('\n')).join('\n').trim();
}

export function validWordQuestionSource(v:unknown):v is WordQuestionSource{
 if(!obj(v)||!exact(v,['schemaVersion','ordinal','number','documentSha','context','blocks','assets','parts','canonical','issues',...(Object.hasOwn(v,'indexPolicy')?['indexPolicy']:[])])||Object.hasOwn(v,'indexPolicy')&&v.indexPolicy!==WORD_SCOPED_QUESTION_POLICY&&!isWordBookletPolicy(v.indexPolicy)||v.schemaVersion!==WORD_QUESTION_SCHEMA||!Number.isSafeInteger(v.ordinal)||Number(v.ordinal)<1||Number(v.ordinal)>10000||typeof v.number!=='string'||!/^\d{1,5}$/.test(v.number)||typeof v.documentSha!=='string'||!/^[a-f0-9]{64}$/.test(v.documentSha)||typeof v.context!=='string'||v.context.length>2048||!Array.isArray(v.blocks)||!v.blocks.length||!Array.isArray(v.assets)||v.assets.length>512||!Array.isArray(v.issues)||v.issues.length>WORD_QUESTION_ISSUES.length||new Set(v.issues).size!==v.issues.length||!v.issues.every(i=>WORD_QUESTION_ISSUES.includes(i))||!exact(v.parts,[...WORD_QUESTION_ROLES])||!exact(v.canonical,[...WORD_QUESTION_ROLES]))return false;
 if(!validWordDocument({schemaVersion:WORD_SCHEMA,parser:WORD_PARSER,imagePolicy:WORD_IMAGE_POLICY,blocks:v.blocks,assets:v.assets,warnings:[]} satisfies WordDocument))return false;
 const source=v as WordQuestionSource,blocks=new Map(source.blocks.map(b=>[b.id,b])),used=new Map<string,Array<[number,number]>>(),selectedImages=new Set<string>();let count=0;
 function images(list:WordBlock[]){for(const b of list){if(b.kind==='table'){for(const r of b.rows)for(const c of r.cells)images(c.blocks);}else for(const i of b.inlines)if(i.kind==='image'&&i.assetId)selectedImages.add(i.assetId);}}
 try{
  for(const role of WORD_QUESTION_ROLES){
   if(!Array.isArray(source.parts[role])||typeof source.canonical[role]!=='string'||source.canonical[role].length>24000)return false;
   let previous=-1,previousEnd=0;
   for(const span of source.parts[role]){
    if(!obj(span)||!Object.hasOwn(span,'blockId')||Object.keys(span).some(k=>!['blockId','from','to'].includes(k))||typeof span.blockId!=='string'||++count>64)return false;
    const b=blocks.get(span.blockId);if(!b)return false;const index=source.blocks.indexOf(b);
    if(index<previous)return false;const from=b.kind==='table'?0:span.from??0,to=b.kind==='table'?1:span.to??wordInlineLength(b);
    if(index===previous&&from<previousEnd)return false;previous=index;previousEnd=to;
    const ranges=used.get(b.id)||[];if(ranges.some(([lo,hi])=>from<hi&&to>lo))return false;ranges.push([from,to]);used.set(b.id,ranges);
   }
   const resolved=wordQuestionBlocks(source,role);images(resolved);if(wordQuestionText(resolved)!==source.canonical[role])return false;
  }
  return selectedImages.size<=8&&source.parts.question.length>0&&source.blocks.every(b=>used.has(b.id))&&new TextEncoder().encode(JSON.stringify(v)).length<=WORD_QUESTION_BYTES;
 }catch{return false;}
}
