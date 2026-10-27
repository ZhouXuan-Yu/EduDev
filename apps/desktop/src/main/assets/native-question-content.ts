import {createHash} from 'node:crypto';
import {validWordQuestionSource,wordQuestionBlocks,type WordQuestionSource,type WordQuestionRole} from '../../shared/material-word-question';
import type {WordBlock} from '../../shared/material-word';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const nativeTextContentDigest=(text:string)=>hash(['native-role-text.v1',text]);
/** Semantic source bytes, not a font/engine screenshot or a source path. No mathematical normalization. */
export function wordRoleContentDigest(source:WordQuestionSource,role:WordQuestionRole){
 if(!validWordQuestionSource(source))throw Error('source_changed');
 const blocks=(values:WordBlock[]):unknown[]=>values.map(b=>b.kind==='table'?['table',b.rows.map(r=>r.cells.map(c=>[c.colSpan,c.merge,blocks(c.blocks)]))]:['paragraph',b.numbering?.label||'',b.inlines.map(i=>{
  if(i.kind==='text')return['text',i.text];
  if(i.kind==='formula')return['formula',i.latex,i.complete];
  const asset=source.assets.find(a=>a.id===i.assetId);if(!asset||i.issue)throw Error('source_incomplete');return['image',asset.sha256,asset.mime,asset.width,asset.height];
 })]);
 return hash(['word-role-content.v1',role,blocks(wordQuestionBlocks(source,role))]);
}
