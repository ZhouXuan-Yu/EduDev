import {createHash} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {CORE_TOOL_NAMES, toolManifest, type ToolManifest} from '../tools/manifest';
import {validBoundedToolResult} from '../tools/execution-bound';
import {currentPermission} from '../permissions/current';
import {canonicalMcp} from '../mcp-schema';
import {protocolHash} from './validation';
import {CAPABILITY_SCHEMA, type CapabilityDefinition, type CapabilityBinding, type ProviderManifest} from './types';
import type {CapabilityRegistry} from './registry';
import type {PermissionOwner} from '../../../shared/xiaozhi-permissions';
import type {PermissionRequest} from '../../../shared/xiaozhi-permissions';
import {providerResult, type ProviderSnapshot} from './provider-contract';
import {TaskAdmissionError} from '../tasks/admission-error';
import sourceManifest from './generated/core-tool-manifest.json' with {type: 'json'};

type Result = Awaited<ReturnType<ToolDefinition['execute']>>;
export type McpToolIdentity = {serverId: string; tool: string; sourceHash: string; schemaHash: string; transport: 'stdio' | 'http'};
export type ToolContractReceipt = {
  schemaVersion: 1;
  capabilityId: string;
  providerId: string;
  providerVersion: string;
  providerHash: string;
  schemaHash: string;
  sourceHash: string;
  contractVersion: '1.0.0';
  snapshotId: string;
  registryRevision: number;
  taskId: string;
  stepId: string | null;
  planRevision: number;
  requirementsVersion: number;
  target: string | null;
  inputDigest: string;
  effect: ToolManifest['effect'];
  scopePolicy: string;
  classification: 'public' | 'teacher_private';
  grantRefs: {grantId: string; revision: number}[];
  authorityRefs: string[];
};
export type ToolGovernanceRecord = Omit<ToolContractReceipt, 'snapshotId' | 'registryRevision' | 'taskId' | 'stepId' | 'planRevision' | 'requirementsVersion' | 'target' | 'inputDigest' | 'grantRefs' | 'authorityRefs'> & {
  name: string;
  parameters: ToolDefinition['parameters'];
  manifest: ToolManifest;
  source?: McpToolIdentity;
};
const coreProviderId = (name: string) => 'edu.native.tool.' + name;
const observedVersions = new Map<string, string>();
export const CORE_TOOL_PROVIDER_IDS = CORE_TOOL_NAMES.map(coreProviderId);
export async function validCorePermissionProvider(registry: CapabilityRegistry, provider: NonNullable<PermissionRequest['provider']>) {
  const name = provider.id.slice('edu.native.tool.'.length);
  if (!provider.id.startsWith('edu.native.tool.') || !CORE_TOOL_NAMES.includes(name) || provider.sourceHash !== sourceManifest.sourceHash) return false;
  const record = await registry.providerVersion(provider.id, provider.version, 'edu.core.tool.' + name);
  const current = (await registry.snapshot()).providers.find(row => row.id === provider.id);
  return !!record && !record.revoked && current?.health === 'ready'
    && record.provider.source.evidenceRef === 'tool-contract:' + provider.sourceHash + ':' + provider.schemaHash;
}
const filesystem = new Set(['office_read_text', 'office_file_stat', 'office_list_files', 'office_read_document', 'office_copy_file',
  'office_create_text', 'office_edit_text', 'office_create_science_figure', 'office_create_document', 'office_deliver_files',
  'education_create_report', 'exec_command', 'environment_inspect', 'environment_repair']);
