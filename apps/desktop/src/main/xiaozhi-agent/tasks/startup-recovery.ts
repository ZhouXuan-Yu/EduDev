import type {Sql} from '../session-state';
import type {JournalOwner} from '../events/journal';
import {createTaskState} from './task-state';

/** Called inside the Journal recovery transaction before it retires this owner. */
export async function recoverStartupTask(work: Sql, owner: JournalOwner) {
  const tables = await work.all("SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'");
  if (!tables.length) return null;
  const scoped = {...work, transaction: <T>(action: (sql: Sql) => Promise<T>) => action(work)};
  const tasks = createTaskState(scoped, {sanitize: async () => {throw Error('invalid_input');}});
  const task = await tasks.latest(owner.sessionId);
  if (!task || !['active', 'review_required'].includes(task.state)) return null;
  const row = (await work.all('SELECT value_json FROM app_settings WHERE key=?', ['xiaozhi.task.v1:' + task.id]))[0];
  const document = JSON.parse(String(row.value_json));
  const expected = document.eventOwner || document.lineage.at(-1);
  if (expected.runId !== owner.runId || expected.generation !== owner.generation) return null;
  return tasks.settle(owner, task.id, task.revision, true);
}
