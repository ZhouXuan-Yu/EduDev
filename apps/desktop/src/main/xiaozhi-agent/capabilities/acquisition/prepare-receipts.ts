import fs from 'node:fs/promises';
import path from 'node:path';
import {fileVersion} from '../../workspace-files';
import {filesystemScope, checkedFile} from '../../permissions/resources';
import type {Sql} from '../../session-state';
import type {JournalOwner} from '../../events/journal';
import type {PermissionOwner, PermissionRequest} from '../../../../shared/xiaozhi-permissions';
import {validOwner, validRequest, requestDigest} from '../../permissions/validation';
import {createPermissionStore, readPermissionApprovalRow} from '../../permissions/store';
import {protocolHash} from '../validation';
import {readAcquisitionRow, type AcquisitionOperation, type AcquisitionArtifact} from './state';
import {createEffectState} from '../../effects/state';
import {createCapabilityRegistry} from '../registry';
import {createMcpRuntime} from '../../mcp-runtime';
import {FILESYSTEM_RECIPE} from './recipes';

export type AcquisitionCall = {owner: PermissionOwner; callId: string; operationId: string; candidateId: string};
type AuditRef = {id: string; kind: string; reference: string; hash: string};
type PrepareReceipt = {
  schemaVersion: 1; call: AcquisitionCall; requirementsVersion: number; inputDigest: string;
  operation: AcquisitionOperation; artifactHash: string | null; fileVersions: {path: string; version: string}[];
  approval: {id: string; requestDigest: string; requestHash: string} | null;
  evidence: AuditRef[];
};
const kind = 'capability_prepare_receipt_v1';
const nativeKinds = ['mcp_service_intent', 'mcp_service_terminal', 'mcp_service_not_started', 'mcp_service_start_failed', 'mcp_service_cleanup_required', 'capability_function_probe'];
const reference = (owner: PermissionOwner, callId: string) => 'acquisition-call:' + protocolHash({owner, callId});
const same = (left: unknown, right: unknown) => protocolHash(left) === protocolHash(right);
function assert(value: unknown): asserts value {if (!value) throw Error('acquisition_receipt_unproven');}
function artifactFact(artifact: AcquisitionArtifact) {
  return {id: artifact.id, recipeId: artifact.recipeId, sourceHash: artifact.sourceHash,
    serverId: artifact.serverId, schemaHash: artifact.schemaHash, filesHash: artifact.filesHash, binding: artifact.binding};
}
async function executionFileVersions(artifact: AcquisitionArtifact) {
  assert(artifact.binding.files.length === 3);
  const scope = filesystemScope(artifact.binding.directory, ['read']);
  return Promise.all(artifact.binding.files.map(async entry => {
    const filename = checkedFile(scope, path.resolve(artifact.binding.directory, entry.path), 'read');
    const stat = await fs.lstat(filename);assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size === entry.bytes);
    return {path: entry.path, version: fileVersion(stat)};
  }));
}
async function artifact(sql: Sql, id: string | null) {
  if (!id) return null;
  return readAcquisitionRow<AcquisitionArtifact>((await sql.all('SELECT * FROM xiaozhi_acquisition_artifacts_v1 WHERE id=?', [id]))[0]);
}
async function governance(sql: Sql, call: AcquisitionCall, operation: AcquisitionOperation) {
  assert(validOwner(call.owner) && call.owner.sessionId === operation.owner.sessionId && same(call.owner, operation.owner)
    && call.operationId === operation.id && call.candidateId === operation.candidateId);
  const effect = await createEffectState(sql).byCall(call.owner.runId, call.callId);
  const row = (await sql.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=? AND generation=?',
    [call.owner.runId, call.callId, call.owner.generation]))[0];
  assert(effect && row && row.admitted === 1 && row.tool === 'capability_prepare' && effect.tool === 'capability_prepare'
    && same(effect.owner, call.owner) && effect.contract.taskId === call.owner.taskId
    && effect.contract.requirementsVersion === operation.requirementsVersion
    && effect.contract.inputDigest === protocolHash({candidateId: call.candidateId})
    && effect.contract.authorityRefs.includes('acquisition-outcome:' + protocolHash(operation)));
  return effect;
}
async function scopedEvidence(sql: Sql, call: AcquisitionCall) {
  const rows = await sql.all(`SELECT * FROM xiaozhi_permission_audit_v1 WHERE session_id=?
    AND json_extract(metadata_json,'$.acquisitionCall.callId')=? AND json_extract(metadata_json,'$.acquisitionCall.operationId')=? ORDER BY rowid LIMIT 129`,
  [call.owner.sessionId, call.callId, call.operationId]);
  assert(rows.length <= 128);
  const selected = rows.filter(row => nativeKinds.includes(String(row.kind)));
  for (const row of selected) {
    const data = JSON.parse(String(row.metadata_json));
    assert(same(data.acquisitionCall, call) && same(data.owner, call.owner));
  }
  return selected;
}
function nativeComplete(rows: Record<string, unknown>[], ready: boolean, artifactId: string | null) {
  const intents = rows.filter(row => row.kind === 'mcp_service_intent');
  assert(!rows.some(row => ['mcp_service_start_failed', 'mcp_service_cleanup_required'].includes(String(row.kind))));
  for (const intent of intents) {
    const terminals = rows.filter(row => row.kind === 'mcp_service_terminal' && row.reference === intent.reference);
    assert(terminals.length === 1);
    const terminal = JSON.parse(String(terminals[0].metadata_json));
    assert(terminal.result?.cleanup?.jobActiveProcesses === 0 && terminal.result.cleanup.profileRemoved === true
      && terminal.result.cleanup.remainingOwnedAces === 0);
    if (ready) assert(terminal.result.state === 'completed');
  }
  // A terminal cannot be borrowed from an unbound or different execution.
  assert(rows.filter(row => row.kind === 'mcp_service_terminal').every(row => intents.some(intent => intent.reference === row.reference)));
  if (ready) assert(intents.length > 0 && rows.some(row => {
    if (row.kind !== 'capability_function_probe' || row.reference !== artifactId) return false;
    const data = JSON.parse(String(row.metadata_json));return data.failed === false && data.healthMarker === true;
  }));
}
async function originalApproval(sql: Sql, call: AcquisitionCall, request: PermissionRequest) {
  assert(validRequest(request) && same(request.owner, call.owner)
    && ['capability_prepare', 'mcp_stdio_start', 'mcp_call'].includes(request.action));
  assert(request.action === 'capability_prepare' ? request.callId === call.operationId
    : request.action === 'mcp_stdio_start' ? request.callId.startsWith('mcp_lease_')
      : request.callId.startsWith('acquisition_health_'));
  const digest = requestDigest(request);
  const rows = await sql.all(`SELECT * FROM ai_confirmation_items WHERE action_type='xiaozhi_permission_v2' AND session_id=?
    AND json_extract(payload_json,'$.requestDigest')=? LIMIT 2`, [call.owner.sessionId, digest]);
  assert(rows.length === 1);
  const value = readPermissionApprovalRow(rows[0]);
  assert(same(value.request.owner, call.owner) && same(value.request, request));
  return {id: value.id, requestDigest: digest, requestHash: protocolHash(request)};
}
async function readyArtifact(sql: Sql, operation: AcquisitionOperation) {
  const value = await artifact(sql, operation.artifactId);
  assert(value && value.status === 'ready' && value.recipeId === FILESYSTEM_RECIPE.id && value.serverId && value.schemaHash
    && operation.plan?.artifactId === value.id && value.binding.artifactId === value.id && operation.plan.digest === value.binding.packageHash
    && operation.plan.directory === value.binding.directory);
  const source = await createMcpRuntime(sql).authority(value.serverId);
  assert(source && source.transport === 'stdio' && source.schemaHash === value.schemaHash && source.sourceHash === value.sourceHash
    && source.tools.includes('read_text_file'));
  const snapshot = await createCapabilityRegistry(sql).snapshot();
  const providerId = 'mcp.managed.filesystem.v_' + value.id.slice(-24);
  const binding = snapshot.bindings.find(row => row.providerId === providerId && row.capabilityId === 'edu.workspace.file.read-text');
  const provider = snapshot.providers.find(row => row.id === providerId);
  assert(provider?.health === 'ready' && binding?.enabled && provider.source.packageHash === protocolHash(value.binding.files)
    && provider.source.evidenceRef === 'mcp-function:' + value.serverId + ':' + value.schemaHash);
  return value;
}

