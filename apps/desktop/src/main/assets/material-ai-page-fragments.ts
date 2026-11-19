import {sourceLayoutEnabled,sourceLayoutSignatureFor,sourceLayoutQuestion} from '../../shared/material-ai-source-layout';
import {isHostLiteralPolicy} from '../../shared/material-ai-literal';
import {sourceReadingEnabled} from '../../shared/material-ai-source-reading';
import {hasSourceReadings,sourceContentEnabled} from '../../shared/material-ai-source-content';
import type {SourceCropReading} from '../../shared/material-ai-source-reading';
import {figureDescriptionsAgree,readingBodyComplete} from './material-ai-source-reading';
import {isFragmentPageResponse} from '../../shared/material-ai-page';
import {MATERIAL_FIGURE_CROPS,CONTINUATION_BLOCK_PREFIX,isDiagramGroup,sourceCropKinds} from '../../shared/material-ai-owned-crops';
import {sourceComparisonQuestion} from '../../shared/material-ai-answer-review';
import {MATERIAL_CROP_BODY_TEXT} from '../../shared/material-ai-page-fragments';
import {cropBodyComplete} from './material-ai-crop-body';
import {continuationCropGroups,continuationSubcrops,continuationCropMatches,validPageContinuation,pageContinuation,pageContinuationTextProof,PAGE_CONTINUATION_CHOICES,PAGE_CONTINUATION_FIRST,PAGE_CONTINUATION_SENTENCE,continuationChoicesAgree,sentenceLiteralAgrees} from '../../shared/material-ai-continuation';
import {continuationTextAgrees,continuationTextSignature} from '../../shared/material-ai-continuation-text';
import {createHash} from 'node:crypto';
import {MATERIAL_TEXT_SOURCE_CROPS,pageFragmentsPolicy,pageFragmentTextPolicy,comparableFragmentQuestion,MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT,MATERIAL_PAGE_FRAGMENTS_RESPONSE,pageFragmentGroups,fragmentsMatchPage} from '../../shared/material-ai-page-fragments';
import {pageTranscriptionAgrees,type AiPagePrompt,type AiPageResponse,type MaterialPageSource} from '../../shared/material-ai-page';
import {visualQuestionAgrees,sourceCropQuestionAgrees} from '../../shared/material-ai-page-regions';
import {aiTextSignature,questionNumberPrefix,type AiImageQuestion} from '../../shared/material-ai-image';
import {QUESTION_DOCUMENT_COMPLETE_SCHEMA,validQuestionDocument,type QuestionDocument,type QuestionEvidence} from '../../shared/question-document';
import {QUESTION_PROJECTION_SCHEMA} from '../../shared/question-projection';
import {checkedPageCropImage,type PageCrop,type PageCropRenderer} from './material-ai-page-crops';
import {validCropQuality,cropTextComplete,CROP_OCR_FAILURE_REASONS,type CropInspector,type CropQuality,type CropOcrFailureReason} from './material-ai-crop-quality';
import {QuestionAssets,type OriginalImage} from './question-assets';
import {recheckedCropRows} from './material-ai-crop-recheck-storage';
import {CropOcrFailure,validCropOcrAttempts} from './material-ai-crop-ocr-receipt';

const SCHEMA='xiaozhi.material-ai-fragment-crops.v1';
const GROUP_SCHEMA='xiaozhi.material-ai-fragment-crops.v2';
const FAILED_SCHEMA='xiaozhi.material-ai-fragment-crops.failed.v1';
type Host={root?:()=>string;all:(sql:string,p?:(string|number|null)[])=>Promise<Record<string,unknown>[]>};
export type PageFragment={kind?:'diagram';blockId:string;blockIds?:string[];image:OriginalImage;quality:CropQuality};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const cropGroups=(prompt:AiPagePrompt,ids:string[],number:string)=>{
 const groups=prompt.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&prompt.continuation
  ?continuationCropGroups(prompt,ids,number)
  :'blocks'in prompt?pageFragmentGroups(prompt.blocks,ids,pageFragmentTextPolicy(prompt.policy),'cropGeometryPolicy'in prompt?prompt.cropGeometryPolicy:undefined,'figureCropPolicy'in prompt?prompt.figureCropPolicy:undefined).map(g=>({...g,source:undefined as MaterialPageSource|undefined})):[];
 return groups.map(g=>({...g,...(prompt.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&prompt.figureCropPolicy===MATERIAL_FIGURE_CROPS&&(!g.source?isDiagramGroup(prompt.blocks,g.blockIds):continuationSubcrops(prompt)&&isDiagramGroup(prompt.continuation!.blocks,g.blockIds.map(id=>id.slice(CONTINUATION_BLOCK_PREFIX.length))))?{kind:'diagram' as const}:{})}));
};

