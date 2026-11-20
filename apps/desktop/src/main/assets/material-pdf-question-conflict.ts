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
export function verifiedQuestionInPdfConflict(nativeText:string,question:StructureQuestion,page:number){
 if(question.kind!=='question'||question.pageRange[0]!==page||question.pageRange[1]!==page||
    question.sharedMaterialIds.length||question.subquestions.length||question.answer||question.analysis||
    question.assets.some(asset=>['inline_formula','display_formula','table'].includes(asset.kind))||question.stem.length>12000)return false;
 const boundaries=[...nativeText.matchAll(parents)];
 const number=(boundary:RegExpMatchArray)=>boundary[1]||boundary[2];
 const owned=boundaries.filter(boundary=>number(boundary)===question.number);
 if(owned.length!==1)return false;
 const first=owned[0],next=boundaries[boundaries.indexOf(first)+1];
 if(!next||Number(number(next))!==Number(question.number)+1)return false;
 const expected=nativeText.slice(first.index+first[0].length,next.index);
 if(!samePrintedTokens(expected,question.stem,12))return false;
 const markers=[...question.stem.matchAll(options)];
 return markers.length===question.options.length&&question.options.every((option,index)=>{
  const marker=markers[index],label=marker[1]||marker[2];
  return label===option.label&&label===String.fromCharCode(65+index)&&
    samePrintedTokens(question.stem.slice(marker.index,markers[index+1]?.index),option.text);
 });
}

const numberedCaption=/^第\s*\d{1,5}\s*题\s*(?:图|插图|示意图|表)[。．.]?$/u;
const annotationGlyph=/^[√✓✔×✗✘α]$/u;
const compactGlyphs=(text:string)=>[...text.normalize('NFC').replace(/\s/gu,'')].sort().join('');
const joinBoxes=(boxes:PageBox[]):PageBox=>[
 Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),
 Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3])),
];
const touches=(a:PageBox,b:PageBox)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
const contentLines=(s:string)=>s.split(/\r?\n/u).map(t=>t.trim()).filter(Boolean);
const printedNumber=(s:string)=>{
 if(numberedCaption.test(s))return;
 const match=[...s.matchAll(parents)][0];
 return match?.[1]||match?.[2];
};

/** Alternate provenance for fully bounded scanned A-D items with detached
 * grading marks. All printed content must agree with the paged OCR receipt,
 * and every native glyph must be accounted for by the positioned reader. */
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
    question.options.map(o=>o.label).join('')!=='ABCD'||question.assets.length!==1||
    question.assets[0].page!==page.page||!['image','chart'].includes(question.assets[0].kind))return;
 const asset=question.assets[0],ids=new Set(question.paragraphIds);
 const parts=page.paragraphs.filter(p=>ids.has(p.id));
 if(parts.length!==ids.size||parts.some(p=>p.anchor.page!==page.page||p.issues.length||
    p.confidence<.93||!validPageBox(p.anchor.box)))return;
 const body=parts.filter(p=>p.role!=='figure'), captions=parts.filter(p=>p.role==='figure');
 const [stem,...choices]=body;
 if(body.length!==5||stem.role!=='question'||stem.marker?.label!==question.number||
    stem.column<0||body.some(p=>p.column!==stem.column)||captions.length>1||
    captions.some(p=>!numberedCaption.test(p.text)||printedNumber(p.text.replace(/(?:插图|示意图|图|表)[。．.]?$/u,''))!==question.number)||
    choices.some((p,i)=>p.role!=='option'||p.marker?.label!==question.options[i].label||
     !samePrintedTokens(p.text,question.options[i].text))||
    !samePrintedTokens(body.map((p,i)=>i?p.text:p.text.replace(parents,'')).join('\n'),question.stem,12))return;
 const ownedLines=new Set([...parts.flatMap(p=>p.lineIds),...(asset.lineIds??[])]);
 const raw=page.lines.filter(line=>ownedLines.has(line.id));
 if(raw.length!==ownedLines.size||raw.some(line=>line.origin||line.score<.93||!validPageBox(line.box)))return;
 const pageOcr=contentLines(receipt.ocrText);
 const start=pageOcr.findIndex(line=>printedNumber(line)===question.number);
 const next=pageOcr.findIndex((line,index)=>index>start&&printedNumber(line)!==undefined);
 if(start<0||pageOcr.filter(line=>printedNumber(line)===question.number).length!==1||
    JSON.stringify(pageOcr.slice(start,next<0?undefined:next))!==JSON.stringify(raw.map(line=>line.text.trim())))return;

 const lineMap=new Map(raw.map(line=>[line.id,line]));
 const stemRows:PageBox[]=[];
 for(const id of stem.lineIds){
  const box=lineMap.get(id)?.box;
  if(!box)return;
  const last=stemRows.at(-1);
  if(last&&Math.min(box[3],last[3])-Math.max(box[1],last[1])>=.005)stemRows[stemRows.length-1]=joinBoxes([last,box]);
  else stemRows.push(box);
 }
 if(stemRows.length<1||stemRows.length>3)return;
 const slices=[...stemRows,...choices.map(p=>p.anchor.box),joinBoxes([asset.box,...captions.map(p=>p.anchor.box)])];
 if(!slices.every(validPageBox)||slices.some((a,i)=>slices.slice(i+1).some(b=>
  Math.min(a[2],b[2])-Math.max(a[0],b[0])>.0015&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>.0015)))return;
 const scope=joinBoxes(slices), marks:PageBox[]=[], observedOptions=new Set<number>();
 let checks=0;
 for(const {box,text} of native.items){
  if(box[3]<scope[1]-.003||box[1]>scope[3]+.003)continue;
  if(!annotationGlyph.test(text.trim())||slices.some(slice=>touches(slice,box)))return;
  const option=choices.findIndex(({anchor:{box:choice}})=>
   box[0]-choice[2]>=.0015&&box[0]-choice[2]<=.055&&
   (Math.min(choice[3],box[3])-Math.max(choice[1],box[1]))/(box[3]-box[1])>=.7&&
   box[2]-box[0]<=.055&&box[3]-box[1]<=.06);
  if(option<0||observedOptions.has(option))return;
  observedOptions.add(option);marks.push(box);
  if(/^[√✓✔]$/u.test(text.trim()))checks++;
 }
 if(marks.length<3||checks<2||Math.max(...marks.map(b=>b[0]))-Math.min(...marks.map(b=>b[0]))>.035)return;
 return {slices,marks};
}
