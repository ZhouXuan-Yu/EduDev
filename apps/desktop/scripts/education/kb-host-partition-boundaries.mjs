import assert from 'node:assert/strict';
import { partitionLiteralCrop } from '../../src/shared/material-ai-host-partition.ts';
import { HOST_PARTITION_READING, HOST_PARTITION_RESPONSE, literalReadingPrompt, deriveLiteralPageResponse, independentLiteralContext } from '../../src/shared/material-ai-literal.ts';
import { sourceReviewDraft } from '../../src/shared/material-ai-answer-review.ts';
import { parseAiPageResponse, validAiPagePrompt } from '../../src/shared/material-ai-page.ts';
import { validSourceParts } from '../../src/shared/question-source-content.ts';
import { completeMaterialAi } from '../../src/main/assets/material-ai-provider.ts';
import { sourceCropKinds } from '../../src/shared/material-ai-owned-crops.ts';
import { archiveEligible } from '../../src/shared/question-archive.ts';

export function hostWire(response) {
  return {
    schemaVersion: HOST_PARTITION_RESPONSE, pageText: response.pageText, pageIssues: response.pageIssues,
    questions: response.questions.map((question, index) => ({
      number: question.number,
      crops: response.readings[index].crops.map((crop, index) => ({ index, text: crop.text,
        publication: crop.parts.some(part => part.role === 'publication'), issues: crop.issues })),
      coverage: Object.fromEntries(['formulas', 'tables', 'choices', 'subquestions'].map(field => [field, question.projection[field].state])),
      figure: question.projection.figures, requiresImage: question.requiresImage, issues: question.issues,
      answer: { text: question.answer, origin: question.answerOrigin }, analysis: { text: question.analysis, origin: question.analysisOrigin },
    })),
  };
}
function hostInput(input) {
  const pagePrompt = literalReadingPrompt(input.pagePrompt, true), cropReview = structuredClone(input.cropReview);
  cropReview.schemaVersion = 'xiaozhi.material-ai-crop-review.v3';
  for (const question of cropReview.questions) {
    const kinds = sourceCropKinds(pagePrompt.blocks, question.crops.map(crop => crop.blockIds), pagePrompt.continuation?.blocks);
    question.crops.forEach((crop, index) => { crop.kind = kinds[index]; });
  }
  return { ...input, pagePrompt, cropReview };
}

