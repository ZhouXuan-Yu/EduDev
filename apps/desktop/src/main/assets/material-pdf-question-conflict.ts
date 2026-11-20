import type {StructurePage,StructureQuestion} from '../../shared/material-document-structure';
import {validNativeTextResult} from '../../shared/material-native-text';
import {validPageBox,type PageBox} from '../../shared/material-page-preview';
import type {PdfFilePage} from '../../shared/material-pdf-file';

const parents=/^[ \t]*(?:第[ \t]*([1-9]\d{0,4})[ \t]*题[ \t]*[:：]?|([1-9]\d{0,4})[.．、](?!\d))[ \t]*/gmu;
const options=/(?:^|\s|[、，])(?:[（(]([A-H])[）)]|([A-H])[.．、])/gu;

/** Compare the printed expression without joining separate numeric tokens or
 * flattening subscripts, exponents and operators. */
function printedTokens(text:string){
 const proof=text.normalize('NFC').replace(/[\uFF01-\uFF5E\u{1D400}-\u{1D7FF}]/gu,char=>{
  const plain=char.normalize('NFKC');
  return char.length===1||/^[A-Za-z]$/u.test(plain)?plain:char;
 });
 return proof.match(/[0-9]+(?:\.[0-9]+)?|[A-Za-zΑ-Ωα-ω]+|\S/gu)??[];
}
function samePrintedTokens(expected:string,actual:string,minLength=1){
 const a=printedTokens(expected),b=printedTokens(actual);
 return a.length>=minLength&&a.length===b.length&&a.every((token,index)=>token===b[index]);
}

/** A conflicted page can still independently prove a fully bounded question.
 * Shared material, open last questions and cross-page spans require review. */
function boundedPrintedQuestion(nativeText:string,question:StructureQuestion,page:number){
 if(question.kind!=='question'||question.pageRange[0]!==page||question.pageRange[1]!==page||
    question.sharedMaterialIds.length||question.subquestions.length||question.answer||question.analysis||
    question.assets.some(asset=>['inline_formula','display_formula','table'].includes(asset.kind))||question.stem.length>12000)return;
 const boundaries=[...nativeText.matchAll(parents)];
 const number=(boundary:RegExpMatchArray)=>boundary[1]||boundary[2];
 const owned=boundaries.filter(boundary=>number(boundary)===question.number);
 if(owned.length!==1)return;
 const first=owned[0],next=boundaries[boundaries.indexOf(first)+1];
 if(!next||Number(number(next))!==Number(question.number)+1)return;
 return {body:nativeText.slice(first.index+first[0].length,next.index),nextNumber:number(next)};
}

export function verifiedQuestionInPdfConflict(nativeText:string,question:StructureQuestion,page:number){
 const span=boundedPrintedQuestion(nativeText,question,page);
 return !!span&&samePrintedTokens(span.body,question.stem,12)&&literalChoicesAgree(question);
}

function literalChoicesAgree(question:StructureQuestion){
 const markers=[...question.stem.matchAll(options)];
 return markers.length===question.options.length&&question.options.every((option,index)=>{
  const marker=markers[index],label=marker[1]||marker[2];
  return label===option.label&&label===String.fromCharCode(65+index)&&
    samePrintedTokens(question.stem.slice(marker.index,markers[index+1]?.index),option.text);
 });
}


const numberedCaption=/^第\s*(\d{1,5})\s*题\s*(?:图|插图|示意图|表)[。．.]?$/u;
const annotationGlyph=/^[√✓✔×✗✘☑☒]$/u;
const compactGlyphs=(text:string)=>[...text.normalize('NFC').replace(/\s/gu,'')].sort().join('');
const joinBoxes=(boxes:PageBox[]):PageBox=>[
 Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),
 Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3])),
];
const overlapX=(a:PageBox,b:PageBox)=>Math.min(a[2],b[2])-Math.max(a[0],b[0]);
const overlapY=(a:PageBox,b:PageBox)=>Math.min(a[3],b[3])-Math.max(a[1],b[1]);
const touches=(a:PageBox,b:PageBox)=>overlapX(a,b)>0&&overlapY(a,b)>0;
const contentLines=(s:string)=>s.split(/\r?\n/u).map(t=>t.trim()).filter(Boolean);
const printedNumber=(s:string)=>{
 if(numberedCaption.test(s))return;
 const match=[...s.matchAll(parents)][0];
 return match?.[1]||match?.[2];
};

