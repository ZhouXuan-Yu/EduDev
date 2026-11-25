import { createHash } from 'node:crypto';
import type { PersonalMemoryAdoptInput, PersonalMemoryEditInput, PersonalMemoryReceipt } from '../../../shared/xiaozhi-personal-memory';
import type { Sql } from '../../xiaozhi-agent/session-state';
import { sameCandidatePolicy, type PersonalMemoryDraft } from './candidate-admission';
import { readPersonalMemoryDraft, readPersonalMemoryProcessing } from './candidate-state';
import type { createPersonalMemorySourceAuthority } from './source-authority';

export const personalMemoryRecordSchema = `
CREATE TABLE personal_memory_records (
  memory_id TEXT PRIMARY KEY,
  current_revision INTEGER NOT NULL CHECK(current_revision>0)
);
CREATE TABLE personal_memory_versions (
  memory_id TEXT NOT NULL REFERENCES personal_memory_records(memory_id),
  revision INTEGER NOT NULL CHECK(revision>0),
  state TEXT NOT NULL CHECK(state IN ('active','disabled','forgotten')),
  value TEXT NOT NULL,
  draft_key TEXT NOT NULL REFERENCES personal_memory_pending(draft_key),
  source_occurred_at TEXT,
  operation TEXT NOT NULL CHECK(operation IN ('accept','edit','disable','restore','forget')),
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY(memory_id,revision)
);
CREATE TABLE personal_memory_receipts (
  operation_key TEXT PRIMARY KEY,
  request_digest TEXT NOT NULL CHECK(length(request_digest)=64),
  memory_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  FOREIGN KEY(memory_id,revision) REFERENCES personal_memory_versions(memory_id,revision)
);
CREATE TABLE personal_memory_outbox (
  memory_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('upsert','invalidate')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','acknowledged')),
  PRIMARY KEY(memory_id,revision),
  FOREIGN KEY(memory_id,revision) REFERENCES personal_memory_versions(memory_id,revision)
);
CREATE INDEX personal_memory_outbox_pending ON personal_memory_outbox(state,memory_id,revision);
CREATE TABLE personal_memory_catalog (
  memory_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  source_generation INTEGER NOT NULL,
  FOREIGN KEY(memory_id,revision) REFERENCES personal_memory_versions(memory_id,revision)
);
CREATE INDEX personal_memory_catalog_source ON personal_memory_catalog(source_id,source_generation);
CREATE TRIGGER personal_memory_catalog_authority_changed
AFTER UPDATE OF grant_revision,extract_allowed ON personal_memory_extract_grants
WHEN NEW.grant_revision<>OLD.grant_revision OR NEW.extract_allowed<>OLD.extract_allowed
BEGIN
  DELETE FROM personal_memory_catalog WHERE source_id=OLD.source_id AND source_generation<=OLD.grant_revision;
END;
`;

type SourceAuthority = Pick<ReturnType<typeof createPersonalMemorySourceAuthority>, 'witnessCurrent' | 'reviewQuote' | 'revokeWitness'>;
type MemoryVersion = {
  id: string;
  revision: number;
  state: 'active' | 'disabled' | 'forgotten';
  value: string;
  draftKey: string;
  sourceOccurredAt: string | null;
  recordedAt: number;
};
type WritableSql = Sql & { change: NonNullable<Sql['change']> };

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/;
const operationPattern = /^[a-zA-Z0-9_-]{16,120}$/;
const safeRevision = (value: number) => Number.isSafeInteger(value) && value > 0;

function version(row: Record<string, unknown>): MemoryVersion {
  const state = row.state;
  if (state !== 'active' && state !== 'disabled' && state !== 'forgotten') throw Error('configuration');
  return {id:String(row.memory_id),revision:Number(row.revision),state,value:String(row.value),
    draftKey:String(row.draft_key),sourceOccurredAt:typeof row.source_occurred_at === 'string' ? row.source_occurred_at : null,
    recordedAt:Number(row.recorded_at)};
}

async function head(db: Sql, id: string) {
  const [row] = await db.all(`SELECT v.* FROM personal_memory_records r
    JOIN personal_memory_versions v ON v.memory_id=r.memory_id AND v.revision=r.current_revision
    WHERE r.memory_id=?`,[id]);
  return row ? version(row) : null;
}

async function sourceDraft(db: Sql, record: MemoryVersion): Promise<PersonalMemoryDraft> {
  const row = await readPersonalMemoryDraft(db,record.draftKey);
  if (row?.state !== 'accepted') throw Error('configuration');
  return row.draft;
}

