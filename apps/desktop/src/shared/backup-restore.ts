export const BACKUP_RESTORE_SCHEMA='xiaozhi.backup-restore.v1';
export type PreparedBackupRestore={schemaVersion:typeof BACKUP_RESTORE_SCHEMA;id:string;dataRoot:string;backupPath:string;fileCount:number;generatedFiles:number;warnings:string[]};
export type BackupRestoreStatus={dataRoot:string;previousRoot?:string};
export type BackupRestoreAction={schemaVersion:typeof BACKUP_RESTORE_SCHEMA;action:'activate';id:string}|{schemaVersion:typeof BACKUP_RESTORE_SCHEMA;action:'revert'};
export function validBackupRestoreAction(x:unknown):x is BackupRestoreAction {
 if(!x||typeof x!=='object'||Array.isArray(x))return false;const v=x as Record<string,unknown>;
 return v.schemaVersion===BACKUP_RESTORE_SCHEMA&&(v.action==='revert'&&Object.keys(v).length===2||v.action==='activate'&&Object.keys(v).length===3&&typeof v.id==='string'&&/^restore_[a-f0-9-]{36}$/.test(v.id));
}