function pageOcrAgrees(text:string,page:StructurePage,number:string,ownedLines:Set<string>){
 const observed=contentLines(text),raw=page.lines.filter(line=>!line.origin);
 const owned=raw.filter(line=>ownedLines.has(line.id));
 if(owned.length!==ownedLines.size||owned.some(line=>line.score<.93||!validPageBox(line.box)))return false;
 const start=observed.findIndex(line=>printedNumber(line)===number);
 if(start<0||observed.filter(line=>printedNumber(line)===number).length!==1)return false;
 // Layout may interleave independent columns. They can only be split when
 // both OCR runs attest the full line sequence and ownership is checked below.
 const next=observed.findIndex((line,index)=>index>start&&printedNumber(line)!==undefined);
 return JSON.stringify(observed.slice(start,next<0?undefined:next))===JSON.stringify(owned.map(line=>line.text.trim()))||
    JSON.stringify(observed)===JSON.stringify(raw.map(line=>line.text.trim()));
}

function figureSlices(question:StructureQuestion,captions:StructurePage['paragraphs'],page:number){
 if(question.assets.some(asset=>asset.page!==page||!['image','chart'].includes(asset.kind)||
    asset.choiceLabel||!validPageBox(asset.box)))return;
 const boxes=question.assets.map(asset=>asset.box);
 for(const caption of captions){
  if(numberedCaption.exec(caption.text)?.[1]!==question.number)return;
  const box=caption.anchor.box;
  const owners=question.assets.map((asset,index)=>({box:asset.box,index})).filter(({box:figure})=>
   overlapX(box,figure)>=(box[2]-box[0])*.6&&box[1]>=figure[1]&&box[1]-figure[3]<=.04);
  if(owners.length!==1)return;
  const i=owners[0].index;
  boxes[i]=joinBoxes([boxes[i],box]);
 }
 return boxes;
}

function sourceRows(paragraphs:StructurePage['paragraphs'],page:StructurePage){
 const lineMap=new Map(page.lines.map(line=>[line.id,line]));
 const rows:PageBox[]=[];
 for(const id of paragraphs.flatMap(p=>p.lineIds)){
  const box=lineMap.get(id)?.box;
  if(!box)return;
  const last=rows.at(-1);
  if(last&&overlapY(box,last)>=.005)rows[rows.length-1]=joinBoxes([last,box]);
  else rows.push(box);
 }
 return rows;
}

function isPrintedExamHeading(text:string){
 const heading=/^[一二三四五六七八九十百]+[.、](?:(?:单项|多项|不定项)?选择题|填空题|判断题|解答题|计算题|证明题|实验题)(?:\(([^()]{1,120})\))?$/u
   .exec(text.normalize('NFKC').replace(/\s/gu,''));
 if(!heading)return false;
 const points=/^(?:(?:本大题|本节|本部分|本题组)?共\d{1,4}(?:小)?题|每(?:小?题|空)\d{1,3}分|(?:满分|共|合计)\d{1,4}分)$/u;
 return !heading[1]||heading[1].split(/[,、;。]/u).every(clause=>points.test(clause));
}

