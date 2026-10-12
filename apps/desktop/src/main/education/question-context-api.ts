import type {IpcMain} from 'electron';
import type {OmniEduStore} from '../db';
import {validQuestionContextSource,type QuestionContextResult} from '../../shared/question-context';
import {readQuestionContextSource} from './question-context-provider';
export function registerQuestionContextIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;store:OmniEduStore}){
 options.ipcMain.handle('questions:context-source',async(event,raw):Promise<QuestionContextResult>=>{
  if(!options.allowed(event))return{ok:false,error:'permission_denied'};
  if(!validQuestionContextSource(raw))return{ok:false,error:'invalid_input'};
  try{return{ok:true,value:await readQuestionContextSource(options.store,raw)};}
  catch(error){const code=(error as Error)?.message;return{ok:false,error:code==='source_changed'||code==='question_fact_conflict'?code:'unavailable'};}
 });
}
