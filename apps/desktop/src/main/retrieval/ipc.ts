import {ipcMain as electronIpcMain,type BrowserWindow} from 'electron';
import type {OmniEduStore} from '../db';
import {VectorHost} from './vector-host';
import {validRetrievalAction} from '../../shared/retrieval';
export function registerRetrievalIpc(store:OmniEduStore,window:()=>BrowserWindow|undefined,ipcMain:Pick<Electron.IpcMain,'handle'>=electronIpcMain){
  store.retrieval.configure(new VectorHost(()=>store.getDataRoot()));
  const check=(event:Electron.IpcMainInvokeEvent)=>{const w=window();if(!w||w.isDestroyed()||event.sender!==w.webContents||event.senderFrame!==w.webContents.mainFrame)throw Error('permission_denied');};
  ipcMain.handle('retrieval:status',event=>{check(event);return store.retrieval.status();});
  ipcMain.handle('retrieval:questions',(event,input)=>{check(event);return store.retrieval.questions(input);});
  ipcMain.handle('retrieval:action',(event,input)=>{check(event);if(!validRetrievalAction(input))throw Error('invalid_input');return store.retrieval.action(input.action);});
}
