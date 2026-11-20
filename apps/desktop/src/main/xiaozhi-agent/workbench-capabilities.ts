import type {WorkbenchCapabilityRow, WorkbenchTaskContext} from '../../shared/xiaozhi-workbench';
import type {CapabilityCandidate} from '../../shared/xiaozhi-acquisition';
import type {AcquisitionArtifact, AcquisitionOperation} from './capabilities/acquisition/state';
import {readAcquisitionRow} from './capabilities/acquisition/state';
import {createCapabilityRegistry} from './capabilities/registry';
import {assessConformance} from './capabilities/resolver';
import {protocolHash} from './capabilities/validation';
import {readMcpCatalog} from './mcp-runtime';
import {readExtensionPackageRow} from './extensions/package-manager';
import {createExtensionState} from './extensions/state';
import {createTaskState} from './tasks/task-state';
import {readPermissionApprovalRow} from './permissions/store';
import {workbenchFailure, workbenchRows, workbenchSource, workbenchText, type WorkbenchRead} from './workbench-state';

function base(id: string, name: string, sourceKind: WorkbenchCapabilityRow['sourceKind']): WorkbenchCapabilityRow {
  return {id, name: workbenchText(name), sourceKind, capabilityId: null, providerId: null, version: '', origin: 'candidate',
    source: '', sourceHash: null, schemaHash: null, license: null, installed: 'unknown', verification: 'unknown',
    authorization: 'task_check_required', availability: 'task_check_required', requiredMissing: [], optionalMissing: [], conditionalMissing: [], reasons: [], risk: [],
    verifiedAt: null, expiresAt: null};
}
export async function workbenchTaskContext(read: WorkbenchRead, query: {sessionId?: string; taskId?: string; requirementsVersion?: number}): Promise<WorkbenchTaskContext> {
  if (!query.sessionId) return {state: 'none', sessionId: null, taskId: null, requirementsVersion: null};
  const state = createTaskState(read.sql, {sanitize: async text => text});
  try {
    const task = await state.latest(query.sessionId);
    if (!task) return {state: 'none', sessionId: query.sessionId, taskId: null, requirementsVersion: null};
    const current = !query.taskId || query.taskId === task.id && query.requirementsVersion === task.requirementsVersion;
    return {state: current ? 'current' : 'stale', sessionId: query.sessionId,
      taskId: task.id, requirementsVersion: task.requirementsVersion};
  } catch {
    workbenchFailure(read, 'tasks', 'corrupt');
    return {state: 'stale', sessionId: query.sessionId, taskId: query.taskId || null, requirementsVersion: query.requirementsVersion || null};
  }
}
async function pendingPreparation(read: WorkbenchRead, context: WorkbenchTaskContext) {
  const candidates = new Set<string>(), artifacts = new Set<string>();
  if (context.state !== 'current' || !context.sessionId || !context.taskId || context.requirementsVersion === null) return {candidates, artifacts};
  const approvals = new Map<string, Set<string>>();
  for await (const row of workbenchRows(read, 'ai_confirmation_items', 'approvals',
    "action_type='xiaozhi_permission_v2' AND session_id=? AND status='pending'", [context.sessionId], true)) {
    try {
      const {state, request} = readPermissionApprovalRow(row);
      if (state !== 'pending' || request.action !== 'capability_prepare' || request.owner.taskId !== context.taskId
          || request.requirementsVersion !== context.requirementsVersion || Date.parse(request.expiresAt) <= Date.parse(read.now)) continue;
      const digests = approvals.get(request.callId) || new Set<string>();
      digests.add(request.inputDigest);
      approvals.set(request.callId, digests);
    } catch {workbenchFailure(read, 'approvals', 'corrupt');}
  }
  if (!approvals.size) return {candidates, artifacts};
  for await (const row of workbenchRows(read, 'xiaozhi_acquisition_operations_v1', 'acquisition',
    "json_extract(payload_json,'$.owner.sessionId')=? AND json_extract(payload_json,'$.owner.taskId')=?", [context.sessionId, context.taskId], true)) {
    try {
      const operation = readAcquisitionRow<AcquisitionOperation>(row)!;
      if (operation.phase !== 'needs_approval' || operation.requirementsVersion !== context.requirementsVersion
          || !operation.plan || !approvals.get(operation.id)?.has(protocolHash(operation.plan))) continue;
      candidates.add(operation.candidateId);
      if (operation.artifactId) artifacts.add(operation.artifactId);
    } catch {workbenchFailure(read, 'acquisition', 'corrupt');}
  }
  return {candidates, artifacts};
}

