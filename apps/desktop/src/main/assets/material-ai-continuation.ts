import {PAGE_CONTINUATION,PAGE_CONTINUATION_TEXT,continuationPrefix,pageContinuation,validPageContinuation,type PageContinuation,type ContinuationScope} from '../../shared/material-ai-continuation';
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
export async function preparePageContinuation(host:Host,input:AiBatchInput,source:MaterialPageSource,text:string,current:FragmentPageSource,next:FragmentPageSource,render:PageCropRenderer,raster:(source:MaterialPageSource,signal:AbortSignal)=>Promise<{data:string;mime:string}>,scope:ContinuationScope,signal:AbortSignal,inspectText?:ContinuationTextInspector):Promise<PageContinuation|undefined>{
 signal.throwIfAborted();const following=await readAiPageSource(host,input.resourceId,input.version,source.page+1);
 if(following.status!=='complete'||following.source.generation!==source.generation)return;
 const plan=continuationPrefix(text,current.blockTexts,following.text,next.blocks,next.blockTexts);if(!plan)return;
 if(!host.root)throw Error('storage_unavailable');
 const original=await raster(following.source,signal),bytes=Buffer.from(original.data,'base64');
 if(original.mime!=='image/png'||!bytes.length||bytes.length>4*1048576||bytes.toString('base64')!==original.data||createHash('sha256').update(bytes).digest('hex')!==next.blocks.rasterSha256)throw Error('source_changed');
 const {dataUrl,...raw}=await render(following.source,plan.box,signal),image=checkedPageCropImage(raw,following.source,plan.box);
 let value:PageContinuation={schemaVersion:PAGE_CONTINUATION,number:plan.number,nextNumber:plan.nextNumber,source:following.source,blocks:next.blocks,blockTexts:next.blockTexts,blockIds:plan.blockIds,text:plan.text,image,scope};
 const prefixBytes=Buffer.from(dataUrl.split(',')[1]||'','base64');
 await new QuestionAssets(host.root).put(image,prefixBytes,true,signal);
 if(inspectText&&next.lines){const textProof=await inspectText(value,next.lines,prefixBytes,signal);if(textProof)value={...value,schemaVersion:PAGE_CONTINUATION_TEXT,textProof};}
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
  if(!(await host.all("SELECT 1 FROM material_import_entries WHERE batch_id=? AND kind='file' AND status='saved' AND resource_id=? LIMIT 1",[scope.folderId,config.resourceId])).length)throw Error('source_changed');
 }
 const current=await validateAiPageSource(host,extra.source),plan=continuationPrefix(unit.text,prompt.blockTexts,current.text,extra.blocks,extra.blockTexts);
 if(!plan||plan.number!==extra.number||plan.nextNumber!==extra.nextNumber||plan.text!==extra.text||JSON.stringify(plan.blockIds)!==JSON.stringify(extra.blockIds)||JSON.stringify(plan.box)!==JSON.stringify(extra.image.box))throw Error('source_changed');
 const signal=new AbortController().signal,bytes=await new QuestionAssets(host.root).read(extra.image,true,signal);
 if(extra.schemaVersion===PAGE_CONTINUATION_TEXT&&(!inspectText||JSON.stringify(await inspectText(extra,undefined,bytes,signal))!==JSON.stringify(extra.textProof)))throw Error('source_changed');
}
