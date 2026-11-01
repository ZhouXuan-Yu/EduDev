import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {BACKUP_RESTORE_SCHEMA,type BackupRestoreStatus} from '../../shared/backup-restore';
import {readRecoveryReceipt} from './restore';
type Selection={schemaVersion:typeof BACKUP_RESTORE_SCHEMA;baseRoot:string;dataRoot:string;previousRoot:string;restoreId?:string};
const selectionPath=(profile:string)=>path.join(profile,'xiaozhi-data-selection.v1.json');
export async function selectedBackupRoot(profile:string,baseRoot:string):Promise<BackupRestoreStatus>{
 const fallback={dataRoot:baseRoot};let v:Selection;
 try{const p=selectionPath(profile),s=await fs.lstat(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>16384)throw Error('数据目录选择记录无效');v=JSON.parse(await fs.readFile(p,'utf8'));}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return fallback;throw e;}
 if(!v||typeof v!=='object'||Array.isArray(v)||v.schemaVersion!==BACKUP_RESTORE_SCHEMA||typeof v.baseRoot!=='string'||typeof v.dataRoot!=='string'||typeof v.previousRoot!=='string'||!path.isAbsolute(v.baseRoot)||!path.isAbsolute(v.dataRoot)||!path.isAbsolute(v.previousRoot))throw Error('数据目录选择记录无效');
 if(path.resolve(v.baseRoot)!==path.resolve(baseRoot))return fallback; // Another launcher/data instance keeps its own root.
 if(v.dataRoot!==baseRoot){const receipt=await readRecoveryReceipt(v.dataRoot);if(!receipt||receipt.id!==v.restoreId)throw Error('恢复目录不存在或记录不匹配，仍使用原数据');}
 const s=await fs.lstat(path.join(v.dataRoot,'app.db'));if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)throw Error('恢复数据库不可用，仍使用原数据');
 return{dataRoot:v.dataRoot,previousRoot:v.previousRoot};
}
export async function selectBackupRoot(profile:string,baseRoot:string,dataRoot:string,previousRoot:string){
 const database=await fs.lstat(path.join(dataRoot,'app.db'));if(!database.isFile()||database.isSymbolicLink()||database.nlink!==1)throw Error('目标数据目录不可用，未切换数据');
 const receipt=dataRoot===baseRoot?null:await readRecoveryReceipt(dataRoot);if(dataRoot!==baseRoot&&!receipt)throw Error('恢复目录尚未准备完成');
 const value:Selection={schemaVersion:BACKUP_RESTORE_SCHEMA,baseRoot,dataRoot,previousRoot,...(receipt?{restoreId:receipt.id}:{})};
 const temporary=selectionPath(profile)+'.'+randomUUID()+'.tmp';
 await fs.writeFile(temporary,JSON.stringify(value,null,2),{encoding:'utf8',flag:'wx'});await fs.rename(temporary,selectionPath(profile));
}
