import { constants } from 'node:fs';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type sqlite3 from 'sqlite3';
import {closeSqlite,openSqlite} from '../sqlite-connections';
import {portableProviderSecretFields} from '../provider-credentials';
import type { Sql } from '../xiaozhi-agent/session-state';
import { createPermissionStore } from '../xiaozhi-agent/permissions/store';
import { withReadOnlyBackup } from './compatibility';
import { snapshotDataBackupSqlite } from './data-root-files';

const providerFields = portableProviderSecretFields;
const mcpSettings = 'xiaozhi.mcp.v1';
const invalidPackage = '换机包包含旧设备凭据或授权，请在原电脑重新创建换机包。';

function reader(db: sqlite3.Database): Sql['all'] {
  return (sql, values = []) => new Promise((resolve, reject) => db.all(sql, values, (error, rows) => {
    if (error) reject(error);
    else resolve(rows as Record<string, unknown>[]);
  }));
}

async function hasTable(all: Sql['all'], name: string) {
  return (await all("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?", [name])).length === 1;
}

/** Only called on a temporary file written by the live store's snapshot operation. */
async function sanitize(file: string, output: string, signal?: AbortSignal) {
  const db = await openSqlite(file, 'backupWrite');
  const abort = () => db.interrupt();
  signal?.addEventListener('abort',abort,{once:true});
  const change: NonNullable<Sql['change']> = (sql, values = []) =>
    new Promise((resolve, reject) => db.run(sql, values, function (error) {
      if (error) reject(error);
      else resolve(this.changes);
    }));
  const detached: Sql = {all: reader(db), run: change, change};
  // The detached snapshot has one connection and one enclosing transaction.
  detached.transaction = async work => work(detached);
  try {
    signal?.throwIfAborted();
    await change('PRAGMA secure_delete=ON');
    await change('BEGIN IMMEDIATE');
    try {
      for (const [key, field] of providerFields) {
        const remove = key === 'xiaozhi.material-ai.v1' ? "json_set(value_json, ?, '')" : 'json_remove(value_json, ?)';
        await change(`UPDATE app_settings SET value_json=${remove} WHERE key=?`, [field, key]);
      }
      // Arguments and endpoint paths may contain user-entered credentials.
      // Recreate connections on the target machine, keeping their historical receipts.
      await change('DELETE FROM app_settings WHERE key=?', [mcpSettings]);
      await createPermissionStore(detached).resetDeviceAuthority();
      await change('COMMIT');
    } catch (error) {
      await change('ROLLBACK').catch(() => undefined);
      throw error;
    }
    // The bundled SQLite preserves implicit rowids with VACUUM INTO. The index
    // cursors in this database still refer to those rowids after recovery.
    await change('VACUUM INTO ?', [output]);
  } finally {
    signal?.removeEventListener('abort',abort);
    await closeSqlite(db);
  }
}

export function assertPortableBackupDatabase(file: string) {
  return withReadOnlyBackup(file, async db => {
    const all = reader(db);
    if (!await hasTable(all, 'app_settings')) throw Error(invalidPackage);
    for (const [key, field] of providerFields) {
      if ((await all("SELECT 1 FROM app_settings WHERE key=? AND COALESCE(json_extract(value_json, ?), '')<>''",
        [key, field])).length) throw Error(invalidPackage);
    }
    if ((await all('SELECT 1 FROM app_settings WHERE key=?', [mcpSettings])).length) throw Error(invalidPackage);
    for (const [table, condition] of [
      ['xiaozhi_permission_grants_v1', 'revoked<>1'],
      ['xiaozhi_permission_profiles_v1', "json_extract(document_json, '$.mode') IS NOT 'request'"],
      ['ai_confirmation_items', "action_type='xiaozhi_permission_v2' AND json_extract(payload_json, '$.state') IN ('pending','approved','executing')"],
    ]) {
      if (await hasTable(all, table) && (await all(`SELECT 1 FROM ${table} WHERE ${condition} LIMIT 1`)).length) throw Error(invalidPackage);
    }
  });
}

/** Publish only the sanitized standalone DB. A failed export never writes live credentials to its target. */
export async function snapshotPortableBackup(database: unknown, destination: string, signal?: AbortSignal) {
  const staging = await mkdtemp(join(tmpdir(), 'xiaozhi-portable-'));
  try {
    const original = join(staging, 'snapshot.db');
    const file = join(staging, 'app.db');
    await snapshotDataBackupSqlite(database, original, signal);
    await sanitize(original, file, signal);
    await assertPortableBackupDatabase(file);
    signal?.throwIfAborted();
    await copyFile(file, destination, constants.COPYFILE_EXCL);
  } finally {
    await rm(staging, {recursive: true, force: true});
  }
}
