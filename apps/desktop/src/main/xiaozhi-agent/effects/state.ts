import {protocolHash as hash} from '../capabilities/validation';
import type {Sql} from '../session-state';
import type {EffectAuthority, EffectIntent, EffectRecord, EffectState, EffectExecution, EffectOutcome, EffectProof} from './types';

const states = new Set<EffectState>(['intent', 'executing', 'committed', 'failed', 'unknown', 'reconciled', 'compensated']);
const transitions: Record<EffectState, readonly EffectState[]> = {
  intent: ['executing', 'failed', 'unknown'],
  executing: ['committed', 'failed', 'unknown'],
  committed: ['reconciled', 'compensated'],
  failed: ['reconciled'],
  unknown: ['reconciled', 'failed', 'compensated'],
  reconciled: ['compensated'],
  compensated: [],
};
const bounded = (value: unknown, maximum: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= maximum && !value.includes('\0');
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const natural = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const contractIdentity = (record: EffectRecord | EffectIntent) => ({...record.contract, grantRefs: [], authorityRefs: []});
function identity(record: EffectRecord | EffectIntent) {
  return {owner: record.owner, callId: record.callId, commandId: record.commandId, tool: record.tool,
    operation: record.operation, idempotencyKey: record.idempotencyKey, receipt: record.receipt,
    contract: contractIdentity(record), target: record.target, targetVersion: record.targetVersion};
}
function validIntent(value: EffectIntent) {
  if (!value || !bounded(value.owner?.sessionId, 160) || !bounded(value.owner.taskId, 160)
      || !bounded(value.owner.runId, 160) || !natural(value.owner.generation) || value.owner.generation < 1
      || ![value.callId, value.commandId, value.tool, value.operation, value.idempotencyKey, value.receipt?.runId, value.receipt?.callId].every(item => bounded(item, 256))
      || value.contract?.schemaVersion !== 1 || value.contract.taskId !== value.owner.taskId
      || ![value.contract.inputDigest, value.contract.sourceHash, value.contract.providerHash, value.contract.schemaHash].every(digest)
      || value.target !== null && !bounded(value.target, 2048) || value.targetVersion !== null && !bounded(value.targetVersion, 256)) throw Error('invalid_input');
}
function decode(raw: unknown): EffectRecord {
  const record = JSON.parse(String(raw)) as EffectRecord;
  validIntent(record);
  if (record.schemaVersion !== 1 || record.id !== 'xieffect_' + hash([record.owner.sessionId, record.owner.taskId, record.idempotencyKey])
      || !natural(record.revision) || record.revision < 1 || !states.has(record.state)
      || !Array.isArray(record.proofs) || record.proofs.length > 64 || !Number.isFinite(Date.parse(record.createdAt))
      || !Number.isFinite(Date.parse(record.updatedAt))) throw Error('effect_corrupt');
  return record;
}

/** Effect rows are attached to the original receipt and share its SQLite transaction lane. */
export function createEffectState(sql: Sql, options: {
  assertJob?: (work: Sql, authority: Extract<EffectAuthority, {kind: 'job'}>, record: EffectRecord | EffectIntent) => Promise<void>;
} = {}) {
  async function transaction<T>(action: (work: Sql) => Promise<T>) {
    if (!sql.transaction) throw Error('effect_transaction_required');
    return sql.transaction(action);
  }
  async function assert(work: Sql, authority: EffectAuthority, record: EffectRecord | EffectIntent, reconciliation = false) {
    if (authority.kind === 'job') {
      if (!options.assertJob) throw Error('permission_denied');
      await options.assertJob(work, authority, record);
      return;
    }
    if (authority.kind === 'recovery') {
      if (!reconciliation || authority.sessionId !== record.owner.sessionId || authority.taskId !== record.owner.taskId) throw Error('permission_denied');
      const row = (await work.all('SELECT status FROM xiaozhi_event_runs WHERE run_id=? AND session_id=? AND generation=?',
        [record.owner.runId, record.owner.sessionId, record.owner.generation]))[0];
      if (!row || row.status === 'running') throw Error('event_owner_stale');
      return;
    }
    if (hash(authority.owner) !== hash(record.owner)) throw Error('event_owner_stale');
    const row = (await work.all(`SELECT r.status FROM xiaozhi_event_owners o JOIN xiaozhi_event_runs r
      ON r.run_id=o.run_id AND r.generation=o.generation WHERE o.session_id=? AND o.run_id=? AND o.generation=?`,
    [record.owner.sessionId, record.owner.runId, record.owner.generation]))[0];
    if (!row || row.status !== 'running') throw Error('event_owner_stale');
    const taskRow = (await work.all('SELECT value_json FROM app_settings WHERE key=?', ['xiaozhi.task.v1:' + record.owner.taskId]))[0];
    const task = taskRow ? JSON.parse(String(taskRow.value_json)) : null;
    const taskOwner = task?.view.binding || task?.eventOwner || task?.lineage?.at(-1);
    if (!task || task.view.id !== record.owner.taskId || task.view.sessionId !== record.owner.sessionId
        || task.view.requirementsVersion !== record.contract.requirementsVersion
        || taskOwner?.runId !== record.owner.runId || taskOwner.generation !== record.owner.generation
        || !('state' in record) && task.view.state !== 'active') throw Error('task_owner_stale');
  }
  async function get(work: Sql, id: string) {
    const row = (await work.all('SELECT document_json FROM xiaozhi_effects_v1 WHERE effect_id=?', [id]))[0];
    return row ? decode(row.document_json) : null;
  }
  async function save(work: Sql, previous: EffectRecord, next: EffectRecord) {
    if (!work.change) throw Error('effect_transaction_required');
    next.revision = previous.revision + 1;
    next.updatedAt = new Date().toISOString();
    const encoded = JSON.stringify(next);
    if (Buffer.byteLength(encoded) > 65536) throw Error('effect_bounds');
    decode(encoded);
    const changed = await work.change(`UPDATE xiaozhi_effects_v1 SET revision=?,state=?,document_json=?,updated_at=?
      WHERE effect_id=? AND revision=? AND document_json=?`,
    [next.revision, next.state, encoded, next.updatedAt, previous.id, previous.revision, JSON.stringify(previous)]);
    if (changed !== 1) throw Error('effect_revision_conflict');
    return structuredClone(next);
  }
  return {
    async migrate() {
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_effects_v1(
        effect_id TEXT PRIMARY KEY,schema_version INTEGER NOT NULL DEFAULT 1,session_id TEXT NOT NULL,task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,generation INTEGER NOT NULL,call_id TEXT NOT NULL,command_id TEXT NOT NULL,operation TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,receipt_run_id TEXT NOT NULL,receipt_call_id TEXT NOT NULL,
        revision INTEGER NOT NULL,state TEXT NOT NULL,document_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
        UNIQUE(session_id,task_id,idempotency_key),FOREIGN KEY(receipt_run_id,receipt_call_id) REFERENCES xiaozhi_tool_receipts(run_id,call_id))`);
      await sql.run('CREATE INDEX IF NOT EXISTS xiaozhi_effects_task_v1 ON xiaozhi_effects_v1(session_id,task_id,state)');
      await sql.run('CREATE INDEX IF NOT EXISTS xiaozhi_effects_call_v1 ON xiaozhi_effects_v1(run_id,call_id,operation)');
    },
    get: (id: string) => get(sql, id),
    async byCommand(sessionId: string, jobId: string, commandId: string) {
      const rows = await sql.all('SELECT document_json FROM xiaozhi_effects_v1 WHERE session_id=? AND command_id=? ORDER BY created_at', [sessionId, commandId]);
      return rows.map(row => decode(row.document_json)).find(record => record.target === jobId && record.operation !== 'tool') || null;
    },
    async forTask(sessionId: string, taskId: string) {
      return (await sql.all('SELECT document_json FROM xiaozhi_effects_v1 WHERE session_id=? AND task_id=? ORDER BY created_at,effect_id LIMIT 1024',
        [sessionId, taskId])).map(row => decode(row.document_json));
    },
    async byCall(runId: string, callId: string) {
      const row = (await sql.all("SELECT document_json FROM xiaozhi_effects_v1 WHERE run_id=? AND call_id=? AND operation='tool'", [runId, callId]))[0];
      return row ? decode(row.document_json) : null;
    },
    intent(input: EffectIntent, authority: EffectAuthority) {
      validIntent(input);
      return transaction(async work => {
        await assert(work, authority, input);
        const id = 'xieffect_' + hash([input.owner.sessionId, input.owner.taskId, input.idempotencyKey]);
        const previous = await get(work, id);
        if (previous) {
          if (hash(identity(previous)) !== hash(identity(input))) throw Error('effect_idempotency_conflict');
          if (JSON.stringify(previous.contract) === JSON.stringify(input.contract)) return {record: previous, created: false};
          const next = {...structuredClone(previous), contract: structuredClone(input.contract)};
          return {record: await save(work, previous, next), created: false};
        }
        const receipt = (await work.all('SELECT admitted FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?', [input.receipt.runId, input.receipt.callId]))[0];
        if (!receipt || receipt.admitted !== 1) throw Error('tool_receipt_conflict');
        const stamp = new Date().toISOString();
        const record: EffectRecord = {...structuredClone(input), schemaVersion: 1, id, revision: 1, state: 'intent',
          execution: null, outcome: null, proofs: [], createdAt: stamp, updatedAt: stamp};
        const encoded = JSON.stringify(record);
        if (Buffer.byteLength(encoded) > 65536) throw Error('effect_bounds');
        await work.run(`INSERT INTO xiaozhi_effects_v1(effect_id,session_id,task_id,run_id,generation,call_id,command_id,operation,
          idempotency_key,receipt_run_id,receipt_call_id,revision,state,document_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, input.owner.sessionId, input.owner.taskId, input.owner.runId, input.owner.generation, input.callId, input.commandId, input.operation,
          input.idempotencyKey, input.receipt.runId, input.receipt.callId, 1, 'intent', encoded, stamp, stamp]);
        return {record, created: true};
      });
    },
    transition(id: string, expectedRevision: number, state: EffectState, authority: EffectAuthority,
      patch: {execution?: EffectExecution; outcome?: EffectOutcome; proofs?: EffectProof[]} = {}) {
      return transaction(async work => {
        const previous = await get(work, id);
        if (!previous || previous.revision !== expectedRevision) throw Error('effect_revision_conflict');
        const reconciliation = authority.kind === 'recovery';
        await assert(work, authority, previous, reconciliation);
        if (!transitions[previous.state].includes(state)) throw Error('effect_transition_conflict');
        if (reconciliation && !['unknown', 'failed', 'reconciled', 'compensated'].includes(state)) throw Error('permission_denied');
        if (['committed', 'reconciled', 'compensated'].includes(state) && !patch.proofs?.length) throw Error('effect_readback_required');
        if (patch.proofs && (patch.proofs.length > 64 || patch.proofs.some(proof => !bounded(proof.reference, 2048) || !digest(proof.digest)))) throw Error('invalid_input');
        if (patch.outcome && (!digest(patch.outcome.digest) || patch.outcome.references.length > 128
            || patch.outcome.references.some(value => !bounded(value, 2048)))) throw Error('invalid_input');
        if (patch.execution && (!bounded(patch.execution.id, 256) || patch.execution.inputSequence !== undefined && !natural(patch.execution.inputSequence))) throw Error('invalid_input');
        return save(work, previous, {...structuredClone(previous), ...structuredClone(patch), state});
      });
    },
    updateExecution(id: string, expectedRevision: number, execution: EffectExecution, authority: EffectAuthority) {
      return transaction(async work => {
        const previous = await get(work, id);
        if (!previous || previous.revision !== expectedRevision || previous.state !== 'executing') throw Error('effect_revision_conflict');
        await assert(work, authority, previous);
        if (!bounded(execution.id, 256)) throw Error('invalid_input');
        return save(work, previous, {...structuredClone(previous), execution: structuredClone(execution)});
      });
    },
  };
}