/** A separately positioned, literal exam heading can end the preceding printed question. */
export function verifiedQuestionBeforeNativeSection(receipt:PdfFilePage,question:StructureQuestion,page:StructurePage){
 const recovery=page.nativeRecovery,native=recovery?.native;
 if(receipt.status!=='needs_review'||receipt.error!=='text_conflict'||receipt.method!=='ocr'||
    receipt.ocrText!==page.rawText||!recovery||recovery.rasterSha256!==page.rasterSha256||recovery.unresolved.length||
    !validNativeTextResult(native)||!native.ok||native.version!==page.version||native.page!==page.page||native.total!==page.totalPages||
    compactGlyphs(native.items.map(item=>item.text).join(''))!==compactGlyphs(receipt.nativeText)||
    page.issues.length||question.status!=='candidate'||question.issues.length||question.assets.length)return false;
 const span=boundedPrintedQuestion(receipt.nativeText,question,page.page);
 if(!span||!literalChoicesAgree(question))return false;
 const literal=contentLines(span.body),terminal=literal.pop();
 if(!terminal||!isPrintedExamHeading(terminal)||!samePrintedTokens(literal.join('\n'),question.stem,12))return false;

 const start=page.paragraphs.findIndex(part=>part.id===question.paragraphIds[0]);
 if(start<0)return false;
 const parts=page.paragraphs.slice(start,start+question.paragraphIds.length);
 const [first]=parts,heading=page.paragraphs[start+parts.length],next=page.paragraphs[start+parts.length+1];
 const column=page.columns[first.column];
 if(!validPageBox(column)||first.marker?.kind!=='parent'||first.marker.label!==question.number||
    parts.length!==question.paragraphIds.length||parts.some((part,i)=>part.id!==question.paragraphIds[i]||
      part.anchor.page!==page.page||part.column!==first.column||part.issues.length||
      !validPageBox(part.anchor.box)||!(i===0?part.role==='question':['body','option'].includes(part.role)))||
    !heading||heading.role!=='heading'||heading.anchor.page!==page.page||heading.issues.length||heading.column!==first.column||
    !samePrintedTokens(terminal,heading.rawText)||!validPageBox(heading.anchor.box)||
    !next||next.anchor.page!==page.page||next.marker?.kind!=='parent'||next.marker.label!==span.nextNumber||next.column!==first.column||
    !validPageBox(next.anchor.box))return false;
 const owned=joinBoxes(parts.map(part=>part.anchor.box)), title=heading.anchor.box;
 if(owned[3]>=title[1]||title[3]>=next.anchor.box[1]||!page.regions.some(region=>
    region.score>=.8&&['paragraph_title','doc_title'].includes(region.kind)&&heading.regionIds.includes(region.id)&&
    overlapX(title,region.box)>=(title[2]-title[0])*.85&&overlapY(title,region.box)>=(title[3]-title[1])*.75))return false;

 const aligned=(box:PageBox,target:PageBox)=>Math.abs(box[0]-target[0])<=.025&&
   overlapY(box,target)>=Math.min(box[3]-box[1],target[3]-target[1])*.65;
 const firstNative=native.lines.filter(line=>aligned(line.box,first.anchor.box)&&printedNumber(line.text)===question.number);
 const titleNative=native.lines.filter(line=>aligned(line.box,title)&&samePrintedTokens(line.text,terminal));
 const nextNative=native.lines.filter(line=>aligned(line.box,next.anchor.box)&&printedNumber(line.text)===span.nextNumber);
 if(firstNative.length!==1||titleNative.length!==1||nextNative.length!==1||
    firstNative[0].box[3]>=titleNative[0].box[1]||titleNative[0].box[3]>=nextNative[0].box[1])return false;
 const band:PageBox=[column[0],Math.max(0,firstNative[0].box[1]-.002),column[2],titleNative[0].box[1]];
 const body=native.lines.filter(line=>touches(line.box,band));
 if(body[0]!==firstNative[0]||body.some(line=>line.box[0]<column[0]||line.box[2]>column[2]||line.box[3]>band[3]))return false;
 const marker=[...body[0].text.matchAll(parents)][0];
 const positioned=[body[0].text.slice(marker[0].length),...body.slice(1).map(line=>line.text)].join('\n');
 if(/[\p{Co}\uFFFD]/u.test(positioned)||!samePrintedTokens(positioned,question.stem,12))return false;

 // Check the physical OCR rows as well as the words. Raised or lowered native items are not flattened.
 const rawIds=new Set(parts.flatMap(part=>part.lineIds));
 const raw=page.lines.filter(line=>rawIds.has(line.id));
 if(raw.length!==rawIds.size||raw.some(line=>line.origin||!validPageBox(line.box)))return false;
 const rows=sourceRows(parts,page);
 const itemIds=body.flatMap(line=>line.itemIds), ids=new Set(itemIds);
 const items=native.items.filter(item=>touches(item.box,band));
 return !!rows?.length&&ids.size===itemIds.length&&items.length===ids.size&&items.every(({id,box})=>
   ids.has(id)&&rows.some(row=>box[0]>=row[0]-.012&&box[2]<=row[2]+.012&&
     box[3]-box[1]>=(row[3]-row[1])*.7&&Math.abs(box[3]-row[3])<=(row[3]-row[1])*.28&&touches(box,row)));
}

