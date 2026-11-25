import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { assertIsolatedPiMain, testMain } from '../acceptance/build-root.mjs';
import {addTask} from '../acceptance/db-foundation-r1-task-fixture.mjs';

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
const timings = {};
const rendererErrors = [];
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : value && typeof value === 'object'
    ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
    : JSON.stringify(value);
const protocolHash = value => sha(canonical(value));
let app, page, exported, reportError;

function seedPortableFixture() {
  const at = '2026-11-21T00:00:00.000Z';
  const sessionId = 'aisession_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const profile = {schemaVersion: 1, sessionId, revision: 4, mode: 'fullAccess', updatedAt: at};
  const scope = {kind: 'filesystem', root: path.join(root, 'old-computer'), identity: sha('directory'), actions: ['read']};
  const grant = {schemaVersion: 1, grantId: 'xigrant_fixture', revision: 1, sessionId, taskId: null, scope,
    provenance: {kind: 'teacher', reference: 'fixture'}, createdAt: at, expiresAt: null, revokedAt: null};
  const markers = ['fixture-deepseek-token', 'fixture-glm-token', 'fixture-shared-token', 'fixture-material-token',
    'fixture-mcp-token', 'fixture-mcp-argument-credential', 'fixture-env-credential', 'fixture-previous-model-token',
    'fixture-protected-legacy-deepseek', 'fixture-protected-legacy-glm'];
  const db = new DatabaseSync(path.join(dataRoot, 'app.db'));
  try {
    const put = db.prepare('INSERT OR REPLACE INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)');
    const save = (key, value) => put.run(key, JSON.stringify(value), at);
    save('deepseek', {model:'deepseek-pro', apiKey: markers[0], sealedKey: markers[8]});
    save('glm', {model:'glm-4', apiKey: markers[1], sealedKey: markers[9]});
    save('xiaozhi.provider.v1', {schema:1, revision:4, defaultModel:'deepseek-pro', sealedKey:markers[7]});
    save('xiaozhi.provider.v1', {schema:1, revision:5, defaultModel:'deepseek-pro', sealedKey:markers[2]});
    save('xiaozhi.material-ai.v1', {revision:1, model:'qwen3-vl-plus', sealedKey:markers[3]});
    save('xiaozhi.mcp.v1', {schemaVersion:1, revision:1, servers: [{sealedSecret:markers[4], args:[markers[5]]}]});
    save('xiaozhi.thinking.default', {schema:1, revision:1, choice:'high'});
    db.exec("INSERT INTO app_settings(rowid,key,value_json,updated_at) VALUES(999,'fixture.portable.cursor','{}','2026-11-21')");
    db.prepare('INSERT INTO ai_conversation_sessions(id,title,created_at,updated_at) VALUES(?,?,?,?)').run(sessionId, '合成换机对话', at, at);
    addTask(db,37,100);
    db.prepare('INSERT INTO xiaozhi_permission_profiles_v1 VALUES(?,?,?,?)').run(sessionId, profile.revision, JSON.stringify(profile), protocolHash(profile));
    db.prepare('INSERT INTO xiaozhi_permission_grants_v1 VALUES(?,?,?,?,?,?,?,?)').run(grant.grantId, sessionId, null, 1, 0,
      JSON.stringify(grant), protocolHash(grant), at);
    for (const state of ['pending','approved','executing','executed']) {
      const action = 'local-read-' + state, taskId = 'task_fixture', runId = 'run_fixture';
      const common = {requirementsVersion: 1, action, inputDigest: sha(action), scopes: [scope], files: [],
        provider: null, classification: 'teacher_private'};
      const request = {...common, schemaVersion: 2, owner: {sessionId, taskId, runId, generation: 1},
        callId: action, purpose: '换机审批', expiresAt: '2099-01-01T00:00:00.000Z'};
      const id = 'confirm_' + state;
      const approval = {schemaVersion: 2, id, revision: 1, request, requestDigest: protocolHash({...common, sessionId, taskId}),
        permissionSnapshotHash: sha('fixture'), grantRefs: [{grantId: grant.grantId, revision: 1}], state,
        scope: 'operation', createdAt: at, updatedAt: at};
      db.prepare(`INSERT INTO ai_confirmation_items(id,run_id,session_id,action_type,status,title,payload_json,created_at,updated_at)
        VALUES(?,?,?,'xiaozhi_permission_v2',?,?,?,?,?)`).run(id, runId, sessionId, state === 'pending' ? 'pending' : 'confirmed',
        '合成审批', JSON.stringify(approval), at, at);
    }
  } finally { db.close(); }
  fs.writeFileSync(path.join(dataRoot, '.env.local'), 'DEEPSEEK_API_KEY=' + markers[6]);
  fs.writeFileSync(path.join(dataRoot, '换机资料.md'), '# 合成备课资料\n');
  return {markers, sessionId};
}

