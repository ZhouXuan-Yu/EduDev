import {dialog,ipcMain,type BrowserWindow} from 'electron';
import type {OmniEduStore} from '../db';
import {MATERIALS_SCHEMA,materialId,validMaterialQuery,validMaterialBodyQuery,validMaterialSource} from '../../shared/materials';
import {MATERIAL_PREVIEW_SCHEMA,validMaterialPreviewQuery,validMaterialPreviewCancel,type MaterialPreviewError,type MaterialPreviewResult} from '../../shared/material-page-preview';
import {previewMaterialPage} from './material-page-preview';
import {renderLocalPdfPage} from '../xiaozhi-agent/ocr-host';
import {validMaterialTaskAction} from '../../shared/material-parse-task';
import {MATERIAL_LAYOUT_SCHEMA,validLayoutQuery,validLayoutCancel,type MaterialLayoutResult,type LayoutError} from '../../shared/material-layout';
import {MaterialLayoutCache,readMaterialLayout} from './material-layout';
import {recognizeLocalPdfLayout} from '../xiaozhi-agent/ocr-host';
import {importMaterialFolder} from './material-folder-import';
import type {MaterialFolderProgress} from '../../shared/materials';

/** Main-owned native file selection; public retry accepts an ID, never a path. */
export function registerMaterialIpc(store:OmniEduStore,window:()=>BrowserWindow|undefined){
 let active:AbortController|undefined;
 let folder:MaterialFolderProgress|undefined;
 let preview:{requestId:string;controller:AbortController}|undefined;
 let layout:{requestId:string;controller:AbortController}|undefined;
 const layoutCache=new MaterialLayoutCache(()=>store.getDataRoot());
 const allowed=(event:Electron.IpcMainInvokeEvent)=>{const main=window();return !!main&&!main.isDestroyed()&&event.sender===main.webContents&&event.senderFrame===main.webContents.mainFrame;};
 const check=(event:Electron.IpcMainInvokeEvent)=>{if(!allowed(event))throw new Error('permission_denied');};
 async function job<T>(event:Electron.IpcMainInvokeEvent,action:(signal:AbortSignal)=>Promise<T>){check(event);if(active)throw new Error('material_busy');const controller=new AbortController();active=controller;const closed=()=>controller.abort();event.sender.once('destroyed',closed);try{return await action(controller.signal);}finally{event.sender.removeListener('destroyed',closed);if(active===controller)active=undefined;}}
 ipcMain.handle('materials:list',(event,input)=>{check(event);if(!validMaterialQuery(input))throw new Error('invalid_input');return store.materials.list(input);});
 ipcMain.handle('materials:job',event=>{check(event);return {schemaVersion:MATERIALS_SCHEMA,active:!!active,...(store.materials.progress?{scan:store.materials.progress}:{}),...(folder?{folder}:{})};});
 ipcMain.handle('materials:queue',(event,resourceId)=>{check(event);if(resourceId!==undefined&&!materialId(resourceId))throw new Error('invalid_input');return store.materialQueue.snapshot(resourceId);});
 ipcMain.handle('materials:queue-action',(event,input)=>{check(event);if(!validMaterialTaskAction(input))throw new Error('invalid_input');return store.materialQueue.action(structuredClone(input));});
 ipcMain.handle('materials:body',(event,input)=>{check(event);if(!validMaterialBodyQuery(input))throw new Error('invalid_input');return store.materials.body(input);});
 ipcMain.handle('materials:source',(event,input)=>{check(event);if(!validMaterialSource(input))throw new Error('invalid_input');return store.materials.source(input);});
 ipcMain.handle('materials:page-preview',async(event,input):Promise<MaterialPreviewResult>=>{
  let owned:typeof preview;
  try{
   check(event);if(!validMaterialPreviewQuery(input))throw new Error('invalid_input');if(preview)throw new Error('busy');
   const query=structuredClone(input),controller=new AbortController();owned={requestId:query.requestId,controller};preview=owned;
   const closed=()=>controller.abort();event.sender.once('destroyed',closed);
   try{const result=await previewMaterialPage(store.materials,query,controller.signal,renderLocalPdfPage);check(event);controller.signal.throwIfAborted();return result;}
   finally{event.sender.removeListener('destroyed',closed);}
  }catch(error){const code=owned?.controller.signal.aborted?'cancelled':error instanceof Error?error.message:'';
   const known:MaterialPreviewError[]=['invalid_input','permission_denied','source_changed','missing','unsupported','too_large','configuration','empty','parse_failed','busy','timeout','cancelled','unavailable'];
   return {schemaVersion:MATERIAL_PREVIEW_SCHEMA,ok:false,error:known.includes(code as MaterialPreviewError)?code as MaterialPreviewError:['ENOENT','EACCES','EPERM'].includes(String((error as {code?:unknown})?.code))?'missing':'unavailable'};
  }finally{if(owned&&preview===owned)preview=undefined;}
 });
 ipcMain.handle('materials:page-cancel',(event,input)=>{check(event);if(!validMaterialPreviewCancel(input))throw new Error('invalid_input');const stopped=preview?.requestId===input.requestId;if(stopped)preview!.controller.abort();return {schemaVersion:MATERIAL_PREVIEW_SCHEMA,stopped};});
 ipcMain.handle('materials:page-layout',async(event,input):Promise<MaterialLayoutResult>=>{
  let owned:typeof layout;
  try{check(event);if(!validLayoutQuery(input))throw new Error('invalid_input');if(layout)throw new Error('busy');
   const query=structuredClone(input),controller=new AbortController();owned={requestId:query.requestId,controller};layout=owned;
   const closed=()=>controller.abort();event.sender.once('destroyed',closed);
   try{const result=await readMaterialLayout(store.materials,layoutCache,query,controller.signal,recognizeLocalPdfLayout);check(event);controller.signal.throwIfAborted();return result;}
   finally{event.sender.removeListener('destroyed',closed);}
  }catch(error){const code=owned?.controller.signal.aborted?'cancelled':error instanceof Error?error.message:'';
   const known:LayoutError[]=['invalid_input','permission_denied','source_changed','missing','unsupported','too_large','configuration','empty','parse_failed','busy','timeout','cancelled','unavailable','cache_invalid'];
   return {schemaVersion:MATERIAL_LAYOUT_SCHEMA,ok:false,error:known.includes(code as LayoutError)?code as LayoutError:['ENOENT','EACCES','EPERM'].includes(String((error as {code?:unknown})?.code))?'missing':'unavailable'};
  }finally{if(owned&&layout===owned)layout=undefined;}
 });
 ipcMain.handle('materials:layout-cancel',(event,input)=>{check(event);if(!validLayoutCancel(input))throw new Error('invalid_input');const stopped=layout?.requestId===input.requestId;if(stopped)layout!.controller.abort();return {schemaVersion:MATERIAL_LAYOUT_SCHEMA,stopped};});
 ipcMain.handle('materials:retry',(event,input)=>{check(event);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==2||input.schemaVersion!==MATERIALS_SCHEMA||!materialId(input.resourceId))throw new Error('invalid_input');return job(event,async signal=>({schemaVersion:MATERIALS_SCHEMA,resource:await store.materials.ingest(input.resourceId,signal)}));});
 ipcMain.handle('materials:cancel',async event=>{check(event);const pending=await store.materialQueue.snapshot();active?.abort();await store.materialQueue.cancelAll();return {schemaVersion:MATERIALS_SCHEMA,stopped:!!active||!!pending.pending||!!pending.running};});
 ipcMain.handle('materials:import-background',event=>job(event,async signal=>{
  const result=await dialog.showOpenDialog(window()!,{title:'选择教学资料',properties:['openFile','multiSelections'],filters:[{name:'教学资料',extensions:['pdf','docx','pptx','xlsx','jpg','jpeg','png','webp','bmp','md','txt']}]});
  check(event);if(result.filePaths.length>50)throw new Error('too_many_files');return store.importKnowledgeResources(result.canceled?[]:result.filePaths,signal,true);
 }));
 ipcMain.handle('materials:import-folder',event=>job(event,async signal=>{
  try{const selected=await dialog.showOpenDialog(window()!,{title:'选择教学资料文件夹（包含子文件夹）',properties:['openDirectory']});check(event);
   if(selected.canceled||!selected.filePaths[0])return {schemaVersion:'xiaozhi.material-folder.v1',status:'canceled',resources:[],items:[],overview:await store.getKnowledgeOverview(),summary:{scanned:0,imported:0,reused:0,failed:0,skipped:0}};
   if(selected.filePaths.length!==1)throw new Error('invalid_input');return await importMaterialFolder(store,selected.filePaths[0],signal,state=>{folder=state;});
  }finally{folder=undefined;}
 }));
 ipcMain.handle('knowledge:import',event=>job(event,async signal=>{
  const result=await dialog.showOpenDialog(window()!,{title:'选择教学资料',properties:['openFile','multiSelections'],filters:[{name:'教学资料',extensions:['pdf','docx','pptx','xlsx','jpg','jpeg','png','webp','bmp','md','txt']},{name:'全部文件',extensions:['*']}]});
  check(event);if(result.filePaths.length>50)throw new Error('too_many_files');return store.importKnowledgeResources(result.canceled?[]:result.filePaths,signal);
 }));
 window()?.once('closed',()=>{active?.abort();preview?.controller.abort();layout?.controller.abort();});
}
