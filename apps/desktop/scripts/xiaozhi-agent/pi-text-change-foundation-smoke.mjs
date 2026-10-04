import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
const { createTextChangeState, changeHash } = await import('../../src/main/xiaozhi-agent/text-change-state.ts');
const { createTextChangeService } = await import('../../src/main/xiaozhi-agent/text-change-service.ts');
const { createXiaozhiSessionState } = await import('../../src/main/xiaozhi-agent/session-state.ts');
const testRoot = fs.realpathSync(path.resolve('test-results/xiaozhi-agent'));
const session = `aisession_${randomUUID()}`, otherSession = `aisession_${randomUUID()}`;
globalThis.fetch = async () => { throw new Error('No network is permitted in the foundation suite'); };
const attach = db => createTextChangeState({ run: async (s,v=[]) => db.prepare(s).run(...v),
  change: async (s,v=[]) => Number(db.prepare(s).run(...v).changes), all: async (s,v=[]) => db.prepare(s).all(...v) });
function engine(directory, extra = {}) {
  const db = new DatabaseSync(path.join(directory, 'ledger.db'));
  db.exec('PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS ai_conversation_sessions(id TEXT PRIMARY KEY)');
  for (const id of [session, otherSession]) db.prepare('INSERT OR IGNORE INTO ai_conversation_sessions VALUES(?)').run(id);
  const state = attach(db), dataRoot = path.join(directory, 'data'), workspace = path.join(directory, 'workspace');
  fs.mkdirSync(dataRoot, { recursive: true }); fs.mkdirSync(workspace, { recursive: true });
  let grant = workspace, active = true;
  const service = createTextChangeService({ state, dataRoot, workspace: async () => grant,
    isCurrent: () => active, ...extra });
  return { db, state, service, workspace, dataRoot, setGrant: v => grant = v, setActive: v => active = v };
}
if (process.argv[2] === '--child') {
  const directory = fs.realpathSync(process.argv[3]), relative = path.relative(testRoot, directory);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
  const data = JSON.parse(fs.readFileSync(path.join(directory, 'child.json')));
  const e = engine(directory, { afterStage: async stage => { if (stage === data.cut) process.exit(73); } });
  await e.state.migrate();
  if (data.undo) await e.service.decision(data.decision);
  else await e.service.apply(data.sessionId, data.id);
  throw new Error('The real process-exit cut was not reached');
}
const output = fs.mkdtempSync(path.join(testRoot, 'pi-text-change-foundation-'));
const report = { success: false, checks: [], boundary: 'Real Pi0.80.3 tools/diff, SQLite, local files and child-process exits. No provider, UI/IPC, production tool registration or full P07-A claim.' };
const opened = [];
async function fixture(extra) {
  const e = engine(fs.mkdtempSync(path.join(output, 'owned-')), extra); opened.push(e);
  await e.state.migrate(); await e.state.migrate(); return e;
}
const file = (e, text = '第一段\n第二段\n') => { fs.writeFileSync(path.join(e.workspace, '资料.md'), text); return Buffer.from(text); };
const propose = (e, oldText = '第一段', newText = '教师确认的新段') => e.service.propose(session, 'owned-run', randomUUID(), { operation: 'edit', path: '资料.md', edits: [{ oldText, newText }] });
const decision = (e, row, action) => e.service.decision({ schemaVersion: 'xiaozhi.change.v1', sessionId: session, changeId: row.id, revision: row.revision, action });
const apply = async (e, row) => { const approved = await decision(e, row, 'approve'); return e.service.apply(session, approved.id); };
const check = async (name, action) => { await action(); report.checks.push({ name, pass: true }); console.log('PASS ' + name); };
try {
  await check('Original Pi edit proposes disjoint replacements, original diff and patch with zero filesystem effect', async () => {
    const e = await fixture(), before = file(e);
    const row = await e.service.propose(session, 'owned-run', 'two-edits', { operation: 'edit', path: '资料.md', edits: [{ oldText: '第一段', newText: '新一' }, { oldText: '第二段', newText: '新二' }] });
    assert.equal(row.state, 'pending'); assert(fs.readFileSync(path.join(e.workspace, '资料.md')).equals(before));
    const review = await e.service.review(session, row.id); assert.equal(review.after, '新一\n新二\n'); assert.equal(review.before, before.toString());
    assert.match(row.patch, /@@/); assert.match(row.diff, /新一/); assert(!('workspaceHash' in row) && !('after' in row));
    await assert.rejects(e.service.apply(session, row.id), /conflict/); assert(fs.readFileSync(path.join(e.workspace, '资料.md')).equals(before));
  });
  await check('Pi preserves UTF8 BOM and CRLF bytes on edit and exact undo', async () => {
    const e = await fixture(), before = file(e, '\uFEFF第一段\r\n第二段\r\n');
    const applied = await apply(e, await propose(e)); assert.equal(applied.state, 'applied');
    assert.equal(fs.readFileSync(path.join(e.workspace, '资料.md')).toString(), '\uFEFF教师确认的新段\r\n第二段\r\n');
    assert.equal((await decision(e, applied, 'undo')).state, 'reverted'); assert(fs.readFileSync(path.join(e.workspace, '资料.md')).equals(before));
  });
  await check('Original SDK fuzzy Unicode matching is retained and its actual result is reviewed', async () => {
    const e = await fixture(); file(e, '题目“重要”\n保留行\n');
    const row = await e.service.propose(session, 'owned-run', 'fuzzy', { operation: 'edit', path: '资料.md', edits: [{ oldText: '题目"重要"', newText: '题目更新' }] });
    assert.equal((await e.service.review(session, row.id)).after, '题目更新\n保留行\n');
  });
  await check('Pi rejects ambiguous, overlapping and no-change edits without a ledger entry or write', async () => {
    const e = await fixture(); file(e, '重复\n重复\nabcde\n');
    const bad = [[{ oldText: '重复', newText: '新' }], [{ oldText: 'abcde', newText: 'f' }, { oldText: 'bcd', newText: 'g' }], [{ oldText: 'abcde', newText: 'abcde' }]];
    for (const edits of bad) await assert.rejects(e.service.propose(session, 'owned-run', randomUUID(), { operation: 'edit', path: '资料.md', edits }));
    assert.equal((await e.state.list(session)).length, 0); assert.equal(fs.readFileSync(path.join(e.workspace, '资料.md')).toString(), '重复\n重复\nabcde\n');
  });
  await check('Reject is durable, cannot execute, and keeps exact source', async () => {
    const e = await fixture(), before = file(e), row = await propose(e);
    assert.equal((await decision(e, row, 'reject')).state, 'rejected');
    await assert.rejects(e.service.apply(session, row.id), /conflict/); assert(fs.readFileSync(path.join(e.workspace, '资料.md')).equals(before));
  });
  await check('Call identity and revision CAS refuse duplicates with different input and stale approvals', async () => {
    const e = await fixture(); file(e); const input = { operation: 'edit', path: '资料.md', edits: [{ oldText: '第一段', newText: '一' }] };
    const row = await e.service.propose(session, 'owned-run', 'same-call', input);
    assert.equal((await e.service.propose(session, 'owned-run', 'same-call', input)).id, row.id);
    await assert.rejects(e.service.propose(session, 'owned-run', 'same-call', { ...input, edits: [{ oldText: '第一段', newText: '二' }] }), /conflict/);
    const approved = await decision(e, row, 'approve'); await assert.rejects(decision(e, row, 'approve'), /conflict/);
    await e.service.apply(session, row.id); await assert.rejects(e.service.apply(session, approved.id), /conflict/);
    assert.equal((await e.state.list(session)).length, 1);
  });
  await check('Cross-session review, decision and apply cannot read or commit another session change', async () => {
    const e = await fixture(); file(e); const row = await propose(e);
    await assert.rejects(e.service.review(otherSession, row.id), /permission_denied/);
    await assert.rejects(e.service.decision({ schemaVersion: 'xiaozhi.change.v1', sessionId: otherSession, changeId: row.id, revision: 0, action: 'approve' }), /permission_denied/);
    await assert.rejects(e.service.apply(otherSession, row.id), /permission_denied/);
  });
  await check('Source changes before approval or after approval become conflict without overwriting teacher edits', async () => {
    for (const when of ['before', 'after']) {
      const e = await fixture(); file(e); let row = await propose(e);
      if (when === 'after') row = await decision(e, row, 'approve');
      fs.writeFileSync(path.join(e.workspace, '资料.md'), '教师手改');
      const result = when === 'before' ? await decision(e, row, 'approve') : await e.service.apply(session, row.id);
      assert.equal(result.state, 'conflict'); assert.equal(fs.readFileSync(path.join(e.workspace, '资料.md')).toString(), '教师手改');
    }
  });
  await check('Concurrent same-revision decisions and file commits cannot approve or install twice', async () => {
    const e = await fixture(); file(e); const row = await propose(e);
    const answers = await Promise.allSettled([decision(e, row, 'approve'), decision(e, row, 'reject')]);
    assert.equal(answers.filter(v => v.status === 'fulfilled').length, 1);
    assert.equal(answers.find(v => v.status === 'fulfilled').value.state, 'approved');
    const applied = await Promise.allSettled([e.service.apply(session, row.id), e.service.apply(session, row.id)]);
    assert.equal(applied.filter(v => v.status === 'fulfilled').length, 1);
    assert.equal((await e.state.get(row.id)).state, 'applied');
    assert.equal((await e.state.get(row.id)).revision, 3);
  });
  await check('Original Pi write only captures a new artifact until approval, exclusive installation and undo remove that artifact', async () => {
    const e = await fixture(), row = await e.service.propose(session, 'owned-run', 'create', { operation: 'create', path: '备课.md', content: '# 备课\n真实产物\n' });
    assert(!fs.existsSync(path.join(e.workspace, '备课.md'))); assert.match(row.diff, /真实产物/); assert.match(row.patch, /@@/);
    const applied = await apply(e, row); assert.equal(fs.readFileSync(path.join(e.workspace, '备课.md')).toString(), '# 备课\n真实产物\n');
    assert.equal(fs.lstatSync(path.join(e.workspace, '备课.md')).nlink, 1);
    assert.equal((await decision(e, applied, 'undo')).state, 'reverted'); assert(!fs.existsSync(path.join(e.workspace, '备课.md')));
  });
  await check('A competing new target refuses approval without overwriting it or creating parent directories', async () => {
    const e = await fixture(), row = await e.service.propose(session, 'owned-run', 'create', { operation: 'create', path: '备课.txt', content: '拟内容' });
    fs.writeFileSync(path.join(e.workspace, '备课.txt'), '其他来源'); assert.equal((await decision(e, row, 'approve')).state, 'conflict');
    assert.equal(fs.readFileSync(path.join(e.workspace, '备课.txt')).toString(), '其他来源');
    await assert.rejects(e.service.propose(session, 'owned-run', 'parent', { operation: 'create', path: '缺失/备课.md', content: '新' }), /not_found/); assert(!fs.existsSync(path.join(e.workspace, '缺失')));
  });
  await check('Undo conflict preserves a subsequent manual modification exactly', async () => {
    const e = await fixture(); file(e); const row = await apply(e, await propose(e)); fs.writeFileSync(path.join(e.workspace, '资料.md'), '手工新版本');
    assert.equal((await decision(e, row, 'undo')).state, 'undo_conflict'); assert.equal(fs.readFileSync(path.join(e.workspace, '资料.md')).toString(), '手工新版本');
  });
  await check('Stop, cancellation and workspace revocation refuse approved effects', async () => {
    for (const mode of ['stop', 'abort', 'revoke']) {
      const e = await fixture(), before = file(e), approved = await decision(e, await propose(e), 'approve'), controller = new AbortController();
      if (mode === 'stop') e.setActive(false); if (mode === 'abort') controller.abort(); if (mode === 'revoke') e.setGrant(null);
      await assert.rejects(e.service.apply(session, approved.id, controller.signal), /permission_denied|cancelled/);
      assert(fs.readFileSync(path.join(e.workspace, '资料.md')).equals(before));
    }
  });
  await check('Traversal, credentials, Windows path aliases, device names, unsupported formats and hardlinks are rejected', async () => {
    const e = await fixture(); file(e); fs.linkSync(path.join(e.workspace, '资料.md'), path.join(e.workspace, '硬链接.md'));
    for (const raw of ['../外部.md', '.env.md', '.git/资料.md', '.pi/资料.md', 'con.md', 'AUX.txt', 'dir./x.md', 'dir /x.md', '资料.md:流', '资料.pdf', '硬链接.md', path.resolve(e.workspace, '资料.md')]) {
      await assert.rejects(e.service.propose(session, 'owned-run', randomUUID(), { operation: 'edit', path: raw, edits: [{ oldText: '第一段', newText: '新' }] }));
    }
    assert.equal((await e.state.list(session)).length, 0);
  });
  await check('Ancestor junctions and target replacement by a link fail closed before commit', async () => {
    const e = await fixture(), outside = path.join(path.dirname(e.workspace), 'outside'); fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, '原文.md'), '外部原文');
    fs.symlinkSync(outside, path.join(e.workspace, '链接目录'), 'junction');
    await assert.rejects(e.service.propose(session, 'owned-run', 'junction', { operation: 'edit', path: '链接目录/原文.md', edits: [{ oldText: '外部', newText: '错误' }] }), /permission_denied/);
    file(e); const row = await decision(e, await propose(e), 'approve');
    fs.unlinkSync(path.join(e.workspace, '资料.md')); fs.linkSync(path.join(outside, '原文.md'), path.join(e.workspace, '资料.md'));
    await assert.rejects(e.service.apply(session, row.id), /permission_denied/);
    assert.equal(fs.readFileSync(path.join(outside, '原文.md')).toString(), '外部原文');
  });
  await check('Invalid UTF8, NUL, oversized text and invalid nested inputs never reach disk', async () => {
    const e = await fixture(); fs.writeFileSync(path.join(e.workspace, '资料.md'), Buffer.from([0xff])); await assert.rejects(propose(e), /unsupported/);
    for (const content of ['a\0b', '长'.repeat(22000)]) await assert.rejects(e.service.propose(session, 'owned-run', randomUUID(), { operation: 'create', path: '新.md', content }));
    await assert.rejects(e.service.propose(session, 'owned-run', randomUUID(), { operation: 'edit', path: '资料.md', edits: [{ oldText: 'a', newText: 'b', execute: 'foreign' }] }), /invalid_input/);
    assert(!fs.existsSync(path.join(e.workspace, '新.md')));
  });
  await check('Recovery invalidates pending/approved intents idempotently and never writes files', async () => {
    const e = await fixture(), before = file(e), pending = await propose(e), approved = await decision(e, await propose(e, '第二段', '新二'), 'approve');
    await e.state.recover(); await e.state.recover();
    assert.equal((await e.state.get(pending.id)).state, 'interrupted'); assert.equal((await e.state.get(approved.id)).state, 'interrupted');
    assert.equal((await e.state.get(approved.id)).revision, 2); assert(fs.readFileSync(path.join(e.workspace, '资料.md')).equals(before));
  });
  await check('Ledger hash corruption and unknown schema fail closed before file effect', async () => {
    const e = await fixture(), before = file(e), row = await propose(e);
    const original = await e.state.get(row.id);
    e.db.prepare('UPDATE xiaozhi_pi_text_changes SET after_bytes=? WHERE id=?').run(Buffer.from('tampered'), row.id);
    await assert.rejects(e.service.review(session, row.id), /configuration/); assert(fs.readFileSync(path.join(e.workspace, '资料.md')).equals(before));
    e.db.prepare('UPDATE xiaozhi_pi_text_changes SET after_bytes=?,diff=? WHERE id=?').run(original.after, 'fake review', row.id);
    await assert.rejects(e.service.review(session, row.id), /configuration/);
    e.db.exec('PRAGMA ignore_check_constraints=ON'); e.db.prepare('UPDATE xiaozhi_pi_text_changes SET schema_version=9 WHERE id=?').run(row.id);
    await assert.rejects(e.state.get(row.id), /configuration/);
  });
  await check('Real child exits after intent/file and undo-intent/undo-file are classified by read-only verification without replay', async () => {
    for (const cut of ['intent', 'file', 'undo-intent', 'undo-file']) {
      const e = await fixture(), before = file(e); let row = await propose(e);
      const undo = cut.startsWith('undo'); row = undo ? await apply(e, row) : await decision(e, row, 'approve');
      const directory = path.dirname(e.db.location());
      fs.writeFileSync(path.join(directory, 'child.json'), JSON.stringify({ cut, undo, sessionId: session, id: row.id,
        decision: { schemaVersion: 'xiaozhi.change.v1', sessionId: session, changeId: row.id, revision: row.revision, action: 'undo' } }));
      e.db.close(); opened.splice(opened.indexOf(e), 1);
      const child = spawnSync(process.execPath, [path.resolve('scripts/xiaozhi-agent/pi-text-change-foundation-smoke.mjs'), '--child', directory], { encoding: 'utf8', timeout: 30000 });
      assert.equal(child.status, 73, child.stderr);
      const restarted = engine(directory); opened.push(restarted); await restarted.state.recover();
      const uncertain = await restarted.state.get(row.id); assert.equal(uncertain.state, undo ? 'undo_uncertain' : 'uncertain');
      const bytes = fs.readFileSync(path.join(restarted.workspace, '资料.md')), actualHash = changeHash(bytes);
      const verified = await decision(restarted, uncertain, 'verify'); assert.equal(changeHash(fs.readFileSync(path.join(restarted.workspace, '资料.md'))), actualHash);
      assert.equal(verified.state, cut === 'intent' ? 'interrupted' : cut === 'undo-file' ? 'reverted' : 'applied');
      if (cut === 'intent' || cut === 'undo-file') assert(bytes.equals(before));
    }
  });
  await check('Old real isolated database copy migrates through production session-state without changing prior business/history facts', async () => {
    const source = path.resolve('test-results/xiaozhi-agent/pi-shell-reading-NOm6wY/data/app.db');
    const relative = path.relative(testRoot, source); assert(!relative.startsWith('..') && !path.isAbsolute(relative));
    const hash = changeHash(fs.readFileSync(source)), copy = path.join(output, 'legacy-copy.db'); fs.copyFileSync(source, copy);
    const db = new DatabaseSync(copy);
    try {
      const names = ['students', 'teacher_resources', 'ai_conversation_messages', 'ai_agent_runs', 'ai_confirmation_items'];
      const before = Object.fromEntries(names.map(name => [name, db.prepare(`SELECT * FROM ${name} ORDER BY id`).all()]));
      const state = createXiaozhiSessionState({ run: async(s,v=[]) => db.prepare(s).run(...v), change: async(s,v=[]) => Number(db.prepare(s).run(...v).changes), all: async(s,v=[]) => db.prepare(s).all(...v) });
      await state.init(); await state.init();
      assert.deepEqual(Object.fromEntries(names.map(name => [name, db.prepare(`SELECT * FROM ${name} ORDER BY id`).all()])), before);
      assert.equal(db.prepare('SELECT count(*) AS n FROM xiaozhi_pi_text_changes').get().n, 0);
    } finally { db.close(); }
    assert.equal(changeHash(fs.readFileSync(source)), hash);
  });
  report.success = true;
} catch (error) { report.error = String(error.stack || error); console.error(report.error); process.exitCode = 1; }
finally {
  for (const e of opened) e.db.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ success: report.success, checks: report.checks.length, report: path.relative('.', path.join(output, 'report.json')) }));
}