async function authenticateContinuationParent(host:Host,prompt:AiPagePrompt,numbers:string[],signal:AbortSignal){
 const extra=pageContinuation(prompt);if(!continuationSubcrops(prompt)||!extra||!numbers.includes(extra.number))return;
 if(!host.root||!validPageContinuation(extra))throw Error('source_changed');
 await new QuestionAssets(host.root).read(extra.image,true,signal);
}
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function selectedPageFragments(first:AiPageResponse,prompt?:AiPagePrompt){
 if(!isFragmentPageResponse(first)||!pageFragmentsPolicy(prompt?.policy)||!fragmentsMatchPage(first.fragments,prompt.blocks))throw Error('source_changed');
 return first.fragments.filter(r=>{if(!r.complete||!first.questions.some(q=>q.number===r.number&&(q.requiresImage||prompt.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&prompt.sourceCropPolicy===MATERIAL_TEXT_SOURCE_CROPS&&!q.requiresImage&&q.projection.figures.state==='not_applicable')))return false;try{cropGroups(prompt,r.blockIds,r.number);return true;}catch{return false;}});
}
export function pageCropStorage(crop:PageCrop){return crop.failure?{
 image:JSON.stringify({schemaVersion:FAILED_SCHEMA,blockId:crop.failure.blockId,error:crop.failure.error,reason:crop.failure.reason,image:crop.image}),quality:JSON.stringify({schemaVersion:FAILED_SCHEMA,error:crop.failure.error,reason:crop.failure.reason,...(crop.failure.ocrAttempts?{ocrAttempts:crop.failure.ocrAttempts}:{})})
 }:crop.fragments?.some(f=>f.blockIds)?{
 image:JSON.stringify({schemaVersion:GROUP_SCHEMA,fragments:crop.fragments.map(({blockIds,image})=>({blockIds,image}))}),
 quality:JSON.stringify({schemaVersion:GROUP_SCHEMA,fragments:crop.fragments.map(({blockIds,quality})=>({blockIds,quality}))})
 }:crop.fragments?{
 image:JSON.stringify({schemaVersion:SCHEMA,fragments:crop.fragments.map(({blockId,image})=>({blockId,image}))}),
 quality:JSON.stringify({schemaVersion:SCHEMA,fragments:crop.fragments.map(({blockId,quality})=>({blockId,quality}))})
 }:{image:JSON.stringify(crop.image),quality:JSON.stringify(crop.quality)};}
