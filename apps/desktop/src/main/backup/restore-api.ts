import {app,dialog,type IpcMainInvokeEvent} from 'electron';
import type {OmniEduStore} from '../db';
import {validBackupRestoreAction,type PreparedBackupRestore} from '../../shared/backup-restore';
import {prepareBackupRestore,verifyPreparedBackupRestore,verifyRestoredMemoryAuthority} from './restore';
import {inspectBackupRestore,type BackupRestorePlan} from './restore-plan';
import {selectedBackupRoot,selectBackupRoot} from './activation';
import {backupApplicationVersion} from './compatibility';
import {attachUpdateRollback,readWindowsUpdateRecord} from '../updates/windows-update-record';
import {cancelUpdateRollback,readPendingRollback,stageUpdateRollback} from '../updates/pending-rollback';
export function registerBackupRestore(options:{ipcMain:Pick<Electron.IpcMain,'handle'>;store:OmniEduStore;baseRoot:string;profile:string;allowed:(event:IpcMainInvokeEvent)=>boolean;job:<T>(work:(assertCurrent:()=>void)=>Promise<T>)=>Promise<T>;restart:()=>void}){
 const prepared=new Map<string,PreparedBackupRestore>(),queues=new Map<string,string[]>();
 let pendingPreview:{senderId:number;plan:BackupRestorePlan}|undefined;
 async function choose(kind:'source'|'target'|'update'){
  if(!app.isPackaged&&process.env.OMNI_EDU_E2E_DIALOG_MODE==='1'){
   const name='OMNI_EDU_E2E_RESTORE_'+kind.toUpperCase()+'_QUEUE';let queue=queues.get(kind);
   if(!queue){const raw=JSON.parse(process.env[name]||'[]');if(!Array.isArray(raw)||raw.length>10||!raw.every(p=>typeof p==='string'&&(p===''||/^(?:[A-Za-z]:[\\/]|\/)/.test(p))))throw Error('invalid_restore_dialog_queue');queue=raw;queues.set(kind,queue!);}
   const next=queue!.shift();if(next===undefined)throw Error('restore_dialog_exhausted');return next;
  }
  const result=await dialog.showOpenDialog(kind==='update'
    ? {title:'选择小智更新记录',properties:['openFile'],filters:[{name:'小智更新记录',extensions:['json']}]}
    : {title:kind==='source'?'选择要恢复的小智备份':'选择独立恢复副本的保存位置',properties:kind==='source'?['openDirectory']:['openDirectory','createDirectory']});
  return result.canceled?'':result.filePaths[0]||'';
 }
 const guard=(e:IpcMainInvokeEvent)=>{if(!options.allowed(e))throw Error('permission_denied');};
 const verify=(root:string)=>options.store.verifyDataBackup(root,backupApplicationVersion(app));
 async function chooseSelection(event:IpcMainInvokeEvent,current:()=>void){
  const backupPath=await choose('source');current();guard(event);if(!backupPath)return null;
  const parent=await choose('target');current();guard(event);if(!parent)return null;
  return {backupPath,parent,currentDataRoot:options.store.getDataRoot(),verify};
 }
 async function status(){
  const [active,pending]=await Promise.all([selectedBackupRoot(options.profile,options.baseRoot,backupApplicationVersion(app)),readPendingRollback(options.profile,options.baseRoot)]);
  return {...active,...(pending?{pendingRollback:pending.rollback}:{}),
    ...(active.previousAppVersion&&active.previousAppVersion!==backupApplicationVersion(app)?{returnRequiresVersion:active.previousAppVersion}:{})};
 }
 options.ipcMain.handle('app:backupRestoreStatus',async event=>{guard(event);return status();});
 options.ipcMain.handle('app:previewBackupRestore',async(event,kind:unknown)=>{guard(event);return options.job(async current=>{
  if(kind!==undefined&&kind!=='update')throw Error('invalid_input');
  pendingPreview=undefined;
  let plan:BackupRestorePlan;
  if(kind==='update'){
   const file=await choose('update');current();guard(event);if(!file)return null;
   const record=await readWindowsUpdateRecord(file,backupApplicationVersion(app));
   const parent=await choose('target');current();guard(event);if(!parent)return null;
   plan=await inspectBackupRestore({backupPath:record.backupPath,parent,currentDataRoot:options.store.getDataRoot(),verify});
   attachUpdateRollback(plan,record);
  }else{
   const selection=await chooseSelection(event,current);if(!selection)return null;
   plan=await inspectBackupRestore(selection);
  }
  current();guard(event);
  pendingPreview={senderId:event.sender.id,plan};
  return plan.preview;
 });});
 options.ipcMain.handle('app:prepareBackupRestore',async(event,id:unknown)=>{guard(event);return options.job(async current=>{
  let selection;
  if(id===undefined){
   pendingPreview=undefined;
   selection=await chooseSelection(event,current);if(!selection)return null;
  }else{
   const pending=pendingPreview;
   if(typeof id!=='string'||pending?.senderId!==event.sender.id||pending.plan.preview.id!==id)throw Error('恢复预检已失效，请重新核对');
   pendingPreview=undefined;
   const {plan}=pending;
   selection={backupPath:plan.backup,parent:plan.parent,currentDataRoot:options.store.getDataRoot(),verify,plan};
  }
  const result=await prepareBackupRestore(selection);current();guard(event);prepared.set(result.id,result);return result;
 });});
 options.ipcMain.handle('app:activateBackupRestore',async(event,input)=>{guard(event);if(!validBackupRestoreAction(input))throw Error('invalid_input');return options.job(async current=>{
  if(input.action==='cancel_rollback'){current();guard(event);await cancelUpdateRollback(options.profile,options.baseRoot);return status();}
  let target:string;
  if(input.action==='activate'){
   const value=prepared.get(input.id);if(!value)throw Error('恢复副本已失效，请重新恢复');
   await verifyRestoredMemoryAuthority(value,options.store.getDataRoot());
   current();guard(event);
   if(value.rollback){
    await stageUpdateRollback(options.profile,options.baseRoot,options.store.getDataRoot(),backupApplicationVersion(app),value,()=>{current();guard(event);});
    prepared.delete(input.id);return status();
   }
   await verifyPreparedBackupRestore(value);target=value.dataRoot;
  }else{
   const active=await status();
   if(!active.previousRoot)throw Error('没有恢复前的数据目录');
   if(active.returnRequiresVersion)throw Error(`请使用小智 ${active.returnRequiresVersion} 打开升级后的工作区。`);
   target=active.previousRoot;
  }
  if(await readPendingRollback(options.profile,options.baseRoot))throw Error('请先取消待启用的版本回退。');
  current();guard(event);await selectBackupRoot(options.profile,options.baseRoot,target,options.store.getDataRoot());
  if(app.isPackaged||process.env.OMNI_EDU_E2E_DIALOG_MODE!=='1'||process.env.OMNI_EDU_E2E_RESTORE_RELAUNCH!=='manual')setTimeout(options.restart,100);
  return{dataRoot:target,previousRoot:options.store.getDataRoot()};
 });});
}
