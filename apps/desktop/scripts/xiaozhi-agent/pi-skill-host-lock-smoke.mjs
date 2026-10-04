import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
const { createXiaozhiProductionHost } = await import('../../src/main/xiaozhi-agent/production-host.ts');
const { createXiaozhiSessionState } = await import('../../src/main/xiaozhi-agent/session-state.ts');
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), tests = fs.realpathSync(path.join(desktop, 'test-results/xiaozhi-agent'));
const original = fs.realpathSync(path.join(tests, 'pi-control-ui-2AWPBO/data/app.db')), output = fs.mkdtempSync(path.join(tests, 'pi-skill-host-lock-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex'), originalHash = hash(fs.readFileSync(original));
fs.copyFileSync(original, path.join(output, 'app.db')); const db = new DatabaseSync(path.join(output, 'app.db'));
const state = createXiaozhiSessionState({ run: async (sql, values = []) => db.prepare(sql).run(...values), change: async (sql, values = []) => Number(db.prepare(sql).run(...values).changes), all: async (sql, values = []) => db.prepare(sql).all(...values) });
const checks = [], report = { suite: 'pi-skill-host-lock', success: false, checks, boundaries: [
  'Real production host and disposable SQLite copy; deterministic chooser/startup barriers',
  'No provider call or management UI acceptance claimed',
] };
const check = async (name, fn) => { await fn(); checks.push({ name, pass: true }); };
let host, detailEntered, releaseDetail;
try {
  await state.init();
  const session = db.prepare('SELECT id FROM ai_conversation_sessions LIMIT 1').get().id;
  const store = { xiaozhiState: state, getAiConversationSession: async () => { detailEntered?.(); if (releaseDetail) await new Promise(resolve => { releaseDetail.current = resolve; }); return { session: { archivedAt: 'controlled-startup-cancel' } }; } };
  host = createXiaozhiProductionHost({ store, dataRoot: output, emit: () => assert.fail('Startup barrier must not emit a model/tool event') });
  let catalog = await host.skillCatalog();
  await check('Production host seeds one persistent managed catalog and exposes no default external package', async () => { assert.equal(catalog.skills.length, 4); assert(catalog.skills.every(item => item.origin === 'builtin')); });
  let releaseChooser; const command = () => ({ sessionId: session, commandId: `xicmd_${randomUUID()}`, prompt: '本地锁定边界实例' });
  const pending = host.importSkill(catalog.revision, () => new Promise(resolve => { releaseChooser = resolve; }));
  await new Promise(resolve => setImmediate(resolve));
  await check('Native chooser lifetime globally blocks starts and concurrent management before async waits', async () => {
    assert.equal((await host.start(command())).error, 'busy');
    await assert.rejects(host.setSkillEnabled(catalog.skills[0].name, catalog.revision, false), /busy/);
    await assert.rejects(host.importSkill(catalog.revision, async () => undefined), /busy/);
  });
  releaseChooser(undefined); assert.equal(await pending, null);
  await check('Canceled chooser releases global lock without changing revision or creating metadata', async () => assert.deepEqual(await host.skillCatalog(), catalog));
  const source = path.join(output, 'teacher-package'); fs.mkdirSync(source);
  const document = '---\nname: teacher-office\ndescription: 教学会议纪要工作流程\n---\n\n# 教研纪要\n\n先读取授权资料，再交付可编辑正文。\n'; fs.writeFileSync(path.join(source, 'SKILL.md'), document);
  catalog = await host.importSkill(catalog.revision, async () => source);
  await check('Host authorized chooser imports actual package disabled and preview/version follows the catalog', async () => { assert(!catalog.skills.find(item => item.name === 'teacher-office').enabled); assert.equal((await host.skillPreview('teacher-office')).document, document); });
  catalog = await host.setSkillEnabled('teacher-office', catalog.revision, true);
  await check('Host CAS mutations reject stale version while preserving the current active descriptor', async () => { await assert.rejects(host.setSkillEnabled('teacher-office', catalog.revision - 1, false), /stale_version/); assert.deepEqual(await host.skillCatalog(), catalog); });
  let enteredResolve; const entered = new Promise(resolve => { enteredResolve = resolve; }); detailEntered = enteredResolve; releaseDetail = {};
  const starting = host.start(command()); await entered;
  await check('Reserved task startup blocks global mutation across sessions before any provider/model entry', async () => {
    await assert.rejects(host.setSkillEnabled('teacher-office', catalog.revision, false), /busy/);
    await assert.rejects(host.importSkill(catalog.revision, async () => source), /busy/);
  });
  releaseDetail.current(); const canceledStart = await starting; releaseDetail = undefined; detailEntered = undefined; assert(!canceledStart.ok);
  catalog = await host.editSkill('teacher-office', catalog.revision, document.replace('可编辑正文', '可编辑纪要草稿'));
  await check('Failed startup releases owner and edited instructions become a new disabled version', async () => { const item = catalog.skills.find(skill => skill.name === 'teacher-office'); assert.equal(item.version, 2); assert(!item.enabled); });
  catalog = await host.archiveSkill('teacher-office', catalog.revision);
  await check('Archive through host preserves original local package and source data', async () => { assert(catalog.skills.find(item => item.name === 'teacher-office').archived); assert.equal(fs.readFileSync(path.join(source, 'SKILL.md'), 'utf8'), document); });
  const beforeClosing = catalog;
  const closingImport = host.importSkill(catalog.revision, () => new Promise(resolve => { releaseChooser = resolve; })); await new Promise(resolve => setImmediate(resolve));
  await host.close(); releaseChooser(source); await assert.rejects(closingImport, /busy/);
  await check('Closing during chooser cannot publish a late package or resurrect configuration', async () => { assert.deepEqual(await state.skillCatalog(), beforeClosing); assert.equal(hash(fs.readFileSync(original)), originalHash); });
  report.success = true;
} catch (error) { report.error = String(error?.stack || error).slice(0, 1400); process.exitCode = 1; }
finally { await host?.close().catch(() => {}); db.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ success: report.success, checks: checks.length, error: report.error, output })); }