function fitSourceSlices(rows:PageBox[],figures:PageBox[],marks:PageBox[],foreign:PageBox[]){
 const fitted=[...rows];
 while(fitted.length+figures.length>8){
  const i=fitted.findIndex((a,index)=>{
   const b=fitted[index+1];
   if(!b||b[1]<a[1]||b[1]-a[3]>.035||Math.abs(a[0]-b[0])>.05)return false;
   const merged=joinBoxes([a,b]);
   return ![...marks,...foreign,...figures].some(box=>touches(merged,box));
  });
  if(i<0)return;
  fitted.splice(i,2,joinBoxes(fitted.slice(i,i+2)));
 }
 return [...fitted,...figures];
}

/** Alternate provenance for bounded printed items when native overlay
 * conflicts are demonstrably mark regions outside the original content. */
export function localizedPdfMarkProof(receipt:PdfFilePage,question:StructureQuestion,page:StructurePage){
 const recovery=page.nativeRecovery,native=recovery?.native;
 if(receipt.status!=='needs_review'||receipt.error!=='text_conflict'||receipt.method!=='ocr'||
    receipt.nativeText.length>4096||receipt.ocrText.length>32000||
    !recovery||recovery.rasterSha256!==page.rasterSha256||recovery.unresolved.length||
    !validNativeTextResult(native)||!native.ok||native.version!==page.version||
    native.page!==page.page||native.total!==page.totalPages||!native.items.length||
    compactGlyphs(native.items.map(i=>i.text).join(''))!==compactGlyphs(receipt.nativeText)||
    page.issues.length||question.kind!=='question'||question.pageRange.some(p=>p!==page.page)||
    question.status!=='candidate'||question.issues.length||question.confidence<.93||
    question.sharedMaterialIds.length||question.subquestions.length||question.answer||question.analysis||
    question.options.length<2||question.options.length>8||!literalChoicesAgree(question))return;

 const ids=new Set(question.paragraphIds);
 const parts=page.paragraphs.filter(p=>ids.has(p.id));
 if(parts.length!==ids.size||parts.some(p=>p.anchor.page!==page.page||p.issues.length||
    p.confidence<.93||!validPageBox(p.anchor.box)))return;
 const body=parts.filter(p=>p.role!=='figure'), captions=parts.filter(p=>p.role==='figure');
 const firstChoice=body.findIndex(p=>p.role==='option');
 const stem=body.slice(0,firstChoice),choices=body.slice(firstChoice);
 if(firstChoice<1||stem[0].role!=='question'||stem[0].marker?.label!==question.number||
    stem.slice(1).some(p=>p.role!=='body')||choices.some(p=>p.role!=='option')||
    !samePrintedTokens(body.map((p,i)=>i?p.text:p.text.replace(parents,'')).join('\n'),question.stem,12))return;
 const ownColumn=stem[0].column;
 if(ownColumn<0||!validPageBox(page.columns[ownColumn])||body.some(p=>p.column!==ownColumn))return;
 const choiceIds=new Set(choices.map(p=>p.id));
 if(question.options.some(o=>!o.paragraphIds.length||o.paragraphIds.some(id=>!choiceIds.has(id))))return;

 const figures=figureSlices(question,captions,page.page),stemRows=sourceRows(stem,page);
 if(!figures||!stemRows?.length)return;
 const rows=[...stemRows,...choices.map(p=>p.anchor.box)],slices=[...rows,...figures];
 if(slices.length>24||!slices.every(validPageBox)||slices.some((a,i)=>slices.slice(i+1).some(b=>
    overlapX(a,b)>.0015&&overlapY(a,b)>.0015)))return;
 const scope=joinBoxes(slices), ownedLines=new Set([
  ...parts.flatMap(p=>p.lineIds),...question.assets.flatMap(a=>a.lineIds??[]),
 ]);
 const inOtherColumn=(box:PageBox)=>page.columns.some((column,i)=>i!==ownColumn&&
  box[0]>=column[0]&&box[2]<=column[2]&&!touches(box,scope));
 const foreignLines=page.lines.filter(line=>!ownedLines.has(line.id));
 if(foreignLines.some(({box})=>overlapY(box,scope)>.0015&&!inOtherColumn(box))||
    !pageOcrAgrees(receipt.ocrText,page,question.number,ownedLines))return;

 const marks:PageBox[]=[], uncertainMarks:PageBox[]=[], observedRows=new Set<number>();
 for(const {box,text} of native.items){
  if(box[3]<scope[1]-.003||box[1]>scope[3]+.003||inOtherColumn(box))continue;
  const glyph=text.trim(),uncertain=glyph==='α';
  if((!annotationGlyph.test(glyph)&&!uncertain)||slices.some(slice=>touches(slice,box)))return;
  const index=choices.findIndex(({anchor:{box:choice}})=>{
   const height=choice[3]-choice[1],gap=box[0]-choice[2];
   return gap>=.0015&&gap<=Math.min(.09,Math.max(.02,height*2.5))&&
    overlapY(choice,box)/(box[3]-box[1])>=.7&&box[2]-box[0]<=.055&&box[3]-box[1]<=height*1.6;
  });
  if(index<0||observedRows.has(index))return;
  observedRows.add(index);marks.push(box);
  if(uncertain)uncertainMarks.push(box);
 }
 if(!marks.length||uncertainMarks.some(box=>marks.filter(mark=>
    !uncertainMarks.includes(mark)&&Math.abs(mark[0]-box[0])<=.035).length<2))return;

 const ownedRegions=new Set(question.assets.map(asset=>asset.regionId));
 const foreignRegions=page.regions.filter(r=>
    ['image','chart','table','display_formula','inline_formula'].includes(r.kind)&&
    !ownedRegions.has(r.id)&&!figures.some(box=>
      overlapX(box,r.box)>=(r.box[2]-r.box[0])*.98&&overlapY(box,r.box)>=(r.box[3]-r.box[1])*.98));
 if(foreignRegions.some(region=>slices.some(slice=>touches(slice,region.box))))return;
 const foreign=[...foreignLines.map(line=>line.box),...foreignRegions.map(r=>r.box)];
 const fitted=fitSourceSlices(rows,figures,marks,foreign);
 if(fitted)return {slices:fitted,marks};
}

