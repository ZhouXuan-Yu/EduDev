import type {WordDocument,WordBlock} from '../../shared/material-word';

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
