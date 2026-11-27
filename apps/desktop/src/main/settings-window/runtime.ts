import {BrowserWindow,screen,type IpcMain,type IpcMainInvokeEvent} from 'electron';
import {SettingsWindowController} from './controller';
import {SettingsScopeAuthority} from './scope-authority';
import {createSettingsIpcBridge} from './ipc-bridge';
import type {XiaozhiAgentEvent} from '../../shared/xiaozhi-agent';

export interface SettingsRuntimeOptions {
  ipc:IpcMain;
  main:()=>BrowserWindow|undefined;
  mainUrl:string;
  settingsUrl:string;
  preload:string;
  readRevision:(id:string)=>Promise<string|null>;
  canReadArchive:(id:string)=>Promise<boolean>;
}

/** Window adapter only. All domain work delegates to the registered host service. */
export function createSettingsWindowRuntime(options:SettingsRuntimeOptions){
  let blocked=false;
  const mainTrusted=(event:IpcMainInvokeEvent)=>{
    const main=options.main();
    return !!main&&!main.isDestroyed()&&event.sender===main.webContents&&event.senderFrame===main.webContents.mainFrame
      &&event.senderFrame?.url===options.mainUrl&&event.sender.getURL()===options.mainUrl;
  };
  const send=(channel:string,value?:unknown)=>{const window=controller.window;if(window&&!window.isDestroyed())window.webContents.send(channel,value);};
  const notify=()=>{
    send('settings-window:changed');
    const main=options.main();if(main&&!main.isDestroyed())main.webContents.send('settings-window:changed');
  };
  const authority=new SettingsScopeAuthority({trustedMain:mainTrusted,trustedSettings:event=>controller.trusted(event),readRevision:options.readRevision,changed:scope=>send('settings-window:scope',scope)});
  const bridge=createSettingsIpcBridge({ipc:options.ipc,trusted:event=>controller.trusted(event),trustedMain:mainTrusted,scope:()=>authority.snapshot(),assertScope:(...args)=>authority.assertCurrent(...args),canReadArchive:options.canReadArchive,changed:notify});
  const controller:SettingsWindowController=new SettingsWindowController({
    main:options.main,preload:options.preload,trustedUrl:options.settingsUrl,
    workArea:()=>{const window=controller.window??options.main();return window?screen.getDisplayMatching(window.getBounds()).workArea:screen.getPrimaryDisplay().workArea;},
    create:configuration=>{
      const window=new BrowserWindow(configuration);blocked=true;bridge.track(window.webContents);window.setMenu(null);
      window.on('close',event=>{if(blocked){event.preventDefault();send('settings-window:close-blocked');}});
      return window;
    },
    load:window=>window.loadURL(options.settingsUrl),
    onDim:value=>{const main=options.main();if(main&&!main.isDestroyed())main.webContents.send('settings-window:dim',value);},
  });
  function requireSettings(event:IpcMainInvokeEvent){if(!controller.trusted(event))throw Error('permission_denied');}
  options.ipc.handle('settings-window:open',async event=>{if(!mainTrusted(event))throw Error('permission_denied');await controller.open();});
  options.ipc.handle('settings-window:select',async(event,id)=>authority.select(event,id));
  options.ipc.handle('settings-window:bootstrap',async event=>{
    const window=controller.window;
    if(!window||window.isDestroyed()||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame?.url!==options.settingsUrl)throw Error('permission_denied');
    await controller.open();requireSettings(event);return authority.snapshot();
  });
  options.ipc.handle('settings-window:blocked',(event,value)=>{requireSettings(event);if(typeof value!=='boolean')throw Error('invalid_input');blocked=value;});
  options.ipc.handle('settings-window:close',event=>{requireSettings(event);controller.window?.close();});
  const fit=()=>controller.fit();
  screen.on('display-metrics-changed',fit);screen.on('display-removed',fit);
  return {
    ipcMain:bridge.ipcMain,
    allows:bridge.allows,
    register:bridge.register,
    notify,
    onStatus:(event:XiaozhiAgentEvent)=>{if(event.kind==='status')send('settings-window:status',event);},
    dispose:()=>{screen.removeListener('display-metrics-changed',fit);screen.removeListener('display-removed',fit);controller.dispose();},
  };
}
