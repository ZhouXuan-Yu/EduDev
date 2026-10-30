import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {t as readTar} from 'tar';
import {JAVASCRIPT_COMPONENT as recipe} from './manifest';
import {runManagedComputation} from './worker-client';
import {noLinks} from '../xiaozhi-agent/managed-skills';
import {MANAGED_TOOL_ERRORS,type ManagedToolView,type ManagedToolPhase} from '../../shared/managed-tools';

type Progress={phase:ManagedToolPhase;downloadedBytes:number;error?:string};
type Job={controller:AbortController;consumers:Set<symbol>;listeners:Set<(state:Progress)=>void>;promise:Promise<string>};
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const known=(error:unknown)=>{const code=error instanceof Error?error.message:'';return code in MANAGED_TOOL_ERRORS?code:(error as NodeJS.ErrnoException)?.code==='ENOSPC'?'no_space':(error as NodeJS.ErrnoException)?.code==='EACCES'||(error as NodeJS.ErrnoException)?.code==='EPERM'?'permission_denied':'configuration';};
/** Component files are replaceable machine configuration, never teacher data.
 * The only production recipe is static and free; model/IPC cannot supply URLs. */
export function createManagedTools(options:{root:string;bundledWasm?:string|null;
  /** Main-only controlled transport for deterministic installer faults. */
  fetch?:typeof fetch;health?:typeof runManagedComputation;freeBytes?:()=>Promise<number>;enabled?:()=>boolean}){
  const root=path.resolve(options.root),folder=path.join(root,recipe.id),versionDir=path.join(folder,recipe.version),target=path.join(versionDir,'engine.wasm'),pointer=path.join(folder,'active.json');
  const enabled=options.enabled||(()=>process.env.OMNI_EDU_XIAOZHI_COMPUTE!=='0');
  const fetcher=options.fetch||globalThis.fetch,health=options.health||runManagedComputation;
  let bundled=options.bundledWasm;
  if(bundled===undefined){try{bundled=createRequire(import.meta.url).resolve('quickjs-wasi/quickjs.wasm');}catch{bundled=null;}}
  let progress:Progress|undefined,job:Job|undefined,closed=false,removing=false;
  const leases=new Map<string,number>(),healthy=new Set<string>();
  const workers=new Map<AbortController,Promise<Awaited<ReturnType<typeof runManagedComputation>>>>();
  const checking=new Map<string,Promise<void>>();
  async function invoke(file:string,code:string,input:unknown,signal?:AbortSignal){if(closed)throw Error('cancelled');const controller=new AbortController();const work=health(file,code,input,AbortSignal.any([controller.signal,...(signal?[signal]:[])]));workers.set(controller,work);try{return await work;}finally{workers.delete(controller);}}
  const supported=()=>Number(process.versions.node.split('.')[0])>=recipe.minimumNodeMajor&&typeof WebAssembly!=='undefined';
  async function checkFile(file:string){noLinks(file);const bytes=await fs.readFile(file);if(bytes.length!==recipe.bytes||hash(bytes)!==recipe.sha256)throw Error('checksum_mismatch');return file;}
  async function checkHealth(file:string,signal?:AbortSignal){
    await checkFile(file);signal?.throwIfAborted();
    const key=file+':'+recipe.sha256;
    if(!healthy.has(key)){
      let check=checking.get(key);if(!check){check=(async()=>{const result=await invoke(file,'return {answer:6*7,process:typeof process,require:typeof require,fetch:typeof fetch};',null,signal);
        const value=result.value as Record<string,unknown>;if(value?.answer!==42||value.process!=='undefined'||value.require!=='undefined'||value.fetch!=='undefined')throw Error('health_failed');healthy.add(key);})();checking.set(key,check);void check.finally(()=>checking.delete(key)).catch(()=>{});}
      await check;signal?.throwIfAborted();
    }
    return file;
  }
  async function installed(){
    try{noLinks(pointer);const value=JSON.parse(await fs.readFile(pointer,'utf8'));
      if(value.schemaVersion!==1||value.id!==recipe.id||value.version!==recipe.version||value.sha256!==recipe.sha256)throw Error('configuration');
      return await checkHealth(target);
    }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'||(error instanceof Error&&error.message==='skill_source_changed'&&!await fs.stat(pointer).catch(()=>null)))return undefined;throw error;}
  }
  async function existing(){
    const cached=await installed();if(cached)return{file:cached,origin:'download' as const};
    if(bundled&&await fs.stat(bundled).catch(()=>null)){try{return{file:await checkHealth(bundled),origin:'builtin' as const};}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
    return undefined;
  }
  async function view(id:string=recipe.id):Promise<ManagedToolView>{
    const base={id,name:recipe.name,version:recipe.version,sourceUrl:recipe.sourceUrl,license:recipe.license,downloadBytes:recipe.archiveBytes,installedBytes:recipe.bytes,inUse:[...leases.values()].reduce((a,b)=>a+b,0),...progress};
    if(id!==recipe.id)return{...base,id,name:id,sourceUrl:'',version:'',status:'authorization_required',reason:'不在已认可的免费工具清单',nextAction:'先明确工具来源、用途、权限和费用；当前免费工具仍可用'};
    if(!enabled())return{...base,status:'unsupported',reason:'本地自动计算已暂停',nextAction:'已有成果可继续读取；取消启动停用设置并重启后可恢复计算'};
    if(!supported())return{...base,status:'unsupported',reason:'当前应用运行时不支持该组件',nextAction:'更新到兼容的小智桌面版本'};
    try{const found=await existing();return found?{...base,status:'ready',reason:found.origin==='builtin'?'内置组件已通过实际健康检查':'已下载组件通过校验与健康检查',nextAction:'可离线计算',origin:found.origin}
      :progress?.phase==='failed'?{...base,status:'fault',reason:MANAGED_TOOL_ERRORS[progress.error||'configuration']||MANAGED_TOOL_ERRORS.configuration,nextAction:'可重新准备；中断后会重新下载'}:{...base,status:'missing_dependency',reason:'本地计算组件尚未准备',nextAction:'准备已认可的免费组件；中断后会重新下载'};
    }catch(error){const code=known(error);return{...base,...(await fs.stat(pointer).catch(()=>null)?{origin:'download' as const}:{}),status:'fault',reason:MANAGED_TOOL_ERRORS[code],nextAction:'保留已有成果；重新检查组件，未占用时可卸载后再准备',error:code};}
  }
  let lastProgressNotification=0;
  function publish(value:Progress){const before=progress;progress=value;const now=Date.now();if(before?.phase===value.phase&&value.phase==='downloading'&&before.downloadedBytes>0&&value.downloadedBytes!==recipe.archiveBytes&&now-lastProgressNotification<100)return;lastProgressNotification=now;for(const listener of job?.listeners||[])try{listener({...value});}catch{}}
  async function install(signal:AbortSignal){
    let temp:string|undefined;
    try{
      publish({phase:'checking',downloadedBytes:0});signal.throwIfAborted();
      const found=await existing();if(found){publish({phase:'ready',downloadedBytes:0});return found.file;}
      noLinks(root,true);await fs.mkdir(root,{recursive:true});noLinks(root);
      const free=options.freeBytes?await options.freeBytes():await fs.statfs(root).then(s=>Number(s.bavail)*Number(s.bsize));
      if(free<recipe.requiredFreeBytes)throw Error('no_space');
      if(removing)throw Error('busy');
      temp=path.join(root,'.prepare-'+randomUUID());await fs.mkdir(temp);noLinks(temp);
      const archive=path.join(temp,'package.tgz');
      publish({phase:'downloading',downloadedBytes:0});
      let response:Response;
      try{response=await fetcher(recipe.sourceUrl,{redirect:'error',credentials:'omit',signal});}catch{signal.throwIfAborted();throw Error('network_error');}
      if(!response.ok||!response.body)throw Error('network_error');
      const stream=await fs.open(archive,'wx'),reader=response.body.getReader();let count=0;
      try{for(;;){signal.throwIfAborted();const next=await reader.read();if(next.done)break;count+=next.value.length;if(count>recipe.archiveBytes)throw Error('checksum_mismatch');await stream.writeFile(next.value);publish({phase:'downloading',downloadedBytes:count});}}
      catch(error){await reader.cancel().catch(()=>{});signal.throwIfAborted();const category=known(error);throw Error(category==='configuration'?'network_error':category);}
      finally{reader.releaseLock();await stream.close();}
      signal.throwIfAborted();publish({phase:'verifying',downloadedBytes:count});
      const archiveBytes=await fs.readFile(archive);if(count!==recipe.archiveBytes||hash(archiveBytes)!==recipe.archiveSha256)throw Error('checksum_mismatch');
      publish({phase:'installing',downloadedBytes:count});let expanded=0,binary:Buffer|undefined,selected=false,archiveInvalid=false;const pending:Promise<void>[]=[];
      await readTar({file:archive,strict:true,onReadEntry:entry=>{
        const parts=entry.path.split('/');expanded+=entry.size;
        if(expanded>recipe.maximumExpandedBytes||entry.path.includes('\\')||parts.some(p=>p==='..')||path.posix.isAbsolute(entry.path)||!['File','Directory'].includes(entry.type)){archiveInvalid=true;entry.resume();return;}
        if(entry.path!==recipe.entry){entry.resume();return;}
        if(selected||entry.size!==recipe.bytes){archiveInvalid=true;entry.resume();return;}selected=true;
        pending.push(new Promise<void>((resolve,reject)=>{const chunks:Buffer[]=[];let length=0;
          entry.on('data',(chunk:Buffer)=>{length+=chunk.length;if(length>recipe.bytes){entry.destroy(Error('archive_invalid'));return;}chunks.push(chunk);});
          entry.once('error',reject);entry.once('end',()=>{binary=Buffer.concat(chunks);resolve();});}));
      }}).catch(()=>{throw Error('archive_invalid');});await Promise.all(pending);
      signal.throwIfAborted();if(archiveInvalid)throw Error('archive_invalid');if(!binary||hash(binary)!==recipe.sha256)throw Error('checksum_mismatch');
      const staged=path.join(temp,'engine.wasm');await fs.writeFile(staged,binary,{flag:'wx'});
      publish({phase:'health',downloadedBytes:count});await checkHealth(staged,signal);signal.throwIfAborted();
      publish({phase:'activating',downloadedBytes:count});noLinks(versionDir,true);await fs.mkdir(versionDir,{recursive:true});noLinks(versionDir);
      // Never overwrite an in-use version or an unrecognized existing file.
      try{await fs.copyFile(staged,target,2);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;await checkFile(target);}
      await checkHealth(target,signal);signal.throwIfAborted();
      const next=path.join(folder,'active-'+randomUUID()+'.json');await fs.writeFile(next,JSON.stringify({schemaVersion:1,id:recipe.id,version:recipe.version,sha256:recipe.sha256}),{flag:'wx'});
      if(signal.aborted){await fs.unlink(next);signal.throwIfAborted();}
      await fs.rename(next,pointer);if(signal.aborted){await fs.unlink(pointer);signal.throwIfAborted();}publish({phase:'ready',downloadedBytes:count});return target;
    }catch(error){const code=signal.aborted?'cancelled':known(error);publish({phase:code==='cancelled'?'cancelled':'failed',downloadedBytes:progress?.downloadedBytes||0,error:code});throw Error(code);}
    finally{if(temp){healthy.delete(path.join(temp,'engine.wasm')+':'+recipe.sha256);noLinks(temp);for(const name of ['package.tgz','engine.wasm'])await fs.unlink(path.join(temp,name)).catch(()=>{});await fs.rmdir(temp).catch(()=>{});}}
  }
  async function prepare(id:string,signal?:AbortSignal,listener?:(state:Progress)=>void){
    if(closed)throw Error('cancelled');if(id!==recipe.id)throw Error('authorization_required');if(!enabled()||!supported())throw Error('unsupported');if(removing)throw Error('busy');signal?.throwIfAborted();
    const key=Symbol();
    if(!job){const entry:Job={controller:new AbortController(),consumers:new Set(),listeners:new Set(),promise:Promise.resolve('')};job=entry;
      entry.promise=Promise.resolve().then(()=>install(AbortSignal.any([entry.controller.signal,AbortSignal.timeout(120000)]))).finally(()=>{if(job===entry)job=undefined;});void entry.promise.catch(()=>{});}
    const active=job;active.consumers.add(key);if(listener)active.listeners.add(listener);
    return new Promise<string>((resolve,reject)=>{
      let settled=false;
      const release=()=>{active.consumers.delete(key);if(listener)active.listeners.delete(listener);signal?.removeEventListener('abort',abort);if(!active.consumers.size)active.controller.abort();};
      const finish=(value:string,error=false)=>{if(settled)return;settled=true;release();error?reject(Error(value)):resolve(value);};
      const abort=()=>{active.consumers.delete(key);if(!active.consumers.size){active.controller.abort();void active.promise.finally(()=>finish('cancelled',true)).catch(()=>{});}else finish('cancelled',true);};
      signal?.addEventListener('abort',abort,{once:true});active.promise.then(file=>finish(file),error=>finish(known(error),true));if(signal?.aborted)abort();
    });
  }
  async function acquire(signal?:AbortSignal,listener?:(state:Progress)=>void){
    const file=await prepare(recipe.id,signal,listener);signal?.throwIfAborted();
    if(removing||closed)throw Error('busy');leases.set(file,(leases.get(file)||0)+1);let released=false;
    return{file,version:recipe.version,release:()=>{if(!released){released=true;const n=(leases.get(file)||1)-1;if(n)leases.set(file,n);else leases.delete(file);}}};
  }
  return{view,prepare,acquire,
    async compute(code:string,input:unknown,signal?:AbortSignal,listener?:(state:Progress)=>void){const lease=await acquire(signal,listener);try{return await invoke(lease.file,code,input,signal);}finally{lease.release();}},
    async remove(id:string){
      if(id!==recipe.id)throw Error('unsupported');if(job||removing||leases.size)throw Error('busy');removing=true;
      try{noLinks(folder,true);await fs.unlink(pointer).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});
        noLinks(target,true);await fs.unlink(target).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});await fs.rmdir(versionDir).catch(()=>{});healthy.delete(target+':'+recipe.sha256);progress=undefined;return await view();
      }finally{removing=false;}
    },
    async dispose(){closed=true;job?.controller.abort();for(const controller of workers.keys())controller.abort();await Promise.allSettled([...workers.values(),...(job?[job.promise]:[])]);},
  };
}
