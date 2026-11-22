import type {Sql} from '../session-state';
import type {ProviderDefinition, ProviderInstance, ProviderManifest} from './types';
import {protocolHash} from './validation';

const table = 'xiaozhi_capability_provider_instances_v1';
const states = ['enabled', 'disabled', 'revoked'] as const;
const healthStates = ['ready', 'degraded', 'unavailable', 'disabled', 'revoked', 'pending_approval', 'blocked_dependency'] as const;
const identifier = /^[a-z0-9][a-z0-9_.:-]{0,159}$/u;

export function providerDefinition(provider: ProviderManifest): ProviderDefinition {
    const {health: _health, cost: _cost, dependencies, ...definition} = provider;
    const adapterId = provider.type === 'extension' && provider.id.startsWith('extension.local.')
        ? 'community.' + provider.id.slice('extension.local.'.length).replace(/\.v_[a-f0-9]{16}$/u, '')
        : 'edu.adapter.' + provider.type;
    return {...definition, adapterId, dependencies: dependencies.map(({id}) => id)};
}

export type InitialProviderRuntime = Pick<ProviderManifest, 'health'|'cost'> & {availableDependencies: string[]};

export function providerManifest(definition: ProviderDefinition, runtime: InitialProviderRuntime): ProviderManifest {
    const {adapterId: _adapterId, dependencies, ...declared} = definition;
    return {...declared, health:runtime.health, cost:runtime.cost,
        dependencies:dependencies.map(id => ({id, available:runtime.availableDependencies.includes(id)}))};
}

export function defaultProviderInstance(provider: ProviderManifest): ProviderInstance {
    return {id: 'default', providerId: provider.id, providerVersion: provider.version,
        providerHash: provider.source.packageHash, configurationRef: null, connectionRef: null, authorityRef: null,
        state: provider.health === 'revoked' ? 'revoked' : provider.health === 'disabled' ? 'disabled' : 'enabled',
        health: provider.health, revision: 0};
}

function valid(value: unknown): value is ProviderInstance {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const entry = value as ProviderInstance;
    return Object.keys(entry).sort().join(',') === 'authorityRef,configurationRef,connectionRef,health,id,providerHash,providerId,providerVersion,revision,state'
        && [entry.id, entry.providerId].every(id => typeof id === 'string' && identifier.test(id))
        && [entry.configurationRef, entry.connectionRef, entry.authorityRef].every(ref => ref === null || typeof ref === 'string' && identifier.test(ref))
        && typeof entry.providerVersion === 'string' && /^\d+\.\d+\.\d+(?:\+[a-zA-Z0-9.-]+)?$/u.test(entry.providerVersion)
        && typeof entry.providerHash === 'string' && /^[a-f0-9]{64}$/u.test(entry.providerHash) && states.includes(entry.state)
        && healthStates.includes(entry.health) && Number.isSafeInteger(entry.revision) && entry.revision > 0;
}

export function createProviderInstanceStore(sql: Sql) {
    function decode(row: Record<string, unknown>, providerId: string) {
        const instance: unknown = JSON.parse(String(row.document_json));
        if (!valid(instance) || instance.providerId !== providerId || instance.id !== row.instance_id
            || protocolHash(instance) !== row.document_hash) throw Error('capability_provider_instance_corrupt');
        return instance;
    }
    async function list(providerId: string): Promise<ProviderInstance[]> {
        const rows = await sql.all(`SELECT instance_id,document_json,document_hash FROM ${table} WHERE provider_id=? ORDER BY instance_id`, [providerId]);
        return rows.map(row => decode(row, providerId));
    }

    return {
        migrate: () => sql.run(`CREATE TABLE IF NOT EXISTS ${table}(
            provider_id TEXT NOT NULL, instance_id TEXT NOT NULL, document_json TEXT NOT NULL, document_hash TEXT NOT NULL,
            PRIMARY KEY(provider_id,instance_id))`),
        list,
        async find(providerId: string, id: string) {
            const [row] = await sql.all(`SELECT instance_id,document_json,document_hash FROM ${table} WHERE provider_id=? AND instance_id=?`, [providerId, id]);
            return row ? decode(row, providerId) : null;
        },
        async put(provider: ProviderManifest, input: Omit<ProviderInstance, 'providerId'|'providerVersion'|'providerHash'|'revision'>, expectedRevision: number) {
            const entries = await list(provider.id);
            const previous = entries.find(entry => entry.id === input.id);
            if ((previous?.revision ?? 0) !== expectedRevision) throw Error('capability_provider_instance_conflict');
            if (previous?.state === 'revoked' || provider.health === 'revoked') throw Error('capability_revoked');
            if (!previous && entries.length >= 32) throw Error('capability_registry_capacity');
            const {providerId, providerVersion, providerHash} = defaultProviderInstance(provider);
            const instance = {...input, providerId, providerVersion, providerHash, revision: expectedRevision + 1};
            if (!valid(instance)) throw Error('capability_invalid_instance');
            await sql.run(`INSERT INTO ${table}(provider_id,instance_id,document_json,document_hash) VALUES(?,?,?,?)
                ON CONFLICT(provider_id,instance_id) DO UPDATE SET document_json=excluded.document_json,document_hash=excluded.document_hash`,
                [provider.id, instance.id, JSON.stringify(instance), protocolHash(instance)]);
            return instance;
        }
    };
}

export function instanceCanRun(instance: ProviderInstance, provider: ProviderManifest) {
    // Older pinned tasks may keep the exact reviewed package while its current installations remain enabled.
    return instance.state === 'enabled' && instance.health === 'ready' && instance.providerId === provider.id
        && (instance.id === 'default' || instance.providerVersion === provider.version && instance.providerHash === provider.source.packageHash);
}
