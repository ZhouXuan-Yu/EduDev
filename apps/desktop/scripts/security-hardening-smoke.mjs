import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-security-hardening-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-security-'));
const outsideRoot = mkdtempSync(join(tmpdir(), 'omni-edu-security-outside-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'security-hardening-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import sqlite3 from 'sqlite3';
          import { join } from 'node:path';
          import { OmniEduStore } from './src/main/db';

          export async function runSecurityHardeningSmoke(dataRoot, outsideRoot) {
            const encryptMarker = (text) => 'ENC(' + Buffer.from(text, 'utf8').toString('base64') + ')';
            const decryptMarker = (wrapped) => {
              const match = /^ENC\\(([A-Za-z0-9+/=]+)\\)$/.exec(wrapped);
              if (!match) throw new Error('bad ciphertext');
              return Buffer.from(match[1], 'base64').toString('utf8');
            };
            const store = new OmniEduStore(dataRoot, { encryptString: encryptMarker, decryptString: decryptMarker });
            await store.init();

            // 1. 路径守卫：managed 路径放行，junction 逃逸必须拒绝。
            const managedFile = join(dataRoot, 'students', 'probe.txt');
            assert.equal(await store.isManagedLocalPath(join(dataRoot, 'students')), true, 'managed path must be allowed');
            const junctionTarget = join(dataRoot, 'students', 'escape-junction');
            assert.equal(await store.isManagedLocalPath(junctionTarget), false, 'junction escaping the data root must be rejected');
            assert.equal(await store.isManagedLocalPath(join(outsideRoot, 'secret.txt')), false, 'outside path must be rejected');

            // 2. 密钥加密：落库无明文、读取可回读。
            await store.saveDeepSeekSettings({ apiKey: 'sk-plaintext-probe-key', model: 'deepseek-v4-flash' });
            const rawAfterSave = await rawSettingsRow(dataRoot);
            assert.ok(!rawAfterSave.includes('sk-plaintext-probe-key'), 'saved settings must not persist the plaintext key');
            assert.ok(rawAfterSave.includes('apiKeyEncrypted'), 'saved settings must persist an encrypted key');
            const runtime = await store.getDeepSeekRuntimeSettings();
            assert.equal(runtime.apiKey, 'sk-plaintext-probe-key', 'encrypted key must round-trip through the crypto provider');

            // 3. 旧明文一次性迁移：读取时加密重写，明文不再留在库里。
            await rawUpsertSettings(dataRoot, JSON.stringify({ apiKey: 'sk-legacy-plaintext-key', model: 'deepseek-v4-flash' }));
            const migrated = await store.getDeepSeekRuntimeSettings();
            assert.equal(migrated.apiKey, 'sk-legacy-plaintext-key', 'legacy plaintext key must still be readable');
            const rawAfterMigration = await rawSettingsRow(dataRoot);
            assert.ok(!rawAfterMigration.includes('sk-legacy-plaintext-key'), 'legacy plaintext must be removed after one-time migration');
            assert.ok(rawAfterMigration.includes('apiKeyEncrypted'), 'legacy key must be rewritten encrypted');

            // 4. 解密失败 fail-closed：损坏密文必须返回无密钥而不是抛异常或返回明文。
            await rawUpsertSettings(dataRoot, JSON.stringify({ apiKeyEncrypted: 'ENC(!!!not-base64!!!)', model: 'deepseek-v4-flash' }));
            const broken = await store.getDeepSeekRuntimeSettings();
            assert.equal(broken.apiKey, undefined, 'broken ciphertext must fail closed to no key');

            await store.close();
            return { ok: true, pathGuardJunctionRejected: true, encryptedAtRest: true, legacyMigrated: true, decryptFailClosed: true };
          }

          function openRaw(dataRoot) {
            return new Promise((resolveOpen, reject) => {
              const db = new sqlite3.Database(join(dataRoot, 'app.db'), (error) => (error ? reject(error) : resolveOpen(db)));
            });
          }

          async function rawSettingsRow(dataRoot) {
            const db = await openRaw(dataRoot);
            try {
              return await new Promise((resolveQuery, reject) => {
                db.get("SELECT value_json FROM app_settings WHERE key = 'deepseek'", (error, row) => (error ? reject(error) : resolveQuery(row ? String(row.value_json) : '')));
              });
            } finally {
              await new Promise((resolveClose, reject) => db.close((error) => (error ? reject(error) : resolveClose())));
            }
          }

          async function rawUpsertSettings(dataRoot, valueJson) {
            const db = await openRaw(dataRoot);
            try {
              await new Promise((resolveRun, reject) => {
                db.run("INSERT OR REPLACE INTO app_settings (key, value_json, updated_at) VALUES ('deepseek', ?, '2026-09-16T00:00:00.000Z')", [valueJson], (error) => (error ? reject(error) : resolveRun()));
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

    mkdirSync(join(dataRoot, 'students'), { recursive: true });
    writeFileSync(join(outsideRoot, 'secret.txt'), 'outside secret', 'utf8');
    try {
      execFileSync('cmd', ['/c', 'mklink', '/J', join(dataRoot, 'students', 'escape-junction'), outsideRoot], { stdio: 'ignore' });
    } catch {
      // Junction creation may be unavailable; the smoke then fails loudly on the guard assert instead.
    }

    const { runSecurityHardeningSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runSecurityHardeningSmoke(dataRoot, outsideRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await cleanupWithRetry(bundleRoot);
    await cleanupWithRetry(dataRoot);
    await cleanupWithRetry(outsideRoot);
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
