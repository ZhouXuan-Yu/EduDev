import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const root = process.env.EDU_STRUCTURE_TEST_ROOT;
assert(root && path.isAbsolute(root));
const db = new DatabaseSync(path.join(root, 'data', 'app.db'), { readOnly: true });
try {
  const layout = db.prepare(`SELECT j.generation,p.body_json FROM material_structure_pages p
    JOIN material_structure_jobs j USING(generation)
    JOIN teacher_resources r ON r.id=j.resource_id WHERE r.original_file_name=?`);
  const questions = db.prepare('SELECT body_json FROM material_structure_questions WHERE generation=? ORDER BY rowid');
  function read(name) {
    const saved = layout.get(name);
    assert(saved, name);
    return { page: JSON.parse(saved.body_json), questions: questions.all(saved.generation).map(row => JSON.parse(row.body_json)) };
  }
  const book = read('物理主书-原件第4页.pdf');
  assert.equal(book.page.columns.length, 3);
  assert.equal(book.page.lines.length, 186);
  const owned = question => book.page.paragraphs.filter(part => question.paragraphIds.includes(part.id));
  const q7 = book.questions.find(q => q.number === '7');
  const q12 = book.questions.find(q => q.number === '12');
  assert.deepEqual(q7.options.map(option => option.label), ['A', 'B', 'C', 'D']);
  assert(owned(q7).every(p => p.column === 1));
  assert(owned(q12).length && owned(q12).every(p => p.column === 2));
  assert.equal(q12.options.length, 0);
  assert.equal(q12.assets.filter(asset => asset.kind === 'image' && asset.box[0] > book.page.columns[2][0]).length, 1);
  assert(owned(book.questions.find(q => q.number === '4')).every(p => p.role !== 'table'));

  const sat = read('SAT练习-原件第27页.pdf');
  assert.equal(sat.page.columns.length, 2);
  const body = sat.page.paragraphs.filter(p => p.column >= 0 && ['question','body','option'].includes(p.role));
  assert(body.some(p => p.column === 0) && body.some(p => p.column === 1));
  assert(body.every((p, i) => i === 0 || p.column >= body[i-1].column));
  assert(body.every(p => p.column === 0 ? p.anchor.box[2] < .53 : p.anchor.box[0] > .50));
  assert(sat.questions.length && sat.questions.every(q => q.status === 'needs_review'));
  const math = read('上海数学-原件第3页.pdf');
  assert.equal(math.page.columns.length, 1);
  console.log(JSON.stringify({success:true, sources:[3,2,1], bookQuestions:book.questions.length,
    bookHeld:book.questions.filter(q=>q.status==='needs_review').length, satHeld:sat.questions.length}));
} finally {
  db.close();
}
