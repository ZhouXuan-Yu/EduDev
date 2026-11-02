import {validOcrDiagnostic,type OcrDiagnostic} from '../xiaozhi-agent/ocr-diagnostic';

export const CROP_OCR_ATTEMPTS_SCHEMA='xiaozhi.material-ai-crop-ocr-attempts.v1';
const outcomes=['success','empty','parse_failed','timeout','unavailable','busy','configuration','too_large','invalid_input','unknown'] as const;
export const retryableCropOcr=(value:string)=>['parse_failed','timeout','unavailable','busy'].includes(value);
export type CropOcrAttempt={outcome:typeof outcomes[number];diagnostic?:OcrDiagnostic};
export type CropOcrAttempts={schemaVersion:typeof CROP_OCR_ATTEMPTS_SCHEMA;attempts:CropOcrAttempt[]};
const exact=(value:unknown,keys:string[]):value is Record<string,unknown>=>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const d=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(value).length===keys.length&&keys.every(k=>d[k]&&'value'in d[k]&&d[k].enumerable);
};
export function validCropOcrAttempts(value:unknown,last?:string):value is CropOcrAttempts{
 if(!exact(value,['schemaVersion','attempts'])||value.schemaVersion!==CROP_OCR_ATTEMPTS_SCHEMA||!Array.isArray(value.attempts)||value.attempts.length<1||value.attempts.length>2)return false;
 const attempts=value.attempts;
 if(Reflect.ownKeys(attempts).length!==attempts.length+1||Array.from({length:attempts.length},(_,i)=>Object.getOwnPropertyDescriptor(attempts,i)).some(d=>!d||!('value'in d)||!d.enumerable))return false;
 return attempts.every((v,i)=>exact(v,Object.hasOwn(v??{},'diagnostic')?['outcome','diagnostic']:['outcome'])&&outcomes.includes(v.outcome as CropOcrAttempt['outcome'])&&(!Object.hasOwn(v,'diagnostic')||!['success','empty'].includes(String(v.outcome))&&validOcrDiagnostic(v.diagnostic))&&(i===attempts.length-1?last===undefined||v.outcome===last:retryableCropOcr(String(v.outcome))));
}
export class CropOcrFailure extends Error{
 constructor(error:Error,readonly ocrAttempts:CropOcrAttempts){super(error.message==='busy'?'busy':'ocr_failed',{cause:error});}
}
