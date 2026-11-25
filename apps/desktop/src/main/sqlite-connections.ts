import sqlite3 from 'sqlite3';
import {pathToFileURL} from 'node:url';

// Main's NORMAL and the independent writers' FULL match their previous
// durability. Only the live bootstrap and the detached snapshot may change
// the persistent journal mode. A short reader never changes the file mode.
const policies = {
  primary: {access: 'create', synchronous: 1, timeout: 5000},
  domainWrite: {access: 'write', synchronous: 2, timeout: 5000},
  retryWrite: {access: 'write', synchronous: 2, timeout: 0},
  independentWrite: {access: 'write', synchronous: 2, timeout: 1000},
  liveRead: {access: 'read', synchronous: 2, timeout: 5000},
  backupRead: {access: 'read', synchronous: 2, timeout: 1000},
  backupWrite: {access: 'write', synchronous: 2, timeout: 1000},
  legacyCheckpoint: {access: 'create', synchronous: 2, timeout: 1000},
} as const;

export type SqliteConnectionRole = keyof typeof policies;

export function sqliteExec(db: sqlite3.Database, statement: string): Promise<void> {
  return new Promise((resolve, reject) => db.exec(statement, error => error ? reject(error) : resolve()));
}

function sqliteGet<T>(db: sqlite3.Database, statement: string): Promise<T> {
  return new Promise((resolve, reject) => db.get<T>(statement, (error, row) => {
    if (error) reject(error);
    else if (row === undefined) reject(new Error('sqlite_connection_policy_unavailable'));
    else resolve(row);
  }));
}

export function closeSqlite(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
}

export function sqliteConnectionPolicy(db: sqlite3.Database) {
  return sqliteGet<{foreignKeys: number; synchronous: number; busyTimeout: number; queryOnly: number; journalMode: string}>(db, `
    SELECT
      (SELECT foreign_keys FROM pragma_foreign_keys) AS foreignKeys,
      (SELECT synchronous FROM pragma_synchronous) AS synchronous,
      (SELECT timeout FROM pragma_busy_timeout) AS busyTimeout,
      (SELECT query_only FROM pragma_query_only) AS queryOnly,
      (SELECT journal_mode FROM pragma_journal_mode) AS journalMode
  `);
}

export async function openSqlite(file: string, role: SqliteConnectionRole): Promise<sqlite3.Database> {
  const policy = policies[role];
  const readOnly = policy.access === 'read';
  const access = readOnly ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE;
  const standalone = role === 'backupRead';
  const flags = access | sqlite3.OPEN_FULLMUTEX | (policy.access === 'create' ? sqlite3.OPEN_CREATE : 0)
    | (standalone ? sqlite3.OPEN_URI : 0);
  // A validated backup is a standalone file, even if its header records WAL.
  // Immutable readers never create journal sidecars in the backup directory.
  const url = standalone ? pathToFileURL(file) : undefined;
  const filename = url ? (url.host ? `file:////${url.host}${url.pathname}` : url.href)+'?immutable=1' : file;
  const db = await new Promise<sqlite3.Database>((resolve, reject) => {
    const handle = new sqlite3.Database(filename, flags, error => error ? reject(error) : resolve(handle));
  });
  db.serialize();
  try {
    await sqliteExec(db, `
      PRAGMA busy_timeout=${policy.timeout};
      PRAGMA foreign_keys=ON;
      PRAGMA synchronous=${policy.synchronous};
      PRAGMA query_only=${readOnly ? 'ON' : 'OFF'};
    `);
    const actual = await sqliteConnectionPolicy(db);
    if (actual.foreignKeys !== 1 || actual.synchronous !== policy.synchronous ||
        actual.busyTimeout !== policy.timeout || actual.queryOnly !== Number(readOnly)) {
      throw new Error('sqlite_connection_policy_mismatch');
    }
    return db;
  } catch (error) {
    await closeSqlite(db).catch(() => undefined);
    throw error;
  }
}

export async function setSqliteJournalMode(db: sqlite3.Database, mode: 'wal' | 'delete'): Promise<void> {
  const result = await sqliteGet<{journal_mode: string}>(db, `PRAGMA journal_mode=${mode}`);
  if (result.journal_mode !== mode) throw new Error('sqlite_journal_mode_mismatch');
}
