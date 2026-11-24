import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import sqlite3 from 'sqlite3';
import {assertIsolatedPiMain, testMain} from './build-root.mjs';
import {productEntry} from '../product-navigation.mjs';

const desktop = resolve(import.meta.dirname, '../..');
const evidence = resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT || join(desktop, 'test-results'));
const main = testMain(desktop);
const fixtures = join(evidence, 'fixtures');
mkdirSync(fixtures, {recursive:true});
const fixture = mkdtempSync(join(fixtures, 'FX-03-l2-'));
const data = join(fixture, 'data');
const profile = join(fixture, 'profile');
const report = {ok:false, buildMainSha256:createHash('sha256').update(readFileSync(main)).digest('hex'),
  fixture:fixture.split(/[\\/]/u).at(-1), checks:[], errors:[]};
const checks = report.checks;
const env = {...process.env, OMNI_EDU_REPO_ROOT: resolve(desktop,'../..'), OMNI_EDU_DATA_ROOT:data,
  OMNI_EDU_XIAOZHI_PI:'1', DEEPSEEK_API_KEY:'', GLM_API_KEY:''};
for (const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL']) delete env[key];
let app, page, outside;
let stage = 'launch';

function check(name, detail = {}) {
  checks.push({name, ...detail});
  console.log('PASS ' + name);
}
async function until(predicate, timeout = 10000) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    if (await predicate()) return;
    await delay(25);
  }
  throw new Error('Timed out waiting for the specified acceptance condition');
}
const exec = sql => new Promise((resolve, reject) => outside.exec(sql, error => error ? reject(error) : resolve()));
const get = (sql, values) => new Promise((resolve, reject) =>
  outside.get(sql, values, (error, row) => error ? reject(error) : resolve(row)));
const row = id => get(`SELECT e.text,e.version,d.version AS documentVersion,
  (SELECT count(*) FROM ai_memory_revisions WHERE entry_id=e.id) AS revisions
  FROM ai_memory_entries e JOIN ai_memory_documents d ON d.id=e.document_id WHERE e.id=?`, [id]);
const directSave = (id, version, text) => page.evaluate(
  ([id,version,text]) => window.omniEdu.updateAiMemoryEntry(id,{version,text}), [id,version,text]);
const progress = id => page.getByTestId('memory-save-l2-'+id);
const field = id => page.getByTestId('memory-l2-text-'+id);
const refresh = () => page.getByTestId('memory-refresh');
async function uiSave(id, text) {
  await field(id).fill(text);
  await progress(id).click();
}