export async function readPageFragments(host:Host,batchId:string,ordinal:number,source:MaterialPageSource,first:AiPageResponse,firstRaw:string,imageSha:string,signal:AbortSignal,onlyNumber?:string,prompt?:AiPagePrompt,baseOnly=false):Promise<PageCrop[]>{
 const expected=selectedPageFragments(first,prompt),rows=await host.all('SELECT * FROM material_ai_page_crops WHERE batch_id=? AND ordinal=?',[batchId,ordinal]);
 if(!baseOnly&&prompt?.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT){
  const overlaid=await recheckedCropRows(host,batchId,ordinal,rows);
  if(overlaid.some((r,i)=>r!==rows[i])){
   await readPageFragments(host,batchId,ordinal,source,first,firstRaw,imageSha,signal,onlyNumber,prompt,true);
   const overlayHost={...host,all:(sql:string,p?:(string|number|null)[])=>sql==='SELECT * FROM material_ai_page_crops WHERE batch_id=? AND ordinal=?'?Promise.resolve(overlaid):host.all(sql,p)};
   return readPageFragments(overlayHost,batchId,ordinal,source,first,firstRaw,imageSha,signal,onlyNumber,prompt,true);
  }
 }
 if(rows.length!==expected.length)throw Error('source_changed');if(!expected.length)return[];
 if(!host.root||!pageFragmentsPolicy(prompt?.policy))throw Error('storage_unavailable');
 await authenticateContinuationParent(host,prompt,expected.map(r=>r.number),signal);
 const assets=new QuestionAssets(host.root),result:PageCrop[]=[];let total=0;
 for(const region of expected){
  signal.throwIfAborted();const row=rows.find(r=>r.number===region.number);
  if(!row||row.first_sha!==hash(firstRaw)||row.page_image_sha!==imageSha||row.source_json!==JSON.stringify(source)||typeof row.image_json!=='string'||Buffer.byteLength(row.image_json)>65536||typeof row.quality_json!=='string'||Buffer.byteLength(row.quality_json)>128*1024)throw Error('source_changed');
  let images,qualities;try{images=JSON.parse(row.image_json);qualities=JSON.parse(row.quality_json);}catch{throw Error('source_changed');}
  const grouped=pageFragmentTextPolicy(prompt.policy),groups=cropGroups(prompt,region.blockIds,region.number),schema=grouped?GROUP_SCHEMA:SCHEMA;
  if(images?.schemaVersion===FAILED_SCHEMA){
   const group=groups.find(g=>g.blockIds[0]===images.blockId);
   if(prompt.policy!==MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT||!group||!plain(images,['schemaVersion','blockId','error','reason','image'])||typeof images.blockId!=='string'||images.error!=='ocr_failed'||!CROP_OCR_FAILURE_REASONS.includes(images.reason as CropOcrFailureReason)||!plain(qualities,['schemaVersion','error','reason',...(Object.hasOwn(qualities??{},'ocrAttempts')?['ocrAttempts']:[])])||qualities.schemaVersion!==FAILED_SCHEMA||qualities.error!==images.error||qualities.reason!==images.reason||(Object.hasOwn(qualities,'ocrAttempts')&&!validCropOcrAttempts(qualities.ocrAttempts,images.reason as string)))throw Error('source_changed');
   const image=checkedPageCropImage(images.image as OriginalImage,group.source||source,group.box);if(!continuationCropMatches(prompt,image,group))throw Error('source_changed');if(!onlyNumber||region.number===onlyNumber){total+=(await assets.read(image,true,signal)).length;if(total>16*1048576)throw Error('unit_too_large');}
   result.push({number:region.number,image,failure:{blockId:images.blockId,error:'ocr_failed',reason:images.reason as CropOcrFailureReason,...(validCropOcrAttempts(qualities.ocrAttempts)?{ocrAttempts:qualities.ocrAttempts}:{})}});continue;
  }
  if(!plain(images,['schemaVersion','fragments'])||images.schemaVersion!==schema||!Array.isArray(images.fragments)||images.fragments.length!==groups.length||!plain(qualities,['schemaVersion','fragments'])||qualities.schemaVersion!==schema||!Array.isArray(qualities.fragments)||qualities.fragments.length!==groups.length)throw Error('source_changed');
  const fragments:PageFragment[]=[];
  for(const [i,group]of groups.entries()){
   const a=images.fragments[i],b=qualities.fragments[i],key=grouped?'blockIds':'blockId',ids=grouped?group.blockIds:group.blockIds[0];if(!plain(a,[key,'image'])||JSON.stringify(a[key])!==JSON.stringify(ids)||!plain(b,[key,'quality'])||JSON.stringify(b[key])!==JSON.stringify(ids)||!validCropQuality(b.quality))throw Error('source_changed');
   const image=checkedPageCropImage(a.image as OriginalImage,group.source||source,group.box);if(!continuationCropMatches(prompt,image,group))throw Error('source_changed');
   if(!onlyNumber||region.number===onlyNumber){total+=(await assets.read(image,true,signal)).length;if(total>16*1048576)throw Error('unit_too_large');}
   fragments.push({...(group.kind?{kind:group.kind}:{}),blockId:group.blockIds[0],...(grouped?{blockIds:group.blockIds}:{}),image,quality:b.quality});
  }
  result.push({number:region.number,image:fragments[0].image,quality:fragments[0].quality,fragments});
 }return result;
}
export async function preparePageFragments(host:Host,batchId:string,ordinal:number,source:MaterialPageSource,first:AiPageResponse,firstRaw:string,imageSha:string,render:PageCropRenderer,inspect:CropInspector,signal:AbortSignal,prompt?:AiPagePrompt):Promise<PageCrop[]>{
 const regions=selectedPageFragments(first,prompt);if(!host.root||!pageFragmentsPolicy(prompt?.policy))throw Error('storage_unavailable');
 if((await host.all('SELECT number FROM material_ai_page_crops WHERE batch_id=? AND ordinal=?',[batchId,ordinal])).length)return readPageFragments(host,batchId,ordinal,source,first,firstRaw,imageSha,signal,undefined,prompt);
 await authenticateContinuationParent(host,prompt,regions.map(r=>r.number),signal);
 const assets=new QuestionAssets(host.root),result:PageCrop[]=[];let total=0;
 for(const region of regions){const fragments:PageFragment[]=[];let failed=false;
  for(const group of cropGroups(prompt,region.blockIds,region.number)){signal.throwIfAborted();const box=group.box,{dataUrl,...raw}=await render(group.source||source,box,signal),image=checkedPageCropImage(raw,group.source||source,box),bytes=Buffer.from(dataUrl.split(',')[1]||'','base64');
   if(!continuationCropMatches(prompt,image,group))throw Error('source_changed');
   total+=bytes.length;if(total>16*1048576)throw Error('unit_too_large');await assets.put(image,bytes,true,signal);let quality:CropQuality;
   try{quality=await inspect(bytes,signal);}catch(error){signal.throwIfAborted();if(prompt.policy!==MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT||!(error instanceof Error)||error.message!=='ocr_failed')throw error;const cause=error.cause instanceof Error?error.cause.message:'unknown',reason=CROP_OCR_FAILURE_REASONS.includes(cause as CropOcrFailureReason)?cause as CropOcrFailureReason:'unknown';result.push({number:region.number,image,failure:{blockId:group.blockIds[0],error:'ocr_failed',reason,...(error instanceof CropOcrFailure?{ocrAttempts:error.ocrAttempts}:{})}});failed=true;break;}
   if(!validCropQuality(quality))throw Error('ocr_failed');fragments.push({...(group.kind?{kind:group.kind}:{}),blockId:group.blockIds[0],...(pageFragmentTextPolicy(prompt.policy)?{blockIds:group.blockIds}:{}),image,quality});
  }
  if(failed)continue;
  const crop={number:region.number,image:fragments[0].image,quality:fragments[0].quality,fragments},stored=pageCropStorage(crop);if(Buffer.byteLength(stored.image)>65536||Buffer.byteLength(stored.quality)>128*1024)throw Error('unit_too_large');result.push(crop);
 }return result;
}
const literalLines=(text:string)=>text.split(/\r?\n/u).map(line=>line.trim()).filter(Boolean);

