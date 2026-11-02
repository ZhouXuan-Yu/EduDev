import {createHash} from 'node:crypto';
import {MATERIAL_CROP_CORRECTION_POLICY,MATERIAL_CROP_REVIEW_IMAGES_POLICY,MATERIAL_CROP_REVIEW_POLICY,MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT,pageFragmentGroups} from '../../shared/material-ai-page-fragments';
import type {AiPagePrompt,AiPageResponse,MaterialPageSource} from '../../shared/material-ai-page';
import {aiTextSignature} from '../../shared/material-ai-image';
import {LOCAL_OCR_ENGINE} from '../../shared/xiaozhi-ocr';
import type {PageBox} from '../../shared/material-page-preview';
import {restoredResponseQuestions} from './material-ai-page-content';
import {selectedPageFragments} from './material-ai-page-fragments';
import {validCropQuality,CROP_OCR_FAILURE_REASONS,type CropOcrFailureReason} from './material-ai-crop-quality';
import type {PageCrop} from './material-ai-page-crops';

const SCHEMA='xiaozhi.material-ai-crop-review.v1';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
type ReviewCrop={blockIds:string[];box:PageBox;sha256:string;text:string;originalBytes:number;truncated:boolean;clearEdges:boolean[]};
export type AiCropReview={schemaVersion:typeof SCHEMA;firstDraftSha256:string;pageImageSha256:string;ocrEngine:typeof LOCAL_OCR_ENGINE;
 questions:{number:string;sourceFound:boolean;sourceStemMatches:boolean;ocrStatus:'available'|'not_available'|'ocr_failed';crops:ReviewCrop[];failure:null|{blockId:string;sha256:string;reason:CropOcrFailureReason}}[]};
export const cropReviewEnabled=(prompt?:AiPagePrompt)=>prompt?.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&(prompt.cropReviewPolicy===MATERIAL_CROP_REVIEW_POLICY||prompt.cropReviewPolicy===MATERIAL_CROP_REVIEW_IMAGES_POLICY||prompt.cropReviewPolicy===MATERIAL_CROP_CORRECTION_POLICY);
export const cropReviewImagesEnabled=(prompt?:AiPagePrompt)=>prompt?.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&(prompt.cropReviewPolicy===MATERIAL_CROP_REVIEW_IMAGES_POLICY||prompt.cropReviewPolicy===MATERIAL_CROP_CORRECTION_POLICY);
/** Same order as the source-bound OCR comparison, including the retained failed block. */
export const cropReviewImagePlan=(review:AiCropReview)=>review.questions.flatMap(q=>q.ocrStatus==='ocr_failed'&&q.failure?[{role:'题号'+q.number,index:0,sha256:q.failure.sha256}]:q.crops.map((c,index)=>({role:'题号'+q.number,index,sha256:c.sha256})));
export function validCropReviewImages(images:{role:string;index:number;data:string;mime:string}[],review:AiCropReview){
 const expected=cropReviewImagePlan(review);let total=0;
 return images.length<=160&&images.length===expected.length&&images.every((image,i)=>{const bytes=Buffer.from(image.data,'base64');total+=bytes.length;return image.role===expected[i].role&&image.index===expected[i].index&&image.mime==='image/png'&&bytes.length>0&&bytes.length<=4*1048576&&total<=16*1048576&&bytes.toString('base64')===image.data&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&createHash('sha256').update(bytes).digest('hex')===expected[i].sha256;});
}
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const sha=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);

