import type {AiImageQuestion} from '../../shared/material-ai-image';
import type {AiPagePrompt} from '../../shared/material-ai-page';
import type {PageFragment} from './material-ai-page-fragments';

/** NFC deliberately preserves powers, subscripts, signs, units and literal words.
 * Only prose punctuation and non-variable answer lines are presentation here. */
export function cropBodySignature(value:string):string{
 const text=value.normalize('NFC').replace(/[Ａ-Ｚａ-ｚ０-９]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0))
  .replace(/[（），；：．]/gu,c=>({'（':'(', '）':')', '，':',', '；':';', '：':':', '．':'.'}[c]!)).replace(/[“”]/gu,'"').replace(/[‘’]/gu,"'").replace(/\s/gu,'');
 const unlined=text.replace(/_{3,}/gu,(line,offset:number)=>/[A-Za-z0-9]/u.test(text[offset-1]||'')||/[0-9]/u.test(text[offset+line.length]||'')?line:'');
 // Do not erase numeric/list/function separators. Looking past quotes only is bounded.
 return unlined.replace(/[，、,；;：:。．.]/gu,(c,offset:number)=>{
  const left=unlined.slice(Math.max(0,offset-3),offset).replace(/["']/gu,'').at(-1)||'',right=unlined.slice(offset+1,offset+4).replace(/["']/gu,'')[0]||'';
  return /\p{Script=Han}/u.test(left+right)?'':c;
 });
}
/** Called only after source/crop ownership, geometry, clear edges and both drafts agree.
 * Diagram pixels stay in the document; only independent layout figure groups are
 * excluded from the BODY comparison. Mixed groups participate in full. No fuzzy OCR. */
export function cropBodyComplete(question:AiImageQuestion,fragments:PageFragment[],prompt:AiPagePrompt):boolean{
 if(prompt.policy!=='page-fragments.v3'||!fragments.length)return false;
 let first=true,body='',markerKnown=false;
 const marker=new RegExp('^(?:'+question.number+'[.、．](?![0-9])[ \\t]*|第[ \\t]*'+question.number+'[ \\t]*题[:：]?[ \\t]*)');
 for(const fragment of fragments){
  const ids=fragment.blockIds||[fragment.blockId],next=ids[0]?.startsWith('next:');
  if(!ids.length||ids.some(id=>id.startsWith('next:')!==next))return false;
  const page=next?prompt.continuation:prompt;if(!page)return false;
  const blocks=ids.map(id=>page.blocks.blocks.find(b=>b.id===(next?id.slice(5):id)));
  if(blocks.some(b=>!b))return false;
  if(question.requiresImage&&question.projection.figures.state==='provided'&&blocks.every(b=>['image','chart','figure_title'].includes(b!.kind)))continue;
  let text=fragment.quality.text;
  if(first){
   const hint=page.blockTexts.find(b=>b.blockId===blocks[0]!.id)?.text||'';markerKnown=marker.test(hint);
   if(markerKnown){text=text.replace(marker,'');const lines=text.split(/\r?\n/);if(lines.length>1&&marker.test(lines.at(-1)!.trim())&&!lines.at(-1)!.trim().replace(marker,'').trim())text=lines.slice(0,-1).join('\n');}
   first=false;
  }
  body+=text+'\n';
 }
 const expected=cropBodySignature(markerKnown?question.stem.replace(marker,''):question.stem);
 return expected.length>=8&&expected===cropBodySignature(body);
}
