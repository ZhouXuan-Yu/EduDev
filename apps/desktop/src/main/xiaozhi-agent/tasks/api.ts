import type {IpcMain,IpcMainInvokeEvent} from 'electron';
import type {TaskApiResult} from '../../../shared/xiaozhi-task';
import type {XiaozhiStartResult} from '../../../shared/xiaozhi-agent';
export function registerTaskIpc(options:{ipcMain:IpcMain;allowed:(event:IpcMainInvokeEvent)=>boolean;host:{taskSnapshot:(raw:unknown)=>Promise<TaskApiResult>;reviewTask:(raw:unknown)=>Promise<TaskApiResult>;correctTask:(raw:unknown)=>Promise<TaskApiResult>;resumeTask:(raw:unknown)=>Promise<XiaozhiStartResult>}}){
 const fail=():TaskApiResult=>({ok:false,error:'permission_denied'});
 options.ipcMain.handle('xiaozhi:task-snapshot',(event,raw)=>options.allowed(event)?options.host.taskSnapshot(raw):fail());
 options.ipcMain.handle('xiaozhi:task-review',(event,raw)=>options.allowed(event)?options.host.reviewTask(raw):fail());
 options.ipcMain.handle('xiaozhi:task-correct',(event,raw)=>options.allowed(event)?options.host.correctTask(raw):fail());
  options.ipcMain.handle('xiaozhi:task-resume',(event,raw)=>options.allowed(event)?options.host.resumeTask(raw):{ok:false,error:'permission_denied'});
}