/** This is untrusted source evidence for the existing second pass, never a quality approval. */
export function validCropReview(value:unknown,first:AiPageResponse,prompt:AiPagePrompt|undefined,pageImageSha:string):value is AiCropReview{
 try{
  if(!cropReviewEnabled(prompt)||!prompt||!('blocks'in prompt)||!exact(value,['schemaVersion','firstDraftSha256','pageImageSha256','ocrEngine','questions'])||value.schemaVersion!==SCHEMA||value.firstDraftSha256!==digest(JSON.stringify(first))||value.pageImageSha256!==pageImageSha||value.pageImageSha256!==prompt.blocks.rasterSha256||value.ocrEngine!==LOCAL_OCR_ENGINE||Buffer.byteLength(JSON.stringify(value))>96*1024||!Array.isArray(value.questions)||value.questions.length!==first.questions.length)return false;
  const selected=selectedPageFragments(first,prompt);let textBytes=0;
  return value.questions.every((q,i)=>{
   if(!exact(q,['number','sourceFound','sourceStemMatches','ocrStatus','crops','failure'])||q.number!==first.questions[i].number||typeof q.sourceFound!=='boolean'||typeof q.sourceStemMatches!=='boolean'||!q.sourceFound&&q.sourceStemMatches||!Array.isArray(q.crops)||q.crops.length>8)return false;
   const fragment=selected.find(f=>f.number===q.number),groups=fragment?pageFragmentGroups(prompt.blocks,fragment.blockIds,true):[];
   if(q.ocrStatus==='not_available')return !fragment&&!q.crops.length&&q.failure===null;
   if(q.ocrStatus==='ocr_failed')return !!fragment&&!q.crops.length&&exact(q.failure,['blockId','sha256','reason'])&&fragment.blockIds.includes(String(q.failure.blockId))&&sha(q.failure.sha256)&&CROP_OCR_FAILURE_REASONS.includes(q.failure.reason as CropOcrFailureReason);
   if(q.ocrStatus!=='available'||!fragment||q.failure!==null||q.crops.length!==groups.length)return false;
   return q.crops.every((crop,index)=>{
    if(!exact(crop,['blockIds','box','sha256','text','originalBytes','truncated','clearEdges'])||JSON.stringify(crop.blockIds)!==JSON.stringify(groups[index].blockIds)||JSON.stringify(crop.box)!==JSON.stringify(groups[index].box)||!sha(crop.sha256)||typeof crop.text!=='string'||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(crop.text)||!Number.isSafeInteger(crop.originalBytes)||Number(crop.originalBytes)<0||Number(crop.originalBytes)>64000||!Array.isArray(crop.clearEdges)||crop.clearEdges.length!==4||crop.clearEdges.some(e=>typeof e!=='boolean'))return false;
    const bytes=Buffer.byteLength(crop.text);textBytes+=bytes;return bytes<=2048&&textBytes<=24*1024&&bytes<=Number(crop.originalBytes)&&crop.truncated===(bytes<Number(crop.originalBytes));
   });
  });
 }catch{return false;}
}

/** All crops have already passed the original source/asset reader; no OCR or file work is repeated. */
export function createCropReview(first:AiPageResponse,prompt:AiPagePrompt|undefined,source:MaterialPageSource,crops:PageCrop[],pageImageSha:string):AiCropReview{
 if(!cropReviewEnabled(prompt))throw Error('invalid_input');
 let budget=24*1024;
 const clip=(text:string)=>{let result='',bytes=0;for(const character of text){const size=Buffer.byteLength(character);if(bytes+size>Math.min(2048,budget))break;result+=character;bytes+=size;}budget-=bytes;return result;};
 const candidates=restoredResponseQuestions(first,source,prompt,crops);
 const review:AiCropReview={schemaVersion:SCHEMA,firstDraftSha256:digest(JSON.stringify(first)),pageImageSha256:pageImageSha,ocrEngine:LOCAL_OCR_ENGINE,questions:first.questions.map(q=>{
  const candidate=candidates.find(c=>c.number===q.number),crop=crops.find(c=>c.number===q.number),fragments=crop?.fragments||[];
  return{number:q.number,sourceFound:!!candidate,sourceStemMatches:!!candidate&&aiTextSignature(candidate.fields.stem)===aiTextSignature(q.stem),ocrStatus:crop?.failure?'ocr_failed':fragments.length?'available':'not_available',failure:crop?.failure?{blockId:crop.failure.blockId,sha256:crop.image.sha256,reason:crop.failure.reason}:null,crops:fragments.map(f=>{
   if(!validCropQuality(f.quality))throw Error('source_changed');const text=clip(f.quality.text),originalBytes=Buffer.byteLength(f.quality.text);
   return{blockIds:f.blockIds||[f.blockId],box:f.image.box,sha256:f.image.sha256,text,originalBytes,truncated:Buffer.byteLength(text)<originalBytes,clearEdges:f.quality.clearEdges};
  })};
 })};
 if(!validCropReview(review,first,prompt,pageImageSha))throw Error('source_changed');return review;
}