try {
  app = await electron.launch({args:[main,'--user-data-dir='+profile], cwd:desktop, env, timeout:60000});
  page = await app.firstWindow();
  page.on('pageerror', error=>report.errors.push(error.message));
  await page.waitForFunction(()=>Boolean(window.omniEdu));
  assert.equal(await page.evaluate(()=>window.omniEdu.isXiaozhiEnabled()),true);
  await assertIsolatedPiMain(app, main, profile);
  stage = 'seed';
  outside = await new Promise((resolve,reject)=>{
    const conn = new sqlite3.Database(join(data,'app.db'),sqlite3.OPEN_READWRITE,
      error=>error ? reject(error) : resolve(conn));
  });
  await exec(`PRAGMA busy_timeout=10000;
    PRAGMA foreign_keys=ON;
    INSERT INTO ai_agent_runs(id,prompt,route,status,created_at,updated_at) VALUES
    ('run_r1_fixture','Synthetic acceptance record','general','failed',datetime('now'),datetime('now'));`);
  const created = await page.evaluate(()=>window.omniEdu.createAiMemoryEntry({
    surface:'chat', section:'R1 isolated test', text:'initial', refs:['ai_agent_run:run_r1_fixture'], origin:'teacher',
  }));
  const {id} = created;
  assert.deepEqual(await row(id), {text:'initial',version:1,documentVersion:2,revisions:1});
  stage = 'concurrent version conflict';
  await productEntry(page,'settings').click();
  await page.getByTestId('pi-settings-tab-teacher-memory').click();
  await page.getByTestId('pi-settings-l2-memory').getByRole('button',{name:'可修订的记忆条目'}).click();
  await field(id).waitFor();
  const results = await page.evaluate(async id=>Promise.all(['first','second','third'].map(async text=>{
    try {return {ok:true, text:(await window.omniEdu.updateAiMemoryEntry(id,{version:1,text})).text};}
    catch (error) {return {ok:false, error:error.message};}
  })), id);
  const winners = results.filter(result=>result.ok);
  assert.equal(winners.length,1);
  assert(results.filter(result=>!result.ok).every(result=>/version conflict/i.test(result.error)), JSON.stringify(results));
  assert.deepEqual(await row(id), {text:winners[0].text,version:2,documentVersion:3,revisions:2});
  await uiSave(id, 'stale ui draft');
  await page.getByTestId('memory-error').waitFor();
  assert.match(await page.getByTestId('memory-error').innerText(), /版本冲突/u);
  assert.equal(await field(id).inputValue(),'stale ui draft');
  await page.getByTestId('memory-reapply-l2-'+id).click();
  check('Concurrent same-version writes commit one revision. Stale UI shows version conflict.', {results});

  stage = 'zero-row compare-and-swap';
  await exec(`CREATE TRIGGER r1_zero_change BEFORE UPDATE ON ai_memory_entries
    WHEN NEW.text='r1_zero_change' BEGIN SELECT RAISE(IGNORE); END;`);
  const before = await row(id);
  await assert.rejects(directSave(id,2,'r1_zero_change'), /version conflict/i);
  assert.deepEqual(await row(id), before);
  await exec('DROP TRIGGER r1_zero_change');
  check('A real zero-row CAS exits without revision, document version change, or successful readback.');

  stage = 'failed revision and independent student write';
  await exec(`CREATE TRIGGER r1_revision_failure BEFORE INSERT ON ai_memory_revisions
    WHEN json_extract(NEW.after_json,'$.text')='r1_atomic_failure'
    BEGIN SELECT RAISE(ABORT,'r1_revision_failure'); END;`);
  await app.evaluate((_, packageFile)=>{
    // Pause the original real write between mutations and resume it unchanged.
    const require = process.getBuiltinModule('module').createRequire(packageFile);
    const db = require('sqlite3').Database.prototype;
    const original = db.run;
    const state = {paused:false, studentReachedNative:false, release:null, restore:()=>{db.run=original;}};
    globalThis.r1Fixture = state;
    db.run = function(statement, ...args) {
      if (/^INSERT INTO ai_memory_revisions/u.test(statement) &&
          args.some(arg=>Array.isArray(arg) && arg.some(value=>typeof value==='string' && value.includes('r1_atomic_failure')))) {
        state.paused=true;
        state.release=()=>{state.release=null;original.call(this,statement,...args);};
        return this;
      }
      if (/^INSERT INTO students/u.test(statement)) state.studentReachedNative=true;
      return original.call(this,statement,...args);
    };
  }, join(desktop,'package.json'));
  await uiSave(id, 'r1_atomic_failure');
  await until(()=>app.evaluate(()=>globalThis.r1Fixture.paused));
  assert.deepEqual(await row(id), before);
  await page.evaluate(()=>{
    window.r1Student = {settled:false};
    void window.omniEdu.createStudent({displayName:'R1 student fixture'}).then(
      value=>Object.assign(window.r1Student,{settled:true, found:value.some(row=>row.displayName==='R1 student fixture')}),
      error=>Object.assign(window.r1Student,{settled:true,error:error.message}));
  });
  await until(()=>app.evaluate(()=>globalThis.r1Fixture.studentReachedNative));
  assert.equal(await page.evaluate(()=>window.r1Student.settled),false);
  await refresh().click();
  assert.deepEqual(await row(id), before);
  await app.evaluate(()=>{globalThis.r1Fixture.release();globalThis.r1Fixture.restore();});
  await until(async()=>{
    const error = page.getByTestId('memory-error');
    return await error.isVisible() && (await error.innerText()).includes('保存失败');
  });
  assert.equal(await page.getByTestId('memory-success').count(),0);
  await until(()=>page.evaluate(()=>window.r1Student.settled));
  assert.deepEqual(await page.evaluate(()=>window.r1Student), {settled:true,found:true});
  await until(async()=>!await refresh().isDisabled());
  assert.equal((await get("SELECT COUNT(*) AS n FROM students WHERE display_name='R1 student fixture'")).n,1);
  assert.deepEqual(await row(id), before);
  await exec('DROP TRIGGER r1_revision_failure');
  check('SQL trigger abort rolls back entry and revision. Concurrent student IPC settles separately and persists.');

  stage = 'failure at commit after document version update';
  await exec(`CREATE TABLE r1_deferred_child (
      parent TEXT REFERENCES ai_memory_documents(id) DEFERRABLE INITIALLY DEFERRED
    );
    CREATE TRIGGER r1_block_commit AFTER UPDATE ON ai_memory_documents
    WHEN EXISTS(SELECT 1 FROM ai_memory_entries WHERE document_id=NEW.id AND text='r1_block_commit')
    BEGIN INSERT INTO r1_deferred_child VALUES('missing_document'); END;`);
  await uiSave(id,'r1_block_commit');
  await until(async()=>await page.getByTestId('memory-error').isVisible());
  assert.equal(await page.getByTestId('memory-success').count(),0);
  assert.deepEqual(await row(id),before);
  assert.equal((await get('SELECT count(*) AS n FROM r1_deferred_child')).n,0);
  await exec('DROP TRIGGER r1_block_commit; DROP TABLE r1_deferred_child;');
  check('Deferred foreign-key failure at COMMIT rolls back entry, revision and document version.');

  stage = 'release external lock';
  await exec('BEGIN IMMEDIATE');
  await uiSave(id,'r1_lock_release');
  assert.equal(await progress(id).isDisabled(),true);
  await refresh().click();
  await until(async()=>!await refresh().isDisabled());
  assert.deepEqual(await row(id),before);
  await exec('COMMIT');
  await page.getByTestId('memory-success').waitFor();
  assert.deepEqual(await row(id),{text:'r1_lock_release',version:3,documentVersion:4,revisions:3});
  check('The actual renderer stays responsive under an external write lock and saves when released.');

  stage = 'lock deadline and subsequent retry';
  await exec('BEGIN IMMEDIATE');
  const start = performance.now();
  await uiSave(id,'r1_expired');
  await until(async()=>await page.getByTestId('memory-error').isVisible(),13000);
  const waited = Math.round(performance.now()-start);
  assert(waited>=9700 && waited<13000, String(waited));
  assert.match(await page.getByTestId('memory-error').innerText(),/数据库正忙/u);
  await exec('COMMIT');
  assert.equal((await row(id)).text,'r1_lock_release');
  assert.equal((await row(id)).revisions,3);
  await uiSave(id,'r1_after_timeout');
  await page.getByTestId('memory-success').waitFor();
  assert.deepEqual(await row(id),{text:'r1_after_timeout',version:4,documentVersion:5,revisions:4});
  check('Ten-second lock deadline rejects and never commits late. Subsequent user write succeeds.', {waited});

  stage = 'cancel save during external lock';
  const beforeCancel = await row(id);
  await exec('BEGIN IMMEDIATE');
  await uiSave(id,'r1_cancelled');
  await page.getByTestId('memory-cancel-l2-'+id).click();
  await page.getByTestId('memory-cancelled').waitFor();
  assert.equal(await page.getByTestId('memory-success').count(),0);
  assert.equal(await field(id).inputValue(),'r1_cancelled');
  await exec('COMMIT');
  assert.deepEqual(await row(id),beforeCancel);
  await uiSave(id,'r1_after_cancel');
  await page.getByTestId('memory-success').waitFor();
  assert.deepEqual(await row(id),{text:'r1_after_cancel',version:5,documentVersion:6,revisions:5});
  check('Visible cancellation while an outside writer holds the lock preserves the draft, never commits late, and releases the connection.');
  assert.equal((await get('PRAGMA integrity_check')).integrity_check,'ok');
  assert.equal(await get('PRAGMA foreign_key_check'),undefined);
  assert.deepEqual(report.errors,[]);
  report.ok=true;
} catch(error) {
  report.failedStage=stage;
  report.error=error.stack;
  console.error(error);
  process.exitCode=1;
} finally {
  await app?.evaluate(()=>{globalThis.r1Fixture?.release?.();globalThis.r1Fixture?.restore();}).catch(()=>{});
  if(outside) await new Promise(resolve=>outside.close(()=>resolve()));
  await app?.close().catch(()=>{});
  writeFileSync(join(fixture,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}
