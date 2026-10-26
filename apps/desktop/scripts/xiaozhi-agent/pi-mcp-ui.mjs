import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { testMain, assertIsolatedPiMain } from '../acceptance/build-root.mjs';
import { fingerprint, sha256 } from '../acceptance/evidence.mjs';
import { startMcpFixture } from './fixtures/mcp-server.mjs';

const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-mcp-ui-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
const config = fs.readFileSync('.env.local', 'utf8');
const apiKey = process.env.DEEPSEEK_API_KEY || config.match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g, '');
assert(apiKey, 'Existing local debug credential required');
const fixture = await startMcpFixture(), secret = 'owned-mcp-' + randomBytes(16).toString('hex');
fixture.state.auth = secret;
const buildRoot = path.dirname(path.dirname(testMain(process.cwd()))), build = fingerprint(buildRoot);
const report = { success: false, checks: [], launches: [], views: [], errors: [], build: { root: buildRoot, sha256: build.sha256, files: build.files.length }, boundaries: ['Actual formal Electron/Pi/DeepSeek; owned SQLite and profile; real HTTP transport to owned synthetic lesson service.', 'Not a public Chinese service, daily profile, VPN-off, installer or teacher acceptance.'] };
let app, page, sessionId, serverId, nativePath, nativeBytes;
const check = name => { report.checks.push({ name, pass: true }); console.log('PASS ' + name); };
async function until(fn, ms = 120000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); } throw Error('MCP UI condition timed out'); }
function query(sql, values = []) { const db = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true }); try { return db.prepare(sql).all(...values); } finally { db.close(); } }
const catalog = () => page.evaluate(() => window.omniEdu.getXiaozhiMcpCatalog());
const snapshot = () => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), sessionId);
async function launch() {
  const env = { ...process.env, OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve('../..'), OMNI_EDU_E2E_DIALOG_MODE: '1', DEEPSEEK_API_KEY: '', DEEPSEEK_MODEL: '' };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  app = await electron.launch({ args: [testMain(process.cwd()), `--user-data-dir=${profile}`], env, timeout: 60000 });
  report.launches.push(await assertIsolatedPiMain(app, testMain(process.cwd()), profile));
  page = await app.firstWindow(); page.on('pageerror', e => report.errors.push(String(e).replaceAll(apiKey, '[redacted]').replaceAll(secret, '[redacted]')));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ timeout: 60000 });
  await until(async () => !await page.getByTestId('office-prompt-input').isDisabled());
  sessionId = await page.locator('.office-composer-container').getAttribute('data-session-id');
}
async function settings() { await page.getByRole('button', { name: '设置', exact: true }).click(); await page.getByTestId('pi-settings-workspace').waitFor(); }
async function tools() { await page.getByTestId('pi-settings-tab-tools').click(); await page.getByTestId('pi-mcp-add').waitFor(); await until(async () => (await catalog()).ok); }
async function action(id) { await page.getByTestId(id).click(); await until(async () => !await page.getByTestId('pi-mcp-refresh').isDisabled()); }
async function chat(prompt) {
  await page.getByTestId('nav-ai').click(); await page.getByTestId('office-prompt-input').waitFor();
  const before = (await snapshot()).projection.turns.length;
  await page.getByTestId('office-prompt-input').fill(prompt); await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await until(async () => { const s = await snapshot(), t = s.projection.turns.at(-1); return !s.running && s.projection.turns.length > before && ['failed','completed','interrupted'].includes(t?.status) && t.items.some(i => i.kind === 'message' && i.role === 'user' && i.text === prompt); }, 180000);
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(), '');
  return (await snapshot()).projection.turns.at(-1);
}
try {
  await launch(); await settings();
  await page.getByTestId('pi-settings-key').fill(apiKey); await page.getByTestId('pi-settings-save').click();
  await until(async () => /已保存/.test(await page.getByTestId('pi-settings-feedback').innerText()));
  await tools(); await page.getByTestId('pi-mcp-empty').waitFor();
  await page.getByTestId('pi-mcp-name').fill('公开课程验收'); await page.getByTestId('pi-mcp-address').fill(fixture.url); await page.getByTestId('pi-mcp-secret').fill(secret);
  await page.getByTestId('pi-mcp-ack').locator('[data-slot="checkbox-control"]').click(); await action('pi-mcp-add');
  let c = (await catalog()).value; serverId = c.servers[0].id;
  assert.equal(c.servers[0].status, 'unverified'); assert.equal(fixture.state.requests, 0); assert.equal(await page.getByTestId('pi-mcp-secret').inputValue(), '');
  check('Teacher saves an encrypted connection without executing or automatically trusting the service');
  await action('pi-mcp-inspect-' + serverId);
  assert.equal((await catalog()).value.servers[0].status, 'ready'); assert.equal(fixture.state.calls, 0);
  assert(await page.getByTestId(`pi-mcp-tool-${serverId}-unknown_effect`).getAttribute('data-disabled') !== null || await page.getByTestId(`pi-mcp-tool-${serverId}-unknown_effect`).locator('input').isDisabled());
  await page.getByTestId(`pi-mcp-tool-${serverId}-lookup_lesson`).locator('[data-slot="checkbox-control"]').click(); await action('pi-mcp-trust-' + serverId);
  c = (await catalog()).value; assert.equal(c.servers[0].trustedSchemaHash, c.servers[0].schemaHash); assert(c.servers[0].tools[0].selected);
  const stored = query('SELECT value_json FROM app_settings WHERE key=?', ['xiaozhi.mcp.v1'])[0].value_json;
  assert(!stored.includes(secret)); assert(!JSON.stringify(c).includes(secret));
  check('Explicit connect/list, blocked unknown effect and exact-schema teacher selection persist through typed IPC');
  for (const theme of ['light', 'dark']) for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await page.emulateMedia({ colorScheme: theme }); await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width, height]);
    await page.waitForFunction(([w,h]) => innerWidth === w && innerHeight === h, [width,height]);
    await page.getByTestId('pi-mcp-trust-' + serverId).scrollIntoViewIfNeeded(); const rect = await page.getByTestId('pi-mcp-trust-' + serverId).boundingBox();
    assert(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height);
    assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
    const image = `settings-${theme}-${width}.png`; await page.screenshot({ path: path.join(output, image) }); report.views.push({ theme, width, height, image });
  }
  check('External tools and trust controls are reachable in four native size/theme combinations');
  const turn = await chat('请实际调用“公开课程验收”外部工具 lookup_lesson，参数topic为“勾股定理”。仅根据工具实际结果用一句话回答，不调用其他工具。');
  assert.equal(turn.status, 'completed', turn.error); assert(fixture.state.calls > 0); assert(turn.items.some(t => t.kind === 'tool' && t.status === 'completed'));
  const binding = query('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?', [sessionId])[0];
  nativePath = path.join(data, 'xiaozhi-pi', binding.session_file); nativeBytes = fs.readFileSync(nativePath);
  const entries = nativeBytes.toString('utf8').trim().split('\n').map(s => JSON.parse(s));
  assert(entries.some(e => e.message?.role === 'toolResult' && e.message.toolName?.startsWith('mcp_') && e.message.details?.success === true));
  report.turn = { id: turn.id, status: turn.status, tools: turn.items.filter(t => t.kind === 'tool') };
  assert(query("SELECT COUNT(*) AS n FROM xiaozhi_event_journal WHERE json_extract(event_json,'$.kind')='tool_attempt' AND json_extract(event_json,'$.attempt.tool') LIKE ?", ['mcp_%'])[0].n > 0);
  check('Real DeepSeek selects a trusted MCP tool inside native Pi; UI, native receipt and durable attempt agree; composer clears');
  const calls = fixture.state.calls; await app.close(); app = undefined; await launch();
  assert.equal(fixture.state.calls, calls); assert(fs.readFileSync(nativePath).subarray(0, nativeBytes.length).equals(nativeBytes)); assert.equal(query('SELECT value_json FROM app_settings WHERE key=?', ['xiaozhi.mcp.v1'])[0].value_json, stored);
  await settings(); await tools(); assert.equal((await catalog()).value.servers[0].trustedSchemaHash, c.servers[0].schemaHash);
  check('Cold formal restart preserves trust and native history without replaying the external effect');
  fixture.state.tools[0].inputSchema.properties.topic.maxLength = 90; await action('pi-mcp-inspect-' + serverId);
  assert.equal((await catalog()).value.servers[0].status, 'schema_changed'); assert(!(await catalog()).value.servers[0].trustedSchemaHash);
  await action('pi-mcp-inspect-' + serverId); await page.getByTestId(`pi-mcp-tool-${serverId}-lookup_lesson`).locator('[data-slot="checkbox-control"]').click(); await action('pi-mcp-trust-' + serverId);
  fixture.state.auth = 'owned-rejected-authentication';
  const degraded = await chat('这是外部服务失效后的独立核验。请仅调用update_plan，设置一个步骤“保留内建工具”，然后回复已记录，不调用外部服务。');
  assert.equal(degraded.status, 'completed', degraded.error); assert.equal(fixture.state.calls, calls);
  const unavailable = (await catalog()).value.servers[0]; assert.equal(unavailable.status, 'failed'); assert.equal(unavailable.lastError, 'authentication'); assert(!unavailable.trustedSchemaHash);
  check('A genuinely rejected MCP connection is isolated while real Pi built-in execution continues');
  await settings(); await tools();
  await action('pi-mcp-revoke-' + serverId); assert.equal((await catalog()).value.servers[0].status, 'revoked');
  await action('pi-mcp-remove-' + serverId); await page.getByTestId('pi-mcp-empty').waitFor(); assert.equal((await catalog()).value.servers.length, 0);
  check('Changed schema invalidates old trust; teacher can inspect/re-authorize/revoke/remove from the actual settings page');
  const builtIn = await chat('请只调用update_plan，把当前计划设置成一个步骤“核验完成”，然后回复已记录；不要调用外部工具或读取文件。');
  assert.equal(builtIn.status, 'completed', builtIn.error); assert.equal(fixture.state.calls, calls); assert(builtIn.items.some(t => t.kind === 'tool' && t.status === 'completed'));
  check('After MCP removal the existing Pi built-in tool path still works and no external service is called');
  assert.deepEqual(report.errors, []); assert.equal(fingerprint(buildRoot).sha256, build.sha256); report.success = true;
} catch (e) { report.error = String(e.stack || e).replaceAll(apiKey, '[redacted]').replaceAll(secret, '[redacted]'); process.exitCode = 1; }
finally { await app?.close().catch(() => undefined); await fixture.close(); report.scriptSha256 = sha256(fs.readFileSync(new URL(import.meta.url))); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ success: report.success, checks: report.checks.length, output, error: report.error })); }
