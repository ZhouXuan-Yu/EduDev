import {AsyncLocalStorage} from 'node:async_hooks';
import type {IpcMain,IpcMainInvokeEvent,WebContents} from 'electron';
import {SETTINGS_API_PREFIX,SETTINGS_ROUTES,SETTINGS_PERSONAL_MEMORY_ROUTES,type SettingsRoute,type SettingsSessionScope} from '../../shared/settings-window';

type Handler=Parameters<IpcMain['handle']>[1];
export interface SettingsBridgeOptions {
  ipc:IpcMain;
  trusted:(event:IpcMainInvokeEvent)=>boolean;
  trustedMain:(event:IpcMainInvokeEvent)=>boolean;
  scope:()=>SettingsSessionScope;
  assertScope:(event:IpcMainInvokeEvent,scope:SettingsSessionScope,sessionId?:string)=>Promise<void>;
  canReadArchive:(id:string)=>Promise<boolean>;
  changed:()=>void;
}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

/** Register original services once; delegate only a reviewed method under a
 * request-local capability. Never forge a main-window event or widen its guard. */
export function createSettingsIpcBridge(options:SettingsBridgeOptions){
  const handlers=new Map<string,Handler>();
  const settingsSenders=new WeakSet<WebContents>();
  const active=new AsyncLocalStorage<{event:IpcMainInvokeEvent;scope:SettingsSessionScope;selectionBound:boolean}>();
  const routes=[...Object.values(SETTINGS_ROUTES),...Object.values(SETTINGS_PERSONAL_MEMORY_ROUTES)];
  const channels=new Set(routes.map(route=>route.channel));
  // Observe existing main-window consumers without adding these APIs to settings.
  const writeChannels=new Set([...routes.filter(route=>route.write).map(route=>route.channel),'xiaozhi:model-select','xiaozhi:thinking-save']);
  const handle:IpcMain['handle']=(channel,listener)=>{
    if(channels.has(channel))handlers.set(channel,listener);
    options.ipc.handle(channel,(event,...args)=>{
      // Even direct calls to previously unguarded channels cannot bypass the
      // settings surface. This check also retains revoked window identities.
      if(settingsSenders.has(event.sender)||channels.has(channel)&&!options.trustedMain(event))throw Error('permission_denied');
      const result=listener(event,...args);
      if(!writeChannels.has(channel)||!options.trustedMain(event))return result;
      return Promise.resolve(result).then(value=>{if(!object(value)||value.ok!==false)options.changed();return value;});
    });
  };
  const ipcMain=new Proxy(options.ipc,{get(target,key){if(key==='handle')return handle;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
  function allows(event:IpcMainInvokeEvent){
    const permit=active.getStore(),now=options.scope();
    return !!permit&&permit.event===event&&options.trusted(event)&&(!permit.selectionBound||permit.scope.epoch===now.epoch&&permit.scope.sessionId===now.sessionId&&permit.scope.revision===now.revision);
  }
  async function invoke(route:SettingsRoute,event:IpcMainInvokeEvent,input:unknown){
    if(!options.trusted(event))throw Error('permission_denied');
    if(!object(input)||Object.keys(input).sort().join(',')!=='args,schemaVersion,scope'||input.schemaVersion!=='settings.request.v1'||!Array.isArray(input.args)||!object(input.scope))throw Error('invalid_input');
    const scope=input.scope;
    if(Object.keys(scope).sort().join(',')!=='epoch,revision,schemaVersion,sessionId'||scope.schemaVersion!=='settings.scope.v1'||!Number.isSafeInteger(scope.epoch)||Number(scope.epoch)<0||!(scope.sessionId===null||typeof scope.sessionId==='string')||!(scope.revision===null||typeof scope.revision==='string'))throw Error('invalid_input');
    const args=input.args;
    if(args.length<route.arity[0]||args.length>route.arity[1])throw Error('invalid_input');
    let id:string|undefined;
    if(route.scope==='id'||route.scope==='snapshot'){if(typeof args[0]!=='string'||!args[0])throw Error('invalid_input');id=args[0];}
    if(route.scope==='optionalId'&&args[0]!==undefined){if(typeof args[0]!=='string'||!args[0])throw Error('invalid_input');id=args[0];}
    if(route.scope==='input'||route.scope==='optionalInput'){
      if(args[0]!==undefined&&!object(args[0]))throw Error('invalid_input');
      if(route.scope==='input'&&(!object(args[0])||typeof args[0].sessionId!=='string'||!args[0].sessionId))throw Error('invalid_input');
      if(object(args[0])&&args[0].sessionId!==undefined){if(typeof args[0].sessionId!=='string'||!args[0].sessionId)throw Error('invalid_input');id=args[0].sessionId;}
    }
    const permit=scope as SettingsSessionScope;
    if(route.scope==='snapshot'&&id!==permit.sessionId){if(!await options.canReadArchive(id!))throw Error('permission_denied');id=undefined;}
    await options.assertScope(event,permit,id);
    // Selection changes revoke session requests. An already-admitted global
    // transaction retains its window role and the original domain CAS contract.
    const selectionBound=route.scope==='snapshot'||id!==undefined;
    const listener=handlers.get(route.channel);if(!listener)throw Error('settings_api_unavailable');
    // Each original handler still validates its domain schema and authorization.
    const result=await active.run({event,scope:permit,selectionBound},()=>listener(event,...args));
    if(selectionBound)await options.assertScope(event,permit);
    else if(!options.trusted(event))throw Error('permission_denied');
    if(route.write&&(!object(result)||result.ok!==false))options.changed();
    return result;
  }
  function register(){
    for(const route of routes){
      options.ipc.handle(SETTINGS_API_PREFIX+route.channel,(event,input)=>invoke(route,event,input));
    }
  }
  return {ipcMain,allows,register,track:(contents:WebContents)=>settingsSenders.add(contents)};
}
