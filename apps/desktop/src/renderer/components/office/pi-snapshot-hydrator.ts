/** One authoritative read per navigation scope. No React updater or event replay
 * lives here; the existing receiver still owns sequence/generation admission. */
export function createPiSnapshotHydrator<T>(options: {
  read: (target: string) => Promise<T>;
  publish: (value: T) => void | boolean;
  canPublish?: (value: T) => boolean;
  failed: () => void;
}) {
  type Scope = { target: string; token: symbol; revision: number; published: boolean; failed: boolean; request?: Promise<void> };
  let scope: Scope | undefined;
  function hydrate(target: string, fresh = true): Promise<void> {
    const owner = scope;
    if (!owner || owner.target !== target) return Promise.resolve();
    if (owner.request) {
      // A post-mutation caller requires a read started after this call, even
      // when that mutation has no public event. Keep the same waiter/barrier.
      if (fresh) owner.revision++;
      return owner.request;
    }
    owner.failed = false;
    // Defer the read until request ownership is installed, even if read throws.
    const request = Promise.resolve().then(async () => {
      for (let attempt = 0; attempt < 8 && scope === owner; attempt++) {
        const revision = owner.revision;
        let value: T;
        try { value = await options.read(target); }
        catch (error) { if (scope !== owner) return; throw error; }
        if (scope !== owner) return;
        // A snapshot captured before an accepted event cannot acknowledge it.
        // Re-read after that burst rather than swallowing the last event.
        if (revision !== owner.revision || options.canPublish && !options.canPublish(value)) continue;
        if (options.publish(value) === false || revision !== owner.revision) continue;
        if (scope !== owner) return;
        owner.published = true;
        return;
      }
      if (scope === owner) throw Error('snapshot_changed_during_refresh');
    }).catch(error => {
      if (scope !== owner) return;
      owner.failed = true;
      options.failed();
      throw error;
    }).finally(() => { if (owner.request === request) owner.request = undefined; });
    owner.request = request;
    return request;
  }
  return {
    open(target: string) { scope = { target, token: Symbol(target), revision: 0, published: false, failed: false }; },
    token() { return scope?.token; },
    revision() { return scope?.revision; },
    reset() { scope = undefined; },
    /** Called once after the existing receiver admits an event, outside React. */
    changed() { if (scope) scope.revision++; },
    needsRecovery() { return Boolean(scope && !scope.published && !scope.failed); },
    hasFailed() { return Boolean(scope?.failed); },
    hydrate,
  };
}
