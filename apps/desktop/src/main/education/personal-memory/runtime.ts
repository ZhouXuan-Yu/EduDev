import {access,lstat,realpath,readdir} from 'node:fs/promises';
import {freemem} from 'node:os';
import {isAbsolute, join, relative} from 'node:path';
import {hashFileSha256,resolveInsideRoot} from '../../local-file-security';
import type {Sql} from '../../xiaozhi-agent/session-state';
import {createPersonalMemoryBackgroundConsumer} from './background-consumer';
import {createPersonalMemoryJobs} from './background-jobs';
import {readPersonalMemoryProcessing} from './candidate-state';
import {createPersonalMemoryRecordState} from './record-state';
import {createPersonalMemoryOrganization} from './organization';
import {createPersonalMemorySourceAuthority} from './source-authority';
import type {PersonalMemoryWorkerLaunch,runPersonalMemoryCandidateWorker} from './candidate-worker-client';
import manifest from './runtime-manifest.json' with {type:'json'};

type Provider = Parameters<typeof runPersonalMemoryCandidateWorker>[0];
type RuntimeOptions = {
  idle:()=>boolean;
  provider:()=>Promise<Provider|null>;
  sanitize:(text:string)=>Promise<string>;
  report:(code:string)=>void;
};
const quietMs=60_000;
const intervalMs=15_000;
const minFreeMemory=2*1024**3;

/** The main-process lifecycle owns admission and the existing SQLite queue owns recovery. */
export function createPersonalMemoryRuntime(sql:Sql, options:RuntimeOptions) {
  const jobs=createPersonalMemoryJobs(sql);
  const sources=createPersonalMemorySourceAuthority(sql,options.sanitize);
  const records=createPersonalMemoryRecordState(sql,sources);
  const organization=createPersonalMemoryOrganization(sql,sources,records,jobs,options.sanitize);
  let timer:ReturnType<typeof setInterval>|undefined;
  let running:{controller:AbortController; result:Promise<void>}|undefined;
  let quietUntil=Date.now()+quietMs;
  let closed=false;
  let lastError:string|undefined;
  let schemaAvailable:boolean|undefined;

  const idle=()=>!closed && options.idle() && Date.now()>=quietUntil && freemem()>=minFreeMemory;

  async function advance(signal:AbortSignal) {
    if (schemaAvailable===undefined) {
      const [schema]=await sql.all("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='personal_memory_processing'");
      schemaAvailable=!!schema;
    }
    if (!schemaAvailable || signal.aborted || !idle()) return;
    await records.reconcile();
    if (signal.aborted || !idle()) return;
    const policy=await readPersonalMemoryProcessing(sql);
    if (!policy.enabled || policy.pausedByUsePolicy) return;
    const [competing]=await sql.all("SELECT 1 FROM ai_tasks WHERE status='running' AND task_type<>'personal_memory' LIMIT 1");
    if (competing) return;
    const provider=await options.provider();
    if (!provider || signal.aborted || !idle()) return;
    const extraction=await jobs.planExtraction();
    if (!extraction && !signal.aborted && idle()) await organization.plan(policy);
    if (signal.aborted || !idle()) return;
    const consumer=createPersonalMemoryBackgroundConsumer(sql,{sources,provider,targets:organization.targets,targetsCurrent:organization.targetsCurrent});
    await consumer.advance(signal);
  }

  function tick() {
    if (running || !idle()) return;
    const controller=new AbortController();
    const result=advance(controller.signal).then(()=>{lastError=undefined;}).catch(error=>{
      if (controller.signal.aborted) return;
      const code=error instanceof Error && /^[a-z_]{1,48}$/.test(error.message) ? error.message : 'worker_failed';
      if (code!==lastError) options.report(code);
      lastError=code;
    }).finally(()=>{running=undefined;});
    running={controller,result};
  }

  return {
    start() {
      if (closed || timer) return;
      timer=setInterval(tick,intervalMs);
      timer.unref();
    },
    interrupt() {
      quietUntil=Date.now()+quietMs;
      running?.controller.abort();
    },
    async close() {
      closed=true;
      clearInterval(timer);
      running?.controller.abort();
      await running?.result;
    },
  };
}

async function verifyPackagedWorker(root:string):Promise<PersonalMemoryWorkerLaunch|null> {
  if (process.platform!=='win32' || process.arch!=='x64' || !isAbsolute(root)) return null;
  if ((await realpath(root)).toLowerCase()!==root.toLowerCase()) return null;
  const expected=new Map(manifest.files.map(item=>[item.path,item]));
  async function walk(directory:string) {
    for (const entry of await readdir(directory,{withFileTypes:true})) {
      const file=resolveInsideRoot(root,relative(root,directory),entry.name);
      if (entry.isSymbolicLink() || (await realpath(file)).toLowerCase()!==file.toLowerCase()) return false;
      if (entry.isDirectory()) {
        if (!await walk(file)) return false;
      } else {
        const key=relative(root,file).replaceAll('\\','/');
        const item=expected.get(key);
        if (!entry.isFile() || !item || (await lstat(file)).size!==item.size || await hashFileSha256(file)!==item.sha256) return false;
        expected.delete(key);
      }
    }
    return true;
  }
  return await walk(root)&&expected.size===0?{repoRoot:root,executable:join(root,manifest.executable)}:null;
}

export function createPersonalMemoryWorkerPaths(options:{packaged:boolean;resourcesPath:string;repoRoot:string;
  configuredPython?:string}):()=>Promise<PersonalMemoryWorkerLaunch|null> {
  let verified:Promise<PersonalMemoryWorkerLaunch|null>|undefined;
  return async()=>{
    if (options.packaged) {
      const root=join(options.resourcesPath,'personal-memory-runtime');
      return verified ??= verifyPackagedWorker(root).catch(()=>null);
    }
    const {repoRoot,configuredPython:pythonExecutable}=options;
    if (!isAbsolute(repoRoot) || !pythonExecutable || !isAbsolute(pythonExecutable)) return null;
    try {
      await Promise.all([access(pythonExecutable),access(join(repoRoot,'python','omni_edu_personal_memory','worker.py'))]);
      return {repoRoot,pythonExecutable};
    } catch {return null;}
  };
}
