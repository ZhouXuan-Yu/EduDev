import { gt, valid } from 'semver';
import type sqlite3 from 'sqlite3';
import {lstat} from 'node:fs/promises';
import {closeSqlite,openSqlite} from '../sqlite-connections';
import {inspectBackupDatabaseVersion,MAX_DATABASE_SCHEMA_VERSION} from '../database-migrations';
import desktopPackage from '../../../package.json' with {type: 'json'};
import type { BackupCompatibility, BackupVersion } from '../../shared/backup-compatibility';

// The earlier development launcher passed the Electron executable's version for these v1 backups.
const LEGACY_DEVELOPMENT_RUNTIME_VERSION = '43.8.3';

export function backupApplicationVersion(application: {isPackaged: boolean; getVersion(): string}) {
  return application.isPackaged ? application.getVersion() : desktopPackage.version;
}
const isDataVersion = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0x7fff_ffff;

export async function withReadOnlyBackup<T>(file: string, inspect: (db: sqlite3.Database) => Promise<T>): Promise<T> {
  for(const suffix of ['-wal','-shm','-journal']) {
    const sidecar=await lstat(file+suffix).catch(error=>{
      if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
    });
    if(sidecar)throw Error('backup_database_not_standalone');
  }
  const db = await openSqlite(file, 'backupRead');
  try {
    return await inspect(db);
  } finally {
    await closeSqlite(db);
  }
}

export function readBackupDataVersion(file: string): Promise<number> {
  return withReadOnlyBackup(file, inspectBackupDatabaseVersion);
}

export async function readLiveDataVersion(file:string):Promise<number> {
  const db=await openSqlite(file,'liveRead');
  try{return await inspectBackupDatabaseVersion(db);}
  finally{await closeSqlite(db);}
}

export function readBackupVersion(input: unknown, actualDataVersion: number): BackupVersion | undefined {
  if (input === undefined) return;
  const source = input as Partial<BackupVersion> | null;
  if (!source || typeof source !== 'object' || Object.keys(source).length !== 2 ||
      typeof source.appVersion !== 'string' || !valid(source.appVersion) ||
      !isDataVersion(source.dataVersion) || source.dataVersion !== actualDataVersion) {
    throw Error('备份版本信息无效或与数据库不一致，请重新创建备份');
  }
  return { appVersion: source.appVersion, dataVersion: source.dataVersion };
}

export function backupCompatibility(source: BackupVersion | undefined, dataVersion: number, currentAppVersion: string,
  versionSource?: unknown): BackupCompatibility {
  const legacyRuntimeVersion = versionSource === undefined && source?.appVersion === LEGACY_DEVELOPMENT_RUNTIME_VERSION
    && gt(source.appVersion, currentAppVersion) ? source.appVersion : undefined;
  const status = dataVersion > MAX_DATABASE_SCHEMA_VERSION ? 'newer_data'
    : !source || legacyRuntimeVersion ? 'legacy'
    : gt(source.appVersion, currentAppVersion) ? 'newer_app'
    : 'ready';
  return { sourceAppVersion: legacyRuntimeVersion ? undefined : source?.appVersion, currentAppVersion, dataVersion, status,
    ...(legacyRuntimeVersion ? {legacyRuntimeVersion} : {}) };
}

export function assertBackupCompatibility(compatibility?: BackupCompatibility) {
  if (compatibility?.status === 'newer_app') {
    throw Error('此备份来自小智 ' + compatibility.sourceAppVersion + '，当前版本为 ' + compatibility.currentAppVersion + '。请先在新电脑安装相同或更新版本的小智。');
  }
  if (compatibility?.status === 'newer_data') {
    throw Error('当前小智无法读取此备份的数据库格式（' + compatibility.dataVersion + '）。请升级小智后再恢复。');
  }
}
