import {validPageBlocks,type PageBlocks} from './material-page-blocks';
import {continuationTextSignature,validContinuationTextProof,type ContinuationTextProof} from './material-ai-continuation-text';
import {MATERIAL_FIGURE_CROPS,CONTINUATION_BLOCK_PREFIX,isDiagramGroup,ownedPageFragmentGroups,ownedPageFragmentGroupPlans} from './material-ai-owned-crops';
import {validBlockTexts,type BlockTextHint,type FragmentPageSource} from './material-ai-page-fragments';
import {aiTextSignature} from './material-ai-image';
import {sourceLayoutSignature} from './material-ai-source-layout';
import {validMaterialPageSource,type MaterialPageSource,type AiPagePrompt} from './material-ai-page';
import {MATERIAL_PREVIEW_SCHEMA,PDF_PAGE_ENGINE,validMaterialPreviewQuery,type MaterialPreviewResult} from './material-page-preview';

export const PAGE_CONTINUATION='page-continuation.v1' as const;
export const PAGE_CONTINUATION_TEXT='page-continuation.v2' as const;
export const PAGE_CONTINUATION_CHOICES='page-continuation.choices.v1' as const;
export const PAGE_CONTINUATION_FIRST='page-continuation.first-subquestion.v1' as const;
export const PAGE_CONTINUATION_SENTENCE='page-continuation.sentence.v1' as const;
export const PAGE_CONTINUATION_CAPTION='page-continuation.caption-seam.v1' as const;
export const CONTINUATION_FIGURE_CROPS='layout-subcrops.v1' as const;
export type ContinuationScope={kind:'selected_pages'}|{kind:'folder_grant';folderId:string;revision:number};
export type ContinuationImage=Omit<Extract<MaterialPreviewResult,{ok:true}>,'dataUrl'>;
type ContinuationBase={number:string;nextNumber:string;source:MaterialPageSource;blocks:PageBlocks;blockTexts:BlockTextHint[];blockIds:string[];text:string;image:ContinuationImage;scope:ContinuationScope};
type SentencePreceding={blockIds:string[];text:string};
type SentenceContinuation={schemaVersion:typeof PAGE_CONTINUATION_SENTENCE|typeof PAGE_CONTINUATION_CAPTION;preceding:SentencePreceding;textProof?:ContinuationTextProof};
export type PageContinuation=ContinuationBase&({schemaVersion:typeof PAGE_CONTINUATION|typeof PAGE_CONTINUATION_CHOICES}|{schemaVersion:typeof PAGE_CONTINUATION_TEXT;textProof:ContinuationTextProof}|{schemaVersion:typeof PAGE_CONTINUATION_FIRST;textProof?:ContinuationTextProof}|SentenceContinuation);
const sentenceSchema=(schema:unknown)=>schema===PAGE_CONTINUATION_SENTENCE||schema===PAGE_CONTINUATION_CAPTION;
export const isSentenceContinuation=(extra?:PageContinuation):extra is ContinuationBase&SentenceContinuation=>sentenceSchema(extra?.schemaVersion);
const parent=/^[ \t]*(?:第[ \t]*(\d{1,5})[ \t]*题[ \t]*[:：]?|(\d{1,5})[.、．](?!\d))/gmu;
const markers=(text:string)=>[...text.matchAll(new RegExp(parent))];
const continuationStart=/^\s*(?:[（(]\s*(?:[2-9]|[1-9][0-9])\s*[)）]|[②-⑳])/u;
const subquestion=/^\s*(?:[（(]\s*([1-9]\d?)\s*[)）]|([①-⑳]))/u;
const firstSubquestion=/^\s*(?:[（(]\s*1\s*[)）]|①)/u;
export const startsWithFirstSubquestion=(text:string)=>firstSubquestion.test(text);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
const number=(m:RegExpMatchArray)=>m[1]||m[2];
/** Conservative source planner. An unambiguous complete prefix must end at the next parent. */
function planSubquestionPrefix(currentText:string,currentHints:BlockTextHint[],nextText:string,blocks:PageBlocks,hints:BlockTextHint[],start:RegExp){
 if(!validPageBlocks(blocks)||!blocks.ok||!validBlockTexts(hints,blocks)||!start.test(nextText))return;
 const last=markers(currentText).at(-1),hintLast=markers(currentHints.map(h=>h.text).join('\n')).at(-1),boundary=markers(nextText)[0];
 if(!last||!hintLast||!boundary||number(last)!==number(hintLast)||Number(number(boundary))!==Number(number(last))+1)return;
 const rawPrefix=nextText.slice(0,boundary.index).trim(),index=hints.findIndex(h=>markers(h.text)[0]?.index===0);
 if(!rawPrefix||index<=0||number(markers(hints[index].text)[0])!==number(boundary))return;
 const prefix=blocks.blocks.slice(0,index).filter(b=>!['header','footer','header_image','footer_image'].includes(b.kind)),blockIds=prefix.map(b=>b.id);
 const text=prefix.map(b=>hints.find(h=>h.blockId===b.id)!.text).join('\n').trim();
 if(!blockIds.length||blockIds.length>32||!start.test(text)||new TextEncoder().encode(text).length>8192)return;
 // Raw row-order OCR can interleave a lower neighbour's graph label before its parent.
 // Every owned line must occur in order; every leftover line needs an exact foreign-block witness.
 const raw=rawPrefix.split(/\r?\n/).map(aiTextSignature).filter(Boolean),used=new Set<number>();let cursor=0;
 for(const line of text.split(/\r?\n/).map(aiTextSignature).filter(Boolean)){const at=raw.findIndex((s,i)=>i>=cursor&&s===line);if(at<0)return;used.add(at);cursor=at+1;}
 const foreign=new Map<string,number>();for(const hint of hints.filter(h=>!blockIds.includes(h.blockId)))for(const line of hint.text.split(/\r?\n/).map(aiTextSignature).filter(Boolean))foreign.set(line,(foreign.get(line)||0)+1);
 for(const [i,line]of raw.entries())if(!used.has(i)){const count=foreign.get(line)||0;if(!count)return;foreign.set(line,count-1);}
 try{const [group]=ownedPageFragmentGroups(blocks,blockIds,1);return{number:number(last),nextNumber:number(boundary),blockIds,text,box:group.box};}catch{return;}
}

