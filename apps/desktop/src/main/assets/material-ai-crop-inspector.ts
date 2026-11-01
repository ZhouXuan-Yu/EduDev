import {nativeImage} from 'electron';
import {recognizeLocalImage} from '../xiaozhi-agent/ocr-host';
import {LOCAL_OCR_ENGINE} from '../../shared/xiaozhi-ocr';
import {CROP_QUALITY_SCHEMA,cropClearEdges,type CropQuality} from './material-ai-crop-quality';

/** Reuse the existing bounded, cancellable local OCR host; no model request or new worker pool. */
export async function inspectPageCrop(bytes:Buffer,signal:AbortSignal,ownedRuntimeRoot?:string):Promise<CropQuality>{
 signal.throwIfAborted();if(bytes.length>4*1048576)throw Error('unit_too_large');
 const image=nativeImage.createFromBuffer(bytes),{width,height}=image.getSize();
 if(image.isEmpty()||width<1||height<1||width>2401||height>2401)throw Error('source_changed');
 const clearEdges=cropClearEdges(image.toBitmap(),width,height);let text='';
 try{text=(await recognizeLocalImage(bytes,signal,ownedRuntimeRoot)).text;}catch(error){if(signal.aborted)throw Error('cancelled');if(!(error instanceof Error&&error.message==='empty'))throw Error(error instanceof Error&&error.message==='busy'?'busy':'ocr_failed');}
 signal.throwIfAborted();return{schemaVersion:CROP_QUALITY_SCHEMA,engine:LOCAL_OCR_ENGINE,text,clearEdges};
}
