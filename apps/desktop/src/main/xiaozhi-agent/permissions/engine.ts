import { randomUUID } from 'node:crypto';
import type { PermissionDecision, PermissionOwner, PermissionRequest, PermissionApprovalInput, PermissionScope } from '../../../shared/xiaozhi-permissions';
import type { PermissionStore } from './store';
import { permissionHash, requestDigest, snapshotRequest } from './validation';
import { scopeCovers } from './resources';

type Activity = { owner: PermissionOwner; grantIds: string[]; controller: AbortController; serverId?: string };
type Options = {
  store: PermissionStore;
  current: (owner: PermissionOwner) => boolean | Promise<boolean>;
  notify?: (sessionId: string) => void | Promise<void>;
  now?: () => number;
  verifyRequest?: (request: PermissionRequest) => Promise<boolean>;
};

function scopeParts(scope: PermissionScope): PermissionScope[] {
  if (scope.kind === 'filesystem') return scope.actions.map(action => ({...scope, actions: [action]}));
  if (scope.kind === 'network') return scope.methods.map(method => ({...scope, methods: [method]}));
  if (scope.kind === 'egress') return scope.classifications.map(classification => ({...scope, classifications: [classification]}));
  if (scope.kind === 'mcp') return scope.tools.map(tool => ({...scope, tools: [tool]}));
  return [scope];
}

