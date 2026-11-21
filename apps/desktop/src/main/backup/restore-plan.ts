import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import type {BackupRestorePreview} from '../../shared/backup-restore';
import type {DataBackupVerificationResult} from '../../shared/contracts';
import {conversationOutputLocation} from '../xiaozhi-agent/conversation-output-path';
import {assertBackupCompatibility} from './compatibility';
import {readExternalOutputsBackup} from './external-outputs';

const manifestName = 'omni-edu-backup-manifest.v1.json';
export const recoveryReceiptName = 'xiaozhi-recovery.v1.json';
const restoreHeadroom = 16 * 1024 * 1024;

export type RestoreSelection = {
  backupPath: string;
  parent: string;
  currentDataRoot: string;
  verify: (root: string) => Promise<DataBackupVerificationResult>;
};

type ManifestEntry = {path: string; size: number; sha256: string};

export function inside(root: string, file: string) {
  const relative = path.relative(root, file);
  return !relative || !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
}

export async function noLinks(file: string) {
  let cursor = path.resolve(file);
  while (true) {
    if ((await fs.lstat(cursor)).isSymbolicLink()) throw Error('恢复路径包含链接，请选择实际目录');
    const parent = path.dirname(cursor);
    if (parent === cursor) return;
    cursor = parent;
  }
}

async function selectedRoots(selection: Pick<RestoreSelection, 'backupPath' | 'parent' | 'currentDataRoot'>) {
  await Promise.all([noLinks(selection.backupPath), noLinks(selection.parent)]);
  const [backup, parent, current] = await Promise.all([
    fs.realpath(selection.backupPath), fs.realpath(selection.parent), fs.realpath(selection.currentDataRoot),
  ]);
  if (inside(backup, parent) || inside(current, parent) || inside(conversationOutputLocation(current).path, parent)) {
    throw Error('恢复位置须在当前数据、生成文件和备份目录之外');
  }
  if (!(await fs.stat(parent)).isDirectory()) throw Error('请选择保存恢复副本的文件夹');
  return {backup, parent, current};
}

async function readManifest(file: string) {
  try {
    await noLinks(file);
    if (!(await fs.lstat(file)).isFile()) throw Error('备份清单无法读取');
    return await fs.readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw Error('备份清单不存在，请重新选择备份目录');
    throw error;
  }
}

function checkedEntries(bytes: Buffer): ManifestEntry[] {
  const entries = (JSON.parse(bytes.toString('utf8')) as {files?: ManifestEntry[]}).files;
  if (!Array.isArray(entries) || !entries.some(entry => entry?.path === 'app.db')) {
    throw Error('备份缺少数据库，未创建恢复目录');
  }
  const names = new Set<string>();
  for (const entry of entries) {
    const name = entry?.path;
    if (typeof name !== 'string' || name.includes('\\') || name.split('/').some(part => !part ||
      part === '.' || part === '..' || /[\x00-\x1f:]/.test(part)) || names.has(name.toLowerCase()) ||
      !Number.isSafeInteger(entry.size) || entry.size < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw Error('备份包含不能恢复的路径或重复文件');
    }
    names.add(name.toLowerCase());
  }
  return entries;
}

async function availableSpace(parent: string) {
  const space = await fs.statfs(parent, {bigint: true});
  const bytes = space.bavail * space.bsize;
  return Number(bytes > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : bytes);
}

/** Inspect the selected backup and destination without creating a copy. */
export async function inspectBackupRestore(selection: RestoreSelection) {
  const {backup, parent, current} = await selectedRoots(selection);
  const manifestPath = path.join(backup, manifestName);
  const manifestBytes = await readManifest(manifestPath);
  const verification = await selection.verify(backup);
  if (!verification.verified) throw Error(verification.errorMessage || '备份校验失败，未创建恢复目录');
  assertBackupCompatibility(verification.compatibility);
  if (!manifestBytes.equals(await readManifest(manifestPath))) throw Error('备份在核对期间变化，请重新选择');
  const source = verification.conversationOutputs;
  if (!source) throw Error('此旧备份缺少原数据目录信息，请在原版本重新创建备份。原备份仍可校验。');
  const scope = createHash('sha256').update(source.sourceDataRoot.toLowerCase()).digest('hex').slice(0, 16);
  if (source.scope !== scope || path.resolve(source.sourceOutputRoot) !== path.join(path.dirname(source.sourceDataRoot), 'XiaozhiOutputs', scope)) {
    throw Error('备份原目录信息不一致，未创建恢复目录');
  }

  const entries = checkedEntries(manifestBytes);
  const external = readExternalOutputsBackup(verification.externalOutputs, entries.map(file => file.path));
  const packageBytes = entries.reduce((total, item) => total + item.size, 0);
  const files = entries.filter(item => item.path !== recoveryReceiptName);
  const requiredBytes = files.reduce((total, item) => total + item.size, restoreHeadroom);
  if (!Number.isSafeInteger(packageBytes) || !Number.isSafeInteger(requiredBytes)) throw Error('备份大小超出支持范围');
  const availableBytes = await availableSpace(parent);
  const preview: BackupRestorePreview = {
    id: 'preview_' + randomUUID(), backupPath: backup, destination: parent, fileCount: files.length,
    packageBytes, requiredBytes, availableBytes, spaceStatus: availableBytes >= requiredBytes ? 'ready' : 'insufficient',
    purpose: verification.purpose, compatibility: verification.compatibility, continuity: verification.continuity,
    omittedOutputs: external?.omittedCount ?? 0,
  };
  return {backup, parent, current, manifestPath, manifestBytes, files, source, external, preview};
}

export type BackupRestorePlan = Awaited<ReturnType<typeof inspectBackupRestore>>;

export async function recheckRestorePlan(plan: BackupRestorePlan, currentDataRoot: string) {
  const roots = await selectedRoots({backupPath: plan.backup, parent: plan.parent, currentDataRoot});
  if (roots.backup !== plan.backup || roots.parent !== plan.parent || roots.current !== plan.current ||
    !plan.manifestBytes.equals(await readManifest(plan.manifestPath))) throw Error('备份或恢复位置已变化，请重新核对');
  if (await availableSpace(plan.parent) < plan.preview.requiredBytes) {
    throw Error('恢复位置空间不足，请重新核对剩余空间或另选磁盘。');
  }
}