function inkCounts(pixels:Uint8Array){
 const colors=[0,0,0];
 let dark=0;
 for(let i=0;i<pixels.length;i+=4){
  const b=pixels[i],g=pixels[i+1],r=pixels[i+2];
  if(r>=95&&r-g>=45&&r-b>=45)colors[2]++;
  else if(g>=95&&g-r>=45&&g-b>=45)colors[1]++;
  else if(b>=95&&b-r>=45&&b-g>=45)colors[0]++;
  else if(r+g+b<=345)dark++;
 }
 return {colors,dark};
}

/** A spatial mark must also have a distinct visible ink color. Reject crops
 * containing any observed mark pigment, including strokes outside its text box. */
export function separatedMarkPixels(marks:Iterable<Uint8Array>,slices:Iterable<Uint8Array>){
 const usedColors=new Set<number>();
 for(const pixels of marks){
  const {colors,dark}=inkCounts(pixels);
  const colored=colors.reduce((sum,count)=>sum+count,0);
  if(colored<Math.max(12,pixels.length*.01)||colored<dark*2||
     Math.max(...colors)<colored*.75)return false;
  colors.forEach((count,i)=>{if(count)usedColors.add(i);});
 }
 if(!usedColors.size)return false;
 for(const pixels of slices){
  const {colors,dark}=inkCounts(pixels);
  if(dark<12||colors.some((count,i)=>count>0&&usedColors.has(i)))return false;
 }
 return true;
}
