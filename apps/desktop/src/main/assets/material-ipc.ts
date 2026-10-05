import {dialog,ipcMain,type BrowserWindow} from 'electron';
import type {OmniEduStore} from '../db';
import {MATERIALS_SCHEMA,materialId,validMaterialQuery,validMaterialBodyQuery,validMaterialSource} from '../../shared/materials';

/** Main-owned native file selection; public retry accepts an ID, never a path. */
export function registerMaterialIpc(store:OmniEduStore,window:()=>BrowserWindow|undefined){
 let active:AbortController|undefined;
 const allowed=(event:Electron.IpcMainInvokeEvent)=>{const main=window();return !!main&&!main.isDestroyed()&&event.sender===main.webContents&&event.senderFrame===main.webContents.mainFrame;};
 const check=(event:Electron.IpcMainInvokeEvent)=>{if(!allowed(event))throw new Error('permission_denied');};
 async function job<T>(event:Electron.IpcMainInvokeEvent,action:(signal:AbortSignal)=>Promise<T>){check(event);if(active)throw new Error('material_busy');const controller=new AbortController();active=controller;const closed=()=>controller.abort();event.sender.once('destroyed',closed);try{return await action(controller.signal);}finally{event.sender.removeListener('destroyed',closed);if(active===controller)active=undefined;}}
 ipcMain.handle('materials:list',(event,input)=>{check(event);if(!validMaterialQuery(input))throw new Error('invalid_input');return store.materials.list(input);});
 ipcMain.handle('materials:job',event=>{check(event);return {schemaVersion:MATERIALS_SCHEMA,active:!!active};});
 ipcMain.handle('materials:body',(event,input)=>{check(event);if(!validMaterialBodyQuery(input))throw new Error('invalid_input');return store.materials.body(input);});
 ipcMain.handle('materials:source',(event,input)=>{check(event);if(!validMaterialSource(input))throw new Error('invalid_input');return store.materials.source(input);});
 ipcMain.handle('materials:retry',(event,input)=>{check(event);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==2||input.schemaVersion!==MATERIALS_SCHEMA||!materialId(input.resourceId))throw new Error('invalid_input');return job(event,async signal=>({schemaVersion:MATERIALS_SCHEMA,resource:await store.materials.ingest(input.resourceId,signal)}));});
 ipcMain.handle('materials:cancel',event=>{check(event);active?.abort();return {schemaVersion:MATERIALS_SCHEMA,stopped:!!active};});
 ipcMain.handle('knowledge:import',event=>job(event,async signal=>{
  const result=await dialog.showOpenDialog(window()!,{title:'选择教学资料',properties:['openFile','multiSelections'],filters:[{name:'教学资料',extensions:['pdf','docx','pptx','xlsx','jpg','jpeg','png','webp','bmp','md','txt']},{name:'全部文件',extensions:['*']}]});
  check(event);if(result.filePaths.length>50)throw new Error('too_many_files');return store.importKnowledgeResources(result.canceled?[]:result.filePaths,signal);
 }));
 window()?.once('closed',()=>active?.abort());
}
