import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type sqlite3 from 'sqlite3';
import {PORTABLE_BACKUP_PURPOSE,type BackupPurpose} from '../../shared/backup-purpose';
import type {ExportDataRootResult} from '../../shared/contracts';
import {isInsideRoot} from '../local-file-security';
import {readBackupDataVersion} from './compatibility';
import {assertOutputBackupDestination,copyConversationOutputs} from './conversation-outputs';
import {captureBackupSource,collectDataBackupEntries,copyDataBackupFiles,REBUILDABLE_BACKUP_PATHS,snapshotDataBackupSqlite} from './data-root-files';
import {copyExternalOutputs} from './external-outputs';
import {snapshotPortableBackup} from './portable';
import type {BackupPublicationBarrier} from './publication-barrier';
import {verifyBackupReferences} from './references';
import {PARTIAL_BACKUP_PREFIX,verifyDataBackup} from './verify';

const manifestName='omni-edu-backup-manifest.v1.json';

export async function exportDatabaseBackup(options: {
  dataRoot: string;
  database: sqlite3.Database;
  publications: BackupPublicationBarrier;
  destinationRoot: string;
  appVersion?: string;
  purpose: BackupPurpose;
  signal?: AbortSignal;
  commitStarted?: () => void;
}): Promise<ExportDataRootResult> {
  const {dataRoot,database,publications,appVersion,purpose,signal}=options;
  if (!options.destinationRoot.trim()) throw Error('备份目标目录不能为空');
  const destination=path.resolve(options.destinationRoot.trim());
  if (await isInsideRoot(dataRoot,destination)) throw Error('备份目标不能位于当前数据目录内');
  await assertOutputBackupDestination(dataRoot,destination);
  const portable=purpose===PORTABLE_BACKUP_PURPOSE;
  const label=portable?'OmniEduData-transfer':'OmniEduData-backup';
  const timestamp=new Date().toISOString();
  const labelTime=timestamp.replace(/[:.]/g,'-');
  const published=path.join(destination,`${label}-${labelTime}-${randomUUID().slice(0,8)}`);

  return publications.snapshot(async()=>{
    await fs.mkdir(destination,{recursive:true});
    const staging=await fs.mkdtemp(path.join(destination,PARTIAL_BACKUP_PREFIX));
    let committed=false;
    try {
      const source=await captureBackupSource(dataRoot,purpose,signal);
      const snapshot=portable?snapshotPortableBackup:snapshotDataBackupSqlite;
      const databaseFile=path.join(staging,'app.db');
      await snapshot(database,databaseFile,signal);
      const compatibility=appVersion?{appVersion,dataVersion:await readBackupDataVersion(databaseFile)}:undefined;
      await copyDataBackupFiles(dataRoot,staging,purpose,signal);
      const conversationOutputs=await copyConversationOutputs(dataRoot,staging,signal);
      const externalOutputs=await copyExternalOutputs(dataRoot,staging,signal);
      const entries=await collectDataBackupEntries(staging,signal);
      const current=await captureBackupSource(dataRoot,purpose,signal);
      if (JSON.stringify(source)!==JSON.stringify(current)) throw Error('备份期间资料源发生变化，请重新备份');
      const destinations=new Map(entries.map(entry=>[entry.path,entry]));
      if (source.some(entry=>{
        const copied=destinations.get(entry.path);
        return !copied || copied.sha256!==entry.sha256 || copied.size!==entry.size;
      })) throw Error('备份期间资料文件发生变化，请重新备份');
      const snapshotValidation=await verifyBackupReferences(staging,entries,conversationOutputs,externalOutputs,signal);
      await fs.writeFile(path.join(staging,manifestName), JSON.stringify({
        schemaVersion:'omni-edu-backup-manifest.v1',createdAt:timestamp,fileCount:entries.length,files:entries,
        conversationOutputs,externalOutputs,compatibility,
        ...(compatibility?{compatibilityAppVersionSource:'desktop'}:{}),
        ...(portable?{purpose}:{}),excludedRebuildablePaths:REBUILDABLE_BACKUP_PATHS,snapshotValidation,
      },null,2), {encoding:'utf8',flag:'wx',signal});
      const verification=await verifyDataBackup(staging,appVersion,{signal,staging:true});
      if(!verification.verified) throw Error('备份完整性验证失败：'+(verification.errorMessage??'文件校验不一致'));
      signal?.throwIfAborted();
      options.commitStarted?.();
      await fs.rename(staging,published);
      committed=true;
      return {
        exportPath:published,fileCount:entries.length,manifestPath:path.join(published,manifestName),verified:true,
        conversationOutputs,externalOutputs,purpose:verification.purpose,compatibility:verification.compatibility,
        continuity:verification.continuity,excludedRebuildablePaths:[...REBUILDABLE_BACKUP_PATHS],
      };
    } finally {
      if(!committed && path.dirname(staging)===destination && path.basename(staging).startsWith(PARTIAL_BACKUP_PREFIX)) {
        await fs.rm(staging,{recursive:true,force:true}).catch(()=>undefined);
      }
    }
  },signal);
}