const intrinsic: Record<string, string> = {
  read: 'selected_skill_bytes', read_education_memory: 'selected_memory', read_teacher_request: 'current_task', read_session_process: 'current_task',
  update_plan: 'task_control', update_task_plan: 'task_control', ask_teacher: 'teacher_input', report_goal_progress: 'task_control',
  find_education_tools: 'registered_catalog', capability_inspect: 'registry_snapshot', capability_resolve: 'registry_snapshot',
  capability_execute: 'selected_provider_dispatch', capability_search: 'public_discovery', capability_prepare: 'dependency_acquisition',
  extension_inspect: 'registered_catalog', extension_prepare: 'extension_install_request', extension_invoke: 'extension_run_request',
  list_terminals: 'task_job_read', write_stdin: 'task_job_lease', close_terminal: 'task_job_lease',
  read_effect_receipt: 'task_effect_read',
  skill_create: 'personal_skill_publication', prepare_education_tool: 'managed_education_recipe',
};
const privateTools = new Set(['office_read_text', 'office_read_document', 'office_read_attachment', 'office_read_material',
  'education_read_material_page', 'education_read_question', 'search_teacher_knowledge', 'education_search_materials',
  'education_search_questions', 'education_read_student_context', 'education_analyse_learning', 'education_find_similar_questions',
  'education_read_paper', 'education_read_practice', 'read_education_memory', 'read_teacher_request', 'read_session_process',
  'exec_command', 'write_stdin', 'list_terminals', 'close_terminal', 'read_effect_receipt']);
function policy(name: string) {
  if (filesystem.has(name)) return 'filesystem_request';
  if (name === 'office_web_fetch' || name === 'office_web_search') return 'public_network_request';
  if (name === 'office_browser') return 'browser_domain_authority';
  if (intrinsic[name]) return intrinsic[name];
  if (CORE_TOOL_NAMES.includes(name) && (name.startsWith('education_') || name.startsWith('office_') || name === 'search_teacher_knowledge')) return 'teacher_domain_authority';
  throw Error('tool_governance_missing');
}
function identityHash(value: unknown) {return createHash('sha256').update(canonicalMcp(value)).digest('hex');}
function definition(name: string, capabilityId: string): CapabilityDefinition {
  return {schema: CAPABILITY_SCHEMA, id: capabilityId, name, description: '保留当前具名工具合同及原领域授权、参数和业务验证。',
    domain: 'tools', contractVersion: '1.0.0', inputSchemaRef: 'edudev:tool:' + name + ':input.v1', outputSchemaRef: 'edudev:tool:' + name + ':result.v1',
    requirements: {required: [{id: 'invoke', description: '执行原具名工具及其领域边界'}], optional: [], conditional: []},
    guarantees: ['named_tool_contract', 'current_task', 'domain_validation', 'original_journal_receipt'], limitations: [],
    errors: ['invalid_input', 'invalid_output', 'permission_denied', 'source_changed', 'cancelled'],
    constraints: {localPreferred: true, networkRequired: false, supportsCancellation: true, idempotency: 'unknown'},
    platforms: ['win32', 'darwin', 'linux'], lifecycle: {status: 'active'}};
}
function declaration(record: ToolGovernanceRecord) {
  const external = !!record.source;
  const verifiedAt = observedVersions.get(record.providerHash) || new Date().toISOString();
  observedVersions.set(record.providerHash, verifiedAt);
  const provider: ProviderManifest = {schema: CAPABILITY_SCHEMA, id: record.providerId, type: external ? 'mcp' : 'native', version: record.providerVersion,
    publisher: {id: external ? 'external-mcp' : 'edudev', official: !external},
    source: {reference: external ? 'mcp:' + record.source!.serverId + ':' + record.source!.tool : 'edudev:tool:' + record.name,
      packageHash: record.providerHash, verification: 'verified', evidenceRef: 'tool-contract:' + record.sourceHash + ':' + record.schemaHash},
    runtime: external ? record.source!.transport === 'http' ? 'remote' : 'isolated' : 'main_native', dependencies: [],
    permissions: [record.scopePolicy], toolRefs: [record.name], platforms: ['win32', 'darwin', 'linux'],
    locality: record.source?.transport === 'http' ? 'remote' : 'local', health: 'ready',
    cost: {latencyMs: record.manifest.timeoutMs, resourceUnits: 1}};
  const binding: CapabilityBinding = {capabilityId: record.capabilityId, providerId: record.providerId, contractVersion: '1.0.0', adapterVersion: '1.0.0',
    enabled: true, priority: 1, userPinned: false, verifiedAt, providerVersion: record.providerVersion, providerHash: record.providerHash,
    conformance: {capabilityId: record.capabilityId, contractVersion: '1.0.0', level: 'full', limitations: [], verifiedAt,
      evidence: [{requirementId: 'invoke', supported: true, kind: 'adapter_detected', reference: 'tool-contract:' + record.providerHash}]}};
  return {definition: definition(record.name, record.capabilityId), provider, binding};
}
/** All final Session definitions enter this same existing Registry. Named implementations remain the dispatch targets. */
export async function registerSessionToolGovernance(options: {
  definitions: readonly ToolDefinition[];
  registry: CapabilityRegistry;
  mcp: (name: string) => Promise<McpToolIdentity | null>;
}) {
  if (sourceManifest.schemaVersion !== 1 || !sourceManifest.sources.length
      || createHash('sha256').update(JSON.stringify(sourceManifest.sources)).digest('hex') !== sourceManifest.sourceHash) throw Error('source_changed');
  const names = options.definitions.map(tool => tool.name);
  if (new Set(names).size !== names.length) throw Error('tool_manifest_conflict');
  const records = new Map<string, ToolGovernanceRecord>();
  for (const tool of options.definitions) {
    const source = CORE_TOOL_NAMES.includes(tool.name) ? null : await options.mcp(tool.name);
    if (!source) policy(tool.name);
    const manifest = toolManifest(tool.name, source ? new Set([tool.name]) : undefined);
    const schemaHash = identityHash(tool.parameters);
    const sourceHash = source ? protocolHash({sourceHash: source.sourceHash, schemaHash: source.schemaHash}) : sourceManifest.sourceHash;
    const scopePolicy = source ? 'mcp_tool_request' : policy(tool.name);
    const providerHash = protocolHash({sourceHash, schemaHash, name: tool.name, manifest, scopePolicy});
    const key = source ? 't_' + identityHash([source.serverId, source.tool]).slice(0, 24) : tool.name;
    const record: ToolGovernanceRecord = {schemaVersion: 1, name: tool.name, parameters: tool.parameters, manifest, ...(source ? {source} : {}),
      capabilityId: source ? 'mcp.tool.' + key + '.invoke' : 'edu.core.tool.' + key,
      providerId: source ? 'mcp.tool.' + key : coreProviderId(key), providerVersion: '1.0.0+' + providerHash.slice(0, 16),
      providerHash, schemaHash, sourceHash, contractVersion: '1.0.0', effect: manifest.effect, scopePolicy,
      classification: source || privateTools.has(tool.name) ? 'teacher_private' : 'public'};
    const values = declaration(record);
    const prior = await options.registry.providerVersion(record.providerId, record.providerVersion, record.capabilityId);
    if (prior?.revoked) throw Error('capability_revoked');
    if (!prior) await options.registry.register(values.definition, values.provider, values.binding);
    records.set(tool.name, record);
  }
  if (records.size !== options.definitions.length) throw Error('tool_governance_missing');
  return records;
}

