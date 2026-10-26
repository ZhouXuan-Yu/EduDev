/**
 * Process-wide FIFO scheduler for reviewed, side-effect-free reads.
 *
 * The SDK may execute a tool batch in parallel. This scheduler limits the
 * actual safe-read work without changing the SDK's model or tool protocol.
 * A slot is released by the execution boundary only after the underlying
 * tool promise settles, so a caller timeout cannot create a phantom slot.
 */
export const SAFE_READ_CONCURRENCY = 12;

type Waiter = {
  enqueuedAt: number;
  resolve: (slot: ReadSlot) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
  cancelled: boolean;
};

export type ReadSlot = {
  queueWaitMs: number;
  release: () => void;
};

const queue: Waiter[] = [];
let active = 0;

function cancelledError(): Error {
  const error = new Error('cancelled');
  error.name = 'AbortError';
  return error;
}

function removeAbortListener(waiter: Waiter): void {
  if (waiter.signal && waiter.onAbort) waiter.signal.removeEventListener('abort', waiter.onAbort);
  waiter.onAbort = undefined;
}

function pump(): void {
  while (active < SAFE_READ_CONCURRENCY && queue.length > 0) {
    const waiter = queue.shift()!;
    removeAbortListener(waiter);
    if (waiter.cancelled || waiter.signal?.aborted) {
      waiter.reject(cancelledError());
      continue;
    }

    active += 1;
    let released = false;
    waiter.resolve({
      queueWaitMs: Math.max(0, Math.round(performance.now() - waiter.enqueuedAt)),
      release: () => {
        if (released) return;
        released = true;
        active -= 1;
        pump();
      },
    });
  }
}

export function acquireSafeReadSlot(signal?: AbortSignal): Promise<ReadSlot> {
  if (signal?.aborted) return Promise.reject(cancelledError());

  return new Promise<ReadSlot>((resolve, reject) => {
    const waiter: Waiter = {
      enqueuedAt: performance.now(),
      resolve,
      reject,
      signal,
      cancelled: false,
    };
    const onAbort = () => {
      waiter.cancelled = true;
      const index = queue.indexOf(waiter);
      if (index >= 0) queue.splice(index, 1);
      removeAbortListener(waiter);
      reject(cancelledError());
      pump();
    };
    waiter.onAbort = onAbort;
    signal?.addEventListener('abort', onAbort, { once: true });
    queue.push(waiter);
    pump();
  });
}

export function readSchedulerSnapshot(): { active: number; queued: number; capacity: number } {
  return { active, queued: queue.length, capacity: SAFE_READ_CONCURRENCY };
}

