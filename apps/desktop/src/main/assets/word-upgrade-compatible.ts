import {WORD_PARSER,WORD_LEGACY_PARSER,WORD_PREAMBLE_QUESTION_POLICY,type WordDocument,type WordBlock} from '../../shared/material-word';
import {METAFILE_ENGINE,WORD_IMAGE_POLICY} from '../../shared/material-metafile';
import {wordQuestionPlanCompatible} from './word-question-source';

export const WORD_UPGRADE_INDEX='idx_material_word_preamble_v4';
export const WORD_UPGRADE_PREDICATE=`parser IN ('${WORD_LEGACY_PARSER}','${WORD_PARSER}') AND
 (CASE WHEN json_valid(document_json) THEN COALESCE(json_extract(document_json,'$.questionPolicy'),'') ELSE '' END<>'${WORD_PREAMBLE_QUESTION_POLICY}' OR
 CASE WHEN json_valid(document_json) THEN COALESCE(json_extract(document_json,'$.imagePolicy'),'') ELSE '' END<>'${WORD_IMAGE_POLICY}')`;
export const WORD_UPGRADE_INDEX_SQL=`CREATE INDEX IF NOT EXISTS ${WORD_UPGRADE_INDEX} ON material_word_documents(resource_id,version) WHERE ${WORD_UPGRADE_PREDICATE}`;

function contentBlock(block:WordBlock):unknown{
 const {warnings:_,...content}=block;
 if(content.kind==='paragraph')return content;
 return {...content,rows:content.rows.map(row=>({...row,cells:row.cells.map(cell=>({...cell,blocks:cell.blocks.map(contentBlock)}))}))};
}

/** Compare the original structure after undoing authenticated media completion.
 * The repository separately verifies that the source bytes still match version.
 */
export function wordUpgradeCompatible(previous:WordDocument,next:WordDocument):boolean{
 const nextAssets=new Map(next.assets.map(asset=>[asset.id,asset])),previousIds=new Set(previous.assets.map(asset=>asset.id));
 const normalized=structuredClone(next.blocks),completed=new Set<string>(),replaced=new Set<string>();
 const failed=(issue:string)=>['metafile_empty','metafile_font_missing','metafile_too_large','metafile_invalid_input','metafile_parse_failed'].includes(issue);
 function undo(oldBlocks:WordBlock[],newBlocks:WordBlock[]):boolean{
  if(oldBlocks.length!==newBlocks.length)return false;
  for(let b=0;b<oldBlocks.length;b++){
   const old=oldBlocks[b],current=newBlocks[b];
   if(old.kind==='table'&&current.kind==='table'){
    if(old.rows.length!==current.rows.length)return false;
    for(let r=0;r<old.rows.length;r++){
     if(old.rows[r].cells.length!==current.rows[r].cells.length)return false;
     for(let c=0;c<old.rows[r].cells.length;c++)if(!undo(old.rows[r].cells[c].blocks,current.rows[r].cells[c].blocks))return false;
    }
   }else if(old.kind==='paragraph'&&current.kind==='paragraph'){
    if(old.inlines.length!==current.inlines.length)return false;
    for(let i=0;i<old.inlines.length;i++){
     const before=old.inlines[i],after=current.inlines[i];
     if(before.kind!=='image'||after.kind!=='image')continue;
     const originalMissing=!before.assetId&&(before.issue==='unsupported_image'||failed(before.issue));
     if(!originalMissing&&!before.metafile)continue;
     if(after.metafile?.engine!==METAFILE_ENGINE||next.imagePolicy!==WORD_IMAGE_POLICY)continue;
     if(!/^[a-f0-9]{64}$/.test(after.metafile.sha256)||before.metafile&&before.metafile.sha256!==after.metafile.sha256)return false;
     if(after.assetId){if(!nextAssets.has(after.assetId)||after.issue)return false;completed.add(after.assetId);}
     else if(!failed(after.issue))return false;
     if(before.assetId)replaced.add(before.assetId);
     after.assetId=before.assetId;after.issue=before.issue;
     if(before.metafile)after.metafile={...before.metafile};else delete after.metafile;
    }
   }
  }
  return true;
 }
 return undo(previous.blocks,normalized)
  &&previous.assets.every(asset=>JSON.stringify(asset)===JSON.stringify(nextAssets.get(asset.id))||!nextAssets.has(asset.id)&&replaced.has(asset.id))
  &&next.assets.filter(asset=>!previousIds.has(asset.id)).every(asset=>completed.has(asset.id))
  &&JSON.stringify(previous.blocks.map(contentBlock))===JSON.stringify(normalized.map(contentBlock))
  &&(next.questionPolicy!==WORD_PREAMBLE_QUESTION_POLICY||wordQuestionPlanCompatible(previous,next));
}
