import {contextBridge,ipcRenderer} from 'electron';
import type {SettingsHostClient} from '../shared/settings-window';
const changed=(listener:()=>void)=>{const handler=()=>listener();ipcRenderer.on('settings-window:changed',handler);return()=>ipcRenderer.removeListener('settings-window:changed',handler);};
const host:SettingsHostClient={
  open:()=>ipcRenderer.invoke('settings-window:open'),
  select:sessionId=>ipcRenderer.invoke('settings-window:select',sessionId),
  onChanged:changed,
  onDim:listener=>{const handler=(_event:Electron.IpcRendererEvent,value:unknown)=>{if(typeof value==='boolean')listener(value);};ipcRenderer.on('settings-window:dim',handler);return()=>ipcRenderer.removeListener('settings-window:dim',handler);},
};
// The main-owned launch policy preserves the isolated legacy-test entry.
// A renderer preference can never enable this bridge.
if(process.argv.includes('--xiaozhi-settings-window'))contextBridge.exposeInMainWorld('settingsHost',host);