export function continuationPrefix(currentText:string,currentHints:BlockTextHint[],nextText:string,blocks:PageBlocks,hints:BlockTextHint[]){
 return planSubquestionPrefix(currentText,currentHints,nextText,blocks,hints,continuationStart);
}
const optionMarker=/(?:^|[ \t\u3000\n])(?:([A-H])[.．、]|[（(]([A-H])[）)])/gmu;
export const startsWithContinuationChoices=(text:string)=>/^(?:A[.．、]|[（(]A[）)])/u.test(text.trimStart());
const continuationMargins=new Set(['header','footer','header_image','footer_image','number']);
const pendingChoice=/[（(]\s*[）)]\s*[。.!！?？]?\s*$/u;
const pageCountLine=/^第\s*\d{1,5}\s*页\s*共\s*\d{1,5}\s*页$/u;
const pageLabel=/^(?:第\s*)?([1-9]\d{0,4})\s*(?:页\s*共|[/／])\s*([1-9]\d{0,4})\s*页?$/u;
const sentenceOpening=/^\p{Script=Han}.{5,}[。！？!?]$/u;
const proseKinds=new Set(['text','content']);
const diagramKinds=new Set(['image','chart','figure_title']);
const lines=(text:string)=>text.split(/\r?\n/u).map(line=>line.trim()).filter(Boolean);
const counterMatches=(text:string,page:number,total:number)=>{
 const match=pageLabel.exec(text);
 return !!match&&Number(match[1])===page&&Number(match[2])===total;
};
const paginationBlock=(page:PageBlocks,hints:BlockTextHint[],index:number,total:number)=>page.blocks.some((b,i)=>
 b.kind==='number'&&(b.box[3]<.12||b.box[1]>.85)&&counterMatches(hints[i].text,index,total));

/** PDF text extractors can flatten a printed variable index. This key only
 * anchors layout ownership. The archived literal text keeps the actual glyphs. */
function sentenceOwnershipKey(text:string){
 return sourceLayoutSignature(continuationTextSignature(text)
  .replace(/(?<=[a-zA-Z])[₀-₉]+/gu,value=>Array.from(value,char=>String(char.codePointAt(0)!-0x2080)).join(''))
  .replace(/[ʹ’]/gu,'′').replace(/[．]/gu,'.'));
}

/** Two agreeing original-image readings may restore a variable index which
 * text extraction flattened. A known subscript, value or operator cannot be
 * flattened or replaced to get agreement. This never rewrites the receipt. */
export function sentenceLiteralAgrees(reference:string,reading:string){
 const expected=continuationTextSignature(reference),actual=continuationTextSignature(reading);
 if(expected.length!==actual.length)return false;
 for(let i=0;i<expected.length;i++){
  if(expected[i]===actual[i])continue;
  if(!/[0-9]/u.test(expected[i])||!/[A-Za-z]/u.test(expected[i-1]||'')||
   /[A-Za-z0-9]/u.test(expected[i-2]||'')||actual.charCodeAt(i)!==0x2080+Number(expected[i]))return false;
 }
 return true;
}

function sentenceLead(text:string){
 const boundary=markers(text)[0];
 if(!boundary)return;
 const prefix=text.slice(0,boundary.index).trim(),rows=lines(prefix);
 if(!sentenceOpening.test(rows[0]||'')||!subquestion.test(rows[1]||'')||!orderedSubquestions(prefix))return;
 return {number:number(boundary),prefix};
}

