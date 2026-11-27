import type {IpcMain} from 'electron';
import type {BackupPublicationBarrier} from './backup/publication-barrier';
import {SETTINGS_API_PREFIX} from '../shared/settings-window';

// These IPCs coordinate a snapshot or inspect its lifecycle. They still drain at shutdown.
const snapshotChannels = new Set([
  'app:exportDataRoot', 'app:prepareWindowsUpdate', 'app:cancelDataBackup', 'app:getDataRoot',
  // Window lifecycle changes have no business publication or database write.
  'settings-window:open','settings-window:select','settings-window:bootstrap','settings-window:blocked','settings-window:close',
]);

/** Own admitted IPC work until shutdown; callers cannot reopen the admission gate. */
export function createDesktopIpcLifetime(target:IpcMain, publications?:BackupPublicationBarrier){
  const pending=new Set<Promise<unknown>>();
  let closing=false,drained:Promise<void>|undefined;
  const handle:IpcMain['handle']=(channel,listener)=>target.handle(channel,(...args)=>{
    if(closing)throw Error('application_closing');
    // Register before invoking: synchronous listeners may themselves request quit.
    let resolve!:(value:unknown)=>void,reject!:(reason:unknown)=>void;
    const result=new Promise<unknown>((yes,no)=>{resolve=yes;reject=no;});
    pending.add(result);
    void result.finally(()=>pending.delete(result)).catch(()=>undefined);
    try{
      // Settings delegates to the same service; retain its publication class.
      // Otherwise a snapshot would wait for its own outer publisher forever.
      const publicationChannel=channel.startsWith(SETTINGS_API_PREFIX)?channel.slice(SETTINGS_API_PREFIX.length):channel;
      if (publications && !snapshotChannels.has(publicationChannel)) {
        const operation = publications.tryPublish(()=>listener(...args));
        if (!operation) throw Error('backup_busy');
        resolve(operation);
      } else resolve(listener(...args));
    } catch(error){reject(error);}
    return result;
  });
  const ipcMain=new Proxy(target,{
    get(object,key){if(key==='handle')return handle;const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;},
  });
  return {ipcMain,close(){
    closing=true;
    return drained??=Promise.allSettled([...pending]).then(()=>undefined);
  }};
}
