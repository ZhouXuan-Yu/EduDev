import type { Sql } from '../session-state';
import type { CapabilityDefinition, ProviderManifest, CapabilityBinding, RegistrySnapshot, ProviderVersionRecord } from './types';
import { protocolHash, snapshotProtocolInput, validCapabilityDefinition, validProviderManifest, validCapabilityBinding } from './validation';
import { isVerifiedNativeStatExecutable, type NativeStatExecutable } from './native-stat-executable';
const empty = (): RegistrySnapshot => ({
    revision: 0,
    definitions: [],
    providers: [],
    bindings: []
});
const table = 'xiaozhi_capability_registry_v1';
const versionsTable = 'xiaozhi_capability_provider_versions_v1';
type ProviderVersionKey = {providerId: string; providerVersion: string; capabilityId: string};
type Registration = {definition: CapabilityDefinition; provider: ProviderManifest; binding: CapabilityBinding};
function validate(snapshot: RegistrySnapshot) {
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0
        || snapshot.definitions.length > 128 || snapshot.providers.length > 128 || snapshot.bindings.length > 128
        || !snapshot.definitions.every(validCapabilityDefinition) || !snapshot.providers.every(validProviderManifest) || !snapshot.bindings.every(validCapabilityBinding)
        || new Set(snapshot.definitions.map(item => item.id)).size !== snapshot.definitions.length
        || new Set(snapshot.providers.map(item => item.id)).size !== snapshot.providers.length
        || new Set(snapshot.bindings.map(item => item.capabilityId + ':' + item.providerId)).size !== snapshot.bindings.length) {
        throw Error('capability_registry_corrupt');
    }
    for (const binding of snapshot.bindings) {
        const definition = snapshot.definitions.find(item => item.id === binding.capabilityId);
        const provider = snapshot.providers.find(item => item.id === binding.providerId);
        if (!definition || !provider || binding.contractVersion !== definition.contractVersion
            || binding.providerVersion !== provider.version || binding.providerHash !== provider.source.packageHash) {
            throw Error('capability_registry_contract_mismatch');
        }
    }
}
/** Reuses the session Sql transaction and serialized writer. No independent connection. */
export function createCapabilityRegistry(sql: Sql, options: {
    officialProviderIds: readonly string[];
} = {
    officialProviderIds: []
}) {
    function decodeVersion(row: Record<string, unknown> | undefined, {providerId, providerVersion: version, capabilityId}: ProviderVersionKey): ProviderVersionRecord | null {
        if (!row) {
            return null;
        }
        try {
            const record = JSON.parse(String(row.document_json)) as {
                provider: ProviderManifest;
                binding: CapabilityBinding;
            };
            if (!validProviderManifest(record.provider) || !validCapabilityBinding(record.binding) || protocolHash(record) !== row.document_hash
                || record.provider.id !== providerId || record.provider.version !== version || record.binding.capabilityId !== capabilityId
                || record.binding.providerId !== providerId || record.binding.providerVersion !== version || record.binding.providerHash !== record.provider.source.packageHash) {
                throw Error();
            }
            return {
                ...record,
                revoked: Number(row.revoked) === 1
            };
        }
        catch {
            throw Error('capability_provider_version_corrupt');
        }
    }
    async function versionRecord(work: Sql, providerId: string, version: string, capabilityId: string) {
        const row = (await work.all(`SELECT document_json,document_hash,revoked FROM ${versionsTable} WHERE provider_id=? AND provider_version=? AND capability_id=?`, [providerId, version, capabilityId]))[0];
        return decodeVersion(row, {providerId, providerVersion: version, capabilityId});
    }
    async function versionRecords(work: Sql, keys: readonly ProviderVersionKey[], signal?: AbortSignal) {
        const records: (ProviderVersionRecord | null)[] = Array(keys.length).fill(null);
        // Stay within SQLite's parameter limit and join on the existing composite key.
        for (let offset = 0; offset < keys.length; offset += 128) {
            signal?.throwIfAborted();
            const chunk = keys.slice(offset, offset + 128);
            const values = chunk.flatMap((key, index) => [offset + index, key.providerId, key.providerVersion, key.capabilityId]);
            const rows = await work.all(`WITH requested(position,provider_id,provider_version,capability_id) AS (VALUES ${chunk.map(() => '(?,?,?,?)').join(',')})
                SELECT requested.position,stored.document_json,stored.document_hash,stored.revoked
                FROM requested JOIN ${versionsTable} stored USING(provider_id,provider_version,capability_id)`, values);
            signal?.throwIfAborted();
            for (const row of rows) {
                const index = Number(row.position);
                records[index] = decodeVersion(row, keys[index]);
            }
        }
        return records;
    }
    async function archive(work: Sql, provider: ProviderManifest, binding: CapabilityBinding) {
        const prior = await versionRecord(work, provider.id, provider.version, binding.capabilityId);
        if (prior && (prior.provider.source.packageHash !== provider.source.packageHash || prior.provider.source.reference !== provider.source.reference
            || prior.binding.contractVersion !== binding.contractVersion || prior.binding.adapterVersion !== binding.adapterVersion)) {
            throw Error('capability_provider_version_immutable');
        }
        if (prior?.revoked) {
            throw Error('capability_revoked');
        }
        const record = {
            provider,
            binding
        };
        await work.run(`INSERT INTO ${versionsTable}(provider_id,provider_version,capability_id,document_json,document_hash,revoked) VALUES(?,?,?,?,?,0)
      ON CONFLICT(provider_id,provider_version,capability_id) DO UPDATE SET document_json=excluded.document_json,document_hash=excluded.document_hash`, [
            provider.id, provider.version, binding.capabilityId, JSON.stringify(record), protocolHash(record)
        ]);
    }
    async function readValidated(work: Sql): Promise<{snapshot: RegistrySnapshot; hash: string}> {
        const row = (await work.all(`SELECT revision,document_json,document_hash FROM ${table} WHERE id=1`))[0];
        if (!row) {
            const snapshot = empty();
            return {snapshot, hash: protocolHash(snapshot)};
        }
        let snapshot: RegistrySnapshot, hash: string;
        try {
            const raw: unknown = JSON.parse(String(row.document_json));
            if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).sort().join(',') !== 'bindings,definitions,providers,revision') {
                throw Error();
            }
            snapshot = raw as RegistrySnapshot;
            if (![snapshot.definitions, snapshot.providers, snapshot.bindings].every(Array.isArray)) {
                throw Error();
            }
            validate(snapshot);
            hash = protocolHash(snapshot);
            if (snapshot.revision !== Number(row.revision) || hash !== row.document_hash) {
                throw Error();
            }
        }
        catch {
            throw Error('capability_registry_corrupt');
        }
        return {snapshot, hash};
    }
    async function read(work: Sql): Promise<RegistrySnapshot> {
        return (await readValidated(work)).snapshot;
    }
    async function mutate(action: (snapshot: RegistrySnapshot, work: Sql) => void | Promise<void>, expectedRevision?: number) {
        if (!sql.transaction || !sql.change) {
            throw Error('capability_registry_transaction_required');
        }
        return sql.transaction(async (work) => {
            if (!work.change) {
                throw Error('capability_registry_transaction_required');
            }
            const {snapshot, hash: previousHash} = await readValidated(work);
            if (expectedRevision !== undefined && snapshot.revision !== expectedRevision) {
                throw Error('capability_registry_revision_conflict');
            }
            const previous = snapshot.revision;
            await action(snapshot, work);
            // These private actions only edit this snapshot and the separate version archive.
            // The singleton stays unchanged inside this serialized transaction until the CAS below.
            if (protocolHash(snapshot) === previousHash) {
                return previous;
            }
            snapshot.revision = previous + 1;
            validate(snapshot);
            const json = JSON.stringify(snapshot);
            if (Buffer.byteLength(json) > 1024 * 1024) {
                throw Error('capability_registry_capacity');
            }
            const changed = previous === 0
                ? await work.change(`INSERT OR IGNORE INTO ${table}(id,revision,document_json,document_hash) VALUES(1,?,?,?)`, [snapshot.revision, json, protocolHash(snapshot)])
                : await work.change(`UPDATE ${table} SET revision=?,document_json=?,document_hash=? WHERE id=1 AND revision=?`, [
                    snapshot.revision, json, protocolHash(snapshot), previous
                ]);
            if (changed !== 1) {
                throw Error('capability_registry_revision_conflict');
            }
            return snapshot.revision;
        });
    }
    function validatedRegistration(input: Registration, executable?: NativeStatExecutable) {
        // Clone before awaiting SQL so a caller cannot mutate a validated declaration in flight.
        const values = snapshotProtocolInput(input) as Registration;
        if (!validCapabilityDefinition(values.definition) || !validProviderManifest(values.provider) || !validCapabilityBinding(values.binding)) {
            throw Error('capability_invalid_metadata');
        }
        if (values.provider.publisher.official && !options.officialProviderIds.includes(values.provider.id)) {
            const matchesVerifiedArtifact = isVerifiedNativeStatExecutable(executable)
                && values.provider.version === executable.version
                && values.provider.source.packageHash === executable.hash
                && values.provider.source.reference === executable.reference;
            if (!matchesVerifiedArtifact) {
                throw Error('capability_source_untrusted');
            }
        }
        if (values.binding.capabilityId !== values.definition.id || values.binding.providerId !== values.provider.id) {
            throw Error('capability_registry_contract_mismatch');
        }
        return values;
    }
    async function registerInSnapshot(snapshot: RegistrySnapshot, work: Sql, values: Registration) {
        const oldDefinition = snapshot.definitions.find(item => item.id === values.definition.id);
        const oldProvider = snapshot.providers.find(item => item.id === values.provider.id);
        if (oldDefinition?.lifecycle.status === 'revoked' || oldProvider?.health === 'revoked') {
            throw Error('capability_revoked');
        }
        // A new provider cannot redefine a published capability.
        if (oldDefinition && protocolHash(oldDefinition) !== protocolHash(values.definition)) {
            throw Error('capability_definition_immutable');
        }
        if (values.binding.contractVersion !== values.definition.contractVersion || values.binding.providerVersion !== values.provider.version || values.binding.providerHash !== values.provider.source.packageHash) {
            throw Error('capability_registry_contract_mismatch');
        }
        await archive(work, values.provider, values.binding);
        const replace = <T>(items: T[], value: T, match: (item: T) => boolean) => {
            const index = items.findIndex(match);
            if (index < 0) items.push(value);
            else items[index] = value;
        };
        replace(snapshot.definitions, structuredClone(values.definition), item => item.id === values.definition.id);
        replace(snapshot.providers, structuredClone(values.provider), item => item.id === values.provider.id);
        replace(snapshot.bindings, structuredClone(values.binding), item => item.capabilityId === values.binding.capabilityId && item.providerId === values.binding.providerId);
    }
    return {
        async migrate() {
            await sql.run(`CREATE TABLE IF NOT EXISTS ${table}(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,document_json TEXT NOT NULL,document_hash TEXT NOT NULL)`);
            await sql.run(`CREATE TABLE IF NOT EXISTS ${versionsTable}(provider_id TEXT NOT NULL,provider_version TEXT NOT NULL,capability_id TEXT NOT NULL,document_json TEXT NOT NULL,document_hash TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(provider_id,provider_version,capability_id))`);
            if (!sql.transaction) {
                throw Error('capability_registry_transaction_required');
            }
            await sql.transaction(async (work) => {
                const snapshot = await read(work);
                for (const binding of snapshot.bindings) {
                    if (await versionRecord(work, binding.providerId, binding.providerVersion, binding.capabilityId)) {
                        continue;
                    }
                    await archive(work, snapshot.providers.find(provider => provider.id === binding.providerId)!, binding);
                }
            });
        },
        snapshot: () => read(sql),
        providerVersion: (providerId: string, version: string, capabilityId: string) => versionRecord(sql, providerId, version, capabilityId),
        providerVersions: (keys: readonly ProviderVersionKey[], signal?: AbortSignal) => versionRecords(sql, keys, signal),
        async registerMissingCore(registrations: readonly Registration[], signal?: AbortSignal) {
            if (!registrations.length) return 0;
            const values = registrations.map(item => validatedRegistration(item));
            if (values.length > 128 || values.some(({provider, definition}) => !provider.publisher.official || provider.type !== 'native'
                || !provider.id.startsWith('edu.native.tool.') || !definition.id.startsWith('edu.core.tool.'))
                || new Set(values.map(({provider}) => provider.id)).size !== values.length) {
                throw Error('capability_invalid_metadata');
            }
            let registered = 0;
            await mutate(async (snapshot, work) => {
                const prior = await versionRecords(work, values.map(({provider, binding}) => ({
                    providerId: provider.id, providerVersion: provider.version, capabilityId: binding.capabilityId
                })), signal);
                for (const [index, item] of values.entries()) {
                    signal?.throwIfAborted();
                    if (prior[index] || snapshot.definitions.some(entry => entry.id === item.definition.id && entry.lifecycle.status === 'revoked')
                        || snapshot.providers.some(entry => entry.id === item.provider.id && entry.health === 'revoked')) continue;
                    await registerInSnapshot(snapshot, work, item);
                    registered++;
                }
                signal?.throwIfAborted();
            });
            return registered;
        },
        async register(definition: CapabilityDefinition, provider: ProviderManifest, binding: CapabilityBinding, expectedRevision?: number, executable?: NativeStatExecutable) {
            const values = validatedRegistration({definition, provider, binding}, executable);
            return mutate((snapshot, work) => registerInSnapshot(snapshot, work, values), expectedRevision);
        },
        revokeProvider: (providerId: string, expectedRevision?: number) => mutate(snapshot => {
            const provider = snapshot.providers.find(item => item.id === providerId);
            if (!provider) {
                throw Error('capability_provider_missing');
            }
            provider.health = 'revoked';
        }, expectedRevision),
        revokeCapability: (capabilityId: string, expectedRevision?: number) => mutate(snapshot => {
            const definition = snapshot.definitions.find(item => item.id === capabilityId);
            if (!definition) {
                throw Error('capability_missing');
            }
            definition.lifecycle.status = 'revoked';
        }, expectedRevision),
        revokeProviderVersion: (providerId: string, version: string, capabilityId: string) => mutate(async (snapshot, work) => {
            const record = await versionRecord(work, providerId, version, capabilityId);
            if (!record) {
                throw Error('capability_provider_missing');
            }
            if (record.revoked) {
                return;
            }
            await work.run(`UPDATE ${versionsTable} SET revoked=1 WHERE provider_id=? AND provider_version=? AND capability_id=?`, [providerId, version, capabilityId]);
            // Revision reflects security changes even when the current version is newer.
            snapshot.revision++;
        })
    };
}
export type CapabilityRegistry = ReturnType<typeof createCapabilityRegistry>;
