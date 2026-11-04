import {nativeImage,type NativeImage} from 'electron';
import {createHash} from 'node:crypto';
import {imageSize} from 'image-size';
import {validLocalImageDimensions} from '../../shared/xiaozhi-images';
import {IMAGE_PAGE_ENGINE,MATERIAL_PREVIEW_SCHEMA,validMaterialPreviewQuery,type MaterialPreviewQuery,type MaterialPreviewResult,type PageBox} from '../../shared/material-page-preview';
import {validBlockTexts,type FragmentPageSource} from '../../shared/material-ai-page-fragments';
import {type PageBlocks} from '../../shared/material-page-blocks';
import {withMaterialPageBlocks} from './material-page-blocks';
import type {MaterialRepository} from './material-repository';
import type {MaterialPageSource} from '../../shared/material-ai-page';
import type {LocalOcrReceipt} from '../../shared/xiaozhi-ocr';
const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');

/** Image derivatives have their own engine; never forge a PDF layout/source receipt. */
async function raster(repository:MaterialRepository,source:Pick<MaterialPageSource,'resourceId'|'version'|'page'>,signal:AbortSignal){
 signal.throwIfAborted();if(source.page!==1)throw Error('invalid_input');
 const resource=await repository.resource(source.resourceId);
 if(!/\.(?:png|jpe?g|webp)$/i.test(resource.originalFileName))throw Error('unsupported');
 if(resource.contentHash!==source.version)throw Error('source_changed');
 const stamp=await repository.originalStamp(source.resourceId,source.version),bytes=await repository.original(source.resourceId,source.version,signal);
 if(bytes.length>4*1048576)throw Error('too_large');
 let size;try{size=imageSize(bytes);}catch{throw Error('parse_failed');}
 if(!['png','jpg','webp'].includes(size.type||'')||!validLocalImageDimensions(size.width,size.height))throw Error('too_large');
 let image=nativeImage.createFromBuffer(bytes);const original=image.getSize();
 if(image.isEmpty()||!validLocalImageDimensions(original.width,original.height))throw Error('parse_failed');
 const scale=Math.min(1,2400/Math.max(original.width,original.height));
 if(scale<1)image=image.resize({width:Math.max(1,Math.round(original.width*scale)),height:Math.max(1,Math.round(original.height*scale)),quality:'best'});
 const {width,height}=image.getSize(),png=image.toPNG({scaleFactor:1});if(png.length>4*1048576)throw Error('too_large');
 signal.throwIfAborted();if(await repository.originalStamp(source.resourceId,source.version)!==stamp)throw Error('source_changed');
 return{image,stamp,layout:{page:1,png:png.toString('base64'),rasterSha256:hash(png),width,height}};
}
function crop(image:NativeImage,box:PageBox){const {width,height}=image.getSize(),x=Math.floor(box[0]*width),y=Math.floor(box[1]*height),right=Math.ceil(box[2]*width),bottom=Math.ceil(box[3]*height);return image.crop({x,y,width:right-x,height:bottom-y});}

export async function previewMaterialImage(repository:MaterialRepository,query:MaterialPreviewQuery,signal:AbortSignal):Promise<Extract<MaterialPreviewResult,{ok:true}>>{
 if(!validMaterialPreviewQuery(query))throw Error('invalid_input');
 const source=await raster(repository,query,signal),image=crop(source.image,query.box),{width,height}=image.getSize(),bytes=image.toPNG({scaleFactor:1});
 if(bytes.length>4*1048576)throw Error('too_large');signal.throwIfAborted();
 if(await repository.originalStamp(query.resourceId,query.version)!==source.stamp)throw Error('source_changed');
 const sha256=hash(bytes),identity=hash(JSON.stringify([query.version,IMAGE_PAGE_ENGINE,1,query.box,sha256])),assetId=`asset_${identity.slice(0,8)}-${identity.slice(8,12)}-${identity.slice(12,16)}-${identity.slice(16,20)}-${identity.slice(20,32)}`;
 return{schemaVersion:MATERIAL_PREVIEW_SCHEMA,ok:true,requestId:query.requestId,resourceId:query.resourceId,version:query.version,engine:IMAGE_PAGE_ENGINE,assetId,page:1,total:1,box:[...query.box],width,height,sha256,dataUrl:'data:image/png;base64,'+bytes.toString('base64')};
}

/** Bounded local block OCR hints, not an extra source/approval database. */
export async function imagePageBlocks(repository:MaterialRepository,dataRoot:string,source:MaterialPageSource,signal:AbortSignal,recognizeBlocks:(bytes:Buffer,signal:AbortSignal)=>Promise<PageBlocks>,recognizeText:(bytes:Buffer,signal:AbortSignal)=>Promise<Extract<LocalOcrReceipt,{ok:true}>>):Promise<FragmentPageSource>{
 const raw=await raster(repository,source,signal),result=await withMaterialPageBlocks(repository,dataRoot,{...source,layout:raw.layout},false,signal,recognizeBlocks),blocks=result.pageBlocks.receipt;
 // Avoid thousands of worker launches for a pathological image. Leave it visible as a failed task.
 if(blocks.blocks.length>32)throw Error('unit_too_large');let budget=12000;const blockTexts=[];
 for(const block of blocks.blocks){signal.throwIfAborted();let text='';
  try{const bytes=crop(raw.image,block.box).toPNG({scaleFactor:1});if(bytes.length>4*1048576)throw Error('too_large');text=(await recognizeText(bytes,signal)).text.replaceAll('\0','').slice(0,Math.min(2048,budget)).trim();}
  catch(error){if(signal.aborted)throw Error('cancelled');if(!(error instanceof Error)||error.message!=='empty')throw error;}
  budget-=text.length;blockTexts.push({blockId:block.id,text});
 }
 signal.throwIfAborted();await repository.verify(source.resourceId,source.version,signal);
 if(await repository.originalStamp(source.resourceId,source.version)!==raw.stamp)throw Error('source_changed');
 if(!validBlockTexts(blockTexts,blocks))throw Error('unit_too_large');return{blocks,blockTexts};
}
