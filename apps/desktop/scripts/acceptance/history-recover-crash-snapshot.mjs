import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {testMain, assertIsolatedPiMain} from './build-root.mjs';

const desktop = path.resolve(import.meta.dirname, '../..');
const root = fs.realpathSync(process.env.OMNI_EDU_ACCEPTANCE_ROOT);
const fixture = fs.realpathSync(process.argv[2]);
assert.equal(path.dirname(fixture), root, 'Use the owned failed acceptance snapshot');
const prior = JSON.parse(fs.readFileSync(path.join(fixture, 'report.json'), 'utf8'));
assert.equal(prior.ok, false);
assert.equal(prior.interruption?.statusBefore, 'running');
assert.equal(prior.interruption?.heldRequests, 1);
const diagnostic = JSON.parse(fs.readFileSync(path.join(fixture,'profile','xiaozhi-database-startup.json'),'utf8'));
assert.equal(diagnostic.issue, 'startup_failed');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source = path.join(fixture, 'data');
function originals() {
  return ['app.db','app.db-wal'].map(name => hash(path.join(source, name)));
}
const before = originals();
const output = fs.mkdtempSync(path.join(root, 'history-crash-recovery-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
fs.cpSync(source, data, {recursive:true, filter:file => path.basename(file)!=='app.db-shm'});
assert.deepEqual(['app.db','app.db-wal'].map(name=>hash(path.join(data,name))), before);
const main = testMain(desktop);
const runId = prior.interruption.runId;
function state() {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly:true});
  try {
    const {session_id: sessionId,status} = db.prepare('SELECT session_id,status FROM ai_agent_runs WHERE id=?').get(runId);
    const grants = db.prepare("SELECT value_json FROM app_settings WHERE key GLOB 'xiaozhi.memory-use.task.v1:*' AND json_extract(value_json,'$.sessionId')=? ORDER BY key").all(sessionId).map(row=>JSON.parse(row.value_json));
    const scope = db.prepare('SELECT version,payload_json FROM xiaozhi_pi_memory_scopes WHERE conversation_id=?').get(sessionId);
    const runs = db.prepare('SELECT id FROM ai_agent_runs WHERE session_id=? ORDER BY id').all(sessionId).map(row=>row.id);
    const effects = db.prepare('SELECT effect_id,revision,state FROM xiaozhi_effects_v1 WHERE session_id=? ORDER BY effect_id').all(sessionId);
    return {status, sessionId, grants, scope, runs, effects};
  } finally { db.close(); }
}
const initial = state();
assert.equal(initial.status, 'running');
assert.deepEqual(initial.runs, [runId]);
assert.deepEqual(initial.effects, []);
assert.equal(initial.grants.length, 1);
assert.equal(initial.grants[0].admittedBy.runId, runId);
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1',
  OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_E2E_DIALOG_MODE:'1'};
for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY','OPENAI_API_KEY','GLM_API_KEY'])delete env[key];
const report={ok:false,root:output,originalBuild:prior.build,build:hash(main),snapshot:before,runId,
  initialStatus:initial.status,taskId:initial.grants[0].taskId,openings:[]};
let app;
try {
  for(let opening=0;opening<2;opening++){
    app=await _electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop});
    await assertIsolatedPiMain(app,main,profile);
    const page=await app.firstWindow();
    await page.getByTestId('xiaozhi-pi-workspace').waitFor();
    const snapshot=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),initial.sessionId);
    assert.equal(snapshot.running,false);
    const current=state();
    assert.deepEqual(current,{...initial,status:'blocked'});
    report.openings.push({status:current.status,runs:current.runs.length,grants:current.grants.length,
      scopeVersion:current.scope.version,effects:current.effects.length});
    await app.close();
    app=undefined;
  }
  assert.deepEqual(originals(),before);
  report.ok=true;
} catch(error) {
  report.error=String(error.stack);
  process.exitCode=1;
} finally {
  await app?.close();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(output,JSON.stringify(report));
}
