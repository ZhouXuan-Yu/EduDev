import type { Sql } from './session-state';
import type { XiaozhiMemorySelection } from '../../shared/xiaozhi-memory';
import { memorySelectionKey, validMemorySelection, validMemorySession } from './memory-selection';

export type PrivateMemorySelection = XiaozhiMemorySelection & { fingerprint: string };
export type PrivateMemoryScope = { version: number; enabled: boolean; selections: PrivateMemorySelection[] };
function validPayload(value: unknown): value is Omit<PrivateMemoryScope, 'version'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Omit<PrivateMemoryScope, 'version'>;
  return Object.keys(item).length === 2 && typeof item.enabled === 'boolean'
    && Array.isArray(item.selections) && item.selections.length <= 12
    && item.selections.every(entry => validMemorySelection(entry, true))
    && new Set(item.selections.map(memorySelectionKey)).size === item.selections.length;
}
export function createPiMemoryScopeState(sql: Sql) {
  return {
    async migrateMemoryScope() {
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_memory_scopes (
        conversation_id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES ai_conversation_sessions(id))`);
    },
    async memoryScope(id: string): Promise<PrivateMemoryScope> {
      if (!validMemorySession(id)) throw new Error('invalid_input');
      const row = (await sql.all('SELECT * FROM xiaozhi_pi_memory_scopes WHERE conversation_id=?', [id]))[0];
      if (!row) return { version: 0, enabled: false, selections: [] };
      const value: unknown = JSON.parse(String(row.payload_json));
      if (Number(row.schema_version) !== 1 || !Number.isSafeInteger(row.version) || Number(row.version) < 1 || !validPayload(value)) throw new Error('configuration');
      return { version: Number(row.version), ...value };
    },
    async saveMemoryScope(id: string, version: number, value: Omit<PrivateMemoryScope, 'version'>): Promise<boolean> {
      if (!validMemorySession(id) || !Number.isSafeInteger(version) || version < 0 || !validPayload(value)) throw new Error('invalid_input');
      if (!sql.change) throw new Error('configuration');
      // Read rejects unknown schema even if an old expected version is supplied.
      await this.memoryScope(id);
      const payload = JSON.stringify(value), timestamp = new Date().toISOString();
      if (version === 0) return (await sql.change(`INSERT OR IGNORE INTO xiaozhi_pi_memory_scopes
        (conversation_id,version,payload_json,updated_at) VALUES(?,1,?,?)`, [id, payload, timestamp])) === 1;
      return (await sql.change(`UPDATE xiaozhi_pi_memory_scopes SET version=version+1,payload_json=?,updated_at=?
        WHERE conversation_id=? AND schema_version=1 AND version=?`, [payload, timestamp, id, version])) === 1;
    },
  };
}
