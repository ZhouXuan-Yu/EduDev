import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import type { PermissionService } from './service';
import type { PermissionApiResult } from '../../../shared/xiaozhi-permissions';

export async function permissionResult<T>(work: () => Promise<T>): Promise<PermissionApiResult<T>> {
  try { return {ok: true, value: await work()}; }
  catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = message === 'invalid_input' ? 'invalid_input' : message === 'unsupported_constraint' ? 'unsupported_constraint'
      : message.includes('conflict') ? 'conflict' : message.includes('permission') ? 'permission_denied' : 'unavailable';
    return {ok: false, error: code};
  }
}

export function registerPermissionIpc(options: {ipcMain: IpcMain; allowed: (event: IpcMainInvokeEvent) => boolean; permissions: PermissionService;
  resumeLegacy: (input: {sessionId: string; approvalId: string}) => Promise<import('../../../shared/xiaozhi-agent').XiaozhiStartResult>}) {
  const {ipcMain, allowed, permissions} = options;
  ipcMain.handle('xiaozhi:permission-view', (event, sessionId) => allowed(event)
    ? permissionResult(() => permissions.view(sessionId)) : {ok: false, error: 'permission_denied'});
  ipcMain.handle('xiaozhi:permission-mode', (event, input) => allowed(event)
    ? permissionResult(() => permissions.setMode(input)) : {ok: false, error: 'permission_denied'});
  ipcMain.handle('xiaozhi:permission-decide', (event, input) => allowed(event)
    ? permissionResult(() => permissions.decide(input)) : {ok: false, error: 'permission_denied'});
  ipcMain.handle('xiaozhi:permission-revoke', (event, input) => allowed(event)
    ? permissionResult(() => permissions.revoke(input)) : {ok: false, error: 'permission_denied'});
  ipcMain.handle('xiaozhi:permission-resume-legacy', (event, input) => allowed(event)
    ? options.resumeLegacy(input) : {ok: false, error: 'permission_denied'});
}
