import {contextBridge,ipcRenderer} from 'electron';
import {SETTINGS_API_PREFIX,SETTINGS_ROUTES,type SettingsDomainApi,type SettingsSessionScope,type SettingsWindowClient} from '../shared/settings-window';

let scope:SettingsSessionScope|undefined;
ipcRenderer.on('settings-window:scope',(_event,next:SettingsSessionScope)=>{scope=next;});
function subscribe<T>(channel:string,listener:(value:T)=>void){
  const handler=(_event:Electron.IpcRendererEvent,value:T)=>listener(value);
  ipcRenderer.on(channel,handler);return ()=>ipcRenderer.removeListener(channel,handler);
}
// A fixed method map, not an exposed invoke primitive. Original service argument
// types are retained; the host independently checks both scope and domain input.
const domain=Object.fromEntries(Object.entries(SETTINGS_ROUTES).map(([method,route])=>[method,(...args:unknown[])=>{
  if(!scope)return Promise.reject(Error('settings_not_ready'));
  return ipcRenderer.invoke(SETTINGS_API_PREFIX+route.channel,{schemaVersion:'settings.request.v1',scope:{...scope},args});
}])) as Omit<SettingsDomainApi,'onXiaozhiEvent'>;
const api:SettingsDomainApi={...domain,onXiaozhiEvent:listener=>subscribe('settings-window:status',listener)};
const windowApi:SettingsWindowClient={
  bootstrap:async()=>{scope=await ipcRenderer.invoke('settings-window:bootstrap') as SettingsSessionScope;return {...scope};},
  getScope:()=>scope?{...scope}:null,
  close:()=>ipcRenderer.invoke('settings-window:close'),
  setBlocked:blocked=>ipcRenderer.invoke('settings-window:blocked',blocked),
  onScope:listener=>subscribe('settings-window:scope',listener),
  onChanged:listener=>subscribe('settings-window:changed',listener),
  onCloseBlocked:listener=>subscribe('settings-window:close-blocked',listener),
};
contextBridge.exposeInMainWorld('omniEdu',api);
contextBridge.exposeInMainWorld('settingsWindow',windowApi);
