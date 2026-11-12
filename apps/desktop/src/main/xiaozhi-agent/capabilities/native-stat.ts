import { CAPABILITY_SCHEMA, type CapabilityBinding, type CapabilityRequirement, type ProviderManifest } from './types';
import { protocolHash, snapshotProtocolInput, validCapabilityRequirement } from './validation';
import type { CapabilityRegistry } from './registry';
import { createCapabilityResolver, selectEligibleProvider } from './resolver';
import { NATIVE_STAT_CAPABILITY, NATIVE_STAT_PROVIDER_IDS, validStatInput, validStatOutput, type NativeStatOutput } from './native-stat-contract';
import { loadNativeStatExecutable, loadRetainedNativeStatExecutable, retainNativeStatArtifact, type NativeStatArtifactManifest, type NativeStatExecutable } from './native-stat-executable';
import type { WorkspaceLease } from '../workspace-files';
export { NATIVE_STAT_CAPABILITY, NATIVE_STAT_PROVIDER_IDS, validStatInput, validStatOutput } from './native-stat-contract';
export type { NativeStatInput, NativeStatOutput } from './native-stat-contract';
function declaration(id: string, executable: NativeStatExecutable) {
    const hana = executable.kind === 'hana';
    const provider: ProviderManifest = {
        schema: CAPABILITY_SCHEMA,
        id,
        type: 'native',
        version: executable.version,
        publisher: {
            id: 'edudev',
            official: true
        },
        source: {
            reference: executable.reference,
            packageHash: executable.hash,
            verification: 'verified',
            evidenceRef: executable.reference
        },
        runtime: 'main_native',
        dependencies: [],
        permissions: ['workspace.file.metadata'],
        toolRefs: [executable.reference],
        platforms: ['win32', 'darwin', 'linux'],
        locality: 'local',
        health: 'ready',
        cost: {
            latencyMs: 30000,
            resourceUnits: 1
        }
    };
    const binding: CapabilityBinding = {
        capabilityId: NATIVE_STAT_CAPABILITY.id,
        providerId: id,
        contractVersion: '1.0.0',
        adapterVersion: '1.0.0',
        enabled: true,
        priority: hana ? 0 : 1,
        userPinned: false,
        verifiedAt: '2026-11-12T00:00:00.000Z',
        providerVersion: provider.version,
        providerHash: executable.hash,
        conformance: {
            capabilityId: NATIVE_STAT_CAPABILITY.id,
            contractVersion: '1.0.0',
            verifiedAt: '2026-11-12T00:00:00.000Z',
            level: hana ? 'full' : 'partial',
            limitations: [],
            evidence: ['file_metadata', ...(hana ? ['mime', 'mime_required'] : [])].map(requirementId => ({
                requirementId,
                supported: true,
                kind: 'adapter_detected' as const,
                reference: executable.reference
            }))
        }
    };
    return {
        definition: structuredClone(NATIVE_STAT_CAPABILITY),
        provider,
        binding
    };
}
export function nativeStatDeclarations() {
    return NATIVE_STAT_PROVIDER_IDS.map((id, index) => declaration(id, loadNativeStatExecutable(index === 0 ? 'hana' : 'workspace')));
}
export async function registerNativeStatProviders(registry: CapabilityRegistry, artifactRoot?: string) {
    for (const next of nativeStatDeclarations()) {
        const current = await registry.snapshot();
        const previous = current.providers.find(item => item.id === next.provider.id);
        const definition = current.definitions.find(item => item.id === next.definition.id);
        if (previous?.health === 'revoked' || definition?.lifecycle.status === 'revoked') {
            continue;
        }
        if (previous && loadRetainedNativeStatExecutable(previous, artifactRoot)) {
            continue;
        }
        if (previous) {
            if (protocolHash(previous.source) === protocolHash(next.provider.source) && previous.version === next.provider.version) {
                continue;
            }
            const binding = current.bindings.find(item => item.providerId === previous.id && item.capabilityId === next.definition.id);
            if (!binding) {
                throw Error('capability_registry_corrupt');
            }
            next.provider.health = previous.health;
            next.binding.enabled = binding.enabled;
            next.binding.userPinned = binding.userPinned;
            next.binding.priority = binding.priority;
        }
        await registry.register(next.definition, next.provider, next.binding);
    }
}
export type NativeStatResult = {
    executionId: string;
    capabilityId: string;
    providerId: string;
    status: 'completed' | 'partial' | 'failed' | 'cancelled';
    data?: NativeStatOutput;
    artifacts: string[];
    conformance: {
        level: 'full' | 'partial';
        missingRequirements: string[];
    };
    sideEffects: {
        status: 'none';
        references: string[];
    };
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    };
    provenance: {
        providerVersion: string;
        contractVersion: string;
        registryRevision: number;
    };
};
export function createNativeStatService(options: {
    registry: CapabilityRegistry;
    resolveWorkspace: (sessionId: string) => Promise<WorkspaceLease>;
    isCurrent: (sessionId: string, runId: string) => boolean;
    artifactRoot?: string;
}) {
    const executables = new Map<string, NativeStatExecutable>();
    const executed: {
        providerId: string;
        version: string;
        hash: string;
        callId: string;
    }[] = [];
    let activeExecutions = 0;
    const key = (id: string, version: string, hash: string) => JSON.stringify([id, version, hash]);
    NATIVE_STAT_PROVIDER_IDS.forEach((id, index) => {
        const executable = loadNativeStatExecutable(index === 0 ? 'hana' : 'workspace');
        executables.set(key(id, executable.version, executable.hash), executable);
    });
    const resolver = (sessionId: string) => createCapabilityResolver(options.registry, async (provider) => {
        if (provider.type !== 'native' || provider.permissions.some(permission => permission !== 'workspace.file.metadata')) {
            return false;
        }
        await options.resolveWorkspace(sessionId);
        return true;
    }, {
        verifySource: provider => {
            const executable = executables.get(key(provider.id, provider.version, provider.source.packageHash));
            if (!executable) {
                return false;
            }
            const runtimeMatches = provider.type === 'native' && provider.runtime === 'main_native';
            const publisherMatches = provider.publisher.official && provider.publisher.id === 'edudev';
            const sourceMatches = provider.source.reference === executable.reference
                && provider.source.evidenceRef === executable.reference;
            const toolReferencesMatch = protocolHash(provider.toolRefs) === protocolHash([executable.reference]);
            return runtimeMatches && publisherMatches && sourceMatches && toolReferencesMatch;
        }
    });
    async function ensureExecutable(id: string, version: string, hash: string) {
        const identity = key(id, version, hash);
        if (executables.has(identity)) {
            return;
        }
        const record = await options.registry.providerVersion(id, version, NATIVE_STAT_CAPABILITY.id);
        if (!record || record.revoked || record.provider.source.packageHash !== hash) {
            return;
        }
        const executable = loadRetainedNativeStatExecutable(record.provider, options.artifactRoot);
        if (executable) {
            executables.set(identity, executable);
        }
    }
    return {
        register: () => registerNativeStatProviders(options.registry, options.artifactRoot),
        async resolve(sessionId: string, requirement: CapabilityRequirement) {
            const current = await options.registry.snapshot();
            for (const provider of current.providers)
                await ensureExecutable(provider.id, provider.version, provider.source.packageHash);
            return resolver(sessionId).resolve(requirement);
        },
        async resolveVersion(sessionId: string, requirement: CapabilityRequirement, id: string, version: string, hash: string) {
            await ensureExecutable(id, version, hash);
            return resolver(sessionId).resolveVersion(requirement, id, version, hash);
        },
        hasExecutable: (id: string, version: string, hash: string) => executables.has(key(id, version, hash)),
        executionHistory: () => structuredClone(executed),
        activeExecutionCount: () => activeExecutions,
        forgetExecutable: (id: string, version: string, hash: string) => executables.delete(key(id, version, hash)),
        /** Main-owned reviewed installation path. Tool/renderer arguments cannot reach it. */
        async installArtifact(id: string, kind: 'hana' | 'workspace', manifest: NativeStatArtifactManifest, directory: string) {
            if (!/^edu\.native\.[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)*$/u.test(id) || id.length > 160) {
                throw Error('invalid_input');
            }
            const executable = loadNativeStatExecutable(kind, manifest, directory);
            const identity = key(id, executable.version, executable.hash);
            const previous = executables.get(identity);
            if (previous && previous.reference !== executable.reference) {
                throw Error('capability_provider_version_immutable');
            }
            const next = declaration(id, executable);
            const snapshot = await options.registry.snapshot();
            const currentProvider = snapshot.providers.find(provider => provider.id === id);
            if (currentProvider) {
                next.provider.health = currentProvider.health;
            }
            const binding = snapshot.bindings.find(item => item.providerId === id && item.capabilityId === next.definition.id);
            if (binding) {
                next.binding.enabled = binding.enabled;
                next.binding.userPinned = binding.userPinned;
                next.binding.priority = binding.priority;
            }
            if (options.artifactRoot) {
                retainNativeStatArtifact(manifest, directory, options.artifactRoot);
            }
            executables.set(identity, executable);
            try {
                await options.registry.register(next.definition, next.provider, next.binding, undefined, executable);
            }
            catch (error) {
                if (!previous) {
                    executables.delete(identity);
                }
                throw error;
            }
            return {
                providerId: id,
                version: executable.version,
                hash: executable.hash
            };
        },
        async execute(context: {
            sessionId: string;
            runId: string;
            callId: string;
            signal: AbortSignal;
        }, providerId: string, rawRequirement: CapabilityRequirement, rawInput: unknown, pinned?: {
            version: string;
            hash: string;
        }): Promise<NativeStatResult> {
            const result: NativeStatResult = {
                executionId: context.callId,
                capabilityId: NATIVE_STAT_CAPABILITY.id,
                providerId,
                status: 'failed',
                artifacts: [],
                conformance: {
                    level: 'partial',
                    missingRequirements: []
                },
                sideEffects: {
                    status: 'none',
                    references: []
                },
                provenance: {
                    providerVersion: '1.0.0',
                    contractVersion: '1.0.0',
                    registryRevision: 0
                }
            };
            try {
                const input = snapshotProtocolInput(rawInput), requirement = snapshotProtocolInput(rawRequirement);
                if (!validStatInput(input) || !validCapabilityRequirement(requirement) || requirement.capabilityId !== NATIVE_STAT_CAPABILITY.id || !context.callId || context.callId.length > 128) {
                    throw Error('invalid_input');
                }
                const current = () => {
                    context.signal.throwIfAborted();
                    if (!options.isCurrent(context.sessionId, context.runId)) {
                        throw Error('permission_denied');
                    }
                };
                current();
                if (pinned) {
                    await ensureExecutable(providerId, pinned.version, pinned.hash);
                }
                else {
                    const currentProvider = (await options.registry.snapshot()).providers.find(provider => provider.id === providerId);
                    if (currentProvider) {
                        await ensureExecutable(providerId, currentProvider.version, currentProvider.source.packageHash);
                    }
                }
                const resolution = pinned ? await resolver(context.sessionId).resolveVersion(requirement, providerId, pinned.version, pinned.hash) : await resolver(context.sessionId).resolve(requirement);
                const selected = selectEligibleProvider(resolution, providerId);
                const record = await options.registry.providerVersion(providerId, selected.providerVersion, requirement.capabilityId);
                if (!record) {
                    throw Error('provider_version_unavailable');
                }
                const executable = executables.get(key(providerId, selected.providerVersion, record.provider.source.packageHash));
                if (!executable) {
                    throw Error('provider_version_unavailable');
                }
                result.provenance = {
                    providerVersion: selected.providerVersion,
                    contractVersion: selected.contractVersion,
                    registryRevision: resolution.registryRevision
                };
                result.conformance = {
                    level: selected.level,
                    missingRequirements: selected.missingRequirements
                };
                const lease = await options.resolveWorkspace(context.sessionId);
                current();
                executed.push({
                    providerId,
                    version: executable.version,
                    hash: executable.hash,
                    callId: context.callId
                });
                if (executed.length > 256) {
                    executed.shift();
                }
                let data: NativeStatOutput;
                activeExecutions++;
                try {
                    data = await executable.execute(executable.kind, {
                        ...context,
                        lease,
                        resolveWorkspace: options.resolveWorkspace
                    }, input);
                }
                finally {
                    activeExecutions--;
                }
                current();
                if ((await options.resolveWorkspace(context.sessionId)).version !== lease.version) {
                    throw Error('changed');
                }
                const checked = await resolver(context.sessionId).resolveVersion(requirement, providerId, selected.providerVersion, executable.hash);
                const assessment = selectEligibleProvider(checked, providerId);
                result.conformance = {
                    level: assessment.level,
                    missingRequirements: assessment.missingRequirements
                };
                current();
                if (!validStatOutput(data) || requirement.conditions.includes('require_mime') && !data.mime) {
                    throw Error('invalid_output');
                }
                result.data = data;
                result.status = assessment.level === 'partial' ? 'partial' : 'completed';
            }
            catch (error) {
                const message = (error as Error).message;
                let code = message;
                if (context.signal.aborted) {
                    code = 'cancelled';
                }
                else if (message === 'capability_selection_ineligible') {
                    code = 'provider_unavailable';
                }
                else if (message === 'capability_invalid_input') {
                    code = 'invalid_input';
                }
                const allowed = [
                    'invalid_input',
                    'permission_denied',
                    'provider_unavailable',
                    'provider_version_unavailable',
                    'capability_revoked',
                    'cancelled',
                    'changed',
                    'conflict',
                    'not_found',
                    'invalid_output',
                    'unsupported',
                    'capability_registry_changed',
                    'capability_invalid_requirement',
                    'timeout',
                    'rate_limited',
                    'budget_exceeded'
                ];
                const safe = allowed.includes(code) ? code : 'provider_unavailable';
                result.status = safe === 'cancelled' ? 'cancelled' : 'failed';
                result.error = {
                    code: safe,
                    message: safe,
                    retryable: ['changed', 'timeout', 'capability_registry_changed'].includes(safe)
                };
            }
            return result;
        }
    };
}
