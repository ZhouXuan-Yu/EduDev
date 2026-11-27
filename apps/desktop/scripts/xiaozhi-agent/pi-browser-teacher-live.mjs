import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron as electron } from 'playwright';

const scenario = process.argv[2];
assert(['notice', 'filter', 'decline'].includes(scenario), 'Choose notice, filter or decline');
const main = path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT || 'out', 'main/index.js');
const parent = path.resolve('test-results/xiaozhi-agent');
fs.mkdirSync(parent, { recursive: true });
const output = fs.mkdtempSync(path.join(parent, 'teacher-live-' + scenario + '-'));
const data = path.join(output, 'data');
const profile = path.join(output, 'profile');
const notice = 'https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html';
const fixture = 'https://fixture.invalid/teaching';
const url = scenario === 'notice' ? notice : fixture;
const code = randomBytes(4).toString('hex');
const html = `<!doctype html><meta charset="utf-8"><title>物理备课资源</title>
<h1>物理备课资源</h1><button onclick="window.applied++;setTimeout(() => document.querySelector('p').textContent='浮力实验 · 资料编号 ${code}',1200)">筛选八年级</button>
<p>全部年级 · 待筛选</p><script>window.applied=0</script>`;
const prompt = scenario === 'notice'
  ? `我在备课，请用内置浏览器打开 ${url}。根据原文告诉我通知落款日期、网页发布日期和课程实施时间，附可复核的原文链接。`
  : `请用内置浏览器打开 ${url}，帮我筛选八年级，等列表更新后告诉我第一项实验名和资料编号。如果我拒绝操作，就停止筛选。`;
const report = { scenario, url, prompt, build: createHash('sha256').update(fs.readFileSync(main)).digest('hex'), humanAccepted: false };
let app;
try {
  const env = { ...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve('../..'), OMNI_EDU_XIAOZHI_PI: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  app = await electron.launch({ args: [main, '--user-data-dir=' + profile], env, timeout: 60000 });
  const page = await app.firstWindow();
  const input = page.getByTestId('office-prompt-input');
  await input.waitFor({ timeout: 60000 });
  assert.equal(await app.evaluate(({app}) => app.getPath('userData')), profile);
  const settings = (await page.evaluate(() => window.omniEdu.getXiaozhiSettings())).value;
  report.model = settings.defaultModel;
  report.provider = settings.provider;
  assert(settings.configured && settings.web.enabled, 'Configure the production provider and enable web');
  if (scenario !== 'notice') {
    await app.evaluate(({ app, session }, { html, fixture }) => {
      const seen = new Set();
      app.on('web-contents-created', (_event, contents) => {
        if (contents.session === session.defaultSession || contents.getLastWebPreferences().preload || seen.has(contents.session)) return;
        seen.add(contents.session);
        contents.session.protocol.handle('https', request => request.url === fixture
          ? new Response(html, { headers: { 'content-type': 'text/html;charset=utf-8' } })
          : new Response('', { status: 403 }));
      });
    }, { html, fixture });
  }
  const session = await page.locator('.office-composer-container').getAttribute('data-session-id');
  await input.fill(prompt);
  await input.press('Enter');
  const deadline = Date.now() + 180000;
  let turn, decisions = 0;
  while (Date.now() < deadline) {
    const snapshot = await page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), session);
    turn = snapshot.projection.turns.at(-1);
    if (!snapshot.running && ['completed','interrupted','failed'].includes(turn?.status)) break;
    const choice = page.getByText(scenario === 'decline' ? '拒绝这次操作' : '同意这次操作', { exact: true }).last();
    if (scenario !== 'notice' && !decisions && await choice.isVisible()) {
      const guest = app.context().pages().find(p => p.url() === fixture);
      assert(guest && await guest.getByRole('button', { name: '筛选八年级' }).count() === 1);
      const panel = page.getByTestId('pi-teacher-question').last();
      const question = await panel.innerText();
      assert(question.includes('fixture.invalid') && question.includes('click'), 'Expected only the fixture button approval');
      await choice.click();
      await page.getByTestId('pi-question-submit').click();
      decisions++;
    }
    await delay(500);
  }
  report.decisions = decisions;
  report.status = turn?.status;
  report.tools = turn?.items.filter(i => i.kind === 'tool').map(i => ({ name: i.toolName, status: i.status, summary: i.resultSummary }));
  report.answer = turn?.items.filter(i => i.kind === 'message' && i.phase === 'final_answer').map(i => i.text).join('\n');
  const guest = app.context().pages().find(p => {
    if (scenario !== 'notice') return p.url() === fixture;
    const actual = new URL(p.url());
    const official = new URL(notice);
    return ['http:', 'https:'].includes(actual.protocol) && actual.host === official.host && actual.pathname === official.pathname;
  });
  if (guest) {
    report.page = { url: guest.url(), text: (await guest.locator('body').innerText()).slice(0, 16000) };
    if (scenario !== 'notice') report.clicks = await guest.evaluate(() => window.applied);
  }
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly:true});
  try {
    report.receipts = db.prepare("SELECT call_id,phase,success FROM xiaozhi_tool_receipts WHERE tool='office_browser' ORDER BY start_sequence").all();
    const binding = db.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(session);
    const messages = fs.readFileSync(path.join(data, 'xiaozhi-pi', binding.session_file),'utf8').trim().split('\n').map(line => JSON.parse(line).message);
    report.actions = messages.flatMap(m => (Array.isArray(m?.content) ? m.content : []).filter(c => c.type === 'toolCall' && c.name === 'office_browser').map(c => c.arguments.action));
    report.browserEvidence = messages.filter(m => m?.role === 'toolResult' && m.toolName === 'office_browser' && !m.isError).flatMap(m => {
      try {
        const receipt = JSON.parse(m.content[0].text);
        return receipt.url && receipt.text ? [{url:receipt.url, text:receipt.text}] : [];
      } catch { return []; }
    });
    report.guideRead = messages.some(m => m?.role === 'toolResult' && m.toolName === 'read' && JSON.stringify(m.content).includes('内置浏览器操作手册'));
  } finally { db.close(); }
  assert.equal(report.status, 'completed');
  assert(report.receipts.some(r => r.phase === 'settled' && r.success === 1), 'Missing successful browser receipt');
  assert(report.page, 'Requested page was not open');
  if (scenario === 'notice') {
    for (const pattern of [/2022[年./-]\s*0?3[月./-]\s*25/, /2022[年./-]\s*0?4[月./-]\s*21/, /2022年.{0,12}秋季.{0,6}学期/]) {
      assert.match(report.browserEvidence.filter(r => r.url === guest.url()).map(r => r.text).join('\n'), pattern);
      assert.match(report.page.text, pattern);
      assert.match(report.answer, pattern);
    }
    assert(report.answer.includes(url) || report.answer.includes(guest.url()));
  } else {
    assert.equal(decisions, 1);
    assert.equal(report.clicks, scenario === 'filter' ? 1 : 0);
    if (scenario === 'filter') {
      assert(report.answer.includes(code) && report.answer.includes('浮力实验'));
      assert(report.page.text.includes(code));
    } else {
      assert.match(report.answer, /拒绝|取消|停止|未.{0,5}筛选/);
      assert(!report.answer.includes(code) && !report.page.text.includes(code));
    }
  }
  report.pass = true;
} catch (error) {
  report.error = String(error);
  process.exitCode = 1;
} finally {
  await app?.close().catch(() => {});
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ scenario, output, model: report.model, status: report.status, actions: report.actions, pass: !!report.pass, error: report.error }));
}
