import type sqlite3 from 'sqlite3';
import type {Sql} from './session-state';

/** The handle is opened READONLY by the original store and owns no domain lifecycle. */
export async function readWorkbenchSnapshot<T>(open: () => Promise<sqlite3.Database>, action: (sql: Sql) => Promise<T>): Promise<T> {
  const database = await open();
  const exec = (statement: string) => new Promise<void>((resolve, reject) => database.exec(statement, error => error ? reject(error) : resolve()));
  const sql: Sql = {
    all: (statement, values = []) => new Promise((resolve, reject) => database.all<Record<string, unknown>>(statement, values, (error, rows) => error ? reject(error) : resolve(rows))),
    run: (statement, values = []) => new Promise((resolve, reject) => database.run(statement, values, function(error) {error ? reject(error) : resolve(this.changes);})),
    change: (statement, values = []) => new Promise((resolve, reject) => database.run(statement, values, function(error) {error ? reject(error) : resolve(this.changes);})),
  };
  try {
    await exec('PRAGMA query_only=ON; PRAGMA busy_timeout=5000; BEGIN;');
    try {const result = await action(sql); await exec('COMMIT;'); return result;}
    catch (error) {await exec('ROLLBACK;').catch(() => undefined); throw error;}
  } finally {
    await new Promise<void>((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
  }
}
