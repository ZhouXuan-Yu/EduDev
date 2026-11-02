import {LOCAL_OCR_ENGINE} from '../../shared/xiaozhi-ocr';
import type {AiImageQuestion} from '../../shared/material-ai-image';
import {validCropOcrAttempts,type CropOcrAttempts} from './material-ai-crop-ocr-receipt';

export const CROP_QUALITY_SCHEMA='xiaozhi.material-ai-crop-quality.v1';
export type CropQuality={schemaVersion:typeof CROP_QUALITY_SCHEMA;engine:typeof LOCAL_OCR_ENGINE;text:string;clearEdges:[boolean,boolean,boolean,boolean];ocrAttempts?:CropOcrAttempts};
export type CropInspector=(bytes:Buffer,signal:AbortSignal)=>Promise<CropQuality>;
export const CROP_OCR_FAILURE_REASONS=['configuration','unavailable','parse_failed','timeout','too_large','invalid_input','unknown'] as const;
export type CropOcrFailureReason=typeof CROP_OCR_FAILURE_REASONS[number];
export function validCropQuality(value:unknown):value is CropQuality{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as CropQuality;
 return Object.keys(v).sort().join(',')===(Object.hasOwn(v,'ocrAttempts')?'clearEdges,engine,ocrAttempts,schemaVersion,text':'clearEdges,engine,schemaVersion,text')&&v.schemaVersion===CROP_QUALITY_SCHEMA&&v.engine===LOCAL_OCR_ENGINE&&typeof v.text==='string'&&Buffer.byteLength(v.text)<=64000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v.text)&&Array.isArray(v.clearEdges)&&v.clearEdges.length===4&&v.clearEdges.every(e=>typeof e==='boolean')&&(!Object.hasOwn(v,'ocrAttempts')||validCropOcrAttempts(v.ocrAttempts,v.text?'success':'empty'));
}
/** Electron bitmap is BGRA; require clear margins on every side, without loading a PDF here. */
export function cropClearEdges(bitmap:Buffer,width:number,height:number):CropQuality['clearEdges']{
 if(![width,height].every(n=>Number.isSafeInteger(n)&&n>=24&&n<=2401)||bitmap.length!==width*height*4)return[false,false,false,false];
 const dark=(x:number,y:number)=>{const i=(y*width+x)*4;return bitmap[i+3]>128&&Math.max(bitmap[i],bitmap[i+1],bitmap[i+2])<180;};
 const count=(side:number)=>{let n=0;const length=side%2?height:width;for(let a=0;a<length;a++)for(let d=0;d<3;d++){const x=side===1?width-1-d:side===3?d:a,y=side===0?d:side===2?height-1-d:a;if(dark(x,y)&&++n>=3)return false;}return true;};
 return[count(0),count(1),count(2),count(3)];
}
const literal=(text:string)=>text.normalize('NFC').replace(/\s+/gu,'');
/** Independent local OCR must see both ends and no neighbouring parent. No symbol folding or inference. */
export function cropTextComplete(quality:CropQuality|undefined,question:AiImageQuestion,others:AiImageQuestion[]):boolean{
 if(!validCropQuality(quality)||!quality.clearEdges.every(Boolean))return false;
 const body=literal(question.stem),text=literal(quality.text);
 if(body.length<8||!text.includes(body.slice(0,Math.min(24,body.length)))||!text.includes(body.slice(-Math.min(24,body.length))))return false;
 return !others.some(other=>other.number!==question.number&&literal(other.stem).length>=12&&text.includes(literal(other.stem).slice(0,24)));
}
