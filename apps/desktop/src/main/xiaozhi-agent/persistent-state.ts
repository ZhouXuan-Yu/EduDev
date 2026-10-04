import { randomUUID } from 'node:crypto';
import type { Sql } from './session-state';
import type { XiaozhiApproval, XiaozhiApprovalState } from '../../shared/xiaozhi-agent';
import type { OfficeCopyApproval } from '../../shared/office-tools';

export type PrivateApproval = XiaozhiApproval & { sessionId: string; sourceSha256: string; workspaceHash: string; schemaVersion: 1 };
const time = () => new Date().toISOString();
const action = 'pi_office_copy';
const states = new Set<XiaozhiApprovalState>(['pending', 'approved', 'executing', 'executed', 'rejected', 'interrupted', 'uncertain', 'verified', 'failed']);
export const publicApproval = ({ id, runId, callId, source, target, state }: PrivateApproval): XiaozhiApproval => ({ id, runId, callId, source, target, state });
function parse(row: Record<string, unknown>): PrivateApproval {
  const value = JSON.parse(String(row.payload_json));
  if (value.schemaVersion !== 1 || !states.has(value.state) || !/^[a-f0-9]{64}$/.test(value.sourceSha256)
    || !/^[a-f0-9]{64}$/.test(value.workspaceHash) || typeof value.callId !== 'string' || value.callId.length > 128
    || typeof value.source !== 'string' || value.source.length > 500 || typeof value.target !== 'string' || value.target.length > 500) throw new Error('configuration');
  return { ...value, id: String(row.id), sessionId: String(row.session_id), runId: String(row.run_id) };
}
/** SQLite is the command/approval truth; SDK history stays in SessionManager. */
export function createPiPersistentState(sql: Sql) {
  const update = async (query: string, args: (string | number)[]) => {
    if (!sql.change) throw new Error('configuration');
    return (await sql.change(query, args)) === 1;
  };
  const getApproval = async (id: string) => {
    const row = (await sql.all('SELECT * FROM ai_confirmation_items WHERE id=? AND action_type=?', [id, action]))[0];
    return row ? parse(row) : null;
  };
  const transition = async (id: string, from: XiaozhiApprovalState[], to: XiaozhiApprovalState) => {
    const row = await getApproval(id); if (!row || !from.includes(row.state)) return false;
    const payload = { ...row, state: to };
    const status = ['pending'].includes(to) ? 'pending' : ['approved', 'executing', 'executed', 'verified'].includes(to) ? 'confirmed' : to === 'rejected' ? 'rejected' : 'failed';
    return update(`UPDATE ai_confirmation_items SET payload_json=?,status=?,updated_at=? WHERE id=? AND action_type=? AND json_extract(payload_json,'$.state')=?`,
      [JSON.stringify(payload), status, time(), id, action, row.state]);
  };
  return {
    async migrate() {
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_commands (
        command_id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL DEFAULT 1, conversation_id TEXT NOT NULL,
        request_hash TEXT NOT NULL, run_id TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES ai_conversation_sessions(id))`);
      await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_workspaces (
        conversation_id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL DEFAULT 1, path TEXT NOT NULL,
        label TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES ai_conversation_sessions(id))`);
      await sql.run(`CREATE UNIQUE INDEX IF NOT EXISTS pi_copy_call_identity ON ai_confirmation_items(session_id,run_id,json_extract(payload_json,'$.callId')) WHERE action_type='pi_office_copy'`);
    },
    async recover() {
      await sql.run("UPDATE xiaozhi_pi_commands SET status='interrupted',updated_at=? WHERE schema_version=1 AND status IN ('starting','running')", [time()]);
      const rows = await sql.all('SELECT * FROM ai_confirmation_items WHERE action_type=?', [action]);
      for (const value of rows) {
        let row: PrivateApproval;
        try { row = parse(value); } catch { continue; } // Unknown/corrupt authority never becomes an executable grant.
        if (row.state === 'executing') await transition(row.id, ['executing'], 'uncertain');
        else if (row.state === 'pending' || row.state === 'approved') await transition(row.id, [row.state], 'interrupted');
      }
    },
    async command(id: string) {
      const row = (await sql.all('SELECT * FROM xiaozhi_pi_commands WHERE command_id=?', [id]))[0];
      if (row && Number(row.schema_version) !== 1) throw new Error('configuration');
      return row;
    },
    async claimCommand(id: string, conversation: string, hash: string) {
      return update("INSERT OR IGNORE INTO xiaozhi_pi_commands(command_id,conversation_id,request_hash,status,created_at,updated_at) VALUES(?,?,?,'starting',?,?)", [id, conversation, hash, time(), time()]);
    },
    async bindCommand(id: string, run: string) {
      if (!await update("UPDATE xiaozhi_pi_commands SET run_id=?,status='running',updated_at=? WHERE command_id=? AND status='starting' AND run_id=''", [run, time(), id])) throw new Error('configuration');
    },
    async finishCommand(id: string) { await sql.run("UPDATE xiaozhi_pi_commands SET status='finished',updated_at=? WHERE command_id=?", [time(), id]); },
    async interruptedSend(session: string) {
      return (await sql.all(`SELECT 1 FROM xiaozhi_pi_commands c WHERE c.conversation_id=? AND c.schema_version=1 AND c.status='interrupted'
        AND NOT EXISTS(SELECT 1 FROM ai_conversation_messages m WHERE m.session_id=c.conversation_id AND m.role='user' AND json_extract(m.metadata_json,'$.agentRunId')=c.run_id) LIMIT 1`, [session])).length > 0;
    },
    async workspace(id: string) {
      const row = (await sql.all('SELECT * FROM xiaozhi_pi_workspaces WHERE conversation_id=?', [id]))[0];
      if (row && Number(row.schema_version) !== 1) throw new Error('configuration');
      return row ? { path: String(row.path), label: String(row.label) } : null;
    },
    async setWorkspace(id: string, path: string, label: string) {
      await sql.run(`INSERT INTO xiaozhi_pi_workspaces(conversation_id,path,label,updated_at) VALUES(?,?,?,?)
        ON CONFLICT(conversation_id) DO UPDATE SET path=excluded.path,label=excluded.label,updated_at=excluded.updated_at`, [id, path, label, time()]);
    },
    getApproval, transition,
    async approvals(session: string) {
      return (await sql.all('SELECT * FROM ai_confirmation_items WHERE action_type=? AND session_id=? ORDER BY created_at', [action, session])).map(parse);
    },
    async createApproval(sessionId: string, runId: string, input: OfficeCopyApproval, workspaceHash: string) {
      const existing = (await sql.all("SELECT * FROM ai_confirmation_items WHERE action_type=? AND session_id=? AND run_id=? AND json_extract(payload_json,'$.callId')=?", [action, sessionId, runId, input.callId]))[0];
      if (existing) {
        const item = parse(existing);
        if (item.source !== input.source || item.target !== input.target || item.sourceSha256 !== input.sourceSha256 || item.workspaceHash !== workspaceHash) throw new Error('command_conflict');
        return item;
      }
      const item: PrivateApproval = { id: `confirm_${randomUUID()}`, sessionId, runId, callId: input.callId, source: input.source, target: input.target,
        sourceSha256: input.sourceSha256, workspaceHash, schemaVersion: 1, state: 'pending' };
      await sql.run(`INSERT INTO ai_confirmation_items(id,run_id,session_id,action_type,status,title,description,preview_md,payload_json,created_at,updated_at)
        VALUES(?,?,?,?,'pending','复制教学资料','','',?,?,?)`, [item.id, runId, sessionId, action, JSON.stringify(item), time(), time()]);
      return item;
    },
    async invalidate(run: string) {
      const rows = (await sql.all('SELECT * FROM ai_confirmation_items WHERE action_type=? AND run_id=?', [action, run])).map(parse);
      for (const row of rows) if (row.state === 'pending' || row.state === 'approved') await transition(row.id, [row.state], 'interrupted');
    },
  };
}
