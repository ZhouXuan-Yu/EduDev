import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {JAVASCRIPT_COMPONENT as recommended,JAVASCRIPT_VERSIONS,reviewedJavaScriptVersion} from './manifest';
import {createManagedToolVersion} from './version-service';
import {createManagedWorkerQueue} from './worker-queue';
import {runManagedComputation} from './worker-client';
import {noLinks} from '../xiaozhi-agent/managed-skills';
import type {ManagedToolView} from '../../shared/managed-tools';

type VersionOptions=Parameters<typeof createManagedToolVersion>[0];
type Options=Omit<VersionOptions,'recipe'>;
type Progress=import('../../shared/managed-tools').ManagedToolProgress;
type Active={schemaVersion:1|2;id:string;version:string;sha256:string;previousVersion?:string};
/** All versions share one process queue and one atomic selection. Immutable
 * package installation remains the existing single-version implementation. */
export function createManagedTools(options:Options){
 const root=path.resolve(options.root),folder=path.join(root,recommended.id),pointer=path.join(folder,'active.json');
 const queue=createManagedWorkerQueue(),pins=new Map<string,number>(),versions=new Map<string,ReturnType<typeof createManagedToolVersion>>();
 const closeSignal=new AbortController();let closed=false,selecting:string|undefined,notice='',activationTail:Promise<unknown>=Promise.resolve();
 let bundled=options.bundledWasm;if(bundled===undefined){try{bundled=createRequire(import.meta.url).resolve('quickjs-wasi/quickjs.wasm');}catch{bundled=null;}}
 const baseWorker=options.health||runManagedComputation;
 for(const recipe of JAVASCRIPT_VERSIONS)versions.set(recipe.version,createManagedToolVersion({...options,recipe,
  bundledWasm:recipe.version===recommended.version?bundled:null,
  health:(file,code,input,signal,version)=>queue.run(owned=>baseWorker(file,code,input,owned,version),signal)}));
 const get=(version:string)=>{reviewedJavaScriptVersion(version);return versions.get(version)!;};
 const stop=(signal?:AbortSignal)=>{if(closed||signal?.aborted)throw Error('cancelled');};
 async function readActive():Promise<Active|undefined>{
  try{noLinks(pointer);const value=JSON.parse(await fs.readFile(pointer,'utf8')) as Active;const recipe=reviewedJavaScriptVersion(value.version);
   if(![1,2].includes(value.schemaVersion)||value.id!==recommended.id||value.sha256!==recipe.sha256||value.previousVersion!==undefined&&!JAVASCRIPT_VERSIONS.some(v=>v.version===value.previousVersion))throw Error('configuration');return value;
  }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'||(error instanceof Error&&error.message==='skill_source_changed'&&!await fs.stat(pointer).catch(()=>null)))return undefined;throw error;}
 }
 function serialize<T>(action:()=>Promise<T>):Promise<T>{const result=activationTail.catch(()=>{}).then(action);activationTail=result;return result;}
 async function atomicSelect(version:string,signal?:AbortSignal,onlyIfMissing=false){
  return serialize(async()=>{
   stop(signal);const prior=await readActive().catch(()=>undefined);noLinks(pointer,true);if(onlyIfMissing&&prior||prior?.version===version)return;
   const recipe=reviewedJavaScriptVersion(version);noLinks(folder,true);await fs.mkdir(folder,{recursive:true});noLinks(folder);
   const old=await fs.readFile(pointer).catch(error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;});
   const next=path.join(folder,'active-'+randomUUID()+'.json');await fs.writeFile(next,JSON.stringify({schemaVersion:2,id:recipe.id,version,sha256:recipe.sha256,...(prior?{previousVersion:prior.version}:{})}),{flag:'wx'});
   try{stop(signal);await fs.rename(next,pointer);if(signal?.aborted||closed){
     if(old){const restore=path.join(folder,'restore-'+randomUUID()+'.json');await fs.writeFile(restore,old,{flag:'wx'});await fs.rename(restore,pointer);}else await fs.unlink(pointer);throw Error('cancelled');
   }}finally{await fs.unlink(next).catch(()=>{});}
  });
 }
 function usage(version:string,physical=0){return Math.max(pins.get(version)||0,physical);}
 async function versionView(version:string){const view=await get(version).view();return{...view,inUse:usage(version,view.inUse)};}
 async function view(id:string=recommended.id):Promise<ManagedToolView>{
  if(id!==recommended.id)return get(recommended.version).view(id);
  try{
   const selected=await readActive(),version=selected?.version||recommended.version,active=await versionView(version);
   const states=await Promise.all(JAVASCRIPT_VERSIONS.map(async recipe=>{const value=await versionView(recipe.version);return{version:recipe.version,ready:value.status==='ready',origin:value.origin,inUse:value.inUse};}));
   const worker=queue.state(),preparing=selecting?await get(selecting).view():undefined;
   return{...active,recommendedVersion:recommended.version,previousVersion:selected?.previousVersion,versions:states,running:worker.running,queued:worker.queued,maximumConcurrent:worker.limit,
    ...(preparing?{phase:preparing.phase,downloadedBytes:preparing.downloadedBytes,preparingVersion:selecting,preparingBytes:preparing.downloadBytes}:{}),...(notice?{notice}:{})};
  }catch(error){const fallback=await get(recommended.version).view();return{...fallback,status:'fault',reason:'组件版本选择记录暂时不可用',nextAction:'原有文件保留，请重新检查组件',error:'configuration'};}
 }
 async function prepareVersion(version:string,signal?:AbortSignal,listener?:(state:Progress)=>void){stop(signal);return get(version).prepare(recommended.id,AbortSignal.any([closeSignal.signal,...(signal?[signal]:[])]),listener);}
 async function prepare(id:string,signal?:AbortSignal,listener?:(state:Progress)=>void){
  if(id!==recommended.id)throw Error('authorization_required');const selected=await readActive().catch(()=>undefined),version=selected?.version||recommended.version;
  const file=await prepareVersion(version,signal,listener);await atomicSelect(version,signal,true);return file;
 }
 async function activate(id:string,version:string,signal?:AbortSignal){
  if(id!==recommended.id)throw Error('unsupported');reviewedJavaScriptVersion(version);stop(signal);if(selecting)throw Error('busy');selecting=version;notice='';
  try{await prepareVersion(version,signal);await atomicSelect(version,signal);selecting=undefined;return await view();}
  catch(error){notice='新版本准备未完成，继续保留原有可用版本。';throw error;}finally{selecting=undefined;}
 }
 async function freeze(){
  stop();const selected=await readActive().catch(()=>undefined),version=selected?.version||recommended.version;get(version);pins.set(version,(pins.get(version)||0)+1);let released=false;
  const available=()=>{if(released||closed)throw Error('cancelled');};
  return{version,
   view:async(id:string=recommended.id)=>{available();return id===recommended.id?{...await versionView(version),recommendedVersion:recommended.version}:get(version).view(id);},
   prepare:async(id:string,signal?:AbortSignal,listener?:(state:Progress)=>void)=>{available();if(id!==recommended.id)throw Error('authorization_required');const file=await prepareVersion(version,signal,listener);await atomicSelect(version,signal,true);available();return file;},
   compute:async(code:string,input:unknown,signal?:AbortSignal,listener?:(state:Progress)=>void)=>{available();const lease=await get(version).acquire(signal,listener);try{await atomicSelect(version,signal,true);available();return await queue.run(owned=>baseWorker(lease.file,code,input,owned,version),signal);}finally{lease.release();}},
   acquire:async(signal?:AbortSignal,listener?:(state:Progress)=>void)=>{available();return get(version).acquire(signal,listener);},
   release(){if(released)return;released=true;const count=(pins.get(version)||1)-1;if(count)pins.set(version,count);else pins.delete(version);},
  };
 }
 async function removeVersion(id:string,version:string){
  if(id!==recommended.id)throw Error('unsupported');stop();if(selecting||usage(version))throw Error('busy');get(version);
  await serialize(async()=>{
   if(usage(version))throw Error('busy');const current=await readActive();
   await get(version).remove(id);
   if(current?.version===version){
    const previous=current.previousVersion&&await versionView(current.previousVersion);
    if(previous&&previous.status==='ready'){
     const recipe=reviewedJavaScriptVersion(previous.version),next=path.join(folder,'active-'+randomUUID()+'.json');await fs.writeFile(next,JSON.stringify({schemaVersion:2,id,version:recipe.version,sha256:recipe.sha256}),{flag:'wx'});await fs.rename(next,pointer);
    }else await fs.unlink(pointer).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});
   }else if(current?.previousVersion===version){
    const next=path.join(folder,'active-'+randomUUID()+'.json');const {previousVersion,...retained}=current;await fs.writeFile(next,JSON.stringify(retained),{flag:'wx'});await fs.rename(next,pointer);
   }
  });return view();
 }
 return{view,prepare,freeze,activate,
  async upgrade(id:string,signal?:AbortSignal){return activate(id,recommended.version,signal);},
  async rollback(id:string,signal?:AbortSignal){const active=await readActive();if(!active?.previousVersion)throw Error('unsupported');const prior=await versionView(active.previousVersion);if(prior.status!=='ready')throw Error('health_failed');return activate(id,active.previousVersion,signal);},
  async acquire(signal?:AbortSignal,listener?:(state:Progress)=>void){const scope=await freeze();try{const lease=await scope.acquire(signal,listener);return{...lease,release:()=>{lease.release();scope.release();}};}catch(error){scope.release();throw error;}},
  async compute(code:string,input:unknown,signal?:AbortSignal,listener?:(state:Progress)=>void){const scope=await freeze();try{return await scope.compute(code,input,signal,listener);}finally{scope.release();}},
  async remove(id:string){const active=await readActive();return removeVersion(id,active?.version||recommended.version);},removeVersion,
  async dispose(){closed=true;closeSignal.abort();await queue.dispose();await Promise.allSettled([...versions.values()].map(v=>v.dispose()));await activationTail.catch(()=>{});},
 };
}
