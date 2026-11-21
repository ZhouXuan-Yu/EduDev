import { randomUUID } from 'node:crypto';
import type { PermissionDecision, PermissionOwner, PermissionRequest, PermissionApprovalInput } from '../../../shared/xiaozhi-permissions';
import type { PermissionStore } from './store';
import { permissionHash, snapshotRequest } from './validation';
import { permissionGrantSnapshot } from './grant-snapshot';

export type JobPermissionBinding = {jobId: string; leaseRevision: number; approvalId?: string};
export type PermissionWait = {
  wait: <T>(action: () => Promise<T>) => Promise<T>;
  beforeResume?: () => Promise<void>;
};
type Activity = { owner: PermissionOwner; grantIds: string[]; controller: AbortController; serverId?: string; job?: JobPermissionBinding };
type RequestCheck = 'admission' | 'execution';
type PermissionOperation<T> = (context: {signal: AbortSignal; decision: PermissionDecision; assert: () => Promise<void>}) => Promise<T>;
type Options = {
  store: PermissionStore;
  current: (owner: PermissionOwner) => boolean | Promise<boolean>;
  notify?: (sessionId: string) => void | Promise<void>;
  now?: () => number;
  verifyRequest?: (request: PermissionRequest, check: RequestCheck) => Promise<boolean>;
  jobCurrent?: (binding: JobPermissionBinding, request: PermissionRequest) => Promise<boolean>;
};

