import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
const scenarios = ['WEB-OFF', 'MODEL-SOURCE', 'UNKNOWN-EFFORT', 'BOUND-COLD', 'REVOKE-RESULT'];
const scenario = flag('--case');
assert(scenarios.includes(scenario), 'A supported frozen case ID is required');
const repeat = Number(flag('--repeat') ?? (offline ? 1 : 3));
assert(Number.isInteger(repeat) && repeat >= 1 && repeat <= 3, 'Invalid case repetition count');
assert(offline || repeat === 3, 'A frozen live evaluation requires three repetitions');
const desktop = path.resolve(import.meta.dirname, '../..');
const budget = readSharedModelBudget(args, desktop, { dryRun: offline });
assert(budget, 'An owned shared budget is required');
const callsPerTrial = ['UNKNOWN-EFFORT', 'REVOKE-RESULT'].includes(scenario) ? 2 : 1;
assert(offline || budget.limit - budget.used >= repeat * callsPerTrial, 'Shared budget has insufficient capacity for this case');
const controlledCatalogue = offline || scenario === 'UNKNOWN-EFFORT';
const key = offline ? 'synthetic-r4-offline-key' : process.env.DEEPSEEK_API_KEY;
assert(key, 'Approved inherited DeepSeek credential is required');
const model = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
assert(budget.models.includes(model), 'Configured model must be in the approved budget');
const replacementModel = budget.models.find(candidate => candidate !== model);
assert(scenario !== 'BOUND-COLD' || replacementModel, 'Cold binding evaluation requires a second authorized model ID');
const main = testMain(desktop);
const batch = mkdtempSync(path.join(os.tmpdir(), 'edu-r4-config-live-eval-'));
const ledgerFlag = ['--r4-shared-budget=' + budget.dir];
const prompt = '仅根据本轮给出的实验两组数字说明观察结论。不要联网或读取其他目录。20℃时10mL，30℃时12mL。';
const staleModel = 'deepseek-r4-unavailable-fixture';
const taskPrompt = '请整理一项合成教学任务，保留原任务判据42，并核对是否满足要求。';
const taskContinuation = '继续归纳上次已经确认的原任务要求。';
const permissionPrompt = '请通过当前工作目录读取 protected.txt，报告是否能核对内容。';
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
  const releaseFile = path.join(root, 'release-first-pi-request');
  const abortedFile = path.join(root, 'cancelled-at-first-pi-request');
  const protectedMarker = 'R4-SYNTHETIC-PROTECTED-' + randomUUID();
  writeFileSync(wirePath, '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/(?:API[_-]?KEY|TOKEN|SECRET|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL)/i.test(name)));
  Object.assign(env, {
    OMNI_EDU_SKIP_DOTENV: '1', OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1', DEEPSEEK_API_KEY: key, DEEPSEEK_MODEL: model, GLM_API_KEY: '',
  });
  delete env.XIAOZHI_ANSWER_QUALITY;
  const entry = sharedModelBudgetEntry(main, profile, budget, scenario, { offline });
  let app, page;
  const elapsed = performance.now();
  const checks = { repetition, root };
  report.trials.push(checks);
  async function open() {
    app = await electron.launch({ args: [entry, '--user-data-dir=' + profile], cwd: desktop, env, timeout: 60000 });
    page = await app.firstWindow();
    const installed = await assertIsolatedPiMain(app, main, profile);
    (checks.runtime ??= []).push({ ownedProfile: installed.paths.userData, loadedModules: installed.modules.length });
    await app.evaluate(({ net }, fixture) => {
      const { controlledCatalogue, models, wirePath, unknownEffort, releaseFile, abortedFile, scenario, offline, protectedMarker } = fixture;
      const fs = process.getBuiltinModule('node:fs');
      const original = net.fetch.bind(net);
      net.fetch = async (input, options) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.origin === 'https://api.deepseek.com' && url.pathname.endsWith('/models') && controlledCatalogue) {
          return new Response(JSON.stringify({ object: 'list', data: models.map(id => ({
            id, context_window: 1048576, max_output_tokens: 32768, input_modalities: ['text'],
            ...(!fs.existsSync(unknownEffort) ? { effort: { supported_levels: ['low', 'high', 'max'], default_level: 'high' } } : {}),
          })) }),
          { headers: { 'content-type': 'application/json' } });
        }
        if (url.origin === 'https://api.deepseek.com' && url.pathname.endsWith('/chat/completions')) {
          const body = JSON.parse(options.body);
          const observation = { model: body.model, effort: body.reasoning_effort ?? null, thinking: body.thinking?.type ?? null,
            webTool: body.tools?.some(entry => /^office_web_(search|fetch)$/.test(entry.function?.name)) ?? false };
          if (scenario === 'REVOKE-RESULT') {
            const names = new Set(body.messages.flatMap(message => message.tool_calls ?? [])
              .filter(item => item.function?.name === 'office_read_text').map(item => item.id));
            observation.readTool = body.tools?.some(item => item.function?.name === 'office_read_text') ?? false;
            observation.protectedDisclosed = JSON.stringify(body.messages).includes(protectedMarker);
            observation.deniedCalls = body.messages.filter(message => message.role === 'tool' && names.has(message.tool_call_id))
              .filter(message => /permission_denied|授权|权限/u.test(JSON.stringify(message.content)))
              .map(message => message.tool_call_id);
          }
          const held = ['BOUND-COLD', 'REVOKE-RESULT'].includes(scenario) && !fs.existsSync(releaseFile);
          fs.appendFileSync(wirePath, JSON.stringify({ ...observation, ...(held ? { held: true } : {}) }) + '\n');
          if (observation.protectedDisclosed) throw Error('Private fixture data reached the model boundary');
          while (held && !fs.existsSync(releaseFile)) {
            if (options.signal?.aborted) {
              fs.writeFileSync(abortedFile, '');
              throw options.signal.reason ?? Error('cancelled');
            }
            await new Promise(resolve => setTimeout(resolve, 25));
          }
          if (options.signal?.aborted) throw options.signal.reason ?? Error('cancelled');
          if (offline && scenario === 'REVOKE-RESULT') {
            const chunk = (delta, finish_reason = null) => 'data: ' + JSON.stringify({ id: 'r4-revoke-local',
              object: 'chat.completion.chunk', model: body.model, choices: [{ index: 0, delta, finish_reason }] }) + '\n\n';
            const forced = !observation.deniedCalls.length
              ? chunk({ tool_calls: [{ index: 0, id: 'r4-revoke-local-call', type: 'function', function: {
                name: 'office_read_text', arguments: JSON.stringify({ path: 'protected.txt' }),
              } }] }, 'tool_calls')
              : chunk({ content: '仅本地预检：授权已撤销。' }) + chunk({}, 'stop');
            return new Response(chunk({ role: 'assistant', content: '' }) + forced + 'data: [DONE]\n\n',
              { headers: { 'content-type': 'text/event-stream' } });
          }
        }
        return original(input, options);
      };
    }, { controlledCatalogue, models: scenario === 'BOUND-COLD' ? [model, replacementModel] : [model],
      wirePath, unknownEffort, releaseFile, abortedFile, scenario, offline, protectedMarker });
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({ timeout: 60000 });
  }
  try {
    await open();
    const newSession = name => page.evaluate(async title => (await window.omniEdu.createAiConversationSession({ title })).session.id, name);
    const composerSession = () => page.locator('.office-composer-container').getAttribute('data-session-id');
    async function startVisibleSession() {
      const previous = await until(composerSession, 'initial composer session');
      await page.getByTestId('pi-new-session').click();
      return until(async () => {
        const current = await composerSession();
        return current && current !== previous ? current : null;
      }, 'teacher-created session');
    }
    const session = scenario === 'BOUND-COLD' ? await startVisibleSession() : await newSession(scenario);
    const mutate = input => page.evaluate(value => window.omniEdu.commitXiaozhiConfig(value), { operationId: randomUUID(), ...input });
    const history = field => page.evaluate(value => window.omniEdu.getXiaozhiConfigHistory({ field: value }), field).then(value);
    const wire = () => readFileSync(wirePath, 'utf8').split('\n').slice(0, -1).map(JSON.parse);
    const query = (sql, params = []) => withSql(data, false, db => db.prepare(sql).get(...params));
    const readonly = () => page.evaluate(sessionId => window.omniEdu.getXiaozhiResolvedAgentConfig({ sessionId }), session).then(value);
    const getSettings = () => page.evaluate(sessionId => window.omniEdu.getXiaozhiSettings({ sessionId, refresh: true }), session).then(value);
    const admit = (sessionId, text, options = {}) => page.evaluate(input => window.omniEdu.startXiaozhi(input),
      { sessionId, prompt: text, commandId: 'xicmd_' + randomUUID(), ...options });
    const prepared = (sessionId, runId) => page.evaluate(input => window.omniEdu.getXiaozhiResolvedAgentConfig(input),
      { sessionId, runId }).then(value).then(view => view.prepared);
    const settled = runId => until(() => query("SELECT id,status FROM ai_agent_runs WHERE id=? AND status<>'running'", [runId]), 'terminal run');
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
    async function runSample(sessionId, { text = prompt, options = {}, afterAdmission } = {}) {
      const before = wire().length;
      const admitted = await admit(sessionId, text, options);
      assert.equal(admitted.ok, true, admitted.error);
      const sample = { runId: admitted.runId };
      (checks.samples ??= []).push(sample);
      await until(() => {
        if (wire().length > before) return true;
        const done = query("SELECT status,error_message FROM ai_agent_runs WHERE id=? AND status<>'running'", [admitted.runId]);
        assert(!done, 'Run settled before the model request: ' + (done?.error_message ?? done?.status));
        return null;
      }, 'formal Pi request projection');
      if (afterAdmission) await afterAdmission(admitted.runId);
      const terminal = scenario === 'BOUND-COLD' && !offline ? await until(async () => {
        const result = query("SELECT id,status FROM ai_agent_runs WHERE id=? AND status<>'running'", [admitted.runId]);
        if (result) return result;
        const panel = page.getByTestId('pi-composer-pending-panel');
        const control = panel.getByTestId('pi-teacher-question');
        const id = await control.count() ? await control.getAttribute('data-control-id') : null;
        if (!id || sample.teacherAnswers?.some(item => item.id === id)) return null;
        assert((sample.teacherAnswers ??= []).length < 2, 'Model exceeded the frozen teacher answer fixture');
        const snapshot = await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
        const question = snapshot.controls?.find(item => item.id === id && item.runId === admitted.runId && item.state === 'pending');
        if (!question) return null;
        const answer = '只核对上次已经确认的原任务判据42，不增加新要求，不读取外部资料。';
        await control.getByTestId('pi-question-answer').fill(answer);
        await control.getByTestId('pi-question-submit').click();
        sample.teacherAnswers.push({ id, question: question.text, answer });
        return null;
      }, 'terminal resumed run with the teacher answer fixture') : await settled(admitted.runId);
      sample.prepared = await prepared(sessionId, admitted.runId);
      assert.equal(sample.prepared.receipt.modelValue, model);
      sample.requests = wire().slice(before);
      assert(sample.requests.length > 0 && sample.requests.every(request => request.model === model));
      sample.terminal = terminal.status;
      if (offline) {
        if (scenario === 'REVOKE-RESULT') assert.equal(terminal.status, 'succeeded');
        else assert.notEqual(terminal.status, 'succeeded');
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
    } else if (scenario === 'BOUND-COLD') {
      assert(initial.models.some(item => item.id === replacementModel), 'Replacement model disappeared from catalogue');
      value(await page.evaluate(input => window.omniEdu.selectXiaozhiModel(input), {
        schemaVersion: 'xiaozhi.settings.v1', sessionId: session, version: 0, model,
      }));
      const started = await admit(session, taskPrompt);
      assert.equal(started.ok, true, started.error);
      await until(() => wire().some(request => request.held), 'bound run at the wire');
      const captured = (await prepared(session, started.runId)).receipt;
      assert.equal(captured.modelValue, model);
      const bindingQuery = 'SELECT session_file,model FROM xiaozhi_pi_session_bindings WHERE conversation_id=?';
      const oldBinding = query(bindingQuery, [session]);
      assert.equal(oldBinding.model, model);
      const task = () => page.evaluate(sessionId => window.omniEdu.getXiaozhiTask({ sessionId }), session)
        .then(value).then(view => view.task);
      const original = await task();
      assert(original.criteria.some(item => item.text.includes('原任务判据42')));
      const head = await history('default_model');
      value(await mutate({ field: 'default_model', expectedVersion: head.version, value: replacementModel }));
      assert.deepEqual((await prepared(session, started.runId)).receipt, captured);
      const stopping = page.evaluate(sessionId => window.omniEdu.stopXiaozhi(sessionId), session)
        .catch(() => ({ ok: false }));
      await until(() => existsSync(abortedFile), 'formal Pi cancellation before dispatch', 10000);
      assert.equal((await stopping).ok, true);
      writeFileSync(releaseFile, '');
      const stopped = await settled(started.runId);
      assert.notEqual(stopped.status, 'succeeded');
      const paused = await until(async () => {
        const current = await task();
        return ['paused', 'interrupted', 'review_required'].includes(current?.state) ? current : null;
      }, 'paused task settlement after the run stopped', 15000);
      assert.equal(paused.id, original.id);
      await app.close();
      app = undefined;
      await open();
      if (await until(composerSession, 'restored composer session') !== session) {
        await page.getByTestId('workbench-session-' + session).click();
      }
      await until(async () => await composerSession() === session, 'restored bound session selection');
      assert.deepEqual(query(bindingQuery, [session]), oldBinding);
      assert.equal((await history('default_model')).value, replacementModel);
      const resumed = await runSample(session, { text: taskContinuation, options: {
        continueTask: { taskId: paused.id, requirementsVersion: paused.requirementsVersion },
      } });
      assert.notEqual(resumed.runId, started.runId);
      assert.equal(resumed.prepared.receipt.model.source, 'session_binding');
      assert.deepEqual(query(bindingQuery, [session]), oldBinding);
      const retained = await task();
      assert.equal(retained.id, paused.id);
      assert.equal(retained.requirementsVersion, paused.requirementsVersion);
      assert.deepEqual(retained.criteria, original.criteria);
      checks.cold = { first: started.runId, stopped: stopped.status, cancelledBeforeDispatch: true, firstPrepared: captured,
        resumed: resumed.runId, nativeBinding: oldBinding, replacementModel, sameTask: retained.id };
    } else if (scenario === 'REVOKE-RESULT') {
      const owned = path.join(root, 'permission-fixture');
      mkdirSync(owned);
      writeFileSync(path.join(owned, 'protected.txt'), protectedMarker);
      await app.evaluate(({ dialog }, folder) => {
        const original = dialog.showOpenDialog;
        dialog.showOpenDialog = async () => {
          dialog.showOpenDialog = original;
          return { canceled: false, filePaths: [folder] };
        };
      }, owned);
      value(await page.evaluate(sessionId => window.omniEdu.selectXiaozhiWorkspace(sessionId), session));
      const permissions = () => page.evaluate(sessionId => window.omniEdu.getXiaozhiPermissions(sessionId), session).then(value);
      const grants = (await permissions()).grants.filter(grant => !grant.revokedAt && grant.scope.kind === 'filesystem');
      assert(grants.length > 0);
      let captured;
      const sample = await runSample(session, { text: permissionPrompt, afterAdmission: async runId => {
        assert(wire().at(-1).held && wire().at(-1).readTool, 'Real read tool must have been in the admitted request');
        captured = (await prepared(session, runId)).receipt;
        for (const { grantId, revision } of grants) {
          const revoked = await page.evaluate(input => window.omniEdu.revokeXiaozhiGrant(input), { sessionId: session, grantId, revision }).then(value);
          assert(revoked.revokedAt);
        }
        writeFileSync(releaseFile, '');
      } });
      assert.deepEqual(sample.prepared.receipt, captured);
      const denial = query("SELECT call_id,phase,admitted,success FROM xiaozhi_tool_receipts WHERE run_id=? AND tool='office_read_text'",
        [sample.runId]);
      assert(denial, 'Model did not issue the required reading call');
      assert.deepEqual({ phase: denial.phase, admitted: denial.admitted, success: denial.success }, { phase: 'settled', admitted: 0, success: 0 });
      const file = query('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?', [session]).session_file;
      const native = readFileSync(path.join(data, 'xiaozhi-pi', file), 'utf8').trim().split('\n').map(JSON.parse)
        .find(row => row.message?.role === 'toolResult' && row.message.toolCallId === denial.call_id)?.message;
      assert(native?.isError);
      assert.match(JSON.stringify(native.content), /permission_denied|授权|权限/u);
      assert(sample.requests.some(item => item.deniedCalls.includes(denial.call_id)), 'Formal Pi must pass its denial back to the model');
      assert(sample.requests.every(item => !item.protectedDisclosed));
      assert((await permissions()).grants.every(grant => grant.revokedAt || grant.scope.kind !== 'filesystem'));
      checks.revocation = { receipt: denial, grantsRevoked: grants.length, noProtectedContent: true, returnedToModel: true,
        responseSource: offline ? 'controlled local preflight' : 'official provider' };
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
    await app?.close();
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
