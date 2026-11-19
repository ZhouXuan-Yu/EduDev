import fs from 'node:fs/promises';
import path from 'node:path';
import {CAPABILITY_SCHEMA, type CapabilityDefinition, type CapabilityRequirement, type ProviderManifest, type CapabilityBinding} from '../types';
import type {CapabilityRegistry} from '../registry';
import {createCapabilityResolver} from '../resolver';
import type {CapabilityAdapterRuntime} from '../runtime';
import {providerResult, type ProviderExecutionContext} from '../provider-contract';
import {protocolHash} from '../validation';
import type {createMcpRuntime} from '../../mcp-runtime';
import {mcpToolName} from '../../mcp-runtime';
import type {createControlledMcpService} from '../../mcp-controlled-service';
import {createMcpPermissionContext} from '../../permissions/mcp';
import type {PermissionService} from '../../permissions/service';
import type {PermissionStore} from '../../permissions/store';
import type {PermissionRequest, PermissionScope} from '../../../../shared/xiaozhi-permissions';
import {filesystemScope, checkedFile} from '../../permissions/resources';
import {fileVersion} from '../../workspace-files';
import {hashCapabilityFile} from './file-hash';
import {FILESYSTEM_RECIPE} from './recipes';
import type {AcquisitionArtifact, AcquisitionState} from './state';
import type {AcquisitionContext} from './service';

export const MANAGED_READ_CAPABILITY: CapabilityDefinition = {
  schema: CAPABILITY_SCHEMA, id: 'edu.workspace.file.read-text', name: '读取授权资料正文', description: '在当前授权工作目录读取UTF-8文本，保留来源版本与隐私分类。',
  domain: 'workspace', contractVersion: '1.0.0', inputSchemaRef: 'edudev:workspace.read-text.input.v1', outputSchemaRef: 'edudev:workspace.read-text.output.v1',
  requirements: {required: [{id: 'read_text', description: '读取有界文本正文与来源'}], optional: [], conditional: []},
  guarantees: ['current_scope', 'source_version', 'bounded_text', 'private_provenance'], limitations: [],
  errors: ['permission_denied', 'source_changed', 'not_found', 'invalid_input'],
  constraints: {localPreferred: true, networkRequired: false, supportsCancellation: true, idempotency: 'idempotent'},
  platforms: ['win32'], lifecycle: {status: 'active'},
};
export const managedMcpProviderId = (artifact: AcquisitionArtifact) => 'mcp.managed.filesystem.v_' + artifact.id.slice(-24);
function declaration(artifact: AcquisitionArtifact, evidence: string) {
  const hash = protocolHash(artifact.binding.files);
  const version = artifact.version + '+' + hash.slice(0, 12);
  const provider: ProviderManifest = {schema: CAPABILITY_SCHEMA, id: managedMcpProviderId(artifact), type: 'mcp', version,
    publisher: {id: 'modelcontextprotocol', official: false}, source: {reference: 'https://registry.npmjs.org/' + FILESYSTEM_RECIPE.name,
      packageHash: hash, verification: 'verified', evidenceRef: evidence}, runtime: 'isolated',
    dependencies: [{id: 'node@24.12.0', available: true}], permissions: ['workspace.file.read', 'process.appcontainer', 'mcp.tool.call'],
    toolRefs: ['mcp:' + artifact.serverId + ':read_text_file'], platforms: ['win32'], locality: 'local', health: 'ready', cost: {latencyMs: 30000, resourceUnits: 1}};
  const now = new Date().toISOString();
  const binding: CapabilityBinding = {capabilityId: MANAGED_READ_CAPABILITY.id, providerId: provider.id, contractVersion: '1.0.0', adapterVersion: '1.0.0',
    enabled: true, priority: 1, userPinned: false, verifiedAt: now, providerVersion: provider.version, providerHash: hash,
    conformance: {capabilityId: MANAGED_READ_CAPABILITY.id, contractVersion: '1.0.0', level: 'full', limitations: [], verifiedAt: now,
      evidence: [{requirementId: 'read_text', supported: true, kind: 'automated_test', reference: evidence}]}};
  return {provider, binding};
}

