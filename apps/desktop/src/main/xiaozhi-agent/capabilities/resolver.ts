import type { CapabilityRegistry } from './registry';
import type { CapabilityRequirement, CapabilityResolution, ProviderManifest, ProviderSelection, ExclusionCode, CapabilityDefinition, CapabilityBinding } from './types';
import { protocolHash, snapshotProtocolInput, validCapabilityRequirement, validCapabilityResolution } from './validation';
/** Main-only callback consults existing grants. No authorized flag exists in requests. */
export type CapabilityAuthorization = (provider: Readonly<ProviderManifest>, requirement: Readonly<CapabilityRequirement>) => Promise<boolean>;
export function assessConformance(definition: CapabilityDefinition, binding: CapabilityBinding, request: CapabilityRequirement) {
    const supported = new Set(binding.conformance.evidence.filter(item => item.supported && item.kind !== 'self_declared').map(item => item.requirementId));
    const required = [...new Set([...definition.requirements.required.map(item => item.id), ...request.required])];
    const triggered = definition.requirements.conditional.filter(item => request.conditions.includes(item.condition)).map(item => item.id);
    const missingRequired = required.filter(item => !supported.has(item));
    const missingConditional = triggered.filter(item => !supported.has(item));
    const optional = [...new Set([...definition.requirements.optional.map(item => item.id), ...request.optional, ...definition.requirements.conditional.filter(item => !request.conditions.includes(item.condition)).map(item => item.id)])];
    const missing = optional.filter(item => !supported.has(item));
    const limitations = [...new Set([...definition.limitations, ...binding.conformance.limitations, ...missing.map(item => 'missing:' + item)])];
    const level: 'full' | 'partial' = missing.length || limitations.length ? 'partial' : 'full';
    return {
        missingRequired,
        missingConditional,
        missing,
        limitations,
        level
    };
}
export function createCapabilityResolver(registry: CapabilityRegistry, authorize: CapabilityAuthorization, options: {
    verifySource?: (provider: Readonly<ProviderManifest>) => boolean;
} = {}) {
    async function resolve(raw: CapabilityRequirement, pinned?: {
        providerId: string;
        version: string;
        hash: string;
    }): Promise<CapabilityResolution> {
        const request = snapshotProtocolInput(raw);
        if (!validCapabilityRequirement(request)) {
            throw Error('capability_invalid_requirement');
        }
        const snapshot = await registry.snapshot();
        const definition = snapshot.definitions.find(item => item.id === request.capabilityId);
        const result: CapabilityResolution = {
            capabilityId: request.capabilityId,
            status: 'missing',
            selectedProviders: [],
            alternatives: [],
            acceptedLimitations: [],
            excludedProviders: [],
            blockedReasons: [],
            registryRevision: snapshot.revision
        };
        if (!definition) {
            result.blockedReasons.push('capability_missing');
            return result;
        }
        let pinnedState: string | undefined;
        if (pinned) {
            const current = snapshot.providers.find(item => item.id === pinned.providerId);
            const currentBinding = snapshot.bindings.find(item => item.providerId === pinned.providerId && item.capabilityId === request.capabilityId);
            const version = await registry.providerVersion(pinned.providerId, pinned.version, request.capabilityId);
            if (!current || !currentBinding || !version || version.provider.source.packageHash !== pinned.hash) {
                result.status = 'no_compatible_provider';
                result.blockedReasons = ['provider_version_missing'];
                return result;
            }
            snapshot.providers = [{
                    ...version.provider,
                    health: current.health
                }];
            snapshot.bindings = [{
                    ...version.binding,
                    enabled: currentBinding.enabled
                }];
            pinnedState = protocolHash({definition,provider:snapshot.providers[0],binding:snapshot.bindings[0],revoked:version.revoked});
        }
        const eligible: {
            selection: ProviderSelection;
            pinned: boolean;
            priority: number;
        }[] = [];
        for (const binding of snapshot.bindings.filter(item => item.capabilityId === request.capabilityId)) {
            const provider = snapshot.providers.find(item => item.id === binding.providerId)!;
            const reasons: ExclusionCode[] = [];
            if (definition.lifecycle.status === 'revoked') {
                reasons.push('capability_revoked');
            }
            if (provider.health === 'revoked') {
                reasons.push('provider_revoked');
            }
            const version = await registry.providerVersion(provider.id, provider.version, request.capabilityId);
            if (!version || version.revoked) {
                reasons.push('provider_revoked');
            }
            if (!binding.enabled || provider.health === 'disabled') {
                reasons.push('disabled');
            }
            if (request.contractVersion !== definition.contractVersion || binding.contractVersion !== request.contractVersion || binding.conformance.contractVersion !== request.contractVersion) {
                reasons.push('contract_mismatch');
            }
            if (provider.source.verification !== 'verified' || provider.source.packageHash !== binding.providerHash || provider.version !== binding.providerVersion || options.verifySource && !options.verifySource(provider)) {
                reasons.push('source_unverified');
            }
            if (!provider.platforms.includes(request.platform) || !definition.platforms.includes(request.platform)) {
                reasons.push('platform_incompatible');
            }
            if (request.localOnly && provider.locality !== 'local') {
                reasons.push('data_residency');
            }
            if (provider.dependencies.some(item => !item.available) || provider.health === 'blocked_dependency') {
                reasons.push('missing_dependency');
            }
            if (provider.health !== 'ready') {
                reasons.push('unhealthy');
            }
            if (provider.cost.latencyMs > request.budget.latencyMs || provider.cost.resourceUnits > request.budget.resourceUnits) {
                reasons.push('budget_exceeded');
            }
            const { missingRequired, missingConditional, missing, limitations, level } = assessConformance(definition, binding, request);
            if (missingRequired.length) {
                reasons.push('missing_required');
            }
            if (missingConditional.length) {
                reasons.push('missing_conditional');
            }
            // A rejection or unavailable authority fails closed before ranking.
            let allowed = false;
            try {
                allowed = (await authorize(structuredClone(provider), structuredClone(request))) === true;
            }
            catch {
                allowed = false;
            }
            if (!allowed) {
                reasons.push('permission_denied');
            }
            if (reasons.length) {
                result.excludedProviders.push({
                    providerId: provider.id,
                    reasons,
                    missingRequirements: [...new Set([...missingRequired, ...missingConditional])]
                });
                continue;
            }
            eligible.push({
                selection: {
                    providerId: provider.id,
                    providerVersion: provider.version,
                    contractVersion: binding.contractVersion,
                    level,
                    missingRequirements: missing,
                    limitations
                },
                pinned: binding.userPinned,
                priority: binding.priority
            });
        }
        // Stable declared preferences within the hard-qualified set, no speculative scores.
        eligible.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.priority - a.priority || a.selection.providerId.localeCompare(b.selection.providerId, 'en'));
        if (eligible.length) {
            result.selectedProviders = [eligible[0].selection];
            result.alternatives = eligible.slice(1).map(item => item.selection);
            result.acceptedLimitations = eligible[0].selection.limitations;
            result.status = eligible[0].selection.level === 'partial' ? 'partial' : 'resolved';
        }
        else {
            const reasons = [...new Set(result.excludedProviders.flatMap(item => item.reasons))];
            result.blockedReasons = reasons.length ? reasons : ['provider_missing'];
            result.status = reasons.includes('permission_denied') ? 'blocked_permission' : reasons.includes('missing_dependency') ? 'blocked_dependency' : 'no_compatible_provider';
        }
        const latest = await registry.snapshot();
        if (latest.revision !== snapshot.revision) {
            if (!pinned) {
                throw Error('capability_registry_changed');
            }
            const provider = latest.providers.find(item => item.id === pinned.providerId);
            const binding = latest.bindings.find(item => item.providerId === pinned.providerId && item.capabilityId === request.capabilityId);
            const definition = latest.definitions.find(item => item.id === request.capabilityId);
            const version = await registry.providerVersion(pinned.providerId,pinned.version,request.capabilityId);
            if (!provider || !binding || !definition || !version) {
                throw Error('capability_registry_changed');
            }
            const currentState = protocolHash({
                definition,
                provider:{...version.provider,health:provider.health},
                binding:{...version.binding,enabled:binding.enabled},
                revoked:version.revoked,
            });
            // A fixed executable survives unrelated catalog revisions and normal
            // upgrades. Changes to its actual safety/conformance state fail closed.
            if (currentState !== pinnedState) {
                throw Error('capability_registry_changed');
            }
        }
        if (!validCapabilityResolution(result)) {
            throw Error('capability_invalid_resolution');
        }
        return result;
    }
    return {
        resolve: (raw: CapabilityRequirement) => resolve(raw),
        resolveVersion: (raw: CapabilityRequirement, providerId: string, version: string, hash: string) => resolve(raw, {
            providerId,
            version,
            hash
        })
    };
}
/** AI may choose only a previously eligible ID, with the same disclosed gaps. */
export function selectEligibleProvider(resolution: CapabilityResolution, providerId: string): ProviderSelection {
    if (!validCapabilityResolution(resolution)) {
        throw Error('capability_invalid_resolution');
    }
    const selection = [...resolution.selectedProviders, ...resolution.alternatives].find(item => item.providerId === providerId);
    if (!selection) {
        throw Error('capability_selection_ineligible');
    }
    return structuredClone(selection);
}
