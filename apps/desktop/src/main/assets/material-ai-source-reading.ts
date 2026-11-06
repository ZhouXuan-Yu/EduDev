import {INDEPENDENT_LITERAL_READING} from '../../shared/material-ai-literal';
import {sourceCropKinds} from '../../shared/material-ai-owned-crops';
import {pageContinuation} from '../../shared/material-ai-continuation';
import {sourceReadingEnabled,SOURCE_READING_RESPONSE,sourceTextSignature,sourceReadingRemovesText,type SourceReadingComparison,type SourceCropReading} from '../../shared/material-ai-source-reading';
import {questionNumberPrefix,type AiImageQuestion} from '../../shared/material-ai-image';
import type {AiPagePrompt,AiPageResponse} from '../../shared/material-ai-page';
import type {PageCrop} from './material-ai-page-crops';
import {createHash} from 'node:crypto';
import {hasSourceReadings,sourceContentEnabled,contentPartRoles,SOURCE_CONTENT_RESPONSE} from '../../shared/material-ai-source-content';
import {QUESTION_SOURCE_CONTENT,type SourcePart} from '../../shared/question-source-content';
import {isCompleteQuestionDocument,validQuestionDocument,type QuestionDocument} from '../../shared/question-document';

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
 if(prompt.policy==='page-fragments.v3'&&prompt.literalReadingPolicy===INDEPENDENT_LITERAL_READING)return sourceCropKinds(prompt.blocks,crop.fragments!.map(f=>f.blockIds||[f.blockId]),pageContinuation(prompt)?.blocks)[crop.fragments!.indexOf(fragment)]==='figure';
 if(fragment.kind==='diagram')return true;
 if(!('blocks'in prompt)||!crop.fragments?.some(f=>f.kind==='diagram'))return false;
 const ids=fragment.blockIds||[fragment.blockId];
 return ids.length>0&&ids.every(id=>prompt.blocks.blocks.find(b=>b.id===id)?.kind==='figure_title');
}
/** Called after original bytes, ownership, geometry, edges and both projections agree.
 * Literal OCR changes require two saved image readings; the old OCR stays unchanged. */
