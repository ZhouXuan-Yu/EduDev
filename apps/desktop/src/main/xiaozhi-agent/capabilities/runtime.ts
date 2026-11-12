import type { JournalOwner } from '../events/journal';
import type { CapabilityRegistry } from './registry';
import type { ProviderSnapshotStore } from './provider-snapshots';
import type { createNativeStatService } from './native-stat';
import type { CapabilityRequirement, CapabilityResolution } from './types';
import { protocolHash, snapshotProtocolInput, validCapabilityRequirement } from './validation';
import { providerResult, type ProviderExecutionContext, type ProviderSnapshot } from './provider-contract';
import type { WorkspaceLease } from '../workspace-files';
type ResolutionView = {
    resolution: CapabilityResolution;
    snapshot: ProviderSnapshot | null;
    blockedReason?: 'provider_version_unavailable' | 'capability_revoked' | 'permission_denied' | 'needs_refresh';
};
export function createCapabilityTaskRuntime(options: {
    owner: JournalOwner;
    taskId: string;
    registry: CapabilityRegistry;
    snapshots: ProviderSnapshotStore;
    native: ReturnType<typeof createNativeStatService>;
    current: () => boolean;
    canRefresh: () => boolean;
    workspace: () => Promise<WorkspaceLease>;
    persist: <T>(action: () => Promise<T>) => Promise<T>;
}) {
    const { owner } = options;
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
        const prior = await options.snapshots.current(owner, options.taskId, request.capabilityId);
        if (prior && protocolHash(prior.requirement) === protocolHash(request) && !refresh) {
            const resolution = await options.native.resolveVersion(owner.sessionId, request, prior.selection.providerId, prior.selection.providerVersion, prior.providerHash);
            fence(signal);
            if (resolution.selectedProviders.length) {
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
            else if (!options.native.hasExecutable(prior.selection.providerId, prior.selection.providerVersion, prior.providerHash)) {
                blockedReason = 'provider_version_unavailable';
            }
            return {
                resolution,
                snapshot: prior,
                blockedReason
            };
        }
        if (!options.canRefresh()) {
            throw Error('capability_refresh_busy');
        }
        const resolution = await options.native.resolve(owner.sessionId, request);
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
            if (!options.canRefresh()) {
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
                const native = await options.native.execute({
                    sessionId: owner.sessionId,
                    runId: owner.runId,
                    callId,
                    signal: combined
                }, snapshot.selection.providerId, request, input, {
                    version: snapshot.selection.providerVersion,
                    hash: snapshot.providerHash
                });
                fence(combined);
                if ((await options.workspace()).version !== lease.version) {
                    throw Error('source_changed');
                }
                return {
                    success: true as const,
                    result: providerResult(context, native)
                };
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