/** Cheap source-only filter before loading the adjacent raster/layout. */
export function hasSentenceContinuationLead(text:string,page:number,total:number){
 const rows=lines(text);
 if(counterMatches(rows[0]||'',page,total))rows.shift();
 return !!sentenceLead(rows.join('\n'));
}

function sentenceRegion(raw:string,blocks:PageBlocks,hints:BlockTextHint[],page:number,total:number){
 const rows=lines(raw),withCounter=counterMatches(rows[0]||'',page,total);
 if(withCounter){
  if(!paginationBlock(blocks,hints,page,total))return;
  rows.shift();
 }
 const lead=sentenceLead(rows.join('\n'));if(!lead)return;
 const index=hints.findIndex(h=>markers(h.text)[0]?.index===0);
 if(index<1||number(markers(hints[index].text)[0])!==lead.number)return;
 const owned=blocks.blocks.slice(0,index).filter(b=>!continuationMargins.has(b.kind));
 if(!owned.length||owned.length>32||owned[0].box[1]>.24||owned.some(b=>!proseKinds.has(b.kind)))return;
 const text=owned.map(b=>hints.find(h=>h.blockId===b.id)!.text).join('\n').trim();
 if(new TextEncoder().encode(text).length>8192||sentenceOwnershipKey(text)!==sentenceOwnershipKey(lead.prefix))return;
 if(!sentenceLead(text+'\n'+lead.number+'. 下一题'))return;
 const blockIds=owned.map(b=>b.id);
 try{return{nextNumber:lead.number,text,blockIds,box:ownedPageFragmentGroups(blocks,blockIds,1)[0].box,withCounter};}catch{return;}
}

export function continuationSentencePrefix(previous:FragmentPageSource,currentRaw:string,next:FragmentPageSource,nextRaw:string,page:number,total:number){
 if(!validPageBlocks(previous.blocks)||!previous.blocks.ok||!validBlockTexts(previous.blockTexts,previous.blocks)||
    !validPageBlocks(next.blocks)||!next.blocks.ok||!validBlockTexts(next.blockTexts,next.blocks))return;
 const region=sentenceRegion(nextRaw,next.blocks,next.blockTexts,page+1,total);if(!region)return;
 if(region.withCounter&&(!counterMatches(lines(currentRaw)[0]||'',page,total)||!paginationBlock(previous.blocks,previous.blockTexts,page,total)))return;
 const last=markers(currentRaw).at(-1);if(!last||Number(number(last))+1!==Number(region.nextNumber))return;
 const index=previous.blockTexts.findLastIndex(h=>markers(h.text)[0]?.index===0);
 if(index<0||number(markers(previous.blockTexts[index].text)[0])!==number(last))return;
 const left=previous.blocks.blocks.slice(index).filter(b=>!continuationMargins.has(b.kind));
 if(!left.length||left.length>32||left[0].box[1]<.65||Math.abs(left[0].box[0]-region.box[0])>.045||
    left.some(b=>!proseKinds.has(b.kind)&&!diagramKinds.has(b.kind)))return;
 const body=left.filter(b=>proseKinds.has(b.kind)),bodyEnd=body.at(-1)?.box[3]||0;
 if(bodyEnd<.78||left.some(b=>diagramKinds.has(b.kind)&&(b.box[1]<left[0].box[1]-.015||b.box[1]>bodyEnd+.06)))return;
 const lookup=new Map(previous.blockTexts.map(h=>[h.blockId,h.text]));
 const text=body.map(b=>lookup.get(b.id)).join('\n').trim();
 if(text.length>8192||!/\p{Script=Han}$/u.test(text)||lines(text).some(line=>subquestion.test(line)))return;
 const nativeRows=lines(currentRaw.slice(last.index));
 const count=lines(text).length;
 if(sentenceOwnershipKey(nativeRows.slice(0,count).join('\n'))!==sentenceOwnershipKey(text))return;
 // Unmatched native text must be a bounded label or a label identified in
 // non-body artwork. A detached prose condition can never be discarded here.
 const figureKey=previous.blocks.blocks.filter(b=>diagramKinds.has(b.kind)).map(b=>sentenceOwnershipKey(lookup.get(b.id)||'')).join('\n').replace(/\s/gu,'');
 if(nativeRows.slice(count).some(row=>{
  const key=sentenceOwnershipKey(row).replace(/\s/gu,'');
  return !counterMatches(row,page,total)&&!figureKey.includes(key)&&(row.length>32||/[\p{Script=Han}。；！？=＝±×÷≤≥≠]/u.test(row));
 }))return;
 const {withCounter:_,...rest}=region;
 const blockIds=left.map(b=>b.id);
 try{ownedPageFragmentGroups(previous.blocks,blockIds,8,true);}catch{return;}
 return {...rest,number:number(last),preceding:{blockIds,text}};
}

