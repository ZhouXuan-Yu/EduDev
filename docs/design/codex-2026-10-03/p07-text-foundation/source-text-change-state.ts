import { createHash, randomUUID } from 'node:crypto';
import { generateDiffString, generateUnifiedPatch } from '@earendil-works/pi-coding-agent';
import type { Sql } from './session-state';
import type { XiaozhiChangeState, XiaozhiTextChange } from '../../shared/xiaozhi-changes';
import { changeText, MAX_CHANGE_DIFF_BYTES } from './text-edit-proposal';

export const changeHash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const states = new Set<XiaozhiChangeState>(['pending', 'approved', 'executing', 'applied', 'rejected', 'interrupted', 'uncertain', 'conflict', 'reverting', 'reverted', 'undo_uncertain', 'undo_conflict']);
export type PrivateTextChange = XiaozhiTextChange & { sessionId: string; workspaceHash: string;
  inputHash: string; before: Buffer | null; after: Buffer };
export function publicTextChange({ schemaVersion, id, runId, callId, path, operation, state, revision,
  beforeSha256, afterSha256, diff, patch }: PrivateTextChange): XiaozhiTextChange {
  return { schemaVersion, id, runId, callId, path, operation, state, revision, beforeSha256, afterSha256, diff, patch };
}
function parse(row: Record<string, unknown>): PrivateTextChange {
  if (Number(row.schema_version) !== 1 || !(row.after_bytes instanceof Uint8Array)
    || !(row.before_bytes === null || row.before_bytes instanceof Uint8Array)) throw new Error('configuration');
  const value: PrivateTextChange = { schemaVersion: 'xiaozhi.change.v1', id: String(row.id), sessionId: String(row.conversation_id),
    runId: String(row.run_id), callId: String(row.call_id), path: String(row.relative_path),
    operation: String(row.operation) as PrivateTextChange['operation'], state: String(row.state) as XiaozhiChangeState,
    revision: Number(row.revision), workspaceHash: String(row.workspace_hash), inputHash: String(row.input_hash),
    before: row.before_bytes === null ? null : Buffer.from(row.before_bytes), after: Buffer.from(row.after_bytes),
    beforeSha256: row.before_sha256 === null ? null : String(row.before_sha256), afterSha256: String(row.after_sha256),
    diff: String(row.diff), patch: String(row.patch) };
  if (!/^xichange_[a-f0-9-]{36}$/i.test(value.id) || !/^aisession_[a-f0-9-]{36}$/i.test(value.sessionId)
    || !value.runId || value.runId.length > 128 || !value.callId || value.callId.length > 128
    || !states.has(value.state) || !Number.isSafeInteger(value.revision) || value.revision < 0
    || !['edit', 'create'].includes(value.operation) || (value.operation === 'create') !== (value.before === null)
    || typeof row.relative_path !== 'string' || !value.path || value.path.length > 500
    || !hash(value.workspaceHash) || !hash(value.inputHash) || !hash(value.afterSha256)
    || changeHash(value.after) !== value.afterSha256
    || (value.before === null ? value.beforeSha256 !== null : !hash(value.beforeSha256) || changeHash(value.before) !== value.beforeSha256)
    || Buffer.byteLength(value.diff) > MAX_CHANGE_DIFF_BYTES || Buffer.byteLength(value.patch) > MAX_CHANGE_DIFF_BYTES) throw new Error('configuration');
  try { changeText(value.after); if (value.before) changeText(value.before); } catch { throw new Error('configuration'); }
  const beforeText = value.before?.toString('utf8') ?? '', afterText = value.after.toString('utf8');
  if (value.diff !== generateDiffString(beforeText, afterText).diff
    || value.patch !== generateUnifiedPatch(value.path, beforeText, afterText)) throw new Error('configuration');
  return value;
}

