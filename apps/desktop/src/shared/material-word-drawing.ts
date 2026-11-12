export const WORD_DRAWING_POLICY='word-drawing.v2' as const;
export const WORD_DRAWING_LEGACY_POLICY='word-drawing.v1' as const;
export const WORD_DRAWING_ENGINE='libreoffice-svg-26.8.2-chromium.v2' as const;
export const WORD_DRAWING_LEGACY_ENGINE='libreoffice-drawing-26.8.2.v1' as const;
export const WORD_DRAWING_SCHEMA='xiaozhi.word-drawing.v1' as const;
export const WORD_DRAWING_VECTOR_SCHEMA='xiaozhi.word-drawing-vector.v1' as const;
export const WORD_DRAWING_ERRORS=['missing','ambiguous','unsupported','invalid_image','too_large','render_failed'] as const;
export type WordDrawingError=typeof WORD_DRAWING_ERRORS[number];
export type WordDrawingProof={path:string;name:string;sha256:string;engine:typeof WORD_DRAWING_ENGINE|typeof WORD_DRAWING_LEGACY_ENGINE;placement:'inline'|'floating'};
export type WordDrawingRequest={part:string;path:string;name:string;sha256:string;xml:string;placement:'inline'|'floating'};
export type WordDrawingItem={inputSha256:string;ok:true;png:string;sha256:string;width:number;height:number}|{inputSha256:string;ok:false;error:WordDrawingError};
export type WordDrawingReceipt={schemaVersion:typeof WORD_DRAWING_SCHEMA;sourceSha256:string;items:WordDrawingItem[]};
export type WordDrawingVectorItem={inputSha256:string;ok:true;svg:string;sha256:string;width:number;height:number}|Extract<WordDrawingItem,{ok:false}>;
export type WordDrawingVectorReceipt={schemaVersion:typeof WORD_DRAWING_VECTOR_SCHEMA;sourceSha256:string;items:WordDrawingVectorItem[]};
export type WordOfficeProgress={phase:'checking'|'downloading'|'extracting'|'verifying'|'ready'|'failed';downloadedBytes:number;totalBytes:number;installedBytes:number;error?:string};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function validWordDrawingProof(v:unknown):v is WordDrawingProof{
 return obj(v)&&Object.keys(v).length===5&&[WORD_DRAWING_ENGINE,WORD_DRAWING_LEGACY_ENGINE].includes(v.engine as WordDrawingProof['engine'])&&['inline','floating'].includes(String(v.placement))&&hash(v.sha256)&&typeof v.path==='string'&&v.path.startsWith('/')&&v.path.length<=1500&&typeof v.name==='string'&&!!v.name.trim()&&v.name.length<=256;
}
export function validWordDrawingRequest(v:unknown):v is WordDrawingRequest{
 return obj(v)&&Object.keys(v).length===6&&typeof v.part==='string'&&v.part==='word/document.xml'&&validWordDrawingProof({path:v.path,name:v.name,sha256:v.sha256,placement:v.placement,engine:WORD_DRAWING_ENGINE})&&typeof v.xml==='string'&&v.xml.length>0&&v.xml.length<=128000;
}
export function validWordDrawingReceipt(v:unknown):v is WordDrawingReceipt{
 if(!obj(v)||Object.keys(v).length!==3||v.schemaVersion!==WORD_DRAWING_SCHEMA||!hash(v.sourceSha256)||!Array.isArray(v.items)||v.items.length>128)return false;
 let bytes=0;
 return v.items.every(item=>{
  if(!obj(item)||!hash(item.inputSha256))return false;
  if(item.ok===false)return Object.keys(item).length===3&&WORD_DRAWING_ERRORS.includes(item.error as WordDrawingError);
  if(item.ok!==true||Object.keys(item).length!==6||!hash(item.sha256)||typeof item.png!=='string'||item.png.length>Math.ceil(4*1048576/3)*4||!Number.isSafeInteger(item.width)||!Number.isSafeInteger(item.height)||Number(item.width)<1||Number(item.height)<1||Number(item.width)>10000||Number(item.height)>10000||Number(item.width)*Number(item.height)>20000000)return false;
  bytes+=item.png.length;return bytes<=90*1048576;
 });
}
export function validWordDrawingVectorReceipt(v:unknown):v is WordDrawingVectorReceipt{
 if(!obj(v)||v.schemaVersion!==WORD_DRAWING_VECTOR_SCHEMA||!Array.isArray(v.items))return false;
 const normalized={...v,schemaVersion:WORD_DRAWING_SCHEMA,items:v.items.map(item=>obj(item)&&item.ok===true?{inputSha256:item.inputSha256,ok:true,png:item.svg,sha256:item.sha256,width:item.width,height:item.height}:item)};
 return validWordDrawingReceipt(normalized)&&v.items.every(item=>obj(item)&&(item.ok===false||Object.keys(item).length===6));
}