type Options = {mcp: ReturnType<typeof createMcpRuntime>; controlled: ReturnType<typeof createControlledMcpService>;
  registry: CapabilityRegistry; permissions: PermissionService; store: PermissionStore; state: AcquisitionState; context: AcquisitionContext;
  probe?: (result: unknown) => void};
function owned(options: Options) {
  return options.controlled.forOwner({owner: () => {if (options.context.signal.aborted) throw Error('cancelled'); return options.context.owner;},
    recordAuthority: options.context.recordAuthority, acquisitionCall: options.context.acquisitionCall, recordPendingApproval: options.context.recordPendingApproval,
    signal: options.context.signal, workspace: options.context.workspace, requirementsVersion: () => options.context.requirementsVersion});
}
function permission(options: Options, stdio: ReturnType<typeof owned>) {
  return createMcpPermissionContext({permissions: options.permissions, store: options.store, owner: () => options.context.owner,
    authority: (callId, decision) => options.context.recordAuthority?.('permission-request:' + decision.requestDigest, decision.grantRefs, callId) || Promise.resolve(),
    requirementsVersion: () => options.context.requirementsVersion, stdio});
}

export async function registerManagedMcpArtifact(options: Options, artifact: AcquisitionArtifact) {
  if (!await options.context.current()) throw Error('permission_denied');
  const stdio = owned(options);
  let catalog = await options.mcp.catalog();
  let server = catalog.servers.find(row => row.endpoint === 'managed:' + artifact.id);
  if (!server) {
    catalog = await options.mcp.add({name: '资料只读-' + artifact.id.slice(-16), transport: 'stdio', command: 'managed:' + artifact.id});
    server = catalog.servers.find(row => row.endpoint === 'managed:' + artifact.id);
  }
  if (!server) throw Error('configuration');
  if (server.status !== 'ready' || !server.trustedSchemaHash || server.trustedSchemaHash !== server.schemaHash) {
    catalog = await options.mcp.inspect({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: server.id}, stdio.transport);
    server = catalog.servers.find(row => row.id === server!.id)!;
    if (server.status !== 'ready' || !server.schemaHash) throw Error(server.lastError || 'schema_changed');
    if (FILESYSTEM_RECIPE.selectedTools.some(name => !server!.tools.some(tool => tool.name === name))) throw Error('schema_changed');
    catalog = await options.mcp.trust({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: server.id,
      schemaHash: server.schemaHash, tools: [...FILESYSTEM_RECIPE.selectedTools]});
    server = catalog.servers.find(row => row.id === server!.id)!;
  }
  // The existing permission engine authorizes the real function probe. The fixture
  // lives only in the owned projection and is never written into teacher files.
  const prepared = await options.mcp.tools(permission(options, {...stdio, transformInput: stdio.healthInput}), {preparationTimeoutMs: 30000});
  const healthCallId = 'acquisition_health_' + artifact.id.slice(-16);
  const recordPending = async () => {
    const approval = (await options.store.approvals(options.context.owner.sessionId)).find(row => row.state === 'pending'
      && protocolHash(row.request.owner) === protocolHash(options.context.owner) && row.request.action === 'mcp_call'
      && row.request.callId === healthCallId && row.request.scopes.some(scope => scope.kind === 'mcp' && scope.serverId === server!.id
        && scope.schemaHash === server!.schemaHash && scope.tools.length === 1 && scope.tools[0] === 'read_text_file'));
    if (approval) await options.context.recordPendingApproval?.(approval.request);
  };
  const read = prepared.definitions.find(tool => tool.name === mcpToolName(server!.id, 'read_text_file'));
  try {
    if (!read) {
      const approval = (await options.store.approvals(options.context.owner.sessionId)).find(row => row.state === 'pending');
      throw Error(approval ? 'permission_pending' : 'provider_unavailable');
    }
    // Domain health is supplied by the main-owned canary adapter below.
    const result = await read.execute(healthCallId, {path: '__edudev_health__'}, options.context.signal, undefined, undefined as never);
    options.probe?.(result);
    await options.store.audit(options.context.owner.sessionId, 'capability_function_probe', artifact.id,
      {owner: options.context.owner, ...(options.context.acquisitionCall ? {acquisitionCall: options.context.acquisitionCall} : {}), failed: result.isError === true, code: (result.details as {error?: {code?: unknown}})?.error?.code || null,
        healthMarker: JSON.stringify(result.content).includes('EDUDEV_CAPABILITY_HEALTH_V1'),
        diagnostics: ['permission_pending', 'permission_denied', 'EACCES', 'ENOENT', 'outside', 'denied', 'invalid', 'not found', 'network', 'timeout']
          .filter(code => JSON.stringify(result.content).includes(code))});
    if (result.isError || !JSON.stringify(result.content).includes('EDUDEV_CAPABILITY_HEALTH_V1')) {
      if (JSON.stringify(result).includes('permission_pending')) {await recordPending(); throw Error('permission_pending');}
      throw Error('invalid_output');
    }
  } finally {await prepared.dispose();}
  const evidence = 'mcp-function:' + server.id + ':' + server.schemaHash;
  const next = declaration({...artifact, serverId: server.id}, evidence);
  const snapshot = await options.registry.snapshot();
  const prior = snapshot.providers.find(row => row.id === next.provider.id);
  if (!prior || prior.version !== next.provider.version || prior.health !== 'ready') await options.registry.register(MANAGED_READ_CAPABILITY, next.provider, next.binding, snapshot.revision);
  return {serverId: server.id, schemaHash: server.schemaHash!, evidence: [evidence]};
}

