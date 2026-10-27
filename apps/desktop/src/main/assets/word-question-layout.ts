import {createHash} from 'node:crypto';
import {imageSize} from 'image-size';
import {officeEscape,officeMathHtml} from '../../shared/office-math';
import type {WordBlock,WordAsset} from '../../shared/material-word';
import {WORD_QUESTION_ROLES,validWordQuestionSource,wordQuestionBlocks,type WordQuestionSource} from '../../shared/material-word-question';
import {WORD_PROOF_RENDERER,WORD_PROOF_WIDTH,WORD_PROOF_HEIGHT} from '../../shared/material-word-proof';

export const WORD_LAYOUT_VERSION=WORD_PROOF_RENDERER;
export const WORD_LAYOUT_WIDTH=WORD_PROOF_WIDTH;
export const WORD_LAYOUT_HEIGHT=WORD_PROOF_HEIGHT;
export type WordImageResource={mime:'image/png'|'image/jpeg'|'image/webp';data:Buffer};
export type WordAtomicRect={top:number;bottom:number};
export type WordPageSlice={top:number;height:number};
const sha=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');

/** Complete contiguous capture intervals. An atomic paragraph/row/merged cell is never cut. */
export function wordPageSlices(height:number,rects:readonly WordAtomicRect[]):WordPageSlice[]{
 if(!Number.isSafeInteger(height)||height<1||!Array.isArray(rects)||rects.length>4000)throw Error('invalid_input');
 if(height>WORD_LAYOUT_HEIGHT*8)throw Error('too_large');
 for(const r of rects){
  if(!r||Object.keys(r).length!==2||!Number.isSafeInteger(r.top)||!Number.isSafeInteger(r.bottom)||r.top<0||r.bottom<=r.top||r.bottom>height)throw Error('invalid_input');
  if(r.bottom-r.top>WORD_LAYOUT_HEIGHT)throw Error('too_large');
 }
 const candidates=[...new Set([...rects.map(r=>r.bottom),height])].sort((a,b)=>a-b),pages:WordPageSlice[]=[];
 let top=0;
 while(top<height){
  let cut=0;
  for(const candidate of candidates){
   if(candidate<=top)continue;if(candidate>top+WORD_LAYOUT_HEIGHT)break;
   if(!rects.some(r=>r.top<candidate&&r.bottom>candidate))cut=candidate;
  }
  if(!cut||pages.length>=8)throw Error('too_large');
  pages.push({top,height:cut-top});top=cut;
 }
 if(pages.reduce((n,p)=>n+p.height,0)!==height)throw Error('source_incomplete');
 return pages;
}

type Cell=Extract<WordBlock,{kind:'table'}>['rows'][number]['cells'][number];
type LayoutCell={cell:Cell;column:number;rowSpan:number;hidden:boolean};
function hasCellContent(cell:Cell):boolean{return cell.blocks.some(b=>b.kind==='table'||b.inlines.some(i=>i.kind!=='text'||!!i.text.trim()));}

/** Resolve vertical merges by actual column occupancy, never by cell-array index. */
function tableGrid(table:Extract<WordBlock,{kind:'table'}>):LayoutCell[][]{
 const result:LayoutCell[][]=[],previous=new Map<number,LayoutCell>();
 for(const row of table.rows){
  const current=new Map<number,LayoutCell>(),cells:LayoutCell[]=[];let column=0;
  for(const cell of row.cells){
   const value:LayoutCell={cell,column,rowSpan:1,hidden:false};
   if(cell.merge==='continue'){
    const origin=previous.get(column);
    if(!origin||origin.cell.colSpan!==cell.colSpan||hasCellContent(cell))throw Error('source_incomplete');
    origin.rowSpan++;value.hidden=true;current.set(column,origin);
   }else if(cell.merge==='restart')current.set(column,value);
   cells.push(value);column+=cell.colSpan;
  }
  previous.clear();for(const [column,cell] of current)previous.set(column,cell);result.push(cells);
 }
 return result;
}