function checkPortableDatabase(file, marker, sessionId, portable) {
  const db = new DatabaseSync(file, {readOnly: true});
  try {
    const setting = key => {
      const row = db.prepare('SELECT value_json FROM app_settings WHERE key=?').get(key);
      return row && JSON.parse(row.value_json);
    };
    assert.equal(setting('xiaozhi.provider.v1').defaultModel, 'deepseek-pro');
    assert.equal(setting('xiaozhi.provider.v1').sealedKey, portable ? undefined : marker);
    assert.equal(setting('xiaozhi.thinking.default').choice, 'high');
    assert.equal(db.prepare("SELECT rowid FROM app_settings WHERE key='fixture.portable.cursor'").get().rowid, 999);
    assert.equal(setting('deepseek').model, 'deepseek-pro');
    for(const provider of ['deepseek','glm']){
      assert.equal(Object.hasOwn(setting(provider),'apiKey'),!portable);
      assert.equal(Object.hasOwn(setting(provider),'sealedKey'),!portable);
    }
    assert.equal(Boolean(setting('xiaozhi.mcp.v1')), !portable);
    assert.equal(db.prepare('SELECT title FROM ai_conversation_sessions WHERE id=?').get(sessionId).title, '合成换机对话');
    const profile = db.prepare('SELECT document_json FROM xiaozhi_permission_profiles_v1 WHERE session_id=?').get(sessionId);
    assert.equal(JSON.parse(profile.document_json).mode, portable ? 'request' : 'fullAccess');
    assert.equal(db.prepare('SELECT revoked FROM xiaozhi_permission_grants_v1 WHERE session_id=?').get(sessionId).revoked, portable ? 1 : 0);
    const approvals = db.prepare("SELECT payload_json FROM ai_confirmation_items WHERE session_id=? AND action_type='xiaozhi_permission_v2' ORDER BY id").all(sessionId);
    assert.deepEqual(approvals.map(row => JSON.parse(row.payload_json).state),
      portable ? ['invalidated','executed','uncertain','invalidated'] : ['approved','executed','executing','pending']);
    const historical=db.prepare("SELECT state,revision,idempotency_key FROM xiaozhi_effects_v1 WHERE run_id='airun_r1_37'").get();
    assert.deepEqual({...historical},{state:'unknown',revision:1,idempotency_key:'r1-effect:airun_r1_37'});
  } finally { db.close(); }
}

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
        : /完整数据目录备份位置|换机包目录/u.test(title) ? exportsRoot
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
  const opened = new DatabaseSync(path.join(exported,'app.db'),{readOnly:true});
  let dataVersion;
  try {dataVersion=opened.prepare('PRAGMA user_version').get().user_version;}
  finally {opened.close();}
  assert(dataVersion >= 1, 'A current export must be a managed database');
  assert.deepEqual(manifest.compatibility, { appVersion: applicationVersion, dataVersion });
  assert.equal(manifest.compatibilityAppVersionSource,'desktop');
  const originalDatabase = sha(fs.readFileSync(path.join(exported, 'app.db')));
  assert((await page.getByTestId('data-backup-compatibility').innerText()).includes(applicationVersion));
  checks.push('Settings exports verified files with the actual Electron app version and SQLite user_version.');

  await pick(exported);
  await page.getByTestId('data-backup-restore').click();
  await page.getByTestId('data-backup-restore-prepare').click();
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
  await page.getByTestId('data-backup-restore-prepare').click();
  const ready = await expectVisible('data-backup-restore-ready');
  await ready.getByText('换机前核对', {exact:true}).click();
  assert.match(await ready.getByTestId('data-backup-continuity').innerText(), /会话覆盖 1 项/);
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()), dataRoot);
  assert.equal(sha(fs.readFileSync(settingsDb)), settingsHash);
  checks.push('The prepared-copy view carries the same read-only inventory and keeps the original active.');

  const missingSettings = copyBackup('managed-missing-settings', (manifest, folder) => {
    const dbPath = path.join(folder, 'app.db');
    const db = new DatabaseSync(dbPath);
    try { db.exec('PRAGMA journal_mode=DELETE; DROP TABLE app_settings'); } finally { db.close(); }
    const bytes = fs.readFileSync(dbPath);
    Object.assign(manifest.files.find(item => item.path === 'app.db'), { size: bytes.length, sha256: sha(bytes) });
  });
  await verifyAndReject(missingSettings, undefined, /invalid_ledger/, false);
  checks.push('A managed backup missing a required table is rejected before copying, even with correct file hashes.');

  for(const [name,statement] of [
    ['unknown-migration',"UPDATE xiaozhi_schema_migrations SET migration_id='unrecognized' WHERE to_version=1"],
    ['invalid-checksum',"UPDATE xiaozhi_schema_migrations SET checksum=printf('%064d',0) WHERE to_version=1"],
  ]){
    const corrupt=copyBackup(name,(manifest,folder)=>{
      const file=path.join(folder,'app.db'),db=new DatabaseSync(file);
      try {db.exec(statement);}finally {db.close();}
      const bytes=fs.readFileSync(file);
      Object.assign(manifest.files.find(item=>item.path==='app.db'),{size:bytes.length,sha256:sha(bytes)});
    });
    await verifyAndReject(corrupt, undefined, /invalid_ledger/, false);
    checks.push('Restore rejects a managed backup with '+name+' before copying.');
  }

  const historicalBuild = path.resolve(process.env.OMNI_EDU_DB_V0_BUILD ||
    path.join(desktop, 'test-results/xiaozhi-db-r1-baseline/out/main/index.js'));
  const historicalData = path.join(root, 'v0-data');
  const historicalProfile = path.join(root, 'v0-profile');
  const oldApp = await electron.launch({args:[historicalBuild, '--user-data-dir='+historicalProfile],
    cwd:desktop,env:{...env,OMNI_EDU_DATA_ROOT:historicalData},timeout:60000});
  let oldStudent;
  try {
    const oldPage = await oldApp.firstWindow();
    await assertIsolatedPiMain(oldApp,historicalBuild,historicalProfile);
    [oldStudent] = await oldPage.evaluate(()=>window.omniEdu.createStudent({displayName:'历史恢复夹具'}));
  } finally { await oldApp.close(); }
  const historicalDb = path.join(historicalData,'app.db');
  const historicalHash = sha(fs.readFileSync(historicalDb));
  const selectionPath = path.join(profile,'xiaozhi-data-selection.v1.json');
  const selectionBytes = () => fs.existsSync(selectionPath)?sha(fs.readFileSync(selectionPath)):null;
  for (const [name,statement] of [
    ['v0-missing-table','DROP TABLE learning_records'],
    ['v0-missing-column','ALTER TABLE app_settings RENAME COLUMN value_json TO fixture_broken_value'],
  ]) {
    const source = copyBackup(name, (manifest, folder) => {
      const file = path.join(folder,'app.db');
      fs.copyFileSync(historicalDb,file);
      const db = new DatabaseSync(file, {enableForeignKeyConstraints:false});
      try {db.exec('PRAGMA journal_mode=DELETE; '+statement);} finally {db.close();}
      const bytes = fs.readFileSync(file);
      Object.assign(manifest.files.find(item=>item.path==='app.db'), {size:bytes.length,sha256:sha(bytes)});
      manifest.compatibility.dataVersion = 0;
    });
    const filesBefore = fs.readdirSync(source).sort();
    const dbBefore = sha(fs.readFileSync(path.join(source,'app.db')));
    const manifestBefore = sha(fs.readFileSync(path.join(source,manifestFile)));
    const activeSelection = selectionBytes();
    await pick(source);
    const verified = await page.evaluate(()=>window.omniEdu.verifyDataBackup());
    assert.equal(verified.verified,false,`${name}: backup verification accepted unknown SQLite v0`);
    assert.match(verified.errorMessage,/unknown_legacy/);
    await verifyAndReject(source,undefined,/unknown_legacy/,false);
    assert.deepEqual(fs.readdirSync(source).sort(),filesBefore);
    assert.equal(sha(fs.readFileSync(path.join(source,'app.db'))),dbBefore);
    assert.equal(sha(fs.readFileSync(path.join(source,manifestFile))),manifestBefore);
    assert.equal(selectionBytes(),activeSelection);
  }
  const supportedV0 = copyBackup('v0-supported', (manifest, folder) => {
    fs.copyFileSync(historicalDb,path.join(folder,'app.db'));
    Object.assign(manifest.files.find(item=>item.path==='app.db'),
      {size:fs.statSync(historicalDb).size,sha256:historicalHash});
    manifest.compatibility.dataVersion = 0;
  });
  const supportedBefore=fs.readdirSync(supportedV0).sort();
  await pick(supportedV0);
  await page.getByTestId('data-backup-restore').click();
  await page.getByTestId('data-backup-restore-prepare').click();
  const historicalCopy = await expectVisible('data-backup-restore-ready');
  const copyRoot = await historicalCopy.locator('.pi-settings-location').innerText();
  const chooseManually=()=>app.evaluate(()=>{
    process.env.OMNI_EDU_E2E_DIALOG_MODE='1';
    process.env.OMNI_EDU_E2E_RESTORE_RELAUNCH='manual';
  });
  const changeSelection=async (button,expected)=>{
    await chooseManually();
    await page.getByTestId(button).click();
    const expiry=Date.now()+30000;
    while(Date.now()<expiry && !(fs.existsSync(selectionPath) && JSON.parse(fs.readFileSync(selectionPath,'utf8')).dataRoot===expected)){
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert(fs.existsSync(selectionPath),'No restore selection was persisted: '+await page.getByTestId('data-backup-panel').innerText());
    assert.equal(JSON.parse(fs.readFileSync(selectionPath,'utf8')).dataRoot,expected);
    await app.close();
    app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
    page=await app.firstWindow();
    page.on('pageerror',error=>rendererErrors.push(String(error)));
    await assertIsolatedPiMain(app,main,profile);
    assert.equal(await page.evaluate(()=>window.omniEdu.getDataRoot()),expected);
    await page.getByRole('button',{name:'设置',exact:true}).click();
    await page.getByTestId('pi-settings-tab-backup').click();
  };
  await changeSelection('data-backup-restore-activate',copyRoot);
  const [student] = await page.evaluate(()=>window.omniEdu.listStudents('历史恢复夹具'));
  assert.equal(student?.id,oldStudent.id);
  assert.equal((await page.evaluate(()=>window.omniEdu.getXiaozhiResolvedAgentConfig())).value.prepared.status,'not_recorded');
  const upgraded = new DatabaseSync(path.join(copyRoot,'app.db'),{readOnly:true});
  try {
    assert.equal(upgraded.prepare('PRAGMA user_version').get().user_version,dataVersion);
    assert.deepEqual(upgraded.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {upgraded.close();}
  assert.equal(sha(fs.readFileSync(historicalDb)),historicalHash);
  assert.equal(sha(fs.readFileSync(path.join(supportedV0,'app.db'))),historicalHash);
  assert.deepEqual(fs.readdirSync(supportedV0).sort(),supportedBefore);
  await changeSelection('data-backup-restore-revert',dataRoot);
  assert.equal(await page.evaluate(()=>window.omniEdu.getDataRoot()),dataRoot);
  checks.push({name:'Historical v0 verifies and cold upgrades; missing table and column reject without altering the source or active root.',
    historicalBuild, historicalBuildSha256:sha(fs.readFileSync(historicalBuild)), historicalHash, copyRoot});

  const legacy = copyBackup('legacy', manifest => delete manifest.compatibility);
  await pick(legacy);
  await page.getByTestId('data-backup-restore').click();
  await page.getByTestId('data-backup-restore-prepare').click();
  await expectVisible('data-backup-restore-ready', /旧备份未记录应用版本/);
  checks.push('A legacy v1 backup with restorable paths still prepares successfully.');

  const legacyRuntime = copyBackup('legacy-runtime', manifest => {
    manifest.compatibility.appVersion = runtimeVersion;
    delete manifest.compatibilityAppVersionSource;
  });
  await pick(legacyRuntime);
  await page.getByTestId('data-backup-restore').click();
  await page.getByTestId('data-backup-restore-prepare').click();
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
    try { db.exec('PRAGMA user_version = '+(dataVersion+1)); } finally { db.close(); }
    const bytes = fs.readFileSync(dbPath);
    Object.assign(manifest.files.find(item => item.path === 'app.db'), { size: bytes.length, sha256: sha(bytes) });
  });
  await verifyAndReject(newerData, /无法读取此数据库格式/, /无法读取此备份的数据库格式/);
  checks.push('An unsupported actual SQLite data version is rejected even with the app metadata absent.');

  const inconsistent = copyBackup('inconsistent', manifest => { manifest.compatibility.dataVersion = dataVersion+1; });
  await verifyAndReject(inconsistent, undefined, /版本信息无效或与数据库不一致/, false);
  checks.push('Declared and actual data version must agree.');

  await pick(null);
  await page.getByTestId('data-backup-restore').click();
  await expectVisible('data-backup-cancelled', /已取消恢复/);
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()), dataRoot);
  assert.equal(sha(fs.readFileSync(path.join(exported, 'app.db'))), originalDatabase);
  assert.deepEqual(rendererErrors, []);
  checks.push('Cancel and failed preflight preserve the active data root and original backup bytes.');

  const {markers, sessionId} = seedPortableFixture();
  const portableStart = performance.now();
  await page.getByTestId('data-backup-portable-export').click();
  await expectVisible('data-backup-export-success', /换机包已生成并通过校验/);
  await expectVisible('data-backup-portable', /新电脑配置模型密钥/);
  const portable = await page.getByTestId('data-backup-export-path').innerText();
  const portableDb = path.join(portable, 'app.db');
  const portableBytes = fs.readFileSync(portableDb);
  timings.portableExportMs = Math.round(performance.now() - portableStart);
  timings.portableDatabaseBytes = portableBytes.length;
  assert.equal(JSON.parse(fs.readFileSync(path.join(portable, manifestFile), 'utf8')).purpose, 'portable');
  assert(!fs.existsSync(path.join(portable, '.env.local')));
  assert(!fs.existsSync(portableDb + '-wal'));
  assert.equal(fs.readFileSync(path.join(portable, '换机资料.md'), 'utf8'), '# 合成备课资料\n');
  for (const mark of markers) assert(!portableBytes.includes(mark), 'Portable bytes contain a fixture credential');
  checkPortableDatabase(portableDb, markers[2], sessionId, true);
  checkPortableDatabase(path.join(dataRoot, 'app.db'), markers[2], sessionId, false);
  checks.push('The portable Settings export preserves teaching data and preferences, removes registered credentials from SQLite bytes and resets prior authority without changing the source.');

  await pick(portable);
  await page.getByTestId('data-backup-verify').click();
  await expectVisible('data-backup-verify-success');
  await expectVisible('data-backup-portable');
  const beforePreview = fs.readdirSync(restoreRoot);
  await app.evaluate(async (electron, target) => {
    const fs = process.getBuiltinModule('node:fs/promises');
    const statfs = fs.statfs;
    globalThis.restoreSpaceProbe = () => {fs.statfs = statfs;};
    fs.statfs = (file, options) => file === target
      ? Promise.resolve({bavail: 1n, bsize: 4096n})
      : statfs(file, options);
  }, restoreRoot);
  await page.getByTestId('data-backup-restore').click();
  const blocked = await expectVisible('data-backup-restore-preview', /目标盘空间不足/);
  assert(await blocked.getByTestId('data-backup-restore-prepare').isDisabled());
  assert.deepEqual(fs.readdirSync(restoreRoot), beforePreview);
  await app.evaluate(() => globalThis.restoreSpaceProbe());
  await page.getByTestId('data-backup-restore').click();
  const preview = await expectVisible('data-backup-restore-preview', /新电脑配置模型密钥/);
  assert.match(await preview.getByTestId('data-backup-restore-space').innerText(), /预计至少需要 .*目标盘可用/);
  assert.match(await preview.innerText(), /备份文件合计/);
  assert.deepEqual(fs.readdirSync(restoreRoot), beforePreview);
  await page.setViewportSize({width:1366,height:768});
  await preview.getByTestId('data-backup-restore-prepare').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(root, 'restore-preflight-1366.png')});
  checks.push('Restore previews real capacity with no copy, and disables preparation in the controlled insufficient-space branch.');
  await preview.getByTestId('data-backup-restore-prepare').click();
  const portableReady = await expectVisible('data-backup-restore-ready', /新电脑配置模型密钥/);
  const migratedRoot = await portableReady.locator('.pi-settings-location').innerText();
  checkPortableDatabase(path.join(migratedRoot, 'app.db'), markers[2], sessionId, true);
  assert.equal(fs.readFileSync(path.join(migratedRoot, '换机资料.md'), 'utf8'), '# 合成备课资料\n');
  for (const size of [{width:1366,height:768}, {width:1920,height:1080}]) {
    await page.setViewportSize(size);
    await portableReady.scrollIntoViewIfNeeded();
    const button = page.getByTestId('data-backup-restore-activate');
    assert(await button.isVisible());
    assert(await button.evaluate(element => element.getBoundingClientRect().right <= innerWidth));
    await page.screenshot({path:path.join(root, 'portable-' + size.width + '.png')});
  }
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()), dataRoot);
  assert.equal(sha(fs.readFileSync(portableDb)), sha(portableBytes));
  checks.push('Verification and restore show the reconfiguration notice and leave the original workspace selected.');

  const fullStart = performance.now();
  await page.getByTestId('data-backup-export').click();
  await expectVisible('data-backup-export-success', /完整数据备份已生成/);
  const full = await page.getByTestId('data-backup-export-path').innerText();
  timings.fullExportMs = Math.round(performance.now() - fullStart);
  timings.fullDatabaseBytes = fs.statSync(path.join(full, 'app.db')).size;
  checkPortableDatabase(path.join(full, 'app.db'), markers[2], sessionId, false);
  assert(fs.existsSync(path.join(full, '.env.local')));
  const mislabeled = path.join(root, 'mislabeled-transfer');
  fs.cpSync(full, mislabeled, {recursive: true});
  fs.unlinkSync(path.join(mislabeled, '.env.local'));
  const wrongManifest = path.join(mislabeled, manifestFile);
  const wrong = JSON.parse(fs.readFileSync(wrongManifest, 'utf8'));
  wrong.purpose = 'portable';
  wrong.files = wrong.files.filter(entry => entry.path !== '.env.local');
  wrong.fileCount = wrong.files.length;
  fs.writeFileSync(wrongManifest, JSON.stringify(wrong));
  await verifyAndReject(mislabeled, undefined, /未通过凭据和授权核对/, false);
  checks.push('Full backups retain same-machine settings, and a full database mislabeled as portable fails verification and restore.');

  await pick(portable);
  await page.getByTestId('data-backup-restore').click();
  await page.getByTestId('data-backup-restore-prepare').click();
  const toActivate = await expectVisible('data-backup-restore-ready');
  assert.equal(await page.getByTestId('portable-recovery-checklist').count(), 0);
  const activeCopy = await toActivate.locator('.pi-settings-location').innerText();
  const selectionFile = path.join(profile, 'xiaozhi-data-selection.v1.json');
  await app.evaluate(() => {
    process.env.OMNI_EDU_E2E_DIALOG_MODE = '1';
    process.env.OMNI_EDU_E2E_RESTORE_RELAUNCH = 'manual';
  });
  await toActivate.getByTestId('data-backup-restore-activate').click();
  const selected = async expected => {
    const end = Date.now() + 30000;
    while (Date.now() < end) {
      if (fs.existsSync(selectionFile) && JSON.parse(fs.readFileSync(selectionFile, 'utf8')).dataRoot === expected) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail('Data selection did not reach the expected root');
  };
  await selected(activeCopy);
  const relaunch = async () => {
    await app.close();
    app = await electron.launch({args: [main, '--user-data-dir=' + profile], cwd: desktop, env, timeout: 60000});
    page = await app.firstWindow();
    page.on('pageerror', error => rendererErrors.push(String(error)));
    await assertIsolatedPiMain(app, main, profile);
    await page.getByRole('button', {name:'设置', exact:true}).click();
    await page.getByTestId('pi-settings-tab-backup').click();
    await expectVisible('data-backup-panel');
  };
  await relaunch();
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()), activeCopy);
  checkPortableDatabase(path.join(activeCopy,'app.db'),markers[2],sessionId,true);
  assert(!fs.existsSync(path.join(activeCopy,'r1-test.txt')));
  const settings = await page.evaluate(() => window.omniEdu.getXiaozhiSettings());
  assert.equal(settings.ok, true);
  const restoredModel = settings.value;
  assert.equal(restoredModel.configured, false);
  assert.equal(restoredModel.defaultModel, 'deepseek-pro');
  assert.equal(restoredModel.thinking.global.choice, 'high');
  const checklist = await expectVisible('portable-recovery-checklist', /已启用换机副本/);
  await expectVisible('portable-recovery-model-status', /默认模型 deepseek-pro.*需要配置本机密钥/);
  await expectVisible('portable-recovery-tool-status', /尚未配置本机连接/);
  await expectVisible('portable-recovery-index-status');
  for (const size of [{width:1366,height:768}, {width:1920,height:1080}]) {
    await page.setViewportSize(size);
    const button = checklist.getByTestId('portable-recovery-models');
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    assert(box && box.x >= 0 && box.x + box.width <= size.width && box.y >= 0 && box.y + box.height <= size.height);
    await page.screenshot({path:path.join(root, `portable-recovery-${size.width}.png`)});
  }
  for (const [destination, testId] of [['tools','pi-mcp-empty'], ['permissions','pi-settings-workspace-choose'], ['capabilities','pi-capability-manage-tools']]) {
    await checklist.getByTestId('portable-recovery-' + destination).click();
    assert.equal(await page.getByTestId('pi-settings-workspace').getAttribute('data-tab'), destination);
    await expectVisible(testId);
    await page.getByTestId('pi-settings-tab-backup').click();
    await expectVisible('portable-recovery-checklist');
  }
  checks.push('A portable copy is selected using the real Settings action. After a cold restart the checklist reflects the restored default model and directs teachers to the existing settings.');

  await app.evaluate(({net}) => {
    globalThis.recoveryNetwork = [];
    net.fetch = async input => {
      const url = new URL(typeof input === 'string' ? input : input.url);
      globalThis.recoveryNetwork.push(url.pathname);
      if (url.hostname !== 'api.deepseek.com' || !url.pathname.endsWith('/models')) throw Error('Fixture forbids external traffic');
      return new Response(JSON.stringify({object:'list',data:[{
        id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,
      }]}), {headers:{'content-type':'application/json'}});
    };
  });
  await checklist.getByTestId('portable-recovery-models').click();
  await page.getByTestId('pi-settings-key').fill('synthetic-new-device-key');
  await page.getByTestId('pi-settings-verify').click();
  await expectVisible('pi-settings-feedback', /密钥验证通过/);
  await expectVisible('pi-settings-model-unavailable', /deepseek-pro/);
  assert.match(await page.getByTestId('pi-settings-default-model').innerText(), /deepseek-pro/);
  assert(await page.getByTestId('pi-settings-save').isDisabled());
  await page.getByTestId('pi-settings-default-model').click();
  await page.getByRole('menuitemradio', {name:'deepseek-flash',exact:true}).click();
  await page.getByTestId('pi-settings-save').click();
  await expectVisible('pi-settings-feedback', /已保存/);
  await page.getByTestId('pi-settings-tab-backup').click();
  await expectVisible('portable-recovery-model-status', /deepseek-flash.*已配置本机密钥/);
  assert.deepEqual(await app.evaluate(() => globalThis.recoveryNetwork.map(path => path.endsWith('/models'))), [true,true]);
  checks.push('An unlisted preference stays selected until the teacher explicitly chooses a supported model. Saving via the original form refreshes the checklist, with a synthetic local catalogue.');

  await app.evaluate(() => {
    process.env.OMNI_EDU_E2E_DIALOG_MODE = '1';
    process.env.OMNI_EDU_E2E_RESTORE_RELAUNCH = 'manual';
  });
  await page.getByTestId('data-backup-restore-revert').click();
  await selected(dataRoot);
  await relaunch();
  assert.equal(await page.evaluate(() => window.omniEdu.getDataRoot()), dataRoot);
  assert.equal(await page.getByTestId('portable-recovery-checklist').count(), 0);
  assert(fs.existsSync(path.join(activeCopy, '换机资料.md')));
  assert.deepEqual(rendererErrors, []);
  checks.push('Returning to the original workspace after restart removes the checklist and preserves the portable copy.');
} catch (error) {
  reportError = error.stack;
  process.exitCode = 1;
  if (page) await page.screenshot({ path: path.join(root, 'failure.png') }).catch(() => {});
} finally {
  await app?.close();
  const report = { ok: !reportError, root, mainSha256: sha(fs.readFileSync(main)), checks, timings, rendererErrors, error: reportError };
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
