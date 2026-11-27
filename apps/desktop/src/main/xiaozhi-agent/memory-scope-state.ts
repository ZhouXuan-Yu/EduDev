import {createReferenceReceipts,referenceReceiptSchema} from './memory-use/receipts';
import type { Sql } from './session-state';
import { validTeachingTarget, type MemoryTeachingTarget, type XiaozhiMemoryUseSelection } from '../../shared/xiaozhi-memory';
import { memorySelectionKey, validMemorySelection, validMemorySession, validMemoryUseSelection } from './memory-selection';

export type PrivateMemorySelection = XiaozhiMemoryUseSelection & { fingerprint: string };
export type PrivateMemoryScope = { version: number; teachingTarget?: MemoryTeachingTarget; enabled: boolean; selections: PrivateMemorySelection[] };
function validPayload(value: unknown, schema: number): value is Omit<PrivateMemoryScope, 'version'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Omit<PrivateMemoryScope, 'version'>;
  return Object.keys(item).every(key => key === 'enabled' || key === 'selections' || key === 'teachingTarget')
    && (!('teachingTarget' in item) || schema === 4 && validTeachingTarget(item.teachingTarget)) && typeof item.enabled === 'boolean'
    && Array.isArray(item.selections) && item.selections.length <= 12
    && item.selections.every(entry=>schema===1 ? validMemorySelection(entry,true)
      : validMemoryUseSelection(entry,true) && (schema>=3 || entry.layer!=='personal'))
    && new Set(item.selections.map(memorySelectionKey)).size === item.selections.length;
}
export async function currentTeachingTarget(sql: Sql, sessionId: string) {
  const saved = await createPiMemoryScopeState(sql).memoryScope(sessionId);
  if (!saved.teachingTarget) return null;
  const [current] = await sql.all(`SELECT f.id FROM ai_conversation_sessions s JOIN ai_conversation_folders f ON f.id=s.folder_id
    WHERE s.id=? AND f.id=? AND s.archived_at IS NULL AND COALESCE(s.student_id,'')='' AND f.archived_at IS NULL`,
    [sessionId,saved.teachingTarget.folderId]);
  return current ? {...saved.teachingTarget,version:saved.version} : null;
}
export function createPiMemoryScopeState(sql: Sql) {
  return {
    ...createReferenceReceipts(sql),
    async migrateMemoryScope() {
      await sql.run(referenceReceiptSchema);
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_memory_scopes (
        conversation_id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES ai_conversation_sessions(id))`);
      // A round trip to another teaching space must not resurrect previously selected sources.
      if (!(await sql.all('PRAGMA table_info(ai_conversation_sessions)')).some(column=>column.name==='folder_id')) return;
      await sql.run(`CREATE TRIGGER IF NOT EXISTS xiaozhi_memory_class_departure
        AFTER UPDATE OF folder_id, archived_at, student_id ON ai_conversation_sessions
        WHEN OLD.folder_id IS NOT NEW.folder_id OR NEW.archived_at IS NOT NULL OR COALESCE(NEW.student_id,'')<>''
        BEGIN
          UPDATE xiaozhi_pi_memory_scopes SET schema_version=3,payload_json='{"enabled":false,"selections":[]}',
            version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE conversation_id=NEW.id AND schema_version=4 AND json_type(payload_json,'$.teachingTarget')='object';
        END`);
    },
    async memoryScope(id: string): Promise<PrivateMemoryScope> {
      if (!validMemorySession(id)) throw new Error('invalid_input');
      const row = (await sql.all('SELECT * FROM xiaozhi_pi_memory_scopes WHERE conversation_id=?', [id]))[0];
      if (!row) return { version: 0, enabled: false, selections: [] };
      const value: unknown = JSON.parse(String(row.payload_json));
      const schema=Number(row.schema_version);
      if (![1,2,3,4].includes(schema) || !Number.isSafeInteger(row.version) || Number(row.version) < 1 || !validPayload(value,schema)) throw new Error('configuration');
      return { version: Number(row.version), ...value };
    },
    async saveMemoryScope(id: string, version: number, value: Pick<PrivateMemoryScope, 'enabled' | 'selections'>, teachingTarget?: MemoryTeachingTarget | null): Promise<boolean> {
      if (!validMemorySession(id) || !Number.isSafeInteger(version) || version < 0 || !validPayload(value,3)
          || teachingTarget !== undefined && (value.enabled || value.selections.length > 0 || teachingTarget !== null && !validTeachingTarget(teachingTarget))) throw new Error('invalid_input');
      if (!sql.change) throw new Error('configuration');
      // Read rejects unknown schema even if an old expected version is supplied.
      const previous = await this.memoryScope(id);
      if (version !== previous.version) return false;
      const target = teachingTarget === undefined ? previous.teachingTarget : teachingTarget;
      const payload = JSON.stringify(target ? {...value,teachingTarget:target} : value);
      const timestamp = new Date().toISOString();
      const schema = target ? 4 : value.selections.some(item=>item.layer==='personal') ? 3 : value.selections.some(item=>item.layer==='history') ? 2 : 1;
      const targetCheck = target ? `EXISTS (SELECT 1 FROM ai_conversation_sessions s
        JOIN ai_conversation_folders f ON f.id=s.folder_id WHERE s.id=? AND f.id=?
        AND COALESCE(s.student_id,'')='' AND s.archived_at IS NULL AND f.archived_at IS NULL)` : '1';
      const targetArgs = target ? [id,target.folderId] : [];
      if (version === 0) return (await sql.change(`INSERT OR IGNORE INTO xiaozhi_pi_memory_scopes
        (conversation_id,schema_version,version,payload_json,updated_at) SELECT ?,?,1,?,? WHERE ${targetCheck}`,
        [id,schema,payload,timestamp,...targetArgs])) === 1;
      return (await sql.change(`UPDATE xiaozhi_pi_memory_scopes SET version=version+1,schema_version=MAX(CASE WHEN schema_version=4 THEN 3 ELSE schema_version END,?),payload_json=?,updated_at=?
        WHERE conversation_id=? AND schema_version IN (1,2,3,4) AND version=? AND ${targetCheck}`,
        [schema,payload,timestamp,id,version,...targetArgs])) === 1;
    },
  };
}
