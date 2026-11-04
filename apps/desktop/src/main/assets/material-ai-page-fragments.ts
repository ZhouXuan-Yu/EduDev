import {MATERIAL_FIGURE_CROPS,isDiagramGroup} from '../../shared/material-ai-owned-crops';
import {MATERIAL_CROP_BODY_TEXT} from '../../shared/material-ai-page-fragments';
import {cropBodyComplete} from './material-ai-crop-body';
import {continuationCropGroups,continuationSubcrops,continuationCropMatches,validPageContinuation,pageContinuation,PAGE_CONTINUATION_TEXT} from '../../shared/material-ai-continuation';
import {continuationTextAgrees} from '../../shared/material-ai-continuation-text';
import {createHash} from 'node:crypto';
import {MATERIAL_TEXT_SOURCE_CROPS,pageFragmentsPolicy,pageFragmentTextPolicy,comparableFragmentQuestion,MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT,MATERIAL_PAGE_FRAGMENTS_RESPONSE,pageFragmentGroups,fragmentsMatchPage} from '../../shared/material-ai-page-fragments';
import {pageTranscriptionAgrees,type AiPagePrompt,type AiPageResponse,type MaterialPageSource} from '../../shared/material-ai-page';
import {visualQuestionAgrees,sourceCropQuestionAgrees} from '../../shared/material-ai-page-regions';
import {aiTextSignature,type AiImageQuestion} from '../../shared/material-ai-image';
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
 return groups.map(g=>({...g,...(prompt.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&prompt.figureCropPolicy===MATERIAL_FIGURE_CROPS&&(!g.source?isDiagramGroup(prompt.blocks,g.blockIds):continuationSubcrops(prompt)&&isDiagramGroup(prompt.continuation!.blocks,g.blockIds.map(id=>id.slice(5))))?{kind:'diagram' as const}:{})}));
};