export async function runHostPartitionChecks({ check, sourceContentFixtures, MaterialAiRepository }) {
  const priorHostBody=process.env.OMNI_EDU_AI_HOST_BODY;process.env.OMNI_EDU_AI_HOST_BODY='0';
  try {
  const run = action => sourceContentFixtures.enabled(async () => {
    const fixture = await sourceContentFixtures.fixture();
    try { await fixture.run(); await action(fixture); } finally { await fixture.dispose(); }
  });
  await check('Host partition preserves every character of body, table, mixed and standalone figure crops', () => {
    for (const kind of ['body', 'table', 'mixed', 'figure']) for (const text of ['1. 质量2kg，速度x²。\n图1', '😀 μ₁=−2，不超过3℃。', '']) {
      const result = partitionLiteralCrop(text, kind, '1', true, false);
      assert(validSourceParts(result.parts, text));
      assert.equal(result.parts.map(part => part.text).join(''), text);
      if (kind !== 'figure') assert(!result.parts.some(part => part.role === 'figure'));
    }
  });
  await check('Only a matching parent and an explicit closed leading citation can leave the body', () => {
    const text = '第1题：「2026某省中考，★☆☆」 计算7+8。', result = partitionLiteralCrop(text, 'body', '1', true, true);
    assert.deepEqual(result.parts.map(part => part.role), ['marker', 'publication', 'body']); assert(!result.metadataIssue);
    for (const text of ['1.学习提示【2026某市中考】计算7+8。', '1.（质量2kg）求速度。', '1.「2026某省中考」', '1.2kg物体移动。', '1.「2026某省中考热量为五千焦耳」求比热容。']) {
      const result = partitionLiteralCrop(text, 'body', '1', true, true);
      assert(result.metadataIssue); assert(validSourceParts(result.parts, text));
      assert(!result.parts.some(part => part.role === 'publication'));
    }
    assert.equal(partitionLiteralCrop('1.2kg物体移动。', 'body', '1', true, false).parts[0].role, 'body');
    assert(partitionLiteralCrop('2.另一题正文', 'body', '1', true, false).metadataIssue);
    assert(partitionLiteralCrop('1.', 'body', '1', true, false).metadataIssue);
    assert(partitionLiteralCrop('图1', 'figure', '1', false, true).metadataIssue);
  });
  await check('Flat v3 derives the complete canonical body and preserves old frozen schema readers', () => run(f => {
    for (const index of [1, 2]) {
      const input = hostInput(f.inputs[index]), source = parseAiPageResponse(f.raw[index]);
      assert(validAiPagePrompt(input.pagePrompt)); assert.equal(input.pagePrompt.literalReadingPolicy, HOST_PARTITION_READING);
      const derived = parseAiPageResponse(deriveLiteralPageResponse(JSON.stringify(hostWire(source)), input.previous, input.cropReview, index === 1, HOST_PARTITION_READING));
      assert.equal(derived.questions[0].stem, source.questions[0].stem);
      assert.deepEqual(derived.readings, source.readings);
    }
    const input=hostInput(f.inputs[2]),original=structuredClone(input.previous);
    original.questions[0].answer='old generated solution';original.questions[0].answerOrigin='ai_generated';
    original.questions[1].answer='printed source role';original.questions[1].answerOrigin='source';
    const payload={phase:'final',firstDraft:sourceReviewDraft(original),pageContext:input.pagePrompt,cropReview:input.cropReview};
    const context=independentLiteralContext(payload,false);
    assert(!Object.hasOwn(context.firstDraft,'schemaVersion'));assert(!Object.hasOwn(context.firstDraft,'outcome'));
    assert.deepEqual(context.firstDraft.questions[0].answer,{text:'',origin:'missing'});
    assert.deepEqual(context.firstDraft.questions[1].answer,{text:'printed source role',origin:'source'});
    assert(context.firstDraft.questions.every(q=>!Object.hasOwn(q,'answerOrigin')&&!Object.hasOwn(q,'analysisOrigin')));
    assert.equal(independentLiteralContext({...payload,pageContext:{...input.pagePrompt,literalReadingPolicy:'host-independent-literal.v2'}},false).firstDraft,payload.firstDraft);
  }));
  await check('Bad publication, table or image declarations retain all literal text and hold only their question', () => run(f => {
    const input = hostInput(f.inputs[1]), source = parseAiPageResponse(f.raw[1]);
    const parse = (value, review = input.cropReview) => parseAiPageResponse(deriveLiteralPageResponse(JSON.stringify(value), input.previous, review, true, HOST_PARTITION_READING));
    const publication = hostWire(source); publication.questions[1].crops[0].publication = true;
    const held = parse(publication); assert(held.questions[1].issues.includes('incomplete_question')); assert.deepEqual(held.questions[0].issues, []);
    assert.equal(held.questions[1].stem, source.questions[1].stem);
    const image = hostWire(source); image.questions[0].requiresImage = false; image.questions[0].figure = { state: 'not_applicable', text: '' };
    const missing = parse(image); assert(missing.questions[0].requiresImage); assert.equal(missing.questions[0].projection.figures.state, 'missing');
    assert(missing.questions[0].issues.includes('incomplete_question')); assert.deepEqual(missing.questions[1].issues, []);
    const table = structuredClone(input.cropReview); table.questions[0].crops[0].kind = 'table';
    const changed = parse(hostWire(source), table); assert.equal(changed.questions[0].projection.tables.state, 'provided');
    assert(changed.questions[0].issues.includes('incomplete_question'));
  }));
  await check('Empty body reads remain genuinely empty and cannot fabricate a complete source document', () => run(f => {
    const input = hostInput(f.inputs[1]), source = parseAiPageResponse(f.raw[1]), value = hostWire(source);
    value.questions[1].crops[0].text = '';
    const derived = parseAiPageResponse(deriveLiteralPageResponse(JSON.stringify(value), input.previous, input.cropReview, true, HOST_PARTITION_READING));
    assert.equal(derived.readings[1].crops[0].text, ''); assert.deepEqual(derived.readings[1].crops[0].parts, []);
    assert(derived.questions[1].issues.includes('uncertain_ocr')); assert(derived.questions[1].issues.includes('incomplete_question'));
    assert.deepEqual(derived.questions[0].issues, []);
  }));
  await check('Flat v3 still rejects unknown fields, wrong crop identities, unsafe source answers and oversized text', () => run(f => {
    const input = hostInput(f.inputs[1]), source = parseAiPageResponse(f.raw[1]);
    for (const mutate of [
      value => { value.questions[0].crops[0].parts = []; }, value => { value.questions[0].crops[0].index = 9; },
      value => { value.questions[0].crops[0].publication = 'true'; }, value => { value.questions[0].crops[0].text = '\0'; },
      value => { value.questions[0].crops[0].text = 'x'.repeat(8193); },
      value => { value.questions[0].answer = { text: 'unseen answer', origin: 'source' }; },
    ]) {
      const value = hostWire(source); mutate(value);
      assert.throws(() => deriveLiteralPageResponse(JSON.stringify(value), input.previous, input.cropReview, true, HOST_PARTITION_READING), /invalid_response/);
    }
  }));
  await check('Actual executor publishes a complete sibling while one semantic declaration stays held across cold validation', () => sourceContentFixtures.enabled(async () => {
    const previousLiteral = process.env.OMNI_EDU_AI_LITERAL_READING, previousHost = process.env.OMNI_EDU_AI_HOST_PARTITIONS, originalFetch = globalThis.fetch;
    process.env.OMNI_EDU_AI_LITERAL_READING = '1'; process.env.OMNI_EDU_AI_HOST_PARTITIONS = '1';
    const f = await sourceContentFixtures.fixture(), original = f.repo.runtime.complete;
    try {
      f.repo.runtime.complete = async (input, signal) => {
        const response = JSON.parse(await original(input, signal)); if (!input.previous) return JSON.stringify(response);
        const wire = hostWire(response); if (input.verification) wire.questions[1].crops[0].publication = true;
        globalThis.fetch = async (_url, options) => {
          const request = JSON.parse(options.body), payload = JSON.parse(request.messages[1].content[0].text);
          assert(request.messages[0].content.includes(HOST_PARTITION_RESPONSE)); assert(!Object.hasOwn(payload, 'material'));
          if(input.verification){
            assert(!Object.hasOwn(payload.firstDraft,'schemaVersion'));
            for(const question of payload.firstDraft.questions){assert(!Object.hasOwn(question,'answerOrigin'));assert(!Object.hasOwn(question,'analysisOrigin'));assert.equal(question.answer.origin,'missing');assert.equal(question.analysis.origin,'missing');}
          }
          return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(wire) } }] }));
        };
        return completeMaterialAi(input, signal);
      };
      await f.run();
      const rows = f.db.prepare('SELECT q.*,m.number FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id ORDER BY m.number').all();
      assert.equal(rows.length, 2); assert.equal(JSON.parse(rows[0].archive_json).state, 'ai_final');
      assert(rows[0].document_json); assert(JSON.parse(rows[0].document_json).source.parserVersion.includes(HOST_PARTITION_READING));
      assert.equal(JSON.parse(rows[1].archive_json).state, 'ai_needs_review'); assert.equal(rows[1].document_json, '');
      assert.equal(f.db.prepare('SELECT status FROM material_ai_units').get().status, 'review'); assert.equal(f.state.calls, 3);
      const question = await f.question(); assert(archiveEligible(question));
      const before = f.db.prepare('SELECT * FROM material_ai_units').all(); await new MaterialAiRepository(f.host).validate(question);
      assert.deepEqual(f.db.prepare('SELECT * FROM material_ai_units').all(), before); assert.equal(f.state.calls, 3);
    } finally {
      globalThis.fetch = originalFetch;
      if (previousLiteral === undefined) delete process.env.OMNI_EDU_AI_LITERAL_READING; else process.env.OMNI_EDU_AI_LITERAL_READING = previousLiteral;
      if (previousHost === undefined) delete process.env.OMNI_EDU_AI_HOST_PARTITIONS; else process.env.OMNI_EDU_AI_HOST_PARTITIONS = previousHost;
      await f.dispose();
    }
  }));
  await check('Disabling new host partitions freezes v2 for new tasks while the earlier literal decoder stays available', () => sourceContentFixtures.enabled(async () => {
    const previousLiteral = process.env.OMNI_EDU_AI_LITERAL_READING, previousHost = process.env.OMNI_EDU_AI_HOST_PARTITIONS;
    process.env.OMNI_EDU_AI_LITERAL_READING = '1'; process.env.OMNI_EDU_AI_HOST_PARTITIONS = '0';
    const f = await sourceContentFixtures.fixture();
    try {
      await f.run();
      const row = f.db.prepare('SELECT input_json FROM material_ai_units').get();
      assert.equal(JSON.parse(row.input_json).pagePrompt.literalReadingPolicy, 'host-independent-literal.v2');
      assert(archiveEligible(await f.question())); assert.equal(f.state.calls, 3);
    } finally {
      if (previousLiteral === undefined) delete process.env.OMNI_EDU_AI_LITERAL_READING; else process.env.OMNI_EDU_AI_LITERAL_READING = previousLiteral;
      if (previousHost === undefined) delete process.env.OMNI_EDU_AI_HOST_PARTITIONS; else process.env.OMNI_EDU_AI_HOST_PARTITIONS = previousHost;
      await f.dispose();
    }
  }));
  } finally {if(priorHostBody===undefined)delete process.env.OMNI_EDU_AI_HOST_BODY;else process.env.OMNI_EDU_AI_HOST_BODY=priorHostBody;}
}