const numberedCaption=/^图[ \t]*(\d{1,4})(?:[：:、.．]|[ \t])[^\n]*$/u;
const referencedFigures=(text:string)=>new Set([...text.matchAll(/图\s*(\d{1,4})(?![\d.．\-—－])/gu)].map(m=>m[1]));
const uniqueFigureReference=(text:string,expected:string)=>{
 const figures=referencedFigures(text);
 return figures.size===1&&figures.has(expected);
};
function captionLead(raw:string){
 const boundary=markers(raw)[0];if(!boundary)return;
 const prefix=raw.slice(0,boundary.index).trim(),rows=lines(prefix);
 const captions=rows.flatMap((row,index)=>{const match=numberedCaption.exec(row);return match?[{index,number:match[1]}]:[];});
 if(captions.length!==2||captions[0].number===captions[1].number||captions[0].index<1||captions[1].index!==rows.length-1)return;
 return rows.slice(captions[0].index+1,captions[1].index).some(row=>/^\p{Script=Han}.{8,}/u.test(row))?{prefix,nextNumber:number(boundary)}:undefined;
}
export const hasCaptionContinuationLead=(raw:string)=>!!captionLead(raw);

function captionRegion(blocks:PageBlocks,hints:BlockTextHint[]){
 const boundary=hints.findIndex(h=>markers(h.text)[0]?.index===0);
 if(boundary<5||boundary>32)return;
 const prefix=blocks.blocks.slice(0,boundary).filter(b=>!continuationMargins.has(b.kind));
 const artwork=(b:PageBlocks['blocks'][number])=>b.kind==='image'||b.kind==='chart';
 const [foreign,foreignCaption]=prefix;
 const [figure,caption]=prefix.slice(-2),body=prefix.slice(2,-2);
 if(!body.length||!artwork(foreign)||!artwork(figure)||foreignCaption.kind!=='figure_title'||caption.kind!=='figure_title'||body.some(b=>!proseKinds.has(b.kind)))return;
 const lookup=new Map(hints.map(h=>[h.blockId,h.text])),textOf=(b:PageBlocks['blocks'][number])=>lookup.get(b.id)!;
 const foreignNumber=numberedCaption.exec(textOf(foreignCaption))?.[1],figureNumber=numberedCaption.exec(textOf(caption))?.[1];
 if(!foreignNumber||!figureNumber||foreignNumber===figureNumber)return;
 for(const [art,label] of [[foreign,foreignCaption],[figure,caption]]){
  if(label.box[1]<art.box[3]-.004||label.box[1]>art.box[3]+.035||Math.min(art.box[2],label.box[2])<=Math.max(art.box[0],label.box[0]))return;
 }
 if(foreignCaption.box[3]>=body[0].box[1]||body.at(-1)!.box[3]>figure.box[1]+.004||caption.box[3]>=blocks.blocks[boundary].box[1])return;
 const prose=body.map(textOf).join('\n').trim();
 if(!/^\p{Script=Han}/u.test(prose)||prose.length<12||!/[？?]$/u.test(prose)||lines(prose).some(line=>subquestion.test(line)))return;
 const owned=prefix.slice(2),blockIds=owned.map(b=>b.id),text=owned.map(textOf).join('\n').trim();
 if(new TextEncoder().encode(text).length>8192)return;
 try{return {nextNumber:number(markers(hints[boundary].text)[0]),foreignNumber,figureNumber,bodyBox:body[0].box,
  rawPrefix:prefix.map(textOf).join('\n'),blockIds,text,box:ownedPageFragmentGroups(blocks,blockIds,1)[0].box};}catch{return;}
}

/** A displaced opening figure is excluded only when an earlier parent claims
 * its printed number and a different figure uniquely matches the open parent. */
