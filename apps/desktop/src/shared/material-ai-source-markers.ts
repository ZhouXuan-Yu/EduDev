import type {AiPagePrompt} from './material-ai-page';
import type {StructureParagraph} from './material-document-structure';

export const SOURCE_LAYOUT_MARKERS = 'source-layout-markers.v1' as const;
export const sourceMarkersEnabled = (p?:AiPagePrompt) => p?.policy==='page-fragments.v3' && p.sourceMarkerPolicy===SOURCE_LAYOUT_MARKERS && p.sourceLayoutPolicy==='source-layout-text.v1' && !!p.structureContext && !p.structureContext.unresolved.length;
const compact=(s:string)=>s.normalize('NFC').replace(/\s/gu,'');

/** Comparison copy only. A marker must own the whole frozen paragraph body.
 * No NFKC, decimal conversion, math folding or free-form punctuation cleanup. */
export function sourceMarkerText(text:string,prompt:AiPagePrompt|undefined,number:string,markerOnly=false):string {
 if(!sourceMarkersEnabled(prompt)||prompt?.policy!=='page-fragments.v3'||!/^\d{1,5}$/.test(number))return text;
 const paragraphs=prompt.structureContext!.paragraphs;
 const parents=paragraphs.filter(p=>p.role==='question'&&p.marker?.kind==='parent'&&p.marker.label===number);
 if(parents.length!==1)return text;
 const parent=parents[0],start=paragraphs.indexOf(parent),next=paragraphs.findIndex((p,i)=>i>start&&p.marker?.kind==='parent');
 const owned=paragraphs.slice(start,next<0?undefined:next);
 if(owned.some(p=>p.issues.length||p.confidence<0.85))return text;
 const markerBody=(p:StructureParagraph,label:string)=>{
  const match=new RegExp('^\\s*'+label+'[.．](?!\\d)[ \\t]*','u').exec(p.rawText);
  return match ? compact(p.rawText.slice(match[0].length)) : undefined;
 };
 const parentBody=markerBody(parent,number);
 if(!parentBody)return text;
 if(markerOnly)return new RegExp('^\\s*'+number+'[.．][ \\t]*$','u').test(text)?text.replace('．','.'):text;
 const edits:{start:number;end:number}[]=[];
 const first=new RegExp('^\\s*'+number+'([.．])(?!\\d)[ \\t]*','u').exec(text);
 if(first&&compact(text.slice(first[0].length)).startsWith(parentBody)){
  const at=first[0].indexOf(first[1]);if(first[1]==='．')edits.push({start:at,end:at+1});
 }
 const options=owned.filter(p=>p.role==='option'&&p.marker?.kind==='option');
 if(options.length>=2&&options.length<=8&&options.every((p,i)=>p.marker!.label===String.fromCharCode(65+i))){
  const found:{start:number;end:number;fullwidth:boolean}[]=[];
  for(const p of options){
   const label=p.marker!.label,body=markerBody(p,label);if(!body)return text;
   const matches=[...text.matchAll(new RegExp('(?<![A-Za-z0-9])'+label+'([.．])(?!\\d)[ \\t]*','gu'))];
   // Bound work before scanning suffixes. Any repeated marker is ambiguous.
   if(matches.length!==1||!compact(text.slice(matches[0].index!+matches[0][0].length)).startsWith(body))return text;
   const m=matches[0],at=m.index!+1;found.push({start:at,end:at+1,fullwidth:m[1]==='．'});
  }
  if(found.some((m,i)=>i>0&&m.start<=found[i-1].start))return text;
  edits.push(...found.filter(m=>m.fullwidth));
 }
 let result=text;for(const edit of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,edit.start)+'.'+result.slice(edit.end);
 return result;
}
