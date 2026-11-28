import {contextBridge,ipcRenderer} from 'electron';
import type {BrowserChromeResult,BrowserControlCommand} from '../shared/xiaozhi-browser';

let nextId=0;
contextBridge.exposeInMainWorld('xiaozhiBrowserToolbar',{
  run(command:BrowserControlCommand,value?:string):Promise<BrowserChromeResult>{
    const id=++nextId;
    return new Promise(resolve=>{
      const reply=(_event:Electron.IpcRendererEvent,replyId:number,result:BrowserChromeResult)=>{
        if(id!==replyId)return;
        clearTimeout(expiry);
        ipcRenderer.removeListener('xiaozhi:float-result',reply);
        resolve(result);
      };
      const expiry=setTimeout(()=>{ipcRenderer.removeListener('xiaozhi:float-result',reply);resolve({ok:false});},1200);
      ipcRenderer.on('xiaozhi:float-result',reply);
      ipcRenderer.send('xiaozhi:float-toolbar',id,command,value);
    });
  }
});