export function continuationCaptionPrefix(previous:FragmentPageSource,currentRaw:string,next:FragmentPageSource,nextRaw:string,page:number){
 if(!validPageBlocks(previous.blocks)||!previous.blocks.ok||!validBlockTexts(previous.blockTexts,previous.blocks)||
    !validPageBlocks(next.blocks)||!next.blocks.ok||!validBlockTexts(next.blockTexts,next.blocks))return;
 const lead=captionLead(nextRaw);if(!lead)return;
 const region=captionRegion(next.blocks,next.blockTexts);
 if(!region||lead.nextNumber!==region.nextNumber||sentenceOwnershipKey(lead.prefix)!==sentenceOwnershipKey(region.rawPrefix))return;
 const currentParents=markers(currentRaw),prior=currentParents.at(-2),last=currentParents.at(-1);
 if(!prior||!last||Number(number(prior))+1!==Number(number(last))||Number(number(last))+1!==Number(region.nextNumber))return;
 const layoutParents=previous.blockTexts.flatMap((hint,index)=>{const marker=markers(hint.text)[0];return marker?.index===0?[{index,number:number(marker)}]:[];});
 const priorLayout=layoutParents.at(-2),lastLayout=layoutParents.at(-1);
 if(!priorLayout||!lastLayout||priorLayout.number!==number(prior)||lastLayout.number!==number(last))return;
 const blockRange=previous.blocks.blocks.slice(lastLayout.index),owned=blockRange.filter(b=>!continuationMargins.has(b.kind));
 const text=previous.blockTexts.slice(lastLayout.index).filter((_,index)=>!continuationMargins.has(blockRange[index].kind)).map(h=>h.text).join('\n').trim();
 if(!owned.length||owned.length>32||owned.some(b=>!proseKinds.has(b.kind))||owned[0].box[1]<.65||owned.at(-1)!.box[3]<.78||
    Math.abs(owned[0].box[0]-region.bodyBox[0])>.045||!/\p{Script=Han}$/u.test(text)||lines(text).some(line=>subquestion.test(line))||text.length>8192)return;
 const rows=lines(currentRaw.slice(last.index)),printedFooter=rows.at(-1)??'';
 if(Number(pageLabel.exec(printedFooter)?.[1])===page&&blockRange.some((b,i)=>b.kind==='number'&&b.box[1]>.9&&
    sentenceOwnershipKey(previous.blockTexts[lastLayout.index+i].text)===sentenceOwnershipKey(printedFooter)))rows.pop();
 if(sentenceOwnershipKey(rows.join('\n'))!==sentenceOwnershipKey(text))return;
 const earlier=previous.blockTexts.slice(priorLayout.index,lastLayout.index).filter((_,i)=>proseKinds.has(previous.blocks.blocks[priorLayout.index+i].kind)).map(h=>h.text).join('\n');
 if(!uniqueFigureReference(text,region.figureNumber)||!uniqueFigureReference(earlier,region.foreignNumber)||
    !uniqueFigureReference(currentRaw.slice(prior.index,last.index),region.foreignNumber))return;
 const blockIds=owned.map(b=>b.id);
 try{ownedPageFragmentGroups(previous.blocks,blockIds,8,true);}catch{return;}
 return {number:number(last),nextNumber:region.nextNumber,blockIds:region.blockIds,text:region.text,box:region.box,preceding:{blockIds,text}};
}

export function openSubquestionStem(text:string){
 const last=markers(text).at(-1);if(!last)return;
 const lines=text.slice(last.index!+last[0].length).split(/\r?\n/u).map(line=>line.trim()).filter(Boolean);
 if(pageCountLine.test(lines.at(-1)??''))lines.pop();
 const body=lines.join('\n'),request=/(?:^|[。！？：，；,.!?:;])[ \t]*(?:求|(?:请)?回答(?:下列)?问题|完成下列(?:各题|小题))[:：]$/u;
 const cue=request.exec(body);
 if(!cue||cue.index<8||lines.some(line=>subquestion.test(line)))return;
 return continuationTextSignature(body);
}

function orderedSubquestions(text:string){
 const numbers=text.split(/\r?\n/u).flatMap(line=>{
  const marker=subquestion.exec(line);
  return marker?[marker[1]?Number(marker[1]):marker[2].codePointAt(0)!-0x245f]:[];
 });
 return numbers.length>=2&&numbers.every((value,index)=>value===index+1);
}

/** The first subquestion can start on the next page only if both current
 * readings already end with the same explicit, still-open parent stem. */
export function continuationFirstSubquestionPrefix(currentText:string,currentHints:BlockTextHint[],nextText:string,blocks:PageBlocks,hints:BlockTextHint[]){
 const stem=openSubquestionStem(currentText);
 if(!stem||stem!==openSubquestionStem(currentHints.map(hint=>hint.text).join('\n')))return;
 const plan=planSubquestionPrefix(currentText,currentHints,nextText,blocks,hints,firstSubquestion);
 if(plan&&orderedSubquestions(plan.text)&&orderedSubquestions(nextText.slice(0,markers(nextText)[0].index)))return plan;
}

function choiceBodies(text:string){
 const markers=[...text.matchAll(optionMarker)];
 if(markers.length<2||markers.length>8||markers[0].index!==0)return;
 const bodies=markers.map((marker,index)=>({
  label:marker[1]||marker[2],
  text:text.slice(marker.index!+marker[0].length,markers[index+1]?.index??text.length).trim(),
 }));
 if(bodies.every(({label,text},index)=>label===String.fromCharCode(65+index)&&!!aiTextSignature(text)))return bodies;
}

