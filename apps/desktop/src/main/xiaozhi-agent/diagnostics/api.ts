import type {IpcMain} from 'electron';
import {app,dialog} from 'electron';
import type {OmniEduStore} from '../../db';
import {createDiagnostics} from './service';import {diagnosticReport} from './report';
export function registerDiagnosticsIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;store:OmniEduStore}){
 const service=createDiagnostics({
  read:async(sessionId,runId)=>{
   const snapshot=await options.store.xiaozhiState.eventJournal.diagnosticSnapshot(sessionId,runId);if(!snapshot||snapshot.turn.id!==runId)return null;
   let usage,usageRecord:'read'|'missing'|'unavailable'='missing';
   try{usage=await options.store.xiaozhiState.usageForRun(sessionId,runId);if(usage)usageRecord='read';}catch{usageRecord='unavailable';}
   return diagnosticReport({sessionId,runId,...snapshot,usage,usageRecord,now:Date.now(),application:{version:app.getVersion(),runtime:'xiaozhi.pi.education.v1',electron:process.versions.electron||'unknown',node:process.versions.node,platform:process.platform,arch:process.arch,packaged:app.isPackaged,sourceRevision:null}});
  },
  choose:async name=>{const chosen=await dialog.showSaveDialog({title:'保存这份小智诊断',defaultPath:name,filters:[{name:'JSON 诊断',extensions:['json']}],properties:['createDirectory','showOverwriteConfirmation']});return chosen.canceled?undefined:chosen.filePath;},
 });
 options.ipcMain.handle('xiaozhi:diagnostic-preview',(event,input)=>options.allowed(event)?service.preview(input):{ok:false,error:'permission_denied'});
 options.ipcMain.handle('xiaozhi:diagnostic-save',(event,input)=>options.allowed(event)?service.save(input):{ok:false,error:'permission_denied'});
}