/** Write only from the original operation CAS transaction, after all owned work/cleanup has settled. */
export async function writeAcquisitionPrepareReceipt(sql: Sql, call: AcquisitionCall, operation: AcquisitionOperation, pending?: PermissionRequest) {
  const effect = await governance(sql, call, operation);
  assert(['ready', 'needs_approval'].includes(operation.phase) && (operation.phase === 'ready' ? operation.error === null : operation.error === 'permission_pending'));
  const saved = readAcquisitionRow<AcquisitionOperation>((await sql.all('SELECT * FROM xiaozhi_acquisition_operations_v1 WHERE id=?', [operation.id]))[0]);
  assert(saved && same(saved, operation));
  const rows = await scopedEvidence(sql, call);nativeComplete(rows, operation.phase === 'ready', operation.artifactId);
  const value = operation.phase === 'ready' ? await readyArtifact(sql, operation) : null;
  const receipt: PrepareReceipt = {schemaVersion: 1, call, requirementsVersion: operation.requirementsVersion,
    inputDigest: effect.contract.inputDigest, operation: structuredClone(operation), artifactHash: value ? protocolHash(artifactFact(value)) : null, fileVersions: value ? await executionFileVersions(value) : [],
    approval: operation.phase === 'needs_approval' ? await originalApproval(sql, call, pending!) : null,
    evidence: rows.map(row => ({id: String(row.id), kind: String(row.kind), reference: String(row.reference), hash: protocolHash(JSON.parse(String(row.metadata_json)))}))};
  assert(Buffer.byteLength(JSON.stringify(receipt)) <= 128 * 1024);
  const prior = await sql.all('SELECT id FROM xiaozhi_permission_audit_v1 WHERE session_id=? AND kind=? AND reference=? LIMIT 1',
    [call.owner.sessionId, kind, reference(call.owner, call.callId)]);assert(!prior.length);
  await createPermissionStore(sql).audit(call.owner.sessionId, kind, reference(call.owner, call.callId), {receipt, hash: protocolHash(receipt)});
}

