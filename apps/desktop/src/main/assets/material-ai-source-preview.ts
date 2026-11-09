import type {SourceCropSelection,SourceCropPreview} from '../../shared/material-ai-page';
import type {SourceReadingComparison} from '../../shared/material-ai-source-reading';
import type {PageCrop} from './material-ai-page-crops';
import {QuestionAssets} from './question-assets';

/** Read only an already authenticated owned fragment; never accept renderer paths
 * or re-render a visually similar bitmap. No question eligibility is changed. */
export async function readSourceCropPreview(root:(()=>string)|undefined,crops:PageCrop[],readings:SourceReadingComparison[]|undefined,selection:SourceCropSelection,signal:AbortSignal):Promise<SourceCropPreview>{
 const crop=crops.find(c=>c.number===selection.number),fragment=crop?.fragments?.[selection.index],reading=readings?.find(r=>r.number===selection.number)?.crops[selection.index];
 if(!root||!fragment||!reading||fragment.image.sha256!==reading.sha256)throw Error('source_changed');
 const bytes=await new QuestionAssets(root).read(fragment.image,true,signal);
 return{...selection,sha256:fragment.image.sha256,width:fragment.image.width,height:fragment.image.height,dataUrl:'data:image/png;base64,'+bytes.toString('base64')};
}
