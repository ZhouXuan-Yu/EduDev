import type {IpcMain} from 'electron';
import {XIAOZHI_ATTACHMENTS_SCHEMA} from '../../shared/xiaozhi-attachments';
import type {createAttachmentCoordinator} from './attachment-coordinator';
export function registerAttachmentIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;
 attachments:ReturnType<typeof createAttachmentCoordinator>;choose:()=>Promise<string[]|undefined>}){
 const denied={ok:false,schemaVersion:XIAOZHI_ATTACHMENTS_SCHEMA,requestId:'',error:'permission_denied'};
 for(const operation of ['list','remove','preview','thumbnail','ocrReview','ocrStart','ocrDecide'] as const){
  options.ipcMain.handle(`xiaozhi:attachment-${operation}`,(event,input)=>options.allowed(event)?options.attachments[operation](input):denied);
 }
 options.ipcMain.handle('xiaozhi:attachment-choose',(event,input)=>options.allowed(event)?options.attachments.choose(input,options.choose):denied);
 options.ipcMain.handle('xiaozhi:attachment-cancel',(event,input)=>options.allowed(event)?options.attachments.cancel(input):{ok:false});
}
