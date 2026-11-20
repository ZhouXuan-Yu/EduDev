// Run: node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/structure-illustration-boundaries.mjs
import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {planStructureIllustrations, validStructureIllustrationProof, assertStructureIllustrationPlan,
  attachStructureIllustrations} from '../../src/main/assets/material-structure-illustrations.ts';
import {validQuestionDocument, independentQuestionImage} from '../../src/shared/question-document.ts';
import {instanceDigest, instanceDeliveryBlock} from '../../src/main/education/paper-instance.ts';
import {seedInstanceRole} from '../../src/renderer/components/paper-ui/paper-instance-content.ts';
import {MaterialStructureRepository} from '../../src/main/assets/material-structure-repository.ts';
import {validQuestionArchive} from '../../src/shared/question-archive.ts';
const sha = v => createHash('sha256').update(v).digest('hex'), box = [.568, .301, .812, .438];
const resourceId = 'resource_' + randomUUID(), version = sha('source');
function fixture() {
  const asset = {regionId: 'block-2', page: 3, kind: 'image', box: [...box], lineIds: ['figure-label']};
  const page = {page: 3, resourceId, version, regions: [{id: asset.regionId, kind: 'image', score: .98, box: [...box]}],
    lines: [{id: 'figure-label', box: [.60, .33, .63, .35]}], paragraphs: [{role: 'figure', lineIds: ['figure-label']}]};
  const image = {resourceId, version, sha256: sha('raster'), width: 2400, height: 3395};
  const parent = {page, image, sha256: sha('page')};
  const q = {assets: [asset], issues: []};
  const document = {schemaVersion: 'xiaozhi.question-document.v2',
    source: {resourceId, resourceVersion: version, parserVersion: 'layout-question.v1', ocrVersion: 'controlled'},
    blocks: [{id: 'source_question_1', kind: 'image', anchors: [{page: 3, box: [.1, .1, .9, .8]}],
      assetId: 'asset_' + randomUUID(), sha256: sha('body'), mime: 'image/png', width: 1200, height: 1600},
    {id: 'transcription', kind: 'text', anchors: [{page: 3, box: [.1, .1, .9, .8]}], text: '如图，回答问题。'}],
    answer: {origin: 'teacher', text: '答案', anchors: []}, analysis: {origin: 'teacher', text: '解析', anchors: []},
    context: {schemaVersion: 'xiaozhi.question-projection.v1', sourceBlockIds: ['source_question_1'],
      projection: Object.fromEntries(['statement', 'figures', 'formulas', 'tables', 'choices', 'subquestions'].map(k => [k,
        {state: ['statement', 'figures'].includes(k) ? 'provided' : 'not_applicable', text: k === 'statement' ? '如图，回答问题。' : k === 'figures' ? '实验示意图' : ''}]))}};
  return {q, document, parent, parents: new Map([[3, parent]])};
}
function proofFor(plan) {
  return plan.map(p => {const hash = sha('isolated:' + p.regionId), [x1,y1,x2,y2] = p.box;
    return {regionId: p.regionId, pageSha: p.parent.sha256, rasterSha: p.parent.image.sha256,
      block: {id: p.blockId, kind: 'image', mime: 'image/png', sha256: hash,
        assetId: 'asset_' + [hash.slice(0,8),hash.slice(8,12),hash.slice(12,16),hash.slice(16,20),hash.slice(20,32)].join('-'),
        width: Math.ceil(x2 * p.parent.image.width) - Math.floor(x1 * p.parent.image.width),
        height: Math.ceil(y2 * p.parent.image.height) - Math.floor(y1 * p.parent.image.height),
        anchors: [{page: p.parent.page.page, box: [...p.box]}]}};});
}
let passed = 0;
const check = (name, fn) => {fn(); passed++; console.log('PASS ' + name);};
check('Exact isolated reviewed asset yields a deterministic plan at realistic sample-sized bounds', () => {
  const f = fixture(), before = JSON.stringify([f.q, f.document, f.parent]), plan = planStructureIllustrations(f.q, f.document, f.parents);
  assert.equal(plan.length, 1); assert.equal(plan[0].regionId, 'block-2'); assert.equal(plan[0].blockId, 'structure_figure_1');
  assert.deepEqual(plan[0].box, box); assert.equal(plan[0].parent, f.parent);
  const proof = proofFor(plan); assert(validStructureIllustrationProof(proof)); assertStructureIllustrationPlan(plan, proof);
  assert.equal(proof[0].block.width, 586); assert.equal(proof[0].block.height, 467);
  assert.equal(JSON.stringify([f.q, f.document, f.parent]), before);
});
check('Overlap, adjacent caption, prose/answer ownership, weak, missing, choice and duplicate evidence refuse classification', () => {
  const patches = [
    f => f.parent.page.regions.push({id: 'block-3', kind: 'text', score: 1, box: [.60,.33,.64,.36]}),
    f => f.parent.page.regions.push({id: 'block-3', kind: 'figure_title', score: 1, box: [.60,.441,.70,.448]}),
    f => {f.parent.page.paragraphs[0].role = 'body';},
    f => {f.parent.page.paragraphs[0].role = 'answer';},
    f => {f.parent.page.lines[0].id = 'foreign-line';},
    f => {f.parent.page.lines[0].box = [.56,.33,.63,.35];},
    f => {f.parent.page.regions[0].score = .74;},
    f => {f.q.issues.push('missing_figure');},
    f => {f.q.assets[0].choiceLabel = 'A';},
    f => {f.q.assets.push(structuredClone(f.q.assets[0]));},
    f => {f.parent.page.regions.push(structuredClone(f.parent.page.regions[0]));},
    f => {f.parent.page.regions[0].box[0] += .001;},
    f => {f.parent.page.regions[0].kind = 'chart';},
    f => {f.document.blocks[0].anchors[0].box = [.1,.1,.3,.3];},
    f => {f.parent.image.width = 100;},
    f => {f.q.assets[0].box = [0,0,1,.5]; f.parent.page.regions[0].box = [0,0,1,.5];},
  ];
  for (const patch of patches) {const f = fixture(); patch(f); assert.equal(planStructureIllustrations(f.q, f.document, f.parents), undefined);}
  const absent = fixture(); absent.parents.clear(); assert.throws(() => planStructureIllustrations(absent.q, absent.document, absent.parents), /source_changed/);
});
check('Proof binds exact page, raster, crop, region, dimensions and content-addressed identity', () => {
  const f = fixture(), plan = planStructureIllustrations(f.q, f.document, f.parents), proof = proofFor(plan);
  const patches = [p => {p[0].pageSha = sha('other page');}, p => {p[0].rasterSha = sha('other raster');},
    p => {p[0].regionId = 'block-3';}, p => {p[0].block.id = 'source_question_2';},
    p => {p[0].block.anchors[0].page = 4;}, p => {p[0].block.anchors[0].box[0] += .001;},
    p => {p[0].block.width++;}, p => {p[0].block.height++;}, p => {p[0].block.assetId = 'asset_' + randomUUID();},
    p => {p[0].block.sha256 = sha('other crop');}, p => {p[0].extra = true;}, p => {p.push(structuredClone(p[0]));}];
  for (const patch of patches) {const changed = structuredClone(proof); patch(changed); assert.throws(() => assertStructureIllustrationPlan(plan, changed), /source_changed/);}
  assert.equal(validStructureIllustrationProof([]), false);
});
check('Attach uses a separate namespace, preserves original source roots and produces a valid v2 document', () => {
  const f = fixture(), plan = planStructureIllustrations(f.q, f.document, f.parents), proof = proofFor(plan), roots = structuredClone(f.document.context.sourceBlockIds);
  const oldBlocks = structuredClone(f.document.blocks); attachStructureIllustrations(f.document, proof);
  assert(validQuestionDocument(f.document)); assert.deepEqual(f.document.context.sourceBlockIds, roots);
  assert.deepEqual(f.document.blocks.slice(0, oldBlocks.length), oldBlocks);
  assert.deepEqual(f.document.context.illustrations.blockIds, ['structure_figure_1']);
  assert(independentQuestionImage(f.document, 'structure_figure_1')); assert.equal(independentQuestionImage(f.document, 'source_question_1'), undefined);
  assert.throws(() => planStructureIllustrations(f.q, f.document, f.parents), /source_changed/);
});
check('Edited instance requires the authenticated independent diagram and refuses body or stale references', () => {
  const f = fixture(), proof = proofFor(planStructureIllustrations(f.q, f.document, f.parents)); attachStructureIllustrations(f.document, proof);
  const q = {id: 'question_' + randomUUID(), stem: '如图，回答问题。', questionType: '解答题', document: f.document, archive: {structure: {}}};
  const binding = {questionId: q.id, sourceVersion: version};
  function instance(refs) {const content = {question: {mode: 'edited', blocks: [{type: 'text', text: '本卷修改条件'}, ...refs]}, answer: {mode: 'source'}, analysis: {mode: 'source'}};
    return {sourceBinding: binding, content, contentDigest: instanceDigest(binding, content)};}
  const ref = {type: 'sourceImage', role: 'question', blockId: 'structure_figure_1', sourceVersion: version};
  assert.equal(instanceDeliveryBlock(q, instance([])), 'image_dependency'); assert.equal(instanceDeliveryBlock(q, instance([ref])), undefined);
  for (const wrong of [{...ref, blockId: 'source_question_1'}, {...ref, sourceVersion: sha('old')}, {...ref, role: 'answer'}]) assert.equal(instanceDeliveryBlock(q, instance([wrong])), 'image_dependency');
});
check('Edit seeding preserves legacy illustration-after-options order and puts new structure diagrams before options', () => {
  const make = structure => {
    const f = fixture(), q = {id: 'question_' + randomUUID(), stem: '选择符合条件的选项。', questionType: '选择题',
      document: f.document, archive: {structure: {}}};
    const proof = proofFor(planStructureIllustrations(f.q, f.document, f.parents));
    f.document.blocks.push({id: 'graphic_choices', kind: 'choices', anchors: f.document.blocks[0].anchors,
      options: ['A', 'B'].map(label => ({label, blocks: [{...structuredClone(f.document.blocks[0]), id: 'choice_image_' + label}]}))});
    f.document.context.projection.statement.text = q.stem;
    f.document.context.projection.choices = {state: 'provided', text: 'A. 图一 B. 图二'};
    if (structure) attachStructureIllustrations(f.document, proof);
    else f.document.context.illustrations = {schemaVersion: 'xiaozhi.question-illustrations.v1', complete: true, blockIds: ['source_question_1']};
    assert(validQuestionDocument(f.document));
    const before = JSON.stringify(q), blocks = seedInstanceRole({question: q, contentVersion: version}, 'question');
    assert.equal(JSON.stringify(q), before, 'Seeding must preserve persisted original facts');
    const options = blocks.find(block => block.type === 'options');
    assert.deepEqual(options.items.map(item => item.label), ['A', 'B']);
    assert.deepEqual(options.items.map(item => item.sourceImages), ['A', 'B'].map(label => [{blockId: 'choice_image_' + label, sourceVersion: version}]));
    return blocks;
  };
  const old = make(false), current = make(true);
  assert.deepEqual(old.map(block => block.type), ['text', 'options', 'sourceImage']);
  assert.equal(old[2].blockId, 'source_question_1'); assert.equal(old[2].sourceVersion, version);
  assert.deepEqual(current.map(block => block.type), ['text', 'sourceImage', 'options']);
  assert.equal(current[1].blockId, 'structure_figure_1'); assert.equal(current[1].sourceVersion, version);
});
// The source-authentication boundary is controlled here; completion and the
// receipt parser/readback are the actual production implementations.
function completionFixture(wrapper) {
  const f = fixture(), reference = {schemaVersion: 'xiaozhi.document-structure.v1', resourceId, version,
    generation: randomUUID(), candidateId: 'sq_' + '1'.repeat(40), sha256: sha('candidate')};
  const q = {id: 'question_' + randomUUID(), subject: '物理', grade: '初二', knowledgePoint: '实验', questionType: '解答题', difficulty: 'easy',
    stem: '如图，回答问题。', answer: '答案', analysis: '解析', tags: [], createdAt: '2026-11-20T00:00:00.000Z', updatedAt: '2026-11-20T00:00:00.000Z',
    document: f.document, archive: {schemaVersion: wrapper.web ? 'xiaozhi.question-archive.v4' : 'xiaozhi.question-archive.v6',
      extractor: wrapper.web ? 'web-answer-enriched.v1' : 'book-answer-enriched.v1', state: 'teacher_edited', sourceChecked: true,
      number: '1', sources: [{schemaVersion: 'xiaozhi.material-source.v1', resourceId, version, chunkId: 'chunk_' + randomUUID(), offset: 0, bodyVersion: sha('body text')}],
      issues: [], sourceRisks: [], answerOrigin: 'teacher', analysisOrigin: 'teacher', structure: reference}};
  if (wrapper.web) {
    const proof = {candidateId: 'webanswer_' + randomUUID(), observationId: 'webobs_' + randomUUID(), kind: 'web_extracted',
      textSha: sha(q.answer), questionSha: sha(q.stem), url: 'https://example.org/answer', title: '受控补答', observedAt: q.createdAt};
    q.archive.web = {schemaVersion: 'xiaozhi.question-web-evidence.v1', base: 'numbered', roles: {answer: proof}};
    q.archive.answerOrigin = 'web_extracted'; q.document.answer = {origin: 'web_extracted', text: q.answer, anchors: [], web: proof};
  }
  if (wrapper.book) {
    const candidateId = 'bookanswer_' + randomUUID();
    q.archive.book = {schemaVersion: 'xiaozhi.question-book-evidence.v1', roles: {analysis: {
      candidateId, questionSha: sha(q.stem), textSha: sha(q.analysis), title: '受控答案册', page: 2, section: '第一章', number: '1'}}};
    q.archive.analysisOrigin = 'book_extracted'; q.document.analysis = {origin: 'book_extracted', text: q.analysis, anchors: [], book: {
      schemaVersion: 'xiaozhi.question-book-document-evidence.v1', candidateId,
      source: {schemaVersion: 'xiaozhi.material-page-source.v1', resourceId: 'resource_' + randomUUID(), version, page: 2, generation: randomUUID(), receiptSha: sha('receipt')},
      batchId: 'aibatch_' + randomUUID(), ordinal: 1, firstSha: version, finalSha: version, imageSha: version, section: '第一章', number: '1', quoteSha: sha(q.analysis)}};
  }
  q.document.schemaVersion = wrapper.web ? 'xiaozhi.question-document.web.v1' : 'xiaozhi.question-document.v3';
  assert(validQuestionArchive(q.archive)); assert(validQuestionDocument(q.document));
  const input = {schemaVersion: 'xiaozhi.question-context-edit.v1', questionId: q.id, version, requestId: 'xicontext_' + randomUUID(),
    projection: structuredClone(f.document.context.projection), complete: true};
  let receipt, crops = 0, validates = 0, reads = 0;
  const repository = new MaterialStructureRepository({
    cropIllustration: async () => {crops++; throw Error('Unexpected recrop of frozen supplement body');},
    run: async (sql, values) => {assert(sql.includes('INSERT INTO material_structure_context_edits'));
      const [question_id, request_id, context_sha, body_json, sha256] = values; receipt = {question_id, request_id, context_sha, body_json, sha256};},
    all: async (sql, values) => {reads++; assert(sql.includes('FROM material_structure_context_edits'));
      assert.deepEqual(values, [q.id, sha(JSON.stringify(q.document.context))]); return receipt ? [receipt] : [];},
  });
  repository.validate = async current => {validates++; assert.equal(current, q); return {question: {...f.q, stem: q.stem, options: [], subquestions: []}};};
  return {f, q, input, repository, counts: () => ({crops, validates, reads})};
}
async function checkAsync(name, fn) {await fn(); passed++; console.log('PASS ' + name);}
await checkAsync('Actual completion preserves legacy web/book-frozen context without planning or automatically cropping new diagrams', async () => {
  for (const wrapper of [{web: {}}, {book: {}}, {web: {}, book: {}}]) {
    const f = completionFixture(wrapper), before = JSON.stringify(f.q.document), context = structuredClone(f.q.document.context);
    const {next, illustrations} = await f.repository.completeContext(f.q, f.input, new AbortController().signal);
    assert.equal(illustrations, undefined); assert.deepEqual(next.document.context, context);
    assert.deepEqual(next.document.blocks, f.q.document.blocks); assert(validQuestionDocument(next.document));
    assert.equal(JSON.stringify(f.q.document), before); assert.deepEqual(f.counts(), {crops: 0, validates: 1, reads: 0});
  }
});
await checkAsync('Actual completion reuses receipt-authenticated derived proof frozen by later web/book supplementation without recropping', async () => {
  for (const wrapper of [{web: {}}, {book: {}}, {web: {}, book: {}}]) {
    const f = completionFixture(wrapper), proof = proofFor(planStructureIllustrations(f.f.q, f.q.document, f.f.parents));
    attachStructureIllustrations(f.q.document, proof);
    await f.repository.recordContext(f.input, f.q, version, proof);
    const before = JSON.stringify(f.q.document), {next, illustrations} = await f.repository.completeContext(f.q, f.input, new AbortController().signal);
    assert.deepEqual(illustrations, proof); assert.deepEqual(next.document, f.q.document); assert(validQuestionDocument(next.document));
    assert.equal(JSON.stringify(f.q.document), before); assert.deepEqual(f.counts(), {crops: 0, validates: 1, reads: 1});
  }
});
console.log(JSON.stringify({success: true, passed, scope: 'Pure in-memory structure-plan/proof/DTO/instance boundaries; controlled geometry, no raster generation, Electron, persistence, Office/PDF or provider acceptance.'}));