/** The source planner pins ordered blocks. Only whole independent figure
 * groups can contribute captions, and their local reading must still agree. */
function continuationEvidence(prompt:AiPagePrompt,crop:PageCrop,readings?:SourceCropReading[]){
 const extra=pageContinuation(prompt);
 if(!extra||extra.number!==crop.number||!crop.fragments)return;
 const next=crop.fragments.flatMap((fragment,index)=>fragment.image.page===extra.source.page?[{fragment,reading:readings?.[index]}]:[]);
 const owned=next.map(({fragment})=>fragment.blockIds||[fragment.blockId]);
 if(!owned.flat().every(id=>id.startsWith(CONTINUATION_BLOCK_PREFIX)))return;
 const groups=owned.map(ids=>ids.map(id=>id.slice(CONTINUATION_BLOCK_PREFIX.length)));
 if(JSON.stringify(groups.flat())!==JSON.stringify(extra.blockIds))return;
 const roles=continuationSubcrops(prompt)?sourceCropKinds(extra.blocks,groups):[];
 const hints=new Map(extra.blockTexts.map(h=>[h.blockId,h.text]));
 const lines:string[]=[],local:string[]=[],captions=new Set<number>();
 for(const [i,{fragment,reading}]of next.entries()){
  if(!validCropQuality(fragment.quality)||!fragment.quality.clearEdges.every(Boolean))return;
  const printed=groups[i].flatMap(id=>literalLines(hints.get(id)??''));
  const text=reading?.text??fragment.quality.text;
  if(roles[i]==='figure'){
   if(!printed.length&&isDiagramGroup(extra.blocks,groups[i])&&/^[\s_]{0,64}$/u.test(text))continue;
   // Both original-image readings may retain a label below the full-page OCR
   // detection threshold. The separate diagram and its literal words still
   // have to pass full source-content validation before this projection.
   if(!printed.length&&reading){
    const originalLabels=literalLines(fragment.quality.text).map(continuationTextSignature);
    const labelsRead=literalLines(reading.text).map(continuationTextSignature);
    let cursor=-1;
    if(originalLabels.every(label=>{cursor=labelsRead.indexOf(label,cursor+1);return cursor>=0;}))continue;
   }
   if(continuationTextSignature(printed.join('\n'))!==continuationTextSignature(text))return;
   printed.forEach((_,index)=>captions.add(lines.length+index));
  }
  lines.push(...printed);
  if(text)local.push(text);
 }
 if(JSON.stringify(lines)!==JSON.stringify(literalLines(extra.text)))return;
 return {extra,lines,localText:local.join('\n'),captions};
}