/** Main-owned policy evaluation. References never replace current grants. */
export function createPermissionEngine(options: Options) {
  const active = new Map<string, Activity>();
  const currentTime = options.now || Date.now;
  const listeners = new Map<string, Set<() => void>>();
  // This is only a wake-up hint after durable mutation. Every consumer still
  // rereads the store and passes the original authorization gates.
  async function changed(sessionId: string) {
    for (const listener of [...listeners.get(sessionId) || []]) listener();
    await options.notify?.(sessionId);
  }

  async function waitForChange(request: PermissionRequest, decision: PermissionDecision, signal: AbortSignal) {
    signal.throwIfAborted();
    let wake!: () => void;
    const notified = new Promise<void>(resolve => {wake = resolve;});
    const abort = () => wake();
    const session = request.owner.sessionId;
    const subscribed = listeners.get(session) || new Set<() => void>();
    listeners.set(session, subscribed); subscribed.add(wake);
    signal.addEventListener('abort', abort, {once: true});
    let expiry: ReturnType<typeof setTimeout> | undefined;
    try {
      // Subscribe before the durable reread: a decision between the first
      // authorize and this subscription must not leave the call asleep.
      const approval = decision.approvalId ? await options.store.approval(session, decision.approvalId) : null;
      if (!approval) throw Error('permission_denied');
      const latest = await evaluate(request);
      signal.throwIfAborted();
      if (approval.state !== 'pending' || latest.state !== 'pending'
          || latest.permissionSnapshotHash !== decision.permissionSnapshotHash) return;
      const deadline = Math.min(Date.parse(request.expiresAt), Date.parse(approval.request.expiresAt));
      expiry = setTimeout(wake, Math.max(1, Math.min(2147483647, deadline - currentTime())));
      expiry.unref();
      await notified;
      signal.throwIfAborted();
    } finally {
      if (expiry) clearTimeout(expiry);
      signal.removeEventListener('abort', abort);
      subscribed.delete(wake); if (!subscribed.size) listeners.delete(session);
    }
  }

  async function evaluate(raw: PermissionRequest, approvalLease?: string, continuingJob = false,
    check: RequestCheck = 'admission'): Promise<PermissionDecision> {
    const request = snapshotRequest(raw);
    const evaluatedAt = currentTime();
    const base = {schemaVersion: 1 as const, ...permissionGrantSnapshot(request, await options.store.grants(request.owner.sessionId), evaluatedAt)};
    if (Date.parse(request.expiresAt) <= currentTime()) return {...base, state: 'blocked', reason: 'expired'};
    if (options.verifyRequest && !await options.verifyRequest(request, check)) return {...base, state: 'blocked', reason: 'source_changed'};
    if (!base.missing.length) return {...base, state: 'allow'};
    const prior = (await options.store.approvals(request.owner.sessionId))
      .find(item => item.request.owner.taskId === request.owner.taskId && item.requestDigest === base.requestDigest);
    if (prior?.state === 'rejected') return {...base, state: 'blocked', reason: 'rejected', approvalId: prior.id};
    if (prior && Date.parse(prior.request.expiresAt) <= currentTime()) {
      return {...base, state: 'blocked', reason: 'expired', approvalId: prior.id};
    }
    if (prior && prior.id === approvalLease && (prior.state === 'executing' || continuingJob && prior.state === 'executed') && prior.admittedOwner && permissionHash(prior.admittedOwner) === permissionHash(request.owner)
        && prior.permissionSnapshotHash === base.permissionSnapshotHash) return {...base, state: 'allow', approvalId: prior.id};
    return {...base, state: 'pending', reason: 'missing_grant', ...(prior ? {approvalId: prior.id} : {})};
  }

  async function invalidate(approval: Awaited<ReturnType<PermissionStore['approval']>>, reason: string) {
    if (!approval || !['pending', 'approved'].includes(approval.state)) return;
    await options.store.transition(approval.request.owner.sessionId, approval.id, approval.revision,
      [approval.state], 'invalidated', {invalidatedReason: reason});
    await changed(approval.request.owner.sessionId);
  }

  const current = (request: PermissionRequest, job?: JobPermissionBinding) => job
    ? options.jobCurrent?.(job, request) || false : options.current(request.owner);
  async function authorize(raw: PermissionRequest, createApproval = true, job?: JobPermissionBinding) {
    const request = snapshotRequest(raw);
    if (!await current(request, job)) throw Error('permission_denied');
    let decision = await evaluate(request, job?.approvalId, !!job);
    if (decision.state === 'blocked') {
      const prior = (await options.store.approvals(request.owner.sessionId)).find(item => item.requestDigest === decision.requestDigest);
      if (prior && decision.reason !== 'rejected') await invalidate(prior, decision.reason || 'source_changed');
      return decision;
    }
    if (decision.state === 'allow') return decision;
    let approval = decision.approvalId ? await options.store.approval(request.owner.sessionId, decision.approvalId) : null;
    if (approval && Date.parse(approval.request.expiresAt) <= currentTime()) {
      await invalidate(approval, 'expired');
      return {...decision, state: 'blocked' as const, reason: 'expired' as const};
    }
    if (approval && approval.permissionSnapshotHash !== decision.permissionSnapshotHash) {
      await invalidate(approval, 'permission_changed');
      return {...decision, state: 'blocked' as const, reason: 'source_changed' as const};
    }
    if (approval?.state === 'approved' && approval.scope === 'operation') {
      const sessionId = request.owner.sessionId;
      const lease = await options.store.consume(sessionId, approval.id, approval.revision, request.owner, decision.permissionSnapshotHash);
      let authorized = false;
      try {
        if (!await current(request, job)) throw Error('permission_denied');
        decision = await evaluate(request, approval.id);
        authorized = decision.state === 'allow';
        return decision;
      } finally {
        if (!authorized) {
          // Only this exact lease can be settled here. A later state change
          // wins the CAS, and a losing consumer never obtains a lease.
          try {
            await options.store.transition(sessionId, lease.id, lease.revision, ['executing'], 'uncertain');
            await changed(sessionId);
          } catch (error) {
            if (!(error instanceof Error) || error.message !== 'permission_revision_conflict') throw error;
          }
        }
      }
    }
    if (approval && !['pending', 'approved'].includes(approval.state)) {
      return {...decision, state: 'blocked' as const, reason: 'source_changed' as const};
    }
    if (!approval && createApproval) {
      approval = await options.store.request(request, decision);
      await changed(request.owner.sessionId);
    }
    return {...decision, ...(approval ? {approvalId: approval.id} : {})};
  }

  const engine = {
    evaluate,
    authorize,
    changed,
    async revalidate(sessionId: string) {
      for (const approval of await options.store.approvals(sessionId)) {
        if (!['pending', 'approved'].includes(approval.state)) continue;
          const check = approval.state === 'approved' && approval.scope !== 'operation' ? 'execution' : 'admission';
          const current = await evaluate(approval.request, undefined, false, check);
        if (current.reason === 'source_changed' || current.reason === 'expired'
            || current.permissionSnapshotHash !== approval.permissionSnapshotHash) {
          await invalidate(approval, current.reason || 'permission_changed');
        }
      }
    },
    async decide(input: PermissionApprovalInput) {
      const approval = await options.store.approval(input.sessionId, input.approvalId);
      if (!approval || approval.revision !== input.revision) throw Error('permission_revision_conflict');
      if (approval.state === (input.decision === 'approve' ? 'approved' : 'rejected')) return approval;
      const decision = await evaluate(approval.request);
      if (decision.reason === 'source_changed' || decision.permissionSnapshotHash !== approval.permissionSnapshotHash || Date.parse(approval.request.expiresAt) <= currentTime()) {
        await invalidate(approval, 'permission_changed_or_expired');
        throw Error('permission_denied');
      }
      const result = await options.store.decide(input.sessionId, input.approvalId, input.revision,
        input.decision, input.scope, decision.permissionSnapshotHash);
      await changed(input.sessionId);
      return result;
    },
    async run<T>(raw: PermissionRequest, signal: AbortSignal, operation: PermissionOperation<T>, job?: JobPermissionBinding, wait?: PermissionWait) {
      const request = snapshotRequest(raw);
      signal.throwIfAborted();
      const controller = new AbortController();
      const combined = AbortSignal.any([signal, controller.signal]);
      const id = 'xipermission_' + randomUUID();
      const server = request.scopes.find(scope => scope.kind === 'mcp');
      const activity: Activity = {owner: request.owner, grantIds: [], controller,
        ...(server?.kind === 'mcp' ? {serverId: server.serverId} : {}), ...(job ? {job} : {})};
      active.set(id, activity);
      let decision: PermissionDecision | undefined;
      let expiry: ReturnType<typeof setTimeout> | undefined;
      let executing = false;
      const assertRequest = async (check: RequestCheck) => {
        combined.throwIfAborted();
        if (!await current(request, job)) throw Error('permission_denied');
        const latest = await evaluate(request, decision?.approvalId, !!job, check);
        if (latest.state !== 'allow') {
          if (latest.reason === 'expired') controller.abort('expired');
          throw Error('permission_denied');
        }
        combined.throwIfAborted();
      };
      // A successful write changes its own target. The tool's staged commit
      // owns its version fence; the engine still checks sources and authority.
      const assert = () => assertRequest('execution');
      try {
        decision = await authorize(request, true, job);
        activity.grantIds = decision.grantRefs.map(ref => ref.grantId);
        if (decision.state === 'pending' && wait && !job) {
          // One original call, one wait budget, one frozen request. This never
          // starts a Run, reconstructs input, or retries a dispatched effect.
          decision = await wait.wait(async () => {
            while (decision!.state === 'pending') {
              await waitForChange(request, decision!, combined);
              combined.throwIfAborted();
              try {await wait.beforeResume?.();}
              catch (error) {
                if (!combined.aborted && decision!.approvalId) {
                  await invalidate(await options.store.approval(request.owner.sessionId, decision!.approvalId), 'execution_context_changed');
                }
                throw error;
              }
              combined.throwIfAborted();
              decision = await authorize(request, false, job);
              activity.grantIds = decision.grantRefs.map(ref => ref.grantId);
            }
            return decision!;
          });
        }
        combined.throwIfAborted();
        if (decision.state !== 'allow') throw Error(decision.state === 'pending' ? 'permission_pending' : 'permission_denied');
        const approval = decision.approvalId ? await options.store.approval(request.owner.sessionId, decision.approvalId) : null;
        const granted = (await options.store.grants(request.owner.sessionId))
          .filter(grant => decision!.grantRefs.some(ref => ref.grantId === grant.grantId));
        const deadlines = [Date.parse(request.expiresAt), ...(approval ? [Date.parse(approval.request.expiresAt)] : []),
          ...granted.flatMap(grant => grant.expiresAt ? [Date.parse(grant.expiresAt)] : [])];
        expiry = setTimeout(() => controller.abort('expired'), Math.max(1, Math.min(2147483647, Math.min(...deadlines) - currentTime())));
        expiry.unref();
        await assertRequest('admission');
        executing = true;
        await options.store.audit(request.owner.sessionId, 'execution_intent', id,
          {owner: request.owner, callId: request.callId, requestDigest: decision.requestDigest, grantRefs: decision.grantRefs, approvalId: decision.approvalId});
        const result = await operation({signal: combined, decision, assert});
        await assert();
        if (decision?.state === 'allow' && decision.approvalId) {
          const approval = await options.store.approval(request.owner.sessionId, decision.approvalId);
          if (approval?.state === 'executing') await options.store.transition(request.owner.sessionId, approval.id, approval.revision, ['executing'], 'executed');
        }
        await options.store.audit(request.owner.sessionId, 'execution_completed', id, {owner: request.owner, requestDigest: decision.requestDigest});
        return result;
      } catch (error) {
        // A losing concurrent consumer must never change another call's lease.
        if (decision?.state === 'allow' && decision.approvalId) {
          const approval = await options.store.approval(request.owner.sessionId, decision.approvalId);
          if (approval?.state === 'executing') await options.store.transition(request.owner.sessionId, approval.id, approval.revision, ['executing'], 'uncertain');
        }
        if (executing) await options.store.audit(request.owner.sessionId, 'execution_failed', id,
          {owner: request.owner, requestDigest: decision!.requestDigest, cancelled: combined.aborted});
        if (combined.aborted) throw Error(['revoked', 'expired'].includes(String(combined.reason)) ? 'permission_denied' : 'cancelled');
        throw error;
      } finally { if (expiry) clearTimeout(expiry); active.delete(id); }
    },
    runJob<T>(raw: PermissionRequest, signal: AbortSignal, binding: JobPermissionBinding, operation: PermissionOperation<T>): Promise<T> {
      return engine.run(raw, signal, operation, binding);
    },
    async revoke(sessionId: string, grantId: string, revision: number) {
      const grant = await options.store.revoke(sessionId, grantId, revision);
      for (const activity of active.values()) {
        if (activity.owner.sessionId === sessionId && activity.grantIds.includes(grantId)) activity.controller.abort('revoked');
      }
      await changed(sessionId);
      return grant;
    },
    cancelServer(serverId: string) {
      for (const activity of active.values()) if (activity.serverId === serverId) activity.controller.abort('revoked');
    },
    cancelRun(owner: PermissionOwner) {
      for (const activity of active.values()) if (!activity.job && activity.owner.sessionId === owner.sessionId
        && activity.owner.runId === owner.runId && activity.owner.generation === owner.generation) activity.controller.abort('cancelled');
    },
    async cancelTask(owner: PermissionOwner) {
      for (const activity of active.values()) if (activity.owner.taskId === owner.taskId && activity.owner.sessionId === owner.sessionId) activity.controller.abort('cancelled');
      for (const approval of await options.store.approvals(owner.sessionId)) {
        if (approval.request.owner.taskId === owner.taskId) await invalidate(approval, 'task_cancelled');
      }
    },
    activeCount: () => active.size
  };
  return engine;
}
export type PermissionEngine = ReturnType<typeof createPermissionEngine>;
