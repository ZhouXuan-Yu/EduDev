import type { IpcMain } from 'electron';
import type { createTextChangeCoordinator } from './text-change-coordinator';

export function registerTextChangeIpc(options: { ipcMain: IpcMain;
  allowed: (event: Electron.IpcMainInvokeEvent) => boolean;
  host: { reviewTextChange: ReturnType<typeof createTextChangeCoordinator>['review'];
    decideTextChange: ReturnType<typeof createTextChangeCoordinator>['decide'] };
}) {
  options.ipcMain.handle('xiaozhi:change-review', (event, input) => options.allowed(event)
    ? options.host.reviewTextChange(input) : { ok: false, error: 'permission_denied' });
  options.ipcMain.handle('xiaozhi:change-decide', (event, input) => options.allowed(event)
    ? options.host.decideTextChange(input) : { ok: false, error: 'permission_denied' });
}