export function readingBodyComplete(first:AiPageResponse,final:AiPageResponse,question:AiImageQuestion,crop:PageCrop,prompt?:AiPagePrompt,allCrops:PageCrop[]=[crop]):boolean{
 if(!sourceReadingEnabled(prompt)||!hasSourceReadings(first)||!hasSourceReadings(final)||first.schemaVersion!==final.schemaVersion||first.schemaVersion!==(sourceContentEnabled(prompt)?SOURCE_CONTENT_RESPONSE:SOURCE_READING_RESPONSE)||!crop.fragments?.length||crop.failure)return false;
 // A blank OCR result inside a proven diagram does not turn its pixels into
 // an optional text-only decoration. Models must retain the figure role.
 if(crop.fragments.some(f=>f.kind==='diagram')&&(!question.requiresImage||question.projection.figures.state!=='provided'))return false;
 const a=first.readings.find(r=>r.number===question.number),b=final.readings.find(r=>r.number===question.number);
 if(!fullOcrWasProvided(question.number,first,allCrops))return false;
 if(!a||!b||a.crops.length!==crop.fragments.length||b.crops.length!==crop.fragments.length)return false;
 let body='',firstBody=true;
 for(const [i,fragment]of crop.fragments.entries()){
  const left=a.crops[i],right=b.crops[i];
  if(!readingMatchesCrop(left,fragment)||!readingMatchesCrop(right,fragment))return false;
  const figure=figureFragment(fragment,crop,prompt!);
  if(sourceContentEnabled(prompt)){
   if(![left,right].every(r=>contentPartRoles(r.parts,r.text,question.number,firstBody,figure)))return false;
   const part=(r:SourceCropReading,role:SourcePart['role'])=>r.parts!.filter(p=>p.role===role).map(p=>p.text).join('');
   if(['marker','body','figure'].some(role=>sourceTextSignature(part(left,role as SourcePart['role']))!==sourceTextSignature(part(right,role as SourcePart['role'])))||left.parts!.some(p=>p.role==='publication')!==right.parts!.some(p=>p.role==='publication'))return false;
   if(!figure){body+=part(right,'body')+'\n';firstBody=false;continue;}
  }else if(sourceTextSignature(left.text)!==sourceTextSignature(right.text))return false;
  if(figure&&question.requiresImage&&question.projection.figures.state==='provided'){
   if(right.text&&!sourceTextSignature(question.projection.figures.text).includes(sourceTextSignature(right.text)))return false;
  }else{body+=right.text+'\n';firstBody=false;}
 }
 const source=literalBody(body,question.number);return source.length>=8&&source===literalBody(question.stem,question.number);
}
export function readingComparisons(first:AiPageResponse,final:AiPageResponse,crops:PageCrop[]):SourceReadingComparison[]{
 if(!hasSourceReadings(final))return[];
 return final.readings.map(row=>({number:row.number,crops:row.crops.map((reading,i)=>{
  const source=crops.find(c=>c.number===row.number)?.fragments?.[i],other=hasSourceReadings(first)?first.readings.find(r=>r.number===row.number)?.crops[i]:undefined;
  const assessment=reading.assessment==='uncertain'||reading.issues.length?'uncertain':source&&sourceTextSignature(reading.text)===sourceTextSignature(source.quality.text)?'exact':'corrected';
  const publication=(r:SourceCropReading|undefined)=>r?.parts?.filter(p=>p.role==='publication').map(p=>p.text).join('')||'';
  return{...reading,assessment,ocrText:source?.quality.text||'',agrees:!!source&&!!other&&readingMatchesCrop(reading,source)&&readingMatchesCrop(other,source)&&sourceTextSignature(reading.text)===sourceTextSignature(other.text),...(reading.parts?{previousText:other?.text||'',publicationStatus:sourceTextSignature(publication(reading))===sourceTextSignature(publication(other))?'agrees' as const:'needs_review' as const}:{})};
 })}));
}
/** Deterministic parser adapter only: the entire parsed source must equal ALL
 * owned literal readings in order. Diagram words stay in pageText, readings,
 * figure projection and images; no word is discarded by a fuzzy line filter. */
export function readingCandidateStem(response:AiPageResponse,question:AiImageQuestion,crops:PageCrop[],prompt:AiPagePrompt,parsedStem:string):string|undefined{
 const crop=crops.find(c=>c.number===question.number);if(!crop||!hasSourceReadings(response)||!readingBodyComplete(response,response,question,crop,prompt,crops))return;
 if(sourceContentEnabled(prompt))return question.stem;
 const row=response.readings.find(r=>r.number===question.number)!;
 if(literalBody(row.crops.map(r=>r.text).join('\n'),question.number)!==literalBody(parsedStem,question.number))return;
 return question.stem;
}
/** Persist the source layer separately from editable canonical body and answers. */
export function attachReadingContent(document:QuestionDocument,first:AiPageResponse,final:AiPageResponse,question:AiImageQuestion,crop:PageCrop,prompt?:AiPagePrompt,allCrops:PageCrop[]=[crop]){
 if(!sourceContentEnabled(prompt))return;
 if(!isCompleteQuestionDocument(document)||!hasSourceReadings(first)||!hasSourceReadings(final)||!readingBodyComplete(first,final,question,crop,prompt,allCrops))throw Error('source_changed');
 const a=first.readings.find(r=>r.number===question.number)!,b=final.readings.find(r=>r.number===question.number)!;
 document.context.sourceContent={schemaVersion:QUESTION_SOURCE_CONTENT,crops:crop.fragments!.map((f,i)=>({blockId:'source_question_'+i,sha256:f.image.sha256,ocrSha256:b.crops[i].ocrSha256,readings:[a.crops[i],b.crops[i]].map(r=>({text:r.text,parts:r.parts!})) as [{text:string;parts:SourcePart[]},{text:string;parts:SourcePart[]}]}))};
 if(!validQuestionDocument(document))throw Error('invalid_response');
}
