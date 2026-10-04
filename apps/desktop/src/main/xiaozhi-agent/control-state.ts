import type { Sql } from './session-state';
import type { XiaozhiControl } from '../../shared/xiaozhi-agent';

export type PrivateControl = XiaozhiControl & { sessionId: string; callId?: string; requestHash?: string };
export const publicControl = ({ id, runId, kind, state, text, revision, steps, options, answer, mode, canResume, callId }: PrivateControl): XiaozhiControl =>
  ({ id, runId, kind, state, text, ...(kind === 'instruction' ? {revision:revision ?? 0} : {}), ...(steps ? { steps } : {}), ...(options ? { options } : {}), ...(answer !== undefined ? { answer } : {}), ...(mode ? { mode } : {}), ...(canResume ? { canResume:true } : {}), ...(callId ? {callId} : {}) });
const time = () => new Date().toISOString();
function parse(row: Record<string, unknown>): PrivateControl {
  const value = JSON.parse(String(row.payload_json));
  const version = Number(row.schema_version);
  if (version !== 1 && !(version === 2 && value.kind === 'instruction')) throw new Error('configuration');
  if (!['plan', 'question', 'instruction'].includes(value.kind) || !['pending','answered','queued','dispatching','withdrawn','applied','interrupted','resuming'].includes(value.state)
    || (version === 1 && ['dispatching','withdrawn'].includes(value.state))
    || (value.revision !== undefined && (!Number.isSafeInteger(value.revision) || value.revision < 0))
    || typeof value.text !== 'string' || value.text.length > 8192) throw new Error('configuration');
  return { ...value, id: String(row.id), sessionId: String(row.conversation_id), runId: String(row.run_id) };
}
export function createPiControlState(sql: Sql) {
  const control = async (id: string) => {
    const row = (await sql.all('SELECT * FROM xiaozhi_pi_controls WHERE id=?', [id]))[0]; return row ? parse(row) : null;
  };
  const changeControl = async (id: string, from: XiaozhiControl['state'][], patch: Partial<Pick<PrivateControl, 'state' | 'answer' | 'canResume' | 'revision' | 'text' | 'mode'>>, revision?: number) => {
    const row = (await sql.all('SELECT * FROM xiaozhi_pi_controls WHERE id=?', [id]))[0];
    const item = row ? parse(row) : null;
    if (!item || !from.includes(item.state) || !sql.change || (revision !== undefined && (item.revision ?? 0) !== revision)) return false;
    return (await sql.change(`UPDATE xiaozhi_pi_controls SET payload_json=?,state=?,updated_at=?,schema_version=? WHERE id=? AND schema_version IN (1,2) AND state=? AND payload_json=?`,
      [JSON.stringify({ ...item, ...patch }), patch.state || item.state, time(), item.kind === 'instruction' ? 2 : 1, id, item.state, String(row.payload_json)])) === 1;
  };
  return {
    async migrateControls() {
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_controls(id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL DEFAULT 1,
        conversation_id TEXT NOT NULL,run_id TEXT NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL,payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(conversation_id) REFERENCES ai_conversation_sessions(id))`);
      await sql.run('CREATE INDEX IF NOT EXISTS pi_controls_session ON xiaozhi_pi_controls(conversation_id,created_at)');
    },
    async recoverControls() {
      const rows = await sql.all("SELECT * FROM xiaozhi_pi_controls WHERE state IN ('pending','queued','dispatching','resuming') AND schema_version IN (1,2)");
      for (const row of rows) {
        let item: PrivateControl; try { item = parse(row); } catch { continue; }
        await changeControl(item.id, [item.state], { state: 'interrupted', canResume:item.kind === 'question' });
      }
    },
    control, changeControl,
    async controls(sessionId: string) { return (await sql.all('SELECT * FROM xiaozhi_pi_controls WHERE conversation_id=? ORDER BY created_at,rowid', [sessionId])).map(parse); },
    async putControl(item: PrivateControl) {
      if (!sql.change) throw new Error('configuration');
      return (await sql.change(`INSERT OR IGNORE INTO xiaozhi_pi_controls(id,schema_version,conversation_id,run_id,kind,state,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`,
        [item.id,item.kind === 'instruction' ? 2 : 1,item.sessionId,item.runId,item.kind,item.state,JSON.stringify(item),time(),time()])) === 1;
    },
    async replacePlan(item: PrivateControl) {
      const prior = await control(item.id);
      if (prior && (prior.sessionId !== item.sessionId || prior.runId !== item.runId || prior.kind !== 'plan')) throw new Error('permission_denied');
      if (!prior) { await this.putControl(item); return; }
      await sql.run('UPDATE xiaozhi_pi_controls SET payload_json=?,state=?,updated_at=? WHERE id=? AND schema_version=1', [JSON.stringify(item),item.state,time(),item.id]);
    },
  };
}
