import type {IpcMain,BrowserWindow,IpcMainInvokeEvent} from 'electron';
import type {OmniEduStore} from '../db';
import {randomUUID} from 'node:crypto';
import {validWordQuery,validWordImageQuery,validWordRebuild,type WordRebuildView} from '../../shared/material-word';
/** All handlers use the application's admission/drain owner. Paths stay private. */
export function registerMaterialWordIpc(ipc:IpcMain,store:OmniEduStore,window:()=>BrowserWindow|undefined){
 const active=new Map<string,{version:string;controller:AbortController}>(),states=new Map<string,WordRebuildView>();
 const publish=(view:WordRebuildView)=>{const key=view.resourceId+view.version;states.delete(key);states.set(key,view);if(states.size>64)states.delete(states.keys().next().value!);};
 const check=(event:IpcMainInvokeEvent)=>{const w=window();if(!w||w.isDestroyed()||event.sender!==w.webContents||event.senderFrame!==w.webContents.mainFrame)throw Error('permission_denied');};
 ipc.handle('materials:word-source',async(event,input)=>{check(event);if(!validWordQuery(input))throw Error('invalid_input');const view=await store.materialWord.page(input);check(event);return view;});
 ipc.handle('materials:word-image',async(event,input)=>{check(event);if(!validWordImageQuery(input))throw Error('invalid_input');const view=await store.materialWord.image(input);check(event);return view;});
 ipc.handle('materials:word-job',(event,input)=>{check(event);if(!validWordRebuild(input))throw Error('invalid_input');return states.get(input.resourceId+input.version)||{...input,jobId:'',status:'idle',error:''} satisfies WordRebuildView;});
 ipc.handle('materials:word-rebuild',async(event,input)=>{check(event);if(!validWordRebuild(input))throw Error('invalid_input');if(active.size)throw Error('material_busy');const key=input.resourceId,controller=new AbortController(),closed=()=>controller.abort(),view:WordRebuildView={...input,jobId:'word_'+randomUUID(),status:'running',error:''};active.set(key,{version:input.version,controller});publish(view);event.sender.once('destroyed',closed);try{const resource=await store.rebuildMaterialWord(input.resourceId,input.version,controller.signal);publish({...view,status:'complete'});return resource;}catch(error){const code=error instanceof Error?error.message:'';publish({...view,status:controller.signal.aborted||code==='cancelled'?'cancelled':'failed',error:['source_changed','material_busy','too_large','empty','timeout','unavailable','disk_full','busy'].includes(code)?code:'parse_failed'});throw error;}finally{event.sender.removeListener('destroyed',closed);active.delete(key);}});
 ipc.handle('materials:word-cancel',(event,input)=>{check(event);if(!validWordRebuild(input))throw Error('invalid_input');const work=active.get(input.resourceId),cancelled=!!work&&work.version===input.version;if(cancelled)work.controller.abort();return {cancelled};});
}
