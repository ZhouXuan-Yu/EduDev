import type { Sql } from '../../xiaozhi-agent/session-state';
import { sameCandidatePolicy, type CandidateAuthority, type PersonalMemoryDraft } from './candidate-admission';
import { readTeacherMemoryPolicy } from '../teacher-memory-policy';

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
  state TEXT NOT NULL CHECK (state IN ('pending','rejected','stale','conflict','accepted')),
  revision INTEGER NOT NULL CHECK (revision>0),
  draft_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX personal_memory_pending_source ON personal_memory_pending(source_id,state);
`;

export type PersonalMemoryProcessing = CandidateAuthority & Readonly<{ enabled: boolean; pausedByUsePolicy: boolean }>;
type PendingDraft = { draft: PersonalMemoryDraft; state: 'pending' | 'rejected' | 'stale' | 'conflict' | 'accepted'; revision: number; recordedAt: number | null };
export type CandidateWriteReceipt = { saved: string[]; stale: string[]; conflicted: string[]; repeated: number };
type SourceWitnessReader = (transaction: Sql, draft: PersonalMemoryDraft) => Promise<boolean>;
type WritableSql = Sql & { change: NonNullable<Sql['change']> };

function requireChanges(db: Sql): asserts db is WritableSql {
  if (!db.change) throw Error('configuration');
}

function assertRevision(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw Error('invalid_input');
}

export async function invalidatePersonalMemoryDrafts(db: Sql, sourceId: string, generation: number) {
  assertRevision(generation);
  requireChanges(db);
  return db.change(`UPDATE personal_memory_pending SET state='stale',revision=revision+1
    WHERE source_id=? AND source_generation<=? AND state IN ('pending','conflict')`, [sourceId,generation]);
}

function pendingDraft(row: Record<string, unknown>): PendingDraft {
  const draft = JSON.parse(String(row.draft_json)) as PersonalMemoryDraft;
  const state = row.state;
  const revision = Number(row.revision);
  if (row.schema_version !== 1 || draft.key !== row.draft_key || draft.state !== 'pending'
      || draft.witness.sourceId !== row.source_id || draft.witness.sourceVersion !== row.source_version
      || draft.witness.generation !== row.source_generation || !Number.isSafeInteger(revision) || revision < 1
      || (state !== 'pending' && state !== 'rejected' && state !== 'stale' && state !== 'conflict' && state !== 'accepted'))
    throw Error('configuration');
  const time = row.created_at;
  const recordedAt = typeof time === 'number' && Number.isSafeInteger(time) && Number.isFinite(new Date(time).getTime()) ? time : null;
  return {draft, state, revision, recordedAt};
}

export async function readPersonalMemoryDraft(db: Sql, key: string) {
  const [row] = await db.all('SELECT * FROM personal_memory_pending WHERE draft_key=?',[key]);
  return row ? pendingDraft(row) : null;
}

export async function readPersonalMemoryProcessing(db: Sql): Promise<PersonalMemoryProcessing> {
  const [row] = await db.all('SELECT enabled,policy_revision,cancel_generation FROM personal_memory_processing WHERE id=1');
  if (!row) throw Error('configuration');
  const teacherPolicy = await readTeacherMemoryPolicy(db);
  return {enabled:row.enabled===1, policyRevision:Number(row.policy_revision), cancelGeneration:Number(row.cancel_generation),
    teacherPolicyRevision:teacherPolicy.revision, pausedByUsePolicy:Object.keys(teacherPolicy.use).length>0};
}

/** Persistence for admitted drafts. Canonical source and target witnesses remain with the authorizing host. */
export function createPersonalMemoryCandidateState(sql: Sql, witnessCurrent: SourceWitnessReader) {
  function write<T>(action: (work: WritableSql) => Promise<T>) {
    if (!sql.transaction) throw Error('configuration');
    return sql.transaction(async work => {
      requireChanges(work);
      return action(work);
    });
  }

  const processing = (db = sql) => readPersonalMemoryProcessing(db);

  return {
    processing,
    async setEnabled(enabled: boolean, expectedRevision: number) {
      assertRevision(expectedRevision);
      if (typeof enabled !== 'boolean') throw Error('invalid_input');
      return write(async db => {
        const current = await processing(db);
        if (current.policyRevision !== expectedRevision) throw Error('revision_conflict');
        if (current.enabled === enabled) return current;
        await db.run(`UPDATE personal_memory_processing SET enabled=?,policy_revision=policy_revision+1,
          cancel_generation=cancel_generation+? WHERE id=1`, [enabled ? 1 : 0, enabled ? 0 : 1]);
        return processing(db);
      });
    },
    async savePending(drafts: readonly PersonalMemoryDraft[], expected: CandidateAuthority, taskCurrent?: (transaction: Sql) => Promise<boolean>,
      complete?: (transaction: Sql, receipt: CandidateWriteReceipt) => Promise<void>) {
      if (drafts.length > 20) throw Error('invalid_input');
      return write(async db => {
        const current = await processing(db);
        if (!current.enabled || current.pausedByUsePolicy || current.cancelGeneration !== expected.cancelGeneration) throw Error('cancelled');
        if (!sameCandidatePolicy(current,expected)) throw Error('stale_policy');
        if (taskCurrent && !await taskCurrent(db)) throw Error('stale_task');
        const saved: string[] = [];
        const stale: string[] = [];
        const conflicted: string[] = [];
        let repeated = 0;
        for (const draft of drafts) {
          if (draft.state !== 'pending' || !sameCandidatePolicy(draft.authority,current)
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
          const prior = await readPersonalMemoryDraft(db,draft.key);
          if (prior?.state === 'pending' && prior.draft.proposedValue !== draft.proposedValue) {
            await db.change("UPDATE personal_memory_pending SET state='conflict',revision=revision+1 WHERE draft_key=?",
              [draft.key]);
            conflicted.push(draft.key);
          } else repeated++;
        }
        const receipt = {saved, stale, conflicted, repeated};
        await complete?.(db,receipt);
        return receipt;
      });
    },
    async list(limit: number, onlyOpen = false) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw Error('invalid_input');
      return (await sql.all(`SELECT * FROM personal_memory_pending
        ${onlyOpen ? "WHERE state IN ('pending','conflict')" : ''}
        ORDER BY created_at DESC, draft_key LIMIT ?`,[limit])).map(pendingDraft);
    },
    async listForSession(sessionId: string) {
      return (await sql.all(`SELECT pending.* FROM personal_memory_pending pending
        JOIN memory_source_access source ON source.source_id=pending.source_id
        WHERE source.session_id=? AND pending.state IN ('pending','conflict')
        ORDER BY pending.created_at DESC, pending.draft_key LIMIT 40`,[sessionId])).map(pendingDraft);
    },
    async reject(key: string, expectedRevision: number) {
      assertRevision(expectedRevision);
      if (!/^[a-f0-9]{64}$/.test(key)) throw Error('invalid_input');
      return write(async db => {
        const changed = await db.change(`UPDATE personal_memory_pending SET state='rejected',revision=revision+1
          WHERE draft_key=? AND revision=? AND state IN ('pending','conflict')`, [key,expectedRevision]);
        if (changed !== 1) throw Error('revision_conflict');
        const [row] = await db.all('SELECT * FROM personal_memory_pending WHERE draft_key=?',[key]);
        return pendingDraft(row);
      });
    },
    invalidateSource:invalidatePersonalMemoryDrafts,
  };
}
