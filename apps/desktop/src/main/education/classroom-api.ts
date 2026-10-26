import type {IpcMain} from 'electron';
import type {createClassroomState} from './classroom-state';
import {classroomErrors} from '../../shared/classroom';
export function registerClassroomIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;state:ReturnType<typeof createClassroomState>}){
 for(const [channel,method]of [['classroom:list','list'],['classroom:read','read'],['classroom:decide','decide']]as const){
  options.ipcMain.handle(channel,async(event,input)=>{
   if(!options.allowed(event))return{ok:false,error:'permission_denied'};
   try{if(method==='read'&&(typeof input!=='string'||input.length>80))throw new Error('invalid_input');
    const data=method==='list'?await options.state.list():method==='read'?await options.state.read(input):await options.state.decide(input);return{ok:true,data};
   }catch(e){const code=(e as Error).message;return{ok:false,error:classroomErrors[code]?code:'unavailable'};}
  });
 }
}
