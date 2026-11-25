import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import type { createPersonalMemoryOperations } from './operations';

export function registerPersonalMemoryIpc(ipc:IpcMain, allowed:(event:IpcMainInvokeEvent)=>boolean,
  memory:ReturnType<typeof createPersonalMemoryOperations>) {
  ipc.handle('xiaozhi:personal-memory-view',event=>allowed(event) ? memory.view() : {ok:false,error:'permission_denied'});
  for (const [name,action] of Object.entries({
    'auto':memory.setEnabled,'preview':memory.preview,'adopt':memory.adopt,'reject':memory.reject,'edit':memory.edit,
    'source':memory.sourceStatus,'source-change':memory.setSource,
    'record-preview':memory.previewRecord,
    'job-cancel':memory.cancelJob,
    'queue':memory.queue,
  })) {
    ipc.handle(`xiaozhi:personal-memory-${name}`,(event,input:unknown)=>
      allowed(event) ? action(input) : {ok:false,error:'permission_denied'});
  }
}
