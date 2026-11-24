import {setTimeout as delay} from 'node:timers/promises';

/** Publication is admitted before the first side effect. The backup owns no
 * SQLite transaction while it drains publishers. Periodic work retries on its
 * next tick when admission has closed. */
export class BackupPublicationBarrier {
  private readonly active = new Set<Promise<unknown>>();
  private frozen = false;

  tryPublish<T>(action: () => Promise<T> | T): Promise<T> | undefined {
    if (this.frozen) return;
    return this.retain(Promise.resolve().then(action));
  }

  /** A tracked publisher can spawn a worker whose lifetime extends its own. */
  retain<T>(result: Promise<T>): Promise<T> {
    this.active.add(result);
    const unregister = () => this.active.delete(result);
    void result.then(unregister, unregister);
    return result;
  }

  async snapshot<T>(action: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (this.frozen) throw new Error('backup_busy');
    signal?.throwIfAborted();
    this.frozen = true;
    try {
      const deadline = performance.now() + 15_000;
      while (this.active.size) {
        signal?.throwIfAborted();
        if (performance.now() >= deadline) throw new Error('backup_publishers_busy');
        try { await delay(25,undefined,{signal}); }
        catch (error) { signal?.throwIfAborted(); throw error; }
      }
      signal?.throwIfAborted();
      return await action();
    } finally {
      this.frozen = false;
    }
  }
}

export function publishBackground<T>(barrier: BackupPublicationBarrier | undefined, action: () => Promise<T>) {
  return barrier ? barrier.tryPublish(action) : action();
}
