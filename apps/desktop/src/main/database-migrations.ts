import {createHash} from 'node:crypto';
import type sqlite3 from 'sqlite3';
import {sqliteExec} from './sqlite-connections';
import {taskSummarySchema} from './xiaozhi-agent/task-summary-schema';
import {acquisitionSchema, legacyAcquisitionDefinitions} from './xiaozhi-agent/capabilities/acquisition/schema';
import {historyMemorySchema} from './xiaozhi-agent/history/schema';

const baselineTable = 'xiaozhi_schema_baseline';
const migrationsTable = 'xiaozhi_schema_migrations';
const legacyCore = {
  app_settings: ['key', 'value_json', 'updated_at'],
  students: ['id', 'display_name', 'created_at'],
  learning_records: ['id', 'student_id', 'created_at'],
  teacher_resources: ['id', 'content_hash', 'parse_status'],
  ai_conversation_sessions: ['id', 'title', 'updated_at'],
  ai_memory_documents: ['id', 'surface', 'version'],
  ai_memory_entries: ['id', 'document_id', 'version'],
} as const;

const baselineControlSql = `
  CREATE TABLE xiaozhi_schema_baseline(
    id INTEGER PRIMARY KEY CHECK(id=1),
    kind TEXT NOT NULL CHECK(kind IN ('fresh','adopted')),
    source_schema_sha256 TEXT NOT NULL CHECK(length(source_schema_sha256)=64),
    recorded_at TEXT NOT NULL
  );
  CREATE TABLE xiaozhi_schema_migrations(
    migration_id TEXT PRIMARY KEY,
    from_version INTEGER NOT NULL,
    to_version INTEGER NOT NULL UNIQUE CHECK(to_version=from_version+1),
    checksum TEXT NOT NULL CHECK(length(checksum)=64),
    schema_sha256 TEXT NOT NULL CHECK(length(schema_sha256)=64),
    applied_at TEXT NOT NULL,
    app_build TEXT NOT NULL
  );
`;
const migrations = [{
  id: 'r1.memory_revision_document_index.v1',
  sql: 'CREATE INDEX idx_ai_memory_revisions_document ON ai_memory_revisions(document_id);',
}, {
  id: 'r1.task_summary_projection.v2',
  sql: taskSummarySchema,
}, {
  id: 'r1.capability_acquisition.v3',
  sql: acquisitionSchema,
}, {
  id: 'r1.local_book_recheck_evidence.v4',
  sql: `CREATE TABLE material_local_book_rechecks_v1(
    resource_id TEXT NOT NULL, version TEXT NOT NULL, generation TEXT NOT NULL, page INTEGER NOT NULL,
    raw_sha TEXT NOT NULL, body_json TEXT NOT NULL, body_sha TEXT NOT NULL,
    PRIMARY KEY(resource_id,version,generation,page)
  );`,
}, {
  id: 'r1.history_memory_access_and_index.v5',
  sql: historyMemorySchema,
}] as const;
const ACQUISITION_SCHEMA_VERSION = 3;
export const MAX_DATABASE_SCHEMA_VERSION = migrations.length;

type UpgradeIssue = 'newer_version' | 'unknown_legacy' | 'invalid_ledger' | 'changed_during_upgrade'
  | 'recovery_point_failed' | 'migration_failed' | 'foreign_key_check_failed';
export class DatabaseUpgradeError extends Error {
  constructor(readonly issue: UpgradeIssue, options?: ErrorOptions) {
    super(issue, options);
  }
}
type SchemaRow = {name: string; type: string; tbl_name: string; sql: string};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function matchesRegisteredSchema(objects: SchemaRow[], version: number, observed: string, registered?: string) {
  const acquisition = objects.filter(row => legacyAcquisitionDefinitions.has(row.name));
  // Reject modified definitions even when an older database had already registered them.
  if (acquisition.some(row => row.type !== 'table' || row.tbl_name !== row.name
      || row.sql !== legacyAcquisitionDefinitions.get(row.name))) return false;
  if (observed === registered) return version < ACQUISITION_SCHEMA_VERSION || acquisition.length === legacyAcquisitionDefinitions.size;
  if (version >= ACQUISITION_SCHEMA_VERSION || !registered) return false;
  // Old builds could register any subset, then create the rest lazily. Reconstruct
  // the registered digest by removing only known, exact legacy table definitions.
  const positions = new Map(acquisition.map((row, index) => [row, 1 << index]));
  for (let mask = 1; mask < 1 << acquisition.length; mask++) {
    const previous = objects.filter(row => !(mask & (positions.get(row) ?? 0)));
    if (hash(JSON.stringify(previous)) === registered) return true;
  }
  return false;
}

