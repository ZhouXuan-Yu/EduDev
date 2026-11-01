import fs from 'node:fs';
import {withMaterialPageBlocks} from './material-page-blocks';
import {pageBlockTexts} from '../../shared/material-ai-page-fragments';
import {ocrRuntimeRoot,recognizeLocalPageBlocks} from '../xiaozhi-agent/ocr-host';
import {validBookMatchQuery} from '../../shared/question-book-answer';
import {ipcMain as electronIpcMain,safeStorage,type BrowserWindow} from 'electron';
import {inspectPageCrop} from './material-ai-crop-inspector';
import {randomUUID,createHash} from 'node:crypto';
import {createModelSettings} from '../xiaozhi-agent/model-settings';
import type {OmniEduStore} from '../db';
import {materialId} from '../../shared/materials';
import {MATERIAL_PREVIEW_SCHEMA} from '../../shared/material-page-preview';
import {MODEL_IMAGE_SCHEMA} from '../../shared/xiaozhi-public-images';
import {preparePublicModelImage} from '../xiaozhi-agent/image-host';
import {previewMaterialPage} from './material-page-preview';
import {renderLocalPdfPage,recognizeLocalImage} from '../xiaozhi-agent/ocr-host';
import {LOCAL_OCR_ENGINE} from '../../shared/xiaozhi-ocr';
import {renderPdfFilePage,layoutPdfFile} from '../xiaozhi-agent/pdf-file-host';
import {recognizeLocalPdfLayout} from '../xiaozhi-agent/ocr-host';
import {MaterialLayoutCache,readMaterialLayout} from './material-layout';
import {MATERIAL_LAYOUT_SCHEMA} from '../../shared/material-layout';
import {proposeLocalPageRegions} from '../../shared/material-ai-layout-regions';
import {createStudentContextSanitizer} from '../students/context-sanitizer';
import {validAiAction,validAiBatch,validAiSettings} from '../../shared/material-ai';
import {validNativeQuestionImageQuery,validNativeQuestionOriginQuery} from '../../shared/native-question-image';
import {validAiPageQuery} from '../../shared/material-ai-page';
import {validMaterialBookPairInput} from '../../shared/material-book-pair';

