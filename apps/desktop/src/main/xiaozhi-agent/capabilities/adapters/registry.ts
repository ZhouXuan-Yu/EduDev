import {ADAPTER_CONTRACT, type AdapterDefinition, type AdapterExecution, type AdapterState, type AdapterTarget} from './contract';
import {adapterAdmissionOrder, assertAdapterTransition} from './lifecycle';
import {adapterIsolation, assertDeveloperAdapterPolicy} from './security';
import {validProviderResultContext} from '../provider-contract';
import {protocolHash, snapshotProtocolInput} from '../validation';

type Entry = {
    definition: AdapterDefinition;
    state: AdapterState;
    active: Set<AbortController>;
    attested: boolean;
};

export function createAdapterRegistry(options: {platform?: NodeJS.Platform; audit?: (execution: AdapterExecution<unknown>['context'], adapterId: string, code: string) => Promise<void>} = {}) {
    const platform = options.platform ?? process.platform;
    const entries = new Map<string, Entry>();
    const key = (id: string, version: string) => id + '@' + version;
    const get = (id: string, version: string) => entries.get(key(id, version));
    const view = (entry: Entry) => ({...entry.definition, state: entry.state, isolation: adapterIsolation(entry.definition, platform)});
    function transition(id: string, version: string, state: AdapterState) {
        const entry = get(id, version);
        if (!entry) throw Error('capability_adapter_missing');
        assertAdapterTransition(entry.state, state);
        if (state === 'validated' && !entry.attested) throw Error('capability_adapter_unverified');
        if ((state === 'activated' || state === 'available') && adapterIsolation(entry.definition, platform).tier === 'T3') throw Error('permission_denied');
        entry.state = state;
        if (state === 'suspended' || state === 'revoked' || state === 'uninstalled') {
            for (const controller of entry.active) controller.abort('adapter_' + state);
        }
        return view(entry);
    }
    function register(raw: AdapterDefinition) {
        const definition = snapshotProtocolInput(raw) as AdapterDefinition;
        if (!definition || Object.keys(definition).sort().join(',') !== 'artifactHash,contractVersion,id,kind,publisher,transport,version'
            || typeof definition.id !== 'string' || !/^(edu\.adapter\.|community\.)[a-z0-9_.-]{1,100}$/u.test(definition.id)
            || typeof definition.version !== 'string' || !/^\d+\.\d+\.\d+(?:\+[a-zA-Z0-9.-]+)?$/u.test(definition.version)
            || typeof definition.publisher !== 'string' || !/^[a-z0-9_.-]{1,80}$/u.test(definition.publisher)
            || typeof definition.artifactHash !== 'string' || !/^[a-f0-9]{64}$/u.test(definition.artifactHash)
            || definition.contractVersion !== ADAPTER_CONTRACT
            || !(definition.kind === 'core' && definition.id.startsWith('edu.adapter.') && definition.publisher === 'edudev'
                && ['native','managed_mcp','worker'].includes(definition.transport)
                || definition.kind === 'community' && definition.id.startsWith('community.') && definition.transport === 'extension_rpc')) {
            throw Error('capability_invalid_adapter');
        }
        const previous = get(definition.id, definition.version);
        if (previous) {
            if (protocolHash(previous.definition) !== protocolHash(definition)) throw Error('capability_adapter_version_conflict');
            if (previous.state === 'revoked' || previous.state === 'uninstalled') throw Error('capability_revoked');
            return view(previous);
        }
        if (entries.size >= 128) throw Error('capability_registry_capacity');
        const entry: Entry = {definition, state:'discovered', active:new Set(), attested:false};
        entries.set(key(definition.id, definition.version), entry);
        return view(entry);
    }
    async function admit(definition: AdapterDefinition, verifyArtifact: () => Promise<boolean>) {
        const existing = register(definition);
        if (existing.state === 'available') return existing;
        if (existing.state !== 'discovered' && existing.state !== 'suspended') throw Error('capability_adapter_transition');
        if (await verifyArtifact() !== true) throw Error('capability_adapter_unverified');
        // A concurrent verifier can finish admission while this verification is in flight.
        const current = get(definition.id, definition.version)!;
        if (current.state === 'available') return view(current);
        if (current.state !== existing.state) throw Error('capability_adapter_transition');
        current.attested = true;
        const steps = current.state === 'suspended' ? adapterAdmissionOrder.slice(-2) : adapterAdmissionOrder;
        for (const state of steps) transition(definition.id, definition.version, state);
        return view(current);
    }
    return {
        register, admit, transition,
        find(id: string, version: string) {
            const entry = get(id, version);
            return entry && entry.state !== 'uninstalled' ? view(entry) : null;
        },
        list: () => [...entries.values()].filter(entry => entry.state !== 'uninstalled').map(view),
        async execute<T>(target: AdapterTarget, version: string, request: AdapterExecution<T>) {
            const {context} = request;
            const id = target.provider.adapterId;
            const entry = get(id, version);
            let denied: Error | undefined;
            try {
                if (!entry || entry.state !== 'available') throw Error('provider_unavailable');
                assertDeveloperAdapterPolicy(entry.definition, adapterIsolation(entry.definition, platform), target);
                if (target.definition.id !== context.snapshot.capabilityId || target.binding.providerVersion !== context.snapshot.selection.providerVersion
                    || target.binding.providerHash !== context.snapshot.providerHash || target.provider.id !== context.snapshot.selection.providerId) {
                    throw Error('source_changed');
                }
            } catch (error) {denied = error as Error;}
            if (!entry || denied) {
                await options.audit?.(context, id, denied?.message || 'provider_unavailable');
                throw denied || Error('provider_unavailable');
            }
            const controller = new AbortController();
            const signal = AbortSignal.any([context.signal, controller.signal, AbortSignal.timeout(context.budget.timeoutMs)]);
            const scoped = {...context, signal};
            entry.active.add(controller);
            try {
                signal.throwIfAborted();
                await request.authorize();
                signal.throwIfAborted();
                const {schemas} = request;
                if (schemas.input !== target.definition.inputSchemaRef || schemas.output !== target.definition.outputSchemaRef) throw Error('source_changed');
                if (!schemas.validateInput(request.input)) throw Error('invalid_input');
                const connection = await request.connect(scoped, Object.freeze({...target.instance}));
                try {
                    signal.throwIfAborted();
                    const result = await connection.execute(request.input);
                    if (!validProviderResultContext(result, context)
                        || ['completed','partial'].includes(result.status) && !schemas.validateOutput(result.data)) throw Error('invalid_output');
                    signal.throwIfAborted();
                    return result;
                } finally {await connection.close?.();}
            } catch (error) {
                if (signal.aborted) throw Error(signal.reason?.name === 'TimeoutError' ? 'timeout' : 'cancelled');
                if (error instanceof Error && error.message === 'permission_denied') await options.audit?.(context, id, error.message);
                throw error;
            } finally {entry.active.delete(controller);}
        },
    };
}
export type AdapterRegistry = ReturnType<typeof createAdapterRegistry>;
