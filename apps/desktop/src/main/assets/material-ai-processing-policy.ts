import type {FolderAiProcessingMode} from '../../shared/material-folder-ai';
import {MATERIAL_CROP_CORRECTION_POLICY,MATERIAL_CROP_REVIEW_IMAGES_POLICY,MATERIAL_CROP_REVIEW_POLICY} from '../../shared/material-ai-page-fragments';

/** These are stable v1 mode mappings; extend the version instead of retargeting saved modes.
 * Folder authorizations freeze the product policy. Environment switches apply only to legacy callers. */
export function materialAiProcessingPolicy(value:unknown){
 if(value!=='legacy'&&value!=='standard'&&value!=='quality')throw Error('processing_mode_invalid');
 const mode:FolderAiProcessingMode=value,legacy=mode==='legacy';
 return {mode,
  restoration:!legacy||process.env.OMNI_EDU_AI_PAGE_RESTORATION!=='0',
  regions:!legacy||process.env.OMNI_EDU_AI_PAGE_REGIONS!=='0',
  fragments:!legacy||process.env.OMNI_EDU_AI_PAGE_FRAGMENTS!=='0',
  ownedMargins:!legacy||process.env.OMNI_EDU_AI_OWNED_CROP_MARGINS==='1',
  crossPage:mode==='quality'||legacy&&process.env.OMNI_EDU_AI_CROSS_PAGE==='1',
  continuationText:mode==='quality'||legacy&&process.env.OMNI_EDU_AI_CONTINUATION_TEXT==='1',
  cropReviewPolicy:legacy?(process.env.OMNI_EDU_AI_CROP_REVIEW==='0'?undefined:process.env.OMNI_EDU_AI_CORRECTION_REVIEW==='1'?MATERIAL_CROP_CORRECTION_POLICY:process.env.OMNI_EDU_AI_CROP_IMAGES==='1'?MATERIAL_CROP_REVIEW_IMAGES_POLICY:MATERIAL_CROP_REVIEW_POLICY):mode==='quality'?MATERIAL_CROP_CORRECTION_POLICY:MATERIAL_CROP_REVIEW_IMAGES_POLICY
 };
}
