import {createHash} from 'node:crypto';
import {pageFragmentsPolicy,MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT,MATERIAL_PAGE_FRAGMENTS_RESPONSE,pageFragmentGroups,fragmentsMatchPage} from '../../shared/material-ai-page-fragments';
import {pageTranscriptionAgrees,type AiPagePrompt,type AiPageResponse,type MaterialPageSource} from '../../shared/material-ai-page';
import {visualQuestionAgrees} from '../../shared/material-ai-page-regions';
import {aiTextSignature,type AiImageQuestion} from '../../shared/material-ai-image';
import {QUESTION_DOCUMENT_COMPLETE_SCHEMA,validQuestionDocument,type QuestionDocument,type QuestionEvidence} from '../../shared/question-document';
import {QUESTION_PROJECTION_SCHEMA} from '../../shared/question-projection';
import {checkedPageCropImage,type PageCrop,type PageCropRenderer} from './material-ai-page-crops';
import {validCropQuality,cropTextComplete,type CropInspector,type CropQuality} from './material-ai-crop-quality';
import {QuestionAssets,type OriginalImage} from './question-assets';

const SCHEMA='xiaozhi.material-ai-fragment-crops.v1';
const GROUP_SCHEMA='xiaozhi.material-ai-fragment-crops.v2';
type Host={root?:()=>string;all:(sql:string,p?:(string|number|null)[])=>Promise<Record<string,unknown>[]>};
export type PageFragment={blockId:string;blockIds?:string[];image:OriginalImage;quality:CropQuality};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function selectedPageFragments(first:AiPageResponse,prompt?:AiPagePrompt){
 if(first.schemaVersion!==MATERIAL_PAGE_FRAGMENTS_RESPONSE||!pageFragmentsPolicy(prompt?.policy)||!fragmentsMatchPage(first.fragments,prompt.blocks))throw Error('source_changed');
 return first.fragments.filter(r=>{if(!r.complete||!first.questions.some(q=>q.number===r.number&&q.requiresImage))return false;try{pageFragmentGroups(prompt.blocks,r.blockIds,prompt.policy===MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT);return true;}catch{return false;}});
}
export function pageCropStorage(crop:PageCrop){return crop.fragments?.some(f=>f.blockIds)?{
 image:JSON.stringify({schemaVersion:GROUP_SCHEMA,fragments:crop.fragments.map(({blockIds,image})=>({blockIds,image}))}),
 quality:JSON.stringify({schemaVersion:GROUP_SCHEMA,fragments:crop.fragments.map(({blockIds,quality})=>({blockIds,quality}))})
 }:crop.fragments?{
 image:JSON.stringify({schemaVersion:SCHEMA,fragments:crop.fragments.map(({blockId,image})=>({blockId,image}))}),
 quality:JSON.stringify({schemaVersion:SCHEMA,fragments:crop.fragments.map(({blockId,quality})=>({blockId,quality}))})
 }:{image:JSON.stringify(crop.image),quality:JSON.stringify(crop.quality)};}
