import { app, Menu, dialog, type BrowserWindow, type IpcMain, type MenuItemConstructorOptions } from 'electron';
import type { DesktopChromeState, DesktopCommand, DesktopMenu } from '../../shared/desktop-chrome';
import { buildWindowsTitleBarOverlayForZoomLevel } from './zcode-overlay';

export const nativeChromeEnabled = process.platform === 'win32' && process.env.OMNI_EDU_NATIVE_CHROME !== '0';
export function nativeChromeOptions() {
  return nativeChromeEnabled ? { titleBarStyle: 'hidden' as const, titleBarOverlay: buildWindowsTitleBarOverlayForZoomLevel(0,'light'), autoHideMenuBar: true } : {};
}
const groups: DesktopMenu[] = ['file','edit','view','help'];
function state(window: BrowserWindow): DesktopChromeState {
  return {enabled:nativeChromeEnabled,platform:process.platform,zoomFactor:window.webContents.getZoomFactor(),maximized:window.isMaximized(),height:36};
}
export function installDesktopChrome(window: BrowserWindow) {
  const send=(command:DesktopCommand)=>{if(!window.isDestroyed())window.webContents.send('desktop:command',command);};
  const sync=()=>{if(window.isDestroyed())return;if(nativeChromeEnabled)window.setTitleBarOverlay(buildWindowsTitleBarOverlayForZoomLevel(window.webContents.getZoomLevel(),'light'));window.webContents.send('desktop:state',state(window));};
  const zoom=(delta:number)=>{window.webContents.setZoomLevel(Math.min(Math.log(1.5)/Math.log(1.2),Math.max(Math.log(0.75)/Math.log(1.2),window.webContents.getZoomLevel()+delta)));sync();};
  const template: MenuItemConstructorOptions[] = [
    {id:'file',label:'文件',submenu:[
      {id:'new-chat',label:'新聊天',accelerator:'CmdOrCtrl+N',click:()=>send('new-chat')},
      {id:'settings',label:'设置',accelerator:'CmdOrCtrl+,',click:()=>send('settings')},
      {type:'separator'},{label:'关闭窗口',role:'close'}]},
    {id:'edit',label:'编辑',submenu:[{label:'撤销',role:'undo'},{label:'重做',role:'redo'},{type:'separator'},
      {label:'剪切',role:'cut'},{label:'复制',role:'copy'},{label:'粘贴',role:'paste'},{type:'separator'},{label:'全选',role:'selectAll'}]},
    {id:'view',label:'视图',submenu:[
      {id:'sidebar',label:'显示或隐藏会话侧栏',click:()=>send('sidebar')},
      {id:'files',label:'显示或隐藏文件面板',click:()=>send('files')},
      {type:'separator'},{id:'zoom-in',label:'放大',accelerator:'CmdOrCtrl+Plus',click:()=>zoom(1)},
      {id:'zoom-out',label:'缩小',accelerator:'CmdOrCtrl+-',click:()=>zoom(-1)},
      {id:'zoom-reset',label:'实际大小',accelerator:'CmdOrCtrl+0',click:()=>{window.webContents.setZoomLevel(0);sync();}},
      {type:'separator'},{label:'全屏',role:'togglefullscreen'}]},
    {id:'help',label:'帮助',submenu:[{id:'about',label:'关于小智',click:()=>{void dialog.showMessageBox(window,{type:'info',title:'关于小智',message:'小智教育工作台',detail:`版本 ${app.getVersion()}\n本地教育与办公智能体 · Pi SDK\n资料与产物保存在本机；云端请求使用你配置的模型。`});}}]},
  ];
  const menu=Menu.buildFromTemplate(template);Menu.setApplicationMenu(menu);window.setMenuBarVisibility(!nativeChromeEnabled);
  window.webContents.on('did-finish-load',sync);window.webContents.on('zoom-changed',sync);window.on('maximize',sync);window.on('unmaximize',sync);
  return menu;
}
export function registerDesktopChromeIpc(ipc:IpcMain,getWindow:()=>BrowserWindow|undefined) {
  const allowed=(event:Electron.IpcMainInvokeEvent)=>{const window=getWindow();return window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame?window:undefined;};
  ipc.handle('desktop:state',event=>{const window=allowed(event);if(!window)throw new Error('permission_denied');return state(window);});
  ipc.handle('desktop:menu',(event,input:unknown)=>{
    const window=allowed(event);if(!window)return {ok:false,error:'permission_denied'};
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='group,x,y')return {ok:false,error:'invalid_input'};
    const {group,x,y}=input as {group:DesktopMenu;x:number;y:number};const [width,height]=window.getContentSize();
    const factor=window.webContents.getZoomFactor();
    if(!groups.includes(group)||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x*factor>width||y*factor>height)return {ok:false,error:'invalid_input'};
    const menu=Menu.getApplicationMenu()?.getMenuItemById(group)?.submenu;if(!menu)return {ok:false,error:'unavailable'};
    menu.popup({window,x:Math.round(x*factor),y:Math.round(y*factor)});return {ok:true};
  });
}
