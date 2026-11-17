import type {Sql} from '../session-state';
import type {TaskView, TaskOwner} from '../../../shared/xiaozhi-task';
import {protocolHash} from '../capabilities/validation';
import {createPiBudgetState, DEFAULT_PI_BUDGET} from '../budget-state';

export type TaskCheckpointRef = {schemaVersion: 1; id: string; taskRevision: number; digest: string};
export type TaskCheckpoint = {
  schemaVersion: 1;
  id: string;
  task: TaskView;
  owner: TaskOwner;
  journalCursor: {runId: string; generation: number; sequence: number} | null;
  effects: {id: string; revision: number; state: string}[];
  snapshots: string[];
  approvals: {id: string; revision: number; state: string}[];
  remainingBudget: {modelCalls: number; toolCalls: number; tokens: number; activeMs: number; waitingMs: number; usageRecorded: boolean};
  reason: string;
  createdAt: string;
};

/** The immutable checkpoint is committed beside the original Task revision and Journal task event. */
export async function writeTaskCheckpoint(work: Sql, task: TaskView, owner: TaskOwner): Promise<TaskCheckpointRef> {
  if (!work.change) throw Error('task_transaction_required');
  const tables = new Set((await work.all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('xiaozhi_effects_v1','xiaozhi_capability_snapshots_v1','xiaozhi_event_runs','xiaozhi_pi_usage','xiaozhi_pi_budget_settings','ai_confirmation_items')"))
    .map(row => String(row.name)));
  const effects = tables.has('xiaozhi_effects_v1')
    ? (await work.all('SELECT effect_id,revision,state FROM xiaozhi_effects_v1 WHERE session_id=? AND task_id=? ORDER BY created_at,effect_id LIMIT 1024', [task.sessionId, task.id]))
      .map(row => ({id: String(row.effect_id), revision: Number(row.revision), state: String(row.state)})) : [];
  const snapshots = tables.has('xiaozhi_capability_snapshots_v1')
    ? (await work.all('SELECT snapshot_id FROM xiaozhi_capability_snapshots_v1 WHERE session_id=? AND task_id=? ORDER BY rowid LIMIT 1024', [task.sessionId, task.id]))
      .map(row => String(row.snapshot_id)) : [];
  const approvals = tables.has('ai_confirmation_items')
    ? (await work.all("SELECT id,payload_json FROM ai_confirmation_items WHERE session_id=? AND action_type='xiaozhi_permission_v2' AND json_extract(payload_json,'$.request.owner.taskId')=? ORDER BY rowid LIMIT 1024", [task.sessionId, task.id]))
      .map(row => {const value = JSON.parse(String(row.payload_json)); return {id: String(row.id), revision: Number(value.revision), state: String(value.state)};}) : [];
  const journal = tables.has('xiaozhi_event_runs')
    ? (await work.all('SELECT sequence FROM xiaozhi_event_runs WHERE session_id=? AND run_id=? AND generation=?', [owner.sessionId, owner.runId, owner.generation]))[0] : undefined;
  const budgetState = createPiBudgetState(work);
  const budget = tables.has('xiaozhi_pi_budget_settings') ? (await budgetState.budgetSettings(task.sessionId)).budget : DEFAULT_PI_BUDGET;
  const usage = tables.has('xiaozhi_pi_usage') ? await budgetState.usageForRun(task.sessionId, owner.runId) : undefined;
  const checkpoint: TaskCheckpoint = {
    schemaVersion: 1, id: 'xitcp_' + protocolHash([task.id, task.revision]), task: structuredClone(task), owner: structuredClone(owner),
    journalCursor: journal ? {runId: owner.runId, generation: owner.generation, sequence: Number(journal.sequence) + 1} : null,
    effects, snapshots, approvals,
    remainingBudget: {modelCalls: Math.max(0, budget.maxModelCalls - (usage?.modelCalls || 0)),
      toolCalls: Math.max(0, budget.maxToolCalls - (usage?.toolCalls || 0)), tokens: Math.max(0, budget.maxTokens - (usage?.tokens?.total || 0)),
      activeMs: Math.max(0, budget.activeMs - (usage?.activeMs || 0)), waitingMs: Math.max(0, budget.waitMs - (usage?.waitingMs || 0)), usageRecorded: !!usage},
    reason: task.state + ':' + task.planRevision, createdAt: task.updatedAt,
  };
  const raw = JSON.stringify(checkpoint);
  if (Buffer.byteLength(raw) > 512 * 1024) throw Error('task_checkpoint_bounds');
  if (await work.change('INSERT OR IGNORE INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',
    ['xiaozhi.checkpoint.v1:' + checkpoint.id, raw, checkpoint.createdAt]) !== 1) throw Error('task_checkpoint_conflict');
  return {schemaVersion: 1, id: checkpoint.id, taskRevision: task.revision, digest: protocolHash(checkpoint)};
}

export async function readTaskCheckpoint(work: Sql, taskId: string, reference: TaskCheckpointRef): Promise<TaskCheckpoint> {
  const row = (await work.all('SELECT value_json FROM app_settings WHERE key=?', ['xiaozhi.checkpoint.v1:' + reference.id]))[0];
  if (!row) throw Error('task_checkpoint_missing');
  const checkpoint = JSON.parse(String(row.value_json)) as TaskCheckpoint;
  if (checkpoint.schemaVersion !== 1 || checkpoint.id !== reference.id || checkpoint.task.id !== taskId
      || checkpoint.task.revision !== reference.taskRevision || protocolHash(checkpoint) !== reference.digest) throw Error('task_checkpoint_corrupt');
  return checkpoint;
}
