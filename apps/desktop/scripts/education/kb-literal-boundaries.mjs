import assert from 'node:assert/strict';
import { deriveLiteralPageResponse, literalReadingPrompt, literalReadingEnabled, LITERAL_RESPONSE } from '../../src/shared/material-ai-literal.ts';
import { parseAiPageResponse, validAiPagePrompt } from '../../src/shared/material-ai-page.ts';
import { completeMaterialAi } from '../../src/main/assets/material-ai-provider.ts';

function wire(response) {
  return {
    schemaVersion: LITERAL_RESPONSE, pageText: response.pageText, pageIssues: response.pageIssues,
    questions: response.questions.map((question, index) => ({
      number: question.number,
      crops: response.readings[index].crops.map((crop, index) => ({ index, parts: crop.parts, assessment: crop.assessment, issues: crop.issues })),
      coverage: Object.fromEntries(['formulas', 'tables', 'choices', 'subquestions'].map(field => [field, question.projection[field].state])),
      figure: question.projection.figures, requiresImage: question.requiresImage, issues: question.issues,
      answer: { text: question.answer, origin: question.answerOrigin }, analysis: { text: question.analysis, origin: question.analysisOrigin },
    })),
  };
}

export async function runLiteralChecks({ check, sourceContentFixtures }) {
  const run = action => sourceContentFixtures.enabled(async () => {
    const fixture = await sourceContentFixtures.fixture();
    try { await fixture.run(); await action(fixture); } finally { await fixture.dispose(); }
  });
  await check('Minimal literal policy is frozen only for new source-content tasks; old prompts remain valid', () => run(f => {
    const previous = f.inputs[1].pagePrompt, prompt = literalReadingPrompt(previous, true);
    assert(validAiPagePrompt(previous)); assert(validAiPagePrompt(prompt)); assert(literalReadingEnabled(prompt));
    assert(!literalReadingEnabled(previous)); assert.equal(literalReadingPrompt(previous, false), previous);
    assert(!validAiPagePrompt({ ...prompt, literalReadingPolicy: 'future' }));
    assert(!validAiPagePrompt({ ...prompt, sourceContentPolicy: undefined }));
  }));
  await check('Host derives exact crop text, canonical body and coverage without model-authored duplicate body fields', () => run(f => {
    for (const index of [1, 2]) {
      const source = parseAiPageResponse(f.raw[index]), input = f.inputs[index], raw = JSON.stringify(wire(source));
      const derived = parseAiPageResponse(deriveLiteralPageResponse(raw, input.previous, input.cropReview, index === 1));
      assert.equal(derived.questions[0].stem, source.questions[0].stem);
      assert.deepEqual(derived.fragments, input.previous.fragments);
      assert.deepEqual(derived.readings, source.readings);
      assert.equal(derived.questions[0].projection.statement.text, derived.questions[0].stem);
      assert.equal(derived.questions[0].subject, input.previous.questions[0].subject);
      assert(!Object.hasOwn(JSON.parse(raw).questions[0], 'stem'));
      assert.equal(f.raw[index], JSON.stringify(JSON.parse(f.raw[index])));
    }
  }));
  await check('Literal wire refuses duplicate fields, reordered or missing crops and unbound question identities', () => run(f => {
    const source = parseAiPageResponse(f.raw[1]), input = f.inputs[1];
    for (const change of [
      value => { value.questions[0].stem = 'unbound'; },
      value => { value.questions[0].number = '999'; },
      value => { value.questions[0].crops[0].index = 1; },
      value => { value.questions[0].crops.pop(); },
      value => { value.questions[0].crops[0].text = 'redundant'; },
      value => { value.questions[0].coverage.extra = 'provided'; },
      value => { value.questions[0].crops[0].parts[0].role = 'hidden'; },
      value => { value.pageText = 'x'.repeat(128 * 1024); },
    ]) {
      const value = wire(source); change(value);
      assert.throws(() => deriveLiteralPageResponse(JSON.stringify(value), input.previous, input.cropReview, true), /invalid_response/);
    }
  }));
  await check('Source-only wire cannot fabricate generated answers or claim source text absent from the original transcript', () => run(f => {
    const source = parseAiPageResponse(f.raw[1]), input = f.inputs[1];
    for (const origin of ['ai_generated', 'source', 'teacher', 'book_extracted']) {
      const value = wire(source); value.questions[0].answer = { text: 'this answer is absent', origin };
      assert.throws(() => deriveLiteralPageResponse(JSON.stringify(value), input.previous, input.cropReview, true), /invalid_response/);
    }
    const foreign = wire(source); foreign.questions[0].answer = { text: '同页其他题答案', origin: 'source' }; foreign.pageText += '\n同页其他题答案';
    assert.throws(() => deriveLiteralPageResponse(JSON.stringify(foreign), input.previous, input.cropReview, true), /invalid_response/);
    const value = wire(source); value.questions[0].answer = { text: source.readings[0].crops[0].text, origin: 'source' };
    const derived = parseAiPageResponse(deriveLiteralPageResponse(JSON.stringify(value), input.previous, input.cropReview, true));
    assert.equal(derived.questions[0].answerOrigin, 'source');
  }));
  await check('Uncertain literal readings and missing structure stay held; binary provenance hashes come from the owned review', () => run(f => {
    const source = parseAiPageResponse(f.raw[1]), input = f.inputs[1], value = wire(source);
    value.questions[0].crops[0].assessment = 'uncertain'; value.questions[0].coverage.choices = 'missing';
    const derived = parseAiPageResponse(deriveLiteralPageResponse(JSON.stringify(value), input.previous, input.cropReview, true));
    assert.equal(derived.outcome, 'needs_review'); assert(derived.questions[0].issues.includes('uncertain_ocr'));
    assert(derived.questions[0].issues.includes('incomplete_question'));
    assert.equal(derived.readings[0].crops[0].sha256, input.cropReview.questions[0].crops[0].sha256);
  }));
  await check('Production provider saves exact minimal wire envelope before deterministic derivation and rejects legacy wire for frozen new tasks', () => run(async f => {
    const originalFetch = globalThis.fetch;
    try {
      for (const index of [1, 2]) {
        const input = f.inputs[index], source = parseAiPageResponse(f.raw[index]); let received, request;
        const envelope = JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(wire(source)) } }] });
        globalThis.fetch = async (_url, options) => { request = JSON.parse(options.body); return new Response(envelope); };
        const result = await completeMaterialAi({ ...input, pagePrompt: literalReadingPrompt(input.pagePrompt, true), onResponse: async bytes => { received = Buffer.from(bytes).toString(); } }, new AbortController().signal);
        assert.equal(received, envelope); assert.equal(parseAiPageResponse(result).questions[0].stem, source.questions[0].stem);
        assert(request.messages[0].content.includes(LITERAL_RESPONSE));
        assert(!request.messages[0].content.includes('根字段严格为schemaVersion/outcome/questions'));
      }
      const input = f.inputs[1]; let saved;
      globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: f.raw[1] } }] }));
      await assert.rejects(completeMaterialAi({ ...input, pagePrompt: literalReadingPrompt(input.pagePrompt, true), onResponse: async bytes => { saved = Buffer.from(bytes); } }, new AbortController().signal), /invalid_response/);
      assert(saved.length);
    } finally { globalThis.fetch = originalFetch; }
  }));
}
