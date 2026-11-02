import {nativeImage} from 'electron';
import {setTimeout as pause} from 'node:timers/promises';
import {recognizeLocalImage} from '../xiaozhi-agent/ocr-host';
import {validOcrDiagnostic} from '../xiaozhi-agent/ocr-diagnostic';
import {LOCAL_OCR_ENGINE} from '../../shared/xiaozhi-ocr';
import {CROP_QUALITY_SCHEMA,cropClearEdges,type CropQuality} from './material-ai-crop-quality';
import {CROP_OCR_ATTEMPTS_SCHEMA,CropOcrFailure,retryableCropOcr,type CropOcrAttempts,type CropOcrAttempt} from './material-ai-crop-ocr-receipt';

/** Reuse the existing bounded, cancellable local OCR host; no model request or new worker pool. */
export async function inspectPageCrop(bytes:Buffer,signal:AbortSignal,ownedRuntimeRoot?:string):Promise<CropQuality>{
 signal.throwIfAborted();if(bytes.length>4*1048576)throw Error('unit_too_large');
 const image=nativeImage.createFromBuffer(bytes),{width,height}=image.getSize();
 if(image.isEmpty()||width<1||height<1||width>2401||height>2401)throw Error('source_changed');
 const clearEdges=cropClearEdges(image.toBitmap(),width,height);let text='';
 const ocrAttempts:CropOcrAttempts={schemaVersion:CROP_OCR_ATTEMPTS_SCHEMA,attempts:[]};
 const limit=process.env.OMNI_EDU_CROP_OCR_RETRY==='0'?1:2;
 for(let attempt=0;attempt<limit;attempt++){
  signal.throwIfAborted();
  try{text=(await recognizeLocalImage(bytes,signal,ownedRuntimeRoot)).text;ocrAttempts.attempts.push({outcome:'success'});break;}
  catch(error){
   if(signal.aborted)throw Error('cancelled');const cause=error instanceof Error?error:Error('unknown');
   const outcome:CropOcrAttempt['outcome']=['empty','parse_failed','timeout','unavailable','busy','configuration','too_large','invalid_input'].includes(cause.message)?cause.message as CropOcrAttempt['outcome']:'unknown';
   ocrAttempts.attempts.push({outcome,...(outcome!=='empty'&&validOcrDiagnostic(cause.cause)?{diagnostic:cause.cause}:{})});
   if(outcome==='empty')break;
   if(attempt+1>=limit||!retryableCropOcr(outcome))throw new CropOcrFailure(cause,ocrAttempts);
   try{await pause(250,undefined,{signal});}catch{throw Error('cancelled');}
  }
 }
 signal.throwIfAborted();return{schemaVersion:CROP_QUALITY_SCHEMA,engine:LOCAL_OCR_ENGINE,text,clearEdges,ocrAttempts};
}