async function authenticateContinuationParent(host:Host,prompt:AiPagePrompt,numbers:string[],signal:AbortSignal){
 const extra=pageContinuation(prompt);if(!continuationSubcrops(prompt)||!extra||!numbers.includes(extra.number))return;
 if(!host.root||!validPageContinuation(extra))throw Error('source_changed');
 await new QuestionAssets(host.root).read(extra.image,true,signal);
}
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function selectedPageFragments(first:AiPageResponse,prompt?:AiPagePrompt){
 if(first.schemaVersion!==MATERIAL_PAGE_FRAGMENTS_RESPONSE||!pageFragmentsPolicy(prompt?.policy)||!fragmentsMatchPage(first.fragments,prompt.blocks))throw Error('source_changed');
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
export function pageFragmentsAgree(first:AiPageResponse,final:AiPageResponse,number:string,crops:PageCrop[],sourceStem:string,prompt?:AiPagePrompt){
 if(first.schemaVersion!==MATERIAL_PAGE_FRAGMENTS_RESPONSE||final.schemaVersion!==MATERIAL_PAGE_FRAGMENTS_RESPONSE||!pageFragmentsPolicy(prompt?.policy)||!pageTranscriptionAgrees(first,final)||!fragmentsMatchPage(first.fragments,prompt.blocks)||!fragmentsMatchPage(final.fragments,prompt.blocks))return false;
 const originalA=first.questions.find(q=>q.number===number),b=final.questions.find(q=>q.number===number),a=originalA&&b?comparableFragmentQuestion(originalA,b,sourceStem,prompt.policy):undefined,left=first.fragments.find(r=>r.number===number),right=final.fragments.find(r=>r.number===number),crop=crops.find(c=>c.number===number);
 if(!a||!b||!left?.complete||!right?.complete||JSON.stringify(left.blockIds)!==JSON.stringify(right.blockIds)||!crop?.fragments||JSON.stringify(crop.fragments.flatMap(f=>f.blockIds||[f.blockId]).filter(id=>!id.startsWith('next:')))!==JSON.stringify(left.blockIds)||!(visualQuestionAgrees(a,b)||prompt.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&prompt.sourceCropPolicy===MATERIAL_TEXT_SOURCE_CROPS&&!a.requiresImage&&!b.requiresImage&&a.projection.figures.state==='not_applicable'&&b.projection.figures.state==='not_applicable'&&!a.issues.length&&!b.issues.length&&sourceCropQuestionAgrees(a,b))||aiTextSignature(sourceStem)!==aiTextSignature(b.stem))return false;
 const extra=pageContinuation(prompt);
 let groups;try{groups=cropGroups(prompt,left.blockIds,number);}catch{return false;}
 if(groups.length!==crop.fragments.length||crop.fragments.some((f,i)=>!validCropQuality(f.quality)||!f.quality.clearEdges.every(Boolean)||JSON.stringify(f.image.box)!==JSON.stringify(groups[i].box)||JSON.stringify(f.blockIds||[f.blockId])!==JSON.stringify(groups[i].blockIds)||!continuationCropMatches(prompt,f.image,groups[i])))return false;
 const nextText=crop.fragments.flatMap((f,i)=>{
  const group=groups[i];if(!group.source)return [];
  // A beaker baseline can OCR as "_". Only an independently proven diagram
  // with no frozen OCR labels may omit this narrow stroke-only artifact from
  // the BODY comparison. The pixels and original OCR receipt remain intact;
  // any letter, digit, unit, minus sign or known label still participates.
  const emptyDiagram=continuationSubcrops(prompt)&&group.kind==='diagram'&&group.blockIds.every(id=>extra?.blockTexts.find(h=>h.blockId===id.slice(5))?.text==='');
  return emptyDiagram&&/^[\s_]{1,64}$/u.test(f.quality.text)?[]:[f.quality.text];
 }).filter(Boolean).join('\n');
 if(extra?.number===number&&[a,b].some(q=>extra.schemaVersion===PAGE_CONTINUATION_TEXT?!continuationTextAgrees(extra.text,extra.textProof,q.stem,nextText):!aiTextSignature(q.stem).endsWith(aiTextSignature(extra.text))))return false;
 const quality:CropQuality={schemaVersion:crop.fragments[0].quality.schemaVersion,engine:crop.fragments[0].quality.engine,text:crop.fragments.map(f=>f.quality.text).join('\n'),clearEdges:[true,true,true,true]};
 const bodyAgrees=prompt.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&prompt.cropTextPolicy===MATERIAL_CROP_BODY_TEXT
  ?cropBodyComplete(a,crop.fragments,prompt)&&cropBodyComplete(b,crop.fragments,prompt)
  :cropTextComplete(quality,a,first.questions)&&cropTextComplete(quality,b,final.questions);
 return bodyAgrees&&[a,b].every(q=>(['choices','subquestions','tables','formulas'] as const).every(k=>q.projection[k].state!=='provided'||aiTextSignature(sourceStem).includes(aiTextSignature(q.projection[k].text))));
}
export function pageFragmentsDocument(q:AiImageQuestion,crop:PageCrop,batchId:string,model:string):QuestionDocument{
 const fragments=crop.fragments;if(!fragments?.length)throw Error('source_changed');const source=fragments[0].image,anchors=fragments.map(f=>({page:f.image.page,box:f.image.box}));
 const evidence=(role:'answer'|'analysis'):QuestionEvidence=>{const origin=q[`${role}Origin`],text=q[role];return origin==='ai_generated'?{origin,text,anchors:[],generator:{provider:'deepseek',model,runId:batchId}}:{origin,text,anchors:origin==='source'?anchors:[]};};
 const document:QuestionDocument={schemaVersion:QUESTION_DOCUMENT_COMPLETE_SCHEMA,source:{resourceId:source.resourceId,resourceVersion:source.version,parserVersion:'page-fragments.v1+'+source.engine,ocrVersion:fragments[0].quality.engine},blocks:[...fragments.map((f,i)=>({id:'source_question_'+i,kind:'image' as const,anchors:[anchors[i]],assetId:f.image.assetId,sha256:f.image.sha256,mime:'image/png' as const,width:f.image.width,height:f.image.height})),{id:'transcription',kind:'text',anchors,text:q.stem}],answer:evidence('answer'),analysis:evidence('analysis'),context:{schemaVersion:QUESTION_PROJECTION_SCHEMA,projection:q.projection,sourceBlockIds:fragments.map((_,i)=>'source_question_'+i)}};
 if(!validQuestionDocument(document))throw Error('invalid_response');return document;
}
