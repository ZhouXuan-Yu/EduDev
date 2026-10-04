import {imageSize} from 'image-size';
import {validLocalImageDimensions,type LocalImageRequest,type LocalImageError} from '../../shared/xiaozhi-images';
/** Encoded dimensions bound decoder allocation. This alone is not decode proof. */
export function localImageHeader(request:LocalImageRequest):{width:number;height:number}|{error:LocalImageError}{
 try{
  const result=imageSize(request.bytes);
  const mime=result.type==='jpg'?'image/jpeg':`image/${result.type}`;
  if(mime!==request.mime)return {error:'unsupported'};
  if(!validLocalImageDimensions(result.width,result.height))return {error:'too_large'};
  return {width:result.width!,height:result.height!};
 }catch{return {error:'parse_failed'};}
}