function continuationFiguresAgree(question:AiImageQuestion,lines:string[],captions:ReadonlySet<number>){
 if(!captions.size)return true;
 if(!question.requiresImage||question.projection.figures.state!=='provided')return false;
 const description=continuationTextSignature(question.projection.figures.text);
 const printed=continuationTextSignature(lines.filter((_,i)=>captions.has(i)).join('\n'));
 const at=description.indexOf(printed);
 if(at<0)return false;
 const joined=(a:string,b:string)=>/[\p{Script=Latin}\p{N}]$/u.test(a)&&/^[\p{Script=Latin}\p{N}]/u.test(b);
 return !joined(description.slice(0,at),printed)&&!joined(printed,description.slice(at+printed.length));
}

/** Legacy model transcripts may include the captions inline. Only project
 * the exact frozen suffix and leave its original lines in the saved response. */
export function continuationParserStem(prompt:AiPagePrompt,crop:PageCrop,question:AiImageQuestion,stem:string){
 const evidence=continuationEvidence(prompt,crop);
 if(!evidence?.captions.size)return;
 const {lines,captions}=evidence,parsed=literalLines(stem),offset=parsed.length-lines.length;
 if(offset<0||!lines.every((line,i)=>aiTextSignature(line)===aiTextSignature(parsed[offset+i]))||!continuationFiguresAgree(question,lines,captions))return;
 const body=parsed.filter((_,i)=>!captions.has(i-offset)).join('\n');
 if(aiTextSignature(body)===aiTextSignature(question.stem))return question.stem;
}

