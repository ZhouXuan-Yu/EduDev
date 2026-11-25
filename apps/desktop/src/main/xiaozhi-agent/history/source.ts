import type { HistorySourceRef } from '../../../shared/xiaozhi-history-memory';
import { createPiControlState } from '../control-state';
import { validMemorySession } from '../memory-selection';
import { teacherRequestSourceVersion } from '../request-sources';
import type { Sql } from '../session-state';

const versionPattern = /^[a-f0-9]{64}$/;
export const historyRecordId = /^[a-z0-9_-]{1,180}$/i;

export function validHistoryRef(value: unknown): value is HistorySourceRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = value as HistorySourceRef;
  return Object.keys(ref).length === 4 && (ref.kind === 'history_request' || ref.kind === 'history_control')
    && validMemorySession(ref.sessionId) && typeof ref.recordId === 'string' && historyRecordId.test(ref.recordId)
    && typeof ref.sourceVersion === 'string' && versionPattern.test(ref.sourceVersion);
}

/** Read the exact authorized source using the calling SQLite connection and transaction. */
export async function readHistorySource(db: Sql, ref: HistorySourceRef) {
  if (!validHistoryRef(ref)) throw Error('invalid_input');
  const isControl = ref.kind === 'history_control';
  const control = isControl ? await createPiControlState(db).control(ref.recordId) : null;
  if (isControl && (!control || control.sessionId !== ref.sessionId)) throw Error('source_unavailable');

  const metadata = "CASE WHEN json_valid(m.metadata_json) THEN m.metadata_json ELSE '{}' END";
  const [anchor] = await db.all(`
    SELECT m.content, s.title, ${metadata} AS metadata_json
    FROM ai_conversation_messages m JOIN ai_conversation_sessions s ON s.id=m.session_id
    WHERE m.session_id=? AND m.role='user' AND COALESCE(s.archived_at,'')='' AND COALESCE(s.student_id,'')=''
      AND json_extract(${metadata}, '$.piVersion')='xiaozhi.pi.education.v1'
      AND ${control ? `json_extract(${metadata}, '$.agentRunId')=?` : 'm.id=?'}
    ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1
  `, [ref.sessionId, control?.runId ?? ref.recordId]);
  if (!anchor) throw Error('source_unavailable');

  let text = String(anchor.content);
  let teacherText = text;
  let label: '教师原话' | '教师补答' | '已生效的追加要求' = '教师原话';
  if (control) {
    if (control.kind === 'instruction' && control.state === 'applied') {
      text = teacherText = control.text;
      label = '已生效的追加要求';
    } else if (control.kind === 'question' && control.state === 'answered' && typeof control.answer === 'string') {
      teacherText = control.answer;
      text = `问题：${control.text}\n教师回答：${teacherText}`;
      label = '教师补答';
    } else {
      throw Error('source_unavailable');
    }
  }
  const messageMetadata = JSON.parse(String(anchor.metadata_json)) as {agentRunId?:unknown} | null;
  const runId = control?.runId ?? String(messageMetadata?.agentRunId);
  if (teacherRequestSourceVersion(ref.recordId, runId, text, control?.revision) !== ref.sourceVersion) throw Error('source_changed');
  return {ref, title:String(anchor.title ?? '新对话').slice(0,80), label, text, teacherText, runId};
}