/** Host-generated static markup only. Raw source XML/HTML, external URLs and unselected images are inert. */
export function buildWordQuestionLayout(source:WordQuestionSource,images:ReadonlyMap<string,Buffer>){
 if(!validWordQuestionSource(source))throw Error('source_changed');
 const imageResources:WordImageResource[]=[],urls=new Map<string,string>(),assets=new Map(source.assets.map(a=>[a.id,a]));
 let originalBytes=0,pixels=0,mathCount=0;
 function image(asset:WordAsset){
  let url=urls.get(asset.id);if(url)return url;
  const data=images.get(asset.id);if(!data||data.length!==asset.bytes||sha(data)!==asset.sha256)throw Error('source_changed');
  let size;try{size=imageSize(data);}catch{throw Error('source_changed');}
  const mime=({png:'image/png',jpg:'image/jpeg',webp:'image/webp'} as const)[size.type as 'png'|'jpg'|'webp'];
  if(mime!==asset.mime||size.width!==asset.width||size.height!==asset.height)throw Error('source_changed');
  originalBytes+=data.length;pixels+=asset.width*asset.height;
  if(originalBytes>64*1048576||pixels>64000000||imageResources.length>=8)throw Error('too_large');
  imageResources.push({mime:asset.mime,data:Buffer.from(data)});url='data:'+asset.mime+';base64,'+data.toString('base64');urls.set(asset.id,url);return url;
 }
 function blocks(values:WordBlock[],root=false):string{
  return values.map((b,index)=>{
   const anchor=' data-native-block="'+b.id+'"'+(root?' data-native-span="'+index+'"':'');
   if(b.kind==='table')return '<table'+anchor+'><tbody>'+tableGrid(b).map(row=>'<tr>'+row.filter(c=>!c.hidden).map(c=>'<td colspan="'+c.cell.colSpan+'" rowspan="'+c.rowSpan+'">'+blocks(c.cell.blocks)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
   return '<p'+anchor+'>'+officeEscape(b.numbering?.label||'')+b.inlines.map(i=>{
    if(i.kind==='text')return officeEscape(i.text);
    if(i.kind==='formula'){
     if(!i.complete)throw Error('source_incomplete');
     if(++mathCount>64)throw Error('too_large');
     try{return '<span class="native-formula">'+officeMathHtml('$'+i.latex+'$')+'</span>';}catch{throw Error('source_incomplete');}
    }
    const asset=assets.get(i.assetId);if(!asset||i.issue)throw Error('source_incomplete');
    return '<img data-native-width="'+asset.width+'" data-native-height="'+asset.height+'" alt="'+officeEscape(i.alt||'原文插图')+'" width="'+Math.min(asset.width,1200)+'" src="'+image(asset)+'">';
   }).join('')+'</p>';
  }).join('');
 }
 const templates=WORD_QUESTION_ROLES.map(role=>'<template id="'+role+'">'+blocks(wordQuestionBlocks(source,role),true)+'</template>').join('');
 const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\';style-src \'unsafe-inline\';img-src data:;script-src \'none\';font-src \'none\';base-uri \'none\';form-action \'none\'"><style>'+
  'html,body{margin:0;padding:0;background:white;color:#111;font:32px/1.5 SimSun,"Cambria Math",serif}#content{width:1240px;box-sizing:border-box;padding:16px;overflow-wrap:anywhere}p{white-space:pre-wrap;margin:0 0 16px}p:empty{min-height:1px}img{display:block;max-width:100%;max-height:1660px;object-fit:contain;margin:8px 0}math{font-family:"Cambria Math",SimSun,math}.native-formula{display:inline-block;vertical-align:middle;max-width:100%}table{width:100%;border-collapse:collapse;margin:0 0 16px}td{border:2px solid #666;padding:8px;vertical-align:top;min-width:64px}td p{margin-bottom:8px}</style></head><body>'+templates+'<main id="content"></main></body></html>';
 if(Buffer.byteLength(html)>4*1048576+originalBytes*1.4)throw Error('too_large');
 return {html,imageResources,sourceDigest:sha(JSON.stringify(source))};
}