async function present(db: Sql, record: MemoryVersion, sources: SourceAuthority) {
  const draft = await sourceDraft(db,record);
  const sourceCurrent = record.state !== 'forgotten' && await sources.witnessCurrent(db,draft);
  const [onHold] = record.state === 'active' ? [] : await db.all(`SELECT 1 FROM personal_memory_outbox
    WHERE memory_id=? AND revision=? AND state='pending' AND action='invalidate'`,[record.id,record.revision]);
  return {...record, value:sourceCurrent ? record.value : '', sourceCurrent,
    kind:draft.kind, scope:draft.scope, term:draft.term, witness:draft.witness, cleanupPending:!!onHold};
}

export function createPersonalMemoryRecordState(sql: Sql, sources: SourceAuthority) {
  async function commit(operationId: string, request: readonly unknown[],
    apply: (db: WritableSql) => Promise<MemoryVersion>): Promise<PersonalMemoryReceipt> {
    if (!operationPattern.test(operationId)) throw Error('invalid_input');
    if (!sql.transaction) throw Error('configuration');
    const requestDigest = digest(JSON.stringify(request));
    return sql.transaction(async db => {
      if (!db.change) throw Error('configuration');
      const [prior] = await db.all('SELECT * FROM personal_memory_receipts WHERE operation_key=?',[operationId]);
      if (prior) {
        if (prior.request_digest !== requestDigest) throw Error('command_conflict');
        return {operationId,id:String(prior.memory_id),revision:Number(prior.revision)};
      }
      const next = await apply(db as WritableSql);
      await db.run('INSERT INTO personal_memory_receipts VALUES(?,?,?,?)',[operationId,requestDigest,next.id,next.revision]);
      await db.run('INSERT INTO personal_memory_outbox(memory_id,revision,action) VALUES(?,?,?)',
        [next.id,next.revision,next.state === 'active' ? 'upsert' : 'invalidate']);
      return {operationId,id:next.id,revision:next.revision};
    });
  }

  async function append(db: WritableSql, next: MemoryVersion, operation: 'accept' | PersonalMemoryEditInput['action']) {
    if (next.revision === 1) {
      const created = await db.change('INSERT INTO personal_memory_records VALUES(?,1) ON CONFLICT(memory_id) DO NOTHING',[next.id]);
      if (created !== 1) throw Error('revision_conflict');
    } else if (await db.change('UPDATE personal_memory_records SET current_revision=? WHERE memory_id=? AND current_revision=?',
      [next.revision,next.id,next.revision-1]) !== 1) throw Error('revision_conflict');
    await db.run('INSERT INTO personal_memory_versions VALUES(?,?,?,?,?,?,?,?)',
      [next.id,next.revision,next.state,next.value,next.draftKey,next.sourceOccurredAt,operation,next.recordedAt]);
    return next;
  }

  return {
    async preview(key: string, revision: number) {
      if (!hashPattern.test(key) || !safeRevision(revision)) throw Error('invalid_input');
      const row = await readPersonalMemoryDraft(sql,key);
      if (row?.state !== 'pending' || row.revision !== revision) throw Error('revision_conflict');
      const reviewed = await sources.reviewQuote(sql,row.draft);
      if (!reviewed) throw Error('source_changed');
      return {draft:row.draft,...reviewed,quoteSha256:digest(reviewed.quote)};
    },
    async accept(input: PersonalMemoryAdoptInput) {
      const {key,revision,targetRevision,reviewedQuoteSha256} = input;
      if (!hashPattern.test(key) || !safeRevision(revision) || (targetRevision !== 0 && !safeRevision(targetRevision)) ||
          !hashPattern.test(reviewedQuoteSha256)) throw Error('invalid_input');
      return commit(input.operationId,['accept',key,revision,targetRevision,reviewedQuoteSha256],async db => {
        const row = await readPersonalMemoryDraft(db,key);
        if (row?.state !== 'pending' || row.revision !== revision) throw Error('revision_conflict');
        const {draft} = row;
        const policy = await readPersonalMemoryProcessing(db);
        if (!policy.enabled || policy.pausedByUsePolicy || policy.cancelGeneration !== draft.authority.cancelGeneration)
          throw Error('cancelled');
        if (!sameCandidatePolicy(policy,draft.authority)) throw Error('stale_policy');
        const reviewed = await sources.reviewQuote(db,draft);
        if (!reviewed || digest(reviewed.quote) !== reviewedQuoteSha256) throw Error('source_changed');

        if (targetRevision !== (draft.replaces?.revision ?? 0)) throw Error('revision_conflict');
        if (draft.replaces) {
          const prior = await head(db,draft.replaces.id);
          if (prior?.state !== 'active' || prior.revision !== draft.replaces.revision) throw Error('revision_conflict');
          const target = await sourceDraft(db,prior);
          if (target.kind !== draft.kind || target.term !== draft.term ||
              target.scope.id !== draft.scope.id || target.scope.kind !== draft.scope.kind) throw Error('invalid_target');
        }
        const id = draft.replaces?.id ?? key;
        const next: MemoryVersion = {id,revision:targetRevision+1,state:'active',value:draft.proposedValue,
          draftKey:key,sourceOccurredAt:reviewed.occurredAt,recordedAt:Date.now()};
        await append(db,next,'accept');
        const decided = await db.change(`UPDATE personal_memory_pending SET state='accepted',revision=revision+1
          WHERE draft_key=? AND revision=? AND state='pending'`,[key,revision]);
        if (decided !== 1) throw Error('revision_conflict');
        return next;
      });
    },
    async edit(input: PersonalMemoryEditInput) {
      const {id,revision,action} = input;
      if (!hashPattern.test(id) || !safeRevision(revision) || !['edit','disable','restore','forget'].includes(action))
        throw Error('invalid_input');
      const value = action === 'edit' && typeof input.value === 'string' ? input.value.trim() : '';
      if (action === 'edit' && (!value || value.length > 320 || /[\u0000-\u001f\u007f]/u.test(value))) throw Error('invalid_input');
      return commit(input.operationId,[action,id,revision,value],async db => {
        const record = await head(db,id);
        if (!record || record.revision !== revision || record.state === 'forgotten' ||
            (action === 'restore' && record.state !== 'disabled') ||
            ((action === 'edit' || action === 'disable') && record.state !== 'active')) throw Error('revision_conflict');
        if ((action === 'edit' || action === 'restore') && !await sources.witnessCurrent(db,await sourceDraft(db,record)))
          throw Error('source_changed');
        if (action === 'forget') {
          const witnesses = await db.all(`SELECT DISTINCT p.source_id,p.source_generation
            FROM personal_memory_versions v JOIN personal_memory_pending p ON p.draft_key=v.draft_key
            WHERE v.memory_id=?`,[id]);
          for (const {source_id,source_generation} of witnesses) {
            await sources.revokeWitness(db,String(source_id),Number(source_generation));
          }
        }
        const state = action === 'forget' ? 'forgotten' : action === 'disable' ? 'disabled' : 'active';
        const nextValue = action === 'forget' ? '' : action === 'edit' ? value : record.value;
        return append(db,{...record,revision:revision+1,state,value:nextValue,
          recordedAt:Date.now()},action);
      });
    },
    async read(id: string) {
      if (!hashPattern.test(id)) throw Error('invalid_input');
      const read = async (db: Sql) => {
        const record = await head(db,id);
        return record ? present(db,record,sources) : null;
      };
      return sql.readTransaction ? sql.readTransaction(read) : read(sql);
    },
    async previewRecord(id: string, revision: number) {
      if (!hashPattern.test(id) || !safeRevision(revision)) throw Error('invalid_input');
      const read = async (db: Sql) => {
        const record = await head(db,id);
        if (!record || record.revision !== revision || record.state === 'forgotten') throw Error('revision_conflict');
        const reviewed = await sources.reviewQuote(db,await sourceDraft(db,record));
        if (!reviewed) throw Error('source_changed');
        return {...reviewed,quoteSha256:digest(reviewed.quote)};
      };
      return sql.readTransaction ? sql.readTransaction(read) : read(sql);
    },
    async list(limit: number) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw Error('invalid_input');
      const read = async (db: Sql) => {
        const rows = await db.all(`SELECT v.* FROM personal_memory_records r
          JOIN personal_memory_versions v ON v.memory_id=r.memory_id AND v.revision=r.current_revision
          ORDER BY v.recorded_at DESC,v.memory_id LIMIT ?`,[limit]);
        return Promise.all(rows.map(row=>present(db,version(row),sources)));
      };
      return sql.readTransaction ? sql.readTransaction(read) : read(sql);
    },
    async reconcile(limit = 20) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw Error('invalid_input');
      if (!sql.transaction) throw Error('configuration');
      return sql.transaction(async db=>{
        const pending=await db.all(`SELECT memory_id,revision,action FROM personal_memory_outbox
          WHERE state='pending' ORDER BY memory_id,revision LIMIT ?`,[limit]);
        for (const row of pending) {
          const id=String(row.memory_id), revision=Number(row.revision);
          const current=await head(db,id);
          const draft=row.action==='upsert' && current?.state==='active' && current.revision===revision
            ? await sourceDraft(db,current) : null;
          if (draft && await sources.witnessCurrent(db,draft)) {
            await db.run(`INSERT INTO personal_memory_catalog VALUES(?,?,?,?)
              ON CONFLICT(memory_id) DO UPDATE SET revision=excluded.revision,source_id=excluded.source_id,
                source_generation=excluded.source_generation WHERE personal_memory_catalog.revision<excluded.revision`,
            [id,revision,draft.witness.sourceId,draft.witness.generation]);
          } else {
            await db.run('DELETE FROM personal_memory_catalog WHERE memory_id=? AND revision<=?',[id,revision]);
          }
          await db.run(`UPDATE personal_memory_outbox SET state='acknowledged'
            WHERE memory_id=? AND revision=? AND state='pending'`,[id,revision]);
        }
        return pending.length;
      });
    },
  };
}
