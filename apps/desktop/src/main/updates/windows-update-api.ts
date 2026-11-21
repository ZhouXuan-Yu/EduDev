import {app,dialog,net,type IpcMainInvokeEvent} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {OmniEduStore} from '../db';
import type {WindowsUpdateCandidate,WindowsUpdateSnapshot} from '../../shared/windows-update';
import {backupApplicationVersion,readBackupDataVersion} from '../backup/compatibility';
import {hashFileSha256} from '../local-file-security';
import {assertUnchangedUpdateFile,inspectWindowsInstaller} from './windows-update-candidate';

export function registerWindowsUpdate(options: {
  ipcMain: Pick<Electron.IpcMain,'handle'>;
  store: OmniEduStore;
  allowed: (event: IpcMainInvokeEvent) => boolean;
  job: <T>(work: (assertCurrent: () => void) => Promise<T>) => Promise<T>;
}) {
  let selection: {file:string; candidate:WindowsUpdateCandidate; owner:number} | undefined;
  const check = (event: IpcMainInvokeEvent) => {
    if (!options.allowed(event) || process.platform !== 'win32') throw Error('permission_denied');
  };
  const currentVersion = () => backupApplicationVersion(app);
  options.ipcMain.handle('app:inspectWindowsUpdate', async event => {
    check(event);
    return options.job(async current => {
      selection = undefined;
      const result = await dialog.showOpenDialog({title:'选择小智 Windows 安装包',
        properties:['openFile'], filters:[{name:'小智 Windows 安装包',extensions:['exe']}]});
      current(); check(event);
      const file = result.filePaths[0];
      if (result.canceled || !file) return null;
      const dataVersion = await readBackupDataVersion(path.join(options.store.getDataRoot(), 'app.db'));
      const candidate = await inspectWindowsInstaller(file, currentVersion(), dataVersion, net.fetch.bind(net));
      current(); check(event);
      selection = {file, candidate, owner:event.sender.id};
      return candidate;
    });
  });
  options.ipcMain.handle('app:prepareWindowsUpdate', async (event, id: unknown): Promise<WindowsUpdateSnapshot|null> => {
    check(event);
    return options.job(async current => {
      const selected = selection;
      if (!selected || selected.owner !== event.sender.id || id !== selected.candidate.id) throw Error('更新检查已失效，请重新选择安装包。');
      const {file, candidate} = selected;
      const {sha256, targetVersion, targetDataVersion} = candidate;
      if (candidate.status !== 'ready' || !sha256 || !targetVersion || targetDataVersion === undefined) {
        throw Error('安装包未通过更新前检查。');
      }
      const result = await dialog.showOpenDialog({title:'选择更新前快照的位置',properties:['openDirectory','createDirectory']});
      current(); check(event);
      const parent = result.filePaths[0];
      if (result.canceled || !parent) return null;
      await assertUnchangedUpdateFile(file, sha256);
      current(); check(event);
      const snapshot = await options.store.exportDataRoot(parent, candidate.currentVersion);
      if (!snapshot.verified || snapshot.compatibility?.status !== 'ready' || snapshot.compatibility.dataVersion !== candidate.dataVersion ||
        snapshot.compatibility.sourceAppVersion !== candidate.currentVersion || snapshot.externalOutputs?.omittedCount) {
        throw Error(`更新前快照的版本或文件需要核对。已有备份保留在 ${snapshot.exportPath}`);
      }
      const manifestSha256 = await hashFileSha256(snapshot.manifestPath);
      await assertUnchangedUpdateFile(file, sha256);
      current(); check(event);
      const recordPath = path.join(path.dirname(snapshot.exportPath), `Xiaozhi-update-${candidate.id}.json`);
      await fs.writeFile(recordPath, JSON.stringify({
        schemaVersion:'xiaozhi.windows-update-preparation.v1', preparedAt:new Date().toISOString(),
        currentVersion:candidate.currentVersion, dataVersion:candidate.dataVersion,
        targetVersion, targetDataVersion, fileName:candidate.fileName, sha256,
        snapshotPath:snapshot.exportPath, manifestSha256,
      }, null, 2), {encoding:'utf8',flag:'wx'});
      selection = undefined;
      return {snapshotPath:snapshot.exportPath, recordPath, currentVersion:candidate.currentVersion, targetVersion};
    });
  });
}