export async function readPageFragments(host:Host,batchId:string,ordinal:number,source:MaterialPageSource,first:AiPageResponse,firstRaw:string,imageSha:string,signal:AbortSignal,onlyNumber?:string,prompt?:AiPagePrompt):Promise<PageCrop[]>{
 const expected=selectedPageFragments(first,prompt),rows=await host.all('SELECT * FROM material_ai_page_crops WHERE batch_id=? AND ordinal=?',[batchId,ordinal]);
 if(rows.length!==expected.length)throw Error('source_changed');if(!expected.length)return[];
 if(!host.root||!pageFragmentsPolicy(prompt?.policy))throw Error('storage_unavailable');
 const assets=new QuestionAssets(host.root),result:PageCrop[]=[];let total=0;
 for(const region of expected){
  signal.throwIfAborted();const row=rows.find(r=>r.number===region.number);
  if(!row||row.first_sha!==hash(firstRaw)||row.page_image_sha!==imageSha||row.source_json!==JSON.stringify(source)||typeof row.image_json!=='string'||Buffer.byteLength(row.image_json)>65536||typeof row.quality_json!=='string'||Buffer.byteLength(row.quality_json)>128*1024)throw Error('source_changed');
  let images,qualities;try{images=JSON.parse(row.image_json);qualities=JSON.parse(row.quality_json);}catch{throw Error('source_changed');}
  const grouped=prompt.policy===MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT,groups=pageFragmentGroups(prompt.blocks,region.blockIds,grouped),schema=grouped?GROUP_SCHEMA:SCHEMA;
  if(!plain(images,['schemaVersion','fragments'])||images.schemaVersion!==schema||!Array.isArray(images.fragments)||images.fragments.length!==groups.length||!plain(qualities,['schemaVersion','fragments'])||qualities.schemaVersion!==schema||!Array.isArray(qualities.fragments)||qualities.fragments.length!==groups.length)throw Error('source_changed');
  const fragments:PageFragment[]=[];
  for(const [i,group]of groups.entries()){
   const a=images.fragments[i],b=qualities.fragments[i],key=grouped?'blockIds':'blockId',ids=grouped?group.blockIds:group.blockIds[0];if(!plain(a,[key,'image'])||JSON.stringify(a[key])!==JSON.stringify(ids)||!plain(b,[key,'quality'])||JSON.stringify(b[key])!==JSON.stringify(ids)||!validCropQuality(b.quality))throw Error('source_changed');
   const image=checkedPageCropImage(a.image as OriginalImage,source,group.box);
   if(!onlyNumber||region.number===onlyNumber){total+=(await assets.read(image,true,signal)).length;if(total>16*1048576)throw Error('unit_too_large');}
   fragments.push({blockId:group.blockIds[0],...(grouped?{blockIds:group.blockIds}:{}),image,quality:b.quality});
  }
  result.push({number:region.number,image:fragments[0].image,quality:fragments[0].quality,fragments});
 }return result;
}
export async function preparePageFragments(host:Host,batchId:string,ordinal:number,source:MaterialPageSource,first:AiPageResponse,firstRaw:string,imageSha:string,render:PageCropRenderer,inspect:CropInspector,signal:AbortSignal,prompt?:AiPagePrompt):Promise<PageCrop[]>{
 const regions=selectedPageFragments(first,prompt);if(!host.root||!pageFragmentsPolicy(prompt?.policy))throw Error('storage_unavailable');
 if((await host.all('SELECT number FROM material_ai_page_crops WHERE batch_id=? AND ordinal=?',[batchId,ordinal])).length)return readPageFragments(host,batchId,ordinal,source,first,firstRaw,imageSha,signal,undefined,prompt);
 const assets=new QuestionAssets(host.root),result:PageCrop[]=[];let total=0;
 for(const region of regions){const fragments:PageFragment[]=[];
  for(const group of pageFragmentGroups(prompt.blocks,region.blockIds,prompt.policy===MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT)){signal.throwIfAborted();const box=group.box,{dataUrl,...raw}=await render(source,box,signal),image=checkedPageCropImage(raw,source,box),bytes=Buffer.from(dataUrl.split(',')[1]||'','base64');
   total+=bytes.length;if(total>16*1048576)throw Error('unit_too_large');await assets.put(image,bytes,true,signal);const quality=await inspect(bytes,signal);if(!validCropQuality(quality))throw Error('ocr_failed');fragments.push({blockId:group.blockIds[0],...(prompt.policy===MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT?{blockIds:group.blockIds}:{}),image,quality});
  }
  const crop={number:region.number,image:fragments[0].image,quality:fragments[0].quality,fragments},stored=pageCropStorage(crop);if(Buffer.byteLength(stored.image)>65536||Buffer.byteLength(stored.quality)>128*1024)throw Error('unit_too_large');result.push(crop);
 }return result;
}
export function pageFragmentsAgree(first:AiPageResponse,final:AiPageResponse,number:string,crops:PageCrop[],sourceStem:string,prompt?:AiPagePrompt){
 if(first.schemaVersion!==MATERIAL_PAGE_FRAGMENTS_RESPONSE||final.schemaVersion!==MATERIAL_PAGE_FRAGMENTS_RESPONSE||!pageFragmentsPolicy(prompt?.policy)||!pageTranscriptionAgrees(first,final)||!fragmentsMatchPage(first.fragments,prompt.blocks)||!fragmentsMatchPage(final.fragments,prompt.blocks))return false;
 const a=first.questions.find(q=>q.number===number),b=final.questions.find(q=>q.number===number),left=first.fragments.find(r=>r.number===number),right=final.fragments.find(r=>r.number===number),crop=crops.find(c=>c.number===number);
 if(!a||!b||!left?.complete||!right?.complete||JSON.stringify(left.blockIds)!==JSON.stringify(right.blockIds)||!crop?.fragments||JSON.stringify(crop.fragments.flatMap(f=>f.blockIds||[f.blockId]))!==JSON.stringify(left.blockIds)||!visualQuestionAgrees(a,b)||aiTextSignature(sourceStem)!==aiTextSignature(b.stem))return false;
 let groups;try{groups=pageFragmentGroups(prompt.blocks,left.blockIds,prompt.policy===MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT);}catch{return false;}
 if(groups.length!==crop.fragments.length||crop.fragments.some((f,i)=>!validCropQuality(f.quality)||!f.quality.clearEdges.every(Boolean)||JSON.stringify(f.image.box)!==JSON.stringify(groups[i].box)))return false;
 const quality:CropQuality={...crop.fragments[0].quality,text:crop.fragments.map(f=>f.quality.text).join('\n'),clearEdges:[true,true,true,true]};
 return cropTextComplete(quality,a,first.questions)&&cropTextComplete(quality,b,final.questions)&&[a,b].every(q=>(['choices','subquestions','tables','formulas'] as const).every(k=>q.projection[k].state!=='provided'||aiTextSignature(sourceStem).includes(aiTextSignature(q.projection[k].text))));
}
export function pageFragmentsDocument(q:AiImageQuestion,crop:PageCrop,batchId:string,model:string):QuestionDocument{
 const fragments=crop.fragments;if(!fragments?.length)throw Error('source_changed');const source=fragments[0].image,anchors=fragments.map(f=>({page:f.image.page,box:f.image.box}));
 const evidence=(role:'answer'|'analysis'):QuestionEvidence=>{const origin=q[`${role}Origin`],text=q[role];return origin==='ai_generated'?{origin,text,anchors:[],generator:{provider:'deepseek',model,runId:batchId}}:{origin,text,anchors:origin==='source'?anchors:[]};};
 const document:QuestionDocument={schemaVersion:QUESTION_DOCUMENT_COMPLETE_SCHEMA,source:{resourceId:source.resourceId,resourceVersion:source.version,parserVersion:'page-fragments.v1+'+source.engine,ocrVersion:fragments[0].quality.engine},blocks:[...fragments.map((f,i)=>({id:'source_question_'+i,kind:'image' as const,anchors:[anchors[i]],assetId:f.image.assetId,sha256:f.image.sha256,mime:'image/png' as const,width:f.image.width,height:f.image.height})),{id:'transcription',kind:'text',anchors,text:q.stem}],answer:evidence('answer'),analysis:evidence('analysis'),context:{schemaVersion:QUESTION_PROJECTION_SCHEMA,projection:q.projection,sourceBlockIds:fragments.map((_,i)=>'source_question_'+i)}};
 if(!validQuestionDocument(document))throw Error('invalid_response');return document;
}
