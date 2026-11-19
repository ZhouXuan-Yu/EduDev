import type {PermissionRequest, PermissionScope, ScopeGrant} from '../../../shared/xiaozhi-permissions';
import {scopeCovers} from './resources';
import {permissionHash, requestDigest} from './validation';

function scopeParts(scope: PermissionScope): PermissionScope[] {
  if (scope.kind === 'filesystem') return scope.actions.map(action => ({...scope, actions: [action]}));
  if (scope.kind === 'network') return scope.methods.map(method => ({...scope, methods: [method]}));
  if (scope.kind === 'egress') return scope.classifications.map(classification => ({...scope, classifications: [classification]}));
  if (scope.kind === 'mcp') return scope.tools.map(tool => ({...scope, tools: [tool]}));
  return [scope];
}

/** The same scope and revision calculation binds approvals and live admission. */
export function permissionGrantSnapshot(request: PermissionRequest, grants: ScopeGrant[], now: number) {
  const digest = requestDigest(request);
  const requested = request.scopes.flatMap(scopeParts);
  const relevant = grants.filter(grant => (grant.taskId === null || grant.taskId === request.owner.taskId)
    && requested.some(scope => scopeCovers(grant.scope, scope)));
  const usable = relevant.filter(grant => !grant.revokedAt && (!grant.expiresAt || Date.parse(grant.expiresAt) > now));
  return {
    requestDigest: digest,
    missing: requested.filter(scope => !usable.some(grant => scopeCovers(grant.scope, scope))),
    grantRefs: usable.map(grant => ({grantId: grant.grantId, revision: grant.revision})),
    permissionSnapshotHash: permissionHash({requestDigest: digest, grants: relevant.map(grant => ({
      grantId: grant.grantId, revision: grant.revision, revokedAt: grant.revokedAt,
      expiresAt: grant.expiresAt, scopeHash: permissionHash(grant.scope),
    })).sort((left, right) => left.grantId.localeCompare(right.grantId))}),
  };
}
