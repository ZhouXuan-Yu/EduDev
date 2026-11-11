import {WORD_PARSER,WORD_LEGACY_PARSER,WORD_BOOKLET_QUESTION_POLICY,type WordDocument,type WordBlock} from '../../shared/material-word';

export const WORD_UPGRADE_INDEX='idx_material_word_booklet_v3';
export const WORD_UPGRADE_PREDICATE=`parser IN ('${WORD_LEGACY_PARSER}','${WORD_PARSER}') AND
 CASE WHEN json_valid(document_json) THEN COALESCE(json_extract(document_json,'$.questionPolicy'),'') ELSE '' END<>'${WORD_BOOKLET_QUESTION_POLICY}'`;
export const WORD_UPGRADE_INDEX_SQL=`CREATE INDEX IF NOT EXISTS ${WORD_UPGRADE_INDEX} ON material_word_documents(resource_id,version) WHERE ${WORD_UPGRADE_PREDICATE}`;

function contentBlock(block:WordBlock):unknown{
 const {warnings:_,...content}=block;
 if(content.kind==='paragraph')return content;
 return {...content,rows:content.rows.map(row=>({...row,cells:row.cells.map(cell=>({...cell,blocks:cell.blocks.map(contentBlock)}))}))};
}

/** Keep every original anchor, inline, number, role marker and image identity.
 * Only warning evidence changes. The existing deterministic range index therefore
 * retains the same owned question/answer selections, including oversized entries.
 */
export function wordUpgradeCompatible(previous:WordDocument,next:WordDocument):boolean{
 return JSON.stringify(previous.assets)===JSON.stringify(next.assets)
  &&JSON.stringify(previous.blocks.map(contentBlock))===JSON.stringify(next.blocks.map(contentBlock));
}
