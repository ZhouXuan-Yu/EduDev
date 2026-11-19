import type {StructureQuestion} from '../../shared/material-document-structure';

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
