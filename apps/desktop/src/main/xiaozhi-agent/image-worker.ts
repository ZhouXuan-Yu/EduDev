import {resizeImage} from '@earendil-works/pi-coding-agent';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {LOCAL_IMAGE_SCHEMA,LOCAL_IMAGE_THUMB_SIDE,LOCAL_IMAGE_MAX_BASE64,validLocalImageRequest,validLocalImageResult,type LocalImageResult} from '../../shared/xiaozhi-images';
import {localImageHeader} from './image-header';
import {MODEL_IMAGE_SCHEMA} from '../../shared/xiaozhi-public-images';
import {prepareModelImage} from './model-image-worker';
const parent=(process as unknown as {parentPort?:{on:(name:string,fn:(event:{data:unknown})=>void)=>void;postMessage:(value:unknown)=>void}}).parentPort;
let started=false;
async function receive(raw:unknown){
 if(started)return;started=true;
 if((raw as {schemaVersion?:unknown})?.schemaVersion===MODEL_IMAGE_SCHEMA){
  const value=await prepareModelImage(raw);if(parent)parent.postMessage(value);else process.send?.(value);return;
 }
 const requestId=typeof(raw as {requestId?:unknown})?.requestId==='string'?String((raw as {requestId:string}).requestId):'';
 const reply=(value:LocalImageResult)=>parent?parent.postMessage(value):process.send?.(value);
 const fail=(error:Extract<LocalImageResult,{ok:false}>['error'])=>reply({ok:false,schemaVersion:LOCAL_IMAGE_SCHEMA,requestId,error});
 if(!validLocalImageRequest(raw)){fail('invalid_input');return;}
 const header=localImageHeader(raw);if('error'in header){fail(header.error);return;}
 try{
  const entry=fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'));
  if(JSON.parse(fs.readFileSync(path.join(path.dirname(entry),'../package.json'),'utf8')).version!=='1.0.2'){fail('unavailable');return;}
  // Pi owns Photon/EXIF/resize/encoding. Its fallback remains in this utility, never main.
  const image=await resizeImage(raw.bytes,raw.mime,{maxWidth:LOCAL_IMAGE_THUMB_SIDE,maxHeight:LOCAL_IMAGE_THUMB_SIDE,maxBytes:LOCAL_IMAGE_MAX_BASE64,jpegQuality:80});
  if(!image){fail('parse_failed');return;}
  if([image.originalWidth,image.originalHeight].sort((a,b)=>a-b).join(',')!==[header.width,header.height].sort((a,b)=>a-b).join(',')){fail('parse_failed');return;}
  const value:LocalImageResult={ok:true,schemaVersion:LOCAL_IMAGE_SCHEMA,requestId,data:{width:image.originalWidth,height:image.originalHeight,
   thumbnailWidth:image.width,thumbnailHeight:image.height,thumbnail:`data:${image.mimeType};base64,${image.data}`}};
  if(!validLocalImageResult(value,requestId)){fail('parse_failed');return;}reply(value);
 }catch{fail('unavailable');}
}
if(parent)parent.on('message',event=>void receive(event.data));else process.on('message',raw=>void receive(raw));
