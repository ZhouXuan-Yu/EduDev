import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const {questionRetrievalWhere, validatedQuestionFilters} = await import('../../src/main/education/question-retrieval.ts');
const {validBasketUiState} = await import('../../src/shared/paper-basket.ts');
const {sameBasketUi} = await import('../../src/renderer/components/paper-ui/paper-basket-ui.ts');

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE question_bank_items (
  id TEXT PRIMARY KEY, subject TEXT, grade TEXT, question_type TEXT,
  difficulty TEXT, source_kind TEXT, knowledge_point TEXT, archive_json TEXT
)`);
const put = db.prepare('INSERT INTO question_bank_items VALUES(?,?,?,?,?,?,?,?)');
put.run('exact', '数学', '初二', '选择题', 'medium', 'teacher_resource', '方程', JSON.stringify({number: '2'}));
put.run('twelve', '数学', '初二', '选择题', 'medium', 'teacher_resource', '方程', JSON.stringify({number: '12'}));
put.run('other-grade', '数学', '初三', '选择题', 'medium', 'teacher_resource', '方程', JSON.stringify({number: '2'}));
put.run('legacy', '数学', '初二', '选择题', 'medium', 'local_bank', '方程', '');
put.run('malformed', '数学', '初二', '选择题', 'medium', 'local_bank', '方程', '{');
const find = filters => {
  const {clauses, params} = questionRetrievalWhere(filters, false);
  return db.prepare('SELECT q.id FROM question_bank_items q' + (clauses.length ? ' WHERE ' + clauses.join(' AND ') : '') + ' ORDER BY q.id')
    .all(...params).map(row => row.id);
};
let passed = 0;
const check = (name, action) => {action(); passed++; console.log('PASS ' + name);};
try {
  check('Original question number is an exact AND filter before pagination', () => {
    assert.deepEqual(find({questionNumber: '2', subject: '数学', grade: '初二'}), ['exact']);
    assert.deepEqual(find({questionNumber: '12', subject: '数学', grade: '初二'}), ['twelve']);
  });
  check('Clearing the number retains legacy and malformed-archive discovery', () => {
    assert.equal(find({}).length, 5);
    assert.equal(find({questionNumber: '  '}).length, 5);
  });
  check('Number combines with source, knowledge, type and difficulty without broadening', () => {
    const filters = {questionNumber: '2', grade: '初二', sourceKind: 'teacher_resource', knowledgePoint: '方程', questionType: '选择题', difficulty: 'medium'};
    assert.deepEqual(find(filters), ['exact']);
    assert.deepEqual(find({...filters, difficulty: 'hard'}), []);
    assert.deepEqual(find({...filters, questionNumber: "2' OR 1=1 --"}), []);
  });
  check('Boundary validation rejects wrong types, control characters and accessors', () => {
    for (const questionNumber of [2, null, {}, '2\n', 'x'.repeat(241)]) assert.throws(() => validatedQuestionFilters({questionNumber}));
    let read = false;
    assert.throws(() => validatedQuestionFilters({get questionNumber() {read = true; return '2';}}));
    assert.equal(read, false);
    assert.equal(validatedQuestionFilters({questionNumber: ' 2 '}).questionNumber, '2');
  });
  check('Saved basket preferences distinguish original-number changes and retain old inputs', () => {
    const old = {stage: 'select', filters: {}, offset: 0, scrollTop: 0};
    const numbered = {...old, filters: {questionNumber: '2'}};
    assert(validBasketUiState(old)); assert(validBasketUiState(numbered));
    assert.equal(sameBasketUi(old, numbered), false);
    assert.equal(sameBasketUi(numbered, structuredClone(numbered)), true);
    assert.equal(sameBasketUi(numbered, {...numbered, filters: {questionNumber: '12'}}), false);
  });
  console.log(JSON.stringify({success: true, passed, scope: 'Production predicates and UI state on synthetic in-memory SQLite; no OCR, provider or Electron claims'}));
} finally {db.close();}
