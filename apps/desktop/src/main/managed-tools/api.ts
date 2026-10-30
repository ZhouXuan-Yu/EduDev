import type {IpcMain,IpcMainInvokeEvent} from 'electron';
import type {createManagedTools} from './service';
import {MANAGED_TOOL_ERRORS} from '../../shared/managed-tools';
export function registerManagedToolIpc(options:{ipcMain:IpcMain;allowed:(event:IpcMainInvokeEvent)=>boolean;service:ReturnType<typeof createManagedTools>}){
  const controllers=new Map<string,AbortController>();
  const {service}=options;
  const error=(cause:unknown)=>({ok:false,error:cause instanceof Error&&cause.message in MANAGED_TOOL_ERRORS?cause.message:'configuration'});
  options.ipcMain.handle('managed-tools:list',async event=>{if(!options.allowed(event))return{ok:false,error:'permission_denied'};try{return{ok:true,value:[await service.view()]};}catch(cause){return error(cause);}});
  options.ipcMain.handle('managed-tools:prepare',async(event,raw:unknown)=>{
    if(!options.allowed(event))return{ok:false,error:'permission_denied'};
    const value=raw as {id?:unknown;commandId?:unknown};if(!value||typeof value.id!=='string'||value.id.length>64||typeof value.commandId!=='string'||!/^mtcmd_[a-f0-9-]{36}$/i.test(value.commandId)||Object.keys(value).sort().join(',')!=='commandId,id')return{ok:false,error:'invalid_input'};
    if(controllers.has(value.commandId))return{ok:false,error:'busy'};const controller=new AbortController();controllers.set(value.commandId,controller);
    try{await service.prepare(value.id,controller.signal);return{ok:true,value:await service.view(value.id)};}catch(cause){return error(cause);}finally{controllers.delete(value.commandId);}
  });
  options.ipcMain.handle('managed-tools:cancel',async(event,id:unknown)=>{if(!options.allowed(event))return{ok:false,error:'permission_denied'};if(typeof id!=='string')return{ok:false,error:'invalid_input'};controllers.get(id)?.abort();return{ok:true,value:null};});
  options.ipcMain.handle('managed-tools:remove',async(event,id:unknown)=>{if(!options.allowed(event))return{ok:false,error:'permission_denied'};if(typeof id!=='string')return{ok:false,error:'invalid_input'};try{return{ok:true,value:await service.remove(id)};}catch(cause){return error(cause);}});
}
