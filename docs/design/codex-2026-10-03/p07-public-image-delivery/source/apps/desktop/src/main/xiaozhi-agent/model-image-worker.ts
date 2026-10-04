import {MODEL_IMAGE_SCHEMA,validModelImageRequest,validModelImageResult,type ModelImageResult} from '../../shared/xiaozhi-public-images';
import {LOCAL_IMAGE_SCHEMA} from '../../shared/xiaozhi-images';
import {localImageHeader} from './image-header';
import {prepareSingleModelImageInputForPrompt} from './vendor/hana/core/model-image-preprocess';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
/** Runs only inside the existing fixed image utility, not main or renderer. */
export async function prepareModelImage(raw:unknown):Promise<ModelImageResult>{
 const requestId=typeof(raw as {requestId?:unknown})?.requestId==='string'?String((raw as {requestId:string}).requestId):'';
 const fail=(error:Extract<ModelImageResult,{ok:false}>['error']):ModelImageResult=>({ok:false,schemaVersion:MODEL_IMAGE_SCHEMA,requestId,error});
 if(!validModelImageRequest(raw))return fail('invalid_input');
 const header=localImageHeader({...raw,schemaVersion:LOCAL_IMAGE_SCHEMA});if('error'in header)return fail(header.error);
 try{
  const entry=fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'));
  if(JSON.parse(fs.readFileSync(path.join(path.dirname(entry),'../package.json'),'utf8')).version!=='1.0.2')return fail('unavailable');
  const prepared=await prepareSingleModelImageInputForPrompt({image:{type:'image',data:Buffer.from(raw.bytes).toString('base64'),mimeType:raw.mime},imageCount:8});
  const size=prepared.resizeResult;
  if([size.originalWidth,size.originalHeight].sort((a,b)=>a-b).join(',')!==[header.width,header.height].sort((a,b)=>a-b).join(','))return fail('parse_failed');
  const result:ModelImageResult={ok:true,schemaVersion:MODEL_IMAGE_SCHEMA,requestId,data:{image:prepared.image,
   width:size.width,height:size.height,originalWidth:size.originalWidth,originalHeight:size.originalHeight,note:prepared.note||''}};
  return validModelImageResult(result,requestId)?result:fail('parse_failed');
 }catch{return fail('parse_failed');}
}
