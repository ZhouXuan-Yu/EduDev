import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const {
  deriveLiteralPageResponse,
  HOST_BODY_READING,
  HOST_BODY_RESPONSE,
  ISOLATED_BODY_READING,
  ISOLATED_BODY_RESPONSE,
  literalPageInstruction,
  isolateLiteralQuestions
} = await import('../../src/shared/material-ai-literal.ts');
const {
  parseAiPageResponse
} = await import('../../src/shared/material-ai-page.ts');
const {
  validSourceReadingStage
} = await import('../../src/shared/material-ai-source-reading.ts');
const sha = s => createHash('sha256').update(s).digest('hex'),
  stem = '计算七加八的结果并写出步骤。';
let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  console.log('PASS ' + name);
};
export function fixture() {
  const q = n => ({
      number: n,
      stem,
      answer: '15',
      analysis: '七加八等于十五。',
      subject: '数学',
      grade: '初二',
      knowledgePoint: '加法',
      questionType: '解答题',
      difficulty: 'easy',
      answerOrigin: 'ai_generated',
      analysisOrigin: 'ai_generated',
      requiresImage: false,
      issues: [],
      projection: Object.fromEntries(['statement', 'formulas', 'tables', 'figures', 'choices', 'subquestions'].map(k => [k, {
        state: k === 'statement' ? 'provided' : 'not_applicable',
        text: k === 'statement' ? stem : ''
      }]))
    }),
    previous = {
      schemaVersion: 'xiaozhi.material-ai-page-readings.v2',
      outcome: 'questions',
      questions: ['1', '2'].map(q),
      pageText: stem,
      pageIssues: [],
      fragments: ['1', '2'].map(n => ({
        number: n,
        complete: true,
        blockIds: ['block-' + n]
      })),
      readings: []
    },
    review = {
      questions: ['1', '2'].map(n => ({
        number: n,
        ocrStatus: 'available',
        crops: [{
          kind: 'body',
          sha256: sha(n),
          ocrSha256: sha(n + '. ' + stem),
          text: n + '. ' + stem,
          truncated: false
        }]
      }))
    },
    value = {
      schemaVersion: ISOLATED_BODY_RESPONSE,
      pageText: stem,
      pageIssues: [],
      questions: ['1', '2'].map(n => ({
        number: n,
        crops: [{
          index: 0,
          text: n + '. ' + stem,
          issues: []
        }],
        coverage: Object.fromEntries(['formulas', 'tables', 'choices', 'subquestions'].map(k => [k, 'not_applicable'])),
        figure: {
          state: 'not_applicable',
          text: ''
        },
        requiresImage: false,
        issues: [],
        answer: {
          text: '',
          origin: 'missing'
        },
        analysis: {
          text: '',
          origin: 'missing'
        }
      }))
    };
  return {
    previous,
    review,
    value
  };
}
const derive = (f, sourceOnly = true) => parseAiPageResponse(deriveLiteralPageResponse(JSON.stringify(f.value), f.previous, f.review, sourceOnly, ISOLATED_BODY_READING));
check('Valid rows retain exact canonical values while the instruction names only the frozen v5 wire', () => {
  const f = fixture(),
    before = JSON.stringify(f),
    v = derive(f);
  assert.deepEqual(v.questions.map(q => q.issues), [[], []]);
  assert(validSourceReadingStage(v, f.review, true));
  assert.equal(JSON.stringify(f), before);
  assert(literalPageInstruction(true, false, ISOLATED_BODY_READING).includes(ISOLATED_BODY_RESPONSE));
});
const mutations = [
  question => question.crops[0].index = 7,
  question => question.crops = [],
  question => question.crops[0].text = 123,
  question => question.crops[0].text = 'x'.repeat(8193),
  question => question.crops[0].publication = true,
  question => question.coverage.tables = 'fake',
  question => question.coverage = null,
  question => question.figure.state = 'fake',
  question => question.requiresImage = 'false',
  question => question.answer = { text: 'not in image', origin: 'source' },
  question => question.answer = { text: '15', origin: 'ai_generated' },
  question => question.analysis = { text: '', origin: 'source' },
  question => question.analysis = { text: 'oops', origin: 'unknown' },
  question => question.issues = ['verified'],
  question => question.confirmed = true,
];
for (const [index, mutate] of mutations.entries()) check('Isolate local model contract error ' + (index + 1) + ' without claiming a new source or answer', () => {
  const f = fixture(),
    good = derive(f);
  mutate(f.value.questions[1]);
  const before = JSON.stringify(f),
    v = derive(f);
  assert.deepEqual(v.questions[0], good.questions[0]);
  assert.deepEqual(v.readings[0], good.readings[0]);
  const bad = v.questions[1];
  assert.equal(bad.stem, f.previous.questions[1].stem);
  assert.equal(bad.answerOrigin, 'missing');
  assert.equal(bad.analysisOrigin, 'missing');
  assert(bad.issues.includes('incomplete_question'));
  assert(bad.issues.includes('uncertain_ocr'));
  assert(v.readings[1].crops.every(c => c.text === '' && c.assessment === 'uncertain' && c.parts.length === 0));
  assert(validSourceReadingStage(v, f.review, true));
  assert.equal(JSON.stringify(f), before);
});
check('Legacy v4 still rejects the same malformed sibling instead of silently changing saved policy', () => {
  const f = fixture();
  f.value.schemaVersion = HOST_BODY_RESPONSE;
  f.value.questions[1].crops[0].index = 7;
  assert.throws(() => deriveLiteralPageResponse(JSON.stringify(f.value), f.previous, f.review, true, HOST_BODY_READING), /invalid_response/);
});
const identityFailures = [
  input => input.value.questions.reverse(),
  input => input.value.questions[1].number = '1',
  input => input.value.questions[1].number = '3',
  input => input.value.questions.pop(),
  input => input.value.questions[1] = null,
  input => input.review.questions[1].crops[0].sha256 = 'x',
  input => delete input.review.questions[1].crops[0].ocrSha256,
  input => delete input.review.questions[1].crops[0].kind,
  input => input.review.questions[1].crops[0].text = 7,
  input => input.review.questions[1].crops[0].truncated = 'false',
  input => input.value.extra = true,
  input => input.value.pageText = 'x'.repeat(128 * 1024),
];
for (const [index, mutate] of identityFailures.entries()) check('Page or host identity failure ' + (index + 1) + ' cannot be relabeled as a local model error', () => {
  const f = fixture();
  mutate(f);
  assert.throws(() => derive(f), /invalid_response/);
});
check('All five historical doubts remain preserved and invalid historical issues are rejected', () => {
  const f = fixture();
  f.previous.questions[1].issues = ['answer_conflict'];
  f.value.questions[1].crops[0].index = 7;
  assert(derive(f).questions[1].issues.includes('answer_conflict'));
  f.previous.questions[1].issues = ['answer_conflict', 'requires_image', 'cross_page', 'uncertain_ocr', 'incomplete_question'];
  assert.deepEqual(derive(f).questions[1].issues, f.previous.questions[1].issues);
  f.previous.questions[1].issues = ['missing_answer'];
  assert.throws(() => derive(f), /invalid_response/);

  for (const kind of ['figure', 'mixed']) {
    const visual = fixture();
    visual.review.questions[1].crops[0].kind = kind;
    visual.value.questions[1].crops[0].index = 7;
    const held = derive(visual).questions[1];
    assert.equal(held.requiresImage, true);
    assert.deepEqual(held.projection.figures, { state: 'missing', text: '' });
    assert.equal(held.stem, visual.previous.questions[1].stem);
  }
});
check('A final-stage malformed role is isolated too while a valid final solution stays unchanged', () => {
  const f = fixture();
  for (const q of f.value.questions) {
    q.answer = {
      text: '15',
      origin: 'ai_generated'
    };
    q.analysis = {
      text: '七加八等于十五。',
      origin: 'ai_generated'
    };
  }
  const good = derive(f, false);
  f.value.questions[1].analysis.origin = 'teacher';
  const bad = derive(f, false);
  assert.deepEqual(bad.questions[0], good.questions[0]);
  assert.equal(bad.questions[1].answerOrigin, 'missing');
  assert(validSourceReadingStage(bad, f.review, false));
});
check('New task defaults and stop switch do not silently opt legacy or standard tasks into v5', () => {
  assert(isolateLiteralQuestions('quality', undefined));
  assert(!isolateLiteralQuestions('quality', '0'));
  assert(!isolateLiteralQuestions('legacy', undefined));
  assert(isolateLiteralQuestions('legacy', '1'));
  assert(!isolateLiteralQuestions('standard', '1'));
});
console.log(JSON.stringify({
  success: true,
  checks,
  scope: 'Pure frozen-wire and existing canonical schema boundaries; no natural quality or full importer acceptance.'
}));
