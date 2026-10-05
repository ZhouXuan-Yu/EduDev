import type {IpcMain} from 'electron';
import type {OmniEduStore} from '../db';
import {validQuestionContextSource} from '../../shared/question-context';
import {readQuestionContextSource} from './question-context-provider';
export function registerQuestionContextIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;store:OmniEduStore}){
 options.ipcMain.handle('questions:context-source',async(event,raw)=>{
  if(!options.allowed(event))return{ok:false,error:'permission_denied'};
  if(!validQuestionContextSource(raw))return{ok:false,error:'invalid_input'};
  try{return{ok:true,value:await readQuestionContextSource(options.store,raw)};}
  catch(error){return{ok:false,error:(error as Error).message==='source_changed'?'source_changed':'unavailable'};}
 });
}