function readData(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).sort().join(',') === 'classification,sha256,source,text,version'
    && row.classification === 'teacher_private' && typeof row.source === 'string' && typeof row.text === 'string'
    && row.text.length <= 8000 && /^[a-f0-9]{64}$/u.test(String(row.version)) && /^[a-f0-9]{64}$/u.test(String(row.sha256));
}

export function createManagedMcpProviderRuntime(options: Options): CapabilityAdapterRuntime & {dispose: () => Promise<void>} {
  const clients = new Map<string, Awaited<ReturnType<Options['mcp']['tools']>>>();
  const opened = new Map<string, Promise<Awaited<ReturnType<Options['mcp']['tools']>>>>();
  let disposed = false;
  const available = new Set<string>();
  let sharedStdio: ReturnType<typeof owned> | undefined;
  const ownerStdio = () => sharedStdio ||= owned(options);
  const key = (id: string, version: string, hash: string) => JSON.stringify([id, version, hash]);
  async function artifactFor(id: string, version: string, hash: string) {
    const artifact = (await options.state.artifacts()).find(row => managedMcpProviderId(row) === id);
    if (!artifact || artifact.status !== 'ready' || !(Date.parse(artifact.expiresAt) > Date.now())
        || protocolHash(artifact.binding.files) !== hash || declaration(artifact, '').provider.version !== version || !artifact.serverId) return null;
    const authority = await options.mcp.authority(artifact.serverId);
    if (!authority || authority.schemaHash !== artifact.schemaHash || authority.sourceHash !== artifact.sourceHash) return null;
    return artifact;
  }
  async function authorized(provider: Readonly<ProviderManifest>) {
    const artifact = await artifactFor(provider.id, provider.version, provider.source.packageHash);
    if (!artifact) return false;
    const source = await options.mcp.authority(artifact.serverId!);
    if (!source) return false;
    const stdio = ownerStdio();
    const scopes: PermissionScope[] = [...await stdio.scopes(source, 'read_text_file', {}), {kind: 'mcp', serverId: source.serverId,
      sourceHash: source.sourceHash, schemaHash: source.schemaHash, tools: ['read_text_file']}];
    const request: PermissionRequest = {schemaVersion: 2, owner: options.context.owner, requirementsVersion: options.context.requirementsVersion,
      callId: 'capability_resolve', action: 'capability_resolve', inputDigest: protocolHash({providerId: provider.id, version: provider.version}),
      purpose: '核对当前任务的已验证资料读取能力与授权', scopes, files: [], provider: null, classification: 'teacher_private',
      expiresAt: new Date(Date.now() + 60000).toISOString()};
    const allowed = (await options.permissions.engine.evaluate(request)).state === 'allow';
    if (allowed) available.add(key(provider.id, provider.version, provider.source.packageHash));
    return allowed;
  }
  const resolver = () => createCapabilityResolver(options.registry, authorized, {
    verifySource: provider => provider.type === 'mcp' && provider.runtime === 'isolated' && provider.publisher.official === false
      && provider.id.startsWith('mcp.managed.filesystem.')});
  async function tools(artifact: AcquisitionArtifact) {
    if (disposed) throw Error('cancelled');
    const previous = clients.get(artifact.id);
    if (previous) return previous;
    let pending = opened.get(artifact.id);
    if (!pending) {
      pending = options.mcp.tools(permission(options, ownerStdio().fork()), {preparationTimeoutMs: 30000});
      opened.set(artifact.id, pending);
    }
    const prepared = await pending;
    if (disposed) {await prepared.dispose(); throw Error('cancelled');}
    clients.set(artifact.id, prepared);
    return prepared;
  }
  return {
    supports: capabilityId => capabilityId === MANAGED_READ_CAPABILITY.id,
    resolve: (_sessionId: string, requirement: CapabilityRequirement) => resolver().resolve(requirement),
    resolveVersion: (_sessionId, requirement, id, version, hash) => resolver().resolveVersion(requirement, id, version, hash),
    hasExecutable: (id, version, hash) => available.has(key(id, version, hash)),
    async execute(context: ProviderExecutionContext, input: unknown) {
      if (disposed || !await options.context.current() || !input || typeof input !== 'object' || Array.isArray(input)
          || Object.keys(input).join(',') !== 'path' || typeof (input as {path?: unknown}).path !== 'string') throw Error('invalid_input');
      const artifact = await artifactFor(context.snapshot.selection.providerId, context.snapshot.selection.providerVersion, context.snapshot.providerHash);
      if (!artifact || !await authorized((await options.registry.providerVersion(context.snapshot.selection.providerId,
        context.snapshot.selection.providerVersion, MANAGED_READ_CAPABILITY.id))!.provider)) throw Error('permission_denied');
      const relative = path.relative(options.context.workspace, path.resolve(options.context.workspace, (input as {path: string}).path));
      const filename = checkedFile(filesystemScope(options.context.workspace, ['read']), path.resolve(options.context.workspace, relative), 'read');
      const before = await fs.lstat(filename);
      if (!before.isFile() || before.size > 32 * 1048576) throw Error('invalid_input');
      const prepared = await tools(artifact);
      const tool = prepared.definitions.find(row => row.name === mcpToolName(artifact.serverId!, 'read_text_file'));
      if (!tool) throw Error('permission_denied');
      const result = await tool.execute(context.callId, {path: relative}, context.signal, undefined, undefined as never);
      if (result.isError) throw Error('provider_unavailable');
      const text = result.content.filter(row => row.type === 'text').map(row => (row as {text: string}).text).join('\n');
      const after = await fs.lstat(filename);
      if (fileVersion(before) !== fileVersion(after)) throw Error('source_changed');
      return providerResult(context, {status: 'completed', data: {source: relative, text, version: fileVersion(after),
        sha256: await hashCapabilityFile(filename, context.signal), classification: 'teacher_private'},
      sideEffects: {status: 'none', references: []}}, undefined, readData);
    },
    async dispose() {
      disposed = true;
      await Promise.allSettled([...opened.values()].map(async pending => {await (await pending).dispose();}));
      opened.clear(); clients.clear();
    },
  };
}
