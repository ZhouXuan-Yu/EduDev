/** Main-owned protocol metadata. Schema refs point to existing implementations. */
export const CAPABILITY_SCHEMA = 'xiaozhi.capability.v1' as const;
export type Requirement = {id: string; description: string};
export type ConditionalRequirement = Requirement & {condition: string};
export type CapabilityDefinition = {
  schema: typeof CAPABILITY_SCHEMA;
  id: string; name: string; description: string; domain: string; contractVersion: string;
  inputSchemaRef: string; outputSchemaRef: string;
  requirements: {required: Requirement[]; optional: Requirement[]; conditional: ConditionalRequirement[]};
  guarantees: string[]; limitations: string[]; errors: string[];
  constraints: {localPreferred: boolean; networkRequired: boolean; supportsCancellation: boolean; idempotency: 'idempotent'|'keyed'|'not_idempotent'|'unknown'};
  platforms: string[];
  lifecycle: {status: 'active'|'deprecated'|'revoked'};
};
export type Evidence = {requirementId: string; supported: boolean; kind: 'self_declared'|'adapter_detected'|'automated_test'|'human_review'; reference: string};
export type CapabilityConformance = {
  capabilityId: string; contractVersion: string; evidence: Evidence[]; limitations: string[];
  level: 'full'|'partial'|'incompatible'; verifiedAt: string;
};
export type ProviderManifest = {
  schema: typeof CAPABILITY_SCHEMA;
  id: string; type: 'native'|'skill'|'mcp'|'extension'|'remote'; version: string;
  publisher: {id: string; official: boolean};
  source: {reference: string; packageHash: string; verification: 'verified'|'unverified'|'failed'; evidenceRef: string};
  runtime: 'main_native'|'managed'|'isolated'|'remote';
  dependencies: {id: string; available: boolean}[];
  permissions: string[]; toolRefs: string[]; platforms: string[];
  locality: 'local'|'remote';
  health: 'ready'|'degraded'|'unavailable'|'disabled'|'revoked'|'pending_approval'|'blocked_dependency';
  cost: {latencyMs: number; resourceUnits: number};
};
export type CapabilityBinding = {
  capabilityId: string; providerId: string; contractVersion: string; adapterVersion: string;
  enabled: boolean; priority: number; userPinned: boolean; verifiedAt: string;
  providerVersion: string; providerHash: string; conformance: CapabilityConformance;
};
export type RegistrySnapshot = {revision: number; definitions: CapabilityDefinition[]; providers: ProviderManifest[]; bindings: CapabilityBinding[]};
export type CapabilityRequirement = {
  capabilityId: string; contractVersion: string; required: string[]; optional: string[];
  conditions: string[]; localOnly: boolean; platform: string;
  budget: {latencyMs: number; resourceUnits: number};
};
export type ProviderSelection = {providerId: string; providerVersion: string; contractVersion: string; level: 'full'|'partial'; missingRequirements: string[]; limitations: string[]};
export type ExclusionCode = 'capability_revoked'|'provider_revoked'|'disabled'|'contract_mismatch'|'source_unverified'|'platform_incompatible'|'permission_denied'|'missing_required'|'missing_conditional'|'data_residency'|'missing_dependency'|'unhealthy'|'budget_exceeded';
export type CapabilityResolution = {
  capabilityId: string;
  status: 'resolved'|'partial'|'missing'|'blocked_permission'|'blocked_dependency'|'no_compatible_provider';
  selectedProviders: ProviderSelection[]; alternatives: ProviderSelection[];
  acceptedLimitations: string[];
  excludedProviders: {providerId: string; reasons: ExclusionCode[]; missingRequirements: string[]}[];
  blockedReasons: string[]; registryRevision: number;
};