export function pageFragmentsAgree(first:AiPageResponse,final:AiPageResponse,number:string,crops:PageCrop[],sourceStem:string,prompt?:AiPagePrompt){
 if(!isFragmentPageResponse(first)||!isFragmentPageResponse(final)||!pageFragmentsPolicy(prompt?.policy)||!fragmentsMatchPage(first.fragments,prompt.blocks)||!fragmentsMatchPage(final.fragments,prompt.blocks))return false;
 // New literal receipts prove this complete question independently. A change
 // in another question cannot invalidate its owned source; whole-page text
 // retrieval still requires the original whole-page agreement separately.
 if(sourceReadingEnabled(prompt)?[first,final].some(r=>r.pageIssues.length>0):!pageTranscriptionAgrees(first,final,prompt))return false;
 const originalA=first.questions.find(q=>q.number===number),rawB=final.questions.find(q=>q.number===number),b=rawB&&sourceLayoutQuestion(rawB,prompt),a=originalA&&b?sourceLayoutQuestion(sourceComparisonQuestion(comparableFragmentQuestion(originalA,b,sourceStem,prompt.policy,prompt),b,prompt),prompt):undefined,left=first.fragments.find(r=>r.number===number),right=final.fragments.find(r=>r.number===number),crop=crops.find(c=>c.number===number);
 const visualAgreement = !!a&&!!b&&(visualQuestionAgrees(a,b)||(
  a.requiresImage&&b.requiresImage&&a.projection.figures.state==='provided'&&b.projection.figures.state==='provided'
  &&figureDescriptionsAgree(first,final,number,crop,prompt,a.projection.figures.text,b.projection.figures.text)
  &&visualQuestionAgrees({...a,projection:{...a.projection,figures:b.projection.figures}},b)
 ));
 if(!a||!b||!left?.complete||!right?.complete||JSON.stringify(left.blockIds)!==JSON.stringify(right.blockIds)||!crop?.fragments||JSON.stringify(crop.fragments.flatMap(f=>f.blockIds||[f.blockId]).filter(id=>!id.startsWith(CONTINUATION_BLOCK_PREFIX)))!==JSON.stringify(left.blockIds)||!(visualAgreement||prompt.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&prompt.sourceCropPolicy===MATERIAL_TEXT_SOURCE_CROPS&&!a.requiresImage&&!b.requiresImage&&a.projection.figures.state==='not_applicable'&&b.projection.figures.state==='not_applicable'&&!a.issues.length&&!b.issues.length&&sourceCropQuestionAgrees(a,b))||(sourceLayoutEnabled(prompt)?sourceLayoutSignatureFor(sourceStem,prompt,number):aiTextSignature(sourceStem))!==aiTextSignature(b.stem))return false;
 const extra=pageContinuation(prompt);
 const proof=pageContinuationTextProof(extra);
 let groups;try{groups=cropGroups(prompt,left.blockIds,number);}catch{return false;}
 if(groups.length!==crop.fragments.length||crop.fragments.some((f,i)=>!validCropQuality(f.quality)||!f.quality.clearEdges.every(Boolean)||JSON.stringify(f.image.box)!==JSON.stringify(groups[i].box)||JSON.stringify(f.blockIds||[f.blockId])!==JSON.stringify(groups[i].blockIds)||!continuationCropMatches(prompt,f.image,groups[i])))return false;
 const quality:CropQuality={schemaVersion:crop.fragments[0].quality.schemaVersion,engine:crop.fragments[0].quality.engine,text:crop.fragments.map(f=>f.quality.text).join('\n'),clearEdges:[true,true,true,true]};
 const bodyAgrees=sourceReadingEnabled(prompt)?readingBodyComplete(first,final,a,crop,prompt,crops)&&readingBodyComplete(first,final,b,crop,prompt,crops):prompt.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&prompt.cropTextPolicy===MATERIAL_CROP_BODY_TEXT
  ?cropBodyComplete(a,crop.fragments,prompt)&&cropBodyComplete(b,crop.fragments,prompt)
  :cropTextComplete(quality,a,first.questions)&&cropTextComplete(quality,b,final.questions);
 if(!bodyAgrees)return false;
 if(extra?.number===number){
  const sentence=extra.schemaVersion===PAGE_CONTINUATION_SENTENCE;
  const literalPolicy=sentence||extra.schemaVersion===PAGE_CONTINUATION_FIRST;
  if(extra.schemaVersion===PAGE_CONTINUATION_CHOICES){
   // Compare the source option seams before general question layout folding.
   if(!originalA||!rawB||[originalA,rawB].some(q=>!continuationChoicesAgree(extra.text,q.stem)))return false;
  }else if(!continuationSubcrops(prompt)&&!proof&&!literalPolicy){
   if([a,b].some(q=>!aiTextSignature(q.stem).endsWith(aiTextSignature(extra.text))))return false;
  }else{
   const literal=literalPolicy&&sourceContentEnabled(prompt)&&hasSourceReadings(final)?final.readings.find(row=>row.number===number)?.crops:undefined;
   if(sentence&&!literal)return false;
   const evidence=continuationEvidence(prompt,crop,literal);if(!evidence)return false;
   const {lines,localText,captions}=evidence;
   const body=captions.size?lines.filter((_,i)=>!captions.has(i)).join('\n'):extra.text;
   // The visual comparison may fold Chinese/Latin spacing for display.
   // The continuation witness compares the saved literal readings instead.
   const literalQuestions=literalPolicy?[originalA!,rawB!]:[a,b];
   const preceding=sentence?continuationTextSignature(extra.preceding.text.slice(questionNumberPrefix(extra.preceding.text,number)?.[0].length??0)):'';
   if(literalQuestions.some(q=>{
    if(!continuationFiguresAgree(q,lines,captions))return true;
    let stem=q.stem;
    if(sentence){
     const joined=continuationTextSignature(stem);
     if(!preceding||!sentenceLiteralAgrees(preceding,joined.slice(0,preceding.length)))return true;
     stem=joined.slice(preceding.length);
     if(!proof?.gaps.length)return !sentenceLiteralAgrees(extra.text,stem)||!sentenceLiteralAgrees(extra.text,localText);
    }
    return proof?!continuationTextAgrees(extra.text,proof,stem,localText,captions,sentence)
     :!aiTextSignature(stem).endsWith(aiTextSignature(body))||(captions.size>0||literalPolicy)&&aiTextSignature(localText)!==aiTextSignature(extra.text);
   }))return false;
  }
 }
 const signature=sourceLayoutEnabled(prompt)?(s:string)=>sourceLayoutSignatureFor(s,prompt,number):aiTextSignature;
 return [a,b].every(q=>(['choices','subquestions','tables','formulas'] as const).every(k=>q.projection[k].state!=='provided'||signature(sourceStem).includes(signature(q.projection[k].text))));
}
export function pageFragmentsDocument(q:AiImageQuestion,crop:PageCrop,batchId:string,model:string,prompt?:AiPagePrompt):QuestionDocument{
 const fragments=crop.fragments;if(!fragments?.length)throw Error('source_changed');const source=fragments[0].image,anchors=fragments.map(f=>({page:f.image.page,box:f.image.box}));
 const evidence=(role:'answer'|'analysis'):QuestionEvidence=>{const origin=q[`${role}Origin`],text=q[role];return origin==='ai_generated'?{origin,text,anchors:[],generator:{provider:'deepseek',model,runId:batchId}}:{origin,text,anchors:origin==='source'?anchors:[]};};
 const document:QuestionDocument={schemaVersion:QUESTION_DOCUMENT_COMPLETE_SCHEMA,source:{resourceId:source.resourceId,resourceVersion:source.version,parserVersion:(sourceContentEnabled(prompt)?'source-content-roles.v1+':sourceReadingEnabled(prompt)?'crop-source-reading.v1+':'page-fragments.v1+')+(prompt?.policy==='page-fragments.v3'&&isHostLiteralPolicy(prompt.literalReadingPolicy)?prompt.literalReadingPolicy+'+':'')+source.engine,ocrVersion:fragments[0].quality.engine},blocks:[...fragments.map((f,i)=>({id:'source_question_'+i,kind:'image' as const,anchors:[anchors[i]],assetId:f.image.assetId,sha256:f.image.sha256,mime:'image/png' as const,width:f.image.width,height:f.image.height})),{id:'transcription',kind:'text',anchors,text:q.stem}],answer:evidence('answer'),analysis:evidence('analysis'),context:{schemaVersion:QUESTION_PROJECTION_SCHEMA,projection:q.projection,sourceBlockIds:fragments.map((_,i)=>'source_question_'+i)}};
 if(!validQuestionDocument(document))throw Error('invalid_response');return document;
}
