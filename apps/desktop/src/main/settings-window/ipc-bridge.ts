import {AsyncLocalStorage} from 'node:async_hooks';
import type {IpcMain,IpcMainInvokeEvent,WebContents} from 'electron';
import {SETTINGS_API_PREFIX,SETTINGS_ROUTES,type SettingsSessionScope,type SettingsMethod} from '../../shared/settings-window';

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
  const active=new AsyncLocalStorage<{event:IpcMainInvokeEvent;scope:SettingsSessionScope}>();
  const channels=new Set(Object.values(SETTINGS_ROUTES).map(route=>route.channel));
  const handle:IpcMain['handle']=(channel,listener)=>{
    if(channels.has(channel))handlers.set(channel,listener);
    options.ipc.handle(channel,(event,...args)=>{
      // Even direct calls to previously unguarded channels cannot bypass the
      // settings surface. This check also retains revoked window identities.
      if(settingsSenders.has(event.sender)||channels.has(channel)&&!options.trustedMain(event))throw Error('permission_denied');
      return listener(event,...args);
    });
  };
  const ipcMain=new Proxy(options.ipc,{get(target,key){if(key==='handle')return handle;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
  function allows(event:IpcMainInvokeEvent){
    const permit=active.getStore(),now=options.scope();
    return !!permit&&permit.event===event&&options.trusted(event)&&permit.scope.epoch===now.epoch&&permit.scope.sessionId===now.sessionId&&permit.scope.revision===now.revision;
  }
  async function invoke(method:SettingsMethod,event:IpcMainInvokeEvent,input:unknown){
    if(!options.trusted(event))throw Error('permission_denied');
    if(!object(input)||Object.keys(input).sort().join(',')!=='args,schemaVersion,scope'||input.schemaVersion!=='settings.request.v1'||!Array.isArray(input.args)||!object(input.scope))throw Error('invalid_input');
    const scope=input.scope;
    if(Object.keys(scope).sort().join(',')!=='epoch,revision,schemaVersion,sessionId'||scope.schemaVersion!=='settings.scope.v1'||!Number.isSafeInteger(scope.epoch)||Number(scope.epoch)<0||!(scope.sessionId===null||typeof scope.sessionId==='string')||!(scope.revision===null||typeof scope.revision==='string'))throw Error('invalid_input');
    const route=SETTINGS_ROUTES[method],args=input.args;
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
    const listener=handlers.get(route.channel);if(!listener)throw Error('settings_api_unavailable');
    // Each original handler still validates its domain schema and authorization.
    const result=await active.run({event,scope:permit},()=>listener(event,...args));
    await options.assertScope(event,permit);
    if(route.write&&(!object(result)||result.ok!==false))options.changed();
    return result;
  }
  function register(){
    for(const method of Object.keys(SETTINGS_ROUTES) as SettingsMethod[]){
      options.ipc.handle(SETTINGS_API_PREFIX+SETTINGS_ROUTES[method].channel,(event,input)=>invoke(method,event,input));
    }
  }
  return {ipcMain,allows,register,track:(contents:WebContents)=>settingsSenders.add(contents)};
}