export function registerMaterialAiIpc(store:OmniEduStore,window:()=>BrowserWindow|undefined,ipcMain:Pick<Electron.IpcMain,'handle'>=electronIpcMain){
  const codec={available:()=>safeStorage.isEncryptionAvailable(),seal:(key:string)=>safeStorage.encryptString(key).toString('base64'),open:(value:string)=>safeStorage.decryptString(Buffer.from(value,'base64')).toString()};
  const shared=createModelSettings({store,root:store.getDataRoot(),codec,busy:()=>false});
  const layoutCache=new MaterialLayoutCache(()=>store.getDataRoot());
  store.materialAi.configure({
    account:async()=>{const saved=await store.xiaozhiState.modelSettings.configuration(),current=await shared.runtime();return{revision:parseInt(createHash('sha256').update(JSON.stringify([saved.revision,current.apiKey||'',current.model])).digest('hex').slice(0,12),16)+1,model:'deepseek-flash' as const,apiKey:current.apiKey||''};},
    codec:{available:()=>safeStorage.isEncryptionAvailable(),seal:key=>safeStorage.encryptString(key).toString('base64'),open:value=>safeStorage.decryptString(Buffer.from(value,'base64'))},
    clean:async text=>(await createStudentContextSanitizer(store))(text),
    word:{environment:async()=>{const m=await import('./word-question-render');return m.wordProofEnvironment();},render:async(source,images,signal,dataRoot)=>{const m=await import('./word-question-render');return m.renderWordQuestionProof(source,images,{dataRoot,signal});}},
    ocr:async(bytes,signal)=>{try{const result=await recognizeLocalImage(bytes,signal);return {text:result.text,engine:result.engine};}catch(error){if(error instanceof Error&&error.message==='empty')return{text:'',engine:LOCAL_OCR_ENGINE};if(signal.aborted)throw Error('cancelled');throw Error(error instanceof Error&&error.message==='configuration'?'ocr_unavailable':'ocr_failed');}},
    crop:(source,box,signal)=>previewMaterialPage(store.materials,{schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:randomUUID(),resourceId:source.resourceId,version:source.version,page:source.page,box},signal,renderLocalPdfPage,renderPdfFilePage),
    inspectCrop:inspectPageCrop,
    blocks:async(source,signal)=>{
      if(!fs.existsSync(ocrRuntimeRoot(true)))return;
      const result=await readMaterialLayout(store.materials,layoutCache,{schemaVersion:MATERIAL_LAYOUT_SCHEMA,requestId:randomUUID(),resourceId:source.resourceId,version:source.version,page:source.page,refresh:false},signal,recognizeLocalPdfLayout,layoutPdfFile);
      const blocks=(await withMaterialPageBlocks(store.materials,store.getDataRoot(),result,false,signal,recognizeLocalPageBlocks)).pageBlocks!.receipt;
      return {blocks,blockTexts:pageBlockTexts(blocks,result.layout)};
    },
    layout:async(source,signal)=>{
      const result=await readMaterialLayout(store.materials,layoutCache,{schemaVersion:MATERIAL_LAYOUT_SCHEMA,requestId:randomUUID(),resourceId:source.resourceId,version:source.version,page:source.page,refresh:false},signal,recognizeLocalPdfLayout,layoutPdfFile);
      return proposeLocalPageRegions(result.layout);
    },
    image:async(id,version,page,signal)=>{
      const resource=await store.materials.resource(id);
      if(resource.contentHash!==version)throw new Error('source_changed');
      if(/\.pdf$/i.test(resource.originalFileName)){
        if(!page)throw new Error('source_incomplete');
        const result=await previewMaterialPage(store.materials,{schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:randomUUID(),resourceId:id,version,page,box:[0,0,1,1]},signal,renderLocalPdfPage,renderPdfFilePage);
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
  const safe=<T>(action:()=>Promise<T>)=>action().catch(error=>{const code=error instanceof Error?error.message:'';throw new Error(['unified_settings','invalid_input','configuration','storage_unavailable','conflict','source_changed','source_incomplete','unit_too_large','privacy_blocked','page_restoration_disabled','unsupported','budget_exhausted','book_writeback_disabled'].includes(code)?code:'unavailable');});
  ipcMain.handle('materials:book-pair-get',(event,id)=>{check(event);if(!materialId(id))throw Error('invalid_input');return safe(()=>store.materialAi.books.view(id));});
  ipcMain.handle('materials:book-pair-set',(event,input)=>{check(event);if(!validMaterialBookPairInput(input))throw Error('invalid_input');return store.materialAi.books.change(structuredClone(input)).catch(error=>{const code=error instanceof Error?error.message:'';throw Error(['invalid_input','source_changed','conflict','unsupported','answer_already_processed'].includes(code)?code:'unavailable');});});
  ipcMain.handle('materials:book-matches',(event,input)=>{check(event);if(!validBookMatchQuery(input))throw Error('invalid_input');return safe(()=>store.materialAi.bookAnswers.list(structuredClone(input)));});
  ipcMain.handle('materials:book-match',async(event,input)=>{check(event);if(!validBookMatchQuery(input))throw Error('invalid_input');const controller=new AbortController(),closed=()=>controller.abort();event.sender.once('destroyed',closed);try{return await safe(async()=>{const result=await store.materialAi.bookAnswers.match(structuredClone(input),controller.signal);check(event);return result;});}finally{event.sender.removeListener('destroyed',closed);}});
  ipcMain.handle('materials:ai-settings',event=>{check(event);return safe(()=>store.materialAi.settings());});
  ipcMain.handle('materials:ai-save-settings',(event,input)=>{check(event);if(!validAiSettings(input))throw new Error('invalid_input');return safe(()=>store.materialAi.saveSettings(structuredClone(input)));});
  ipcMain.handle('materials:ai-list',(event,id,offset=0)=>{check(event);if(!materialId(id)||!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw new Error('invalid_input');return safe(()=>store.materialAi.list(id,offset));});
  ipcMain.handle('materials:ai-page',(event,input)=>{check(event);if(!validAiPageQuery(input))throw Error('invalid_input');return safe(async()=>{const result=await store.materialAi.page(structuredClone(input));check(event);return result;});});
  ipcMain.handle('materials:ai-create',(event,input)=>{check(event);if(!validAiBatch(input))throw new Error('invalid_input');return safe(()=>store.materialAi.create(structuredClone(input)));});
  ipcMain.handle('materials:ai-action',(event,input)=>{check(event);if(!validAiAction(input))throw new Error('invalid_input');return safe(()=>store.materialAi.action(structuredClone(input)));});
  ipcMain.handle('questions:native-image',async(event,input)=>{check(event);if(!validNativeQuestionImageQuery(input))throw Error('invalid_input');const controller=new AbortController(),closed=()=>controller.abort();event.sender.once('destroyed',closed);try{return await safe(async()=>{const images=await store.nativeQuestions.officeImages(input.questionId,input.version,'teacher',controller.signal),image=images.filter(p=>p.role===input.role)[input.index];if(!image)throw Error('source_changed');check(event);return{figure:image.figure,dataUrl:'data:image/png;base64,'+image.bytes.toString('base64')};});}finally{event.sender.removeListener('destroyed',closed);}});
  ipcMain.handle('questions:native-original',async(event,input)=>{check(event);if(!validNativeQuestionOriginQuery(input))throw Error('invalid_input');return safe(async()=>{const stem=await store.nativeQuestions.originalStem(input.questionId,input.version,new AbortController().signal);check(event);return{stem};});});
}