function all<T>(db: sqlite3.Database, sql: string, params: string[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => db.all<T>(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}
function run(db: sqlite3.Database, sql: string, params: Array<string | number>): Promise<void> {
  return new Promise((resolve, reject) => db.run(sql, params, error => error ? reject(error) : resolve()));
}

export async function databaseUserVersion(db: sqlite3.Database) {
  const [{user_version: value}] = await all<{user_version: number}>(db, 'PRAGMA user_version');
  if (!Number.isInteger(value) || value < 0) throw new DatabaseUpgradeError('invalid_ledger');
  return value;
}

async function schema(db: sqlite3.Database, includeDerived = false) {
  return all<SchemaRow>(db, `
    SELECT type,name,tbl_name,sql FROM sqlite_schema
    WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*'
    ${includeDerived ? '' : `AND name NOT GLOB 'xiaozhi_task_summary_*'
      AND name NOT GLOB 'learning_records_fts*'
      AND name NOT GLOB 'question_retrieval_*'
      AND name NOT GLOB 'material_body_*'`}
    ORDER BY type,name
  `);
}

async function externalChangeNumber(db: sqlite3.Database) {
  const [{data_version}] = await all<{data_version: number}>(db, 'PRAGMA data_version');
  return data_version;
}

async function verifyLegacyCore(db: sqlite3.Database, objects: SchemaRow[]) {
  for (const [table, required] of Object.entries(legacyCore)) {
    if (!objects.some(row => row.type === 'table' && row.name === table)) {
      throw new DatabaseUpgradeError('unknown_legacy');
    }
    const columns = new Set((await all<{name: string}>(db, 'SELECT name FROM pragma_table_info(?)', [table])).map(row => row.name));
    if (required.some(column => !columns.has(column))) throw new DatabaseUpgradeError('unknown_legacy');
  }
}

async function inspectDatabase(db: sqlite3.Database, version: number) {
  const objects = await schema(db,version === 0);
  const digest = hash(JSON.stringify(objects));
  const baselinePresent = objects.some(row => row.name === baselineTable);
  const ledgerPresent = objects.some(row => row.name === migrationsTable);
  if (version === 0) {
    if (baselinePresent || ledgerPresent) throw new DatabaseUpgradeError('invalid_ledger');
    if (!matchesRegisteredSchema(objects,version,digest,digest)) throw new DatabaseUpgradeError('invalid_ledger');
    if (objects.length) await verifyLegacyCore(db,objects);
    return {kind: objects.length ? 'adopted' as const : 'fresh' as const,digest};
  }
  if (!baselinePresent || !ledgerPresent) throw new DatabaseUpgradeError('invalid_ledger');
  try {
    const entries = await all<{
      migration_id: string; from_version: number; to_version: number; checksum: string; schema_sha256: string;
      applied_at: string; app_build: string;
    }>(db, 'SELECT * FROM xiaozhi_schema_migrations ORDER BY to_version');
    const [info,...other] = await all<{id: number; kind: string; source_schema_sha256: string; recorded_at: string}>(
      db, 'SELECT * FROM xiaozhi_schema_baseline',
    );
    if (!info || other.length || info.id !== 1 || !['fresh','adopted'].includes(info.kind) ||
        !/^[a-f0-9]{64}$/u.test(info.source_schema_sha256) || !Number.isFinite(Date.parse(info.recorded_at)) ||
        entries.length !== version || !matchesRegisteredSchema(objects,version,digest,entries.at(-1)?.schema_sha256) ||
        entries.some((entry,index) => entry.from_version !== index || entry.to_version !== index+1 ||
          entry.migration_id !== migrations[index].id || entry.checksum !== hash(migrations[index].sql) ||
          !entry.app_build || !Number.isFinite(Date.parse(entry.applied_at)))) {
      throw new DatabaseUpgradeError('invalid_ledger');
    }
  } catch (error) {
    if (error instanceof DatabaseUpgradeError) throw error;
    throw new DatabaseUpgradeError('invalid_ledger', {cause:error});
  }
  return {kind:'managed' as const,digest};
}

export async function inspectBackupDatabaseVersion(db: sqlite3.Database) {
  const version = await databaseUserVersion(db);
  // Compatibility needs to display future versions, which it forbids activating.
  // Legacy bundles keep their existing compatibility readers.
  if (version > 0 && version <= MAX_DATABASE_SCHEMA_VERSION) await inspectDatabase(db,version);
  if (version === 0) {
    const objects = await schema(db);
    if (objects.some(row => row.name === baselineTable || row.name === migrationsTable)) {
      throw new DatabaseUpgradeError('invalid_ledger');
    }
  }
  return version;
}

export async function migrateDatabase(db: sqlite3.Database, options: {
  bootstrap: () => Promise<void>;
  recoveryPoint: () => Promise<void>;
  enableJournal: () => Promise<void>;
  appBuild: () => string;
}): Promise<number> {
  const version = await databaseUserVersion(db);
  if (version > MAX_DATABASE_SCHEMA_VERSION) throw new DatabaseUpgradeError('newer_version');
  const current = await inspectDatabase(db,version);
  if (version === MAX_DATABASE_SCHEMA_VERSION) {
    await options.enableJournal();
    return version;
  }

  const beforeRecovery = await externalChangeNumber(db);
  if (current.kind !== 'fresh') {
    try { await options.recoveryPoint(); }
    catch (error) { throw new DatabaseUpgradeError('recovery_point_failed',{cause:error}); }
    if (await externalChangeNumber(db) !== beforeRecovery) {
      throw new DatabaseUpgradeError('changed_during_upgrade');
    }
  }
  const [{journal_mode: journalMode}] = await all<{journal_mode: string}>(db, 'PRAGMA journal_mode');
  await options.enableJournal();
  // SQLite advances data_version when this handle moves a new file into WAL.
  const changeNumber = journalMode === 'wal' ? beforeRecovery : await externalChangeNumber(db);

  let began = false;
  let expectedDigest = current.digest;
  try {
    const appBuild = options.appBuild();
    for (let from = version; from < migrations.length; from++) {
      await sqliteExec(db,'BEGIN IMMEDIATE;');
      began = true;
      const lockedVersion = await databaseUserVersion(db);
      if (lockedVersion !== from || await externalChangeNumber(db) !== changeNumber ||
          (await inspectDatabase(db,lockedVersion)).digest !== expectedDigest) {
        throw new DatabaseUpgradeError('changed_during_upgrade');
      }
      if (from === 0) {
        await options.bootstrap();
        await sqliteExec(db,baselineControlSql);
        await run(db,'INSERT INTO xiaozhi_schema_baseline VALUES(1,?,?,?)',
          [current.kind,current.digest,new Date().toISOString()]);
      }
      const migration = migrations[from];
      await sqliteExec(db,migration.sql);
      const check = await all(db,'PRAGMA foreign_key_check');
      if (check.length) throw new DatabaseUpgradeError('foreign_key_check_failed');
      expectedDigest = hash(JSON.stringify(await schema(db)));
      await run(db,'INSERT INTO xiaozhi_schema_migrations VALUES(?,?,?,?,?,?,?)', [
        migration.id,from,from+1,hash(migration.sql),expectedDigest,
        new Date().toISOString(),appBuild,
      ]);
      await sqliteExec(db,`PRAGMA user_version=${from+1};`);
      await sqliteExec(db,'COMMIT;');
      began = false;
    }
    return MAX_DATABASE_SCHEMA_VERSION;
  } catch (error) {
    if (began) await sqliteExec(db,'ROLLBACK;').catch(()=>undefined);
    if (error instanceof DatabaseUpgradeError) throw error;
    throw new DatabaseUpgradeError('migration_failed',{cause:error});
  }
}
