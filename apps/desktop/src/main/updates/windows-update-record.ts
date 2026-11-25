import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gt,valid} from 'semver';
import {WINDOWS_UPDATE_RECORD,type UpdateRollback} from '../../shared/windows-update';
import {noLinks,type BackupRestorePlan} from '../backup/restore-plan';

const digest = /^[a-f0-9]{64}$/;
const isDataVersion = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0x7fff_ffff;

export function validUpdateRollback(value: unknown): value is UpdateRollback {
  const entry = value as Partial<UpdateRollback> | null;
  return !!entry && typeof entry.sourceVersion === 'string' && !!valid(entry.sourceVersion) &&
    typeof entry.targetVersion === 'string' && !!valid(entry.targetVersion) && gt(entry.targetVersion, entry.sourceVersion) &&
    typeof entry.preparedAt === 'string' && entry.preparedAt.length <= 32 && Number.isFinite(Date.parse(entry.preparedAt));
}

export async function readWindowsUpdateRecord(file: string, runningVersion: string) {
  await noLinks(file);
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.size > 16384) throw Error('更新记录无效。');
  const entry = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string,unknown> | null;
  const context = {sourceVersion:entry?.currentVersion,targetVersion:entry?.targetVersion,preparedAt:entry?.preparedAt};
  if (entry?.schemaVersion !== WINDOWS_UPDATE_RECORD || !validUpdateRollback(context) ||
    !isDataVersion(entry.dataVersion) || !isDataVersion(entry.targetDataVersion) ||
    typeof entry.sha256 !== 'string' || !digest.test(entry.sha256) ||
    typeof entry.manifestSha256 !== 'string' || !digest.test(entry.manifestSha256) ||
    entry.fileName !== `Xiaozhi-Setup-${context.targetVersion}-x64.exe` || typeof entry.snapshotPath !== 'string') {
    throw Error('更新记录无效，请选择小智创建的原记录。');
  }
  if (runningVersion !== context.sourceVersion && runningVersion !== context.targetVersion) {
    throw Error(`该记录对应 ${context.sourceVersion} 至 ${context.targetVersion}，请从其中一个版本准备回退。`);
  }
  const folder = path.win32.basename(entry.snapshotPath);
  if (!/^OmniEduData-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(?:-[a-f0-9]{8})?$/u.test(folder)) {
    throw Error('升级前备份名称无效。');
  }
  // The update record and backup can be moved together. Its old absolute path carries no authority.
  return {context, dataVersion:entry.dataVersion, manifestSha256:entry.manifestSha256,
    backupPath:path.join(path.dirname(file), folder)};
}

export function attachUpdateRollback(plan: BackupRestorePlan, record: Awaited<ReturnType<typeof readWindowsUpdateRecord>>) {
  const {preview,manifestBytes} = plan;
  if (preview.compatibility?.sourceAppVersion !== record.context.sourceVersion ||
    preview.compatibility.dataVersion !== record.dataVersion || preview.purpose === 'portable' ||
    preview.omittedOutputs || createHash('sha256').update(manifestBytes).digest('hex') !== record.manifestSha256) {
    throw Error('当前备份与更新记录不匹配；请将记录和对应的原备份放在同一文件夹。');
  }
  preview.rollback = record.context;
}
