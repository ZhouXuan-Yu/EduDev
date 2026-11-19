import type {WorkbenchApprovalDetail, WorkbenchApprovalRef, WorkbenchApprovalRow} from '../../shared/xiaozhi-workbench';
import {readPermissionApprovalRow} from './permissions/store';
import {readLegacyApprovalRow, publicApproval} from './persistent-state';
import {protocolHash} from './capabilities/validation';
import {workbenchFailure, workbenchRows, workbenchText, type WorkbenchRead} from './workbench-state';

export function legacyApprovalEtag(row: Record<string, unknown>) {
  return protocolHash({id: row.id, sessionId: row.session_id, runId: row.run_id,
    action: row.action_type, updatedAt: row.updated_at, payload: row.payload_json});
}
function approvalValue(read: WorkbenchRead, row: Record<string, unknown>): {summary: WorkbenchApprovalRow; detail: WorkbenchApprovalDetail} {
  const session = read.sessions.get(String(row.session_id));
  if (!session) throw Error('permission_denied');
  if (row.action_type === 'xiaozhi_permission_v2') {
    const item = readPermissionApprovalRow(row);
    const expired = Date.parse(item.request.expiresAt) <= Date.parse(read.now);
    const ref: Extract<WorkbenchApprovalRef, {kind: 'permission_v2'}> = {kind: 'permission_v2', sessionId: session.id, id: item.id, revision: item.revision};
    return {detail: {kind: 'permission_v2', ref, approval: item}, summary: {
      ref, kind: ref.kind, id: item.id, revision: item.revision, etag: null, sessionId: session.id, sessionTitle: session.title,
      taskId: item.request.owner.taskId, runId: item.request.owner.runId, state: item.state,
      purpose: workbenchText(item.request.purpose, 500), resources: item.request.scopes.map(scope =>
        workbenchText(scope.kind === 'filesystem' ? scope.root : scope.kind === 'network' || scope.kind === 'egress' ? scope.origin
          : scope.kind === 'process' ? scope.executable : scope.kind === 'mcp' ? scope.serverId : scope.kind, 500)),
      classification: item.request.classification, expiresAt: item.request.expiresAt, updatedAt: item.updatedAt,
      canDecide: item.state === 'pending' && !expired, blockedReasons: expired ? ['expired'] : [],
    }};
  }
  const item = readLegacyApprovalRow(row);
  const ref: Extract<WorkbenchApprovalRef, {kind: 'legacy_copy'}> = {kind: 'legacy_copy', sessionId: session.id, id: item.id, etag: legacyApprovalEtag(row)};
  return {detail: {kind: 'legacy_copy', ref, approval: publicApproval(item)}, summary: {
    ref, kind: ref.kind, id: item.id, revision: null, etag: ref.etag, sessionId: session.id, sessionTitle: session.title,
    taskId: null, runId: item.runId, state: item.state, purpose: '复制工作文件',
    resources: [workbenchText(item.source, 500), workbenchText(item.target, 500)], classification: 'unknown', expiresAt: null,
    updatedAt: workbenchText(row.updated_at, 64), canDecide: ['pending', 'uncertain', 'approved'].includes(item.state), blockedReasons: [],
  }};
}
export async function readWorkbenchApprovals(read: WorkbenchRead): Promise<WorkbenchApprovalRow[]> {
  const items: WorkbenchApprovalRow[] = [];
  for await (const row of workbenchRows(read, 'ai_confirmation_items', 'approvals',
    "action_type IN ('xiaozhi_permission_v2','pi_office_copy')")) {
    if (!read.sessions.has(String(row.session_id))) continue;
    try {items.push(approvalValue(read, row).summary);}
    catch {workbenchFailure(read, 'approvals', 'corrupt');}
  }
  return items;
}
export async function readWorkbenchApprovalDetail(read: WorkbenchRead, ref: WorkbenchApprovalRef): Promise<WorkbenchApprovalDetail> {
  if (!read.sessions.has(ref.sessionId)) throw Error('permission_denied');
  const row = (await read.sql.all('SELECT * FROM ai_confirmation_items WHERE session_id=? AND id=? AND action_type=?',
    [ref.sessionId, ref.id, ref.kind === 'permission_v2' ? 'xiaozhi_permission_v2' : 'pi_office_copy']))[0];
  if (!row) throw Error('changed');
  const value = approvalValue(read, row).detail;
  if (protocolHash(value.ref) !== protocolHash(ref)) throw Error('changed');
  return structuredClone(value);
}
