import {aiTextSignature} from './material-ai-image';
export const PRINTED_FILL_SLOTS='printed-fill-slots.v1' as const;
type Question={stem:string;questionType:string};
/** Comparison only; never rewrites an original answer or source transcript. */
export function samePrintedFillAnswer(question:Question,a:string,b:string):boolean{
 if(aiTextSignature(a)===aiTextSignature(b))return true;
 if(!/^填空(?:题)?$/.test(question.questionType)||question.stem.length>12000)return false;
 const blanks=question.stem.match(/_{3,}/g)||[];
 if(blanks.length<2||blanks.length>12||question.stem.replace(/_{3,}/g,'').includes('_'))return false;
 const parts=(text:string)=>{
  if(text.length>2000)return;
  const value=text.normalize('NFC').trim(),tokens=/[;；]/.test(value)?value.split(/[;；]/).map(t=>t.trim()):value.split(/\s+/u);
  // No token-internal whitespace, arithmetic folding, comma removal, unit
  // inference or reordering. Mixed separators cannot disguise extra answers.
  if(tokens.length!==blanks.length||tokens.some(t=>!t||/[\s;；]/u.test(t)))return;
  return tokens;
 };
 const left=parts(a),right=parts(b);return !!left&&!!right&&left.every((s,i)=>s===right[i]);
}