function sameChoiceOwnership(a:string,b:string){
 if(aiTextSignature(a)===aiTextSignature(b))return true;
 // PDFium and OCR may lay out inline fractions differently. This comparison
 // only locates the printed region. Publication still checks the full source.
 const prose=(s:string)=>s.replace(/[^\p{Script=Han}]/gu,'');
 const left=prose(a),right=prose(b);
 if(left.length<8)return false;
 if(left===right)return true;
 // Local OCR can mistake one glyph next to an equation for a Han character.
 // Keep that glyph in its raw receipt, and allow it only to locate the crop.
 if(right.length!==left.length+1||!/[=＝][ \t]*[\p{Script=Latin}\p{Script=Greek}\p{N}\u{1D400}-\u{1D7FF}]/u.test(a))return false;
 const afterEquation=[...b.matchAll(/([=＝][ \t]*)\p{Script=Han}(?=\p{Script=Han}{5})/gu)];
 if(afterEquation.length!==1)return false;
 const match=afterEquation[0],start=match.index!+match[1].length;
 return left===prose(b.slice(0,start)+b.slice(start+1));
}

function unfinishedChoice(text:string,marker:RegExpMatchArray){
 const tail=text.slice(marker.index!+marker[0].length).split(/\r?\n/u).map(line=>line.trim()).filter(Boolean);
 if(pageCountLine.test(tail.at(-1)??''))tail.pop();
 const body=tail.join('\n');
 return pendingChoice.test(body)&&![...body.matchAll(optionMarker)].length?body:undefined;
}

export function hasUnfinishedContinuationChoice(text:string){
 const last=markers(text).at(-1);
 return !!last&&!!unfinishedChoice(text,last);
}

/** Final evidence compares every choice body, including all math and units. */
export function continuationChoicesAgree(text:string,stem:string){
 const reference=choiceBodies(text);
 const starts=[...stem.matchAll(optionMarker)].filter(m=>(m[1]||m[2])==='A');
 if(!reference||starts.length!==1)return false;
 const restored=choiceBodies(stem.slice(starts[0].index).trim());
 return !!restored&&restored.length===reference.length&&
  reference.every((choice,i)=>continuationTextSignature(choice.text)===continuationTextSignature(restored[i].text));
}

/** A complete, printed choice list on the next page may belong to the previous
 * parent. Geometry and labels pin the crop; the original text stays exact. */
