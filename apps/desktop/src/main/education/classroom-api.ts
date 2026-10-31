import {validClassroomPlanId,validClassroomPlanEdit,validClassroomPlanDecision} from '../../shared/classroom-plan';
import type {createClassroomPlanState} from './classroom-plan-state';
import type {IpcMain} from 'electron';
import type {createClassroomState} from './classroom-state';
import {classroomErrors} from '../../shared/classroom';
export function registerClassroomIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;state:ReturnType<typeof createClassroomState>;plans:ReturnType<typeof createClassroomPlanState>}){
 for(const method of ['list','read','edit','decide'] as const){
  options.ipcMain.handle('classroom:plan-'+method,async(event,input:unknown)=>{
   if(!options.allowed(event))return{ok:false,error:'permission_denied'};
   try{
    if(method==='list'){if(input!==undefined)throw Error('invalid_input');return{ok:true,data:await options.plans.list()};}
    if(method==='read'){if(!validClassroomPlanId(input))throw Error('invalid_input');return{ok:true,data:await options.plans.read(input)};}
    if(method==='edit'){if(!validClassroomPlanEdit(input))throw Error('invalid_input');return{ok:true,data:await options.plans.edit(input)};}
    if(!validClassroomPlanDecision(input))throw Error('invalid_input');
    const data=await options.plans.decide(input);
    return{ok:true,data};
   }catch(error){const code=error instanceof Error?error.message:'';return{ok:false,error:classroomErrors[code]?code:'unavailable'};}
  });
 }
 for(const [channel,method]of [['classroom:list','list'],['classroom:read','read'],['classroom:decide','decide']]as const){
  options.ipcMain.handle(channel,async(event,input)=>{
   if(!options.allowed(event))return{ok:false,error:'permission_denied'};
   try{if(method==='read'&&(typeof input!=='string'||input.length>80))throw new Error('invalid_input');
    const data=method==='list'?await options.state.list():method==='read'?await options.state.read(input):await options.state.decide(input);return{ok:true,data};
   }catch(e){const code=(e as Error).message;return{ok:false,error:classroomErrors[code]?code:'unavailable'};}
  });
 }
}
