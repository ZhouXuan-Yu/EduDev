import { createHash, randomUUID } from 'node:crypto';
import { generateDiffString, generateUnifiedPatch } from '@earendil-works/pi-coding-agent';
import type { Sql } from './session-state';
import type { XiaozhiChangeState, XiaozhiTextChange, XiaozhiChangeSummary } from '../../shared/xiaozhi-changes';
import { changeText, MAX_CHANGE_DIFF_BYTES } from './text-edit-proposal';
import { HTML_ARTIFACT_PREFIX } from '../../shared/html-artifact';

export const changeHash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const states = new Set<XiaozhiChangeState>(['pending', 'approved', 'executing', 'applied', 'rejected', 'interrupted', 'uncertain', 'conflict', 'reverting', 'reverted', 'undo_uncertain', 'undo_conflict']);
export type PrivateTextChange = XiaozhiTextChange & { sessionId: string; workspaceHash: string;
  inputHash: string; before: Buffer | null; after: Buffer; parentChangeId?: string | null };
export type TextVersionRecord = {id:string;path:string;workspaceHash:string;parentChangeId:string|null;operation:string;state:XiaozhiChangeState;beforeSha256:string|null;afterSha256:string;proposedAt:string;savedAt:string|null;verifiedAt:string|null;callId:string;runId:string;size:number;htmlArtifact:number};
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
    diff: String(row.diff), patch: String(row.patch), parentChangeId: row.parent_change_id == null ? null : String(row.parent_change_id) };
  if (!/^xichange_[a-f0-9-]{36}$/i.test(value.id) || !/^aisession_[a-f0-9-]{36}$/i.test(value.sessionId)
    || !value.runId || value.runId.length > 128 || !value.callId || value.callId.length > 128
    || (value.parentChangeId != null && !/^xichange_[a-f0-9-]{36}$/i.test(value.parentChangeId))
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
      const columns = new Set((await sql.all('PRAGMA table_info(xiaozhi_pi_text_changes)')).map(row => row.name));
      for (const column of ['parent_change_id', 'saved_at', 'verified_at']) if (!columns.has(column)) {
        await sql.run(`ALTER TABLE xiaozhi_pi_text_changes ADD COLUMN ${column} TEXT`);
      }
    },
    async create(input: Omit<PrivateTextChange, 'schemaVersion' | 'id' | 'state' | 'revision'>) {
      const previous = await call(input.sessionId, input.runId, input.callId);
      if (previous) { if (previous.inputHash !== input.inputHash || previous.workspaceHash !== input.workspaceHash) throw new Error('conflict'); return previous; }
      const id = `xichange_${randomUUID()}`;
      parse({ id, conversation_id: input.sessionId, schema_version: 1, run_id: input.runId, call_id: input.callId,
        relative_path: input.path, workspace_hash: input.workspaceHash, input_hash: input.inputHash,
        operation: input.operation, before_bytes: input.before, after_bytes: input.after, before_sha256: input.beforeSha256,
        after_sha256: input.afterSha256, diff: input.diff, patch: input.patch, parent_change_id: input.parentChangeId, state: 'pending', revision: 0 });
      if (!sql.change) throw new Error('configuration');
      const inserted = await sql.change(`INSERT OR IGNORE INTO xiaozhi_pi_text_changes
        (id,conversation_id,schema_version,run_id,call_id,workspace_hash,input_hash,relative_path,operation,
         before_bytes,after_bytes,before_sha256,after_sha256,diff,patch,state,revision,created_at,updated_at,parent_change_id)
        SELECT ?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,'pending',0,?,?,?
        WHERE (SELECT count(*) FROM xiaozhi_pi_text_changes WHERE conversation_id=?)<256`,
        [id, input.sessionId, input.runId, input.callId, input.workspaceHash, input.inputHash, input.path, input.operation,
          input.before, input.after, input.beforeSha256, input.afterSha256, input.diff, input.patch, now(), now(), input.parentChangeId ?? null, input.sessionId]);
      if (inserted !== 1) { const row = await call(input.sessionId, input.runId, input.callId); if (!row || row.inputHash !== input.inputHash || row.workspaceHash !== input.workspaceHash) throw new Error('conflict'); return row; }
      return (await get(id))!;
    },
    async transition(row: PrivateTextChange, from: XiaozhiChangeState[], to: XiaozhiChangeState) {
      if (!from.includes(row.state) || !states.has(to) || !sql.change) throw new Error('conflict');
      const stamp = now();
      if (await sql.change(`UPDATE xiaozhi_pi_text_changes SET state=?,revision=revision+1,updated_at=?,
        saved_at=CASE WHEN ?='executing' AND ?='applied' THEN COALESCE(saved_at,?) ELSE saved_at END,
        verified_at=CASE WHEN ? IN ('uncertain','undo_uncertain') AND ?='applied' THEN ? ELSE verified_at END
        WHERE id=? AND conversation_id=? AND schema_version=1 AND state=? AND revision=?`,
        [to, stamp, row.state, to, stamp, row.state, to, stamp, row.id, row.sessionId, row.state, row.revision]) !== 1) throw new Error('conflict');
      return (await get(row.id))!;
    },
    async list(sessionId: string, runId?: string) {
      return (await sql.all('SELECT * FROM xiaozhi_pi_text_changes WHERE conversation_id=?'+(runId===undefined?'':' AND run_id=?')+' ORDER BY created_at,'+(runId===undefined?'id':'rowid'), runId===undefined?[sessionId]:[sessionId,runId])).map(parse);
    },
    async versionRecords(sessionId:string):Promise<TextVersionRecord[]> {
      return await sql.all(`SELECT id,relative_path AS path,workspace_hash AS workspaceHash,parent_change_id AS parentChangeId,
        operation,state,before_sha256 AS beforeSha256,after_sha256 AS afterSha256,created_at AS proposedAt,saved_at AS savedAt,verified_at AS verifiedAt,
        call_id AS callId,run_id AS runId,length(after_bytes) AS size,substr(after_bytes,1,?)=? AS htmlArtifact
        FROM xiaozhi_pi_text_changes WHERE conversation_id=? ORDER BY created_at,rowid`,[Buffer.byteLength(HTML_ARTIFACT_PREFIX),Buffer.from(HTML_ARTIFACT_PREFIX),sessionId]) as TextVersionRecord[];
    },
    async catalogSeeds(sessionId?:string):Promise<{id:string;sessionId:string}[]> {
      return await sql.all(`SELECT id,conversation_id AS sessionId FROM xiaozhi_pi_text_changes
        WHERE state IN ('applied','reverted') AND lower(relative_path) LIKE '%.html' AND substr(after_bytes,1,?)=?
        ${sessionId ? 'AND conversation_id=?' : ''}
        ORDER BY COALESCE(saved_at,verified_at,created_at) DESC,rowid DESC LIMIT 100`,
        [Buffer.byteLength(HTML_ARTIFACT_PREFIX),Buffer.from(HTML_ARTIFACT_PREFIX),...(sessionId?[sessionId]:[])]) as {id:string;sessionId:string}[];
    },
    async invalidateRun(runId: string) {
      await sql.run(`UPDATE xiaozhi_pi_text_changes SET state='interrupted',revision=revision+1,updated_at=?
        WHERE schema_version=1 AND run_id=? AND state IN ('pending','approved')`, [now(), runId]);
    },
    async recover() {
      await sql.run(`UPDATE xiaozhi_pi_text_changes SET state=CASE
        WHEN state IN ('pending','approved') THEN 'interrupted' WHEN state='executing' THEN 'uncertain'
        WHEN state='reverting' THEN 'undo_uncertain' END, revision=revision+1,updated_at=?
        WHERE schema_version=1 AND state IN ('pending','approved','executing','reverting')`, [now()]);
    },
  };
}

/** Only facts, never original file bytes or differences, enter event snapshots. */
export function changeSummary(value: XiaozhiTextChange): XiaozhiChangeSummary {
  const { schemaVersion, id, runId, callId, path, operation, state, revision, beforeSha256, afterSha256 } = value;
  return { schemaVersion, id, runId, callId, path, operation, state, revision, beforeSha256, afterSha256 };
}
