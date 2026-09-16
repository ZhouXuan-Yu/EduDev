import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-db-migration-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-db-migration-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'db-migration-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import sqlite3 from 'sqlite3';
          import { join } from 'node:path';
          import { OmniEduStore, schemaMigrations } from './src/main/db';

          export async function runDbMigrationSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();

            // 1. 全新安装：声明式收敛后盖章基线 v1，并应用已注册的真实迁移 v2。
            const readVersions = async () => (await storeReadVersions(store)).map((row) => row.version);
            const baseline = await readVersions();
            assert.deepEqual(baseline, [1, 2], 'fresh install must stamp baseline v1 and apply registered v2');
            await store.close();

            // 2. 重开幂等：基线只存在一次。
            await store.init();
            assert.deepEqual(await readVersions(), [1, 2], 'reopen must not duplicate applied versions');
            await store.close();

            // 3. 注册表校验：<=1 与重复版本必须拒绝。
            schemaMigrations.push({ version: 0, name: 'invalid-baseline', up: async () => undefined });
            await assert.rejects(() => store.init(), /schema 迁移版本必须大于基线 1/, 'migrations at or below baseline must be rejected');
            schemaMigrations.pop();
            schemaMigrations.push({ version: 3, name: 'dup-a', up: async () => undefined });
            schemaMigrations.push({ version: 3, name: 'dup-b', up: async () => undefined });
            await assert.rejects(() => store.init(), /版本重复/, 'duplicate migration versions must be rejected');
            schemaMigrations.pop();
            schemaMigrations.pop();

            // 4. 成功迁移 v3：应用一次、重开不复跑、调用计数为 1。
            let v3Calls = 0;
            schemaMigrations.push({
              version: 3,
              name: 'create_smoke_marker_table',
              up: async (db) => {
                v3Calls += 1;
                await db.run(\`CREATE TABLE IF NOT EXISTS migration_marker_v3 (id TEXT PRIMARY KEY)\`);
                await db.run(\`INSERT INTO migration_marker_v3 (id) VALUES ('v3-applied')\`);
              },
            });
            await store.init();
            assert.deepEqual(await readVersions(), [1, 2, 3], 'v3 migration must be applied after baseline');
            assert.equal(v3Calls, 1, 'v3 migration must run exactly once');
            await store.close();
            await store.init();
            assert.equal(v3Calls, 1, 'reopen must not re-run applied migrations');
            await store.close();

            // 5. 失败迁移 v4：部分 DDL 必须回滚，失败后保持未应用，下次启动重试成功。
            let v4Calls = 0;
            schemaMigrations.push({
              version: 4,
              name: 'create_flaky_marker_table',
              up: async (db) => {
                v4Calls += 1;
                await db.run(\`CREATE TABLE IF NOT EXISTS migration_marker_v4_partial (id TEXT PRIMARY KEY)\`);
                if (v4Calls === 1) throw new Error('simulated transient failure');
                await db.run(\`CREATE TABLE IF NOT EXISTS migration_marker_v4_final (id TEXT PRIMARY KEY)\`);
              },
            });
            await assert.rejects(() => store.init(), /schema 迁移 v4（create_flaky_marker_table）失败：simulated transient failure/, 'failing migration must surface a wrapped actionable error');
            const partialExists = await rawTableExists(dataRoot, 'migration_marker_v4_partial');
            assert.equal(partialExists, false, 'partial DDL inside a failed migration must be rolled back');
            await store.close();
            await store.init();
            assert.deepEqual(await readVersions(), [1, 2, 3, 4], 'retried migration must apply on the next start');
            assert.equal(v4Calls, 2, 'failed migration must retry exactly once on next start');
            assert.equal(await rawTableExists(dataRoot, 'migration_marker_v4_final'), true, 'successful retry must persist its DDL');
            await store.close();

            // 6. 数据库版本高于程序：fail-closed，不得静默打开。
            await rawInsertVersion(dataRoot, 99);
            await assert.rejects(() => store.init(), /高于当前程序支持/, 'databases newer than the app must fail closed');
            await store.close();

            return { ok: true, appliedVersions: [1, 2, 3, 4], v3Calls, v4Calls, newerDatabaseFailClosed: true };
          }

          async function storeReadVersions(store) {
            // schema_migrations 无公开读口，经注册迁移之外的 raw 连接读取。
            return rawQueryVersions(store.getDataRoot());
          }

          function openRaw(dataRoot) {
            return new Promise((resolveOpen, reject) => {
              const db = new sqlite3.Database(join(dataRoot, 'app.db'), (error) => (error ? reject(error) : resolveOpen(db)));
            });
          }

          async function rawQueryVersions(dataRoot) {
            const db = await openRaw(dataRoot);
            try {
              return await new Promise((resolveQuery, reject) => {
                db.all(\`SELECT version FROM schema_migrations ORDER BY version ASC\`, (error, rows) => (error ? reject(error) : resolveQuery(rows)));
              });
            } finally {
              await new Promise((resolveClose, reject) => db.close((error) => (error ? reject(error) : resolveClose())));
            }
          }

          async function rawTableExists(dataRoot, tableName) {
            const db = await openRaw(dataRoot);
            try {
              const rows = await new Promise((resolveQuery, reject) => {
                db.all(\`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?\`, [tableName], (error, result) => (error ? reject(error) : resolveQuery(result)));
              });
              return rows.length > 0;
            } finally {
              await new Promise((resolveClose, reject) => db.close((error) => (error ? reject(error) : resolveClose())));
            }
          }

          async function rawInsertVersion(dataRoot, version) {
            const db = await openRaw(dataRoot);
            try {
              await new Promise((resolveRun, reject) => {
                db.run(\`INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, 'external_future_version', '2026-09-16T00:00:00.000Z')\`, [version], (error) => (error ? reject(error) : resolveRun()));
              });
            } finally {
              await new Promise((resolveClose, reject) => db.close((error) => (error ? reject(error) : resolveClose())));
            }
          }
        `,
        resolveDir: appRoot,
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      external: ['sqlite3'],
      logLevel: 'silent',
    });

    const { runDbMigrationSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runDbMigrationSmoke(dataRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await cleanupWithRetry(bundleRoot);
    await cleanupWithRetry(dataRoot);
  }
}

async function cleanupWithRetry(target) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) {
        console.error(`cleanup warning (${target}): ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 150));
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
