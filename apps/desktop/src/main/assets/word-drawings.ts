import {createHash} from 'node:crypto';
import {imageSize} from 'image-size';
import {WORD_IMAGES,validWordDocument,type WordPayload,type WordBlock} from '../../shared/material-word';
import {WORD_DRAWING_POLICY,validWordDrawingReceipt,type WordDrawingRequest,type WordDrawingReceipt} from '../../shared/material-word-drawing';

const sha=(data:Uint8Array|string)=>createHash('sha256').update(data).digest('hex');
type Render=(bytes:Uint8Array,requests:WordDrawingRequest[],signal:AbortSignal)=>Promise<WordDrawingReceipt>;
export async function completeWordDrawings(payload:WordPayload,bytes:Uint8Array,signal:AbortSignal,render:Render):Promise<WordPayload>{
 const pending=payload.drawings||[];if(!pending.length)return payload;
 signal.throwIfAborted();
 for(const item of pending)if(sha(item.xml)!==item.sha256)throw Error('source_changed');
 const receipt=await render(bytes,pending,signal);signal.throwIfAborted();
 if(!validWordDrawingReceipt(receipt)||receipt.sourceSha256!==sha(bytes)||receipt.items.length!==pending.length)throw Error('source_changed');
 const result:WordPayload={document:structuredClone(payload.document),images:payload.images.slice(),...(payload.metafiles?{metafiles:payload.metafiles}:{})};
 const converted=new Map(receipt.items.map((item,index)=>{
  if(item.inputSha256!==pending[index].sha256)throw Error('source_changed');return [item.inputSha256,item];
 }));
 let total=result.document.assets.reduce((sum,item)=>sum+item.bytes,0);
 for(const item of receipt.items){
  if(!item.ok)continue;
  const png=Buffer.from(item.png,'base64'),size=imageSize(png);
  if(png.toString('base64')!==item.png||sha(png)!==item.sha256||size.type!=='png'||size.width!==item.width||size.height!==item.height)throw Error('parse_failed');
  if(result.document.assets.some(asset=>asset.sha256===item.sha256))continue;
  if(result.document.assets.length>=512||(total+=png.length)>WORD_IMAGES)throw Error('too_large');
  result.document.assets.push({id:'wa_'+item.sha256,sha256:item.sha256,mime:'image/png',bytes:png.length,width:item.width,height:item.height,part:'word/document.xml'});
  result.images.push({id:'wa_'+item.sha256,data:png});
 }
 let floatingLayout=false;
 function complete(blocks:WordBlock[]):boolean{
  let unresolved=false;
  for(const block of blocks){
   let local=false,floating=false;
   if(block.kind==='table')for(const row of block.rows)for(const cell of row.cells)local=complete(cell.blocks)||local;
   else for(const inline of block.inlines){
    if(inline.kind!=='image'||!inline.drawing)continue;
    const request=pending.find(item=>item.sha256===inline.drawing!.sha256),item=converted.get(inline.drawing.sha256);
    if(!request||!item||request.path!==inline.drawing.path||request.name!==inline.drawing.name||request.part!==inline.part||request.placement!==inline.drawing.placement)throw Error('source_changed');
    if(item.ok){inline.assetId='wa_'+item.sha256;inline.issue='';floating ||= request.placement==='floating';}else{inline.issue='drawing_'+item.error;local=true;}
   }
   if(!local&&block.warnings)block.warnings=block.warnings.filter(warning=>warning!=='drawing_render_required');
   if(floating){block.warnings=[...new Set([...(block.warnings||[]),'drawing_float_layout'])];floatingLayout=true;}
   unresolved ||= local;
  }
  return unresolved;
 }
 if(!complete(result.document.blocks))result.document.warnings=result.document.warnings.filter(warning=>warning!=='drawing_render_required');
 if(floatingLayout)result.document.warnings=[...new Set([...result.document.warnings,'drawing_float_layout'])];
 result.document.drawingPolicy=WORD_DRAWING_POLICY;
 if(!validWordDocument(result.document))throw Error('parse_failed');signal.throwIfAborted();return result;
}
