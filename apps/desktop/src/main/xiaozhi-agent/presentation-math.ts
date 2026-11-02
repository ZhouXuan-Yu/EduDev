import {officeMathParts} from '../../shared/office-math';
import {OFFICE_DRAFT_SCHEMA,type PresentationDraft} from '../../shared/xiaozhi-office-draft';
import type {OfficeMathImage} from './office-pdf-renderer';

export type PresentationBlock={text:string;image?:OfficeMathImage};
export type PresentationMath={paragraphs:PresentationBlock[];cells:Map<string,PresentationBlock[]>};
/** Keep surrounding language as native editable text; only individual formulas become images. */
export async function preparePresentationMath(draft:PresentationDraft,options:{dataRoot:string;signal?:AbortSignal}):Promise<PresentationMath[]>{
  const plain=(text:string)=>{if(officeMathParts(text).some(p=>p.kind==='math'))throw Error('unsupported');};
  plain(draft.title);draft.sections.forEach(s=>plain(s.heading));
  const pending:{block:PresentationBlock;raw:string}[]=[];
  const blocks=(text:string):PresentationBlock[]=>officeMathParts(text).flatMap(p=>{
    if(p.kind==='text')return p.raw.trim()?[{text:p.raw.replace(/\\\$/g,'$')}]:[];
    const block={text:p.raw};pending.push({block,raw:p.raw});return [block];
  });
  const plan=draft.sections.map(s=>({paragraphs:s.paragraphs.flatMap(blocks),cells:new Map(s.table?[s.table.columns,...s.table.rows].flatMap((row,ri)=>row.flatMap((cell,ci)=>{
    if(!officeMathParts(String(cell)).some(p=>p.kind==='math'))return [];
    return [[`${ri}:${ci}`,blocks(String(cell))] as [string,PresentationBlock[]]];
  })):[])}));
  if(pending.length>200)throw Error('too_large');
  if(pending.length){
    const images=await(await import('./office-pdf-renderer')).renderOfficeMathImages({schemaVersion:OFFICE_DRAFT_SCHEMA,title:'教学公式',sections:pending.map((p,i)=>({heading:String(i),paragraphs:[p.raw]}))},{...options,cropMath:true});
    for(const [i,item]of pending.entries()){const image=images.get(`${i}:0`);if(!image)throw Error('generation_failed');item.block.image=image;}
  }
  return plan;
}
