import type {RerankInput} from '../../shared/reranker';
function slice(text:string,start:number,end:number){
  if(start>0&&/[\uDC00-\uDFFF]/.test(text[start])&&/[\uD800-\uDBFF]/.test(text[start-1]))start++;
  if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end]))end--;
  return text.slice(start,end);
}
/** A short source remains complete. A long source keeps lead, matched context and final conditions. */
export function rerankContext(id:string,text:string,query:string,focus?:number):RerankInput{
  if(text.length<=1024)return{id,text,complete:true};
  const tokens=query.trim().split(/\s+/).filter(Boolean);let at=Number.isSafeInteger(focus)?Math.max(0,Math.min(focus!,text.length)):0;
  if(!focus)for(const token of tokens){const position=text.indexOf(token);if(position>=0){at=position;break;}}
  const start=Math.max(0,at-100),end=Math.min(text.length,start+600),ranges:[[number,number],[number,number],[number,number]]=[[0,190],[start,end],[Math.max(0,text.length-190),text.length]];
  ranges.sort((a,b)=>a[0]-b[0]);const merged:[number,number][]=[];for(const range of ranges){const previous=merged.at(-1);if(previous&&range[0]<=previous[1])previous[1]=Math.max(previous[1],range[1]);else merged.push([...range]);}
  return{id,text:merged.map(([a,b])=>slice(text,a,b)).join('\n…\n'),complete:false};
}
