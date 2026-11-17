import type {IpcMain, IpcMainInvokeEvent} from 'electron';
import type {XiaozhiTerminalApi} from '../../../shared/xiaozhi-terminal-jobs';

export function registerTerminalIpc(options: {
  ipcMain: IpcMain;
  allowed: (event: IpcMainInvokeEvent) => boolean;
  api: Omit<XiaozhiTerminalApi, 'onXiaozhiTerminal'>;
}) {
  const denied = () => ({ok: false, error: 'permission_denied'});
  options.ipcMain.handle('xiaozhi:terminal:list', (event, raw) => options.allowed(event) ? options.api.listXiaozhiTerminals(raw) : denied());
  options.ipcMain.handle('xiaozhi:terminal:read', (event, raw) => options.allowed(event) ? options.api.readXiaozhiTerminal(raw) : denied());
  options.ipcMain.handle('xiaozhi:terminal:write', (event, raw) => options.allowed(event) ? options.api.writeXiaozhiTerminal(raw) : denied());
  options.ipcMain.handle('xiaozhi:terminal:resize', (event, raw) => options.allowed(event) ? options.api.resizeXiaozhiTerminal(raw) : denied());
  options.ipcMain.handle('xiaozhi:terminal:eof', (event, raw) => options.allowed(event) ? options.api.sendEofXiaozhiTerminal(raw) : denied());
  options.ipcMain.handle('xiaozhi:terminal:input-close', (event, raw) => options.allowed(event) ? options.api.closeInputXiaozhiTerminal(raw) : denied());
  options.ipcMain.handle('xiaozhi:terminal:close', (event, raw) => options.allowed(event) ? options.api.closeXiaozhiTerminal(raw) : denied());
  options.ipcMain.handle('xiaozhi:terminal:take-control', (event, raw) => options.allowed(event) ? options.api.takeControlXiaozhiTerminal(raw) : denied());
}
