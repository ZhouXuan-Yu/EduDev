import {createHash} from 'node:crypto';
import {snapshotToolInvocationInput} from '../../ai-harness/vendor/openhanako-tool-input-snapshot';
import {CAPABILITY_SCHEMA, type CapabilityDefinition, type ProviderManifest, type CapabilityBinding, type CapabilityConformance, type CapabilityRequirement, type CapabilityResolution} from './types';

type ObjectValue = Record<string, unknown>;
const object = (v: unknown): v is ObjectValue => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const keys = (v: ObjectValue, names: string[]) => Object.keys(v).length === names.length && names.every(name => Object.prototype.hasOwnProperty.call(v, name));
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 512 && !/[\x00-\x1f]/u.test(v);
const id = (v: unknown): v is string => text(v) && /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/u.test(v);
const version = (v: unknown): v is string => typeof v === 'string' && /^\d+\.\d+\.\d+(?:\+[a-zA-Z0-9.-]+)?$/u.test(v);
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const timestamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/u.test(v) && Number.isFinite(Date.parse(v));
const list = <T>(v: unknown, check: (item: unknown) => item is T): v is T[] => Array.isArray(v) && v.length <= 128 && v.every(check);
const strings = (v: unknown): v is string[] => list(v, text) && new Set(v).size === v.length;
const choice = (v: unknown, values: string[]) => typeof v === 'string' && values.includes(v);
const providerNamespace = (type: unknown, name: string) => {
  const prefixes: Record<string,string> = {native:'edu.native.',skill:'skill.',mcp:'mcp.',extension:'extension.',remote:'remote.'};
  return typeof type === 'string' && !!prefixes[type] && name.startsWith(prefixes[type]);
};
const natural = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const requirement = (v: unknown): boolean => object(v) && keys(v, ['id','description']) && text(v.id) && text(v.description);
const condition = (v: unknown): boolean => object(v) && keys(v, ['id','description','condition']) && text(v.id) && text(v.description) && text(v.condition);
const requirements = (v: unknown): boolean => {
  if (!object(v) || !keys(v, ['required','optional','conditional']) || !Array.isArray(v.required) || !Array.isArray(v.optional) || !Array.isArray(v.conditional)) return false;
  const all = [...v.required, ...v.optional, ...v.conditional];
  return all.length <= 128 && v.required.every(requirement) && v.optional.every(requirement) && v.conditional.every(condition) && new Set(all.map(item => item.id)).size === all.length;
};
export function validCapabilityDefinition(v: unknown): v is CapabilityDefinition {
  if (!object(v) || !keys(v, ['schema','id','name','description','domain','contractVersion','inputSchemaRef','outputSchemaRef','requirements','guarantees','limitations','errors','constraints','platforms','lifecycle'])) return false;
  return v.schema === CAPABILITY_SCHEMA && id(v.id) && /^(edu|mcp|extension)\./u.test(v.id) && v.id.split('.').length >= (v.id.startsWith('edu.') ? 3 : 4)
    && [v.name,v.description,v.domain,v.inputSchemaRef,v.outputSchemaRef].every(text) && version(v.contractVersion)
    && requirements(v.requirements) && strings(v.guarantees) && strings(v.limitations) && strings(v.errors) && strings(v.platforms) && v.platforms.length > 0
    && object(v.constraints) && keys(v.constraints, ['localPreferred','networkRequired','supportsCancellation','idempotency'])
    && ['localPreferred','networkRequired','supportsCancellation'].every(key => typeof (v.constraints as ObjectValue)[key] === 'boolean')
    && choice(v.constraints.idempotency, ['idempotent','keyed','not_idempotent','unknown'])
    && object(v.lifecycle) && keys(v.lifecycle, ['status']) && choice(v.lifecycle.status, ['active','deprecated','revoked']);
}
export function validProviderManifest(v: unknown): v is ProviderManifest {
  if (!object(v) || !keys(v, ['schema','id','type','version','publisher','source','runtime','dependencies','permissions','toolRefs','platforms','locality','health','cost'])) return false;
  return v.schema === CAPABILITY_SCHEMA && id(v.id) && version(v.version) && choice(v.type, ['native','skill','mcp','extension','remote']) && providerNamespace(v.type,v.id)
    && object(v.publisher) && keys(v.publisher, ['id','official']) && text(v.publisher.id) && typeof v.publisher.official === 'boolean'
    && (!v.publisher.official || v.type === 'native' && v.publisher.id === 'edudev' && v.id.startsWith('edu.native.'))
    && (v.type !== 'native' || v.publisher.official)
    && object(v.source) && keys(v.source, ['reference','packageHash','verification','evidenceRef']) && text(v.source.reference) && digest(v.source.packageHash)
    && choice(v.source.verification, ['verified','unverified','failed']) && text(v.source.evidenceRef)
    && choice(v.runtime, ['main_native','managed','isolated','remote']) && (v.runtime !== 'main_native' || v.type === 'native')
    && list(v.dependencies, (item): item is ProviderManifest['dependencies'][number] => object(item) && keys(item, ['id','available']) && text(item.id) && typeof item.available === 'boolean')
    && strings(v.permissions) && strings(v.toolRefs) && v.toolRefs.length > 0 && strings(v.platforms) && v.platforms.length > 0
    && choice(v.locality, ['local','remote']) && choice(v.health, ['ready','degraded','unavailable','disabled','revoked','pending_approval','blocked_dependency'])
    && object(v.cost) && keys(v.cost, ['latencyMs','resourceUnits']) && natural(v.cost.latencyMs) && natural(v.cost.resourceUnits);
}
export function validCapabilityConformance(v: unknown): v is CapabilityConformance {
  return object(v) && keys(v, ['capabilityId','contractVersion','evidence','limitations','level','verifiedAt']) && id(v.capabilityId) && version(v.contractVersion)
    && list(v.evidence, (item): item is CapabilityConformance['evidence'][number] => object(item) && keys(item, ['requirementId','supported','kind','reference']) && text(item.requirementId) && typeof item.supported === 'boolean' && choice(item.kind, ['self_declared','adapter_detected','automated_test','human_review']) && text(item.reference))
    && new Set(v.evidence.map(item => item.requirementId)).size === v.evidence.length && strings(v.limitations) && choice(v.level, ['full','partial','incompatible']) && timestamp(v.verifiedAt);
}
export function validCapabilityBinding(v: unknown): v is CapabilityBinding {
  return object(v) && keys(v, ['capabilityId','providerId','contractVersion','adapterVersion','enabled','priority','userPinned','verifiedAt','providerVersion','providerHash','conformance'])
    && id(v.capabilityId) && id(v.providerId) && version(v.contractVersion) && version(v.adapterVersion) && typeof v.enabled === 'boolean' && natural(v.priority) && typeof v.userPinned === 'boolean'
    && timestamp(v.verifiedAt) && version(v.providerVersion) && digest(v.providerHash) && validCapabilityConformance(v.conformance)
    && v.conformance.capabilityId === v.capabilityId && v.conformance.contractVersion === v.contractVersion;
}
export function validCapabilityRequirement(v: unknown): v is CapabilityRequirement {
  return object(v) && keys(v, ['capabilityId','contractVersion','required','optional','conditions','localOnly','platform','budget']) && id(v.capabilityId) && version(v.contractVersion)
    && strings(v.required) && strings(v.optional) && strings(v.conditions) && typeof v.localOnly === 'boolean' && text(v.platform)
    && object(v.budget) && keys(v.budget, ['latencyMs','resourceUnits']) && natural(v.budget.latencyMs) && natural(v.budget.resourceUnits);
}
const selection = (v: unknown): boolean => object(v) && keys(v, ['providerId','providerVersion','contractVersion','level','missingRequirements','limitations']) && id(v.providerId) && version(v.providerVersion) && version(v.contractVersion) && choice(v.level, ['full','partial']) && strings(v.missingRequirements) && strings(v.limitations);
export function validCapabilityResolution(v: unknown): v is CapabilityResolution {
  const valid = object(v) && keys(v, ['capabilityId','status','selectedProviders','alternatives','acceptedLimitations','excludedProviders','blockedReasons','registryRevision']) && id(v.capabilityId)
    && choice(v.status, ['resolved','partial','missing','blocked_permission','blocked_dependency','no_compatible_provider'])
    && Array.isArray(v.selectedProviders) && v.selectedProviders.length <= 1 && v.selectedProviders.every(selection)
    && Array.isArray(v.alternatives) && v.alternatives.length <= 128 && v.alternatives.every(selection)
    && strings(v.acceptedLimitations) && strings(v.blockedReasons) && natural(v.registryRevision)
    && list(v.excludedProviders, (item): item is CapabilityResolution['excludedProviders'][number] => object(item) && keys(item, ['providerId','reasons','missingRequirements']) && id(item.providerId) && strings(item.reasons) && item.reasons.length > 0 && item.reasons.every(reason => ['capability_revoked','provider_revoked','disabled','contract_mismatch','source_unverified','platform_incompatible','permission_denied','missing_required','missing_conditional','data_residency','missing_dependency','unhealthy','budget_exceeded'].includes(reason)) && strings(item.missingRequirements));
  if (!valid) return false;
  const result = v as CapabilityResolution;
  const eligible = [...result.selectedProviders,...result.alternatives].map(item => item.providerId);
  const excluded = result.excludedProviders.map(item => item.providerId);
  if (new Set(eligible).size !== eligible.length || new Set(excluded).size !== excluded.length || eligible.some(providerId => excluded.includes(providerId))) return false;
  if (result.status === 'resolved') return result.selectedProviders.length === 1 && result.selectedProviders[0].level === 'full';
  if (result.status === 'partial') return result.selectedProviders.length === 1 && result.selectedProviders[0].level === 'partial';
  return result.selectedProviders.length === 0 && result.alternatives.length === 0 && result.blockedReasons.length > 0;
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (object(v)) return '{' + Object.keys(v).sort().map(key => JSON.stringify(key) + ':' + canonical(v[key])).join(',') + '}';
  return JSON.stringify(v);
}
/** Integrity digest detects persisted metadata changes, never substitutes source trust. */
export const protocolHash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export function snapshotProtocolInput(value: unknown): unknown {
  const snapshot = snapshotToolInvocationInput(value);
  if (!snapshot.ok) throw Error('capability_invalid_input');
  return snapshot.value;
}
