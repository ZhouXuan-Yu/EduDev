import {validAttachmentSelection} from './xiaozhi-attachments';
import {LOCAL_IMAGE_SCHEMA,validLocalImageRequest,validLocalImageDimensions,type LocalImageRequest,type LocalImageMime,type LocalImageError} from './xiaozhi-images';

export const MODEL_IMAGE_SCHEMA='xiaozhi.model-image.v1' as const;
export const MODEL_IMAGE_MAX_BASE64=4.5*1024*1024;
export const PUBLIC_IMAGE_APPROVE='公开图片，无学生信息，同意本轮分析';
export const PUBLIC_IMAGE_REJECT='保持本地，不发送';
export type PublicImageInput={id:string;revision:number;purpose:string};
export type PublicImageDelivery={callId:string;title:string;state:'prepared'|'submitting'|'received'|'failed'|'interrupted'};
export type ModelImageRequest=Omit<LocalImageRequest,'schemaVersion'>&{schemaVersion:typeof MODEL_IMAGE_SCHEMA};
export type ModelImageResult={ok:true;schemaVersion:typeof MODEL_IMAGE_SCHEMA;requestId:string;
  data:{image:{type:'image';data:string;mimeType:LocalImageMime};width:number;height:number;originalWidth:number;originalHeight:number;note:string}}
 |{ok:false;schemaVersion:typeof MODEL_IMAGE_SCHEMA;requestId:string;error:LocalImageError};
function data(value:unknown,keys:string[]):Record<string,unknown>|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return;
 const descriptors=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(value);
 if(own.length!==keys.length||own.some(key=>typeof key!=='string'||!keys.includes(key))||Object.values(descriptors).some(v=>!('value'in v)))return;
 return Object.fromEntries(Object.entries(descriptors).map(([key,d])=>[key,d.value]));
}
export function validPublicImageInput(raw:unknown):raw is PublicImageInput{
 const v=data(raw,['id','revision','purpose']);return !!v&&validAttachmentSelection({id:v.id,revision:v.revision})
  &&typeof v.purpose==='string'&&!!v.purpose.trim()&&v.purpose.length<=500&&!/[\x00-\x1f]/.test(v.purpose);
}
export function validModelImageRequest(raw:unknown):raw is ModelImageRequest{
 const v=data(raw,['schemaVersion','requestId','bytes','mime']);return !!v&&v.schemaVersion===MODEL_IMAGE_SCHEMA
  &&validLocalImageRequest({...v,schemaVersion:LOCAL_IMAGE_SCHEMA});
}
export function validModelImageResult(raw:unknown,id:string):raw is ModelImageResult{
 const v=data(raw,['ok','schemaVersion','requestId','data'])||data(raw,['ok','schemaVersion','requestId','error']);
 if(!v||v.schemaVersion!==MODEL_IMAGE_SCHEMA||v.requestId!==id)return false;
 if(v.ok===false)return ['invalid_input','unsupported','too_large','parse_failed','busy','cancelled','timeout','unavailable'].includes(String(v.error));
 const d=data(v.data,['image','width','height','originalWidth','originalHeight','note']),image=d&&data(d.image,['type','data','mimeType']);
 return v.ok===true&&!!d&&!!image&&validLocalImageDimensions(d.originalWidth,d.originalHeight)&&validLocalImageDimensions(d.width,d.height)
  &&Number(d.width)<=2000&&Number(d.height)<=2000&&image.type==='image'&&['image/png','image/jpeg','image/gif','image/webp'].includes(String(image.mimeType))
  &&typeof d.note==='string'&&d.note.length<=1000&&typeof image.data==='string'&&image.data.length>0&&image.data.length<=MODEL_IMAGE_MAX_BASE64&&/^[A-Za-z0-9+/]+={0,2}$/.test(image.data);
}
