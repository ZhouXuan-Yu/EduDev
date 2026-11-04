import {sourceReadingEnabled,SOURCE_READING_RESPONSE,sourceTextSignature,sourceReadingRemovesText,type SourceReadingComparison,type SourceCropReading} from '../../shared/material-ai-source-reading';
import {questionNumberPrefix,type AiImageQuestion} from '../../shared/material-ai-image';
import type {AiPagePrompt,AiPageResponse} from '../../shared/material-ai-page';
import type {PageCrop} from './material-ai-page-crops';
import {createHash} from 'node:crypto';

const literalBody=(text:string,number:string)=>sourceTextSignature(text.replace(questionNumberPrefix(text,number)?.[0]||/^$/u,''));
/** Same UTF8 clipping limits as the original crop-review transport; cold reads
 * must never authenticate unseen OCR suffixes by trusting a saved assessment. */
function fullOcrWasProvided(number:string,response:AiPageResponse,crops:PageCrop[]){
 let budget=24*1024;
 for(const question of response.questions)for(const fragment of crops.find(c=>c.number===question.number)?.fragments||[]){
  const text=fragment.quality.text,original=Buffer.byteLength(text),limit=Math.min(2048,budget);let used=original;
  if(original>limit){used=0;for(const character of text){const bytes=Buffer.byteLength(character);if(used+bytes>limit)break;used+=bytes;}}
  budget-=used;if(question.number===number&&used!==original)return false;
 }return true;
}
function readingMatchesCrop(reading:SourceCropReading,crop:NonNullable<PageCrop['fragments']>[number]){
 const exact=sourceTextSignature(reading.text)===sourceTextSignature(crop.quality.text);
 return reading.sha256===crop.image.sha256&&reading.ocrSha256===createHash('sha256').update(crop.quality.text).digest('hex')&&reading.assessment!=='uncertain'&&!reading.issues.length&&!sourceReadingRemovesText(crop.quality.text,reading.text)&&(reading.assessment!=='exact'||exact);
}
/** A standalone layout caption can belong to an independently owned diagram.
 * Mixed body/figure crops remain body text; every caption is still checked
 * against both literal readings and the saved figure projection. */
function figureFragment(fragment:NonNullable<PageCrop['fragments']>[number],crop:PageCrop,prompt:AiPagePrompt){
 if(fragment.kind==='diagram')return true;
 if(!('blocks'in prompt)||!crop.fragments?.some(f=>f.kind==='diagram'))return false;
 const ids=fragment.blockIds||[fragment.blockId];
 return ids.length>0&&ids.every(id=>prompt.blocks.blocks.find(b=>b.id===id)?.kind==='figure_title');
}
/** Called after original bytes, ownership, geometry, edges and both projections agree.
 * Literal OCR changes require two saved image readings; the old OCR stays unchanged. */
export function readingBodyComplete(first:AiPageResponse,final:AiPageResponse,question:AiImageQuestion,crop:PageCrop,prompt?:AiPagePrompt,allCrops:PageCrop[]=[crop]):boolean{
 if(!sourceReadingEnabled(prompt)||first.schemaVersion!==SOURCE_READING_RESPONSE||final.schemaVersion!==SOURCE_READING_RESPONSE||!crop.fragments?.length||crop.failure)return false;
 // A blank OCR result inside a proven diagram does not turn its pixels into
 // an optional text-only decoration. Models must retain the figure role.
 if(crop.fragments.some(f=>f.kind==='diagram')&&(!question.requiresImage||question.projection.figures.state!=='provided'))return false;
 const a=first.readings.find(r=>r.number===question.number),b=final.readings.find(r=>r.number===question.number);
 if(!fullOcrWasProvided(question.number,first,allCrops))return false;
 if(!a||!b||a.crops.length!==crop.fragments.length||b.crops.length!==crop.fragments.length)return false;
 let body='';
 for(const [i,fragment]of crop.fragments.entries()){
  const left=a.crops[i],right=b.crops[i];
  if(!readingMatchesCrop(left,fragment)||!readingMatchesCrop(right,fragment)||sourceTextSignature(left.text)!==sourceTextSignature(right.text))return false;
  if(figureFragment(fragment,crop,prompt!)&&question.requiresImage&&question.projection.figures.state==='provided'){
   if(right.text&&!sourceTextSignature(question.projection.figures.text).includes(sourceTextSignature(right.text)))return false;
  }else body+=right.text+'\n';
 }
 const source=literalBody(body,question.number);return source.length>=8&&source===literalBody(question.stem,question.number);
}
export function readingComparisons(first:AiPageResponse,final:AiPageResponse,crops:PageCrop[]):SourceReadingComparison[]{
 if(final.schemaVersion!==SOURCE_READING_RESPONSE)return[];
 return final.readings.map(row=>({number:row.number,crops:row.crops.map((reading,i)=>{
  const source=crops.find(c=>c.number===row.number)?.fragments?.[i],other=first.schemaVersion===SOURCE_READING_RESPONSE?first.readings.find(r=>r.number===row.number)?.crops[i]:undefined;
  const assessment=reading.assessment==='uncertain'||reading.issues.length?'uncertain':source&&sourceTextSignature(reading.text)===sourceTextSignature(source.quality.text)?'exact':'corrected';
  return{...reading,assessment,ocrText:source?.quality.text||'',agrees:!!source&&!!other&&readingMatchesCrop(reading,source)&&readingMatchesCrop(other,source)&&sourceTextSignature(reading.text)===sourceTextSignature(other.text)};
 })}));
}
/** Deterministic parser adapter only: the entire parsed source must equal ALL
 * owned literal readings in order. Diagram words stay in pageText, readings,
 * figure projection and images; no word is discarded by a fuzzy line filter. */
export function readingCandidateStem(response:AiPageResponse,question:AiImageQuestion,crops:PageCrop[],prompt:AiPagePrompt,parsedStem:string):string|undefined{
 const crop=crops.find(c=>c.number===question.number);if(!crop||response.schemaVersion!==SOURCE_READING_RESPONSE||!readingBodyComplete(response,response,question,crop,prompt,crops))return;
 const row=response.readings.find(r=>r.number===question.number)!;
 if(literalBody(row.crops.map(r=>r.text).join('\n'),question.number)!==literalBody(parsedStem,question.number))return;
 return question.stem;
}
