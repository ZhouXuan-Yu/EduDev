import {createHash} from 'node:crypto';
import {validWordQuestionSource,wordQuestionBlocks,type WordQuestionSource,type WordQuestionRole} from '../../shared/material-word-question';
import type {WordBlock} from '../../shared/material-word';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const nativeTextContentDigest=(text:string)=>hash(['native-role-text.v1',text]);
/** Stable text: image identity belongs to the semantic digest, never an asset UUID in the stem. */
export function nativeSourceRoleText(source:WordQuestionSource,role:WordQuestionRole){
 if(!validWordQuestionSource(source))throw Error('source_changed');
 return source.canonical[role].replace(/\[原图(?: [^\]\r\n]+)?\]/g,'[原图]');
}
export function nativeSourceRequirements(source:WordQuestionSource){
 if(!validWordQuestionSource(source))throw Error('source_changed');
 const required={formulas:false,tables:false,figures:false};
 const walk=(blocks:WordBlock[])=>{for(const b of blocks)if(b.kind==='table'){required.tables=true;for(const r of b.rows)for(const c of r.cells)walk(c.blocks);}else for(const i of b.inlines){if(i.kind==='image')required.figures=true;if(i.kind==='formula')required.formulas=true;}};
 walk(wordQuestionBlocks(source,'question'));return required;
}
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
