import type {IpcMain} from 'electron';
import type {createXiaozhiProductionHost} from '../xiaozhi-agent/production-host';
import type {TeacherCandidateResult} from '../../shared/teacher-candidates';
export async function teacherCandidateResult<T>(action:()=>Promise<T>):Promise<TeacherCandidateResult<T>>{try{return{ok:true,value:await action()};}catch(error){const code=error instanceof Error?error.message:'';return{ok:false,error:['invalid_input','permission_denied','configuration','conflict','busy'].includes(code)?code as 'configuration':'configuration'};}}
export function registerTeacherCandidateIpc({ipcMain,allowed,host}:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;host:Pick<ReturnType<typeof createXiaozhiProductionHost>,'candidateHistory'|'candidateEvaluate'|'candidateReject'>}){
 for(const[name,method]of Object.entries({history:host.candidateHistory,evaluate:host.candidateEvaluate,reject:host.candidateReject}))ipcMain.handle('xiaozhi:candidate-'+name,(event,input)=>allowed(event)?teacherCandidateResult<unknown>(()=>method(input)):{ok:false,error:'permission_denied'});
}
