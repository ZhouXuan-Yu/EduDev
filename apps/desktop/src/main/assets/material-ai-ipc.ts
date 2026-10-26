import {ipcMain as electronIpcMain,safeStorage,type BrowserWindow} from 'electron';
import {randomUUID} from 'node:crypto';
import type {OmniEduStore} from '../db';
import {materialId} from '../../shared/materials';
import {MATERIAL_PREVIEW_SCHEMA} from '../../shared/material-page-preview';
import {MODEL_IMAGE_SCHEMA} from '../../shared/xiaozhi-public-images';
import {preparePublicModelImage} from '../xiaozhi-agent/image-host';
import {previewMaterialPage} from './material-page-preview';
import {renderLocalPdfPage} from '../xiaozhi-agent/ocr-host';
import {previewPdfFile} from '../xiaozhi-agent/pdf-file-host';
import {createStudentContextSanitizer} from '../students/context-sanitizer';
import {validAiAction,validAiBatch,validAiSettings} from '../../shared/material-ai';

export function registerMaterialAiIpc(store:OmniEduStore,window:()=>BrowserWindow|undefined,ipcMain:Pick<Electron.IpcMain,'handle'>=electronIpcMain){
  store.materialAi.configure({
    codec:{available:()=>safeStorage.isEncryptionAvailable(),seal:key=>safeStorage.encryptString(key).toString('base64'),open:value=>safeStorage.decryptString(Buffer.from(value,'base64'))},
    clean:async text=>(await createStudentContextSanitizer(store))(text),
    image:async(id,version,page,signal)=>{
      const resource=await store.materials.resource(id);
      if(resource.contentHash!==version)throw new Error('source_changed');
      if(/\.pdf$/i.test(resource.originalFileName)){
        if(!page)throw new Error('source_incomplete');
        const result=await previewMaterialPage(store.materials,{schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:randomUUID(),resourceId:id,version,page,box:[0,0,1,1]},signal,renderLocalPdfPage,(r,i,s)=>previewPdfFile(r,i.page,i.box,s));
        return {data:result.dataUrl.split(',')[1],mime:'image/png'};
      }
      const suffix=resource.originalFileName.split('.').pop()?.toLowerCase(),mime=suffix==='png'?'image/png':suffix==='webp'?'image/webp':'image/jpeg';
      if(!['png','webp','jpg','jpeg'].includes(suffix||''))throw new Error('unsupported');
      const bytes=await store.materials.original(id,version,signal);
      const result=await preparePublicModelImage({schemaVersion:MODEL_IMAGE_SCHEMA,requestId:'xiimage_'+randomUUID(),bytes,mime},signal);
      if(!result.ok)throw new Error(result.error);
      return {data:result.data.image.data,mime:result.data.image.mimeType};
    }
  });
  const check=(event:Electron.IpcMainInvokeEvent)=>{const w=window();if(!w||w.isDestroyed()||event.sender!==w.webContents||event.senderFrame!==w.webContents.mainFrame)throw new Error('permission_denied');};
  const safe=<T>(action:()=>Promise<T>)=>action().catch(error=>{const code=error instanceof Error?error.message:'';throw new Error(['invalid_input','configuration','storage_unavailable','conflict','source_changed','source_incomplete','unit_too_large','privacy_blocked','unsupported','budget_exhausted'].includes(code)?code:'unavailable');});
  ipcMain.handle('materials:ai-settings',event=>{check(event);return safe(()=>store.materialAi.settings());});
  ipcMain.handle('materials:ai-save-settings',(event,input)=>{check(event);if(!validAiSettings(input))throw new Error('invalid_input');return safe(()=>store.materialAi.saveSettings(structuredClone(input)));});
  ipcMain.handle('materials:ai-list',(event,id,offset=0)=>{check(event);if(!materialId(id)||!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw new Error('invalid_input');return safe(()=>store.materialAi.list(id,offset));});
  ipcMain.handle('materials:ai-create',(event,input)=>{check(event);if(!validAiBatch(input))throw new Error('invalid_input');return safe(()=>store.materialAi.create(structuredClone(input)));});
  ipcMain.handle('materials:ai-action',(event,input)=>{check(event);if(!validAiAction(input))throw new Error('invalid_input');return safe(()=>store.materialAi.action(structuredClone(input)));});
}
