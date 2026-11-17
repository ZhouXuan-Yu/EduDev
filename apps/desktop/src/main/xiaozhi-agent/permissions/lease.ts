import type {PermissionRequest} from '../../../shared/xiaozhi-permissions';
import type {PermissionEngine} from './engine';
import type {CurrentPermission} from './current';

/** Keep the existing engine's active execution until the owned service has cleaned up. */
export async function openPermissionLease(engine: PermissionEngine, request: PermissionRequest, signal: AbortSignal) {
  const controller = new AbortController();
  const combined = AbortSignal.any([signal, controller.signal]);
  let resolveReady!: (authority: CurrentPermission) => void;
  let rejectReady!: (error: unknown) => void;
  let release!: (failure?: Error) => void;
  const ready = new Promise<CurrentPermission>((resolve, reject) => {resolveReady = resolve; rejectReady = reject;});
  const released = new Promise<Error | undefined>(resolve => {release = resolve;});
  let monitor: ReturnType<typeof setTimeout> | undefined;
  let inspection: Promise<void> = Promise.resolve();
  let closed = false;
  const lifetime = engine.run(request, combined, async context => {
    const authority = {request, ...context};
    const inspect = async () => {
      try {await authority.assert();}
      catch {controller.abort('revoked'); return;}
      if (!closed && !combined.aborted) schedule();
    };
    const schedule = () => {monitor = setTimeout(() => {inspection = inspect();}, 500); monitor.unref();};
    resolveReady(authority);
    schedule();
    const failure = await released;
    if (failure) throw failure;
  });
  // The lease owner awaits close after terminal cleanup. Observe early failures immediately.
  void lifetime.catch(rejectReady);
  const authority = await ready;
  return {
    authority,
    async close(failure?: Error) {
      if (!closed) {closed = true; clearTimeout(monitor); release(failure);}
      try {await lifetime;}
      catch (error) {if (!authority.signal.aborted) throw error;}
      finally {await inspection;}
    },
    cancel: () => controller.abort('cancelled'),
  };
}
