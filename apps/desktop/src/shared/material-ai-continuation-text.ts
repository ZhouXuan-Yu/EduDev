import {aiTextSignature} from './material-ai-image';
import type {PageBox} from './material-page-preview';
import type {MaterialLine} from './material-layout';
import type {PageBlocks} from './material-page-blocks';

export const CONTINUATION_TEXT='continuation-text.v1' as const;
export const CONTINUATION_TEXT_MAX_PIXEL_VISITS=250000;
export type ContinuationTextLine={text:string;box:PageBox};
export type ContinuationTextProof={schemaVersion:typeof CONTINUATION_TEXT;lines:ContinuationTextLine[];gaps:{afterLine:number;box:PageBox}[]};
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
const array=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>!!d&&d.enumerable&&'value'in d);
const box=(v:unknown):v is PageBox=>array(v,4)&&v.length===4&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)&&Number(v[0])<Number(v[2])&&Number(v[1])<Number(v[3]);
const sourceLines=(text:string)=>text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
function validLines(v:unknown,text:string):v is ContinuationTextLine[]{
 return typeof text==='string'&&text.length<=8192&&array(v,128)&&v.length>0&&v.every(l=>plain(l,['text','box'])&&typeof l.text==='string'&&l.text===l.text.trim()&&!!l.text&&l.text.length<=2048&&!/[\x00-\x1f]/u.test(l.text)&&box(l.box))&&JSON.stringify((v as ContinuationTextLine[]).map(l=>l.text))===JSON.stringify(sourceLines(text));
}
export function validContinuationTextProof(v:unknown,text:string):v is ContinuationTextProof{
 if(!plain(v,['schemaVersion','lines','gaps'])||v.schemaVersion!==CONTINUATION_TEXT||!validLines(v.lines,text)||!array(v.gaps,16))return false;
 const lines=v.lines;
 let previous=-1;
 if(!v.gaps.every(g=>{if(!plain(g,['afterLine','box'])||!Number.isSafeInteger(g.afterLine)||Number(g.afterLine)<=previous||Number(g.afterLine)<0||Number(g.afterLine)>=lines.length-1||!box(g.box))return false;previous=Number(g.afterLine);return true;}))return false;
 return new TextEncoder().encode(JSON.stringify(v)).length<=32768;
}

/** Narrow typography only: retain variable/number word boundaries, exponents and every other symbol. */
export const continuationTextSignature=(s:string)=>aiTextSignature(s.normalize('NFC').replaceAll('（','(').replaceAll('）',')').replace(/(?<=\p{Script=Han})[ \t]*(?:\r?\n[ \t]*)+(?=\p{Script=Han})/gu,''));

