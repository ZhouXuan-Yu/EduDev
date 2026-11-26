import { contextBridge, ipcRenderer } from 'electron';
import type { ConfigWindowApi } from '../shared/xiaozhi-config-window';

const api: ConfigWindowApi = {
  read: () => ipcRenderer.invoke('xiaozhi:config-window-read'),
  refreshModels: () => ipcRenderer.invoke('xiaozhi:config-window-refresh'),
  history: (field, cursor) => ipcRenderer.invoke('xiaozhi:config-window-history', { field, cursor }),
  commit: input => ipcRenderer.invoke('xiaozhi:config-window-commit', input),
  undo: input => ipcRenderer.invoke('xiaozhi:config-window-undo', input),
  onChange: listener => {
    const handler: Parameters<typeof ipcRenderer.on>[1] = (_event, change) => listener(change);
    ipcRenderer.on('xiaozhi:config-window-changed', handler);
    return () => { ipcRenderer.removeListener('xiaozhi:config-window-changed', handler); };
  },
};

if (process.isMainFrame) contextBridge.exposeInMainWorld('xiaozhiConfigWindow', api);
