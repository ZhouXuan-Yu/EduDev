import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import { assertIsolatedPiMain, testMain } from './build-root.mjs';
import { productEntry } from '../product-navigation.mjs';
import { openLessonFromChat } from '../education/teaching-lesson-task-journey.mjs';

const [fixtures, evidence, scenario] = process.argv.slice(2);
assert(scenario===undefined||scenario==='--transient');
assert([fixtures, evidence].every(value => value && path.isAbsolute(value)));
assert(process.env.DEEPSEEK_API_KEY, 'Built-in DeepSeek test credential is unavailable');
const desktop = fs.realpathSync(process.env.OMNI_EDU_PROVIDER_LIVE_DESKTOP ?? path.resolve(import.meta.dirname, '../..'));
const main = testMain(desktop);
const executablePath = createRequire(path.join(desktop, 'package.json'))('electron');
const root = fs.mkdtempSync(path.join(fs.realpathSync(evidence), 'provider-live-j04-'));
const profile = path.join(root, 'profile'), data = path.join(root, 'data');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = fs.readFileSync(path.join(fixtures, 'lesson-source.txt'));
assert(source.toString('utf8').startsWith('SYN-LESSON-01（原创合成资料'));
const materialPath = path.join(root, 'SYN-LESSON-01.txt');
fs.writeFileSync(materialPath, source);
const contract = fs.readFileSync(path.join(fixtures, 'journeys.md'), 'utf8');
const prompt = contract.match(/^\| J04 教案 \| “([^”]+)”/mu)?.[1];
assert(prompt);
const report = { ok: false, root, main, mainHash: hash(fs.readFileSync(main)), fixtureHash: hash(source), prompt,
  scenario:scenario?'recover-503':'healthy', checks: [], wire: [], paidRequests: 0, injectedRequests:0 };
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  key === 'DEEPSEEK_API_KEY' || !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(key)));
Object.assign(env, {
  OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'), OMNI_EDU_SKIP_DOTENV: '1',
  OMNI_EDU_XIAOZHI_PI: '1', DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-flash', TEMP: root, TMP: root,
});
let app, page, faultServer;
function read(statement) {
  const db = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true, timeout: 5000 });
  try { return db.prepare(statement).all(); }
  finally { db.close(); }
}
async function until(label, readValue, timeout) {
  const end = performance.now() + timeout;
  while (performance.now() < end) {
    const value = await readValue();
    if (value) return value;
    await delay(180);
  }
  throw Error('Timed out waiting for ' + label);
}
function check(label) { report.checks.push(label); }

