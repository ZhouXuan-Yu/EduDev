import type {IpcMain} from 'electron';
import type {LearningReviewRepository} from './learning-review-repository';
import {validStudentTrainingInput,validStudentTrainingSource,validStudentTrainingResult} from '../../shared/student-training';
import {LEARNING_REVIEW_ERRORS,type LearningReviewError} from '../../shared/learning-review';
export function registerStudentTrainingIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;repository:LearningReviewRepository}){
 const methods=[['students:training','trainingView',validStudentTrainingInput],['students:training-source','trainingSource',validStudentTrainingSource],['students:training-result','recordTrainingResult',validStudentTrainingResult]] as const;
 for(const [channel,method,validate]of methods)options.ipcMain.handle(channel,async(event,raw)=>{
  if(!options.allowed(event))return{ok:false,error:'permission_denied'};
  if(!validate(raw))return{ok:false,error:'invalid_input'};
  try{return{ok:true,value:await(options.repository[method] as (input:never)=>Promise<unknown>)(raw as never)};}
  catch(error){const code=(error as Error)?.message;return{ok:false,error:Object.prototype.hasOwnProperty.call(LEARNING_REVIEW_ERRORS,code)?code as LearningReviewError:'unavailable'};}
 });
}
