import {PDF_LAYOUT_ENGINE,type PdfLayout} from './material-layout';
import {MATERIAL_PAGE_LAYOUT_PROMPT,MATERIAL_PAGE_REGIONS_RESPONSE,validQuestionRegions,type AiQuestionRegion} from './material-ai-page-regions';
import type {AiPagePrompt,AiPageResponse} from './material-ai-page';

export const LOCAL_PAGE_REGIONS='xiaozhi.local-page-regions.v1' as const;
/** Numeric local hints only. These never certify OCR, crop completeness or an answer. */
export type LocalPageRegions={schemaVersion:typeof LOCAL_PAGE_REGIONS;engine:typeof PDF_LAYOUT_ENGINE;inputSha256:string;rasterSha256:string;page:number;total:number;regions:AiQuestionRegion[]};
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
export function validLocalPageRegions(v:unknown):v is LocalPageRegions{
 if(!plain(v,['schemaVersion','engine','inputSha256','rasterSha256','page','total','regions'])||v.schemaVersion!==LOCAL_PAGE_REGIONS||v.engine!==PDF_LAYOUT_ENGINE||typeof v.inputSha256!=='string'||!/^[a-f0-9]{64}$/.test(v.inputSha256)||typeof v.rasterSha256!=='string'||!/^[a-f0-9]{64}$/.test(v.rasterSha256)||!Number.isSafeInteger(v.page)||!Number.isSafeInteger(v.total)||Number(v.page)<1||Number(v.page)>Number(v.total)||Number(v.total)>10000||!Array.isArray(v.regions))return false;
 const descriptors=Object.getOwnPropertyDescriptors(v.regions);
 if(v.regions.length>20||Reflect.ownKeys(v.regions).length!==v.regions.length+1)return false;
 const numbers:string[]=[];for(let i=0;i<v.regions.length;i++){const d=descriptors[i];if(!d||!('value'in d)||!plain(d.value,['number','box','complete']))return false;numbers.push(d.value.number as string);}
 return validQuestionRegions(v.regions,numbers)&&v.regions.every(r=>r.complete&&r.box!==null);
}
export function matchesLocalRegion(layout:LocalPageRegions,region:AiQuestionRegion){return region.complete&&!!region.box&&layout.regions.some(r=>r.number===region.number&&JSON.stringify(r.box)===JSON.stringify(region.box));}
export function selectedPageRegions(first:AiPageResponse,prompt?:AiPagePrompt){return first.schemaVersion===MATERIAL_PAGE_REGIONS_RESPONSE?first.questions.flatMap(q=>{const r=first.regions.find(r=>r.number===q.number);return q.requiresImage&&r?.complete&&r.box&&(prompt?.policy!==MATERIAL_PAGE_LAYOUT_PROMPT||matchesLocalRegion(prompt.layout,r))?[r]:[];}).slice(0,8):[];}

/** Conservative single-column parent headings; a decimal or OCR split number is not repaired. */
export function proposeLocalPageRegions(layout:PdfLayout):LocalPageRegions{
 const lines=layout.lines.map((l,index)=>({index,text:l.text,score:l.score,left:Math.min(...l.normalizedQuad.map(p=>p[0])),top:Math.min(...l.normalizedQuad.map(p=>p[1])),bottom:Math.max(...l.normalizedQuad.map(p=>p[1]))}));
 const headings=lines.flatMap(l=>{const m=/^\s*(?:第\s*(\d{1,5})\s*题\s*|([1-9]\d{0,4})[.．、](?!\d)\s*)\S/.exec(l.text);return m?[{...l,number:m[1]||m[2]}]:[];}).sort((a,b)=>a.top-b.top);
 const regions:AiQuestionRegion[]=[],margin=14/layout.height;
 // A figure caption beside a following parent heading cannot be separated by a
 // full-width rectangle. Hold both neighbours instead of trimming that caption.
 const ambiguous=(h:typeof headings[number])=>lines.some(l=>l.index!==h.index&&l.top<h.bottom&&l.bottom>h.top-margin);
 const unambiguous=headings.length<=20&&new Set(headings.map(h=>h.number)).size===headings.length&&(!headings.length||Math.max(...headings.map(h=>h.left))-Math.min(...headings.map(h=>h.left))<=.035)&&headings.every(h=>h.score>=.75)&&headings.every((h,i)=>!i||h.top-headings[i-1].bottom>=margin);
 if(unambiguous)for(let i=0;i<headings.length;i++){
  const h=headings[i],next=headings[i+1],footer=lines.filter(l=>l.top>h.bottom&&l.top>.85&&/^\s*(?:第\s*)?\d+\s*页(?:\s*共\s*\d+\s*页)?\s*$/.test(l.text)).sort((a,b)=>a.top-b.top)[0];
  if(ambiguous(h)||next&&ambiguous(next))continue;
  const end=Math.min(next?.top??1,footer?.top??1),top=Math.max(0,h.top-margin),bottom=Math.max(0,end-margin);
  // E.g. OCR "1.4." cannot justify treating the following parent as part of this one.
  if(lines.some(l=>l.top>h.bottom&&l.top<end&&/^\s*\d{1,5}[.．]\d{1,5}[.．、]/.test(l.text)))continue;
  if(bottom-top>=.01)regions.push({number:h.number,box:[0,top,1,bottom],complete:true});
 }
 return{schemaVersion:LOCAL_PAGE_REGIONS,engine:layout.engine,inputSha256:layout.inputSha256,rasterSha256:layout.rasterSha256,page:layout.page,total:layout.total,regions};
}
