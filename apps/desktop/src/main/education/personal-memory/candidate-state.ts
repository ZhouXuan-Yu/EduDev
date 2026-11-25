import type { Sql } from '../../xiaozhi-agent/session-state';
import type { CandidateAuthority, PersonalMemoryDraft } from './candidate-admission';

export const personalMemoryCandidateSchema = `
CREATE TABLE personal_memory_processing (
  id INTEGER PRIMARY KEY CHECK (id=1),
  enabled INTEGER NOT NULL CHECK (enabled IN (0,1)),
  policy_revision INTEGER NOT NULL CHECK (policy_revision>=0),
  cancel_generation INTEGER NOT NULL CHECK (cancel_generation>=0)
);
INSERT INTO personal_memory_processing (id,enabled,policy_revision,cancel_generation) VALUES (1,0,0,0);
CREATE TABLE personal_memory_pending (
  draft_key TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version=1),
  source_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  source_generation INTEGER NOT NULL CHECK (source_generation>=0),
  state TEXT NOT NULL CHECK (state IN ('pending','rejected','stale','conflict')),
  revision INTEGER NOT NULL CHECK (revision>0),
  draft_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX personal_memory_pending_source ON personal_memory_pending(source_id,state);
`;

export type PersonalMemoryProcessing = CandidateAuthority & Readonly<{ enabled: boolean }>;
type PendingDraft = { draft: PersonalMemoryDraft; state: 'pending' | 'rejected' | 'stale' | 'conflict'; revision: number };
type SourceWitnessReader = (transaction: Sql, draft: PersonalMemoryDraft) => Promise<boolean>;

function assertRevision(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw Error('invalid_input');
}

function pendingDraft(row: Record<string, unknown>): PendingDraft {
  const draft = JSON.parse(String(row.draft_json)) as PersonalMemoryDraft;
  const state = row.state;
  const revision = Number(row.revision);
  if (row.schema_version !== 1 || draft.key !== row.draft_key || draft.state !== 'pending'
      || draft.witness.sourceId !== row.source_id || draft.witness.sourceVersion !== row.source_version
      || draft.witness.generation !== row.source_generation || !Number.isSafeInteger(revision) || revision < 1
      || (state !== 'pending' && state !== 'rejected' && state !== 'stale' && state !== 'conflict')) throw Error('configuration');
  return {draft, state, revision};
}

/** Persistence for admitted drafts. Canonical source and target witnesses remain with the authorizing host. */
export function createPersonalMemoryCandidateState(sql: Sql, witnessCurrent: SourceWitnessReader) {
  async function processing(db = sql): Promise<PersonalMemoryProcessing> {
    const [row] = await db.all('SELECT enabled,policy_revision,cancel_generation FROM personal_memory_processing WHERE id=1');
    if (!row) throw Error('configuration');
    return {enabled:row.enabled===1, policyRevision:Number(row.policy_revision), cancelGeneration:Number(row.cancel_generation)};
  }

  return {
    processing,
    async setEnabled(enabled: boolean, expectedRevision: number) {
      assertRevision(expectedRevision);
      if (typeof enabled !== 'boolean') throw Error('invalid_input');
      return sql.transaction(async db => {
        const current = await processing(db);
        if (current.policyRevision !== expectedRevision) throw Error('revision_conflict');
        if (current.enabled === enabled) return current;
        await db.run(`UPDATE personal_memory_processing SET enabled=?,policy_revision=policy_revision+1,
          cancel_generation=cancel_generation+? WHERE id=1`, [enabled ? 1 : 0, enabled ? 0 : 1]);
        return processing(db);
      });
    },
    async savePending(drafts: readonly PersonalMemoryDraft[], expected: CandidateAuthority) {
      if (drafts.length > 20) throw Error('invalid_input');
      return sql.transaction(async db => {
        const current = await processing(db);
        if (!current.enabled || current.cancelGeneration !== expected.cancelGeneration) throw Error('cancelled');
        if (current.policyRevision !== expected.policyRevision) throw Error('stale_policy');
        const saved: string[] = [];
        const stale: string[] = [];
        const conflicted: string[] = [];
        let repeated = 0;
        for (const draft of drafts) {
          if (draft.state !== 'pending' || draft.authority.policyRevision !== current.policyRevision
              || draft.authority.cancelGeneration !== current.cancelGeneration || !await witnessCurrent(db,draft)) {
            stale.push(draft.key);
            continue;
          }
          const changed = await db.change(`INSERT INTO personal_memory_pending
            (draft_key, schema_version, source_id, source_version, source_generation, state, revision, draft_json, created_at)
            VALUES (?,1,?,?,?,'pending',1,?,?) ON CONFLICT(draft_key) DO NOTHING`,
          [draft.key,draft.witness.sourceId,draft.witness.sourceVersion,draft.witness.generation,JSON.stringify(draft),Date.now()]);
          if (changed) {
            saved.push(draft.key);
            continue;
          }
          const [row] = await db.all('SELECT * FROM personal_memory_pending WHERE draft_key=?', [draft.key]);
          const prior = pendingDraft(row);
          if (prior.state === 'pending' && prior.draft.proposedValue !== draft.proposedValue) {
            await db.change("UPDATE personal_memory_pending SET state='conflict',revision=revision+1 WHERE draft_key=?",
              [draft.key]);
            conflicted.push(draft.key);
          } else repeated++;
        }
        return {saved, stale, conflicted, repeated};
      });
    },
    async list(limit: number) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw Error('invalid_input');
      return (await sql.all('SELECT * FROM personal_memory_pending ORDER BY created_at DESC, draft_key LIMIT ?',[limit])).map(pendingDraft);
    },
    async reject(key: string, expectedRevision: number) {
      assertRevision(expectedRevision);
      if (!/^[a-f0-9]{64}$/.test(key)) throw Error('invalid_input');
      return sql.transaction(async db => {
        const changed = await db.change(`UPDATE personal_memory_pending SET state='rejected',revision=revision+1
          WHERE draft_key=? AND revision=? AND state IN ('pending','conflict')`, [key,expectedRevision]);
        if (changed !== 1) throw Error('revision_conflict');
        const [row] = await db.all('SELECT * FROM personal_memory_pending WHERE draft_key=?',[key]);
        return pendingDraft(row);
      });
    },
    async invalidateSource(db: Sql, sourceId: string, generation: number) {
      assertRevision(generation);
      return db.change(`UPDATE personal_memory_pending SET state='stale',revision=revision+1
        WHERE source_id=? AND source_generation<=? AND state IN ('pending','conflict')`,[sourceId,generation]);
    },
  };
}