/** Prove an isolated printed rule at an OCR seam; never infer a blank from model text. */
export function deriveContinuationTextProof(text:string,lines:ContinuationTextLine[],bitmap:Uint8Array,width:number,height:number,signal?:AbortSignal):ContinuationTextProof|undefined{
 signal?.throwIfAborted();
 if(!validLines(lines,text)||![width,height].every(n=>Number.isSafeInteger(n)&&n>=24&&n<=2401)||bitmap.length!==width*height*4)return;
 const dark=(x:number,y:number)=>{const i=(y*width+x)*4;return bitmap[i+3]>128&&Math.max(bitmap[i],bitmap[i+1],bitmap[i+2])<180;};
 const gaps:ContinuationTextProof['gaps']=[];let remainingPixels=CONTINUATION_TEXT_MAX_PIXEL_VISITS;
 for(let i=0;i<lines.length-1;i++){
  signal?.throwIfAborted();const left=lines[i],right=lines[i+1];
  if(!/\p{Script=Han}$/u.test(left.text)||! /^[。．.，,；;：:（(]/u.test(right.text))continue;
  const a=left.box.map((n,k)=>n*(k%2?height:width)),b=right.box.map((n,k)=>n*(k%2?height:width)),h=Math.min(a[3]-a[1],b[3]-b[1]),bottom=Math.max(a[3],b[3]);
  if(h<12||h>160||Math.min(a[3],b[3])-Math.max(a[1],b[1])<h*.6||Math.abs(a[3]-b[3])>h*.25||b[0]<a[2]-h*.4||b[0]>a[2]+h*3||b[2]<=a[2])continue;
  const x0=Math.max(0,Math.floor(a[2]-h*.35)),x1=Math.min(width-1,Math.ceil(Math.min(b[2],b[0]+h*3))),y0=Math.max(0,Math.floor(bottom-h*.25)),y1=Math.min(height-1,Math.ceil(bottom+h*.1));
  if(x1<x0||y1<y0)continue;remainingPixels-=(x1-x0+1)*(y1-y0+1);if(remainingPixels<0)return;
  const runs:{x:number;end:number;top:number;bottom:number}[]=[];
  for(let y=y0;y<=y1;y++){
   let start=-1;
   for(let x=x0;x<=x1+1;x++){
    if(x<=x1&&dark(x,y)){if(start<0)start=x;continue;}
    if(start<0)continue;const length=x-start;
    if(length>=h*.8&&length<=h*4&&start>x0&&x<=x1){
     const last=runs.at(-1);
     if(last&&last.bottom===y&&Math.min(last.end,x)-Math.max(last.x,start)>=Math.min(last.end-last.x,length)*.85){last.x=Math.min(last.x,start);last.end=Math.max(last.end,x);last.bottom=y+1;}
     else runs.push({x:start,end:x,top:y,bottom:y+1});
    }
    start=-1;
   }
  }
  if(runs.length!==1)continue;const rule=runs[0];
  if(rule.bottom-rule.top>h*.15||rule.top<bottom-h*.18)continue;
  const coreLeft=Math.ceil(rule.x+(rule.end-rule.x)*.2),coreRight=Math.floor(rule.end-(rule.end-rule.x)*.2),above=Math.floor(rule.top-h*.4),below=Math.ceil(rule.bottom+h*.2);
  if(above<0||below>=height)continue;
  remainingPixels-=(coreRight-coreLeft+1)*(below-above+1);if(remainingPixels<0)return;
  let clear=true;for(let x=coreLeft;x<=coreRight&&clear;x++)for(let y=above;y<=below;y++)if((y<rule.top-1||y>rule.bottom)&&dark(x,y)){clear=false;break;}
  if(clear)gaps.push({afterLine:i,box:[rule.x/width,rule.top/height,rule.end/width,rule.bottom/height]});
  if(gaps.length>16)return;
 }
 const proof:ContinuationTextProof={schemaVersion:CONTINUATION_TEXT,lines,gaps};return validContinuationTextProof(proof,text)?proof:undefined;
}

/** Reuse OCR geometry from the authenticated raster. It is never sent as a second next-page payload. */
export function continuationTextLines(extra:{image:{box:PageBox};blocks:PageBlocks;blockIds:string[]},lines:MaterialLine[]):ContinuationTextLine[]|undefined{
 if(!Array.isArray(lines)||lines.length>2000)return;
 const result:ContinuationTextLine[]=[],[x,y,right,bottom]=extra.image.box;
 for(const id of extra.blockIds){
  const block=extra.blocks.blocks.find(b=>b.id===id);if(!block)return;
  for(const line of lines){
   const points=line.normalizedQuad;
   if(!Array.isArray(points)||points.length!==4||!points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1)))return;
   const a=Math.min(...points.map(p=>p[0])),b=Math.min(...points.map(p=>p[1])),c=Math.max(...points.map(p=>p[0])),d=Math.max(...points.map(p=>p[1])),area=(c-a)*(d-b),box=block.box;
   if(area<=0||Math.max(0,Math.min(c,box[2])-Math.max(a,box[0]))*Math.max(0,Math.min(d,box[3])-Math.max(b,box[1]))/area<.6)continue;
   if(a<x||b<y||c>right||d>bottom)return;
   result.push({text:line.text.trim(),box:[(a-x)/(right-x),(b-y)/(bottom-y),(c-x)/(right-x),(d-y)/(bottom-y)] as PageBox});
  }
 }
 return result;
}

const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
/** Entire independent OCR must correspond; the model must explicitly retain every proven blank. */
export function continuationTextAgrees(text:string,proof:ContinuationTextProof,stem:string,localText:string){
 if(!validContinuationTextProof(proof,text))return false;
 const source=continuationTextSignature(text),positions=proof.gaps.map(g=>continuationTextSignature(proof.lines.slice(0,g.afterLine+1).map(l=>l.text).join('\n')).length);
 let start=0;const parts:string[]=[];
 for(const end of positions){if(end<=start||end>=source.length)return false;parts.push(escape(source.slice(start,end)));start=end;}
 parts.push(escape(source.slice(start)));
 const all=new RegExp(parts.join('_{3,64}'),'gu'),body=continuationTextSignature(stem),only=all.exec(body);
 return !!only&&only.index+only[0].length===body.length&&!all.exec(body)&&new RegExp('^'+parts.join('(?:_{3,64})?')+'$','u').test(continuationTextSignature(localText));
}
