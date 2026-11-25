const dimensions = ['cpu', 'memoryMiB', 'processes', 'indexOps', 'pdfWindows'] as const;
export type ResourceVector = Record<typeof dimensions[number], number>;
export type ResourceLane = 'foreground' | 'background';
export type ResourceStage = {
  owner: string;
  attempt: string;
  phase: string;
  lane: ResourceLane;
  demand: Partial<ResourceVector>;
  /** Absolute deadline from the caller's monotonic clock. */
  deadline: number;
};

export type ResourceLease = {
  readonly id: number;
  readonly queueMs: number;
  start(): boolean;
  settle(): void;
};

type LeaseEvent = {
  at: number;
  state: 'queued' | 'admitted' | 'started' | 'cancel_requested' | 'actual_settled' | 'not_started';
  owner: string;
  attempt: string;
  phase: string;
  lease?: number;
  demand: ResourceVector;
};
type Waiter = {
  stage: ResourceStage;
  demand: ResourceVector;
  key: string;
  at: number;
  bypasses: number;
  state: 'queued' | 'reserved' | 'running' | 'draining' | 'settled';
  id?: number;
  timer?: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abort: () => void;
  resolve: (lease: ResourceLease) => void;
  reject: (error: Error) => void;
};

function vector(value: Partial<ResourceVector> = {}): ResourceVector {
  return {cpu: value.cpu ?? 0, memoryMiB: value.memoryMiB ?? 0, processes: value.processes ?? 0,
    indexOps: value.indexOps ?? 0, pdfWindows: value.pdfWindows ?? 0};
}

function valid(value: Partial<ResourceVector>): boolean {
  return Object.keys(value).every(key => dimensions.includes(key as typeof dimensions[number])) &&
    dimensions.every(key => value[key] === undefined || Number.isSafeInteger(value[key]) && value[key]! >= 0);
}

const identity = /^[a-zA-Z0-9_./:-]{1,140}$/;
const traceLimit = 256;

/** Only main-process execution owners receive leases. Nothing here owns a business task or a worker. */
export class HostResourceScheduler {
  private readonly queue: Waiter[] = [];
  private readonly outstanding = new Set<string>();
  private readonly used = vector();
  private readonly maximum: ResourceVector;
  private target: ResourceVector;
  private nextId = 0;
  private accepting = true;
  private readonly lastOwner: Partial<Record<ResourceLane, string>> = {};
  private readonly trace: LeaseEvent[] = [];
  private traceCursor = 0;

  constructor(maximum: ResourceVector, private readonly options: {maxQueued: number; maxBypasses: number}) {
    if (!valid(maximum) || !Number.isSafeInteger(options.maxQueued) || options.maxQueued < 1 ||
        !Number.isSafeInteger(options.maxBypasses) || options.maxBypasses < 1) throw Error('invalid_resource_config');
    this.maximum = vector(maximum);
    this.target = vector(maximum);
  }

