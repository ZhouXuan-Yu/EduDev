import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { assertIsolatedPiMain, testMain } from '../acceptance/build-root.mjs';

const desktop = path.resolve(import.meta.dirname, '../..');
const main = testMain(desktop);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-backup-compatibility-'));
const dataRoot = path.join(root, 'data');
const profile = path.join(root, 'profile');
const exportsRoot = path.join(root, 'export');
const restoreRoot = path.join(root, 'restore');
for (const directory of [dataRoot, profile, exportsRoot, restoreRoot]) fs.mkdirSync(directory);

const manifestFile = 'omni-edu-backup-manifest.v1.json';
const checks = [];
const rendererErrors = [];
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
let app, page, exported, reportError;

function copyBackup(name, edit) {
  const folder = path.join(root, name);
  fs.cpSync(exported, folder, { recursive: true });
  const file = path.join(folder, manifestFile);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  edit(manifest, folder);
  fs.writeFileSync(file, JSON.stringify(manifest));
  return folder;
}

async function pick(source) {
  await app.evaluate(({ dialog }, { source, exportsRoot, restoreRoot }) => {
    dialog.showOpenDialog = async options => {
      const title = options.title;
      const directory = title.includes('保存位置') ? restoreRoot
        : title.includes('完整数据目录备份位置') ? exportsRoot
        : source;
      return directory ? { canceled: false, filePaths: [directory] } : { canceled: true, filePaths: [] };
    };
  }, { source, exportsRoot, restoreRoot });
}

async function expectVisible(testId, pattern) {
  const locator = page.getByTestId(testId);
  await locator.waitFor({ timeout: 45000 });
  if (pattern) assert.match(await locator.innerText(), pattern);
  return locator;
}

async function verifyAndReject(source, expectedMessage, expectedError, isIntact = true) {
  await pick(source);
  await page.getByTestId('data-backup-verify').click();
  await expectVisible(isIntact ? 'data-backup-verify-success' : 'data-backup-verify-failed');
  if (isIntact) await expectVisible('data-backup-compatibility', expectedMessage);
  const before = fs.readdirSync(restoreRoot);
  await page.getByTestId('data-backup-restore').click();
  await expectVisible('data-backup-error', expectedError);
  assert.deepEqual(fs.readdirSync(restoreRoot), before);
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()), dataRoot);
}

