import type {IpcMain, IpcMainInvokeEvent} from 'electron';
import type {createXiaozhiProductionHost} from '../production-host';
import {permissionResult} from '../permissions/api';
import {sessionId as validSession} from '../permissions/validation';
import {randomUUID} from 'node:crypto';

export function registerEnvironmentIpc(options: {
  ipcMain: IpcMain;
  allowed: (event: IpcMainInvokeEvent) => boolean;
  host: Pick<ReturnType<typeof createXiaozhiProductionHost>, 'environment' | 'start'>;
}) {
  options.ipcMain.handle('xiaozhi:environment-view', (event, sessionId) => options.allowed(event)
    ? permissionResult(() => options.host.environment.inspect(sessionId)) : {ok: false, error: 'permission_denied'});
  options.ipcMain.handle('xiaozhi:environment-repair', (event, sessionId, recipe = 'workspace_text') => {
    if (!options.allowed(event) || !validSession(sessionId) || !['workspace_text', 'permission_runtime'].includes(recipe)) return {ok: false, error: 'permission_denied'};
    return permissionResult(async () => {
      const view = await options.host.environment.inspect(sessionId);
      const expectedHash = recipe === 'permission_runtime' ? view.permissionRuntime?.sourceHash : view.configuration.sha256;
      if (expectedHash === undefined) throw Error('unsupported_constraint');
      return options.host.start({sessionId, commandId: 'xicmd_' + randomUUID(),
        prompt: '检查并修复本会话非敏感环境配置。使用environment_repair，recipe为' + recipe + '，expectedHash为'
          + JSON.stringify(expectedHash) + '。沿当前授权和原Task执行，保留已有私有配置及教学文件。'});
    });
  });
}