  acquire(stage: ResourceStage, signal?: AbortSignal): Promise<ResourceLease> {
    if (!this.accepting || signal?.aborted) return Promise.reject(Error('cancelled'));
    if (![stage.owner, stage.attempt, stage.phase].every(value => typeof value === 'string' && identity.test(value)) ||
        !['background', 'foreground'].includes(stage.lane) || !valid(stage.demand) ||
        !Number.isFinite(stage.deadline)) return Promise.reject(Error('invalid_resource_stage'));
    const demand = vector(stage.demand);
    if (!dimensions.some(key => demand[key])) return Promise.reject(Error('invalid_resource_stage'));
    if (!this.fits(demand, this.maximum)) return Promise.reject(Error('resource_capacity'));
    const at = performance.now(), key = JSON.stringify([stage.owner, stage.attempt, stage.phase]);
    if (stage.deadline <= at) return Promise.reject(Error('timeout'));
    if (this.outstanding.has(key)) return Promise.reject(Error('duplicate_resource_attempt'));
    if (this.queue.length >= this.options.maxQueued) return Promise.reject(Error('resource_busy'));
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {stage: {...stage}, demand, key, at, bypasses: 0, state:'queued', signal, resolve, reject,
        abort: () => this.cancel(waiter, 'cancelled')};
      this.outstanding.add(key);
      signal?.addEventListener('abort', waiter.abort, {once:true});
      waiter.timer = setTimeout(() => this.cancel(waiter, 'timeout'), Math.min(2_147_483_647, Math.ceil(stage.deadline-at)));
      this.queue.push(waiter);
      this.record(waiter, 'queued');
      this.pump();
    });
  }

  /** The callback's promise must describe actual settlement. Never pass a caller-side race. */
  async run<T>(stage: ResourceStage, signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
    const lease = await this.acquire(stage, signal);
    try {
      if (!lease.start()) throw Error(signal?.aborted || !this.accepting ? 'cancelled' : 'timeout');
      return await work();
    } finally {
      lease.settle();
    }
  }

  setTarget(target: ResourceVector): void {
    if (!valid(target) || !this.fits(target, this.maximum)) throw Error('invalid_resource_config');
    this.target = vector(target);
    this.pump();
  }

  stopAccepting(): void {
    this.accepting = false;
    for (const waiter of this.queue.slice()) this.cancel(waiter, 'cancelled');
  }

  snapshot() {
    const debt = vector();
    for (const key of dimensions) debt[key] = Math.max(0, this.used[key] - this.target[key]);
    return {used: vector(this.used), target: vector(this.target), debt, queued: this.queue.length};
  }

  isQueued(owner: string): boolean {
    return this.queue.some(waiter => waiter.stage.owner === owner);
  }

  recentEvents(): LeaseEvent[] {
    return [...this.trace.slice(this.traceCursor), ...this.trace.slice(0, this.traceCursor)]
      .map(event => ({...event, demand: vector(event.demand)}));
  }

  private record(waiter: Waiter, state: LeaseEvent['state']): void {
    this.trace[this.traceCursor] = {at: performance.now(), state, owner: waiter.stage.owner, attempt: waiter.stage.attempt,
      phase: waiter.stage.phase, lease: waiter.id, demand: waiter.demand};
    this.traceCursor = (this.traceCursor + 1) % traceLimit;
  }

  private fits(demand: ResourceVector, target: ResourceVector, used?: ResourceVector): boolean {
    return dimensions.every(key => demand[key] + (used?.[key] ?? 0) <= target[key]);
  }

  private pump(): void {
    if (!this.accepting) return;
    for (const expired of this.queue.filter(item => item.stage.deadline <= performance.now())) this.failQueued(expired, 'timeout');
    while (this.queue.length) {
      const aged = this.queue.find(item => item.bypasses >= this.options.maxBypasses && this.fits(item.demand, this.target));
      const runnable = this.queue.filter(item => this.fits(item.demand, this.target, this.used));
      const lane = runnable.some(item => item.stage.lane === 'foreground') ? 'foreground' : 'background';
      const sameLane = runnable.filter(item => item.stage.lane === lane);
      const next = aged ?? sameLane.find(item => item.stage.owner !== this.lastOwner[lane]) ?? sameLane[0];
      if (!next || !this.fits(next.demand, this.target, this.used)) break;
      for (const older of this.queue.slice(0, this.queue.indexOf(next))) older.bypasses++;
      this.grant(next);
    }
  }

  private grant(waiter: Waiter): void {
    this.queue.splice(this.queue.indexOf(waiter), 1);
    for (const key of dimensions) this.used[key] += waiter.demand[key];
    this.lastOwner[waiter.stage.lane] = waiter.stage.owner;
    waiter.state = 'reserved';
    waiter.id = ++this.nextId;
    this.record(waiter, 'admitted');
    waiter.resolve({id:waiter.id, queueMs:performance.now()-waiter.at,
      start: () => {
        if (waiter.state !== 'reserved') return false;
        if (!this.accepting || waiter.signal?.aborted || waiter.stage.deadline <= performance.now()) {
          this.release(waiter);
          return false;
        }
        clearTimeout(waiter.timer);
        waiter.state = 'running';
        this.record(waiter, 'started');
        return true;
      },
      settle: () => this.release(waiter)});
  }

  private cancel(waiter: Waiter, reason: 'cancelled' | 'timeout'): void {
    if (waiter.state === 'queued') {
      this.failQueued(waiter, reason);
      this.pump();
    } else if (waiter.state === 'reserved') {
      this.release(waiter);
    } else if (waiter.state === 'running') {
      waiter.state = 'draining';
      this.record(waiter, 'cancel_requested');
    }
  }

  private failQueued(waiter: Waiter, reason: string): void {
    this.queue.splice(this.queue.indexOf(waiter), 1);
    this.record(waiter, 'not_started');
    this.detach(waiter);
    waiter.reject(Error(reason));
  }

  private release(waiter: Waiter): void {
    if (waiter.state === 'settled') return;
    for (const key of dimensions) this.used[key] -= waiter.demand[key];
    this.record(waiter, waiter.state === 'reserved' ? 'not_started' : 'actual_settled');
    this.detach(waiter);
    this.pump();
  }

  private detach(waiter: Waiter): void {
    waiter.state = 'settled';
    clearTimeout(waiter.timer);
    waiter.signal?.removeEventListener('abort', waiter.abort);
    this.outstanding.delete(waiter.key);
  }
}
