import {isFragmentPageResponse} from '../../shared/material-ai-page';
import {MATERIAL_PAGE_FRAGMENTS_RESPONSE} from '../../shared/material-ai-page-fragments';
import type {AiPageResponse} from '../../shared/material-ai-page';
import type {PageCrop} from './material-ai-page-crops';

/** Teacher inspection only: ownership is required, OCR/body concordance is not claimed.
 * Callers authenticate receipts, original versions and all crop bytes first. Never use
 * this adapter for Pi context, paper eligibility or canonical document publication. */
export function reviewPageCrop(number:string,first:AiPageResponse,review:AiPageResponse|undefined,final:AiPageResponse,crops:PageCrop[]):PageCrop|undefined{
 const passes=review?[first,review,final]:[first,final];let owned:string|undefined;
 for(const response of passes){
  if(!isFragmentPageResponse(response)||!response.questions.some(q=>q.number===number))return;
  const fragment=response.fragments.find(f=>f.number===number);
  if(!fragment?.complete||!fragment.blockIds.length)return;
  const ids=JSON.stringify(fragment.blockIds);if(owned!==undefined&&owned!==ids)return;owned=ids;
 }
 const crop=crops.find(c=>c.number===number);
 if(!crop?.fragments?.length||crop.failure||JSON.stringify(crop.fragments.flatMap(f=>f.blockIds||[f.blockId]).filter(id=>!id.startsWith('next:')))!==owned)return;
 return crop;
}
