import {MATERIAL_PAGE_FRAGMENTS_RESPONSE} from '../../shared/material-ai-page-fragments';
import {readPageFragments,preparePageFragments,pageFragmentsAgree,pageFragmentsDocument,type PageFragment} from './material-ai-page-fragments';
import {createHash} from 'node:crypto';
import {MATERIAL_PREVIEW_SCHEMA,PDF_PAGE_ENGINE,validMaterialPreviewQuery,type PageBox,type MaterialPreviewResult} from '../../shared/material-page-preview';
import {MATERIAL_PAGE_REGIONS_RESPONSE,agreedQuestionRegion,visualQuestionAgrees} from '../../shared/material-ai-page-regions';
import {pageTranscriptionAgrees,type AiPagePrompt,type AiPageResponse,type MaterialPageSource} from '../../shared/material-ai-page';
import {selectedPageRegions} from '../../shared/material-ai-layout-regions';
import {QUESTION_DOCUMENT_COMPLETE_SCHEMA,validQuestionDocument,type QuestionDocument,type QuestionEvidence} from '../../shared/question-document';
import {QUESTION_PROJECTION_SCHEMA} from '../../shared/question-projection';
import {aiTextSignature,type AiImageQuestion} from '../../shared/material-ai-image';
import type {ArchiveFields} from '../../shared/question-archive';
import type {CropOcrAttempts} from './material-ai-crop-ocr-receipt';
import {QuestionAssets,type OriginalImage} from './question-assets';
import {validCropQuality,cropTextComplete,type CropQuality,type CropInspector,type CropOcrFailureReason} from './material-ai-crop-quality';

