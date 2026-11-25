import {randomUUID} from 'node:crypto';
import {availableParallelism, cpus, freemem, totalmem} from 'node:os';
import {app, powerMonitor} from 'electron';
import {HostResourceScheduler, type ResourceLane, type ResourceVector} from './scheduler';
import {HostPressurePolicy, type PressureLevel, type UnavailablePressureSample} from './pressure';

const MiB = 1_048_576;
export const hostResourcePolicyVersion = 'host-resources.r1.2';
const normal: ResourceVector = {
  cpu: Math.max(2, Math.min(8, Math.floor(availableParallelism()/2))),
  memoryMiB: Math.max(1536, Math.min(4096, Math.floor(totalmem()/MiB/5))),
  processes: 8, indexOps: 2, pdfWindows: 1,
};
const sampleMs = 1000;
const coordinator = new HostResourceScheduler(normal, {maxQueued:64, maxBypasses:6});
const policy = new HostPressurePolicy();
let sampler: ReturnType<typeof setInterval> | undefined;
let previousTick: number | undefined;
let previousCpu: ReturnType<typeof readCpuTotals>;
type Measurement = {
  at: number;
  intervalMs: number | null;
  delayMs: number | null;
  availableMiB: number | null;
  cpuRatio: number | null;
  processWorkingSetKiB: number | null;
} & ReturnType<HostPressurePolicy['observe']>;
const pressureSamples: Measurement[] = [];

function setPressure(level: PressureLevel) {
  coordinator.setTarget(level === 0 ? normal : {...normal,
    cpu:Math.max(2, Math.floor(normal.cpu*(level===1 ? .75 : .5))),
    memoryMiB:Math.max(1536, Math.floor(normal.memoryMiB*(level===1 ? .75 : .5))),
    processes:level===1 ? 4 : 2, indexOps:1,
  });
}

function readCpuTotals() {
  const processors = cpus();
  if (!processors.length) return undefined;
  let idle = 0, total = 0;
  for (const {times} of processors) {
    const values = [times.idle, times.user, times.nice, times.sys, times.irq];
    if (values.some(value => !Number.isFinite(value) || value < 0)) return undefined;
    idle += times.idle;
    total += values.reduce((sum, value) => sum+value, 0);
  }
  return {idle,total,count:processors.length};
}

function sample(origin?: 'cold_start' | 'resume') {
  const at = performance.now();
  const intervalMs = previousTick === undefined ? null : at-previousTick;
  previousTick = at;
  const validInterval = intervalMs !== null && Number.isFinite(intervalMs) && intervalMs > 0 && intervalMs < sampleMs*5;
  const delayMs = validInterval ? Math.max(0, intervalMs-sampleMs) : null;
  let availableMiB: number|null = null, cpuRatio: number|null = null;
  let unavailable: UnavailablePressureSample | undefined = origin;
  try {
    const bytes = freemem();
    if (Number.isFinite(bytes) && bytes > 0) availableMiB = bytes/MiB;
    const cpu = readCpuTotals();
    if (validInterval && cpu && previousCpu?.count === cpu.count) {
      const elapsed = cpu.total-previousCpu.total, idle = cpu.idle-previousCpu.idle;
      if (Number.isFinite(elapsed) && elapsed > 0 && idle >= 0 && idle <= elapsed) cpuRatio = 1-idle/elapsed;
    }
    previousCpu = cpu;
    unavailable ??= !validInterval ? 'stale_interval' : availableMiB === null ? 'invalid_memory' :
      cpuRatio === null ? 'invalid_cpu' : undefined;
  } catch {
    previousCpu = undefined;
    unavailable ??= 'sensor_failed';
  }
  let processWorkingSetKiB: number|null = null;
  // Working sets may count shared pages more than once. Use for diagnostics only.
  try {
    const metrics = app.isReady() ? app.getAppMetrics() : [];
    const sizes = metrics.map(entry => entry.memory.workingSetSize);
    if (sizes.length && sizes.every(size => Number.isFinite(size) && size >= 0))
      processWorkingSetKiB = sizes.reduce((sum, size) => sum+size, 0);
  } catch { /* Optional metric, especially during shutdown. */ }
  const decision = policy.observe({availableMiB, delayMs, cpuRatio, unavailable});
  pressureSamples.push({at,intervalMs,availableMiB,delayMs,cpuRatio,processWorkingSetKiB,...decision});
  if (pressureSamples.length > 32) pressureSamples.shift();
  if (decision.level !== decision.previousLevel) setPressure(decision.level);
}

function beginSampling() {
  if (sampler) return;
  sample('cold_start');
  sampler=setInterval(()=>sample(),sampleMs);
  sampler.unref();
  const bindResume = () => powerMonitor.on('resume', () => {
    previousTick=undefined;
    previousCpu=undefined;
    sample('resume');
  });
  if (app.isReady()) bindResume();
  else app.once('ready',bindResume);
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
  const samples=pressureSamples.map(sample=>({...sample}));
  const lastSample=samples.at(-1);
  return {policy:hostResourcePolicyVersion, pressure:lastSample?.level ?? 0, lastSample, pressureSamples:samples,
    sampling:{periodMs:sampleMs,clock:'performance.now',memory:'os.freemem',cpu:'os.cpus delta',processMemory:'Electron working set'},
    ...coordinator.snapshot(), events:coordinator.recentEvents()};
}

export function isHostResourceQueued(owner: string): boolean {
  return coordinator.isQueued(owner);
}