try {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (/API_KEY|ACCESS_TOKEN|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL|OMNI_EDU_E2E/.test(name)) delete env[name];
  }
  Object.assign(env, {
    OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_VISIBLE: '0',
  });
  app = await electron.launch({ args: [main, '--user-data-dir=' + profile], cwd: desktop, env, timeout: 60000 });
  page = await app.firstWindow();
  page.on('pageerror', error => rendererErrors.push(String(error)));
  await assertIsolatedPiMain(app, main, profile);
  const runtimeVersion = await app.evaluate(({ app }) => app.getVersion());
  const applicationVersion = JSON.parse(fs.readFileSync(path.join(desktop,'package.json'),'utf8')).version;
  assert.notEqual(runtimeVersion, applicationVersion, 'Fixture must exercise direct development launch version distinction');

  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByTestId('pi-settings-workspace').waitFor();
  await page.getByTestId('pi-settings-tab-backup').click();
  await pick(null);
  await page.getByTestId('data-backup-export').click();
  await expectVisible('data-backup-export-success');
  exported = await page.getByTestId('data-backup-export-path').innerText();
  const manifest = JSON.parse(fs.readFileSync(path.join(exported, manifestFile), 'utf8'));
  assert.deepEqual(manifest.compatibility, { appVersion: applicationVersion, dataVersion: 0 });
  assert.equal(manifest.compatibilityAppVersionSource,'desktop');
  const originalDatabase = sha(fs.readFileSync(path.join(exported, 'app.db')));
  assert((await page.getByTestId('data-backup-compatibility').innerText()).includes(applicationVersion));
  checks.push('Settings exports verified files with the actual Electron app version and SQLite user_version.');

  await pick(exported);
  await page.getByTestId('data-backup-restore').click();
  await expectVisible('data-backup-restore-ready', /备份版本/);
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()), dataRoot);
  checks.push('A same-version backup creates an independent restore copy and displays versions before activation.');

  const syntheticKey = 'synthetic-migration-model-credential-never-display';
  const settingsBackup = copyBackup('saved-settings', (manifest, folder) => {
    const dbPath = path.join(folder, 'app.db');
    const db = new DatabaseSync(dbPath);
    try {
      db.exec('PRAGMA journal_mode=DELETE');
      const put = db.prepare('INSERT OR REPLACE INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)');
      put.run('xiaozhi.provider.v1', JSON.stringify({schema:1, revision:1, defaultModel:'deepseek-flash', sealedKey:syntheticKey}), '2026-11-21');
      put.run('deepseek', JSON.stringify({model:'deepseek-flash', apiKey:'synthetic-legacy-token-never-display'}), '2026-11-21');
      put.run('xiaozhi.thinking.default', JSON.stringify({schema:1, revision:1, choice:'high'}), '2026-11-21');
      db.prepare('INSERT INTO ai_conversation_sessions(id,title,created_at,updated_at) VALUES(?,?,?,?)')
        .run('aisession_backup_fixture', '合成备课', '2026-11-21', '2026-11-21');
      put.run('xiaozhi.model.aisession_backup_fixture', JSON.stringify({schema:1, revision:1, model:'deepseek-pro'}), '2026-11-21');
      put.run('xiaozhi.thinking.aisession_backup_fixture', JSON.stringify({schema:1, revision:1, choice:'low'}), '2026-11-21');
      put.run('xiaozhi.model.aisession_missing', JSON.stringify({schema:1, revision:1, model:'unused-model'}), '2026-11-21');
      db.prepare('INSERT INTO xiaozhi_pi_workspaces(conversation_id,path,label,updated_at) VALUES(?,?,?,?)')
        .run('aisession_backup_fixture', path.join(root,'synthetic-external'), '合成外选目录', '2026-11-21');
      for (const scope of ['personal','team']) {
        const id = 'synthetic-' + scope;
        const payload=JSON.stringify({id,scope,revision:1});
        db.prepare('INSERT INTO xiaozhi_skill_governance_v1(id,revision,payload_json,payload_hash) VALUES(?,?,?,?)')
          .run(id, 1, payload, sha(payload));
      }
      db.prepare('INSERT INTO paper_template_heads(template_id,student_id,head_version) VALUES(?,?,?)')
        .run('synthetic-template','synthetic-student',1);
      db.prepare('INSERT INTO paper_template_versions(template_id,version,digest,name,data_json,created_at) VALUES(?,?,?,?,?,?)')
        .run('synthetic-template',1,sha('{}'),'合成模板','{}','2026-11-21');
    } finally { db.close(); }
    const bytes = fs.readFileSync(dbPath);
    Object.assign(manifest.files.find(item => item.path === 'app.db'), { size: bytes.length, sha256: sha(bytes) });
  });
  const settingsDb = path.join(settingsBackup, 'app.db');
  const settingsHash = sha(fs.readFileSync(settingsDb));
  await pick(settingsBackup);
  await page.getByTestId('data-backup-verify').click();
  await expectVisible('data-backup-verify-success');
  const summary = await expectVisible('data-backup-continuity');
  await summary.getByText('换机前核对', {exact:true}).click();
  assert.match(await summary.innerText(), /有默认模型记录，会话覆盖 1 项/);
  assert.match(await summary.innerText(), /有全局思考档次记录，会话覆盖 1 项/);
  assert.match(await summary.innerText(), /会话工作目录：1 项/);
  assert.match(await summary.innerText(), /个人技能：1 条记录/);
  assert.match(await summary.innerText(), /组卷模板：1 份/);
  await expectVisible('data-backup-credential-notice', /重新配置凭据/);
  assert.doesNotMatch(await summary.innerHTML(), /synthetic-migration-model-credential-never-display|synthetic-legacy-token-never-display|unused-model|synthetic-external/u);
  for (const size of [{width:1366,height:768}, {width:1920,height:1080}]) {
    await page.setViewportSize(size);
    await summary.scrollIntoViewIfNeeded();
    assert(await summary.isVisible());
    assert(await summary.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
    await page.screenshot({path:path.join(root, 'continuity-' + size.width + '.png')});
  }
  assert.equal(sha(fs.readFileSync(settingsDb)), settingsHash);
  checks.push('A verified backup discloses model, thinking and workspace records without exposing saved credential, orphan settings or filesystem paths in either viewport.');

  await page.getByTestId('data-backup-restore').click();
  const ready = await expectVisible('data-backup-restore-ready');
  await ready.getByText('换机前核对', {exact:true}).click();
  assert.match(await ready.getByTestId('data-backup-continuity').innerText(), /会话覆盖 1 项/);
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()), dataRoot);
  assert.equal(sha(fs.readFileSync(settingsDb)), settingsHash);
  checks.push('The prepared-copy view carries the same read-only inventory and keeps the original active.');

  const olderSettings = copyBackup('unknown-settings', (manifest, folder) => {
    const dbPath = path.join(folder, 'app.db');
    const db = new DatabaseSync(dbPath);
    try { db.exec('PRAGMA journal_mode=DELETE; DROP TABLE app_settings'); } finally { db.close(); }
    const bytes = fs.readFileSync(dbPath);
    Object.assign(manifest.files.find(item => item.path === 'app.db'), { size: bytes.length, sha256: sha(bytes) });
  });
  await pick(olderSettings);
  await page.getByTestId('data-backup-verify').click();
  await expectVisible('data-backup-verify-success');
  await expectVisible('data-backup-continuity', /暂时无法读取换机设置清单/);
  checks.push('A verified old backup without settings tables shows a distinct inventory-unavailable state.');

  const legacy = copyBackup('legacy', manifest => delete manifest.compatibility);
  await pick(legacy);
  await page.getByTestId('data-backup-restore').click();
  await expectVisible('data-backup-restore-ready', /旧备份未记录应用版本/);
  checks.push('A legacy v1 backup with restorable paths still prepares successfully.');

  const legacyRuntime = copyBackup('legacy-runtime', manifest => {
    manifest.compatibility.appVersion = runtimeVersion;
    delete manifest.compatibilityAppVersionSource;
  });
  await pick(legacyRuntime);
  await page.getByTestId('data-backup-restore').click();
  await expectVisible('data-backup-restore-ready', /旧备份记录的是运行时版本/);
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()), dataRoot);
  checks.push('The known legacy launcher runtime version remains restorable as an older backup with no explicit app version.');

  const taggedRuntimeNumber = copyBackup('tagged-new-app', manifest => { manifest.compatibility.appVersion = runtimeVersion; });
  await verifyAndReject(taggedRuntimeNumber, /恢复前请安装/, /请先在新电脑安装/);
  checks.push('An explicitly recorded application version matching the former runtime number remains subject to the newer-app gate.');

  const newerApp = copyBackup('newer-app', manifest => { manifest.compatibility.appVersion = '999.0.0'; });
  await verifyAndReject(newerApp, /恢复前请安装/, /请先在新电脑安装/);
  checks.push('A newer app backup passes file hashes and fails restore preflight before copying.');

  const newerData = copyBackup('newer-data', (manifest, folder) => {
    delete manifest.compatibility;
    const dbPath = path.join(folder, 'app.db');
    const db = new DatabaseSync(dbPath);
    try { db.exec('PRAGMA user_version = 1'); } finally { db.close(); }
    const bytes = fs.readFileSync(dbPath);
    Object.assign(manifest.files.find(item => item.path === 'app.db'), { size: bytes.length, sha256: sha(bytes) });
  });
  await verifyAndReject(newerData, /无法读取此数据库格式/, /无法读取此备份的数据库格式/);
  checks.push('An unsupported actual SQLite data version is rejected even with the app metadata absent.');

  const inconsistent = copyBackup('inconsistent', manifest => { manifest.compatibility.dataVersion = 1; });
  await verifyAndReject(inconsistent, undefined, /版本信息无效或与数据库不一致/, false);
  checks.push('Declared and actual data version must agree.');

  await pick(null);
  await page.getByTestId('data-backup-restore').click();
  await expectVisible('data-backup-cancelled', /已取消恢复/);
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()), dataRoot);
  assert.equal(sha(fs.readFileSync(path.join(exported, 'app.db'))), originalDatabase);
  assert.deepEqual(rendererErrors, []);
  checks.push('Cancel and failed preflight preserve the active data root and original backup bytes.');
} catch (error) {
  reportError = error.stack;
  process.exitCode = 1;
  if (page) await page.screenshot({ path: path.join(root, 'failure.png') }).catch(() => {});
} finally {
  await app?.close();
  const report = { ok: !reportError, root, mainSha256: sha(fs.readFileSync(main)), checks, rendererErrors, error: reportError };
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
