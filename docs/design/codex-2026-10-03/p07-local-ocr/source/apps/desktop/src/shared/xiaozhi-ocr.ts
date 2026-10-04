import {validAttachmentSelection,type XiaozhiAttachmentSelectedInput} from './xiaozhi-attachments';
export const LOCAL_OCR_SCHEMA='xiaozhi.local-ocr.v1' as const;
export const LOCAL_OCR_ENGINE='rapidocr-3.9.2-ort-1.30.0-ppocrv6-small.v1' as const;
export type LocalOcrReceipt={schemaVersion:typeof LOCAL_OCR_SCHEMA;ok:true;engine:typeof LOCAL_OCR_ENGINE;text:string;lines:number;width:number;height:number;scores:number[]}
 |{schemaVersion:typeof LOCAL_OCR_SCHEMA;ok:false;error:'invalid_input'|'too_large'|'configuration'|'empty'|'parse_failed'};
export type AttachmentOcrStatus='processing'|'review'|'approved'|'rejected'|'interrupted';
/** Private local teacher view only; never part of public agent events or model payload. */
export type AttachmentOcrReview={schemaVersion:typeof LOCAL_OCR_SCHEMA;attachmentId:string;revision:number;status:AttachmentOcrStatus;
 engine:typeof LOCAL_OCR_ENGINE;original:string;corrected:string;lines:number;updatedAt:string};
export type AttachmentOcrDecision=XiaozhiAttachmentSelectedInput&{ocrRevision:number;decision:'approve'|'reject';text:string};
export function validOcrDecision(value:unknown):value is AttachmentOcrDecision{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const keys=['schemaVersion','sessionId','requestId','selection','ocrRevision','decision','text'];
 const d=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(value).length!==keys.length||Reflect.ownKeys(value).some(k=>typeof k!=='string'||!keys.includes(k))||Object.values(d).some(v=>!('value'in v)||!v.enumerable))return false;
 return validAttachmentSelection(d.selection.value)&&Number.isSafeInteger(d.ocrRevision.value)&&d.ocrRevision.value>=0&&d.ocrRevision.value<Number.MAX_SAFE_INTEGER
 &&['approve','reject'].includes(d.decision.value)&&typeof d.text.value==='string'&&d.text.value.length<=128000&&!d.text.value.includes('\0')
 &&(d.decision.value==='reject'||Boolean(d.text.value.trim()));
}
export function validLocalOcrReceipt(value:unknown):value is LocalOcrReceipt{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const d=Object.getOwnPropertyDescriptors(value);if(Object.values(d).some(v=>!('value'in v)||!v.enumerable))return false;
 const keys=d.ok?.value===true?['schemaVersion','ok','engine','text','lines','width','height','scores']:['schemaVersion','ok','error'];
 if(Reflect.ownKeys(value).length!==keys.length||Reflect.ownKeys(value).some(k=>typeof k!=='string'||!keys.includes(k)))return false;
 const v=value as LocalOcrReceipt;
 if(v.schemaVersion!==LOCAL_OCR_SCHEMA)return false;
 if(!v.ok)return v.ok===false&&['invalid_input','too_large','configuration','empty','parse_failed'].includes(v.error);
 return v.ok===true&&v.engine===LOCAL_OCR_ENGINE&&typeof v.text==='string'&&v.text.length>0&&v.text.length<=128000
 &&Number.isSafeInteger(v.lines)&&v.lines>0&&v.lines<=2000&&Number.isSafeInteger(v.width)&&v.width>0&&v.width<=8192
 &&Number.isSafeInteger(v.height)&&v.height>0&&v.height<=8192&&v.width*v.height<=16000000
 &&Array.isArray(v.scores)&&v.scores.length===v.lines&&v.scores.every(s=>Number.isFinite(s)&&s>=0&&s<=1);
}
