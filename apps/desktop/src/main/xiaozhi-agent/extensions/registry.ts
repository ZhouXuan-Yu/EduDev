import {CAPABILITY_SCHEMA, type CapabilityDefinition, type ProviderManifest, type CapabilityBinding} from '../capabilities/types';
import type {CapabilityRegistry} from '../capabilities/registry';
import {protocolHash} from '../capabilities/validation';
import type {ExtensionManifest, ExtensionHook} from './types';

export const extensionCapabilityId = (hook: ExtensionHook) => 'edu.extension.' + hook;
export const extensionProviderId = (manifest: ExtensionManifest) => 'extension.local.' + manifest.extensionId + '.v_' + manifest.artifactId.slice(0, 16);
export function extensionDeclaration(manifest: ExtensionManifest, hook: ExtensionHook, verifiedAt: string) {
  const capabilityId = extensionCapabilityId(hook);
  const evidence = 'extension-health:' + manifest.artifactId + ':' + protocolHash(manifest.hooks);
  const definition: CapabilityDefinition = {schema: CAPABILITY_SCHEMA, id: capabilityId, name: hook, description: '对教师明确公开的有界上下文或事件执行隔离扩展钩子。',
    domain: 'extensions', contractVersion: '1.0.0', inputSchemaRef: 'edudev:extension.' + hook + '.input.v1',
    outputSchemaRef: 'edudev:extension.' + hook + '.output.v1', requirements: {required: [{id: 'invoke', description: '执行已验证钩子'}], optional: [], conditional: []},
    guarantees: ['isolated_process', 'current_scope', 'bounded_json', 'untrusted_result'], limitations: ['public_context_only', 'host_io_unsupported'],
    errors: ['permission_denied', 'source_changed', 'cancelled', 'invalid_output'],
    constraints: {localPreferred: true, networkRequired: false, supportsCancellation: true, idempotency: 'unknown'}, platforms: ['win32'], lifecycle: {status: 'active'}};
  const provider: ProviderManifest = {schema: CAPABILITY_SCHEMA, id: extensionProviderId(manifest), type: 'extension',
    version: manifest.version + '+' + manifest.artifactId.slice(0, 12), publisher: {id: 'local-import', official: false},
    source: {reference: manifest.source, packageHash: manifest.artifactId, verification: 'verified', evidenceRef: evidence},
    runtime: 'isolated', dependencies: [{id: 'node@24.12.0', available: true}], permissions: ['extension.run', 'process.appcontainer', 'dependency.artifact'],
    toolRefs: ['extension_invoke'], platforms: ['win32'], locality: 'local', health: 'ready', cost: {latencyMs: 10000, resourceUnits: 1}};
  const binding: CapabilityBinding = {capabilityId, providerId: provider.id, contractVersion: '1.0.0', adapterVersion: '1.0.0', enabled: true,
    priority: 0, userPinned: true, verifiedAt, providerVersion: provider.version, providerHash: manifest.artifactId,
    conformance: {capabilityId, contractVersion: '1.0.0', level: 'partial', limitations: definition.limitations, verifiedAt,
      evidence: [{requirementId: 'invoke', supported: true, kind: 'automated_test', reference: evidence}]}};
  return {definition, provider, binding};
}
export async function registerExtension(registry: CapabilityRegistry, manifest: ExtensionManifest, healthAt: string) {
  for (const hook of manifest.hooks) {
    const next = extensionDeclaration(manifest, hook, healthAt);
    const catalog = await registry.snapshot();
    const current = await registry.providerVersion(next.provider.id, next.provider.version, next.definition.id);
    if (!current) await registry.register(next.definition, next.provider, next.binding, catalog.revision);
    else if (current.revoked) throw Error('capability_revoked');
  }
}
