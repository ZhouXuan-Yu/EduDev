import {validPageBlocks,type PageBlocks} from './material-page-blocks';
import {validContinuationTextProof,type ContinuationTextProof} from './material-ai-continuation-text';
import {ownedPageFragmentGroups} from './material-ai-owned-crops';
import {validBlockTexts,type BlockTextHint} from './material-ai-page-fragments';
import {aiTextSignature} from './material-ai-image';
import {validMaterialPageSource,type MaterialPageSource,type AiPagePrompt} from './material-ai-page';
import {MATERIAL_PREVIEW_SCHEMA,PDF_PAGE_ENGINE,validMaterialPreviewQuery,type MaterialPreviewResult} from './material-page-preview';

export const PAGE_CONTINUATION='page-continuation.v1' as const;
export const PAGE_CONTINUATION_TEXT='page-continuation.v2' as const;
export type ContinuationScope={kind:'selected_pages'}|{kind:'folder_grant';folderId:string;revision:number};
export type ContinuationImage=Omit<Extract<MaterialPreviewResult,{ok:true}>,'dataUrl'>;
type ContinuationBase={number:string;nextNumber:string;source:MaterialPageSource;blocks:PageBlocks;blockTexts:BlockTextHint[];blockIds:string[];text:string;image:ContinuationImage;scope:ContinuationScope};
export type PageContinuation=ContinuationBase&({schemaVersion:typeof PAGE_CONTINUATION}|{schemaVersion:typeof PAGE_CONTINUATION_TEXT;textProof:ContinuationTextProof});
const parent=/^[ \t]*(?:第[ \t]*(\d{1,5})[ \t]*题[ \t]*[:：]?|(\d{1,5})[.、．](?!\d))/gmu;
const markers=(text:string)=>[...text.matchAll(new RegExp(parent))];
const continuationStart=/^\s*(?:[（(]\s*(?:[2-9]|[1-9][0-9])\s*[)）]|[②-⑳])/u;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
const number=(m:RegExpMatchArray)=>m[1]||m[2];
/** Conservative source planner. An unambiguous complete prefix must end at the next parent. */
export function continuationPrefix(currentText:string,currentHints:BlockTextHint[],nextText:string,blocks:PageBlocks,hints:BlockTextHint[]){
 if(!validPageBlocks(blocks)||!blocks.ok||!validBlockTexts(hints,blocks)||!continuationStart.test(nextText))return;
 const last=markers(currentText).at(-1),hintLast=markers(currentHints.map(h=>h.text).join('\n')).at(-1),boundary=markers(nextText)[0];
 if(!last||!hintLast||!boundary||number(last)!==number(hintLast)||Number(number(boundary))!==Number(number(last))+1)return;
 const rawPrefix=nextText.slice(0,boundary.index).trim(),index=hints.findIndex(h=>markers(h.text)[0]?.index===0);
 if(!rawPrefix||index<=0||number(markers(hints[index].text)[0])!==number(boundary))return;
 const prefix=blocks.blocks.slice(0,index).filter(b=>!['header','footer','header_image','footer_image'].includes(b.kind)),blockIds=prefix.map(b=>b.id);
 const text=prefix.map(b=>hints.find(h=>h.blockId===b.id)!.text).join('\n').trim();
 if(!blockIds.length||blockIds.length>32||!continuationStart.test(text)||new TextEncoder().encode(text).length>8192)return;
 // Raw row-order OCR can interleave a lower neighbour's graph label before its parent.
 // Every owned line must occur in order; every leftover line needs an exact foreign-block witness.
 const raw=rawPrefix.split(/\r?\n/).map(aiTextSignature).filter(Boolean),used=new Set<number>();let cursor=0;
 for(const line of text.split(/\r?\n/).map(aiTextSignature).filter(Boolean)){const at=raw.findIndex((s,i)=>i>=cursor&&s===line);if(at<0)return;used.add(at);cursor=at+1;}
 const foreign=new Map<string,number>();for(const hint of hints.filter(h=>!blockIds.includes(h.blockId)))for(const line of hint.text.split(/\r?\n/).map(aiTextSignature).filter(Boolean))foreign.set(line,(foreign.get(line)||0)+1);
 for(const [i,line]of raw.entries())if(!used.has(i)){const count=foreign.get(line)||0;if(!count)return;foreign.set(line,count-1);}
 try{const [group]=ownedPageFragmentGroups(blocks,blockIds,1);return{number:number(last),nextNumber:number(boundary),blockIds,text,box:group.box};}catch{return;}
}
export function validPageContinuation(v:unknown):v is PageContinuation{
 const keys=['schemaVersion','number','nextNumber','source','blocks','blockTexts','blockIds','text','image','scope'];
 if(!exact(v,keys)&&!exact(v,[...keys,'textProof']))return false;
 if(typeof v.text!=='string'||(v.schemaVersion===PAGE_CONTINUATION?Object.hasOwn(v,'textProof'):v.schemaVersion!==PAGE_CONTINUATION_TEXT||!validContinuationTextProof(v.textProof,v.text)))return false;
 if(!validMaterialPageSource(v.source)||v.source.schemaVersion!=='xiaozhi.material-page-source.v1'||!validPageBlocks(v.blocks)||!v.blocks.ok||!validBlockTexts(v.blockTexts,v.blocks)||typeof v.number!=='string'||!/^\d{1,5}$/.test(v.number)||typeof v.nextNumber!=='string'||Number(v.nextNumber)!==Number(v.number)+1||!/^\d{1,5}$/.test(v.nextNumber)||typeof v.text!=='string'||v.text.length>8192||!Array.isArray(v.blockIds)||Object.getPrototypeOf(v.blockIds)!==Array.prototype||v.blockIds.length<1||v.blockIds.length>32||Reflect.ownKeys(v.blockIds).length!==v.blockIds.length+1||!Array.from({length:v.blockIds.length},(_,i)=>Object.getOwnPropertyDescriptor(v.blockIds,String(i))).every(d=>!!d&&d.enumerable&&'value'in d&&typeof d.value==='string'))return false;
 const scope=v.scope;if(!(exact(scope,['kind'])&&scope.kind==='selected_pages'||exact(scope,['kind','folderId','revision'])&&scope.kind==='folder_grant'&&typeof scope.folderId==='string'&&/^batch_[a-f0-9-]{36}$/i.test(scope.folderId)&&Number.isSafeInteger(scope.revision)&&Number(scope.revision)>=1))return false;
 const plan=continuationPrefix(`${v.number}. 原题`,[{blockId:'block-1',text:`${v.number}. 原题`}],`${v.text}\n${v.nextNumber}. 下一题`,v.blocks,v.blockTexts);
 if(!plan||JSON.stringify(v.blockIds)!==JSON.stringify(plan.blockIds)||plan.text!==v.text)return false;
 const image=v.image;
 return exact(image,['schemaVersion','ok','requestId','resourceId','version','engine','assetId','page','total','box','width','height','sha256'])&&image.schemaVersion===MATERIAL_PREVIEW_SCHEMA&&image.ok===true&&image.engine===PDF_PAGE_ENGINE&&validMaterialPreviewQuery({schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:image.requestId,resourceId:image.resourceId,version:image.version,page:image.page,box:image.box})&&image.resourceId===v.source.resourceId&&image.version===v.source.version&&image.page===v.source.page&&JSON.stringify(image.box)===JSON.stringify(plan.box)&&Number.isSafeInteger(image.total)&&Number(image.total)>=v.source.page&&Number(image.total)<=10000&&typeof image.assetId==='string'&&/^asset_[a-f0-9-]{36}$/.test(image.assetId)&&typeof image.sha256==='string'&&/^[a-f0-9]{64}$/.test(image.sha256)&&[image.width,image.height].every(n=>Number.isSafeInteger(n)&&Number(n)>=1&&Number(n)<=2401);
}
export const pageContinuation=(prompt?:AiPagePrompt)=>prompt?.policy==='page-fragments.v3'?prompt.continuation:undefined;
/** Main block ids remain the model's selection. The authenticated prefix is appended exactly once. */
export function continuationCropGroups(prompt:Extract<AiPagePrompt,{blockTexts:BlockTextHint[]}>,ids:string[],number:string){
 const extra=pageContinuation(prompt),append=extra?.number===number;
 const groups=ownedPageFragmentGroups(prompt.blocks,ids,append?7:8).map(g=>({...g,source:undefined as MaterialPageSource|undefined}));
 if(append)groups.push({blockIds:extra.blockIds.map(id=>'next:'+id),box:extra.image.box,source:extra.source});return groups;
}