export function continuationChoicePrefix(currentText:string,currentHints:BlockTextHint[],nextText:string,blocks:PageBlocks,hints:BlockTextHint[]){
 if(!startsWithContinuationChoices(nextText)||!validPageBlocks(blocks)||!blocks.ok||!validBlockTexts(hints,blocks))return;
 const currentLayout=currentHints.map(h=>h.text).join('\n'),last=markers(currentText).at(-1),localLast=markers(currentLayout).at(-1),next=markers(nextText)[0];
 if(!last||!localLast||!next||number(last)!==number(localLast)||Number(number(next))!==Number(number(last))+1)return;
 const head=unfinishedChoice(currentText,last),localHead=unfinishedChoice(currentLayout,localLast);
 if(!head||!localHead||!sameChoiceOwnership(head,localHead))return;
 const index=hints.findIndex(h=>markers(h.text)[0]?.index===0);
 if(index<=0||number(markers(hints[index].text)[0])!==number(next))return;
 const prefix=blocks.blocks.slice(0,index).filter(b=>!continuationMargins.has(b.kind)),blockIds=prefix.map(b=>b.id);
 if(!blockIds.length||blockIds.length>32||prefix.some(b=>!['text','content'].includes(b.kind)))return;
 const text=nextText.slice(0,next.index).trim(),local=prefix.map(b=>hints.find(h=>h.blockId===b.id)!.text).join('\n').trim();
 if(new TextEncoder().encode(text).length>8192)return;
 const raw=choiceBodies(text),layout=choiceBodies(local);
 if(!raw||!layout||raw.length!==layout.length||!raw.every((choice,k)=>sameChoiceOwnership(choice.text,layout[k].text)))return;
 try{
  const [group]=ownedPageFragmentGroups(blocks,blockIds,1);
  return {number:number(last),nextNumber:number(next),blockIds,text,box:group.box};
 }catch{return;}
}
export function validPageContinuation(v:unknown):v is PageContinuation{
 const keys=['schemaVersion','number','nextNumber','source','blocks','blockTexts','blockIds','text','image','scope'];
 if(!v||typeof v!=='object')return false;
 const fields=[...keys,...(Object.hasOwn(v,'preceding')?['preceding']:[]),...(Object.hasOwn(v,'textProof')?['textProof']:[])];
 if(!exact(v,fields))return false;
 const schema=v.schemaVersion,withProof=Object.hasOwn(v,'textProof');
 const sentence=sentenceSchema(schema);
 if(typeof v.text!=='string'||!sentence&&![PAGE_CONTINUATION,PAGE_CONTINUATION_CHOICES,PAGE_CONTINUATION_TEXT,PAGE_CONTINUATION_FIRST].some(version=>version===schema))return false;
 if(sentence!==Object.hasOwn(v,'preceding')||schema===PAGE_CONTINUATION_TEXT&&!withProof||withProof&&(schema!==PAGE_CONTINUATION_TEXT&&schema!==PAGE_CONTINUATION_FIRST&&!sentence||!validContinuationTextProof(v.textProof,v.text)))return false;
 if(!validMaterialPageSource(v.source)||v.source.schemaVersion!=='xiaozhi.material-page-source.v1'||!validPageBlocks(v.blocks)||!v.blocks.ok||!validBlockTexts(v.blockTexts,v.blocks)||typeof v.number!=='string'||!/^\d{1,5}$/.test(v.number)||typeof v.nextNumber!=='string'||Number(v.nextNumber)!==Number(v.number)+1||!/^\d{1,5}$/.test(v.nextNumber)||typeof v.text!=='string'||v.text.length>8192||!Array.isArray(v.blockIds)||Object.getPrototypeOf(v.blockIds)!==Array.prototype||v.blockIds.length<1||v.blockIds.length>32||Reflect.ownKeys(v.blockIds).length!==v.blockIds.length+1||!Array.from({length:v.blockIds.length},(_,i)=>Object.getOwnPropertyDescriptor(v.blockIds,String(i))).every(d=>!!d&&d.enumerable&&'value'in d&&typeof d.value==='string'))return false;
 const scope=v.scope;if(!(exact(scope,['kind'])&&scope.kind==='selected_pages'||exact(scope,['kind','folderId','revision'])&&scope.kind==='folder_grant'&&typeof scope.folderId==='string'&&/^batch_[a-f0-9-]{36}$/i.test(scope.folderId)&&Number.isSafeInteger(scope.revision)&&Number(scope.revision)>=1))return false;
 const choice=v.schemaVersion===PAGE_CONTINUATION_CHOICES;
 const current=`${v.number}. 原题${choice?'（ ）':''}`;
 const first=v.schemaVersion===PAGE_CONTINUATION_FIRST;
 const next=`${v.text}\n${v.nextNumber}. 下一题`,hints=[{blockId:'block-1',text:current}];
 if(sentence){
  const prior=v.preceding;
  if(!exact(prior,['blockIds','text'])||typeof prior.text!=='string'||prior.text.length>8192||!/\p{Script=Han}$/u.test(prior.text)||
     number(markers(prior.text)[0]||[])!==v.number||!Array.isArray(prior.blockIds)||Object.getPrototypeOf(prior.blockIds)!==Array.prototype||
     prior.blockIds.length<1||prior.blockIds.length>32||Reflect.ownKeys(prior.blockIds).length!==prior.blockIds.length+1||
     !Array.from({length:prior.blockIds.length},(_,i)=>Object.getOwnPropertyDescriptor(prior.blockIds,String(i))).every(d=>!!d&&d.enumerable&&'value'in d&&typeof d.value==='string'&&/^block-[1-9]\d{0,2}$/u.test(d.value))||
     new Set(prior.blockIds).size!==prior.blockIds.length)return false;
 }
 const caption=schema===PAGE_CONTINUATION_CAPTION?captionRegion(v.blocks,v.blockTexts):undefined;
 if(schema===PAGE_CONTINUATION_CAPTION&&(!caption||caption.nextNumber!==v.nextNumber||
    !uniqueFigureReference((v.preceding as SentencePreceding).text,caption.figureNumber)))return false;
 const plan=caption??(sentence?sentenceRegion(next,v.blocks,v.blockTexts,v.source.page,0):first?planSubquestionPrefix(current,hints,next,v.blocks,v.blockTexts,firstSubquestion):(choice?continuationChoicePrefix:continuationPrefix)(current,hints,next,v.blocks,v.blockTexts));
 if(first&&!orderedSubquestions(v.text))return false;
 if(!plan||JSON.stringify(v.blockIds)!==JSON.stringify(plan.blockIds)||plan.text!==v.text)return false;
 const image=v.image;
 return exact(image,['schemaVersion','ok','requestId','resourceId','version','engine','assetId','page','total','box','width','height','sha256'])&&image.schemaVersion===MATERIAL_PREVIEW_SCHEMA&&image.ok===true&&image.engine===PDF_PAGE_ENGINE&&validMaterialPreviewQuery({schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:image.requestId,resourceId:image.resourceId,version:image.version,page:image.page,box:image.box})&&image.resourceId===v.source.resourceId&&image.version===v.source.version&&image.page===v.source.page&&JSON.stringify(image.box)===JSON.stringify(plan.box)&&Number.isSafeInteger(image.total)&&Number(image.total)>=v.source.page&&Number(image.total)<=10000&&typeof image.assetId==='string'&&/^asset_[a-f0-9-]{36}$/.test(image.assetId)&&typeof image.sha256==='string'&&/^[a-f0-9]{64}$/.test(image.sha256)&&[image.width,image.height].every(n=>Number.isSafeInteger(n)&&Number(n)>=1&&Number(n)<=2401);
}
export const pageContinuationTextProof=(extra?:PageContinuation)=>extra&&'textProof'in extra?extra.textProof:undefined;
export const pageContinuation=(prompt?:AiPagePrompt)=>prompt?.policy==='page-fragments.v3'?prompt.continuation:undefined;
export const continuationSubcrops=(prompt?:AiPagePrompt)=>prompt?.policy==='page-fragments.v3'&&prompt.continuationCropPolicy===CONTINUATION_FIGURE_CROPS;
/** Resolve only the frozen page selected by the crop planner; legacy next-page rasters stay opaque. */
export function fragmentSourceBlocks(prompt:AiPagePrompt,ids:string[]){
 if(!('blocks'in prompt))return [];
 const extra=pageContinuation(prompt);
 return ids.map(id=>id.startsWith(CONTINUATION_BLOCK_PREFIX)?continuationSubcrops(prompt)?extra?.blocks.blocks.find(b=>b.id===id.slice(CONTINUATION_BLOCK_PREFIX.length)):undefined:prompt.blocks.blocks.find(b=>b.id===id));
}
const inside=(a:ContinuationImage['box'],b:ContinuationImage['box'])=>a[0]>=b[0]&&a[1]>=b[1]&&a[2]<=b[2]&&a[3]<=b[3];
/** Subcrops bind the exact planned region, while legacy whole-prefix crops retain their SHA check. */
export function continuationCropMatches(prompt:AiPagePrompt,image:Pick<ContinuationImage,'resourceId'|'version'|'page'|'box'|'sha256'>,group:{box:ContinuationImage['box'];source?:MaterialPageSource}){
 if(!group.source)return true;
 const extra=pageContinuation(prompt);
 return !!extra&&image.resourceId===extra.source.resourceId&&image.version===extra.source.version&&image.page===extra.source.page&&JSON.stringify(image.box)===JSON.stringify(group.box)&&
  (continuationSubcrops(prompt)?inside(group.box,extra.image.box):image.sha256===extra.image.sha256);
}
/** Main block ids remain the model's selection. The authenticated prefix is appended exactly once. */
export function continuationCropGroups(prompt:Extract<AiPagePrompt,{blockTexts:BlockTextHint[]}>,ids:string[],number:string){
 const extra=pageContinuation(prompt),append=extra?.number===number;
 if(append&&isSentenceContinuation(extra)&&JSON.stringify(ids)!==JSON.stringify(extra.preceding.blockIds))throw Error('source_incomplete');
 if(append&&continuationSubcrops(prompt)){
  // Share the existing eight-image budget across both pages. Every candidate
  // covers every owned block; no clipping or truncation is used to fit the budget.
  type Groups={blockIds:string[];box:ContinuationImage['box'];source:MaterialPageSource|undefined}[];
  let best:{groups:Groups;mixed:number;diagrams:number;area:number}|undefined;
  const current=ownedPageFragmentGroupPlans(prompt.blocks,ids,true),following=ownedPageFragmentGroupPlans(extra.blocks,extra.blockIds,true);
  for(let slots=1;slots<8;slots++)for(let nextSlots=1;nextSlots<=8-slots;nextSlots++){
   if(!current[slots]||!following[nextSlots])continue;
   const groups:Groups=[...current[slots]!.map(g=>({...g,source:undefined})),
    ...following[nextSlots]!.map(g=>({...g,blockIds:g.blockIds.map(id=>CONTINUATION_BLOCK_PREFIX+id),source:extra.source}))];
   if(groups.some(g=>g.source&&!inside(g.box,extra.image.box)))continue;
   const mixed=groups.reduce((n,g)=>{const blocks=fragmentSourceBlocks(prompt,g.blockIds);return n+(blocks.some(b=>b&&!['image','chart','figure_title'].includes(b.kind))?blocks.filter(b=>b?.kind==='image'||b?.kind==='chart').length:0);},0),area=groups.reduce((n,g)=>n+(g.box[2]-g.box[0])*(g.box[3]-g.box[1]),0);
   const diagrams=groups.filter(g=>g.source?isDiagramGroup(extra.blocks,g.blockIds.map(id=>id.slice(CONTINUATION_BLOCK_PREFIX.length))):isDiagramGroup(prompt.blocks,g.blockIds)).length;
   if(!best||mixed<best.mixed||mixed===best.mixed&&(diagrams>best.diagrams||diagrams===best.diagrams&&(groups.length>best.groups.length||groups.length===best.groups.length&&area<best.area)))best={groups,mixed,diagrams,area};
  }
  if(!best)throw Error('source_incomplete');return best.groups;
 }
 const groups=ownedPageFragmentGroups(prompt.blocks,ids,append?7:8,prompt.figureCropPolicy===MATERIAL_FIGURE_CROPS).map(g=>({...g,source:undefined as MaterialPageSource|undefined}));
 if(append)groups.push({blockIds:extra.blockIds.map(id=>CONTINUATION_BLOCK_PREFIX+id),box:extra.image.box,source:extra.source});return groups;
}
