import type { JournalOwner } from '../events/journal';
import type { CapabilityRegistry } from './registry';
import type { ProviderSnapshotStore } from './provider-snapshots';
import type { createNativeStatService } from './native-stat';
import type { CapabilityRequirement, CapabilityResolution } from './types';
import { protocolHash, snapshotProtocolInput, validCapabilityRequirement } from './validation';
import { providerResult, validProviderResultContext, type ProviderExecutionContext, type ProviderSnapshot, type CapabilityExecutionResult } from './provider-contract';
import {createAdapterRegistry, type AdapterRegistry} from './adapters/registry';
import {CORE_ADAPTER_VERSION, nativeStatAdapterSchemas, registerCoreAdapters} from './adapters/core';
import type {AdapterExecution} from './adapters/contract';
import type { WorkspaceLease } from '../workspace-files';
type ResolutionView = {
    resolution: CapabilityResolution;
    snapshot: ProviderSnapshot | null;
    blockedReason?: 'provider_version_unavailable' | 'capability_revoked' | 'permission_denied' | 'needs_refresh';
};
export type CapabilityAdapterRuntime = {
    supports: (capabilityId: string) => boolean;
    schemas: AdapterExecution<unknown>['schemas'];
    resolve: (sessionId: string, requirement: CapabilityRequirement) => Promise<CapabilityResolution>;
    resolveVersion: (sessionId: string, requirement: CapabilityRequirement, providerId: string, version: string, hash: string) => Promise<CapabilityResolution>;
    hasExecutable: (providerId: string, version: string, hash: string) => boolean;
    execute: (context: ProviderExecutionContext, input: unknown) => Promise<CapabilityExecutionResult>;
};
export function createCapabilityTaskRuntime(options: {
    owner: JournalOwner;
    taskId: string;
    registry: CapabilityRegistry;
    snapshots: ProviderSnapshotStore;
    native: ReturnType<typeof createNativeStatService>;
    adapters?: CapabilityAdapterRuntime;
    adapterRegistry?: AdapterRegistry;
    current: () => boolean;
    canRefresh: (capabilityId?: string) => boolean | Promise<boolean>;
    workspace: () => Promise<WorkspaceLease>;
    persist: <T>(action: () => Promise<T>) => Promise<T>;
}) {
    const { owner } = options;
    const adapters = options.adapterRegistry ?? createAdapterRegistry();
    const resolverFor = (capabilityId: string) => options.adapters?.supports(capabilityId) ? options.adapters : options.native;
    const calls = new Map<string, {
        signature: string;
        result: Promise<Awaited<ReturnType<typeof execute>>>;
    }>();
    const active = new Map<string, {
        abort: AbortController;
        done: Promise<unknown>;
    }>();
    let refreshTail = Promise.resolve();
    function fence(signal?: AbortSignal) {
        signal?.throwIfAborted();
        if (!options.current()) {
            throw Error('permission_denied');
        }
    }
    function requirement(raw: unknown): CapabilityRequirement {
        const value = snapshotProtocolInput(raw);
        if (!validCapabilityRequirement(value)) {
            throw Error('invalid_input');
        }
        // The host fixes execution platform, data residency and the maximum budget.
        return {
            ...value,
            platform: process.platform,
            localOnly: true,
            budget: {
                latencyMs: Math.min(value.budget.latencyMs, 30000),
                resourceUnits: Math.min(value.budget.resourceUnits, 1)
            }
        };
    }
    async function resolveCurrent(request: CapabilityRequirement, signal?: AbortSignal, refresh = false): Promise<ResolutionView> {
        fence(signal);
        const prior = await options.snapshots.current(owner, options.taskId, request.capabilityId)
            || await options.snapshots.previous?.(owner, options.taskId, request.capabilityId);
        if (prior && protocolHash(prior.requirement) === protocolHash(request) && !refresh) {
            const resolution = await resolverFor(request.capabilityId).resolveVersion(owner.sessionId, request, prior.selection.providerId, prior.selection.providerVersion, prior.providerHash);
            fence(signal);
            if (resolution.selectedProviders.length) {
                if (prior.runId !== owner.runId || prior.generation !== owner.generation) {
                    const snapshot = await options.persist(() => options.snapshots.save(owner, options.taskId, {
                        capabilityId: request.capabilityId, registryRevision: resolution.registryRevision,
                        requirement: request, selection: prior.selection, providerHash: prior.providerHash,
                        evidenceRefs: prior.evidenceRefs, previousSnapshotId: prior.snapshotId, refreshReason: 'resume_revalidate',
                    }));
                    fence(signal);
                    return {resolution, snapshot};
                }
                return {
                    resolution,
                    snapshot: prior
                };
            }
            const reasons = resolution.excludedProviders.flatMap(item => item.reasons);
            let blockedReason: NonNullable<ResolutionView['blockedReason']> = 'needs_refresh';
            if (reasons.includes('provider_revoked') || reasons.includes('capability_revoked')) {
                blockedReason = 'capability_revoked';
            }
            else if (reasons.includes('permission_denied')) {
                blockedReason = 'permission_denied';
            }
            else if (!resolverFor(request.capabilityId).hasExecutable(prior.selection.providerId, prior.selection.providerVersion, prior.providerHash)) {
                blockedReason = 'provider_version_unavailable';
            }
            return {
                resolution,
                snapshot: prior,
                blockedReason
            };
        }
        if (!await options.canRefresh(request.capabilityId)) {
            throw Error('capability_refresh_busy');
        }
        const resolution = await resolverFor(request.capabilityId).resolve(owner.sessionId, request);
        fence(signal);
        const selection = resolution.selectedProviders[0];
        if (!selection) {
            return {
                resolution,
                snapshot: null
            };
        }
        const record = await options.registry.providerVersion(selection.providerId, selection.providerVersion, request.capabilityId);
        if (!record || record.revoked) {
            throw Error('capability_revoked');
        }
        const snapshot = await options.persist(async () => {
            fence(signal);
            if (!await options.canRefresh(request.capabilityId)) {
                throw Error('capability_refresh_busy');
            }
            const saved = await options.snapshots.save(owner, options.taskId, {
                capabilityId: request.capabilityId,
                registryRevision: resolution.registryRevision,
                requirement: request,
                selection,
                providerHash: record.provider.source.packageHash,
                evidenceRefs: record.binding.conformance.evidence.map(item => item.reference),
                previousSnapshotId: prior?.snapshotId || null,
                refreshReason: prior ? 'explicit_refresh' : 'initial'
            });
            fence(signal);
            return saved;
        });
        return {
            resolution,
            snapshot
        };
    }
    function resolve(raw: unknown, signal?: AbortSignal, refresh = false): Promise<ResolutionView> {
        const request = requirement(raw);
        const pending = refreshTail.then(() => resolveCurrent(request, signal, refresh));
        refreshTail = pending.then(() => undefined, () => undefined);
        return pending;
    }
    async function execute(callId: string, rawRequirement: unknown, rawInput: unknown, signal?: AbortSignal) {
        fence(signal);
        const request = requirement(rawRequirement);
        const input = snapshotProtocolInput(rawInput);
        const view = await resolve(request, signal);
        if (!view.snapshot || !view.resolution.selectedProviders.length) {
            const code = view.blockedReason || 'provider_unavailable';
            return {
                success: false as const,
                resolution: view.resolution,
                snapshotId: view.snapshot?.snapshotId,
                error: {
                    code,
                    message: code,
                    retryable: false
                }
            };
        }
        const snapshot = view.snapshot;
        const abort = new AbortController();
        const combined = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal;
        const work = (async () => {
            const lease = await options.workspace();
            fence(combined);
            const context: ProviderExecutionContext = {
                taskId: options.taskId,
                ...owner,
                stepId: null,
                callId,
                signal: combined,
                snapshot,
                grantRef: protocolHash([owner.sessionId, lease.version]),
                idempotencyKey: protocolHash([
                    options.taskId, owner.runId, callId, snapshot.snapshotId, input
                ]),
                budget: {
                    timeoutMs: request.budget.latencyMs,
                    resourceUnits: request.budget.resourceUnits
                }
            };
            try {
                const target = await options.registry.executionBinding(request.capabilityId, snapshot.selection.providerId,
                    snapshot.selection.providerVersion, snapshot.providerHash);
                await registerCoreAdapters(adapters, target.provider.adapterId);
                const authorize = async () => {
                    fence(combined);
                    if ((await options.workspace()).version !== lease.version) throw Error('source_changed');
                    await options.registry.executionBinding(request.capabilityId, snapshot.selection.providerId,
                        snapshot.selection.providerVersion, snapshot.providerHash);
                };
                const schemas = target.provider.adapterId === 'edu.adapter.mcp' ? options.adapters?.schemas : nativeStatAdapterSchemas;
                if (!schemas) throw Error('provider_unavailable');
                const result = await adapters.execute(target, CORE_ADAPTER_VERSION, {
                    context, input, schemas, authorize,
                    connect: async scoped => ({execute: async value => {
                        if (target.provider.adapterId === 'edu.adapter.mcp' && options.adapters) return options.adapters.execute(scoped, value);
                        if (target.provider.adapterId !== 'edu.adapter.native') throw Error('provider_unavailable');
                        const native = await options.native.execute({sessionId: owner.sessionId, runId: owner.runId, callId,
                            signal: scoped.signal}, snapshot.selection.providerId, request, value, {
                            version: snapshot.selection.providerVersion,
                            hash: snapshot.providerHash
                        });
                        return providerResult(scoped, native);
                    }}),
                });
                if (!validProviderResultContext(result, context)) throw Error('invalid_output');
                fence(combined);
                if ((await options.workspace()).version !== lease.version) throw Error('source_changed');
                return {success: true as const, result};
            }
            catch (error) {
                const failure = combined.aborted ? Error('cancelled') : error;
                return {
                    success: true as const,
                    result: providerResult(context, undefined, failure)
                };
            }
        })();
        active.set(callId, {
            abort,
            done: work
        });
        try {
            return await work;
        }
        finally {
            active.delete(callId);
        }
    }
    return {
        /** Planning observes candidates and verifies an existing pin without adopting
         * a new Provider while the Task-plan control itself owns a write boundary. */
        async preview(raw: unknown, signal?: AbortSignal): Promise<CapabilityResolution> {
            const request = requirement(raw);
            fence(signal);
            const prior = await options.snapshots.current(owner, options.taskId, request.capabilityId)
                || await options.snapshots.previous?.(owner, options.taskId, request.capabilityId);
            const resolver = resolverFor(request.capabilityId);
            const resolution = prior && protocolHash(prior.requirement) === protocolHash(request)
                ? await resolver.resolveVersion(owner.sessionId, request, prior.selection.providerId, prior.selection.providerVersion, prior.providerHash)
                : await resolver.resolve(owner.sessionId, request);
            fence(signal);
            return resolution;
        },
        async inspect(signal?: AbortSignal) {
            fence(signal);
            const snapshot = await options.registry.snapshot();
            fence(signal);
            return {
                registryRevision: snapshot.revision,
                capabilities: snapshot.definitions.map(item => ({
                    id: item.id,
                    name: item.name,
                    contractVersion: item.contractVersion,
                    requirements: item.requirements,
                    lifecycle: item.lifecycle
                }))
            };
        },
        resolve,
        execute(callId: string, rawRequirement: unknown, rawInput: unknown, signal?: AbortSignal) {
            const signature = protocolHash(snapshotProtocolInput({
                requirement: rawRequirement,
                input: rawInput
            }));
            const previous = calls.get(callId);
            if (previous) {
                if (previous.signature !== signature) {
                    throw Error('invalid_input');
                }
                return previous.result;
            }
            const result = execute(callId, rawRequirement, rawInput, signal);
            calls.set(callId, {
                signature,
                result
            });
            return result;
        },
        async cancel(callId: string) {
            const pending = active.get(callId);
            if (!pending) {
                return {
                    status: 'not_found' as const
                };
            }
            pending.abort.abort();
            await pending.done;
            return {
                status: 'cancelled' as const
            };
        }
    };
}
export type CapabilityTaskRuntime = ReturnType<typeof createCapabilityTaskRuntime>;
