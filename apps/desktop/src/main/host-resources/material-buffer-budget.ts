import {AsyncLocalStorage} from 'node:async_hooks';
import {runHostStage} from './desktop';
import type {ResourceLane, ResourceVector} from './scheduler';

type WorkerDemand = Pick<ResourceVector, 'cpu' | 'memoryMiB' | 'processes'>;
type Budget = {
  signals: WeakSet<AbortSignal>;
  deadline: number;
  demand: WorkerDemand;
  active: boolean;
  workerRunning: boolean;
};
const currentBudget = new AsyncLocalStorage<Budget>();

/** Reserve the peak of a sequential parse before the original enters memory. */
export function withMaterialBufferBudget<T>(owner: string, lane: ResourceLane, filename: string,
  signal: AbortSignal, work: () => Promise<T>, phase:'material-buffered'|'material-image-structure'='material-buffered'): Promise<T> {
  const word = /\.docx$/i.test(filename);
  const pdf = /\.pdf$/i.test(filename);
  const image = /\.(jpe?g|png|webp)$/i.test(filename);
  const text = /\.(txt|md)$/i.test(filename);
  // Include the 50 MiB input bound, worker transport and decoded results in the
  // same reservation as the worker. DOCX can also render drawings and metafiles.
  const demand = {cpu:word || pdf || image ? 2 : 1,
    memoryMiB:word ? 1536 : pdf ? 1152 : image ? 896 : text ? 256 : 512,
    processes:text ? 0 : 1};
  const timeout = phase==='material-image-structure' ? 300_000 : word ? 480_000 : pdf ? 380_000 : 75_000;
  const deadline = performance.now() + timeout;
  return runHostStage(owner,phase,lane,demand,timeout,signal,async () => {
    const budget = {signals:new WeakSet([signal]),deadline,demand,active:true,workerRunning:false};
    try { return await currentBudget.run(budget,work); }
    finally { budget.active=false; }
  });
}

/** A sub-step's deadline still belongs to the same physical attempt. */
export function materialWorkerDeadline(signal: AbortSignal, timeout: number): AbortSignal {
  const derived = AbortSignal.any([signal,AbortSignal.timeout(timeout)]);
  const budget = currentBudget.getStore();
  if (budget?.active && budget.signals.has(signal)) budget.signals.add(derived);
  return derived;
}

/** The callback must settle only when its actual worker has released custody. */
export function runMaterialWorker<T>(signal: AbortSignal, demand: WorkerDemand,
  timeout: number, work: (remaining: number) => Promise<T>): Promise<T> | undefined {
  const budget = currentBudget.getStore();
  if (!budget?.active || !budget.signals.has(signal)) return undefined;
  if (budget.workerRunning || demand.cpu>budget.demand.cpu || demand.processes>budget.demand.processes ||
      demand.memoryMiB>budget.demand.memoryMiB) return Promise.reject(Error('resource_capacity'));
  const remaining = Math.min(timeout,Math.floor(budget.deadline-performance.now()));
  if (signal.aborted) return Promise.reject(Error('cancelled'));
  if (remaining<1) return Promise.reject(Error('timeout'));
  budget.workerRunning=true;
  return (async () => {
    try { return await work(remaining); }
    finally { budget.workerRunning=false; }
  })();
}