/** Local before/after ledger, no file operation and no cloud/provider request. */
export function createTextChangeState(sql: Sql) {
  const now = () => new Date().toISOString();
  async function get(id: string): Promise<PrivateTextChange | null> {
    const row = (await sql.all('SELECT * FROM xiaozhi_pi_text_changes WHERE id=?', [id]))[0];
    return row ? parse(row) : null;
  }
  async function call(sessionId: string, runId: string, callId: string): Promise<PrivateTextChange | null> {
    const row = (await sql.all('SELECT * FROM xiaozhi_pi_text_changes WHERE conversation_id=? AND run_id=? AND call_id=?', [sessionId, runId, callId]))[0];
    return row ? parse(row) : null;
  }
  return {
    get, call,
    async migrate() {
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_text_changes (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id),
        schema_version INTEGER NOT NULL CHECK(schema_version=1), run_id TEXT NOT NULL, call_id TEXT NOT NULL,
        workspace_hash TEXT NOT NULL, input_hash TEXT NOT NULL, relative_path TEXT NOT NULL,
        operation TEXT NOT NULL CHECK(operation IN ('create','edit')), before_bytes BLOB, after_bytes BLOB NOT NULL,
        before_sha256 TEXT, after_sha256 TEXT NOT NULL, diff TEXT NOT NULL, patch TEXT NOT NULL,
        state TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>=0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE(conversation_id,run_id,call_id),
        CHECK((operation='create' AND before_bytes IS NULL AND before_sha256 IS NULL) OR
          (operation='edit' AND before_bytes IS NOT NULL AND before_sha256 IS NOT NULL)),
        CHECK(length(after_bytes)<=65536 AND (before_bytes IS NULL OR length(before_bytes)<=65536)))`);
    },
    async create(input: Omit<PrivateTextChange, 'schemaVersion' | 'id' | 'state' | 'revision'>) {
      const previous = await call(input.sessionId, input.runId, input.callId);
      if (previous) { if (previous.inputHash !== input.inputHash || previous.workspaceHash !== input.workspaceHash) throw new Error('conflict'); return previous; }
      const id = `xichange_${randomUUID()}`;
      parse({ id, conversation_id: input.sessionId, schema_version: 1, run_id: input.runId, call_id: input.callId,
        relative_path: input.path, workspace_hash: input.workspaceHash, input_hash: input.inputHash,
        operation: input.operation, before_bytes: input.before, after_bytes: input.after, before_sha256: input.beforeSha256,
        after_sha256: input.afterSha256, diff: input.diff, patch: input.patch, state: 'pending', revision: 0 });
      if (!sql.change) throw new Error('configuration');
      const inserted = await sql.change(`INSERT OR IGNORE INTO xiaozhi_pi_text_changes
        (id,conversation_id,schema_version,run_id,call_id,workspace_hash,input_hash,relative_path,operation,
         before_bytes,after_bytes,before_sha256,after_sha256,diff,patch,state,revision,created_at,updated_at)
        SELECT ?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,'pending',0,?,?
        WHERE (SELECT count(*) FROM xiaozhi_pi_text_changes WHERE conversation_id=?)<256`,
        [id, input.sessionId, input.runId, input.callId, input.workspaceHash, input.inputHash, input.path, input.operation,
          input.before, input.after, input.beforeSha256, input.afterSha256, input.diff, input.patch, now(), now(), input.sessionId]);
      if (inserted !== 1) { const row = await call(input.sessionId, input.runId, input.callId); if (!row || row.inputHash !== input.inputHash || row.workspaceHash !== input.workspaceHash) throw new Error('conflict'); return row; }
      return (await get(id))!;
    },
    async transition(row: PrivateTextChange, from: XiaozhiChangeState[], to: XiaozhiChangeState) {
      if (!from.includes(row.state) || !states.has(to) || !sql.change) throw new Error('conflict');
      if (await sql.change(`UPDATE xiaozhi_pi_text_changes SET state=?,revision=revision+1,updated_at=?
        WHERE id=? AND conversation_id=? AND schema_version=1 AND state=? AND revision=?`,
        [to, now(), row.id, row.sessionId, row.state, row.revision]) !== 1) throw new Error('conflict');
      return (await get(row.id))!;
    },
    async list(sessionId: string) {
      return (await sql.all('SELECT * FROM xiaozhi_pi_text_changes WHERE conversation_id=? ORDER BY created_at,id', [sessionId])).map(parse);
    },
    async recover() {
      await sql.run(`UPDATE xiaozhi_pi_text_changes SET state=CASE
        WHEN state IN ('pending','approved') THEN 'interrupted' WHEN state='executing' THEN 'uncertain'
        WHEN state='reverting' THEN 'undo_uncertain' END, revision=revision+1,updated_at=?
        WHERE schema_version=1 AND state IN ('pending','approved','executing','reverting')`, [now()]);
    },
  };
}