type Host={root?:()=>string;all:(sql:string,p?:(string|number|null)[])=>Promise<Record<string,unknown>[]>};
export type PageCrop={number:string;image:OriginalImage;quality?:CropQuality;fragments?:PageFragment[];failure?:{blockId:string;error:'ocr_failed';reason:CropOcrFailureReason;ocrAttempts?:CropOcrAttempts}};
export type PageCropRenderer=(source:MaterialPageSource,box:PageBox,signal:AbortSignal)=>Promise<Extract<MaterialPreviewResult,{ok:true}>>;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const PAGE_CROP_TABLE=`CREATE TABLE IF NOT EXISTS material_ai_page_crops(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,number TEXT NOT NULL,first_sha TEXT NOT NULL,page_image_sha TEXT NOT NULL,source_json TEXT NOT NULL,image_json TEXT NOT NULL,PRIMARY KEY(batch_id,ordinal,number),FOREIGN KEY(batch_id,ordinal) REFERENCES material_ai_units(batch_id,ordinal))`;
export const PAGE_CROP_EDITS_TABLE=`CREATE TABLE IF NOT EXISTS material_ai_page_document_edits(question_id TEXT NOT NULL,document_sha TEXT NOT NULL,first_sha TEXT NOT NULL,document_json TEXT NOT NULL,source_checked INTEGER NOT NULL,PRIMARY KEY(question_id,document_sha))`;
export function checkedPageCropImage(image:OriginalImage,source:MaterialPageSource,box:PageBox){
 if(!image||image.schemaVersion!==MATERIAL_PREVIEW_SCHEMA||image.ok!==true||image.engine!==PDF_PAGE_ENGINE||!validMaterialPreviewQuery({schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:image.requestId,resourceId:image.resourceId,version:image.version,page:image.page,box:image.box})||image.resourceId!==source.resourceId||image.version!==source.version||image.page!==source.page||JSON.stringify(image.box)!==JSON.stringify(box)||!Number.isSafeInteger(image.total)||image.total<image.page||image.total>10000||!/^asset_[a-f0-9-]{36}$/.test(image.assetId)||!/^[a-f0-9]{64}$/.test(image.sha256)||![image.width,image.height].every(n=>Number.isSafeInteger(n)&&n>=1&&n<=2401))throw Error('source_changed');
 return image;
}
/** First-pass crop facts survive pause/restart; bytes alone never authorize a question. */
export async function readPageCrops(host:Host,batchId:string,ordinal:number,source:MaterialPageSource,first:AiPageResponse,firstRaw:string,imageSha:string,signal:AbortSignal,onlyNumber?:string,prompt?:AiPagePrompt){
 if(first.schemaVersion===MATERIAL_PAGE_FRAGMENTS_RESPONSE)return readPageFragments(host,batchId,ordinal,source,first,firstRaw,imageSha,signal,onlyNumber,prompt);
 const rows=await host.all('SELECT * FROM material_ai_page_crops WHERE batch_id=? AND ordinal=?',[batchId,ordinal]),regions=selectedPageRegions(first,prompt);
 if(rows.length!==regions.length)throw Error('source_changed');
 if(!rows.length)return[];
 if(!host.root)throw Error('storage_unavailable');const assets=new QuestionAssets(host.root),result:PageCrop[]=[];let total=0;
 for(const r of regions){signal.throwIfAborted();const row=rows.find(x=>x.number===r.number);if(!row||row.first_sha!==hash(firstRaw)||row.page_image_sha!==imageSha||row.source_json!==JSON.stringify(source)||typeof row.image_json!=='string'||row.image_json.length>4096)throw Error('source_changed');
  let value,quality;try{value=JSON.parse(row.image_json);if(row.quality_json){if(typeof row.quality_json!=='string'||Buffer.byteLength(row.quality_json)>65000)throw Error();quality=JSON.parse(row.quality_json);if(!validCropQuality(quality))throw Error();}}catch{throw Error('source_changed');}const image=checkedPageCropImage(value,source,r.box!),bytes=!onlyNumber||r.number===onlyNumber?await assets.read(image,true,signal):undefined;total+=bytes?.length||0;if(total>16*1048576)throw Error('unit_too_large');result.push({number:r.number,image,quality});
 }return result;
}
/** Render outside the SQLite writer, then journal all facts atomically with its source/lease guard. */
export async function preparePageCrops(host:Host,batchId:string,ordinal:number,source:MaterialPageSource,first:AiPageResponse,firstRaw:string,imageSha:string,render:PageCropRenderer,inspect:CropInspector,signal:AbortSignal,prompt?:AiPagePrompt){
 if(first.schemaVersion===MATERIAL_PAGE_FRAGMENTS_RESPONSE)return preparePageFragments(host,batchId,ordinal,source,first,firstRaw,imageSha,render,inspect,signal,prompt);
 const rows=await host.all('SELECT number FROM material_ai_page_crops WHERE batch_id=? AND ordinal=?',[batchId,ordinal]);
 if(!host.root)throw Error('storage_unavailable');const assets=new QuestionAssets(host.root),result:PageCrop[]=[];let total=0;
 if(rows.length){const saved=await readPageCrops(host,batchId,ordinal,source,first,firstRaw,imageSha,signal,undefined,prompt);for(const crop of saved){if(!crop.quality){crop.quality=await inspect(await assets.read(crop.image,true,signal),signal);if(!validCropQuality(crop.quality))throw Error('ocr_failed');}}return saved;}
 for(const r of selectedPageRegions(first,prompt)){signal.throwIfAborted();const {dataUrl,...raw}=await render(source,r.box!,signal),image=checkedPageCropImage(raw,source,r.box!),bytes=Buffer.from(dataUrl.split(',')[1]||'','base64');
  total+=bytes.length;if(total>16*1048576)throw Error('unit_too_large');await assets.put(image,bytes,true,signal);const quality=await inspect(bytes,signal);if(!validCropQuality(quality))throw Error('ocr_failed');result.push({number:r.number,image,quality});
 }return result;
}
export function pageCropAgrees(first:AiPageResponse,final:AiPageResponse,number:string,crops:PageCrop[],sourceStem:string,prompt?:AiPagePrompt){
 if(first.schemaVersion===MATERIAL_PAGE_FRAGMENTS_RESPONSE)return pageFragmentsAgree(first,final,number,crops,sourceStem,prompt);
 if(first.schemaVersion!==MATERIAL_PAGE_REGIONS_RESPONSE||final.schemaVersion!==MATERIAL_PAGE_REGIONS_RESPONSE||!pageTranscriptionAgrees(first,final)||first.outcome!=='questions'||first.questions.length!==final.questions.length)return false;
 const a=first.questions.find(q=>q.number===number),b=final.questions.find(q=>q.number===number),box=agreedQuestionRegion(first.regions,final.regions,number),crop=crops.find(c=>c.number===number);
 if(!a||!b||!box||!crop||!selectedPageRegions(first,prompt).some(r=>r.number===number)||!cropTextComplete(crop.quality,a,first.questions)||!cropTextComplete(crop.quality,b,final.questions)||JSON.stringify(crop.image.box)!==JSON.stringify(box)||!visualQuestionAgrees(a,b)||aiTextSignature(b.stem)!==aiTextSignature(sourceStem))return false;
 return [a,b].every(q=>(['choices','subquestions','tables','formulas'] as const).every(k=>q.projection[k].state!=='provided'||aiTextSignature(sourceStem).includes(aiTextSignature(q.projection[k].text))));
}
/** Existing v2 document, with AI origins and a separately authenticated crop receipt. */
export function pageCropDocument(q:AiImageQuestion,crop:PageCrop,batchId:string,model:string):QuestionDocument{
 if(crop.fragments)return pageFragmentsDocument(q,crop,batchId,model);
 const image=crop.image,anchors=[{page:image.page,box:image.box}];
 const evidence=(role:'answer'|'analysis'):QuestionEvidence=>{const origin=q[`${role}Origin`],text=q[role];return origin==='ai_generated'?{origin,text,anchors:[],generator:{provider:'deepseek',model,runId:batchId}}:{origin,text,anchors:origin==='source'?anchors:[]};};
 const document:QuestionDocument={schemaVersion:QUESTION_DOCUMENT_COMPLETE_SCHEMA,source:{resourceId:image.resourceId,resourceVersion:image.version,parserVersion:'page-regions.v1+'+image.engine,ocrVersion:''},blocks:[{id:'source_question_0',kind:'image',anchors,assetId:image.assetId,sha256:image.sha256,mime:'image/png',width:image.width,height:image.height},{id:'transcription',kind:'text',anchors,text:q.stem}],answer:evidence('answer'),analysis:evidence('analysis'),context:{schemaVersion:QUESTION_PROJECTION_SCHEMA,projection:q.projection,sourceBlockIds:['source_question_0']}};
 if(!validQuestionDocument(document))throw Error('invalid_response');return document;
}
/** Routine teacher edits keep the original crop and AI receipt; no approval ledger is fabricated. */
export function editedPageCropDocument(document:QuestionDocument,fields:ArchiveFields){
 if(document.schemaVersion!==QUESTION_DOCUMENT_COMPLETE_SCHEMA)throw Error('source_changed');
 const next=structuredClone(document);next.context.projection.statement.text=fields.stem;
 for(const key of ['formulas','tables','choices','subquestions'] as const){const part=next.context.projection[key];if(part.state==='provided'&&!aiTextSignature(fields.stem).includes(aiTextSignature(part.text)))part.text=fields.stem;}
 next.blocks=next.blocks.map(b=>b.id==='transcription'&&b.kind==='text'?{...b,text:fields.stem}:b);
 for(const role of ['answer','analysis'] as const)if(fields[role]!==next[role].text)next[role]={origin:fields[role]?'teacher':'missing',text:fields[role],anchors:[]};
 if(!validQuestionDocument(next))throw Error('invalid_input');return next;
}
