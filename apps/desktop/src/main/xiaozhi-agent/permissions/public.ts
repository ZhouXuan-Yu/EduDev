import type { PermissionApproval } from '../../../shared/xiaozhi-permissions';
import type { XiaozhiApproval } from '../../../shared/xiaozhi-agent';

export function publicPermissionApproval(item: PermissionApproval): XiaozhiApproval {
  return {id: item.id, runId: item.request.owner.runId, callId: item.request.callId,
    source: item.request.purpose,
    target: item.request.scopes.map(scope => {
      if (scope.kind === 'filesystem') return scope.root;
      if (scope.kind === 'network' || scope.kind === 'egress') return scope.origin;
      if (scope.kind === 'process') return scope.executable;
      if (scope.kind === 'mcp') return scope.serverId;
      return scope.kind;
    }).join(' · '),
    state: item.state === 'invalidated' ? 'interrupted' : item.state,
    permission: item};
}
