import {createHash} from 'node:crypto';
import {imageSize} from 'image-size';
import {METAFILE_BATCH,METAFILE_ENGINE,METAFILE_INPUT,WORD_IMAGE_POLICY,validMetafileReceipt,type MetafileInput,type MetafileItem,type MetafileReceipt} from '../../shared/material-metafile';
import {WORD_IMAGES,validWordDocument,type WordPayload,type WordBlock,type WordMetafile} from '../../shared/material-word';

type Rasterize = (items:MetafileInput[],signal:AbortSignal)=>Promise<Extract<MetafileReceipt,{ok:true}>>;
const sha = (data:Uint8Array)=>createHash('sha256').update(data).digest('hex');

/** Only authenticated original parts can replace unsupported image placeholders. */
export async function completeWordMetafiles(payload:WordPayload,signal:AbortSignal,rasterize:Rasterize):Promise<WordPayload> {
  const pending=payload.metafiles||[];
  if(!pending.length)return payload;
  for(const media of pending){
    signal.throwIfAborted();
    if(sha(media.data)!==media.sha256)throw Error('source_changed');
  }
  const converted=new Map<string,MetafileItem>(),unique=[...new Map(pending.map(media=>[media.sha256,media])).values()];
  let offset=0;
  while(offset<unique.length){
    signal.throwIfAborted();
    const batch:WordMetafile[]=[];let bytes=0;
    while(offset<unique.length&&batch.length<METAFILE_BATCH&&bytes+unique[offset].data.length<=METAFILE_INPUT){
      const media=unique[offset++];
      bytes+=media.data.length;batch.push(media);
    }
    if(!batch.length)throw Error('too_large');
    const receipt=await rasterize(batch.map(media=>({sha256:media.sha256,data:Buffer.from(media.data).toString('base64')})),signal);
    signal.throwIfAborted();
    if(!validMetafileReceipt(receipt)||!receipt.ok||receipt.items.length!==batch.length)throw Error('parse_failed');
    for(let i=0;i<batch.length;i++){
      if(receipt.items[i].inputSha256!==batch[i].sha256)throw Error('source_changed');
      converted.set(batch[i].sha256,receipt.items[i]);
    }
  }
  const result:WordPayload={document:structuredClone(payload.document),images:payload.images.slice()};
  const sources=new Map(pending.map(media=>[media.part,media]));
  let total=result.document.assets.reduce((sum,asset)=>sum+asset.bytes,0);
  for(const [digest,item] of converted){
    if(!item.ok)continue;
    const png=Buffer.from(item.png,'base64'),dimensions=imageSize(png);
    if(png.toString('base64')!==item.png||sha(png)!==item.sha256||dimensions.type!=='png'||dimensions.width!==item.width||dimensions.height!==item.height||png.length>4*1048576)throw Error('parse_failed');
    if(!result.document.assets.some(asset=>asset.sha256===item.sha256)){
      if(result.document.assets.length>=512||(total+=png.length)>WORD_IMAGES)throw Error('too_large');
      const source=pending.find(media=>media.sha256===digest)!;
      result.document.assets.push({id:'wa_'+item.sha256,sha256:item.sha256,mime:'image/png',width:item.width,height:item.height,bytes:png.length,part:source.part});
      result.images.push({id:'wa_'+item.sha256,data:png});
    }
  }
  function complete(blocks:WordBlock[]):boolean {
    let unresolved=false;
    for(const block of blocks){
      let local=false;
      if(block.kind==='table')local=block.rows.map(row=>row.cells.map(cell=>complete(cell.blocks)).some(Boolean)).some(Boolean);
      else for(const inline of block.inlines){
        if(inline.kind!=='image')continue;
        const source=sources.get(inline.part),item=source&&converted.get(source.sha256);
        if(!inline.assetId&&inline.issue==='unsupported_image'&&source&&item){
          inline.metafile={sha256:source.sha256,engine:METAFILE_ENGINE};
          if(item.ok){inline.assetId='wa_'+item.sha256;inline.issue='';}
          else inline.issue='metafile_'+item.error;
        }
        if(inline.issue)local=true;
      }
      if(!local&&block.warnings)block.warnings=block.warnings.filter(warning=>warning!=='unsupported_image');
      unresolved ||= local;
    }
    return unresolved;
  }
  if(!complete(result.document.blocks)){
    result.document.warnings=result.document.warnings.filter(warning=>warning!=='unsupported_image');
    if(result.document.unscopedWarnings)result.document.unscopedWarnings=result.document.unscopedWarnings.filter(warning=>warning!=='unsupported_image');
  }
  result.document.imagePolicy=WORD_IMAGE_POLICY;
  if(!validWordDocument(result.document))throw Error('parse_failed');
  signal.throwIfAborted();return result;
}
