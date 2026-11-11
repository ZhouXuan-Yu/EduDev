import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import { fixture } from './kb-retrieval-boundaries.mjs';

const { materialSource } = await import('../../src/main/assets/material-source.ts');
const { searchQuestionRows } = await import('../../src/main/education/question-retrieval.ts');
const state = await fixture(1);
const checks = [];

try {
  const { db, repo, addQuestion } = state;
  const sql = {
    all: async (query, values = []) => db.prepare(query).all(...values),
    run: async (query, values = []) => db.prepare(query).run(...values),
  };
  // Use production SQL for lexical filtering, with the existing controlled vector port.
  repo.host.keyword = async filters => {
    const { rows } = await searchQuestionRows(sql, filters, false);
    return rows.map(row => ({ ...repo.host.question(row), score: 0, matchReason: 'keyword' }));
  };

  const chunk = db.prepare('SELECT * FROM resource_chunks WHERE id=?').get(state.chunks[0]);
  const source = materialSource({
    resourceId: state.rid,
    version: 'a'.repeat(64),
    title: '自己的资料.md',
    offset: 0,
    chunk: repo.host.chunk(chunk),
  });
  for (let index = 0; index < 150; index++) addQuestion('其他题目 ' + index);
  const wanted = addQuestion('物体处于静止状态，分析受到的力。');
  const archive = {
    schemaVersion: 'xiaozhi.question-archive.v1',
    extractor: 'numbered-text.v1',
    state: 'teacher_edited',
    number: '77',
    sources: [source],
    issues: [],
    sourceRisks: [],
    sourceChecked: true,
    answerOrigin: 'source',
    analysisOrigin: 'source',
  };
  db.prepare('UPDATE question_bank_items SET archive_json=? WHERE id=?').run(JSON.stringify(archive), wanted);
  await state.ready();
  const generation = state.generations.get((await repo.status()).generation);
  const wantedFact = generation.get('question' + wanted);
  generation.delete('question' + wanted);
  generation.set('question' + wanted, wantedFact);
  let factReads = 0;
  const originalAll = repo.host.all;
  repo.host.all = async (query, values) => {
    if (query.startsWith('SELECT q.*')) factReads++;
    return originalAll(query, values);
  };
  const before = db.prepare('SELECT * FROM question_bank_items ORDER BY id').all();
  const started = performance.now();
  const result = await repo.questions({ query: '平衡条件', questionNumber: '77', limit: 8 });

  const summary = {
    returned: result.questions.map(question => ({ id: question.id, number: question.archive?.number })),
    wanted,
    vectorLimits: state.state.queries.map(query => query.limit),
    factReads,
    milliseconds: performance.now() - started,
    scope: 'Production repository and SQLite with a controlled vector port, one exact-number question behind 150 off-scope candidates.',
  };
  console.log(JSON.stringify(summary));
  assert.deepEqual(result.questions.map(question => question.id), [wanted]);
  assert(state.state.queries.some(query => query.limit >= 200));
  assert.equal(factReads, 1, 'Off-scope numbers must be removed before expensive source validation');
  assert.deepEqual(db.prepare('SELECT * FROM question_bank_items ORDER BY id').all(), before);
  checks.push('Exact number excludes foreign candidates and reaches the target after 150 off-scope hits');

  const trimmed = await repo.questions({ query: '平衡条件', questionNumber: ' 77 ' });
  assert.deepEqual(trimmed.questions.map(question => question.id), [wanted]);
  checks.push('Whitespace uses the existing normalized filter');

  for (const number of ['999', '077', "77' OR 1=1 --"]) {
    const missing = await repo.questions({ query: '平衡条件', questionNumber: number });
    assert.deepEqual(missing.questions, []);
  }
  checks.push('Missing, leading-zero and SQL-like values do not fall back to foreign numbers');

  const unscoped = await repo.questions({ query: '平衡条件', limit: 8 });
  assert.equal(unscoped.questions.length, 8);
  checks.push('Unnumbered hybrid search retains ordinary candidates');

  const lexical = await repo.questions({ query: '物体', questionNumber: '77' });
  assert.deepEqual(lexical.questions.map(question => question.id), [wanted]);
  checks.push('Lexical and semantic paths share the exact-number scope');

  const savedPort = repo.port;
  repo.configure(undefined);
  const fallback = await repo.questions({ query: '物体', questionNumber: '77' });
  assert.deepEqual(fallback.questions.map(question => question.id), [wanted]);
  repo.configure(savedPort);
  checks.push('The existing keyword fallback keeps the same number restriction');
  assert.deepEqual(db.prepare('SELECT * FROM question_bank_items ORDER BY id').all(), before);

  state.state.afterQuestionRead = () => {
    db.prepare('UPDATE question_bank_items SET archive_json=? WHERE id=?')
      .run(JSON.stringify({ ...archive, number: '78' }), wanted);
  };
  const changed = await repo.questions({ query: '平衡条件', questionNumber: '77' });
  assert(!changed.questions.some(question => question.id === wanted));
  assert.equal(changed.semantic.complete, false);
  checks.push('A number changed during retrieval is rejected at the final current-fact gate');
  await state.ready();
  const renamed = await repo.questions({ query: '平衡条件', questionNumber: '78' });
  assert.deepEqual(renamed.questions.map(question => question.id), [wanted]);
  checks.push('The updated number becomes searchable after normal index catch-up');

  await assert.rejects(repo.questions({ query: '平衡条件', questionNumber: 77 }), /筛选参数/);
  checks.push('Invalid filter types retain boundary rejection');
  console.log(JSON.stringify({ success: true, checks, count: checks.length }));
} finally {
  state.db.close();
}
