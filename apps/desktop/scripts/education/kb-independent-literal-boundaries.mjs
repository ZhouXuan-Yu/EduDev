import assert from 'node:assert/strict';
import { literalWire } from './kb-literal-boundaries.mjs';
import { INDEPENDENT_LITERAL_READING, INDEPENDENT_LITERAL_RESPONSE, LITERAL_READING,
  deriveLiteralPageResponse, independentLiteralContext, literalReadingPrompt } from '../../src/shared/material-ai-literal.ts';
import { parseAiPageResponse, validAiPagePrompt } from '../../src/shared/material-ai-page.ts';
import { sourceCropKinds } from '../../src/shared/material-ai-owned-crops.ts';
import { validCropReview } from '../../src/main/assets/material-ai-crop-review.ts';
import { completeMaterialAi } from '../../src/main/assets/material-ai-provider.ts';

function independentInput(input) {
  const pagePrompt = literalReadingPrompt(input.pagePrompt, true);
  const cropReview = structuredClone(input.cropReview);
  cropReview.schemaVersion = 'xiaozhi.material-ai-crop-review.v3';
  for (const question of cropReview.questions) {
    const kinds = sourceCropKinds(pagePrompt.blocks, question.crops.map(crop => crop.blockIds), pagePrompt.continuation?.blocks);
    question.crops.forEach((crop, index) => { crop.kind = kinds[index]; });
  }
  return { ...input, pagePrompt, cropReview };
}
function independentWire(response) {
  const value = literalWire(response); value.schemaVersion = INDEPENDENT_LITERAL_RESPONSE;
  for (const question of value.questions) for (const crop of question.crops) delete crop.assessment;
  return value;
}

