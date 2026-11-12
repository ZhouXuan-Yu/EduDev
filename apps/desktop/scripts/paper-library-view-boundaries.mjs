import './office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {PAPER_LIBRARY_VIEW_KEY, emptyPaperLibraryView, readPaperLibraryView,
  savePaperLibraryView, validPaperLibraryView} = await import('../src/renderer/components/paper-ui/paper-library-view.ts');

const output = fs.mkdtempSync(path.resolve('test-results/paper-library-view-'));
const checks = [];
let value = null;
let writes = 0;
const storage = {getItem: key => {assert.equal(key, PAPER_LIBRARY_VIEW_KEY); return value;},
  setItem: (key, text) => {assert.equal(key, PAPER_LIBRARY_VIEW_KEY); writes++; value = text;}};
const check = (name, action) => {action(); checks.push(name);};
const invalid = patch => {
  const candidate = {...emptyPaperLibraryView(), ...patch};
  assert.equal(validPaperLibraryView(candidate), false);
  value = JSON.stringify(candidate);
  assert.equal(readPaperLibraryView(storage).failed, true);
  const before = writes;
  assert.equal(savePaperLibraryView(candidate, storage), false);
  assert.equal(writes, before);
};
const report = {success: false, checks, scope: 'Pure optional UI preference validation. No database, model or network calls.'};
try {
  check('Missing preferences use an independent valid empty view', () => {
    const first = readPaperLibraryView(storage);
    assert.equal(first.failed, false);
    assert(validPaperLibraryView(first.view));
    first.view.ui.filters.query = 'first';
    assert.deepEqual(readPaperLibraryView(storage).view, emptyPaperLibraryView());
  });
  check('All supported metadata filters, facet, page and scroll round-trip', () => {
    const view = emptyPaperLibraryView();
    view.facet = 'categories'; view.ui.offset = 24; view.ui.scrollTop = 317;
    view.ui.filters = {query: '加法', questionNumber: '1', knowledgePoint: '运算',
      questionType: '判断题', categoryId: 'teacher-category', difficulty: 'medium', sourceKind: 'teacher_resource'};
    assert(savePaperLibraryView(view, storage));
    assert.deepEqual(readPaperLibraryView(storage), {view, failed: false});
  });
  check('Unsupported root and UI keys cannot become authority', () => {
    invalid({permissions: 'all'});
    invalid({ui: {...emptyPaperLibraryView().ui, basket: {id: 'fake'}}});
  });
  check('Hidden source candidates and arbitrary filter fields are rejected', () => {
    invalid({ui: {...emptyPaperLibraryView().ui, filters: {showSourceCandidates: true}}});
    invalid({ui: {...emptyPaperLibraryView().ui, filters: {studentId: 'other-student'}}});
  });
  check('Version and facet remain explicit', () => {
    invalid({schemaVersion: 'future'}); invalid({facet: 'unknown'});
  });
  check('A pre-basket preference cannot restore edit or preview authority', () => {
    invalid({ui: {...emptyPaperLibraryView().ui, stage: 'preview'}});
    invalid({ui: {...emptyPaperLibraryView().ui, stage: 'organize'}});
  });
  check('Page positions are bounded integers aligned to the real page size', () => {
    for (const offset of [-1, 1, 1.5, 1000001]) invalid({ui: {...emptyPaperLibraryView().ui, offset}});
  });
  check('Scroll positions remain bounded and nonnegative', () => {
    for (const scrollTop of [-1, .5, 10000001]) invalid({ui: {...emptyPaperLibraryView().ui, scrollTop}});
  });
  check('Text uses the existing server-compatible bounds and controls policy', () => {
    for (const query of ['a'.repeat(241), 'bad\u0001value']) invalid({ui: {...emptyPaperLibraryView().ui, filters: {query}}});
  });
  check('Source and difficulty cannot escape supported enum values', () => {
    invalid({ui: {...emptyPaperLibraryView().ui, filters: {sourceKind: 'private-student'}}});
    invalid({ui: {...emptyPaperLibraryView().ui, filters: {difficulty: 'arbitrary'}}});
  });
  check('Malformed and oversized cache values recover without writes', () => {
    for (const text of ['{invalid', 'x'.repeat(8193)]) {
      value = text; const before = writes;
      assert(readPaperLibraryView(storage).failed); assert.equal(writes, before);
    }
  });
  check('Unavailable storage reads preserve an editable default', () => {
    assert.deepEqual(readPaperLibraryView({getItem: () => {throw Error('unavailable');}}),
      {view: emptyPaperLibraryView(), failed: true});
  });
  check('Write failures never report saved preferences', () => {
    assert.equal(savePaperLibraryView(emptyPaperLibraryView(), {setItem: () => {throw Error('full');}}), false);
  });
  check('A mismatched write readback never reports success', () => {
    assert.equal(savePaperLibraryView(emptyPaperLibraryView(), {setItem: () => {}, getItem: () => 'different'}), false);
  });
  check('Valid serialization contains only the existing UI state contract', () => {
    assert(savePaperLibraryView(emptyPaperLibraryView(), storage));
    const saved = JSON.parse(value);
    assert.deepEqual(Object.keys(saved).sort(), ['facet', 'schemaVersion', 'ui']);
    assert.deepEqual(Object.keys(saved.ui).sort(), ['filters', 'offset', 'scrollTop', 'stage']);
  });
  report.success = true;
} catch (error) {
  report.error = String(error.stack ?? error); process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: checks.length, output, error: report.error}));
}