export async function readWorkbenchCapabilities(read: WorkbenchRead, context: WorkbenchTaskContext): Promise<{items: WorkbenchCapabilityRow[]; registryRevision: number | null}> {
  const items: WorkbenchCapabilityRow[] = [], artifacts: AcquisitionArtifact[] = [];
  const awaiting = await pendingPreparation(read, context);
  for await (const row of workbenchRows(read, 'xiaozhi_acquisition_artifacts_v1', 'acquisition')) {
    try {
      const artifact = readAcquisitionRow<AcquisitionArtifact>(row)!;
      const expired = !Number.isFinite(Date.parse(artifact.expiresAt)) || Date.parse(artifact.expiresAt) <= Date.parse(read.now);
      artifacts.push(artifact);
      items.push({...base('artifact:' + artifact.id, artifact.name, 'acquisition'), origin: 'installed', version: workbenchText(artifact.version, 100),
        source: workbenchSource(artifact.source), sourceHash: artifact.sourceHash, schemaHash: artifact.schemaHash, license: workbenchText(artifact.license, 100) || null,
        installed: 'installed', verification: artifact.status === 'revoked' ? 'revoked' : artifact.status === 'failed' ? 'failed'
          : expired ? 'expired' : artifact.status === 'ready' ? 'verified' : 'pending',
        authorization: awaiting.artifacts.has(artifact.id) ? 'required' : 'task_check_required',
        availability: artifact.status === 'ready' && !expired ? 'task_check_required' : 'blocked', expiresAt: artifact.expiresAt,
        reasons: artifact.status === 'revoked' ? ['provider_revoked'] : expired ? ['verification_expired'] : [], risk: ['external_tool']});
    } catch {workbenchFailure(read, 'acquisition', 'corrupt');}
  }
  for await (const row of workbenchRows(read, 'xiaozhi_acquisition_candidates_v1', 'acquisition')) {
    try {
      const candidate = readAcquisitionRow<CapabilityCandidate>(row)!;
      const expired = !Number.isFinite(Date.parse(candidate.expiresAt)) || Date.parse(candidate.expiresAt) <= Date.parse(read.now);
      items.push({...base('candidate:' + candidate.id, candidate.name, 'acquisition'), version: workbenchText(candidate.version, 100),
        source: workbenchSource(candidate.repository || candidate.packageName || candidate.externalId), sourceHash: candidate.sourceHash,
        installed: 'missing', verification: expired ? 'expired' : candidate.source === 'reviewed' ? 'pending' : 'quarantined',
        authorization: awaiting.candidates.has(candidate.id) ? 'required' : 'task_check_required',
        availability: 'blocked', expiresAt: candidate.expiresAt, reasons: [expired ? 'candidate_expired' : 'candidate_requires_review'], risk: ['external_tool']});
    } catch {workbenchFailure(read, 'acquisition', 'corrupt');}
  }
  let registryRevision: number | null = null;
  if (read.tables.has('xiaozhi_capability_registry_v1')) {
    const registryStart = items.length;
    try {
      const registry = createCapabilityRegistry(read.sql), snapshot = await registry.snapshot(); registryRevision = snapshot.revision;
      for (const definition of snapshot.definitions) {
        const bindings = snapshot.bindings.filter(binding => binding.capabilityId === definition.id);
        if (!bindings.length) items.push({...base('registry:' + definition.id + ':missing', definition.name, 'registry'), origin: 'registered',
          capabilityId: definition.id, version: definition.contractVersion, installed: 'missing', availability: 'blocked',
          requiredMissing: definition.requirements.required.map(requirement => requirement.id), optionalMissing: definition.requirements.optional.map(requirement => requirement.id), reasons: ['provider_missing']});
        for (const binding of bindings) {
          const provider = snapshot.providers.find(provider => provider.id === binding.providerId)!;
          const version = await registry.providerVersion(provider.id, provider.version, definition.id);
          const conformance = assessConformance(definition, binding, {capabilityId: definition.id, contractVersion: definition.contractVersion,
            required: [], optional: [], conditions: definition.requirements.conditional.map(item => item.condition), localOnly: false,
            platform: process.platform, budget: {latencyMs: Number.MAX_SAFE_INTEGER, resourceUnits: Number.MAX_SAFE_INTEGER}});
          const artifact = artifacts.find(item => protocolHash(item.binding.files) === provider.source.packageHash);
          const expired = artifact && Date.parse(artifact.expiresAt) <= Date.parse(read.now);
          const reasons = [
            ...(definition.lifecycle.status === 'revoked' ? ['capability_revoked'] : []),
            ...(provider.health === 'revoked' || version?.revoked ? ['provider_revoked'] : []),
            ...(!version ? ['provider_version_missing'] : []), ...(!binding.enabled || provider.health === 'disabled' ? ['disabled'] : []),
            ...(provider.source.verification !== 'verified' ? ['source_unverified'] : []),
            ...(provider.dependencies.some(item => !item.available) ? ['missing_dependency'] : []),
            ...(!provider.platforms.includes(process.platform) || !definition.platforms.includes(process.platform) ? ['platform_incompatible'] : []),
            ...(provider.health !== 'ready' ? ['unhealthy'] : []), ...(conformance.missingRequired.length ? ['missing_required'] : []),
            ...(conformance.missingConditional.length ? ['conditional_task_check'] : []), ...(expired ? ['verification_expired'] : []),
            ...(artifact?.status === 'revoked' ? ['provider_revoked'] : []),
          ];
          const blocked = reasons.some(reason => reason !== 'conditional_task_check');
          items.push({...base('registry:' + definition.id + ':' + provider.id, definition.name, 'registry'), origin: 'registered', capabilityId: definition.id,
            providerId: provider.id, version: provider.version, source: workbenchSource(provider.source.reference), sourceHash: provider.source.packageHash,
            license: artifact?.license || null, schemaHash: artifact?.schemaHash || null,
            installed: provider.runtime === 'main_native' ? 'bundled' : artifact ? 'installed' : 'unknown',
            verification: provider.health === 'revoked' || version?.revoked || artifact?.status === 'revoked' ? 'revoked'
              : expired ? 'expired' : provider.source.verification === 'verified' ? 'verified' : provider.source.verification === 'failed' ? 'failed' : 'unknown',
            availability: blocked ? 'blocked' : conformance.missingConditional.length ? 'task_check_required' : conformance.level,
            requiredMissing: conformance.missingRequired, optionalMissing: conformance.missing, conditionalMissing: conformance.missingConditional,
            reasons: [...new Set(reasons)], risk: [...provider.permissions], verifiedAt: binding.verifiedAt, expiresAt: artifact?.expiresAt || null});
        }
      }
      for (const provider of snapshot.providers.filter(provider => !snapshot.bindings.some(binding => binding.providerId === provider.id))) {
        items.push({...base('registry:unbound:' + provider.id, provider.id, 'registry'), origin: 'registered', providerId: provider.id,
          version: provider.version, source: workbenchSource(provider.source.reference), sourceHash: provider.source.packageHash,
          availability: 'blocked', reasons: ['unbound_provider'], risk: [...provider.permissions]});
      }
    } catch {items.splice(registryStart); registryRevision = null; workbenchFailure(read, 'registry', 'corrupt', null);}
  } else workbenchFailure(read, 'registry', 'not_initialized', null);
  try {
    const catalog = await readMcpCatalog(read.sql);
    for (const server of catalog.servers) {
      const verified = server.status === 'ready' && Boolean(server.schemaHash) && server.schemaHash === server.trustedSchemaHash;
      items.push({...base('mcp:' + server.id, server.name, 'mcp'), origin: 'installed', version: String(server.revision),
        source: workbenchSource(server.endpoint), schemaHash: server.schemaHash || null,
        verification: server.status === 'revoked' ? 'revoked' : server.status === 'failed' ? 'failed' : verified ? 'verified' : 'pending',
        availability: verified ? 'task_check_required' : 'blocked', reasons: verified ? [] : [server.status],
        risk: server.tools.some(tool => !tool.readOnly) ? ['external_effect'] : ['external_tool']});
    }
  } catch {workbenchFailure(read, 'mcp', 'corrupt', null);}
  const extensionState = createExtensionState(read.sql), shownArtifacts = new Set<string>();
  for await (const row of workbenchRows(read, 'app_settings', 'extensions', "key LIKE 'xiaozhi.extension.package.v1.%'")) {
    try {
      const artifactId = String(row.key).slice('xiaozhi.extension.package.v1.'.length), record = readExtensionPackageRow(row, artifactId);
      const state = await extensionState.read(record.manifest.extensionId);
      const version = state.versions.find(item => item.manifest.artifactId === artifactId);
      shownArtifacts.add(artifactId);
      const verified = Boolean(version && !version.revokedAt), enabled = verified && state.enabled && state.activeVersion === record.manifest.version;
      items.push({...base('extension:' + artifactId, record.manifest.extensionId, 'extension'), origin: record.binding ? 'installed' : 'candidate',
        version: record.manifest.version, source: workbenchSource(record.manifest.source), sourceHash: record.manifest.sourceHash,
        license: record.manifest.license, installed: record.binding ? 'installed' : 'missing', verification: version?.revokedAt ? 'revoked'
          : record.phase === 'failed' ? 'failed' : verified ? 'verified' : record.phase === 'quarantined' ? 'quarantined' : 'pending',
        availability: enabled ? 'task_check_required' : 'blocked', reasons: enabled ? [] : [version?.revokedAt ? 'provider_revoked' : record.phase === 'prepared' ? 'disabled' : record.phase],
        risk: ['local_import', 'external_extension'], verifiedAt: version?.healthAt || null});
    } catch {workbenchFailure(read, 'extensions', 'corrupt');}
  }
  for await (const row of workbenchRows(read, 'app_settings', 'extensions', "key LIKE 'xiaozhi.extension.v1.%'")) {
    try {
      const state = await extensionState.read(String(row.key).slice('xiaozhi.extension.v1.'.length));
      for (const version of state.versions.filter(item => !shownArtifacts.has(item.manifest.artifactId))) {
        items.push({...base('extension:' + version.manifest.artifactId, state.extensionId, 'extension'), origin: 'installed', version: version.manifest.version,
          source: workbenchSource(version.manifest.source), sourceHash: version.manifest.sourceHash, license: version.manifest.license,
          installed: 'installed', verification: version.revokedAt ? 'revoked' : 'verified', verifiedAt: version.healthAt,
          availability: !version.revokedAt && state.enabled && state.activeVersion === version.manifest.version ? 'task_check_required' : 'blocked',
          reasons: version.revokedAt ? ['provider_revoked'] : !state.enabled ? ['disabled'] : [], risk: ['external_extension']});
      }
    } catch {workbenchFailure(read, 'extensions', 'corrupt');}
  }
  return {items, registryRevision};
}
