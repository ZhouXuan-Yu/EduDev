import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const {basketFixture} = await import('./paper-basket-fixture.mjs');
const {
  PAPER_BASKET_SCHEMA, validPaperBasketCreate, validPaperBasketMutation, validBasketUiState,
} = await import('../../src/shared/paper-basket.ts');
const {PAPER_SCHEMA} = await import('../../src/shared/paper-blueprint.ts');
const {questionVersion} = await import('../../src/main/education/question-context-provider.ts');
const {createPaperBasketApi, registerPaperBasketIpc} = await import('../../src/main/education/paper-basket-api.ts');
const {compilePaperOffice, assertPaperOffice} = await import('../../src/main/education/paper-export.ts');
const {paperGenerationBoundaries} = await import('./paper-generation-boundaries.mjs');
const {basketApprovalBoundaries} = await import('./paper-basket-approval-boundaries.mjs');
const {basketOfficeBoundaries} = await import('./paper-basket-office-boundaries.mjs');
const {basketCapacityBoundaries} = await import('./paper-basket-capacity-boundaries.mjs');

const output = fs.mkdtempSync(path.join(tmpdir(), 'omni-paper-basket-'));
const report = {success: false, output, checks: [], boundary: 'Real owned SQLite/files; controlled sources; no Electron/model/full build'};
const fixture = await basketFixture(path.join(output, 'basket'));
const {db, sid, other, student, baskets, papers, question, put} = fixture;
const schema = {schemaVersion: PAPER_BASKET_SCHEMA, sessionId: sid};
const blueprint = (sections = [{id: 'a', label: '第一节', questionType: '解答题', count: 2, points: 5}], mode = 'source_only') => ({
  title: '手选受控卷', subject: '数学', grade: '初二', durationMinutes: 40,
  totalPoints: sections.reduce((total, section) => total + section.count * section.points, 0), mode, sections,
});
const ref = basket => ({...schema, basketId: basket.id});
const intent = (basket, operation) => ({...ref(basket), expectedRevision: basket.revision, requestId: randomUUID(), operation});
const snapshot = basket => ({...ref(basket), expectedRevision: basket.revision, requestId: randomUUID()});
const create = b => baskets.create({...schema, requestId: randomUUID(), blueprint: b || blueprint()});
const read = basket => baskets.read(ref(basket));
const mutate = (basket, operation) => baskets.mutate(intent(basket, operation));
async function add(basket, item, sectionId = 'a') {
  const candidate = await baskets.candidate({...ref(basket), questionId: item.id});
  return mutate(basket, {type: 'add', questionId: item.id, sectionId, expectedSourceVersion: candidate.contentVersion});
}
const decide = paper => ({schemaVersion: PAPER_SCHEMA, sessionId: sid, id: paper.id, revision: 1, action: 'confirm'});
const rows = table => db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all();
const check = async (name, action) => {
  try {
    await action();
    report.checks.push({name, pass: true});
    console.log('PASS ' + name);
  } catch (error) {
    report.checks.push({name, pass: false, error: String(error?.stack || error)});
    throw error;
  }
};
let basket;
const q1 = question('A');
const q2 = question('B');
const q3 = question('C');
try {
  await check('Strict intents reject unknown keys, getters, forged owner/facts, sparse or subclass arrays and coercion objects', async () => {
    const input = {...schema, requestId: randomUUID(), blueprint: blueprint()};
    assert(validPaperBasketCreate(input));
    for (const invalid of [{...input, studentId: student}, {...input, schemaVersion: 'unknown'}, {...input, blueprint: {...input.blueprint, durationMinutes: 0}}]) {
      assert(!validPaperBasketCreate(invalid));
    }
    let invoked = false;
    assert(!validPaperBasketCreate({...input, get blueprint() { invoked = true; return input.blueprint; }}));
    assert(!validPaperBasketCreate({...input, blueprint: {...input.blueprint, mode: {toString() { invoked = true; return 'source_only'; }}}}));
    assert(!invoked);
    const sample = await create();
    const operation = {type: 'reorderSection', sectionId: 'a', entryIds: ['xibasketentry_' + randomUUID()]};
    assert(!validPaperBasketMutation(intent(sample, {...operation, entryIds: new Array(1)})));
    class ExtraArray extends Array {}
    assert(!validPaperBasketMutation(intent(sample, {...operation, entryIds: new ExtraArray()})));
    assert(!validPaperBasketMutation(intent(sample, {type: 'add', questionId: q1.id, sectionId: 'a', expectedSourceVersion: 'a'.repeat(64), question: q1})));
    assert(!validBasketUiState({stage: {toString() { invoked = true; return 'select'; }}, filters: {}, offset: 0, scrollTop: 0}));
    assert(!invoked);
  });
  await check('Create is persistent canonical idempotency; altered intent conflicts; creating another basket preserves previous content', async () => {
    const input = {...schema, requestId: randomUUID(), blueprint: blueprint()};
    basket = await baskets.create(input);
    const reordered = {blueprint: input.blueprint, requestId: input.requestId, sessionId: sid, schemaVersion: PAPER_BASKET_SCHEMA};
    assert.equal((await baskets.create(reordered)).id, basket.id);
    await assert.rejects(baskets.create({...input, blueprint: {...input.blueprint, title: '不同'}}), /conflict/);
    const second = await create();
    assert.notEqual(second.id, basket.id);
    assert.equal((await read(basket)).revision, 1);
    assert((await baskets.list({...schema, limit: 1})).total >= 3);
  });
  await check('Owner reads/writes, archived sessions, student binding changes and inactive students refuse without mutation', async () => {
    const before = rows('paper_baskets');
    await assert.rejects(baskets.read({...ref(basket), sessionId: other}), /permission_denied/);
    await assert.rejects(baskets.mutate({...intent(basket, {type: 'archive'}), sessionId: other}), /permission_denied/);
    db.prepare('UPDATE ai_conversation_sessions SET archived_at=? WHERE id=?').run('archived', sid);
    await assert.rejects(read(basket), /permission_denied/);
    db.prepare('UPDATE ai_conversation_sessions SET archived_at=NULL,student_id=? WHERE id=?').run('', sid);
    await assert.rejects(read(basket), /permission_denied/);
    db.prepare('UPDATE ai_conversation_sessions SET student_id=? WHERE id=?').run(student, sid);
    db.prepare("UPDATE students SET status='archived' WHERE id=?").run(student);
    await assert.rejects(read(basket), /permission_denied/);
    db.prepare("UPDATE students SET status='active' WHERE id=?").run(student);
    assert.deepEqual(rows('paper_baskets'), before);
  });
  await check('Candidate returns complete host facts/contentVersion; legitimate bookmark version change does not prevent add', async () => {
    const candidate = await baskets.candidate({...ref(basket), questionId: q1.id});
    assert.deepEqual(candidate.question.stem, q1.stem);
    assert.equal(candidate.question.answer, q1.answer);
    assert.equal(candidate.contentVersion, questionVersion(q1));
    db.prepare('INSERT INTO bookmarks VALUES(?,?)').run(q1.id, 'bookmark-old');
    db.prepare('UPDATE bookmarks SET version=? WHERE question_id=?').run('bookmark-new', q1.id);
    basket = await mutate(basket, {type: 'add', questionId: q1.id, sectionId: 'a', expectedSourceVersion: candidate.contentVersion});
    assert.equal(basket.entries[0].contentVersion, candidate.contentVersion);
    assert.equal(basket.revision, 2);
  });
  await check('Source change between candidate and add is rejected atomically, preserving the teacher-visible version', async () => {
    const candidate = await baskets.candidate({...ref(basket), questionId: q2.id});
    put({...q2, answer: '已换版'});
    const before = rows('paper_basket_operations').length;
    await assert.rejects(mutate(basket, {type: 'add', questionId: q2.id, sectionId: 'a', expectedSourceVersion: candidate.contentVersion}), /source_changed/);
    assert.equal(rows('paper_basket_operations').length, before);
    assert.equal((await read(basket)).entries.length, 1);
    put(q2);
  });
  await check('Add rejects repeated ID/content, missing answer, unsupported facts and wrong section/type', async () => {
    const duplicate = question('duplicate', {...q1, id: 'question_' + randomUUID(), answer: '不同答案仍是相同题干'});
    const missing = question('missing', {answer: ''});
    const wrong = question('wrong', {questionType: '选择题'});
    await assert.rejects(add(basket, q1), /conflict/);
    await assert.rejects(add(basket, duplicate), /conflict/);
    await assert.rejects(add(basket, missing), /source_changed/);
    await assert.rejects(add(basket, wrong), /invalid_input/);
    const unsupported = question('unsupported', {stem: ''});
    await assert.rejects(add(basket, unsupported), /source_changed/);
    assert.equal((await read(basket)).entries.length, 1);
  });
  await check('CAS and retry ordering: same committed add survives stale expectedRevision, changed intent conflicts, new stale request refuses', async () => {
    const request = intent(basket, {type: 'add', questionId: q2.id, sectionId: 'a', expectedSourceVersion: questionVersion(q2)});
    basket = await baskets.mutate(request);
    const before = rows('paper_basket_operations').length;
    assert.equal((await baskets.mutate(request)).revision, basket.revision);
    assert.equal(rows('paper_basket_operations').length, before);
    await assert.rejects(baskets.mutate({...request, operation: {type: 'archive'}}), /conflict/);
    await assert.rejects(baskets.mutate({...request, requestId: randomUUID()}), /conflict/);
    assert(basket.complete);
  });
  await check('Section ordering requires exact membership; stable entry IDs survive reorder and no-op leaves revision unchanged', async () => {
    const ids = basket.entries.map(entry => entry.entryId);
    await assert.rejects(mutate(basket, {type: 'reorderSection', sectionId: 'a', entryIds: ids.slice(1)}), /invalid_input/);
    basket = await mutate(basket, {type: 'reorderSection', sectionId: 'a', entryIds: [...ids].reverse()});
    assert.deepEqual(basket.entries.map(entry => entry.entryId), [...ids].reverse());
    const revision = basket.revision;
    basket = await mutate(basket, {type: 'reorderSection', sectionId: 'a', entryIds: [...ids].reverse()});
    assert.equal(basket.revision, revision);
  });
  await check('Exact pending snapshot uses only selected IDs in canonical order and the same writer; no candidate scan or automatic fill', async () => {
    const before = fixture.counters();
    const request = snapshot(basket);
    const paper = await baskets.createSnapshot(request);
    assert.equal(paper.state, 'pending');
    assert.deepEqual(paper.selection.items.map(item => item.question.id), basket.entries.map(entry => entry.questionId));
    assert.deepEqual(paper.selection.items.map(item => item.entryId), basket.entries.map(entry => entry.entryId));
    assert.deepEqual(paper.selection.items.map(item => item.number), [1, 2]);
    assert.deepEqual(paper.basket, {basketId: basket.id, basketRevision: basket.revision, entryIds: basket.entries.map(entry => entry.entryId)});
    assert.equal(paper.selection.method, 'manual');
    assert.equal(paper.selection.scanned, 2);
    assert.equal(paper.selection.scanComplete, false);
    assert.equal(fixture.counters().pages, before.pages);
    assert.equal(fixture.counters().writes, before.writes + 1);
    assert.equal(fixture.counters().peakWriters, 1);
    assert.equal((await baskets.createSnapshot(request)).id, paper.id);
  });
  await check('Confirm and real synchronous file-install boundary recheck basket revision; UI preferences do not invalidate content', async () => {
    const pending = await baskets.createSnapshot(snapshot(basket));
    const confirmed = await papers.decide(decide(pending), () => true);
    const draft = compilePaperOffice(confirmed, 'student');
    const file = path.join(output, 'approved-install.txt');
    let installs = 0;
    const install = () => papers.withConfirmedSource(sid, confirmed.id, confirmed.digest, paper => {
      assertPaperOffice(paper, draft);
      installs++;
      fs.writeFileSync(file, paper.selection.items.map(item => item.question.stem).join('\n'));
    });
    await install();
    const bytes = fs.readFileSync(file);
    const revision = basket.revision;
    basket = await mutate(basket, {type: 'updateUiState', uiState: {stage: 'preview', filters: {query: '合成'}, offset: 20, scrollTop: 120}});
    assert.equal(basket.revision, revision);
    await install();
    const oldPending = await baskets.createSnapshot(snapshot(basket));
    basket = await mutate(basket, {type: 'reorderSection', sectionId: 'a', entryIds: basket.entries.map(entry => entry.entryId).reverse()});
    await assert.rejects(papers.decide(decide(oldPending), () => true), /source_changed/);
    await assert.rejects(install(), /conflict/);
    assert.equal(installs, 2);
    assert(fs.readFileSync(file).equals(bytes));
    const historical = await papers.review(sid, confirmed.id);
    assert.equal(historical.state, 'confirmed');
    assert.equal(historical.digest, confirmed.digest);
    assert.equal(historical.sourceCurrent, false);
  });
  await check('Retry returns original paper identity with current stale status after later basket edit; no second pending row', async () => {
    const request = snapshot(basket);
    const paper = await baskets.createSnapshot(request);
    basket = await mutate(basket, {type: 'updateBlueprint', blueprint: {...basket.blueprint, title: '教师改题篮标题'}});
    const count = rows('ai_confirmation_items').length;
    const retry = await baskets.createSnapshot(request);
    assert.equal(retry.id, paper.id);
    assert.equal(retry.sourceCurrent, false);
    assert.equal(rows('ai_confirmation_items').length, count);
  });
  await check('Blueprint changes retain orphan/mismatched and excess members; incomplete snapshots fail without partial paper', async () => {
    const entries = basket.entries;
    basket = await mutate(basket, {type: 'updateBlueprint', blueprint: blueprint([{id: 'new', label: '新节', questionType: '选择题', count: 1, points: 5}])});
    assert.deepEqual(basket.entries.map(entry => entry.question), entries.map(entry => entry.question));
    assert(basket.entries.every(entry => !entry.availability.available));
    const count = rows('ai_confirmation_items').length;
    await assert.rejects(baskets.createSnapshot(snapshot(basket)), /source_changed/);
    assert.equal(rows('ai_confirmation_items').length, count);
    basket = await mutate(basket, {type: 'updateBlueprint', blueprint: blueprint([{id: 'a', label: '缩减', questionType: '解答题', count: 1, points: 5}])});
    assert(basket.gaps.some(gap => gap.excess === 1));
    await assert.rejects(baskets.createSnapshot(snapshot(basket)), /shortage/);
    basket = await mutate(basket, {type: 'updateBlueprint', blueprint: blueprint()});
  });
  await check('Move validates target type/index/source quota and preserves canonical section order and entry identity', async () => {
    let moving = await create(blueprint([{id: 'a', label: '甲', questionType: '解答题', count: 1, points: 5}, {id: 'b', label: '乙', questionType: '解答题', count: 1, points: 5}]));
    moving = await add(moving, q1);
    moving = await add(moving, q2);
    assert(moving.gaps.some(gap => gap.excess));
    const entryId = moving.entries[0].entryId;
    await assert.rejects(mutate(moving, {type: 'moveEntry', entryId, sectionId: 'b', index: 1}), /invalid_input/);
    moving = await mutate(moving, {type: 'moveEntry', entryId, sectionId: 'b', index: 0});
    assert.equal(moving.entries[1].entryId, entryId);
    assert(moving.complete);
    await assert.rejects(mutate(moving, {type: 'moveEntry', entryId: moving.entries[0].entryId, sectionId: 'b', index: 1}), /shortage/);
    const paper = await baskets.createSnapshot(snapshot(moving));
    assert.deepEqual(paper.selection.items.map(item => item.sectionId), ['a', 'b']);
  });
  await check('Read keeps pinned facts while changed source/file blocks snapshot and confirmation; it never rebases or substitutes', async () => {
    const oldQuestion = basket.entries.find(entry => entry.questionId === q1.id).question;
    const request = snapshot(basket);
    const pending = await baskets.createSnapshot(request);
    put({...q1, answer: '新答案'});
    const stale = await read(basket);
    assert.deepEqual(stale.entries.find(entry => entry.questionId === q1.id).question, oldQuestion);
    assert.equal(stale.entries.find(entry => entry.questionId === q1.id).availability.reason, 'source_changed');
    await assert.rejects(baskets.createSnapshot(snapshot(basket)), /source_changed/);
    await assert.rejects(papers.decide(decide(pending), () => true), /source_changed/);
    assert.equal((await baskets.createSnapshot(request)).sourceCurrent, false);
    put(q1);
    const source = fixture.sources.get(q1.id);
    fs.writeFileSync(source.file, '原件换版');
    assert.equal((await read(basket)).entries.find(entry => entry.questionId === q1.id).availability.reason, 'source_unavailable');
    await assert.rejects(baskets.createSnapshot(snapshot(basket)), /source_changed/);
    fs.writeFileSync(source.file, source.text);
  });
  await check('Cancellation after writes atomically rolls back members/ledger/pending, including final asynchronous validation lease', async () => {
    const beforeBaskets = rows('paper_baskets');
    const beforeOps = rows('paper_basket_operations');
    const beforePapers = rows('ai_confirmation_items');
    let live = true;
    fixture.hook(() => { live = false; });
    await assert.rejects(baskets.mutate(intent(basket, {type: 'remove', entryId: basket.entries[0].entryId}), () => live), /cancelled/);
    live = true;
    await assert.rejects(baskets.createSnapshot(snapshot(basket), () => live), /cancelled/);
    live = true;
    await assert.rejects(baskets.create({...schema, requestId: randomUUID(), blueprint: blueprint()}, () => live), /cancelled/);
    fixture.hook(undefined);
    live = true;
    fixture.validationHook(() => { live = false; });
    await assert.rejects(baskets.mutate(intent(basket, {type: 'updateUiState', uiState: {
      stage: 'organize', filters: {}, offset: 0, scrollTop: 0,
    }}), () => live), /cancelled/);
    fixture.validationHook(undefined);
    assert.deepEqual(rows('paper_baskets'), beforeBaskets);
    assert.deepEqual(rows('paper_basket_operations'), beforeOps);
    assert.deepEqual(rows('ai_confirmation_items'), beforePapers);
  });
  await check('Concurrent connections cannot both mutate one revision; loser changes no ledger/member; fresh stale request conflicts', async () => {
    const a = intent(basket, {type: 'updateBlueprint', blueprint: {...basket.blueprint, title: '并发甲'}});
    const b = intent(basket, {type: 'updateBlueprint', blueprint: {...basket.blueprint, title: '并发乙'}});
    const before = rows('paper_basket_operations').length;
    const outcomes = await Promise.allSettled([baskets.mutate(a), fixture.repositories().baskets.mutate(b)]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(rows('paper_basket_operations').length, before + 1);
    basket = await read(basket);
    await assert.rejects(baskets.mutate({...a, requestId: randomUUID()}), /conflict/);
  });
  await check('Source-only/hybrid/original modes enforce current group/kind/owner references and exact source quotas', async () => {
    const generated = question('原创', {sourceKind: 'generated'});
    const variation = question('变式', {sourceKind: 'generated'});
    const g1 = fixture.group([generated]);
    const g2 = fixture.group([variation], 'variation');
    const only = await create();
    await assert.rejects(add(only, generated), /source_changed/);
    let hybrid = await create(blueprint([{id: 'a', label: '混合', questionType: '解答题', count: 2, points: 5, generatedCount: 1}], 'hybrid'));
    hybrid = await add(hybrid, q3);
    hybrid = await add(hybrid, generated);
    assert(hybrid.complete);
    const pending = await baskets.createSnapshot(snapshot(hybrid));
    assert.equal(pending.selection.items.filter(item => item.generation).length, 1);
    db.prepare('UPDATE generations SET body=? WHERE id=?').run(JSON.stringify({...g1, effectDigest: 'b'.repeat(64)}), g1.id);
    assert.equal((await read(hybrid)).entries.find(entry => entry.questionId === generated.id).availability.reason, 'generation_unavailable');
    await assert.rejects(papers.decide(decide(pending), () => true), /source_changed/);
    db.prepare('UPDATE generations SET body=? WHERE id=?').run(JSON.stringify(g1), g1.id);
    let original = await create(blueprint([{id: 'a', label: '原创', questionType: '解答题', count: 1, points: 10}], 'ai_original'));
    await assert.rejects(add(original, variation), /source_changed/);
    await assert.rejects(add(original, q3), /invalid_input/);
    original = await add(original, generated);
    assert(original.complete);
    db.prepare('DELETE FROM generations WHERE id=?').run(g1.id);
    await assert.rejects(baskets.createSnapshot(snapshot(original)), /source_changed/);
    db.prepare('INSERT INTO generations VALUES(?,?)').run(g1.id, JSON.stringify({...g1, sessionId: other}));
    await assert.rejects(read(original), /permission_denied/);
    db.prepare('DELETE FROM generations WHERE id IN (?,?)').run(g1.id, g2.id);
  });
  await check('Archive retains facts/history; remove is explicit; actual SQLite close/reopen restores content revision and UI preferences', async () => {
    const old = basket.entries;
    const cold = fixture.repositories();
    assert.deepEqual((await cold.baskets.read(ref(basket))).entries, (await read(basket)).entries);
    assert.equal((await cold.baskets.read(ref(basket))).uiState.stage, 'preview');
    basket = await mutate(basket, {type: 'remove', entryId: old[0].entryId});
    assert.equal(basket.entries.length, 1);
    basket = await mutate(basket, {type: 'archive'});
    assert.equal(basket.state, 'archived');
    assert.equal(basket.entries[0].entryId, old[1].entryId);
    await assert.rejects(mutate(basket, {type: 'remove', entryId: basket.entries[0].entryId}), /conflict/);
    fixture.close();
    const reopened = await fixture.repositories().baskets.read(ref(basket));
    assert.equal(reopened.state, 'archived');
    assert.equal(reopened.revision, basket.revision);
    assert.deepEqual(reopened.entries, basket.entries);
    assert.deepEqual(reopened.uiState, basket.uiState);
    const connection = new DatabaseSync(fixture.file, {readOnly: true});
    try { assert.equal(connection.prepare('SELECT state FROM paper_baskets WHERE id=?').get(basket.id).state, 'archived'); }
    finally { connection.close(); }
  });
  await check('Typed IPC denies untrusted frame, validates before lease access, and maps cancellation/errors without returning empty success', async () => {
    let leases = 0;
    const api = createPaperBasketApi(baskets, () => { leases++; return () => false; });
    assert.equal((await api.createPaperBasket({studentId: 'forged'})).error, 'invalid_input');
    assert.equal(leases, 0);
    assert.equal((await api.createPaperBasket({...schema, requestId: randomUUID(), blueprint: blueprint()})).error, 'cancelled');
    const handlers = new Map();
    registerPaperBasketIpc({ipcMain: {handle: (channel, action) => handlers.set(channel, action)}, allowed: event => event === 'main', host: api});
    assert.equal(handlers.size, 6);
    for (const handler of handlers.values()) assert.equal((await handler('subframe', {})).error, 'permission_denied');
    assert.equal((await handlers.get('education:paper-basket-read')('main', {})).error, 'invalid_input');
  });
  await check('Old source-only v1 snapshot/confirm/file compile remains compatible without basket binding', async () => {
    const input = {schemaVersion: PAPER_SCHEMA, sessionId: sid, requestId: randomUUID(), blueprint: blueprint()};
    const old = await papers.create(input, '', '', () => true);
    assert.equal(old.basket, undefined);
    assert.equal(old.selection.method, undefined);
    const confirmed = await papers.decide(decide(old), () => true);
    assert(compilePaperOffice(confirmed, 'teacher'));
    assert.equal((await papers.review(sid, confirmed.id)).digest, confirmed.digest);
  });
  const generations = path.join(output, 'existing-generations');
  fs.mkdirSync(generations);
  await basketApprovalBoundaries(check, output);
  await basketOfficeBoundaries(check, output);
  await basketCapacityBoundaries(check, output);
  await paperGenerationBoundaries(check, generations);
  report.success = true;
} catch (error) {
  report.error = String(error?.stack || error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  fixture.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: report.checks.filter(check => check.pass).length, output}));
}
