import type {PermissionRequest} from '../../../shared/xiaozhi-permissions';
import type {PrivateApproval} from '../persistent-state';
import type {PermissionService} from './service';
import type {PermissionStore} from './store';
import {requestDigest} from './validation';

/** Imports verified v1 pending/approved facts into the existing approval table. */
export function createLegacyPermissionBridge(options: {
  permissions: PermissionService;
  store: PermissionStore;
  request: (row: PrivateApproval) => Promise<PermissionRequest>;
}) {
  return async (row: PrivateApproval, decision?: 'approve' | 'reject') => {
    if (!['pending', 'approved'].includes(row.state)) throw Error('permission_denied');
    const request = await options.request(row);
    const digest = requestDigest(request);
    const linked = await options.store.legacyApprovalReceipts(row.sessionId, row.id);
    if (linked.some(item => ['invalidated', 'uncertain', 'failed', 'rejected'].includes(item.state)
        || Date.parse(item.request.expiresAt) <= Date.now()
        || item.requestDigest !== digest && ['executing', 'executed'].includes(item.state))) throw Error('permission_denied');
    const assessment = await options.permissions.engine.evaluate(request);
    const approval = await options.store.request(request, assessment);
    await options.store.auditOnce(row.sessionId, 'legacy_approval_linked', approval.id, {legacyId: row.id, requestDigest: approval.requestDigest});
    if (['invalidated', 'uncertain', 'failed', 'rejected'].includes(approval.state)) throw Error('permission_denied');
    const desired = decision || (row.state === 'approved' ? 'approve' : undefined);
    if (desired && approval.state === 'pending') {
      return options.permissions.decide({sessionId: row.sessionId, approvalId: approval.id, revision: approval.revision,
        decision: desired, scope: 'operation'});
    }
    return approval;
  };
}
