import {PAGE_CONTINUATION,PAGE_CONTINUATION_TEXT,PAGE_CONTINUATION_CHOICES,PAGE_CONTINUATION_FIRST,PAGE_CONTINUATION_SENTENCE,continuationPrefix,continuationChoicePrefix,continuationFirstSubquestionPrefix,continuationSentencePrefix,pageContinuation,pageContinuationTextProof,validPageContinuation,type PageContinuation,type ContinuationScope} from '../../shared/material-ai-continuation';
import type {ContinuationTextInspector} from './material-ai-continuation-text';
import type {AiBatchInput,AiUnitInput} from '../../shared/material-ai';
import type {FragmentPageSource} from '../../shared/material-ai-page-fragments';
import type {MaterialPageSource} from '../../shared/material-ai-page';
import {readAiPageSource,validateAiPageSource} from './material-ai-page-source';
import {QuestionAssets} from './question-assets';
import {checkedPageCropImage,type PageCropRenderer} from './material-ai-page-crops';
import {createHash} from 'node:crypto';

type Host={root?:()=>string;all:(sql:string,p?:(string|number|null)[])=>Promise<Record<string,unknown>[]>};
type Task={folderId?:string;revision?:number};
export async function preparePageContinuation(host:Host,input:AiBatchInput,source:MaterialPageSource,text:string,current:FragmentPageSource,next:FragmentPageSource,render:PageCropRenderer,raster:(source:MaterialPageSource,signal:AbortSignal)=>Promise<{data:string;mime:string}>,scope:ContinuationScope,signal:AbortSignal,inspectText?:ContinuationTextInspector,lead?:'choices'|'first-subquestion'|'sentence'):Promise<PageContinuation|undefined>{
 signal.throwIfAborted();const following=await readAiPageSource(host,input.resourceId,input.version,source.page+1);
 if(following.status!=='complete'||following.source.generation!==source.generation)return;
 const choice=lead==='choices'?continuationChoicePrefix(text,current.blockTexts,following.text,next.blocks,next.blockTexts):undefined;
 const first=lead==='first-subquestion';
 const sentence=lead==='sentence'?continuationSentencePrefix(current,text,next,following.selectedText,source.page,following.totalPages):undefined;
 if(lead==='sentence'&&!sentence)return;
 const plan=sentence??(first?continuationFirstSubquestionPrefix(text,current.blockTexts,following.selectedText,next.blocks,next.blockTexts):choice??continuationPrefix(text,current.blockTexts,following.text,next.blocks,next.blockTexts));
 if(!plan)return;
 if(!host.root)throw Error('storage_unavailable');
 const original=await raster(following.source,signal),bytes=Buffer.from(original.data,'base64');
 if(original.mime!=='image/png'||!bytes.length||bytes.length>4*1048576||bytes.toString('base64')!==original.data||createHash('sha256').update(bytes).digest('hex')!==next.blocks.rasterSha256)throw Error('source_changed');
 const {dataUrl,...raw}=await render(following.source,plan.box,signal),image=checkedPageCropImage(raw,following.source,plan.box);
 const owned={number:plan.number,nextNumber:plan.nextNumber,source:following.source,blocks:next.blocks,blockTexts:next.blockTexts,blockIds:plan.blockIds,text:plan.text,image,scope};
 let value:PageContinuation=sentence?{...owned,schemaVersion:PAGE_CONTINUATION_SENTENCE,preceding:sentence.preceding}
  :{...owned,schemaVersion:first?PAGE_CONTINUATION_FIRST:choice?PAGE_CONTINUATION_CHOICES:PAGE_CONTINUATION};
 const prefixBytes=Buffer.from(dataUrl.split(',')[1]||'','base64');
 await new QuestionAssets(host.root).put(image,prefixBytes,true,signal);
 if(!choice&&inspectText&&next.lines){
  const textProof=await inspectText(value,next.lines,prefixBytes,signal);
  if(textProof)value=value.schemaVersion===PAGE_CONTINUATION_SENTENCE?{...value,textProof}:{...value,schemaVersion:first?PAGE_CONTINUATION_FIRST:PAGE_CONTINUATION_TEXT,textProof};
 }
 if(!validPageContinuation(value))throw Error('source_changed');
 return value;
}
/** Each dispatch and archived read revalidates both pages and the original authorization scope. */
export async function validatePageContinuation(host:Host,config:AiBatchInput,unit:AiUnitInput,batchId?:string,task?:Task,inspectText?:ContinuationTextInspector){
 const extra=pageContinuation(unit.pagePrompt);if(!extra)return;
 const source=unit.pageSource,prompt=unit.pagePrompt;
 if(!validPageContinuation(extra)||!source||source.schemaVersion!=='xiaozhi.material-page-source.v1'||!prompt||!('blockTexts'in prompt)||source.resourceId!==extra.source.resourceId||source.version!==extra.source.version||source.generation!==extra.source.generation||source.page+1!==extra.source.page||!host.root)throw Error('source_changed');
 if(extra.scope.kind==='selected_pages'){
  if(extra.source.page<config.start||extra.source.page>=config.start+config.count)throw Error('permission_denied');
 }else{
  const scope=extra.scope,owner=batchId?(await host.all('SELECT folder_id,folder_revision FROM material_ai_task_keys WHERE batch_id=?',[batchId]))[0]:undefined;
  if(batchId?owner?.folder_id!==scope.folderId||Number(owner?.folder_revision)!==scope.revision:task?.folderId!==scope.folderId||task.revision!==scope.revision)throw Error('permission_denied');
  if(!await folderResourceAuthorized(host,scope.folderId,config.resourceId,config.version))throw Error('source_changed');
 }
 const following=await validateAiPageSource(host,extra.source);
 let plan:ReturnType<typeof continuationPrefix>;
 if(extra.schemaVersion===PAGE_CONTINUATION_SENTENCE){
  const preceding=await validateAiPageSource(host,source);
  if(preceding.status!=='complete'||following.status!=='complete'||preceding.totalPages!==following.totalPages)throw Error('source_changed');
  const verified=continuationSentencePrefix(prompt,preceding.selectedText,extra,following.selectedText,source.page,following.totalPages);
  if(!verified||JSON.stringify(verified.preceding)!==JSON.stringify(extra.preceding))throw Error('source_changed');
  plan=verified;
 }else{
  const first=extra.schemaVersion===PAGE_CONTINUATION_FIRST;
  const planner=first?continuationFirstSubquestionPrefix:extra.schemaVersion===PAGE_CONTINUATION_CHOICES?continuationChoicePrefix:continuationPrefix;
  const precedingText=first?(await validateAiPageSource(host,source)).selectedText:unit.text;
  plan=planner(precedingText,prompt.blockTexts,first?following.selectedText:following.text,extra.blocks,extra.blockTexts);
 }
 if(!plan||plan.number!==extra.number||plan.nextNumber!==extra.nextNumber||plan.text!==extra.text||JSON.stringify(plan.blockIds)!==JSON.stringify(extra.blockIds)||JSON.stringify(plan.box)!==JSON.stringify(extra.image.box))throw Error('source_changed');
 const signal=new AbortController().signal,bytes=await new QuestionAssets(host.root).read(extra.image,true,signal);
 const proof=pageContinuationTextProof(extra);
 if(proof&&(!inspectText||JSON.stringify(await inspectText(extra,undefined,bytes,signal))!==JSON.stringify(proof)))throw Error('source_changed');
}
import {folderResourceAuthorized} from './material-folder-word-pages';
