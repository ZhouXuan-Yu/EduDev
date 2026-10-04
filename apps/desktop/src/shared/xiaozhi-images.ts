/** Private utility protocol. Never accept image bytes through renderer IPC. */
export const LOCAL_IMAGE_SCHEMA='xiaozhi.local-image.v1' as const;
export const LOCAL_IMAGE_MAX_INPUT=4*1024*1024;
export const LOCAL_IMAGE_MAX_SIDE=8192;
export const LOCAL_IMAGE_MAX_PIXELS=16_000_000;
export const LOCAL_IMAGE_THUMB_SIDE=192;
export const LOCAL_IMAGE_MAX_BASE64=256*1024;
export const LOCAL_IMAGE_TIMEOUT=15_000;
export type LocalImageMime='image/png'|'image/jpeg'|'image/gif'|'image/webp';
export type LocalImageError='invalid_input'|'unsupported'|'too_large'|'parse_failed'|'busy'|'cancelled'|'timeout'|'unavailable';
export type LocalImageRequest={schemaVersion:typeof LOCAL_IMAGE_SCHEMA;requestId:string;bytes:Uint8Array;mime:LocalImageMime};
export type LocalImagePreview={width:number;height:number;thumbnailWidth:number;thumbnailHeight:number;thumbnail:string};
export type LocalImageResult={ok:true;schemaVersion:typeof LOCAL_IMAGE_SCHEMA;requestId:string;data:LocalImagePreview}
 |{ok:false;schemaVersion:typeof LOCAL_IMAGE_SCHEMA;requestId:string;error:LocalImageError};
const mimes=['image/png','image/jpeg','image/gif','image/webp'];
function ownData(value:unknown,keys:string[]):Record<string,unknown>|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return;
 const own=Reflect.ownKeys(value);
 if(own.length!==keys.length||own.some(key=>typeof key!=='string'||!keys.includes(key)))return;
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Object.values(descriptors).some(d=>!('value'in d)))return;
 return Object.fromEntries(Object.entries(descriptors).map(([key,d])=>[key,d.value]));
}
export function validLocalImageRequest(value:unknown):value is LocalImageRequest{
 const v=ownData(value,['schemaVersion','requestId','bytes','mime']);
 return !!v&&v.schemaVersion===LOCAL_IMAGE_SCHEMA&&typeof v.requestId==='string'&&/^xiimage_[a-f0-9-]{36}$/i.test(v.requestId)
  &&typeof v.mime==='string'&&mimes.includes(v.mime)&&v.bytes instanceof Uint8Array&&v.bytes.byteLength>0&&v.bytes.byteLength<=LOCAL_IMAGE_MAX_INPUT;
}
export const validLocalImageDimensions=(width:unknown,height:unknown):boolean=>typeof width==='number'&&typeof height==='number'
 &&Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0&&width<=LOCAL_IMAGE_MAX_SIDE&&height<=LOCAL_IMAGE_MAX_SIDE
 &&width*height<=LOCAL_IMAGE_MAX_PIXELS;
export function validLocalImageResult(value:unknown,id:string):value is LocalImageResult{
 const v=ownData(value,['ok','schemaVersion','requestId','data'])||ownData(value,['ok','schemaVersion','requestId','error']);
 if(!v||v.schemaVersion!==LOCAL_IMAGE_SCHEMA||v.requestId!==id)return false;
 if(v.ok===false)return typeof v.error==='string'&&['invalid_input','unsupported','too_large','parse_failed','busy','cancelled','timeout','unavailable'].includes(v.error);
 const d=ownData(v.data,['width','height','thumbnailWidth','thumbnailHeight','thumbnail']);
 return v.ok===true&&!!d&&validLocalImageDimensions(d.width,d.height)&&validLocalImageDimensions(d.thumbnailWidth,d.thumbnailHeight)
  &&Number(d.thumbnailWidth)<=LOCAL_IMAGE_THUMB_SIDE&&Number(d.thumbnailHeight)<=LOCAL_IMAGE_THUMB_SIDE
  &&typeof d.thumbnail==='string'&&d.thumbnail.length<=LOCAL_IMAGE_MAX_BASE64+40
  &&/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(d.thumbnail)
  &&d.thumbnail.slice(d.thumbnail.indexOf(',')+1).length<=LOCAL_IMAGE_MAX_BASE64;
}
