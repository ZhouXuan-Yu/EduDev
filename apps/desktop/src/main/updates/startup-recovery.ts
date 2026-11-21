import {dialog} from 'electron';
import {selectedBackupRoot, selectBackupRoot} from '../backup/activation';
import {inspectBackupRestore} from '../backup/restore-plan';
import {prepareBackupRestore, verifyPreparedBackupRestore} from '../backup/restore';
import {verifyDataBackup} from '../backup/verify';
import {readPendingRollback} from './pending-rollback';
import {attachUpdateRollback, readWindowsUpdateRecord} from './windows-update-record';

async function recoverWorkspace(profile: string, baseRoot: string, runningVersion: string) {
  const recordChoice = await dialog.showOpenDialog({
    title: '恢复工作区 · 选择更新记录',
    properties: ['openFile'],
    filters: [{name: '小智更新记录', extensions: ['json']}],
  });
  if (recordChoice.canceled || !recordChoice.filePaths[0]) return;
  const record = await readWindowsUpdateRecord(recordChoice.filePaths[0], runningVersion);
  const {sourceVersion, targetVersion, preparedAt} = record.context;
  if (runningVersion !== sourceVersion) {
    throw Error(`此快照需要小智 ${sourceVersion}。请从对应旧版打开「恢复工作区」。`);
  }
  const assertNoPending = async () => {
    if (await readPendingRollback(profile, baseRoot)) {
      throw Error('已有回退安排。请先正常启动对应旧版，或在原安排版本的设置中取消安排。');
    }
  };
  await assertNoPending();
  // The target version owns the workspace left behind after a failed update.
  const currentRoot = async () => (await selectedBackupRoot(profile, baseRoot, targetVersion)).dataRoot;
  const previousRoot = await currentRoot();
  const destination = await dialog.showOpenDialog({
    title: '恢复工作区 · 选择副本位置',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (destination.canceled || !destination.filePaths[0]) return;
  const selection = {backupPath: record.backupPath, parent: destination.filePaths[0],
    currentDataRoot: previousRoot, verify: (root: string) => verifyDataBackup(root, runningVersion)};
  const plan = await inspectBackupRestore(selection);
  attachUpdateRollback(plan, record);
  if (plan.preview.spaceStatus !== 'ready') throw Error('目标盘空间不足，请另选保存位置。');

  const formatBytes = (value: number) => new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 1})
    .format(value / 1024 ** 2) + ' MiB';
  const confirm = await dialog.showMessageBox({
    type: 'warning', title: '恢复工作区', message: `启用小智 ${sourceVersion} 的恢复副本？`,
    detail: [
      `快照时间 ${new Date(preparedAt).toLocaleString('zh-CN')}`,
      `目标位置 ${plan.parent}`,
      `${plan.preview.fileCount} 个文件 · 至少需要 ${formatBytes(plan.preview.requiredBytes)} · 目标盘可用 ${formatBytes(plan.preview.availableBytes)}`,
      `小智 ${targetVersion} 的工作区仍保存在 ${previousRoot}`,
    ].join('\n'),
    buttons: ['取消', '创建并启用副本'], cancelId: 0, defaultId: 0, noLink: true,
  });
  if (confirm.response !== 1) return;

  const prepared = await prepareBackupRestore({...selection, plan});
  await verifyPreparedBackupRestore(prepared);
  await assertNoPending();
  if (await currentRoot() !== previousRoot) throw Error('当前工作区已变化，请重新打开恢复入口。');
  await selectBackupRoot(profile, baseRoot, prepared.dataRoot, previousRoot,
    {active: sourceVersion, previous: targetVersion});
  return prepared.dataRoot;
}

export async function runStartupRecovery(profile: string, baseRoot: string, runningVersion: string) {
  let restored: string | undefined;
  try {
    restored = await recoverWorkspace(profile, baseRoot, runningVersion);
  } catch (error) {
    await dialog.showMessageBox({type: 'error', title: '恢复工作区', message: '未能启用恢复副本',
      detail: error instanceof Error ? error.message : '请重新核对更新记录和快照。'});
    return;
  }
  if (restored) await dialog.showMessageBox({type: 'info', title: '恢复工作区', message: '恢复副本已启用',
    detail: `请从常用入口重新打开小智 ${runningVersion}。\n恢复副本 ${restored}`});
}
