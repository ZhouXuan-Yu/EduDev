import {access} from 'node:fs/promises';
import {freemem} from 'node:os';
import {isAbsolute, join} from 'node:path';
import type {Sql} from '../../xiaozhi-agent/session-state';
import {createPersonalMemoryBackgroundConsumer} from './background-consumer';
import {createPersonalMemoryJobs} from './background-jobs';
import {readPersonalMemoryProcessing} from './candidate-state';
import {createPersonalMemoryRecordState} from './record-state';
import {createPersonalMemorySourceAuthority} from './source-authority';
import type {runPersonalMemoryCandidateWorker} from './candidate-worker-client';

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
    await jobs.planExtraction();
    if (signal.aborted || !idle()) return;
    const consumer=createPersonalMemoryBackgroundConsumer(sql,{sources,provider,targets:async()=>[]});
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

export async function personalMemoryWorkerPaths(options:{packaged:boolean;resourcesPath:string;dataRoot:string;repoRoot:string;
  configuredPython?:string}) {
  const repoRoot=options.packaged ? join(options.resourcesPath,'personal-memory-runtime') : options.repoRoot;
  const pythonExecutable=options.packaged
    ? join(options.dataRoot,'managed-tools','personal-memory','Scripts','python.exe')
    : options.configuredPython ?? '';
  if (!isAbsolute(repoRoot) || !isAbsolute(pythonExecutable)) return null;
  try {
    await Promise.all([access(pythonExecutable),access(join(repoRoot,'python','omni_edu_personal_memory','worker.py'))]);
    return {repoRoot,pythonExecutable};
  } catch {return null;}
}
