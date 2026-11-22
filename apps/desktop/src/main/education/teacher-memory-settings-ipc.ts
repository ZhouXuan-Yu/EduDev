import type {IpcMain, IpcMainInvokeEvent} from 'electron';
import type {createXiaozhiProductionHost} from '../xiaozhi-agent/production-host';
import type {TeacherMemorySettings, TeacherMemorySettingsResult} from '../../shared/teacher-memory-settings';

async function respond(work: () => Promise<TeacherMemorySettings>): Promise<TeacherMemorySettingsResult> {
  try {
    return {ok: true, value: await work()};
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return {ok: false, error: code === 'invalid_input' || code === 'conflict' || code === 'busy' ? code : 'configuration'};
  }
}

export function registerTeacherMemorySettingsIpc({ipcMain, allowed, host}: {
  ipcMain: IpcMain;
  allowed: (event: IpcMainInvokeEvent) => boolean;
  host: Pick<ReturnType<typeof createXiaozhiProductionHost>, 'teacherMemorySettings' | 'saveTeacherMemorySettings'>;
}) {
  ipcMain.handle('xiaozhi:teacher-memory-settings', event => allowed(event)
    ? respond(host.teacherMemorySettings) : {ok: false, error: 'permission_denied'});
  ipcMain.handle('xiaozhi:teacher-memory-save', (event, input) => allowed(event)
    ? respond(() => host.saveTeacherMemorySettings(input)) : {ok: false, error: 'permission_denied'});
}
