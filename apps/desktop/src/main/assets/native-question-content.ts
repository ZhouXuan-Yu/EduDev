import {createHash} from 'node:crypto';
import {validWordQuestionSource,wordQuestionBlocks,type WordQuestionSource,type WordQuestionRole} from '../../shared/material-word-question';
import type {WordBlock} from '../../shared/material-word';
import type {QuestionProjection} from '../../shared/question-projection';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const nativeTextContentDigest=(text:string)=>hash(['native-role-text.v1',text]);
/** Stable text: image identity belongs to the semantic digest, never an asset UUID in the stem. */
export function nativeSourceRoleText(source:WordQuestionSource,role:WordQuestionRole){
 if(!validWordQuestionSource(source))throw Error('source_changed');
 return source.canonical[role].replace(/\[原图(?: [^\]\r\n]+)?\]/g,'[原图]');
}
export function nativeSourceRequirements(source:WordQuestionSource){
 if(!validWordQuestionSource(source))throw Error('source_changed');
 const skeleton=nativeSourceSkeleton(source),required={formulas:false,tables:false,figures:false,choices:skeleton.choices.length>0,subquestions:skeleton.subquestions.length>0};
 const walk=(blocks:WordBlock[])=>{for(const b of blocks)if(b.kind==='table'){required.tables=true;for(const r of b.rows)for(const c of r.cells)walk(c.blocks);}else for(const i of b.inlines){if(i.kind==='image')required.figures=true;if(i.kind==='formula')required.formulas=true;}};
 walk(wordQuestionBlocks(source,'question'));return required;
}
function nativeSourceSkeleton(source:WordQuestionSource){
 const text=source.canonical.question.normalize('NFKC');
 return{choices:[...new Set([...text.matchAll(/(?:^|\s)([A-H])[.、:：)）]/g)].map(m=>m[1]))],subquestions:[...new Set([...text.matchAll(/(?:^|\n)\s*\((\d{1,2})\)/g)].map(m=>m[1]))]};
}
export function nativeProjectionCoversSource(source:WordQuestionSource,projection:QuestionProjection){
 const required=nativeSourceRequirements(source),skeleton=nativeSourceSkeleton(source);
 for(const [field,needed]of Object.entries(required))if(needed&&projection[field as keyof typeof required].state!=='provided')return false;
 const choices=projection.choices.text.normalize('NFKC'),subquestions=projection.subquestions.text.normalize('NFKC');
 return skeleton.choices.every(k=>new RegExp('(?:^|\\s)'+k+'[.、:：)）]').test(choices))&&skeleton.subquestions.every(k=>subquestions.includes('('+k+')'));
}
/** Incomplete model claims are retained as a review candidate with explicit missing coverage. */
export function nativeCheckedProjection(source:WordQuestionSource,projection:QuestionProjection){
 const result=structuredClone(projection),required=nativeSourceRequirements(source);
 for(const [field,needed]of Object.entries(required))if(needed&&result[field as keyof typeof required].state==='not_applicable')result[field as keyof typeof required].state='missing';
 if(!nativeProjectionCoversSource(source,result)){const skeleton=nativeSourceSkeleton(source);if(skeleton.choices.length)result.choices.state='missing';if(skeleton.subquestions.length)result.subquestions.state='missing';}
 return result;
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
