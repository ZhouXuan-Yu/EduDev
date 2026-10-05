import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import {registerHooks} from 'node:module';
// These host-admission boundaries never execute the Electron extraction utility.
registerHooks({resolve(specifier,context,next){if(specifier==='electron')return {url:'data:text/javascript,export const utilityProcess={};',shortCircuit:true};return next(specifier,context);}});
const { createXiaozhiProductionHost } = await import('../../src/main/xiaozhi-agent/production-host.ts');
const { createXiaozhiSessionState } = await import('../../src/main/xiaozhi-agent/session-state.ts');
const fixture = path.resolve('test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data/app.db'), output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-model-host-lock-'));
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex'), before = digest(fixture);
fs.copyFileSync(fixture, path.join(output, 'app.db')); const db = new DatabaseSync(path.join(output, 'app.db'));
const state = createXiaozhiSessionState({ run: async (sql, values = []) => db.prepare(sql).run(...values), change: async (sql, values = []) => Number(db.prepare(sql).run(...values).changes), all: async (sql, values = []) => db.prepare(sql).all(...values) });
const id = db.prepare('SELECT id FROM ai_conversation_sessions LIMIT 1').get().id;
let enteredDetail, releaseDetail, detailArchived = false, releaseFetch, enteredFetch;
const store = { xiaozhiState: state, getDeepSeekRuntimeSettings: async () => ({ provider: 'deepseek', apiKey: 'synthetic-host-key', model: 'deepseek-flash' }),
  getAiConversationSession: async () => { enteredDetail?.(); if (releaseDetail) await new Promise(resolve => releaseDetail.current = resolve); return { session: { archivedAt: detailArchived ? 'owned' : undefined }, messages: [] }; } };
const schemaVersion = 'xiaozhi.settings.v1', request = version => ({ schemaVersion, version, defaultModel: 'deepseek-flash' });
const fetchBefore = globalThis.fetch;
globalThis.fetch = async () => { enteredFetch?.(); if (releaseFetch) await new Promise(resolve => releaseFetch.current = resolve); return new Response(JSON.stringify({ object: 'list', data: [{ id: 'deepseek-flash', context_window: 1048576, max_output_tokens: 393216 }] })); };
const host = createXiaozhiProductionHost({ store, dataRoot: output, emit: () => assert.fail('Lock boundary must not launch a model turn') });
const checks = [], report = { success: false, checks, boundaries: ['Actual production-host ownership gates and disposable existing-schema SQLite; controlled provider and chooser barriers.'] };
const check = async (name, action) => { await action(); checks.push({ name, pass: true }); };
try {
  await state.init(); const skills = await host.skillCatalog();
  let entered; const entering = new Promise(resolve => entered = resolve); enteredFetch = entered; releaseFetch = {};
  const pending = host.saveModelSettings(request(0)); await entering;
  await check('Provider validation reserves a global lock before network wait', async () => {
    assert.equal((await host.start({ sessionId: id, commandId: `xicmd_${randomUUID()}`, prompt: 'owned' })).error, 'busy');
    assert.equal((await host.selectWorkspace(id, async () => assert.fail())).error, 'busy');
    assert.equal((await host.setMemoryScope({ sessionId: id, version: 0, enabled: false, selections: [] })).error, 'busy');
    await assert.rejects(host.saveModelSettings(request(0)), /busy/);
    await assert.rejects(host.selectSessionModel({ schemaVersion, sessionId: id, version: 0, model: 'deepseek-flash' }), /busy/);
    await assert.rejects(host.setSkillEnabled(skills.skills[0].name, skills.revision, false), /busy/);
  });
  releaseFetch.current(); releaseFetch = undefined; enteredFetch = undefined; const committed = await pending;
  await check('Successful commit releases the global reservation and returns an unlocked public view', async () => { assert.equal(committed.version, 1); assert.equal(committed.locked, false); assert.equal((await host.modelSettingsView()).locked, false); });
  // Reset only the owned copy's native binding so the chooser boundary is reachable.
  db.prepare('DELETE FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').run(id);
  let releaseChooser, enteredChooser; const choosing = new Promise(resolve => enteredChooser = resolve);
  const selection = host.selectWorkspace(id, () => { enteredChooser(); return new Promise(resolve => releaseChooser = resolve); }); await choosing;
  await check('Workspace chooser blocks settings in the reverse direction', async () => { await assert.rejects(host.saveModelSettings(request(1)), /busy/); });
  releaseChooser(undefined); assert((await selection).ok);
  let startEntered; const started = new Promise(resolve => startEntered = resolve); enteredDetail = startEntered; releaseDetail = {}; detailArchived = true;
  const starting = host.start({ sessionId: id, commandId: `xicmd_${randomUUID()}`, prompt: 'owned' }); await started;
  await check('Reserved startup blocks credential mutation before model execution', async () => { await assert.rejects(host.saveModelSettings(request(1)), /busy/); });
  releaseDetail.current(); await starting; releaseDetail = undefined; enteredDetail = undefined; detailArchived = false;
  let closeEntered; const closingWait = new Promise(resolve => closeEntered = resolve); enteredFetch = closeEntered; releaseFetch = {};
  const savingOnClose = host.saveModelSettings(request(1)); await closingWait; await host.close(); releaseFetch.current(); releaseFetch = undefined;
  await check('Closing during validation rejects a late configuration commit', async () => { await assert.rejects(savingOnClose, /busy/); assert.equal((await state.modelSettings.configuration()).revision, 1); });
  await check('Owned source database is unchanged', async () => assert.equal(digest(fixture), before));
  report.success = true;
} catch (error) { report.error = String(error.stack || error).slice(0, 2200); process.exitCode = 1; }
finally { globalThis.fetch = fetchBefore; await host.close(); db.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ success: report.success, checks: checks.length, output, error: report.error }));
