import type {IpcMain,BrowserWindow,IpcMainInvokeEvent} from 'electron';
import type {OmniEduStore} from '../db';
import {randomUUID} from 'node:crypto';
import {validWordQuery,validWordImageQuery,validWordRebuild,type WordRebuildView} from '../../shared/material-word';
import {validWordQuestionQuery} from '../../shared/material-word-question';
import {validWordProofInput,validWordProofImageQuery,validWordProofCancel} from '../../shared/material-word-proof';
import type {WordProofRuntime} from './word-question-proof-repository';
/** All handlers use the application's admission/drain owner. Paths stay private. */
export function registerMaterialWordIpc(ipc:IpcMain,store:OmniEduStore,window:()=>BrowserWindow|undefined,injectedProofRuntime?:WordProofRuntime){
 const active=new Map<string,{version:string;controller:AbortController}>(),states=new Map<string,WordRebuildView>();
 const proofs=new Map<string,{controller:AbortController;sender:IpcMainInvokeEvent['sender']}>();let proofRuntime=injectedProofRuntime;
 const runtime=async()=>{if(proofRuntime)return proofRuntime;const module=await import('./word-question-render');proofRuntime={environment:module.wordProofEnvironment,render:(source,images,signal,dataRoot)=>module.renderWordQuestionProof(source,images,{dataRoot,signal})};return proofRuntime;};
 const safeProof=<T>(action:()=>Promise<T>)=>action().catch(error=>{const code=error instanceof Error?error.message:'';throw Error(['invalid_input','permission_denied','busy','cancelled','timeout','source_changed','source_incomplete','too_large','font_unavailable','font_missing_glyph','configuration','disk_full','generation_failed','cache_unavailable'].includes(code)?code:'unavailable');});
 const publish=(view:WordRebuildView)=>{const key=view.resourceId+view.version;states.delete(key);states.set(key,view);if(states.size>64)states.delete(states.keys().next().value!);};
 const check=(event:IpcMainInvokeEvent)=>{const w=window();if(!w||w.isDestroyed()||event.sender!==w.webContents||event.senderFrame!==w.webContents.mainFrame)throw Error('permission_denied');};
 ipc.handle('materials:word-source',async(event,input)=>{check(event);if(!validWordQuery(input))throw Error('invalid_input');const view=await store.materialWord.page(input);check(event);return view;});
 ipc.handle('materials:word-questions',async(event,input)=>{check(event);if(!validWordQuestionQuery(input))throw Error('invalid_input');const view=await store.materialWord.questions(input);check(event);return view;});
 ipc.handle('materials:word-proof-create',async(event,input)=>{
  check(event);if(!validWordProofInput(input))throw Error('invalid_input');if(proofs.size)throw Error('busy');
  const controller=new AbortController(),closed=()=>controller.abort();proofs.set(input.requestId,{controller,sender:event.sender});event.sender.once('destroyed',closed);
  try{return await safeProof(async()=>{const view=await store.materialWord.proofs.create(structuredClone(input),await runtime(),controller.signal);check(event);return view;});}
  finally{event.sender.removeListener('destroyed',closed);proofs.delete(input.requestId);}
 });
 ipc.handle('materials:word-proof-cancel',async(event,input)=>{check(event);if(!validWordProofCancel(input))throw Error('invalid_input');const work=proofs.get(input.requestId),cancelled=!!work&&work.sender===event.sender;if(cancelled)work.controller.abort();return {cancelled};});
 ipc.handle('materials:word-proof-image',async(event,input)=>{
  check(event);if(!validWordProofImageQuery(input))throw Error('invalid_input');const controller=new AbortController(),closed=()=>controller.abort();event.sender.once('destroyed',closed);
  try{return await safeProof(async()=>{const view=await store.materialWord.proofs.image(structuredClone(input),controller.signal);check(event);return view;});}finally{event.sender.removeListener('destroyed',closed);}
 });
 ipc.handle('materials:word-image',async(event,input)=>{check(event);if(!validWordImageQuery(input))throw Error('invalid_input');const view=await store.materialWord.image(input);check(event);return view;});
 ipc.handle('materials:word-job',(event,input)=>{check(event);if(!validWordRebuild(input))throw Error('invalid_input');return states.get(input.resourceId+input.version)||{...input,jobId:'',status:'idle',error:''} satisfies WordRebuildView;});
 ipc.handle('materials:word-rebuild',async(event,input)=>{check(event);if(!validWordRebuild(input))throw Error('invalid_input');if(active.size)throw Error('material_busy');const key=input.resourceId,controller=new AbortController(),closed=()=>controller.abort(),view:WordRebuildView={...input,jobId:'word_'+randomUUID(),status:'running',error:''};active.set(key,{version:input.version,controller});publish(view);event.sender.once('destroyed',closed);try{const resource=await store.rebuildMaterialWord(input.resourceId,input.version,controller.signal);publish({...view,status:'complete'});return resource;}catch(error){const code=error instanceof Error?error.message:'';publish({...view,status:controller.signal.aborted||code==='cancelled'?'cancelled':'failed',error:['source_changed','material_busy','too_large','empty','timeout','unavailable','disk_full','busy'].includes(code)?code:'parse_failed'});throw error;}finally{event.sender.removeListener('destroyed',closed);active.delete(key);}});
 ipc.handle('materials:word-cancel',(event,input)=>{check(event);if(!validWordRebuild(input))throw Error('invalid_input');const work=active.get(input.resourceId),cancelled=!!work&&work.version===input.version;if(cancelled)work.controller.abort();return {cancelled};});
}
