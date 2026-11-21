import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {DataBackupVerificationResult} from '../../shared/contracts';
import {PORTABLE_BACKUP_PURPOSE, PORTABLE_LOCAL_ENV_FILE} from '../../shared/backup-purpose';
import {backupCompatibility, readBackupDataVersion, readBackupVersion} from './compatibility';
import {readBackupContinuity} from './continuity';
import {assertPortableBackupDatabase} from './portable';
import {collectDataBackupEntries} from './data-root-files';
import {readConversationOutputsBackup} from './conversation-outputs';
import {readExternalOutputsBackup} from './external-outputs';

export async function verifyDataBackup(backupPath: string, appVersion?: string): Promise<DataBackupVerificationResult> {
  const resolvedBackup = backupPath.trim();
  const manifestPath = join(resolvedBackup, 'omni-edu-backup-manifest.v1.json');
  const base: DataBackupVerificationResult = {
    backupPath: resolvedBackup,
    manifestPath,
    verified: false,
    fileCount: 0,
    missingFiles: [],
    changedFiles: [],
    unexpectedFiles: [],
  };
  try {
    if (!existsSync(manifestPath)) return { ...base, errorMessage: '备份清单不存在或不是 Omni-Edu v1 备份' };
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as { schemaVersion?: string;purpose?:unknown;conversationOutputs?:unknown;externalOutputs?:unknown;compatibility?:unknown;compatibilityAppVersionSource?:unknown; files?: Array<{ path?: string; size?: number; sha256?: string }> };
    if (parsed.schemaVersion !== 'omni-edu-backup-manifest.v1' || !Array.isArray(parsed.files)) return { ...base, errorMessage: '备份清单版本或结构无效' };
    if (parsed.purpose !== undefined && parsed.purpose !== PORTABLE_BACKUP_PURPOSE) return { ...base, errorMessage: '备份用途无法识别，请用原电脑的小智核对该备份。' };
    const expected = new Map(parsed.files.flatMap((item) => {
      const relativePath = String(item.path ?? '').replace(/\\/g, '/');
      const sha256 = String(item.sha256 ?? '');
      const size = Number(item.size ?? -1);
      if (!relativePath || relativePath.startsWith('/') || relativePath.includes('..') || !/^[a-f0-9]{64}$/.test(sha256) || !Number.isFinite(size) || size < 0) return [];
      return [[relativePath, { size, sha256 }]] as const;
    }));
    if (expected.size !== parsed.files.length) return { ...base, errorMessage: '备份清单包含非法路径或重复条目' };
    const conversationOutputs=readConversationOutputsBackup(parsed.conversationOutputs,expected.keys());
    const externalOutputs=readExternalOutputsBackup(parsed.externalOutputs,expected.keys());
    const actual = await collectDataBackupEntries(resolvedBackup);
    const actualMap = new Map(actual.map((item) => [item.path, item]));
    const missingFiles = [...expected.keys()].filter((path) => !actualMap.has(path));
    const changedFiles: string[] = [];
    for (const [path, expectedItem] of expected.entries()) {
      const actualItem = actualMap.get(path);
      if (actualItem && (actualItem.size !== expectedItem.size || actualItem.sha256 !== expectedItem.sha256)) changedFiles.push(path);
    }
    const unexpectedFiles = [...actualMap.keys()].filter((path) => !expected.has(path));
    const verified = !missingFiles.length && !changedFiles.length && !unexpectedFiles.length;
    const result = { ...base, conversationOutputs, externalOutputs, verified, fileCount: expected.size,
      missingFiles, changedFiles, unexpectedFiles, errorMessage: verified ? undefined : '备份文件与清单不一致' };
    if (!verified) return result;
    const databasePath = join(resolvedBackup, 'app.db');
    const hasDatabase = expected.has('app.db');
    let compatibility: DataBackupVerificationResult['compatibility'];
    if (appVersion && hasDatabase) {
      const dataVersion = await readBackupDataVersion(databasePath);
      compatibility = backupCompatibility(readBackupVersion(parsed.compatibility, dataVersion), dataVersion,
        appVersion, parsed.compatibilityAppVersionSource);
      if (compatibility.status === 'newer_app' || compatibility.status === 'newer_data') return {...result, compatibility};
    }
    if (parsed.purpose === PORTABLE_BACKUP_PURPOSE) {
      try {
        if (!hasDatabase || [...expected.keys()].some(file => file.toLowerCase() === PORTABLE_LOCAL_ENV_FILE)) throw Error('configuration');
        await assertPortableBackupDatabase(databasePath);
      } catch {
        return {...result, verified: false, errorMessage: '换机包未通过凭据和授权核对，请重新创建换机包。'};
      }
    }
    const continuity = compatibility ? await readBackupContinuity(databasePath) : undefined;
    return { ...result, purpose: parsed.purpose, compatibility, continuity };
  } catch (error) {
    return { ...base, errorMessage: error instanceof Error ? error.message : '备份清单读取失败' };
  }
}
