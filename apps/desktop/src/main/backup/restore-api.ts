import {app,dialog,type IpcMainInvokeEvent} from 'electron';
import type {OmniEduStore} from '../db';
import {validBackupRestoreAction,type PreparedBackupRestore} from '../../shared/backup-restore';
import {prepareBackupRestore,verifyPreparedBackupRestore} from './restore';
import {selectedBackupRoot,selectBackupRoot} from './activation';
export function registerBackupRestore(options:{ipcMain:Pick<Electron.IpcMain,'handle'>;store:OmniEduStore;baseRoot:string;profile:string;allowed:(event:IpcMainInvokeEvent)=>boolean;job:<T>(work:(assertCurrent:()=>void)=>Promise<T>)=>Promise<T>;restart:()=>void}){
 const prepared=new Map<string,PreparedBackupRestore>(),queues=new Map<string,string[]>();
 async function choose(kind:'source'|'target'){
  if(!app.isPackaged&&process.env.OMNI_EDU_E2E_DIALOG_MODE==='1'){
   const name='OMNI_EDU_E2E_RESTORE_'+kind.toUpperCase()+'_QUEUE';let queue=queues.get(kind);
   if(!queue){const raw=JSON.parse(process.env[name]||'[]');if(!Array.isArray(raw)||raw.length>10||!raw.every(p=>typeof p==='string'&&(p===''||/^(?:[A-Za-z]:[\\/]|\/)/.test(p))))throw Error('invalid_restore_dialog_queue');queue=raw;queues.set(kind,queue!);}
   const next=queue!.shift();if(next===undefined)throw Error('restore_dialog_exhausted');return next;
  }
  const result=await dialog.showOpenDialog({title:kind==='source'?'选择要恢复的小智备份':'选择独立恢复副本的保存位置',properties:kind==='source'?['openDirectory']:['openDirectory','createDirectory']});return result.canceled?'':result.filePaths[0]||'';
 }
 const guard=(e:IpcMainInvokeEvent)=>{if(!options.allowed(e))throw Error('permission_denied');};
 options.ipcMain.handle('app:backupRestoreStatus',async event=>{guard(event);return selectedBackupRoot(options.profile,options.baseRoot);});
 options.ipcMain.handle('app:prepareBackupRestore',async event=>{guard(event);return options.job(async current=>{
  const backupPath=await choose('source');current();guard(event);if(!backupPath)return null;
  const parent=await choose('target');current();guard(event);if(!parent)return null;
  const result=await prepareBackupRestore({backupPath,parent,currentDataRoot:options.store.getDataRoot(),verify:root=>options.store.verifyDataBackup(root)});current();guard(event);prepared.set(result.id,result);return result;
 });});
 options.ipcMain.handle('app:activateBackupRestore',async(event,input)=>{guard(event);if(!validBackupRestoreAction(input))throw Error('invalid_input');return options.job(async current=>{
  let target:string;
  if(input.action==='activate'){const value=prepared.get(input.id);if(!value)throw Error('恢复副本已失效，请重新恢复');await verifyPreparedBackupRestore(value);target=value.dataRoot;}
  else{const status=await selectedBackupRoot(options.profile,options.baseRoot);if(!status.previousRoot)throw Error('没有恢复前的数据目录');target=status.previousRoot;}
  current();guard(event);await selectBackupRoot(options.profile,options.baseRoot,target,options.store.getDataRoot());
  if(app.isPackaged||process.env.OMNI_EDU_E2E_DIALOG_MODE!=='1'||process.env.OMNI_EDU_E2E_RESTORE_RELAUNCH!=='manual')setTimeout(options.restart,100);
  return{dataRoot:target,previousRoot:options.store.getDataRoot()};
 });});
}
