import {randomUUID} from 'node:crypto';
import {LOCAL_IMAGE_SCHEMA,LOCAL_IMAGE_TIMEOUT,validLocalImageRequest,validLocalImageResult,type LocalImageRequest,type LocalImageResult} from '../../shared/xiaozhi-images';
import {localImageHeader} from './image-header';
import {runLocalUtility} from './local-utility-host';
import {MODEL_IMAGE_SCHEMA,validModelImageRequest,validModelImageResult,type ModelImageRequest,type ModelImageResult} from '../../shared/xiaozhi-public-images';
/** Main-only captured bytes; renderer never selects the model utility purpose. */
export function preparePublicModelImage(request:ModelImageRequest,signal:AbortSignal):Promise<ModelImageResult>{
 const fail=(error:Extract<ModelImageResult,{ok:false}>['error']):ModelImageResult=>({ok:false,schemaVersion:MODEL_IMAGE_SCHEMA,requestId:request.requestId,error});
 if(!validModelImageRequest(request))return Promise.resolve(fail('invalid_input'));
 const header=localImageHeader({...request,schemaVersion:LOCAL_IMAGE_SCHEMA});if('error'in header)return Promise.resolve(fail(header.error));
 return runLocalUtility({entry:'image-worker.js',serviceName:'小智公开图片准备',request,timeout:LOCAL_IMAGE_TIMEOUT,signal,
  valid:(value):value is ModelImageResult=>validModelImageResult(value,request.requestId),fail});
}
export function previewLocalImage(request:LocalImageRequest,signal:AbortSignal):Promise<LocalImageResult>{
 const fail=(error:Extract<LocalImageResult,{ok:false}>['error']):LocalImageResult=>({ok:false,schemaVersion:LOCAL_IMAGE_SCHEMA,requestId:request.requestId,error});
 if(!validLocalImageRequest(request))return Promise.resolve(fail('invalid_input'));
 const header=localImageHeader(request);if('error'in header)return Promise.resolve(fail(header.error));
 return runLocalUtility({entry:'image-worker.js',serviceName:'小智本地图片预览',request,timeout:LOCAL_IMAGE_TIMEOUT,signal,
  valid:(value):value is LocalImageResult=>validLocalImageResult(value,request.requestId),fail});
}
/** Main-only import validation. No bytes, file path or consent accepted from renderer. */
export async function validateImportedImage(bytes:Buffer,mime:string,signal:AbortSignal){
 const result=await previewLocalImage({schemaVersion:LOCAL_IMAGE_SCHEMA,requestId:`xiimage_${randomUUID()}`,bytes,mime:mime as LocalImageRequest['mime']},signal);
 if(!result.ok)throw new Error(result.error);signal.throwIfAborted();return result.data;
}
