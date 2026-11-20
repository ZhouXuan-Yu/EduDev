import { gt, valid } from 'semver';
import sqlite3 from 'sqlite3';
import type { BackupCompatibility, BackupVersion } from '../../shared/backup-compatibility';

// Current databases predate an explicit PRAGMA user_version. Future incompatible
// migrations must assign a new user_version and update this reader together.
const MAX_BACKUP_DATA_VERSION = 0;
const isDataVersion = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0x7fff_ffff;

export async function readBackupDataVersion(file: string): Promise<number> {
  const db = await new Promise<sqlite3.Database>((resolve, reject) => {
    const connection = new sqlite3.Database(file, sqlite3.OPEN_READONLY,
      error => error ? reject(error) : resolve(connection));
  });
  try {
    return await new Promise<number>((resolve, reject) => {
      db.get('PRAGMA user_version', (error, row: { user_version?: number } | undefined) => {
        if (error) reject(error);
        else if (isDataVersion(row?.user_version)) resolve(row.user_version);
        else reject(Error('无法确认备份的数据库版本'));
      });
    });
  } finally {
    await new Promise<void>((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
  }
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

export function backupCompatibility(source: BackupVersion | undefined, dataVersion: number, currentAppVersion: string): BackupCompatibility {
  const status = dataVersion > MAX_BACKUP_DATA_VERSION ? 'newer_data'
    : !source ? 'legacy'
    : gt(source.appVersion, currentAppVersion) ? 'newer_app'
    : 'ready';
  return { sourceAppVersion: source?.appVersion, currentAppVersion, dataVersion, status };
}

export function assertBackupCompatibility(compatibility?: BackupCompatibility) {
  if (compatibility?.status === 'newer_app') {
    throw Error('此备份来自小智 ' + compatibility.sourceAppVersion + '，当前版本为 ' + compatibility.currentAppVersion + '。请先在新电脑安装相同或更新版本的小智。');
  }
  if (compatibility?.status === 'newer_data') {
    throw Error('当前小智无法读取此备份的数据库格式（' + compatibility.dataVersion + '）。请升级小智后再恢复。');
  }
}
