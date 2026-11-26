import type { Sql } from './session-state';
import type { XiaozhiMemoryUseSelection } from '../../shared/xiaozhi-memory';
import { memorySelectionKey, validMemorySelection, validMemorySession, validMemoryUseSelection } from './memory-selection';

export type PrivateMemorySelection = XiaozhiMemoryUseSelection & { fingerprint: string };
export type PrivateMemoryScope = { version: number; enabled: boolean; selections: PrivateMemorySelection[] };
function validPayload(value: unknown, schema: number): value is Omit<PrivateMemoryScope, 'version'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Omit<PrivateMemoryScope, 'version'>;
  return Object.keys(item).length === 2 && typeof item.enabled === 'boolean'
    && Array.isArray(item.selections) && item.selections.length <= 12
    && item.selections.every(entry=>schema===1 ? validMemorySelection(entry,true)
      : validMemoryUseSelection(entry,true) && (schema===3 || entry.layer!=='personal'))
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
      const schema=Number(row.schema_version);
      if (![1,2,3].includes(schema) || !Number.isSafeInteger(row.version) || Number(row.version) < 1 || !validPayload(value,schema)) throw new Error('configuration');
      return { version: Number(row.version), ...value };
    },
    async saveMemoryScope(id: string, version: number, value: Omit<PrivateMemoryScope, 'version'>): Promise<boolean> {
      if (!validMemorySession(id) || !Number.isSafeInteger(version) || version < 0 || !validPayload(value,3)) throw new Error('invalid_input');
      if (!sql.change) throw new Error('configuration');
      // Read rejects unknown schema even if an old expected version is supplied.
      await this.memoryScope(id);
      const payload = JSON.stringify(value), timestamp = new Date().toISOString();
      const schema = value.selections.some(item=>item.layer==='personal') ? 3 : value.selections.some(item=>item.layer==='history') ? 2 : 1;
      if (version === 0) return (await sql.change(`INSERT OR IGNORE INTO xiaozhi_pi_memory_scopes
        (conversation_id,schema_version,version,payload_json,updated_at) VALUES(?,?,1,?,?)`, [id,schema,payload,timestamp])) === 1;
      return (await sql.change(`UPDATE xiaozhi_pi_memory_scopes SET version=version+1,schema_version=MAX(schema_version,?),payload_json=?,updated_at=?
        WHERE conversation_id=? AND schema_version IN (1,2,3) AND version=?`, [schema,payload,timestamp,id,version])) === 1;
    },
  };
}
