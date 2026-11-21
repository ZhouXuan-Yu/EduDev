import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {BACKUP_RESTORE_SCHEMA,type BackupRestoreStatus} from '../../shared/backup-restore';
import {readRecoveryReceipt} from './restore';
type Selection={schemaVersion:typeof BACKUP_RESTORE_SCHEMA;baseRoot:string;dataRoot:string;previousRoot:string;restoreId?:string;previousAppVersion?:string;activeAppVersion?:string};
const selectionPath=(profile:string)=>path.join(profile,'xiaozhi-data-selection.v1.json');
export class BackupRestoreVersionError extends Error {}
export async function selectedBackupRoot(profile:string,baseRoot:string,runningVersion?:string):Promise<BackupRestoreStatus>{
 const fallback={dataRoot:baseRoot};let v:Selection;
 try{const p=selectionPath(profile),s=await fs.lstat(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>16384)throw Error('数据目录选择记录无效');v=JSON.parse(await fs.readFile(p,'utf8'));}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return fallback;throw e;}
 if(!v||typeof v!=='object'||Array.isArray(v)||v.schemaVersion!==BACKUP_RESTORE_SCHEMA||typeof v.baseRoot!=='string'||typeof v.dataRoot!=='string'||typeof v.previousRoot!=='string'||!path.isAbsolute(v.baseRoot)||!path.isAbsolute(v.dataRoot)||!path.isAbsolute(v.previousRoot))throw Error('数据目录选择记录无效');
 if(path.resolve(v.baseRoot)!==path.resolve(baseRoot))return fallback; // Another launcher/data instance keeps its own root.
 if(v.activeAppVersion&&runningVersion&&runningVersion!==v.activeAppVersion){
  if(runningVersion===v.previousAppVersion&&await databaseAvailable(v.previousRoot))return {dataRoot:v.previousRoot};
  throw new BackupRestoreVersionError(`此回退副本需要小智 ${v.activeAppVersion}。请启动对应版本。`);
 }
 const receipt=v.dataRoot===baseRoot?null:await readRecoveryReceipt(v.dataRoot).catch(error=>{
  if(v.activeAppVersion)throw new BackupRestoreVersionError('回退副本记录无法读取，请检查保存位置。');
  throw error;
 });
 if(v.dataRoot!==baseRoot&&(!receipt||receipt.id!==v.restoreId)){
  if(v.activeAppVersion)throw new BackupRestoreVersionError('回退副本不存在或记录不匹配，请检查保存位置。');
  throw Error('恢复目录不存在或记录不匹配，仍使用原数据');
 }
 if(!await databaseAvailable(v.dataRoot)){
  if(v.activeAppVersion)throw new BackupRestoreVersionError('回退副本不可用，请确认它仍在保存位置。');
  throw Error('恢复数据库不可用，仍使用原数据');
 }
 const portable=receipt?.purpose==='portable'&&Number.isSafeInteger(receipt.fileCount)&&receipt.fileCount>=1
  &&Number.isSafeInteger(receipt.generatedFiles)&&receipt.generatedFiles>=0&&receipt.warnings.every(warning=>typeof warning==='string');
 return{dataRoot:v.dataRoot,previousRoot:v.previousRoot,
  ...(typeof v.previousAppVersion==='string'?{previousAppVersion:v.previousAppVersion}:{}),
  ...(portable?{portableRestore:{fileCount:receipt.fileCount,generatedFiles:receipt.generatedFiles,warnings:receipt.warnings}}:{})};
}
async function databaseAvailable(root:string){
 const db=await fs.lstat(path.join(root,'app.db')).catch(()=>null);
 return !!db&&db.isFile()&&db.nlink===1;
}
export async function selectBackupRoot(profile:string,baseRoot:string,dataRoot:string,previousRoot:string,versions?:{active:string;previous:string}){
 if(!await databaseAvailable(dataRoot))throw Error('目标数据目录不可用，未切换数据');
 const receipt=dataRoot===baseRoot?null:await readRecoveryReceipt(dataRoot);if(dataRoot!==baseRoot&&!receipt)throw Error('恢复目录尚未准备完成');
 const value:Selection={schemaVersion:BACKUP_RESTORE_SCHEMA,baseRoot,dataRoot,previousRoot,activeAppVersion:versions?.active,previousAppVersion:versions?.previous,...(receipt?{restoreId:receipt.id}:{})};
 const temporary=selectionPath(profile)+'.'+randomUUID()+'.tmp';
 await fs.writeFile(temporary,JSON.stringify(value,null,2),{encoding:'utf8',flag:'wx'});await fs.rename(temporary,selectionPath(profile));
}