/** Main-owned policy evaluation. References never replace current grants. */
export function createPermissionEngine(options: Options) {
  const active = new Map<string, Activity>();
  const currentTime = options.now || Date.now;

  async function evaluate(raw: PermissionRequest, approvalLease?: string): Promise<PermissionDecision> {
    const request = snapshotRequest(raw);
    const digest = requestDigest(request);
    const grants = await options.store.grants(request.owner.sessionId);
    const requestedParts = request.scopes.flatMap(scopeParts);
    const relevant = grants.filter(grant => (grant.taskId === null || grant.taskId === request.owner.taskId)
      && requestedParts.some(scope => scopeCovers(grant.scope, scope)));
    const usable = relevant.filter(grant => !grant.revokedAt && (!grant.expiresAt || Date.parse(grant.expiresAt) > currentTime()));
    const missing = requestedParts.filter(scope => !usable.some(grant => scopeCovers(grant.scope, scope)));
    const refs = usable.map(grant => ({grantId: grant.grantId, revision: grant.revision}));
    const snapshot = permissionHash({requestDigest: digest, grants: relevant.map(grant => ({
      grantId: grant.grantId, revision: grant.revision, revokedAt: grant.revokedAt, expiresAt: grant.expiresAt,
      scopeHash: permissionHash(grant.scope)
    })).sort((left, right) => left.grantId.localeCompare(right.grantId))});
    const base = {schemaVersion: 1 as const, requestDigest: digest, permissionSnapshotHash: snapshot, grantRefs: refs, missing};
    if (Date.parse(request.expiresAt) <= currentTime()) return {...base, state: 'blocked', reason: 'expired'};
    if (options.verifyRequest && !await options.verifyRequest(request)) return {...base, state: 'blocked', reason: 'source_changed'};
    if (!missing.length) return {...base, state: 'allow'};
    const prior = (await options.store.approvals(request.owner.sessionId))
      .find(item => item.request.owner.taskId === request.owner.taskId && item.requestDigest === digest);
    if (prior?.state === 'rejected') return {...base, state: 'blocked', reason: 'rejected', approvalId: prior.id};
    if (prior && Date.parse(prior.request.expiresAt) <= currentTime()) {
      return {...base, state: 'blocked', reason: 'expired', approvalId: prior.id};
    }
    if (prior && prior.id === approvalLease && prior.state === 'executing' && prior.admittedOwner && permissionHash(prior.admittedOwner) === permissionHash(request.owner)
        && prior.permissionSnapshotHash === snapshot) return {...base, state: 'allow', approvalId: prior.id};
    return {...base, state: 'pending', reason: 'missing_grant', ...(prior ? {approvalId: prior.id} : {})};
  }

  async function invalidate(approval: Awaited<ReturnType<PermissionStore['approval']>>, reason: string) {
    if (!approval || !['pending', 'approved'].includes(approval.state)) return;
    await options.store.transition(approval.request.owner.sessionId, approval.id, approval.revision,
      [approval.state], 'invalidated', {invalidatedReason: reason});
  }

  async function authorize(raw: PermissionRequest, createApproval = true) {
    const request = snapshotRequest(raw);
    if (!await options.current(request.owner)) throw Error('permission_denied');
    let decision = await evaluate(request);
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
      await options.store.consume(request.owner.sessionId, approval.id, approval.revision, request.owner, decision.permissionSnapshotHash);
      if (!await options.current(request.owner)) throw Error('permission_denied');
      decision = await evaluate(request, approval.id);
      return decision;
    }
    if (approval && !['pending', 'approved'].includes(approval.state)) {
      return {...decision, state: 'blocked' as const, reason: 'source_changed' as const};
    }
    if (!approval && createApproval) {
      approval = await options.store.request(request, decision);
      await options.notify?.(request.owner.sessionId);
    }
    return {...decision, ...(approval ? {approvalId: approval.id} : {})};
  }

  return {
    evaluate,
    authorize,
    async revalidate(sessionId: string) {
      for (const approval of await options.store.approvals(sessionId)) {
        if (!['pending', 'approved'].includes(approval.state)) continue;
        const current = await evaluate(approval.request);
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
      await options.notify?.(input.sessionId);
      return result;
    },
    async run<T>(raw: PermissionRequest, signal: AbortSignal, operation: (context: {
      signal: AbortSignal; decision: PermissionDecision; assert: () => Promise<void>
    }) => Promise<T>) {
      const request = snapshotRequest(raw);
      signal.throwIfAborted();
      const decision = await authorize(request);
      if (decision.state !== 'allow') throw Error(decision.state === 'pending' ? 'permission_pending' : 'permission_denied');
      const controller = new AbortController();
      const combined = AbortSignal.any([signal, controller.signal]);
      const approval = decision.approvalId ? await options.store.approval(request.owner.sessionId, decision.approvalId) : null;
      const granted = (await options.store.grants(request.owner.sessionId))
        .filter(grant => decision.grantRefs.some(ref => ref.grantId === grant.grantId));
      const deadlines = [Date.parse(request.expiresAt),
        ...(approval ? [Date.parse(approval.request.expiresAt)] : []),
        ...granted.flatMap(grant => grant.expiresAt ? [Date.parse(grant.expiresAt)] : [])];
      const expiry = setTimeout(() => controller.abort('expired'), Math.max(1, Math.min(2147483647, Math.min(...deadlines) - currentTime())));
      expiry.unref();
      const id = 'xipermission_' + randomUUID();
      const server = request.scopes.find(scope => scope.kind === 'mcp');
      active.set(id, {owner: request.owner, grantIds: decision.grantRefs.map(ref => ref.grantId), controller,
        ...(server?.kind === 'mcp' ? {serverId: server.serverId} : {})});
      const assert = async () => {
        combined.throwIfAborted();
        if (!await options.current(request.owner)) throw Error('permission_denied');
        const latest = await evaluate(request, decision.approvalId);
        if (latest.state !== 'allow') {
          if (latest.reason === 'expired') controller.abort('expired');
          throw Error('permission_denied');
        }
        combined.throwIfAborted();
      };
      try {
        await assert();
        await options.store.audit(request.owner.sessionId, 'execution_intent', id,
          {owner: request.owner, callId: request.callId, requestDigest: decision.requestDigest, grantRefs: decision.grantRefs, approvalId: decision.approvalId});
        const result = await operation({signal: combined, decision, assert});
        await assert();
        if (decision.approvalId) {
          const approval = await options.store.approval(request.owner.sessionId, decision.approvalId);
          if (approval?.state === 'executing') await options.store.transition(request.owner.sessionId, approval.id, approval.revision, ['executing'], 'executed');
        }
        await options.store.audit(request.owner.sessionId, 'execution_completed', id, {owner: request.owner, requestDigest: decision.requestDigest});
        return result;
      } catch (error) {
        if (decision.approvalId) {
          const approval = await options.store.approval(request.owner.sessionId, decision.approvalId);
          if (approval?.state === 'executing') await options.store.transition(request.owner.sessionId, approval.id, approval.revision, ['executing'], 'uncertain');
        }
        await options.store.audit(request.owner.sessionId, 'execution_failed', id,
          {owner: request.owner, requestDigest: decision.requestDigest, cancelled: combined.aborted});
        if (combined.aborted) throw Error(['revoked', 'expired'].includes(String(combined.reason)) ? 'permission_denied' : 'cancelled');
        throw error;
      } finally { clearTimeout(expiry); active.delete(id); }
    },
    async revoke(sessionId: string, grantId: string, revision: number) {
      const grant = await options.store.revoke(sessionId, grantId, revision);
      for (const activity of active.values()) {
        if (activity.owner.sessionId === sessionId && activity.grantIds.includes(grantId)) activity.controller.abort('revoked');
      }
      await options.notify?.(sessionId);
      return grant;
    },
    cancelServer(serverId: string) {
      for (const activity of active.values()) if (activity.serverId === serverId) activity.controller.abort('revoked');
    },
    async cancelTask(owner: PermissionOwner) {
      for (const activity of active.values()) if (activity.owner.taskId === owner.taskId && activity.owner.sessionId === owner.sessionId) activity.controller.abort('cancelled');
      for (const approval of await options.store.approvals(owner.sessionId)) {
        if (approval.request.owner.taskId === owner.taskId) await invalidate(approval, 'task_cancelled');
      }
    },
    activeCount: () => active.size
  };
}
export type PermissionEngine = ReturnType<typeof createPermissionEngine>;
