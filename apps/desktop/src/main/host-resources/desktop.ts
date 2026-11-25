import {randomUUID} from 'node:crypto';
import {availableParallelism, cpus, freemem, totalmem} from 'node:os';
import {app, powerMonitor} from 'electron';
import {HostResourceScheduler, type ResourceLane, type ResourceVector} from './scheduler';

const MiB = 1_048_576;
export const hostResourcePolicyVersion = 'host-resources.r1.1';
const normal: ResourceVector = {
  cpu: Math.max(2, Math.min(8, Math.floor(availableParallelism()/2))),
  memoryMiB: Math.max(1536, Math.min(4096, Math.floor(totalmem()/MiB/5))),
  processes: 8, indexOps: 2, pdfWindows: 1,
};
const sampleMs = 1000;
const coordinator = new HostResourceScheduler(normal, {maxQueued:64, maxBypasses:6});
let sampler: ReturnType<typeof setInterval> | undefined;
let previousTick = 0;
let previousCpu = {idle:0, total:0};
let pressure = 0;
let affectedSamples = 0;
let healthySamples = 0;
let lastSample: {at:number; availableMiB:number; delayMs:number; cpuRatio:number|null; processWorkingSetKiB:number|null} | undefined;

function setPressure(level: number) {
  pressure = level;
  coordinator.setTarget(level === 0 ? normal : {...normal,
    cpu:Math.max(2, Math.floor(normal.cpu*(level===1 ? .75 : .5))),
    memoryMiB:Math.max(1536, Math.floor(normal.memoryMiB*(level===1 ? .75 : .5))),
    processes:level===1 ? 4 : 2, indexOps:1,
  });
}

function sample() {
  const at = performance.now(), delayMs = Math.max(0, at-previousTick-sampleMs), availableMiB = freemem()/MiB;
  const cpu = {idle:0,total:0};
  for (const {times} of cpus()) {
    cpu.idle += times.idle;
    cpu.total += times.idle + times.user + times.nice + times.sys + times.irq;
  }
  const delta = cpu.total-previousCpu.total, idleDelta = cpu.idle-previousCpu.idle;
  const cpuRatio = previousCpu.total && delta>0 && idleDelta>=0 && idleDelta<=delta ? 1-idleDelta/delta : null;
  const healthyInterval = previousTick > 0 && at-previousTick < sampleMs*5;
  previousTick=at; previousCpu=cpu;
  let processWorkingSetKiB: number|null = null;
  // Working sets may count shared pages more than once. Use for diagnostics only.
  try {
    const metrics = app.isReady() ? app.getAppMetrics() : [];
    if (metrics.length) processWorkingSetKiB = metrics.reduce((sum, entry) => sum+entry.memory.workingSetSize,0);
  } catch { /* Optional metric, especially during shutdown. */ }
  lastSample={at,availableMiB,delayMs,cpuRatio,processWorkingSetKiB};
  const measured = healthyInterval && Number.isFinite(availableMiB) && availableMiB>0 && cpuRatio!==null;
  const level = !measured || availableMiB<1024 ? 2 : availableMiB<2048 || delayMs>80 || cpuRatio>.92 ? 1 : 0;
  affectedSamples=level>pressure ? affectedSamples+1 : 0;
  healthySamples=measured && level<pressure && availableMiB>=2560 && delayMs<40 && cpuRatio<.85 ? healthySamples+1 : 0;
  if (!measured || availableMiB<1024 || affectedSamples>=2) {setPressure(level); affectedSamples=healthySamples=0;}
  else if (healthySamples>=5) {setPressure(pressure-1); healthySamples=0;}
}

function beginSampling() {
  if (sampler) return;
  previousTick=performance.now();
  sample();
  sampler=setInterval(sample,sampleMs);
  sampler.unref();
  if (app.isReady()) powerMonitor.on('resume', () => {
    previousTick=0;
    previousCpu={idle:0,total:0};
    sample();
  });
}

export function reserveHostStage(owner: string, phase: string, lane: ResourceLane, demand: Partial<ResourceVector>,
  timeoutMs: number, signal?: AbortSignal, attempt=randomUUID() as string) {
  beginSampling();
  return coordinator.acquire({owner,attempt,phase,lane,demand,deadline:performance.now()+timeoutMs},signal);
}

export async function runHostStage<T>(owner: string, phase: string, lane: ResourceLane, demand: Partial<ResourceVector>,
  timeoutMs: number, signal: AbortSignal|undefined, work: (remainingMs: number)=>Promise<T>, attempt?:string): Promise<T> {
  const end = performance.now()+timeoutMs;
  const lease = await reserveHostStage(owner,phase,lane,demand,timeoutMs,signal,attempt);
  try {
    if (!lease.start()) throw Error(signal?.aborted ? 'cancelled' : 'timeout');
    return await work(Math.max(1,Math.floor(end-performance.now())));
  } finally {
    lease.settle();
  }
}

export function hostResourceDiagnostics() {
  return {policy:hostResourcePolicyVersion, pressure, lastSample, ...coordinator.snapshot(), events:coordinator.recentEvents()};
}

export function isHostResourceQueued(owner: string): boolean {
  return coordinator.isQueued(owner);
}