try {
  let transientEndpoint;
  if(scenario){
    faultServer=createServer((request,response)=>{
      report.injectedRequests++;
      if(request.headers.authorization){response.writeHead(400).end();return;}
      response.writeHead(503,{'Content-Type':'application/json','Retry-After':'1'});
      response.end(JSON.stringify({error:{message:'Owned assessment transient unavailable',type:'server_error'}}));
    });
    await new Promise((resolve,reject)=>faultServer.once('error',reject).listen(0,'127.0.0.1',resolve));
    transientEndpoint='http://127.0.0.1:'+faultServer.address().port;
  }
  app = await electron.launch({ executablePath, args: [main, '--user-data-dir=' + profile], env, cwd: desktop, timeout: 60_000 });
  await assertIsolatedPiMain(app, main, profile);
  await app.evaluate(({ dialog, net }, {localSource,transientEndpoint}) => {
    const wire = globalThis.providerLiveJ04Wire = [];
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [localSource] });
    const remote = net.fetch.bind(net);
    globalThis.fetch = async () => { throw Error('The owned assessment uses the built-in Electron transport'); };
    net.fetch = async (address, options) => {
      const target = new URL(typeof address === 'string' ? address : address.url);
      const method = options?.method || 'GET';
      const catalogue = method.toUpperCase() === 'GET' && target.pathname.endsWith('/models');
      const completion = method.toUpperCase() === 'POST' && target.pathname.endsWith('/chat/completions');
      if (target.origin !== 'https://api.deepseek.com' || (!catalogue && !completion)) throw Error('Unexpected external destination');
      if (wire.filter(entry => entry.completion === completion).length >= (completion ? 7 : 3)) throw Error('Isolated request ceiling reached');
      const body = completion && typeof options?.body === 'string' ? JSON.parse(options.body) : undefined;
      const injected=Boolean(transientEndpoint&&completion&&!wire.some(entry=>entry.completion));
      const record = { completion, injected, model: body?.model, toolChoice: body?.tool_choice?.function?.name ?? body?.tool_choice,
        toolNames:body?.tools?.map(tool=>tool.function?.name),
        startedAt: performance.now(), status: null };
      wire.push(record);
      try {
        const response = injected ? await remote(transientEndpoint,{method:'POST',signal:options?.signal}) : await remote(address, options);
        record.status = response.status;
        if (catalogue && response.ok) {
          const publicCatalogue = await response.clone().json().catch(() => null);
          record.advertisedModels = Array.isArray(publicCatalogue?.data)
            ? publicCatalogue.data.map(item => item.id).filter(id => typeof id === 'string').slice(0, 20) : [];
        }
        return response;
      } finally { record.elapsedMs = Math.round(performance.now() - record.startedAt); }
    };
  }, {localSource:materialPath,transientEndpoint});
  page = await app.firstWindow();
  await productEntry(page, 'materials').click();
  await page.getByTestId('materials-import').click();
  const item = await until('one real text source', () => {
    const rows = read('SELECT id, original_file_name, local_path, parse_status FROM teacher_resources');
    return rows.length === 1 && rows[0].parse_status === 'ready' ? rows[0] : null;
  }, 40_000);
  assert.equal(hash(fs.readFileSync(item.local_path)), report.fixtureHash);
  assert.equal(item.original_file_name, 'SYN-LESSON-01.txt');
  check('The exact original synthetic source was imported and parsed through the product');
  await productEntry(page, 'ask').click();
  const input = page.getByTestId('office-prompt-input');
  await input.fill(prompt);
  await page.locator('[data-testid=office-composer] [data-slot="prompt-input-send"]').click();
  const draft = await until('lesson confirmation', () => {
    const row = read("SELECT * FROM ai_confirmation_items WHERE action_type='pi_classroom_plan' ORDER BY rowid DESC LIMIT 1")[0];
    if (row) return row;
    const question = read("SELECT payload_json FROM xiaozhi_pi_controls WHERE kind='question' AND state='pending' ORDER BY rowid DESC LIMIT 1")[0];
    if (question) {
      const {text, options} = JSON.parse(question.payload_json);
      report.questionBeforeDraft = {text, options};
      throw Error('The run asked the teacher to respond without a persisted lesson draft');
    }
    const run = read('SELECT status,error_message FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0];
    if (run && run.status !== 'running') throw Error('Run ended without a saved lesson: ' + run.status + ' ' + (run.error_message ?? ''));
  }, 240_000);
  assert.equal(draft.status, 'pending');
  const payload = JSON.parse(draft.payload_json);
  report.lesson = { id: draft.id, runId: draft.run_id, document: payload.document };
  assert(!JSON.stringify(payload.document).includes('\uFFFD'), 'Draft contains damaged text');
  assert.equal(payload.document.totalMinutes, 45);
  assert.deepEqual(payload.document.scenes.map(scene => scene.durationMinutes), [5, 12, 18, 10]);
  assert.equal(payload.document.objectives.length, 2);
  assert(JSON.stringify(payload.context).includes(item.id), 'Draft must preserve the original source identity');
  assert.equal(read("SELECT COUNT(*) AS total FROM document_artifacts")[0].total,0);
  if(scenario){
    const attempts=(await app.evaluate(()=>globalThis.providerLiveJ04Wire)).filter(entry=>entry.completion);
    assert.equal(report.injectedRequests,1);
    assert.equal(attempts[0].status,503);
    assert.equal(attempts[1].status,200);
    assert.equal(attempts[0].model,attempts[1].model);
    assert.equal(attempts[0].toolChoice,attempts[1].toolChoice);
    assert(attempts[1].startedAt-attempts[0].startedAt>=1000);
    assert.deepEqual(read('SELECT id FROM ai_agent_runs').map(row=>row.id),[draft.run_id]);
    check('The actual 503, retry delay, and recovery use the same model, tool and persisted run');
  }
  check('The real model saved the exact lesson duration, four phase durations, and source linkage');
  await openLessonFromChat(page, draft.id, draft.id);
  await page.getByTestId('classroom-plan-confirm').click();
  await until('teacher confirmed the same lesson', async () => (await page.getByTestId('classroom-plan-detail').getAttribute('data-status')) === 'confirmed', 40_000);
  check('The original saved draft required the teacher confirmation UI');
  report.ok = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  if (app) {
    report.wire = await app.evaluate(() => globalThis.providerLiveJ04Wire).catch(() => []) ?? [];
    report.paidRequests = report.wire.filter(entry => entry.completion&&!entry.injected).length;
    await app.close().catch(() => undefined);
  }
  if(faultServer)await new Promise(resolve=>faultServer.close(resolve));
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, root, checks: report.checks.length, paidRequests: report.paidRequests, error: report.error }));
}
