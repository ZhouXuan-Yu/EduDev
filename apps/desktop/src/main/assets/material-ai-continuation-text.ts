import {nativeImage} from 'electron';
import {continuationTextLines,deriveContinuationTextProof,type ContinuationTextProof} from '../../shared/material-ai-continuation-text';
import {PAGE_CONTINUATION_TEXT,type PageContinuation} from '../../shared/material-ai-continuation';
import type {MaterialLine} from '../../shared/material-layout';

export type ContinuationTextInspector=(extra:PageContinuation,lines:MaterialLine[]|undefined,bytes:Buffer,signal:AbortSignal)=>Promise<ContinuationTextProof|undefined>;
/** On read, authenticate PNG bytes first, then rederive pixel proof without new OCR or model calls. */
export const inspectContinuationText:ContinuationTextInspector=async(extra,lines,bytes,signal)=>{
 signal.throwIfAborted();if(bytes.length>4*1048576)throw Error('unit_too_large');
 const selected=lines?continuationTextLines(extra,lines):extra.schemaVersion===PAGE_CONTINUATION_TEXT?extra.textProof.lines:undefined;if(!selected)return;
 const image=nativeImage.createFromBuffer(bytes),{width,height}=image.getSize();
 if(image.isEmpty()||width!==extra.image.width||height!==extra.image.height)throw Error('source_changed');
 const proof=deriveContinuationTextProof(extra.text,selected,image.toBitmap(),width,height,signal);signal.throwIfAborted();return proof;
};
