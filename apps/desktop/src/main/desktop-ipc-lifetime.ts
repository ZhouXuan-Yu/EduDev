import type {IpcMain} from 'electron';

/** Own admitted IPC work until shutdown; callers cannot reopen the admission gate. */
export function createDesktopIpcLifetime(target:IpcMain){
  const pending=new Set<Promise<unknown>>();
  let closing=false,drained:Promise<void>|undefined;
  const handle:IpcMain['handle']=(channel,listener)=>target.handle(channel,(...args)=>{
    if(closing)throw Error('application_closing');
    // Register before invoking: synchronous listeners may themselves request quit.
    let resolve!:(value:unknown)=>void,reject!:(reason:unknown)=>void;
    const result=new Promise<unknown>((yes,no)=>{resolve=yes;reject=no;});
    pending.add(result);
    void result.finally(()=>pending.delete(result)).catch(()=>undefined);
    try{resolve(listener(...args));}catch(error){reject(error);}
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
