import type { BackupCompatibility } from './backup-compatibility';
import type {BackupContinuity} from './backup-continuity';
import type {BackupPurpose} from './backup-purpose';
import type {UpdateRollback} from './windows-update';

export const BACKUP_RESTORE_SCHEMA='xiaozhi.backup-restore.v1';
export type BackupRestorePreview = {
  id: string;
  backupPath: string;
  destination: string;
  fileCount: number;
  packageBytes: number;
  requiredBytes: number;
  availableBytes: number;
  spaceStatus: 'ready' | 'insufficient';
  purpose?: BackupPurpose;
  compatibility?: BackupCompatibility;
  continuity?: BackupContinuity;
  omittedOutputs: number;
  rollback?: UpdateRollback;
};
export type PreparedBackupRestore={schemaVersion:typeof BACKUP_RESTORE_SCHEMA;id:string;dataRoot:string;backupPath:string;fileCount:number;generatedFiles:number;warnings:string[];purpose?:BackupPurpose;compatibility?: BackupCompatibility;continuity?: BackupContinuity;rollback?:UpdateRollback};
export type PortableRestoreSummary = {fileCount:number; generatedFiles:number; warnings:string[]};
export type BackupRestoreStatus={dataRoot:string;previousRoot?:string;portableRestore?:PortableRestoreSummary;pendingRollback?:UpdateRollback;previousAppVersion?:string;returnRequiresVersion?:string};
export type BackupRestoreAction={schemaVersion:typeof BACKUP_RESTORE_SCHEMA;action:'activate';id:string}|{schemaVersion:typeof BACKUP_RESTORE_SCHEMA;action:'revert'|'cancel_rollback'};
export function validBackupRestoreAction(x:unknown):x is BackupRestoreAction {
 if(!x||typeof x!=='object'||Array.isArray(x))return false;const v=x as Record<string,unknown>;
 return v.schemaVersion===BACKUP_RESTORE_SCHEMA&&((v.action==='revert'||v.action==='cancel_rollback')&&Object.keys(v).length===2||v.action==='activate'&&Object.keys(v).length===3&&typeof v.id==='string'&&/^restore_[a-f0-9-]{36}$/.test(v.id));
}
