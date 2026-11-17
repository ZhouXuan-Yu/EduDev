import type {IpcRenderer} from 'electron';
import type {XiaozhiTerminalApi, TerminalUpdate} from '../shared/xiaozhi-terminal-jobs';

export function createTerminalPreload(ipc: IpcRenderer): XiaozhiTerminalApi {
  return {
    listXiaozhiTerminals: input => ipc.invoke('xiaozhi:terminal:list', input),
    readXiaozhiTerminal: input => ipc.invoke('xiaozhi:terminal:read', input),
    writeXiaozhiTerminal: input => ipc.invoke('xiaozhi:terminal:write', input),
    resizeXiaozhiTerminal: input => ipc.invoke('xiaozhi:terminal:resize', input),
    sendEofXiaozhiTerminal: input => ipc.invoke('xiaozhi:terminal:eof', input),
    closeInputXiaozhiTerminal: input => ipc.invoke('xiaozhi:terminal:input-close', input),
    closeXiaozhiTerminal: input => ipc.invoke('xiaozhi:terminal:close', input),
    takeControlXiaozhiTerminal: input => ipc.invoke('xiaozhi:terminal:take-control', input),
    onXiaozhiTerminal(listener) {
      const handler = (_event: Electron.IpcRendererEvent, update: TerminalUpdate) => listener(update);
      ipc.on('xiaozhi:terminal:update', handler);
      return () => ipc.removeListener('xiaozhi:terminal:update', handler);
    },
  };
}
