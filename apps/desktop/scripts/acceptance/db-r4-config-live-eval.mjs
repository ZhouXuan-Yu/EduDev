import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import { assertIsolatedPiMain, testMain } from './build-root.mjs';
import { withSql } from './db-foundation-r1-task-fixture.mjs';
import { readSharedModelBudget, sharedModelBudgetEntry } from './db-r4-shared-model-budget.mjs';

const args = process.argv.slice(2);
const flag = name => args.find(value => value.startsWith(name + '='))?.slice(name.length + 1);
const offline = args.includes('--preflight');
assert(offline || args.includes('--allow-paid-model'), 'Explicit approval is required for real model evaluation');
assert(!(offline && args.includes('--allow-paid-model')), 'Choose offline preflight or approved live evaluation');
const scenarios = ['WEB-OFF', 'MODEL-SOURCE', 'UNKNOWN-EFFORT'];
const scenario = flag('--case');
assert(scenarios.includes(scenario), 'A supported frozen case ID is required');
const repeat = Number(flag('--repeat') ?? (offline ? 1 : 3));
assert(Number.isInteger(repeat) && repeat >= 1 && repeat <= 3, 'Invalid case repetition count');
assert(offline || repeat === 3, 'A frozen live evaluation requires three repetitions');
const desktop = path.resolve(import.meta.dirname, '../..');
const budget = readSharedModelBudget(args, desktop, { dryRun: offline });
assert(budget, 'An owned shared budget is required');
const callsPerTrial = scenario === 'UNKNOWN-EFFORT' ? 2 : 1;
assert(offline || budget.limit - budget.used >= repeat * callsPerTrial, 'Shared budget has insufficient capacity for this case');
const controlledCatalogue = offline || scenario === 'UNKNOWN-EFFORT';
const key = offline ? 'synthetic-r4-offline-key' : process.env.DEEPSEEK_API_KEY;
assert(key, 'Approved inherited DeepSeek credential is required');
const model = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
assert(budget.models.includes(model), 'Configured model must be in the approved budget');
const main = testMain(desktop);
const batch = mkdtempSync(path.join(os.tmpdir(), 'edu-r4-config-live-eval-'));
const ledgerFlag = ['--r4-shared-budget=' + budget.dir];
const prompt = '仅根据本轮给出的实验两组数字说明观察结论。不要联网或读取其他目录。20℃时10mL，30℃时12mL。';
const staleModel = 'deepseek-r4-unavailable-fixture';
const report = {
  scenario, offline, plannedRepetitions: repeat, main,
  mainSha256: createHash('sha256').update(readFileSync(main)).digest('hex'),
  catalogue: controlledCatalogue ? 'controlled capability fixture' : 'official',
  trials: [],
};

const value = response => {
  assert.equal(response.ok, true, response.error);
  return response.value;
};
async function until(read, label, timeout = 120000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) {
    const found = await read();
    if (found) return found;
    await delay(100);
  }
  throw Error('Timeout waiting for ' + label);
}

