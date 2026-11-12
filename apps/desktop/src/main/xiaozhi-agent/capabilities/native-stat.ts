import {randomUUID} from 'node:crypto';
import {createHanaOfficeTools} from '../../office-agent/hana-tool-adapter';
import {createWorkspaceFiles, fileVersion, validFileRequest, type WorkspaceLease} from '../workspace-files';
import {XIAOZHI_FILES_SCHEMA} from '../../../shared/xiaozhi-files';
import {CAPABILITY_SCHEMA, type CapabilityBinding, type CapabilityDefinition, type ProviderManifest} from './types';
import {protocolHash, snapshotProtocolInput, validCapabilityRequirement} from './validation';
import type {CapabilityRegistry} from './registry';
import {createCapabilityResolver, selectEligibleProvider} from './resolver';
import type {CapabilityRequirement} from './types';

export const NATIVE_STAT_PROVIDER_IDS = ['edu.native.hana-file-stat','edu.native.workspace-file-stat'] as const;
export const NATIVE_STAT_CAPABILITY: CapabilityDefinition = {
  schema: CAPABILITY_SCHEMA, id: 'edu.workspace.file.stat', name: '本地文件元信息', description: '读取当前授权工作区的文件路径、大小和版本', domain: 'workspace', contractVersion: '1.0.0',
  inputSchemaRef: 'native-stat.ts#validStatInput', outputSchemaRef: 'native-stat.ts#validStatOutput',
  requirements: {
    required: [{id: 'file_metadata',description: '提供真实文件相对路径、大小和版本'}],
    optional: [{id: 'mime',description: '提供文件 MIME 类型'}],
    conditional: [{id: 'mime_required',description: '任务明确要求 MIME 时提供类型',condition: 'require_mime'}],
  },
  guarantees: ['main_workspace_authority','readonly','file_version'], limitations: [],
  errors: ['invalid_input','permission_denied','provider_unavailable','capability_revoked','cancelled','changed','not_found','invalid_output'],
  constraints: {localPreferred: true,networkRequired: false,supportsCancellation: true,idempotency: 'idempotent'},
  platforms: ['win32','darwin','linux'], lifecycle: {status: 'active'},
};
export type NativeStatInput = {path: string};
export type NativeStatOutput = {path: string; size: number; version: string; mime?: string};
export function validStatInput(value: unknown): value is NativeStatInput {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !Object.prototype.hasOwnProperty.call(value,'path')) return false;
  return validFileRequest({schemaVersion: XIAOZHI_FILES_SCHEMA,sessionId: 'aisession_00000000-0000-0000-0000-000000000000',requestId: 'xifile_00000000-0000-0000-0000-000000000000',path: (value as NativeStatInput).path}) && (value as NativeStatInput).path !== '.';
}
export function validStatOutput(value: unknown): value is NativeStatOutput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const output = value as NativeStatOutput;
  return Object.keys(value).every(key => ['path','size','version','mime'].includes(key)) && validStatInput({path: output.path})
    && Number.isSafeInteger(output.size) && output.size >= 0 && typeof output.version === 'string' && /^[a-f0-9]{64}$/u.test(output.version)
    && (output.mime === undefined || typeof output.mime === 'string' && output.mime.length > 0 && output.mime.length <= 128);
}
/** Hash the trusted executable adapters, referencing existing schemas and business IO. */
export function nativeStatDeclarations() {
  return NATIVE_STAT_PROVIDER_IDS.map((id,index) => {
    const hana = index === 0;
    const reference = hana ? 'office-agent/hana-tool-adapter.ts#office_file_stat' : 'xiaozhi-agent/workspace-files.ts#stat';
    const provider: ProviderManifest = {
      schema: CAPABILITY_SCHEMA,id,type: 'native',version: '1.0.0',publisher: {id: 'edudev',official: true},
      source: {reference,packageHash: protocolHash({adapter: hana ? createHanaOfficeTools.toString() : createWorkspaceFiles.toString(),normalize: validStatOutput.toString(),version: '1.0.0'}),verification: 'verified',evidenceRef: reference},
      runtime: 'main_native',dependencies: [],permissions: ['workspace.file.metadata'],toolRefs: [reference],platforms: ['win32','darwin','linux'],locality: 'local',health: 'ready',cost: {latencyMs: 30000,resourceUnits: 1},
    };
    const binding: CapabilityBinding = {
      capabilityId: NATIVE_STAT_CAPABILITY.id,providerId: id,contractVersion: '1.0.0',adapterVersion: '1.0.0',enabled: true,priority: hana ? 0 : 1,userPinned: false,
      // This timestamp describes the packaged contract, keeping startup idempotent.
      verifiedAt: '2026-11-12T00:00:00.000Z',providerVersion: provider.version,providerHash: provider.source.packageHash,
      conformance: {capabilityId: NATIVE_STAT_CAPABILITY.id,contractVersion: '1.0.0',verifiedAt: '2026-11-12T00:00:00.000Z',level: hana ? 'full' : 'partial',limitations: [],
        evidence: ['file_metadata',...(hana ? ['mime','mime_required'] : [])].map(requirementId => ({requirementId,supported: true,kind: 'adapter_detected' as const,reference}))},
    };
    return {definition: structuredClone(NATIVE_STAT_CAPABILITY),provider,binding};
  });
}
export async function registerNativeStatProviders(registry: CapabilityRegistry) {
  for (const declaration of nativeStatDeclarations()) {
    const current = await registry.snapshot();
    const previous = current.providers.find(item => item.id === declaration.provider.id);
    const definition = current.definitions.find(item => item.id === declaration.definition.id);
    if (previous?.health === 'revoked' || definition?.lifecycle.status === 'revoked') continue;
    if (previous) {
      if (protocolHash(previous.source) === protocolHash(declaration.provider.source) && previous.version === declaration.provider.version) continue;
      const binding = current.bindings.find(item => item.providerId === previous.id && item.capabilityId === declaration.definition.id);
      if (!binding) throw Error('capability_registry_corrupt');
      // A reviewed built-in package update rebinds its digest. Local preferences and
      // disabled/unhealthy states survive. Revoked packages are handled above.
      declaration.provider.health = previous.health;
      declaration.binding.enabled = binding.enabled;
      declaration.binding.userPinned = binding.userPinned;
      declaration.binding.priority = binding.priority;
    }
    await registry.register(declaration.definition,declaration.provider,declaration.binding);
  }
}
export type NativeStatResult = {
  executionId: string; capabilityId: string; providerId: string;
  status: 'completed'|'partial'|'failed'|'cancelled'; data?: NativeStatOutput;
  artifacts: string[]; conformance: {level: 'full'|'partial'; missingRequirements: string[]};
  sideEffects: {status: 'none'; references: string[]};
  error?: {code: string; message: string; retryable: boolean};
  provenance: {providerVersion: string; contractVersion: string; registryRevision: number};
};
/** Main-only pilot. No renderer IPC, model tool or additional dispatch loop. */
export function createNativeStatService(options: {
  registry: CapabilityRegistry;
  resolveWorkspace: (sessionId: string) => Promise<WorkspaceLease>;
  isCurrent: (sessionId: string,runId: string) => boolean;
}) {
  const trustedProviders = nativeStatDeclarations().map(item => item.provider);
  const resolver = (sessionId: string) => createCapabilityResolver(options.registry,async provider => {
    if (!NATIVE_STAT_PROVIDER_IDS.includes(provider.id as typeof NATIVE_STAT_PROVIDER_IDS[number]) || provider.permissions.some(permission => permission !== 'workspace.file.metadata')) return false;
    await options.resolveWorkspace(sessionId);
    return true;
  }, {verifySource: provider => {
    const trusted = trustedProviders.find(item => item.id === provider.id);
    return !!trusted && provider.type === trusted.type && provider.runtime === trusted.runtime
      && provider.version === trusted.version && protocolHash(provider.source) === protocolHash(trusted.source)
      && protocolHash(provider.publisher) === protocolHash(trusted.publisher) && protocolHash(provider.toolRefs) === protocolHash(trusted.toolRefs);
  }});
  return {
    register: () => registerNativeStatProviders(options.registry),
    resolve: (sessionId: string,requirement: CapabilityRequirement) => resolver(sessionId).resolve(requirement),
    async execute(context: {sessionId: string; runId: string; callId: string; signal: AbortSignal}, providerId: string, requirement: CapabilityRequirement, raw: unknown): Promise<NativeStatResult> {
      const result: NativeStatResult = {executionId: context.callId,capabilityId: NATIVE_STAT_CAPABILITY.id,providerId,status: 'failed',artifacts: [],conformance: {level: 'partial',missingRequirements: []},sideEffects: {status: 'none',references: []},provenance: {providerVersion: '1.0.0',contractVersion: '1.0.0',registryRevision: 0}};
      try {
        const input = snapshotProtocolInput(raw);
        const request = snapshotProtocolInput(requirement);
        if (!validCapabilityRequirement(request)) throw Error('invalid_input');
        const current = () => { context.signal.throwIfAborted(); if (!options.isCurrent(context.sessionId,context.runId)) throw Error('permission_denied'); };
        current();
        if (!validStatInput(input) || !context.callId || context.callId.length > 128 || request.capabilityId !== NATIVE_STAT_CAPABILITY.id) throw Error('invalid_input');
        const resolution = await resolver(context.sessionId).resolve(request);
        const selected = selectEligibleProvider(resolution,providerId);
        result.provenance = {providerVersion: selected.providerVersion,contractVersion: selected.contractVersion,registryRevision: resolution.registryRevision};
        result.conformance = {level: selected.level,missingRequirements: selected.missingRequirements};
        const lease = await options.resolveWorkspace(context.sessionId);
        current();
        let data: NativeStatOutput;
        if (providerId === NATIVE_STAT_PROVIDER_IDS[0]) {
          const tools = createHanaOfficeTools({workspace: lease.path,sessionId: context.sessionId,runId: context.runId,networkAllowed: false,fileVersion});
          const rawResult = await tools.execute('office_file_stat',context.callId,input,context.signal);
          if (!rawResult.success) throw Error(rawResult.error?.code || 'provider_unavailable');
          const output = rawResult.data;
          if (!output) throw Error('invalid_output');
          if (output.isDirectory) throw Error('invalid_input');
          data = {path: String(output.source).split('\\').join('/'),size: output.size as number,version: output.version as string,...(typeof output.mime === 'string' ? {mime: output.mime} : {})};
        } else {
          const files = createWorkspaceFiles(options.resolveWorkspace);
          const output = await files.stat({schemaVersion: XIAOZHI_FILES_SCHEMA,sessionId: context.sessionId,requestId: 'xifile_' + randomUUID(),path: input.path},context.signal);
          if (!output.ok) throw Error(output.error);
          data = {path: output.data.path,size: output.data.size,version: output.data.version};
        }
        current();
        if ((await options.resolveWorkspace(context.sessionId)).version !== lease.version) throw Error('changed');
        // Current registry and main grant override any old selection or snapshot.
        const latest = await resolver(context.sessionId).resolve(request);
        selectEligibleProvider(latest,providerId);
        if (latest.registryRevision !== resolution.registryRevision) throw Error('changed');
        current();
        if (!validStatOutput(data) || request.conditions.includes('require_mime') && !data.mime) throw Error('invalid_output');
        result.data = data;
        result.status = selected.level === 'partial' ? 'partial' : 'completed';
      } catch (error) {
        const message = (error as Error).message;
        const code = context.signal.aborted ? 'cancelled' : message === 'capability_selection_ineligible' ? 'provider_unavailable' : message === 'capability_invalid_input' ? 'invalid_input' : message;
        result.status = code === 'cancelled' ? 'cancelled' : 'failed';
        const allowed = ['invalid_input','permission_denied','provider_unavailable','capability_revoked','cancelled','changed','not_found','invalid_output','unsupported','capability_registry_changed','capability_invalid_requirement'];
        const safe = allowed.includes(code) ? code : 'provider_unavailable';
        result.error = {code: safe,message: safe,retryable: ['changed','capability_registry_changed'].includes(safe)};
      }
      return result;
    },
  };
}
