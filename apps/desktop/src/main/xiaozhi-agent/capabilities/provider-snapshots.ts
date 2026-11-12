import { randomUUID } from 'node:crypto';
import type { Sql } from '../session-state';
import type { JournalOwner } from '../events/journal';
import { createTaskState } from '../tasks/task-state';
import { validTaskOwner } from '../../../shared/xiaozhi-task';
import type { ProviderSnapshot } from './provider-contract';
import { protocolHash, snapshotProtocolInput, validCapabilityRequirement, validCapabilityResolution } from './validation';
import { createCapabilityRegistry } from './registry';
import { assessConformance } from './resolver';
const table = 'xiaozhi_capability_snapshots_v1';
export function validProviderSnapshot(value: unknown): value is ProviderSnapshot {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const snapshot = value as ProviderSnapshot;
    if (Object.keys(snapshot).sort().join(',') !== 'capabilityId,createdAt,evidenceRefs,generation,previousSnapshotId,providerHash,refreshReason,registryRevision,requirement,runId,schema,selection,sessionId,snapshotId,taskId') {
        return false;
    }
    const ownerValid = validTaskOwner({
        sessionId: snapshot.sessionId,
        runId: snapshot.runId,
        generation: snapshot.generation
    });
    if (snapshot.schema !== 'xiaozhi.capability-snapshot.v1'
        || !/^xicap_[a-f0-9-]{36}$/u.test(snapshot.snapshotId)
        || !/^xitask_[a-f0-9]{64}$/u.test(snapshot.taskId)
        || !ownerValid) {
        return false;
    }
    if (!validCapabilityRequirement(snapshot.requirement) || snapshot.capabilityId !== snapshot.requirement.capabilityId || !snapshot.selection || snapshot.selection.contractVersion !== snapshot.requirement.contractVersion) {
        return false;
    }
    if (!/^[a-f0-9]{64}$/u.test(snapshot.providerHash) || !Number.isFinite(Date.parse(snapshot.createdAt)) || !Array.isArray(snapshot.evidenceRefs) || snapshot.evidenceRefs.length > 128 || snapshot.evidenceRefs.some(reference => typeof reference !== 'string' || reference.length > 512)) {
        return false;
    }
    if (snapshot.previousSnapshotId !== null && !/^xicap_[a-f0-9-]{36}$/u.test(snapshot.previousSnapshotId) || !['initial', 'explicit_refresh'].includes(snapshot.refreshReason)) {
        return false;
    }
    return validCapabilityResolution({
        capabilityId: snapshot.capabilityId,
        status: snapshot.selection.level === 'full' ? 'resolved' : 'partial',
        selectedProviders: [snapshot.selection],
        alternatives: [],
        acceptedLimitations: snapshot.selection.limitations,
        excludedProviders: [],
        blockedReasons: [],
        registryRevision: snapshot.registryRevision
    });
}
export function createProviderSnapshotStore(sql: Sql) {
    async function assertCurrent(work: Sql, owner: JournalOwner, taskId: string) {
        const state = createTaskState(work, {
            sanitize: async () => { throw Error('invalid_input'); }
        });
        const task = await state.latest(owner.sessionId);
        if (!task || task.id !== taskId || task.state !== 'active' || task.binding?.runId !== owner.runId || task.binding.generation !== owner.generation) {
            throw Error('permission_denied');
        }
        await state.validateCurrent(owner, task.id, task.revision);
    }
    function decode(row: Record<string, unknown>): ProviderSnapshot {
        try {
            const snapshot: unknown = JSON.parse(String(row.snapshot_json));
            if (!validProviderSnapshot(snapshot) || protocolHash(snapshot) !== row.snapshot_hash) {
                throw Error();
            }
            const matchesRow = snapshot.snapshotId === row.snapshot_id
                && snapshot.taskId === row.task_id
                && snapshot.sessionId === row.session_id
                && snapshot.runId === row.run_id
                && snapshot.generation === Number(row.generation)
                && snapshot.capabilityId === row.capability_id
                && snapshot.createdAt === row.created_at;
            if (!matchesRow) {
                throw Error();
            }
            return snapshot;
        }
        catch {
            throw Error('capability_snapshot_corrupt');
        }
    }
    return {
        async migrate() {
            await sql.run(`CREATE TABLE IF NOT EXISTS ${table}(snapshot_id TEXT PRIMARY KEY,task_id TEXT NOT NULL,session_id TEXT NOT NULL,run_id TEXT NOT NULL,generation INTEGER NOT NULL,capability_id TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,created_at TEXT NOT NULL)`);
            await sql.run(`CREATE INDEX IF NOT EXISTS xiaozhi_capability_snapshot_owner ON ${table}(task_id,run_id,generation,capability_id)`);
        },
        async current(owner: JournalOwner, taskId: string, capabilityId: string) {
            await assertCurrent(sql, owner, taskId);
            const row = (await sql.all(`SELECT * FROM ${table} WHERE task_id=? AND session_id=? AND run_id=? AND generation=? AND capability_id=? ORDER BY rowid DESC LIMIT 1`, [
                taskId, owner.sessionId, owner.runId, owner.generation, capabilityId
            ]))[0];
            return row ? decode(row) : null;
        },
        async save(owner: JournalOwner, taskId: string, value: Omit<ProviderSnapshot, 'schema' | 'snapshotId' | 'taskId' | 'sessionId' | 'runId' | 'generation' | 'createdAt'>) {
            const input = snapshotProtocolInput(value) as typeof value;
            const snapshot: ProviderSnapshot = {
                ...structuredClone(input),
                schema: 'xiaozhi.capability-snapshot.v1',
                snapshotId: 'xicap_' + randomUUID(),
                taskId,
                sessionId: owner.sessionId,
                runId: owner.runId,
                generation: owner.generation,
                createdAt: new Date().toISOString()
            };
            if (!validProviderSnapshot(snapshot) || !sql.transaction) {
                throw Error('capability_invalid_snapshot');
            }
            return sql.transaction(async (work) => {
                await assertCurrent(work, owner, taskId);
                const revision = (await work.all('SELECT revision FROM xiaozhi_capability_registry_v1 WHERE id=1'))[0];
                if (Number(revision?.revision) !== snapshot.registryRevision) {
                    throw Error('source_changed');
                }
                const registry = createCapabilityRegistry(work);
                const current = await registry.snapshot();
                const definition = current.definitions.find(item => item.id === snapshot.capabilityId);
                const provider = current.providers.find(item => item.id === snapshot.selection.providerId);
                const binding = current.bindings.find(item => item.providerId === provider?.id && item.capabilityId === snapshot.capabilityId);
                if (!definition || !provider || !binding) {
                    throw Error('capability_invalid_snapshot');
                }
                const active = definition.lifecycle.status !== 'revoked'
                    && provider.health === 'ready'
                    && binding.enabled;
                const matchesSelection = provider.version === snapshot.selection.providerVersion
                    && provider.source.packageHash === snapshot.providerHash
                    && provider.source.verification === 'verified'
                    && binding.contractVersion === snapshot.selection.contractVersion;
                const platformSupported = snapshot.requirement.platform === process.platform
                    && definition.platforms.includes(snapshot.requirement.platform)
                    && provider.platforms.includes(snapshot.requirement.platform);
                const residencySatisfied = !snapshot.requirement.localOnly || provider.locality === 'local';
                const dependenciesAvailable = provider.dependencies.every(item => item.available);
                const budgetSufficient = provider.cost.latencyMs <= snapshot.requirement.budget.latencyMs
                    && provider.cost.resourceUnits <= snapshot.requirement.budget.resourceUnits;
                const evidenceMatches = protocolHash(snapshot.evidenceRefs)
                    === protocolHash(binding.conformance.evidence.map(item => item.reference));
                if (!active || !matchesSelection || !platformSupported || !residencySatisfied
                    || !dependenciesAvailable || !budgetSufficient || !evidenceMatches) {
                    throw Error('capability_invalid_snapshot');
                }
                const version = await registry.providerVersion(provider.id, provider.version, snapshot.capabilityId);
                if (!version || version.revoked) {
                    throw Error('capability_invalid_snapshot');
                }
                const assessment = assessConformance(definition, binding, snapshot.requirement);
                const expected = {
                    providerId: provider.id,
                    providerVersion: provider.version,
                    contractVersion: binding.contractVersion,
                    level: assessment.level,
                    missingRequirements: assessment.missing,
                    limitations: assessment.limitations
                };
                if (assessment.missingRequired.length || assessment.missingConditional.length || protocolHash(expected) !== protocolHash(snapshot.selection)) {
                    throw Error('capability_invalid_snapshot');
                }
                if (snapshot.previousSnapshotId) {
                    const previous = (await work.all(`SELECT * FROM ${table} WHERE snapshot_id=?`, [snapshot.previousSnapshotId]))[0];
                    if (!previous) {
                        throw Error('capability_invalid_snapshot');
                    }
                    const old = decode(previous);
                    const sameTaskRun = old.taskId === taskId
                        && old.sessionId === owner.sessionId
                        && old.runId === owner.runId
                        && old.generation === owner.generation
                        && old.capabilityId === snapshot.capabilityId;
                    if (!sameTaskRun) {
                        throw Error('capability_invalid_snapshot');
                    }
                }
                await work.run(`INSERT INTO ${table}(snapshot_id,task_id,session_id,run_id,generation,capability_id,snapshot_json,snapshot_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?)`, [
                    snapshot.snapshotId, taskId, owner.sessionId, owner.runId, owner.generation, snapshot.capabilityId, JSON.stringify(snapshot), protocolHash(snapshot), snapshot.createdAt
                ]);
                return snapshot;
            });
        },
        async history(taskId: string) {
            if (!/^xitask_[a-f0-9]{64}$/u.test(taskId)) {
                throw Error('invalid_input');
            }
            return (await sql.all(`SELECT * FROM ${table} WHERE task_id=? ORDER BY rowid`, [taskId])).map(decode);
        }
    };
}
export type ProviderSnapshotStore = ReturnType<typeof createProviderSnapshotStore>;