async function trial(repetition) {
  const root = mkdtempSync(path.join(batch, 'trial-'));
  const profile = path.join(root, 'profile');
  const data = path.join(root, 'data');
  const wirePath = path.join(root, 'model-wire.jsonl');
  const unknownEffort = path.join(root, 'fixture-missing-effort');
  writeFileSync(wirePath, '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/(?:API[_-]?KEY|TOKEN|SECRET|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL)/i.test(name)));
  Object.assign(env, {
    OMNI_EDU_SKIP_DOTENV: '1', OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1', DEEPSEEK_API_KEY: key, DEEPSEEK_MODEL: model, GLM_API_KEY: '',
  });
  delete env.XIAOZHI_ANSWER_QUALITY;
  const entry = sharedModelBudgetEntry(main, profile, budget, scenario, { offline });
  const app = await electron.launch({ args: [entry, '--user-data-dir=' + profile], cwd: desktop, env, timeout: 60000 });
  const elapsed = performance.now();
  const checks = { repetition, root };
  report.trials.push(checks);
  try {
    const page = await app.firstWindow();
    const installed = await assertIsolatedPiMain(app, main, profile);
    checks.runtime = { ownedProfile: installed.paths.userData, loadedModules: installed.modules.length };
    await app.evaluate(({ net }, { controlledCatalogue, model, wirePath, unknownEffort }) => {
      const fs = process.getBuiltinModule('node:fs');
      const original = net.fetch.bind(net);
      net.fetch = async (input, options) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.origin === 'https://api.deepseek.com' && url.pathname.endsWith('/models') && controlledCatalogue) {
          return new Response(JSON.stringify({ object: 'list', data: [{ id: model, context_window: 1048576, max_output_tokens: 32768,
            input_modalities: ['text'], ...(!fs.existsSync(unknownEffort)
              ? { effort: { supported_levels: ['low', 'high', 'max'], default_level: 'high' } } : {}) }] }),
          { headers: { 'content-type': 'application/json' } });
        }
        if (url.origin === 'https://api.deepseek.com' && url.pathname.endsWith('/chat/completions')) {
          const body = JSON.parse(options.body);
          const observation = { model: body.model, effort: body.reasoning_effort ?? null, thinking: body.thinking?.type ?? null,
            webTool: body.tools?.some(entry => /^office_web_(search|fetch)$/.test(entry.function?.name)) ?? false };
          fs.appendFileSync(wirePath, JSON.stringify(observation) + '\n');
        }
        return original(input, options);
      };
    }, { controlledCatalogue, model, wirePath, unknownEffort });
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({ timeout: 60000 });
    const newSession = name => page.evaluate(async title => (await window.omniEdu.createAiConversationSession({ title })).session.id, name);
    const session = await newSession(scenario);
    const mutate = input => page.evaluate(value => window.omniEdu.commitXiaozhiConfig(value), { operationId: randomUUID(), ...input });
    const history = field => page.evaluate(value => window.omniEdu.getXiaozhiConfigHistory({ field: value }), field).then(value);
    const wire = () => readFileSync(wirePath, 'utf8').split('\n').slice(0, -1).map(JSON.parse);
    const query = (sql, params = []) => withSql(data, false, db => db.prepare(sql).get(...params));
    const readonly = () => page.evaluate(sessionId => window.omniEdu.getXiaozhiResolvedAgentConfig({ sessionId }), session).then(value);
    const getSettings = () => page.evaluate(sessionId => window.omniEdu.getXiaozhiSettings({ sessionId, refresh: true }), session).then(value);
    const initial = await getSettings();
    assert(initial.models.some(item => item.id === model), 'Configured model is missing from the capability catalogue');
    if (scenario === 'WEB-OFF') {
      const before = (await getSettings()).web;
      assert.equal(before.enabled, true);
      const saved = await page.evaluate(web => window.omniEdu.saveXiaozhiWebSettings({
        schemaVersion: 'xiaozhi.web.v1', version: web.version, enabled: false, dnsMode: web.dnsMode,
      }), before).then(value);
      assert.equal(saved.enabled, false);
      assert(saved.version > before.version);
      const stored = JSON.parse(query("SELECT value_json FROM app_settings WHERE key='xiaozhi.web.v1'").value_json);
      assert.equal(stored.enabled, false);
      assert.equal((await getSettings()).web.enabled, false);
      checks.web = { version: saved.version, stored: stored.enabled };
    } else if (scenario === 'MODEL-SOURCE') {
      // Only this new isolated database receives the old configuration fixture.
      withSql(data, true, db => db.prepare('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)')
        .run('xiaozhi.provider.v1', JSON.stringify({ schema: 1, revision: 1, defaultModel: staleModel }), new Date().toISOString()));
      const before = (await readonly()).model;
      assert.equal(before.value, staleModel);
      assert.equal(before.source, 'global');
      assert.equal(before.revision, 1);
      // A valid stored ID can be absent from the official catalogue.
      assert(!initial.models.some(item => item.id === staleModel));
      const mutation = (newValue, expectedVersion) => mutate({ field: 'default_model', value: newValue, expectedVersion });
      const modelHistory = () => history('default_model');
      const current = await modelHistory();
      assert.equal(current.value, staleModel);
      const rejected = await mutation('deepseek-r4-unavailable-new', current.version);
      assert.deepEqual(rejected, { ok: false, error: 'model_unavailable' });
      assert.equal((await modelHistory()).version, current.version);
      assert.equal((await modelHistory()).value, staleModel);
      value(await mutation(null, current.version));
      const after = (await readonly()).model;
      assert.equal(after.value, model);
      assert.equal(after.source, 'environment');
      assert.equal(after.status, 'valid');
      assert.equal((await modelHistory()).value, null);
      checks.modelSource = { before, rejected: rejected.error, after };
    }
    async function runSample(sessionId) {
      const before = wire().length;
      const admitted = await page.evaluate(input => window.omniEdu.startXiaozhi(input), {
        sessionId, prompt, commandId: 'xicmd_' + randomUUID(),
      });
      assert.equal(admitted.ok, true, admitted.error);
      const sample = { runId: admitted.runId };
      (checks.samples ??= []).push(sample);
      await until(() => {
        if (wire().length > before) return true;
        const done = query("SELECT status,error_message FROM ai_agent_runs WHERE id=? AND status<>'running'", [admitted.runId]);
        assert(!done, 'Run settled before the model request: ' + (done?.error_message ?? done?.status));
        return null;
      }, 'formal Pi request projection');
      const terminal = await until(() => query("SELECT id,status FROM ai_agent_runs WHERE id=? AND status<>'running'",
        [admitted.runId]), 'terminal run');
      sample.prepared = (await page.evaluate(input => window.omniEdu.getXiaozhiResolvedAgentConfig(input),
        { sessionId, runId: admitted.runId }).then(value)).prepared;
      assert.equal(sample.prepared.receipt.modelValue, model);
      sample.requests = wire().slice(before);
      assert(sample.requests.length > 0 && sample.requests.every(request => request.model === model));
      sample.terminal = terminal.status;
      if (offline) {
        assert.notEqual(terminal.status, 'succeeded');
        sample.outcome = 'PREFLIGHT_ONLY';
      } else {
        assert.equal(terminal.status, 'succeeded');
        const row = query("SELECT content,metadata_json FROM ai_conversation_messages WHERE role='assistant' AND json_extract(metadata_json,'$.agentRunId')=?",
          [admitted.runId]);
        assert(row?.content?.trim(), 'Actual answer required');
        sample.answer = row.content;
        sample.metrics = JSON.parse(row.metadata_json).answerQuality ?? null;
        sample.outcome = 'AWAITING_HUMAN_REVIEW';
      }
      return sample;
    }
    if (scenario === 'UNKNOWN-EFFORT') {
      assert(initial.models.find(item => item.id === model).effort?.supportedLevels.includes('high'));
      const previous = await history('global_thinking');
      value(await mutate({ field: 'global_thinking', expectedVersion: previous.version, value: 'high' }));
      const known = await runSample(session);
      assert.equal(known.prepared.receipt.thinking.requested, 'high');
      assert.equal(known.prepared.receipt.thinking.effective, 'high');
      assert(known.requests.every(request => request.effort === 'high' && request.thinking === 'enabled'));
      writeFileSync(unknownEffort, '');
      const refreshed = (await getSettings()).models.find(item => item.id === model);
      assert(refreshed && refreshed.effort === undefined);
      const unknown = await runSample(await newSession('UNKNOWN-EFFORT second catalogue'));
      assert.equal(unknown.prepared.receipt.thinking.requested, 'high');
      assert.equal(unknown.prepared.receipt.thinking.effective, 'auto');
      assert(unknown.requests.every(request => request.effort === null && request.thinking === 'enabled'));
      assert.equal((await history('global_thinking')).value, 'high');
      checks.capabilityFallback = { known: known.runId, unknown: unknown.runId, retained: 'high' };
    } else {
      const sample = await runSample(session);
      if (scenario === 'WEB-OFF') {
        assert(sample.requests.every(request => !request.webTool));
        assert.equal(query("SELECT count(*) AS n FROM xiaozhi_tool_receipts WHERE run_id=? AND tool IN ('office_web_search','office_web_fetch')",
          [sample.runId]).n, 0);
      }
    }
  } finally {
    checks.elapsedMs = Math.round(performance.now() - elapsed);
    await app.close();
  }
}

try {
  for (let repetition = 1; repetition <= repeat; repetition++) await trial(repetition);
  report.status = offline ? 'PREFLIGHT_PASS' : 'AWAITING_HUMAN_REVIEW';
} catch (error) {
  report.status = 'FAIL';
  report.error = String(error);
  process.exitCode = 1;
} finally {
  report.budget = readSharedModelBudget(ledgerFlag, desktop, { dryRun: true });
  if (offline) assert.equal(report.budget.used, budget.used);
  writeFileSync(path.join(batch, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, scenario, report: path.join(batch, 'report.json'), error: report.error }));
}
