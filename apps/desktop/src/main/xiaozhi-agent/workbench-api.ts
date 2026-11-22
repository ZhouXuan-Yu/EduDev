import type {IpcMain, IpcMainInvokeEvent} from 'electron';
import {createWorkbenchSummary} from './workbench-summary';

export function registerWorkbenchIpc(options: {ipcMain: IpcMain; allowed: (event: IpcMainInvokeEvent) => boolean;
} & Parameters<typeof createWorkbenchSummary>[0]) {
  const summary = createWorkbenchSummary(options);
  options.ipcMain.handle('xiaozhi:workbench-summary', (event, query) => options.allowed(event)
    ? summary(query) : {ok: false, error: 'permission_denied'});
}