/** Read durable domain evidence only. Never install, launch, grant, replay or update an Effect. */
export function createAcquisitionPrepareEffectReader(sql: Sql) {
  return async (owner: JournalOwner, callId: string, tool: string): Promise<'matched' | 'uncertain' | 'not_checked'> => {
    if (tool !== 'capability_prepare') return 'not_checked';
    try {
      const effect = await createEffectState(sql).byCall(owner.runId, callId);assert(effect && effect.tool === tool && effect.owner.sessionId === owner.sessionId
        && effect.owner.generation === owner.generation);
      const rows = await sql.all('SELECT * FROM xiaozhi_permission_audit_v1 WHERE session_id=? AND kind=? AND reference=? LIMIT 2',
        [owner.sessionId, kind, reference(effect.owner, callId)]);assert(rows.length === 1);
      assert(Buffer.byteLength(String(rows[0].metadata_json)) <= 132 * 1024);
      const envelope = JSON.parse(String(rows[0].metadata_json));const receipt = envelope.receipt as PrepareReceipt;
      assert(receipt?.schemaVersion === 1 && protocolHash(receipt) === envelope.hash && same(receipt.call.owner, effect.owner)
        && receipt.call.callId === callId && receipt.inputDigest === effect.contract.inputDigest && receipt.requirementsVersion === effect.contract.requirementsVersion);
      await governance(sql, receipt.call, receipt.operation);
      const evidence = await scopedEvidence(sql, receipt.call);nativeComplete(evidence, receipt.operation.phase === 'ready', receipt.operation.artifactId);
      assert(same(receipt.evidence, evidence.map(row => ({id: String(row.id), kind: String(row.kind), reference: String(row.reference), hash: protocolHash(JSON.parse(String(row.metadata_json)))}))));
      if (receipt.operation.phase === 'ready') {
        const current = await readyArtifact(sql, receipt.operation);
        assert(receipt.approval === null && receipt.artifactHash === protocolHash(artifactFact(current)) && same(receipt.fileVersions, await executionFileVersions(current)));
      } else {
        assert(receipt.operation.phase === 'needs_approval' && receipt.operation.error === 'permission_pending' && receipt.approval && receipt.artifactHash === null && Array.isArray(receipt.fileVersions) && receipt.fileVersions.length === 0);
        const row = (await sql.all("SELECT * FROM ai_confirmation_items WHERE id=? AND session_id=? AND action_type='xiaozhi_permission_v2'", [receipt.approval.id, owner.sessionId]))[0];assert(row);
        const approval = readPermissionApprovalRow(row);assert(receipt.approval.requestHash === protocolHash(approval.request)
          && same(receipt.approval, await originalApproval(sql, receipt.call, approval.request)));
      }
      return 'matched';
    } catch {return 'uncertain';}
  };
}
