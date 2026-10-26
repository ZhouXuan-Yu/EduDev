import type {IpcMain,BrowserWindow,IpcMainInvokeEvent} from 'electron';
import type {OmniEduStore} from '../db';
import {validWordQuery,validWordImageQuery,validWordRebuild} from '../../shared/material-word';
/** All handlers use the application's admission/drain owner. Paths stay private. */
export function registerMaterialWordIpc(ipc:IpcMain,store:OmniEduStore,window:()=>BrowserWindow|undefined){
 const active=new Map<string,AbortController>();
 const check=(event:IpcMainInvokeEvent)=>{const w=window();if(!w||w.isDestroyed()||event.sender!==w.webContents||event.senderFrame!==w.webContents.mainFrame)throw Error('permission_denied');};
 ipc.handle('materials:word-source',async(event,input)=>{check(event);if(!validWordQuery(input))throw Error('invalid_input');const view=await store.materialWord.page(input);check(event);return view;});
 ipc.handle('materials:word-image',async(event,input)=>{check(event);if(!validWordImageQuery(input))throw Error('invalid_input');const view=await store.materialWord.image(input);check(event);return view;});
 ipc.handle('materials:word-rebuild',async(event,input)=>{check(event);if(!validWordRebuild(input))throw Error('invalid_input');if(active.size)throw Error('material_busy');const key=input.resourceId,controller=new AbortController(),closed=()=>controller.abort();active.set(key,controller);event.sender.once('destroyed',closed);try{return await store.rebuildMaterialWord(input.resourceId,input.version,controller.signal);}finally{event.sender.removeListener('destroyed',closed);active.delete(key);}});
 ipc.handle('materials:word-cancel',(event,input)=>{check(event);if(!validWordRebuild(input))throw Error('invalid_input');active.get(input.resourceId)?.abort();return {cancelled:active.has(input.resourceId)};});
}
