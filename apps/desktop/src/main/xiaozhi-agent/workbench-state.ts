import type {Sql} from './session-state';
import type {WorkbenchSourceFailure} from '../../shared/xiaozhi-workbench';

export type WorkbenchSession = {id: string; title: string};
export type WorkbenchRead = {
  sql: Sql; now: string; sessions: Map<string, WorkbenchSession>; tables: Set<string>;
  failures: WorkbenchSourceFailure[]; unavailable: number;
};
export function workbenchText(value: unknown, limit = 200): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/gu, ' ').slice(0, limit);
}
export function workbenchSource(value: unknown): string {
  const text = workbenchText(value, 1000);
  try {const url = new URL(text); if (url.protocol === 'http:' || url.protocol === 'https:') {
    url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.href;
  }} catch { /* Local references retain their existing source identity. */ }
  return text;
}
export function workbenchFailure(read: WorkbenchRead, source: WorkbenchSourceFailure['source'], code: WorkbenchSourceFailure['code'], records: number | null = 1) {
  const prior = read.failures.find(item => item.source === source && item.code === code);
  if (prior) prior.records = prior.records === null || records === null ? null : prior.records + records;
  else read.failures.push({source, code, records});
  if (records !== null) read.unavailable += records;
}
export async function* workbenchRows(read: WorkbenchRead, table: string, source: WorkbenchSourceFailure['source'], where = '', values: (string | number)[] = [], optional = false) {
  if (!read.tables.has(table)) {
    if (!optional) workbenchFailure(read, source, 'not_initialized', null);
    return;
  }
  let after = 0;
  for (;;) {
    let rows: Record<string, unknown>[];
    try {rows = await read.sql.all(`SELECT rowid AS workbench_rowid,* FROM ${table} WHERE rowid>? ${where ? 'AND (' + where + ')' : ''} ORDER BY rowid LIMIT 100`, [after, ...values]);}
    catch {workbenchFailure(read, source, 'unavailable', null); return;}
    for (const row of rows) {after = Number(row.workbench_rowid); yield row;}
    if (rows.length < 100) return;
    await new Promise<void>(resolve => setImmediate(resolve));
  }
}
