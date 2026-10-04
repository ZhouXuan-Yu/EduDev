import { randomUUID } from 'node:crypto';
import type { Sql } from './session-state';

export type ModelIdentity = { sessionId: string; sessionFile: string; nativeSessionId: string;
  originModel: string; model: string; revision: number };
export type ModelTransition = ModelIdentity & { id: string; target: string;
  status: 'prepared' | 'committed' | 'aborted'; modelEntryId: string | null; receiptEntryId: string | null };
const model = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(v);
const uuid = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const revision = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < Number.MAX_SAFE_INTEGER;
const entryId = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{8}$/i.test(v);
export function validModelIdentity(v: ModelIdentity) {
  const file = typeof v.sessionFile === 'string' ? v.sessionFile.replace(/\\/g,'/') : '';
  return /^aisession_/.test(v.sessionId) && uuid(v.sessionId.slice(10)) && uuid(v.nativeSessionId)
    && model(v.originModel) && model(v.model) && revision(v.revision)
    && /^aisession_[a-f0-9-]{36}\/sessions\/[^/\\\x00-\x1f]+\.jsonl$/i.test(file)
    && file.startsWith(v.sessionId + '/sessions/')
    && !v.sessionFile.includes('..');
}
function identity(row: Record<string, unknown>): ModelIdentity {
  const value = { sessionId: String(row.conversation_id), sessionFile: String(row.session_file),
    nativeSessionId: String(row.native_session_id), originModel: String(row.origin_model),
    model: String(row.current_model ?? row.source_model), revision: Number(row.revision ?? row.expected_revision) };
  if (Number(row.schema_version) !== 1 || !validModelIdentity(value)) throw new Error('configuration');
  return value;
}
function transition(row: Record<string, unknown>): ModelTransition {
  const value = { ...identity(row), id: String(row.id), target: String(row.target_model),
    status: String(row.status) as ModelTransition['status'],
    modelEntryId: row.model_entry_id === null ? null : String(row.model_entry_id),
    receiptEntryId: row.receipt_entry_id === null ? null : String(row.receipt_entry_id) };
  if (!value.id.startsWith('ximodel_') || !uuid(value.id.slice(8)) || !model(value.target) || value.target === value.model
    || !['prepared','committed','aborted'].includes(value.status)
    || (value.status === 'committed' ? !entryId(value.modelEntryId) || !entryId(value.receiptEntryId)
      : value.modelEntryId !== null || value.receiptEntryId !== null)) throw new Error('configuration');
  return value;
}
/** Main-private durable intent. The commit trigger owns both sources in one SQLite statement. */
export function createModelSwitchState(sql: Sql) {
  const changed = async (query: string, values: (string | number | null)[]) => {
    if (!sql.change || await sql.change(query, values) !== 1) throw new Error('conflict');
  };
  const now = () => new Date().toISOString();
  async function current(id: string): Promise<ModelIdentity | null> {
    const row = (await sql.all('SELECT * FROM xiaozhi_pi_model_state WHERE conversation_id=?', [id]))[0];
    if (!row) return null;
    const value = identity(row);
    const binding = (await sql.all('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?', [id]))[0];
    if (!binding || ![1,2,3,4,5].includes(Number(binding.schema_version))
      || binding.session_file !== value.sessionFile || binding.model !== value.model) throw new Error('configuration');
    return value;
  }
  async function transitions(id: string): Promise<ModelTransition[]> {
    return (await sql.all('SELECT * FROM xiaozhi_pi_model_transitions WHERE conversation_id=? ORDER BY expected_revision,id', [id])).map(transition);
  }
  return {
    current, transitions,
    async baseline(id: string): Promise<string[]> {
      const row=(await sql.all('SELECT baseline_entries_json FROM xiaozhi_pi_model_state WHERE conversation_id=?',[id]))[0];
      if (!row) return [];
      let ids: unknown; try { ids=JSON.parse(String(row.baseline_entries_json)); } catch { throw new Error('configuration'); }
      if (!Array.isArray(ids) || ids.length>4096 || !ids.every(entryId) || new Set(ids).size!==ids.length) throw new Error('configuration');
      return ids;
    },
    async migrate() {
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_model_state (
        conversation_id TEXT PRIMARY KEY REFERENCES ai_conversation_sessions(id), schema_version INTEGER NOT NULL CHECK(schema_version=1),
        revision INTEGER NOT NULL CHECK(revision>=0), origin_model TEXT NOT NULL, current_model TEXT NOT NULL,
        native_session_id TEXT NOT NULL, session_file TEXT NOT NULL, updated_at TEXT NOT NULL,
        baseline_entries_json TEXT NOT NULL DEFAULT '[]')`);
      if (!(await sql.all('PRAGMA table_info(xiaozhi_pi_model_state)')).some(row=>row.name==='baseline_entries_json'))
        await sql.run("ALTER TABLE xiaozhi_pi_model_state ADD COLUMN baseline_entries_json TEXT NOT NULL DEFAULT '[]'");
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_model_transitions (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES xiaozhi_pi_model_state(conversation_id),
        schema_version INTEGER NOT NULL CHECK(schema_version=1), expected_revision INTEGER NOT NULL CHECK(expected_revision>=0),
        origin_model TEXT NOT NULL, source_model TEXT NOT NULL, target_model TEXT NOT NULL CHECK(target_model<>source_model),
        native_session_id TEXT NOT NULL, session_file TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('prepared','committed','aborted')),
        model_entry_id TEXT, receipt_entry_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        CHECK((status='committed' AND model_entry_id IS NOT NULL AND receipt_entry_id IS NOT NULL)
          OR (status<>'committed' AND model_entry_id IS NULL AND receipt_entry_id IS NULL)))`);
      await sql.run(`CREATE UNIQUE INDEX IF NOT EXISTS xiaozhi_pi_model_one_prepared
        ON xiaozhi_pi_model_transitions(conversation_id) WHERE status='prepared'`);
      await sql.run(`CREATE TRIGGER IF NOT EXISTS xiaozhi_pi_model_commit AFTER UPDATE OF status ON xiaozhi_pi_model_transitions
        WHEN OLD.status='prepared' AND NEW.status='committed' BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ai_conversation_sessions WHERE id=NEW.conversation_id AND archived_at IS NULL)
          THEN RAISE(ABORT,'model switch archived') END;
        UPDATE xiaozhi_pi_model_state SET current_model=NEW.target_model,revision=revision+1,updated_at=NEW.updated_at
          WHERE conversation_id=NEW.conversation_id AND schema_version=1 AND revision=NEW.expected_revision
            AND current_model=NEW.source_model AND origin_model=NEW.origin_model
            AND native_session_id=NEW.native_session_id AND session_file=NEW.session_file;
        SELECT CASE WHEN changes()<>1 THEN RAISE(ABORT,'model switch ledger conflict') END;
        UPDATE xiaozhi_pi_session_bindings SET model=NEW.target_model,schema_version=5,updated_at=NEW.updated_at
          WHERE conversation_id=NEW.conversation_id AND schema_version IN (1,2,3,4,5)
            AND model=NEW.source_model AND session_file=NEW.session_file;
        SELECT CASE WHEN changes()<>1 THEN RAISE(ABORT,'model switch binding conflict') END;
        END`);
    },
    async seed(value: ModelIdentity, baseline: string[] = []) {
      if (!validModelIdentity(value) || value.originModel !== value.model) throw new Error('configuration');
      if (baseline.length>4096 || !baseline.every(entryId) || new Set(baseline).size!==baseline.length) throw new Error('configuration');
      await sql.run(`INSERT OR IGNORE INTO xiaozhi_pi_model_state
        (conversation_id,schema_version,revision,origin_model,current_model,native_session_id,session_file,updated_at,baseline_entries_json)
        SELECT ?,1,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM xiaozhi_pi_session_bindings b
          JOIN ai_conversation_sessions c ON c.id=b.conversation_id WHERE b.conversation_id=?
          AND b.schema_version IN (1,2,3,4) AND b.model=? AND b.session_file=? AND c.archived_at IS NULL)`,
      [value.sessionId,value.revision,value.originModel,value.model,value.nativeSessionId,value.sessionFile,now(),JSON.stringify(baseline),
        value.sessionId,value.model,value.sessionFile]);
      const saved = await current(value.sessionId);
      if (!saved || JSON.stringify(saved) !== JSON.stringify(value)) throw new Error('conflict');
      return saved;
    },
    async prepare(value: ModelIdentity, target: string): Promise<ModelTransition> {
      if (!validModelIdentity(value) || !model(target) || value.model === target) throw new Error('invalid_input');
      const id = 'ximodel_' + randomUUID(), timestamp = now();
      try { await changed(`INSERT INTO xiaozhi_pi_model_transitions
        (id,conversation_id,schema_version,expected_revision,origin_model,source_model,target_model,native_session_id,session_file,status,created_at,updated_at)
        SELECT ?,conversation_id,1,revision,origin_model,current_model,?,native_session_id,session_file,'prepared',?,?
        FROM xiaozhi_pi_model_state WHERE conversation_id=? AND schema_version=1 AND revision=? AND origin_model=?
          AND current_model=? AND native_session_id=? AND session_file=?
          AND EXISTS(SELECT 1 FROM ai_conversation_sessions WHERE id=? AND archived_at IS NULL)
          AND EXISTS(SELECT 1 FROM xiaozhi_pi_session_bindings WHERE conversation_id=? AND model=? AND session_file=? AND schema_version IN (1,2,3,4,5))`,
      [id,target,timestamp,timestamp,value.sessionId,value.revision,value.originModel,value.model,value.nativeSessionId,value.sessionFile,
        value.sessionId,value.sessionId,value.model,value.sessionFile]); }
      catch { throw new Error('conflict'); }
      return transition((await sql.all('SELECT * FROM xiaozhi_pi_model_transitions WHERE id=?', [id]))[0]);
    },
    async commit(value: ModelTransition, modelEntryId: string, receiptEntryId: string) {
      if (!entryId(modelEntryId) || !entryId(receiptEntryId) || modelEntryId === receiptEntryId) throw new Error('configuration');
      const rows = await transitions(value.sessionId), saved = rows.find(item => item.id === value.id);
      if (!saved || JSON.stringify({ ...saved, status: 'prepared', modelEntryId: null, receiptEntryId: null })
        !== JSON.stringify({ ...value, status: 'prepared', modelEntryId: null, receiptEntryId: null })) throw new Error('conflict');
      if (saved.status === 'committed') {
        if (saved.modelEntryId !== modelEntryId || saved.receiptEntryId !== receiptEntryId) throw new Error('conflict');
        return;
      }
      try { await changed(`UPDATE xiaozhi_pi_model_transitions SET status='committed',model_entry_id=?,receipt_entry_id=?,updated_at=?
        WHERE id=? AND status='prepared'`, [modelEntryId,receiptEntryId,now(),value.id]); }
      catch { throw new Error('conflict'); }
    },
    async abort(value: ModelTransition) {
      const saved = (await transitions(value.sessionId)).find(item => item.id === value.id);
      if (!saved || saved.status === 'committed' || JSON.stringify({ ...saved, status: 'prepared' })
        !== JSON.stringify({ ...value, status: 'prepared' })) throw new Error('conflict');
      if (saved.status === 'aborted') return;
      await changed("UPDATE xiaozhi_pi_model_transitions SET status='aborted',updated_at=? WHERE id=? AND status='prepared'", [now(),value.id]);
    },
  };
}
