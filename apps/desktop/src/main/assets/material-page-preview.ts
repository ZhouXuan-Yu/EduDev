import {createHash} from 'node:crypto';
import {MATERIAL_PREVIEW_SCHEMA,PDF_PAGE_ENGINE,validMaterialPreviewQuery,validPdfPageReceipt,type MaterialPreviewQuery,type MaterialPreviewResult,type PdfPageReceipt} from '../../shared/material-page-preview';
import type {MaterialRepository} from './material-repository';
export type PageRenderer=(bytes:Buffer,input:Pick<MaterialPreviewQuery,'page'|'box'>,signal:AbortSignal)=>Promise<Extract<PdfPageReceipt,{ok:true}>>;
/** Original-backed ephemeral PNG. No cache database, confirmed question, model or approval. */
export async function previewMaterialPage(repository:MaterialRepository,input:MaterialPreviewQuery,signal:AbortSignal,render:PageRenderer):Promise<Extract<MaterialPreviewResult,{ok:true}>>{
 if(!validMaterialPreviewQuery(input))throw new Error('invalid_input');signal.throwIfAborted();
 const resource=await repository.resource(input.resourceId);
 if(!/\.pdf$/i.test(resource.originalFileName))throw new Error('unsupported');
 const bytes=await repository.original(input.resourceId,input.version,signal);
 const result=await render(bytes,{page:input.page,box:input.box},signal);
 signal.throwIfAborted();
 if(!validPdfPageReceipt(result)||!result.ok||result.inputSha256!==input.version||result.page!==input.page||JSON.stringify(result.box)!==JSON.stringify(input.box))throw new Error('parse_failed');
 const png=Buffer.from(result.png,'base64');
 const sha256=createHash('sha256').update(png).digest('hex');
 const x0=Math.floor(input.box[0]*result.pageWidth),y0=Math.floor(input.box[1]*result.pageHeight),x1=Math.ceil(input.box[2]*result.pageWidth),y1=Math.ceil(input.box[3]*result.pageHeight);
 if(png.length>4*1048576||png.length<57||png.toString('base64')!==result.png||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||png.readUInt32BE(8)!==13||png.toString('ascii',12,16)!=='IHDR'||png.readUInt32BE(16)!==result.width||png.readUInt32BE(20)!==result.height||result.width!==x1-x0||result.height!==y1-y0||!png.subarray(-12).equals(Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130]))||sha256!==result.sha256)throw new Error('parse_failed');
 await repository.original(input.resourceId,input.version,signal);signal.throwIfAborted();
 const identity=createHash('sha256').update(JSON.stringify([input.version,PDF_PAGE_ENGINE,input.page,input.box,sha256])).digest('hex');
 const assetId=`asset_${identity.slice(0,8)}-${identity.slice(8,12)}-${identity.slice(12,16)}-${identity.slice(16,20)}-${identity.slice(20,32)}`;
 return {schemaVersion:MATERIAL_PREVIEW_SCHEMA,ok:true,requestId:input.requestId,resourceId:input.resourceId,version:input.version,engine:PDF_PAGE_ENGINE,assetId,page:input.page,total:result.total,box:[...input.box],width:result.width,height:result.height,sha256,dataUrl:`data:image/png;base64,${result.png}`};
}
