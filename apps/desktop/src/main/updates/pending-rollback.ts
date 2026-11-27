import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {UpdateRollback} from '../../shared/windows-update';
import type {PreparedBackupRestore} from '../../shared/backup-restore';
import {hashFileSha256} from '../local-file-security';
import {selectedBackupRoot,selectBackupRoot} from '../backup/activation';
import {readRecoveryReceipt,verifyPreparedBackupRestore,verifyRestoredMemoryAuthority} from '../backup/restore';
import {validUpdateRollback} from './windows-update-record';

const schema = 'xiaozhi.pending-update-rollback.v1';
const fileFor = (profile: string) => path.join(profile,'xiaozhi-pending-rollback.v1.json');
const manifestFor = (root: string) => path.join(path.dirname(root),'restoration-files.v1.json');
type Pending = {
  schemaVersion:typeof schema; baseRoot:string; previousRoot:string; dataRoot:string;
  restoreId:string; fromVersion:string; rollback:UpdateRollback; manifestSha256:string;
};

export async function readPendingRollback(profile: string, baseRoot: string): Promise<Pending | undefined> {
  try {
    const file = fileFor(profile);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 16384) throw Error('回退安排无法读取。');
    const value = JSON.parse(await fs.readFile(file,'utf8')) as Pending | null;
    if (!value || value.schemaVersion !== schema ||
      ![value.baseRoot,value.previousRoot,value.dataRoot].every(root => typeof root === 'string' && path.isAbsolute(root)) ||
      !validUpdateRollback(value.rollback) || ![value.rollback.sourceVersion,value.rollback.targetVersion].includes(value.fromVersion) ||
      !/^restore_[a-f0-9-]{36}$/.test(value.restoreId) || !/^[a-f0-9]{64}$/.test(value.manifestSha256)) {
      throw Error('回退安排无法读取。');
    }
    return path.resolve(value.baseRoot) === path.resolve(baseRoot) ? value : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
}

export async function stageUpdateRollback(profile: string, baseRoot: string, previousRoot: string,
  runningVersion: string, prepared: PreparedBackupRestore, authorize:()=>void) {
  const {rollback} = prepared;
  if (!validUpdateRollback(rollback) || ![rollback.sourceVersion,rollback.targetVersion].includes(runningVersion)) {
    throw Error('当前小智版本与回退副本不匹配。');
  }
  if (await readPendingRollback(profile,baseRoot)) throw Error('请先取消待启用的版本回退。');
  const manifestSha256 = await hashFileSha256(manifestFor(prepared.dataRoot));
  await verifyPreparedBackupRestore(prepared);
  if (await hashFileSha256(manifestFor(prepared.dataRoot)) !== manifestSha256) throw Error('回退副本清单已变化。');
  const value: Pending = {schemaVersion:schema,baseRoot,previousRoot,dataRoot:prepared.dataRoot,
    restoreId:prepared.id,fromVersion:runningVersion,rollback,manifestSha256};
  authorize();
  const temporary = fileFor(profile)+'.'+randomUUID()+'.tmp';
  await fs.writeFile(temporary,JSON.stringify(value,null,2),{encoding:'utf8',flag:'wx'});
  try { await fs.rename(temporary,fileFor(profile)); }
  finally { await fs.rm(temporary,{force:true}).catch(()=>undefined); }
}

export async function cancelUpdateRollback(profile: string, baseRoot: string) {
  if (await readPendingRollback(profile,baseRoot)) await fs.unlink(fileFor(profile));
}

/** Run before opening either workspace for writes. A different version leaves the pending selection alone. */
export async function applyPendingUpdateRollback(profile: string, baseRoot: string, runningVersion: string) {
  const pending = await readPendingRollback(profile,baseRoot);
  if (!pending || pending.rollback.sourceVersion !== runningVersion) return;
  const recorded = await selectedBackupRoot(profile,baseRoot);
  if (recorded.dataRoot !== pending.dataRoot) {
    const selection = await selectedBackupRoot(profile,baseRoot,pending.fromVersion);
    const receipt = await readRecoveryReceipt(pending.dataRoot);
    if (selection.dataRoot !== pending.previousRoot || !receipt || receipt.id !== pending.restoreId ||
      receipt.rollback?.sourceVersion !== runningVersion || receipt.rollback?.targetVersion !== pending.rollback.targetVersion ||
      await hashFileSha256(manifestFor(pending.dataRoot)) !== pending.manifestSha256) {
      throw Error('回退副本或当前工作区已变化。请用准备回退时的版本重新选择。');
    }
    await verifyPreparedBackupRestore(receipt);
    if (await hashFileSha256(manifestFor(pending.dataRoot)) !== pending.manifestSha256) throw Error('回退副本清单已变化。');
    // Scheduling and activation can be separated by arbitrary live changes and a restart.
    await verifyRestoredMemoryAuthority(receipt,pending.previousRoot);
    await selectBackupRoot(profile,baseRoot,pending.dataRoot,pending.previousRoot,{active:runningVersion,previous:pending.fromVersion});
  }
  await fs.unlink(fileFor(profile));
}