export function createRunToolGovernance(options: {owner: PermissionOwner; registry: CapabilityRegistry;
  records: ReadonlyMap<string, ToolGovernanceRecord>; current: () => boolean;
  task: (callId: string) => Promise<{planRevision: number; requirementsVersion: number; stepId: string | null; target: string | null}>;
  snapshot: (record: ToolGovernanceRecord) => Promise<ProviderSnapshot>;
  mcp: (name: string) => Promise<McpToolIdentity | null>;
  persist: (callId: string, name: string, receipt: ToolContractReceipt) => Promise<void>;
  preflight?: (callId: string, name: string, input: unknown, enforce: boolean) => Promise<unknown>;
  assertEffect?: (callId: string, name: string, receipt: ToolContractReceipt) => Promise<void>;
  beginEffect?: (callId: string, expected?: {tool: string; inputDigest: string}) => Promise<void>;
  bindExecution?: (callId: string, execution: {id: string}) => Promise<void>}) {
  const calls = new Map<string, ToolContractReceipt>();
  const snapshots = new Map<string, ProviderSnapshot>();
  const names = new Map<string, string>();
  const authorityWrites = new Map<string, Promise<void>>();
  // HTTP MCP authorizes inside the original adapter. Its outer invocation is
  // not a transport dispatch; only that adapter may cross this one-shot gate.
  const pendingMcp = new Map<string, {name: string; source: McpToolIdentity; state: 'waiting' | 'starting' | 'ready'}>();
  async function recordAuthority(callId: string, references: ToolContractReceipt['grantRefs'], reference?: string) {
    const previous = authorityWrites.get(callId) || Promise.resolve();
    const pending = previous.then(async () => {
      const receipt = calls.get(callId); if (!receipt) return;
      if (!options.current()) throw Error('permission_denied');
      const refs = new Map([...receipt.grantRefs, ...references].map(ref => [ref.grantId + ':' + ref.revision, ref]));
      const next = {...receipt, grantRefs: [...refs.values()], authorityRefs: [...new Set([...receipt.authorityRefs, ...(reference ? [reference] : [])])]};
      const name = names.get(callId); if (!name) throw Error('permission_denied');
      await options.persist(callId, name, next); calls.set(callId, next);
    });
    authorityWrites.set(callId, pending);
    try {await pending;} finally {if (authorityWrites.get(callId) === pending) authorityWrites.delete(callId);}
  }
  async function assert(name: string, signal: AbortSignal) {
    signal.throwIfAborted(); if (!options.current()) throw Error('permission_denied');
    const record = options.records.get(name); if (!record || record.schemaHash !== identityHash(record.parameters)) throw Error('source_changed');
    const current = await options.registry.snapshot();
    const provider = current.providers.find(row => row.id === record.providerId);
    const capability = current.definitions.find(row => row.id === record.capabilityId);
    const binding = current.bindings.find(row => row.providerId === record.providerId && row.capabilityId === record.capabilityId);
    const version = await options.registry.providerVersion(record.providerId, record.providerVersion, record.capabilityId);
    if (!provider || provider.health !== 'ready' || !capability || capability.lifecycle.status === 'revoked' || !binding?.enabled
        || !version || version.revoked || version.provider.source.packageHash !== record.providerHash) throw new TaskAdmissionError('capability_revoked');
    if (record.source && protocolHash(await options.mcp(name)) !== protocolHash(record.source)) throw new TaskAdmissionError('source_changed');
    signal.throwIfAborted(); if (!options.current()) throw Error('permission_denied');
    return record;
  }
  return {
    records: options.records,
    recordAuthority,
    async beginMcpCall(callId: string, source: McpToolIdentity, input: unknown, signal: AbortSignal) {
      const pending = pendingMcp.get(callId), receipt = calls.get(callId);
      if (!pending || pending.state !== 'waiting' || !receipt || source.transport !== 'http'
          || protocolHash(pending.source) !== protocolHash(source) || receipt.inputDigest !== identityHash(input)
          || !options.beginEffect) throw Error('permission_denied');
      pending.state = 'starting';
      await assert(pending.name, signal);
      const authority = currentPermission();
      if (!authority || authority.request.action !== 'mcp_call'
          || authority.request.callId !== callId || authority.request.inputDigest !== protocolHash(input)
          || authority.request.provider?.sourceHash !== source.sourceHash || authority.request.provider.schemaHash !== source.schemaHash
          || protocolHash(authority.request.owner) !== protocolHash(options.owner)) throw Error('permission_denied');
      await authority.assert();
      await options.beginEffect(callId, {tool: pending.name, inputDigest: receipt.inputDigest});
      await authority.assert();
      signal.throwIfAborted();
      // Starting is one-shot; ready additionally proves durable begin and the
      // post-COMMIT authority assertion both completed successfully.
      pending.state = 'ready';
    },
    async before(callId: string, name: string, input: unknown, signal: AbortSignal) {
      const record = await assert(name, signal); const task = await options.task(callId);
      await options.preflight?.(callId, name, input, false);
      const snapshot = await options.snapshot(record); snapshots.set(callId, snapshot);
      const receipt: ToolContractReceipt = {schemaVersion: 1, capabilityId: record.capabilityId, providerId: record.providerId,
        providerVersion: record.providerVersion, providerHash: record.providerHash, schemaHash: record.schemaHash, sourceHash: record.sourceHash,
        contractVersion: '1.0.0', snapshotId: snapshot.snapshotId, registryRevision: snapshot.registryRevision, taskId: options.owner.taskId, stepId: task.stepId,
        planRevision: task.planRevision, requirementsVersion: task.requirementsVersion, target: task.target,
        inputDigest: identityHash(input), effect: record.effect, scopePolicy: record.scopePolicy,
        classification: record.classification, grantRefs: [], authorityRefs: []};
      await options.assertEffect?.(callId, name, receipt);
      await options.persist(callId, name, receipt); calls.set(callId, receipt); names.set(callId, name);
    },
    async execute(callId: string, name: string, input: unknown, signal: AbortSignal, perform: (signal: AbortSignal) => Promise<Result>): Promise<Result> {
      const record = await assert(name, signal);
      await options.preflight?.(callId, name, input, true);
      const receipt = calls.get(callId); if (!receipt) throw Error('permission_denied');
      const authority = currentPermission();
      if (authority) await recordAuthority(callId, authority.decision.grantRefs, 'permission-request:' + authority.decision.requestDigest);
      const deferred = record.source?.transport === 'http';
      if (deferred) {
        if (pendingMcp.has(callId)) throw Error('permission_denied');
        pendingMcp.set(callId, {name, source: record.source!, state: 'waiting'});
      } else await options.beginEffect?.(callId);
      if (authority && options.bindExecution) authority.recordExecution = execution => options.bindExecution!(callId, execution);
      if (authority) authority.recordAuthority = (reference, refs) => recordAuthority(callId, refs, reference);
      let result: Result;
      try {
        result = await perform(signal);
        if (deferred && pendingMcp.get(callId)?.state !== 'ready' && result.isError !== true
            && !(result.details && typeof result.details === 'object' && (result.details as {success?: boolean}).success === false)) throw Error('invalid_output');
      } finally {if (deferred) pendingMcp.delete(callId);}
      if (!validBoundedToolResult(result)) throw Error('invalid_output');
      signal.throwIfAborted(); if (!options.current()) throw Error('permission_denied');
      if (authority?.execution) await options.bindExecution?.(callId, {id: authority.execution.id});
      return result;
    },
    decorate(callId: string, name: string, result: Result): Result {
      const receipt = calls.get(callId), snapshot = snapshots.get(callId);
      if (!receipt || !snapshot) return result;
      const details = result.details && typeof result.details === 'object' && !Array.isArray(result.details) ? result.details as Record<string, unknown> : {};
      const outputDigest = identityHash(result.content);
      const context = {taskId: options.owner.taskId, sessionId: options.owner.sessionId, runId: options.owner.runId,
        generation: options.owner.generation, stepId: receipt.stepId, callId, signal: new AbortController().signal, snapshot,
        grantRef: protocolHash(receipt.grantRefs), idempotencyKey: protocolHash([options.owner, callId, snapshot.snapshotId, receipt.inputDigest]),
        budget: {timeoutMs: snapshot.requirement.budget.latencyMs, resourceUnits: 1}};
      const failed = result.isError === true || details.success === false;
      const coreProvider = providerResult(context, failed ? undefined : {status: 'completed',
        data: {kind: 'native_tool_result', tool: name, callId, outputDigest, classification: receipt.classification},
        sideEffects: {status: receipt.effect === 'safe_read' ? 'none' : 'unknown', references: ['journal:' + options.owner.runId + ':' + callId]}},
      failed ? Error(typeof (details.error as {code?: unknown})?.code === 'string' ? String((details.error as {code: string}).code) : 'provider_unavailable') : undefined,
      data => !!data && typeof data === 'object' && (data as {kind?: unknown}).kind === 'native_tool_result'
        && /^[a-f0-9]{64}$/u.test(String((data as {outputDigest?: unknown}).outputDigest)));
      return {...result, details: {...details, coreProvider, governance: {...receipt, tool: name, callId, sessionId: options.owner.sessionId,
        runId: options.owner.runId, generation: options.owner.generation, outputDigest: identityHash(result.content),
        validator: 'original_domain_and_bounded_pi_result.v1'}}};
    },
  };
}
export type RunToolGovernance = ReturnType<typeof createRunToolGovernance>;
