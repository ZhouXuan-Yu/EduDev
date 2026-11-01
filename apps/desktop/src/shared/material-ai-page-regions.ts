import {pageFragmentsPolicy,MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT,MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT,MATERIAL_PAGE_FRAGMENTS_PROMPT} from './material-ai-page-fragments';
import {aiTextSignature,type AiImageQuestion} from './material-ai-image';
import {validQuestionProjection} from './question-projection';

export const MATERIAL_PAGE_REGIONS_LEGACY_PROMPT='page-regions.v1' as const;
export const MATERIAL_PAGE_REGIONS_PROMPT='page-regions.v2' as const;
export const MATERIAL_PAGE_LAYOUT_PROMPT='page-regions.v3' as const;
export function pageRegionsPolicy(value:unknown):value is typeof MATERIAL_PAGE_FRAGMENTS_PROMPT|typeof MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT|typeof MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT|typeof MATERIAL_PAGE_LAYOUT_PROMPT|typeof MATERIAL_PAGE_REGIONS_PROMPT|typeof MATERIAL_PAGE_REGIONS_LEGACY_PROMPT{return pageFragmentsPolicy(value)||value===MATERIAL_PAGE_LAYOUT_PROMPT||value===MATERIAL_PAGE_REGIONS_PROMPT||value===MATERIAL_PAGE_REGIONS_LEGACY_PROMPT;}
export const MATERIAL_PAGE_REGIONS_RESPONSE='xiaozhi.material-ai-page-regions.v1' as const;
export type AiQuestionRegion={number:string;box:[number,number,number,number]|null;complete:boolean};
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
export function validQuestionRegion(v:unknown):v is AiQuestionRegion{
 if(!exact(v,['number','box','complete'])||typeof v.number!=='string'||!/^\d{1,5}$/.test(v.number)||typeof v.complete!=='boolean')return false;
 if(v.box===null)return !v.complete;
 if(!Array.isArray(v.box)||Object.getPrototypeOf(v.box)!==Array.prototype||Reflect.ownKeys(v.box).length!==5)return false;
 const ds=Object.getOwnPropertyDescriptors(v.box);for(let i=0;i<4;i++)if(!ds[i]||!('value'in ds[i])||typeof ds[i].value!=='number'||!Number.isFinite(ds[i].value)||ds[i].value<0||ds[i].value>1)return false;
 return v.box[2]-v.box[0]>=.01&&v.box[3]-v.box[1]>=.01;
}
export function validQuestionRegions(value:unknown,numbers:readonly string[]):value is AiQuestionRegion[]{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length!==numbers.length||value.length>20||Reflect.ownKeys(value).length!==value.length+1||new Set(numbers).size!==numbers.length)return false;
 for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!d.enumerable||!('value'in d))return false;}
 if(!value.every(validQuestionRegion)||new Set(value.map(v=>v.number)).size!==value.length||value.some(v=>!numbers.includes(v.number)))return false;
 // Different parent questions cannot claim the same pixels as their complete original.
 for(let i=0;i<value.length;i++)for(let j=0;j<i;j++){const a=value[i].box,b=value[j].box;if(a&&b&&Math.min(a[2],b[2])-Math.max(a[0],b[0])>1e-6&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>1e-6)return false;}
 return true;
}
/** The second pass verifies the exact first crop; it cannot silently replace that crop. */
export function agreedQuestionRegion(first:AiQuestionRegion[],final:AiQuestionRegion[],number:string){
 const a=first.find(r=>r.number===number),b=final.find(r=>r.number===number);
 return a?.complete&&b?.complete&&a.box&&b.box&&JSON.stringify(a.box)===JSON.stringify(b.box)?a.box:undefined;
}
/** Consistency only; callers must also authenticate the source, crop and literal question body. */
export function visualQuestionAgrees(a:AiImageQuestion,b:AiImageQuestion){
 const fields=['number','stem','answer','analysis','subject','grade','knowledgePoint','questionType','difficulty','answerOrigin','analysisOrigin'] as const;
 return a.requiresImage&&b.requiresImage&&!a.issues.some(i=>i!=='requires_image')&&!b.issues.some(i=>i!=='requires_image')&&validQuestionProjection(a.projection,true)&&validQuestionProjection(b.projection,true)&&a.projection.figures.state==='provided'&&b.projection.figures.state==='provided'&&fields.every(k=>aiTextSignature(a[k])===aiTextSignature(b[k]))&&(['statement','formulas','tables','figures','choices','subquestions'] as const).every(k=>a.projection[k].state===b.projection[k].state&&aiTextSignature(a.projection[k].text)===aiTextSignature(b.projection[k].text));
}
