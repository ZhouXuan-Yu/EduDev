import {sourceContentEnabled} from '../../shared/material-ai-source-content';
import {isFragmentPageResponse} from '../../shared/material-ai-page';
import {readingCandidateStem} from './material-ai-source-reading';
import {pageContinuation} from '../../shared/material-ai-continuation';
import {pageRegionsPolicy,MATERIAL_PAGE_REGIONS_PROMPT} from '../../shared/material-ai-page-regions';
import {extractMaterialQuestions} from './material-question-extract';
import {MATERIAL_QUESTION_PAGE_PROMPT,MATERIAL_PAGE_SOURCE,type AiPagePrompt,type AiPageResponse,type MaterialPageSource} from '../../shared/material-ai-page';
import {MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT,MATERIAL_PAGE_FRAGMENTS_RESPONSE,fragmentsMatchPage} from '../../shared/material-ai-page-fragments';
import {aiTextSignature} from '../../shared/material-ai-image';
import type {PageCrop} from './material-ai-page-crops';
import {validCropQuality} from './material-ai-crop-quality';
import {MATERIAL_OWNED_CROP_GEOMETRY} from '../../shared/material-ai-owned-crops';

/** Source-owned layout metadata stays in the raw transcript and original images. Never fold body symbols. */
export function restoredResponseQuestions(response:AiPageResponse,source:MaterialPageSource,prompt?:AiPagePrompt,crops:PageCrop[]=[]){
 if(!isFragmentPageResponse(response)||prompt?.policy!==MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT||!fragmentsMatchPage(response.fragments,prompt.blocks))return restoredPageQuestions(response.pageText,source,response.questions.map(q=>q.number),prompt);
 if(sourceContentEnabled(prompt)){
  // Global parsing still finds omitted numbers. Owned literal crops supply each
  // declared body's parser input; page furniture never enters that owned text.
  const candidates=restoredPageQuestions(response.pageText,source,response.questions.map(q=>q.number),prompt);
  for(const q of response.questions){
   if(readingCandidateStem(response,q,crops,prompt,'')===undefined)continue;
   const owned=restoredPageQuestions('第'+q.number+'题 '+q.stem,source,[q.number],prompt);
   if(owned.length!==1||owned[0].number!==q.number)continue;
   const index=candidates.findIndex(c=>c.number===q.number);if(index<0)candidates.push(owned[0]);else candidates[index]=owned[0];
  }return candidates;
 }
 const layoutLiteral=(s:string)=>s.normalize('NFC').replace(/\s/gu,''),owned=new Set(response.fragments.flatMap(f=>f.blockIds));
 const titles=new Set(prompt.blocks.blocks.filter(b=>['paragraph_title','doc_title'].includes(b.kind)&&!owned.has(b.id)).map(b=>layoutLiteral(prompt.blockTexts.find(t=>t.blockId===b.id)?.text||'')).filter(s=>/^[一二三四五六七八九十百]+[、.．]?[^\n]{1,120}[（(]\d{1,3}分[）)]$/.test(s)));
 const lines=response.pageText.split(/\r?\n/),bodyLines=[...lines],numbers=new Set(response.questions.map(q=>q.number));let next='';
 for(let i=lines.length-1;i>=0;i--){const line=lines[i];if(!line.trim())continue;
  if(titles.has(layoutLiteral(line))&&/^\s*[一二三四五六七八九十百]+(?:[、.．][ \t]*|[ \t]+)\S[^\r\n]{0,160}[（(]\d{1,3}分[）)]\s*$/.test(line)){const number=next.match(/^\s*(?:第(\d{1,5})题\s*[:：]?|(\d{1,5})[.、．](?!\d))/);if(number&&numbers.has(number[1]||number[2]))bodyLines[i]='';}next=line;
 }
 const body=bodyLines.join('\n');
 return restoredPageQuestions(body,source,response.questions.map(q=>q.number),prompt).map(candidate=>{
  const q=response.questions.find(q=>q.number===candidate.number),fragment=response.fragments.find(f=>f.number===candidate.number);
  if(q){const reading=readingCandidateStem(response,q,crops,prompt,candidate.fields.stem);if(reading!==undefined)return{...candidate,fields:{...candidate.fields,stem:reading}};}
  if(!q?.requiresImage||q.projection.figures.state!=='provided'||!fragment?.complete||aiTextSignature(candidate.fields.stem)===aiTextSignature(q.stem))return candidate;
  const captions=new Map<string,number>();
  for(const id of fragment.blockIds){if(prompt.blocks.blocks.find(b=>b.id===id)?.kind!=='figure_title')continue;
   const grouped=prompt.cropGeometryPolicy===MATERIAL_OWNED_CROP_GEOMETRY;
   const crop=crops.find(c=>c.number===candidate.number)?.fragments?.find(f=>grouped?(f.blockIds||[f.blockId]).includes(id):JSON.stringify(f.blockIds||[f.blockId])===JSON.stringify([id]));
   const local=crop&&validCropQuality(crop.quality)&&crop.quality.clearEdges.every(Boolean)?crop.quality.text:'';
   const labels=local.split(/\r?\n/).map(layoutLiteral).filter(s=>/^图\d{1,3}(?:[-–.]\d{1,3})?$/.test(s));
   const singleCaption=grouped&&crop&&(crop.blockIds||[crop.blockId]).filter(k=>prompt.blocks.blocks.find(b=>b.id===k)?.kind==='figure_title').length===1&&labels.length===1;
   const label=layoutLiteral(prompt.blockTexts.find(t=>t.blockId===id)?.text||(singleCaption?labels[0]:grouped?'':local));
   if(/^图\d{1,3}(?:[-–.]\d{1,3})?$/.test(label)&&new RegExp(label.replaceAll('.','\\.')+'(?![0-9])').test(layoutLiteral(q.projection.figures.text)))captions.set(label,(captions.get(label)||0)+1);
  }
  const stem=candidate.fields.stem.split('\n').filter(line=>{const label=layoutLiteral(line),left=captions.get(label)||0;if(!left)return true;captions.set(label,left-1);return false;}).join('\n').trim();
  return aiTextSignature(stem)===aiTextSignature(q.stem)?{...candidate,fields:{...candidate.fields,stem}}:candidate;
 });
}
/** Reuse the deterministic parser on the AI transcript. Adapter body refs never leave this function. */
export function restoredPageQuestions(text:string,source:MaterialPageSource,declaredNumbers:readonly string[]=[],prompt?:AiPagePrompt){
 // A PDF's terminal standalone page counter is layout, not the last question's condition.
 // Only new frozen inputs may use this adapter; original transcripts and legacy evidence stay unchanged.
 if((prompt?.policy===MATERIAL_QUESTION_PAGE_PROMPT||pageRegionsPolicy(prompt?.policy))&&source.schemaVersion===MATERIAL_PAGE_SOURCE&&source.page<=prompt.totalPages){
  const lines=text.split(/\r?\n/);if(pageContinuation(prompt)){text=lines.filter(line=>line.replace(/\s/gu,'')!==`第${source.page}页共${prompt.totalPages}页`).join('\n');}else if(lines.at(-1)?.replace(/\s/gu,'')===`第${source.page}页共${prompt.totalPages}页`){lines.pop();text=lines.join('\n');}
 }
 // The structured response already declares these question numbers. Change only the
 // ephemeral parser marker, preserving every original body character and raw receipt.
 // This lets the existing strict parser see MCQs/fill-ins without an interrogative cue.
 const declared=new Set(declaredNumbers.filter(n=>/^\d{1,5}$/.test(n)));
 const body=text.replace(/^([ \t]{0,3})(\d{1,5})[.、．](?!\d)[ \t]*/gm,(raw,space:string,number:string)=>declared.has(number)?space+'第'+number+'题 ':raw);
 const candidates=extractMaterialQuestions([{resourceId:source.resourceId,version:source.version,title:'原页AI还原',offset:0,chunk:{id:'chunk_'+source.generation,resourceId:source.resourceId,resourceTitle:'原页AI还原',chunkIndex:0,heading:'',contentMd:body,containsPersonalData:false,pageNumber:source.page,subject:'',grade:'',knowledgePoint:'',questionType:'',difficulty:'',sourceTrust:'machine_extracted',qualityScore:0,evidenceStrength:'background',embeddingStatus:'not_indexed',createdAt:''}}],'local-text-v1');
 return candidates.map(c=>({fields:c.fields,number:c.archive.number,risks:c.archive.sourceRisks}));
}