export async function runIndependentLiteralChecks({ check, sourceContentFixtures }) {
  const run = action => sourceContentFixtures.enabled(async () => {
    const fixture = await sourceContentFixtures.fixture();
    try { await fixture.run(); await action(fixture); } finally { await fixture.dispose(); }
  });
  await check('Independent literal v2 freezes a distinct policy while retained v1 prompts and review shapes remain valid', () => run(f => {
    const input = independentInput(f.inputs[1]); assert(validAiPagePrompt(input.pagePrompt));
    assert.equal(input.pagePrompt.literalReadingPolicy, INDEPENDENT_LITERAL_READING);
    assert(validCropReview(input.cropReview, input.previous, input.pagePrompt, input.cropReview.pageImageSha256));
    assert(!validCropReview(f.inputs[1].cropReview, input.previous, input.pagePrompt, input.cropReview.pageImageSha256));
    assert(validAiPagePrompt(literalReadingPrompt(input.pagePrompt, true, LITERAL_READING)));
    const changed = structuredClone(input.cropReview); changed.questions[0].crops[0].kind = 'figure';
    assert(!validCropReview(changed, input.previous, input.pagePrompt, input.cropReview.pageImageSha256));
  }));
  await check('Frozen crop hints distinguish tables, standalone figures, mixed body and continuation captions', () => {
    const page = { blocks: [{ id: 'body', kind: 'text' }, { id: 'table', kind: 'table' },
      { id: 'figure', kind: 'chart' }, { id: 'caption', kind: 'figure_title' }] };
    assert.deepEqual(sourceCropKinds(page, [['body'], ['table'], ['figure'], ['caption']]), ['body', 'table', 'figure', 'figure']);
    assert.deepEqual(sourceCropKinds(page, [['body', 'figure']]), ['mixed']);
    assert.deepEqual(sourceCropKinds(page, [['body'], ['next-table'], ['next-figure'], ['next-caption']], page), ['body', 'table', 'figure', 'figure']);
    assert.throws(() => sourceCropKinds(page, [['next-table']]), /source_changed/);
  });
  await check('Vision-only context removes original OCR and derived negative comparisons without mutating host evidence', () => run(f => {
    const input = independentInput(f.inputs[1]);
    const payload = { material: 'HIDDEN_ORIGINAL_OCR', localReview: { text: 'HIDDEN_REVIEW' },
      phase: 'source', firstDraft: { questions: [{ number: '1', stem: 'HIDDEN_FIRST_BODY', subject: 'HIDDEN_CLASSIFIER' }], fragments: [] },
      pageContext: { ...input.pagePrompt, continuation: { text: 'HIDDEN_NEXT_OCR', number: '1', page: 2 } }, cropReview: input.cropReview };
    const before = JSON.stringify(payload), visible = independentLiteralContext(payload, true), text = JSON.stringify(visible);
    assert(!text.includes('HIDDEN_')); assert(!Object.hasOwn(visible, 'material')); assert(!Object.hasOwn(visible.pageContext, 'blockTexts'));
    assert(!Object.hasOwn(visible.cropReview.questions[0], 'sourceFound')); assert(!Object.hasOwn(visible.cropReview.questions[0].crops[0], 'text'));
    assert.deepEqual(visible.firstDraft.questions, [{ number: '1' }]); assert.equal(JSON.stringify(payload), before);
  }));
  await check('Host computes OCR agreement for independent readings and keeps truncation or declared uncertainty held', () => run(f => {
    const input = independentInput(f.inputs[1]), source = parseAiPageResponse(f.raw[1]), value = independentWire(source);
    const parse = (value, review = input.cropReview) => parseAiPageResponse(deriveLiteralPageResponse(JSON.stringify(value), input.previous, review, true, INDEPENDENT_LITERAL_READING));
    const exact = parse(value); assert.equal(exact.readings[0].crops[0].assessment, 'exact');
    const other = structuredClone(input.cropReview); other.questions[0].crops[0].text = 'Original OCR missed this readable line';
    assert.equal(parse(value, other).readings[0].crops[0].assessment, 'corrected');
    other.questions[0].crops[0].truncated = true;
    const truncated = parse(value, other); assert.equal(truncated.readings[0].crops[0].assessment, 'uncertain');
    assert(truncated.questions[0].issues.includes('uncertain_ocr'));
    const unclear = independentWire(source); unclear.questions[0].crops[0].issues = ['uncertain_ocr'];
    assert.equal(parse(unclear).outcome, 'needs_review');
    value.questions[0].crops[0].assessment = 'exact';
    assert.throws(() => parse(value), /invalid_response/);
  }));
  await check('A table cannot move out of the body and mixed or empty diagrams cannot lose their image requirement', () => run(f => {
    const input = independentInput(f.inputs[1]), source = parseAiPageResponse(f.raw[1]);
    const parse = (value, review) => deriveLiteralPageResponse(JSON.stringify(value), input.previous, review, true, INDEPENDENT_LITERAL_READING);
    const table = structuredClone(input.cropReview); table.questions[0].crops[0].kind = 'table';
    const missing = independentWire(source); assert.throws(() => parse(missing, table), /invalid_response/);
    const present = independentWire(source); present.questions[0].coverage.tables = 'provided'; assert(parse(present, table));
    present.questions[0].crops[0].parts.forEach(part => { part.role = 'figure'; });
    assert.throws(() => parse(present, table), /invalid_response/);
    const mixed = independentWire(source); mixed.questions[0].requiresImage = false; mixed.questions[0].figure = { state: 'not_applicable', text: '' };
    const review = structuredClone(input.cropReview); review.questions[0].crops[0].kind = 'mixed';
    assert.throws(() => parse(mixed, review), /invalid_response/);
  }));
  await check('Production source and final requests hide OCR while retaining authenticated images, raw receipts and canonical output', () => run(async f => {
    const originalFetch = globalThis.fetch;
    try {
      for (const index of [1, 2]) {
        const input = independentInput(f.inputs[index]), source = parseAiPageResponse(f.raw[index]);
        let sent, received;
        const raw = JSON.stringify(independentWire(source)), envelope = JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: raw } }] });
        globalThis.fetch = async (_url, options) => { sent = JSON.parse(options.body); return new Response(envelope); };
        const result = await completeMaterialAi({ ...input, onResponse: async bytes => { received = Buffer.from(bytes).toString(); } }, new AbortController().signal);
        const visible = JSON.parse(sent.messages[1].content[0].text);
        assert(!Object.hasOwn(visible, 'material')); assert(!Object.hasOwn(visible.pageContext, 'blockTexts')); assert(!Object.hasOwn(visible, 'localReview'));
        assert(!Object.hasOwn(visible.cropReview.questions[0], 'sourceStemMatches'));
        assert(!Object.hasOwn(visible.cropReview.questions[0].crops[0], 'text'));
        if (index === 1) assert.deepEqual(Object.keys(visible.firstDraft.questions[0]), ['number']);
        assert.equal(sent.messages[1].content.filter(item => item.type === 'image_url').length, input.images.length + 1);
        assert.equal(received, envelope); assert.equal(parseAiPageResponse(result).questions[0].stem, source.questions[0].stem);
      }
    } finally { globalThis.fetch = originalFetch; }
  }));
}
