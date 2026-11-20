// Run: node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/paper-instance-graphic-export-boundaries.mjs
import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {seedInstanceRole} from '../../src/renderer/components/paper-ui/paper-instance-content.ts';
import {compilePaperOffice, assertPaperOffice} from '../../src/main/education/paper-export.ts';
import {instanceDigest, instanceDeliveryBlock} from '../../src/main/education/paper-instance.ts';
import {resolvePaperOfficeImages} from '../../src/main/education/paper-office-images.ts';
import {validQuestionDocument} from '../../src/shared/question-document.ts';
import {validPaperInstanceContent} from '../../src/shared/paper-instance.ts';
import {nativeTestPng} from './native-test-png.mjs';
const sha = v => createHash('sha256').update(v).digest('hex'), version = sha('frozen structure');
const anchors = [{page: 1, box: [.1, .1, .9, .9]}], bytes = new Map();
function image(id, color) {
  const png = nativeTestPng(color), assetId = 'asset_' + randomUUID(); bytes.set(assetId, png);
  return {id, kind: 'image', anchors, assetId, sha256: sha(png), mime: 'image/png', width: 1240, height: 64};
}
const body = image('source_question_0', 20);
// Heterogeneous pixels and a two-part B detect omissions, swaps and duplication.
const options = ['A', 'B', 'C', 'D'].map((label, n) => ({label, blocks: [image('choice_image_' + label, 50 + n * 35),
  ...(label === 'B' ? [image('choice_image_B_detail', 210)] : [])]}));
const expected = options.flatMap(o => o.blocks), answer = 'PRIVATE_ANSWER_B', analysis = 'PRIVATE_ANALYSIS';
const question = {id: 'question_' + randomUUID(), stem: '选择符合条件的选项。', answer, analysis,
  subject: '物理', grade: '初二', questionType: '选择题', sourceTitle: '受控结构图', archive: {structure: {}},
  document: {schemaVersion: 'xiaozhi.question-document.v2',
    source: {resourceId: 'resource_' + randomUUID(), resourceVersion: version, parserVersion: 'layout-question.v1', ocrVersion: 'controlled'},
    blocks: [body, {id: 'graphic_choices', kind: 'choices', anchors, options}, {id: 'transcription', kind: 'text', anchors, text: '选择符合条件的选项。'}],
    answer: {origin: 'teacher', text: answer, anchors: []}, analysis: {origin: 'teacher', text: analysis, anchors: []},
    context: {schemaVersion: 'xiaozhi.question-projection.v1', sourceBlockIds: [body.id],
      projection: Object.fromEntries(['statement', 'figures', 'formulas', 'tables', 'choices', 'subquestions'].map(k => [k,
        {state: ['statement', 'choices'].includes(k) ? 'provided' : 'not_applicable',
          text: k === 'statement' ? '选择符合条件的选项。' : k === 'choices' ? 'A. 图一 B. 图二 C. 图三 D. 图四' : ''}]))}}};
const binding = {questionId: question.id, sourceVersion: version};
const source = () => ({question: {mode: 'source'}, answer: {mode: 'source'}, analysis: {mode: 'source'}});
const content = blocks => ({...source(), question: {mode: 'edited', blocks}});
function instance(content) {
  const contentDigest = instanceDigest(binding, content);
  return {schemaVersion: 'xiaozhi.paper-instance.v1', entryId: 'xientry_' + randomUUID(), instanceRevision: 1,
    sourceBinding: binding, content, contentDigest,
    review: {action: 'confirm', instanceRevision: 1, sourceBinding: binding, contentDigest}};
}
const paper = (i, q = question) => ({id: 'xipaper_' + randomUUID(), title: '图形选项实例', digest: sha('paper'),
  state: 'confirmed', complete: true, sourceCurrent: true, totalPoints: 10,
  blueprint: {subject: '物理', grade: '初二', durationMinutes: 30, sections: [{id: 's', label: '选择题'}]},
  selection: {items: [{question: q, instance: i, source: {questionId: q.id, version}, number: 1, points: 10, sectionId: 's'}]}});
const figures = draft => draft.sections.flatMap(s => s.figures || []);
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log('PASS ' + name); }
const before = JSON.stringify(question); assert(validQuestionDocument(question.document));
await check('Old flattened refs reproduce image_dependency; source-only exports remain unchanged', () => {
  const broken = content([{type: 'text', text: question.stem}, {type: 'options', items: options.map(o => ({label: o.label, text: '原图'}))},
    ...expected.map(b => ({type: 'sourceImage', role: 'question', blockId: b.id, sourceVersion: version}))]);
  assert(validPaperInstanceContent(broken)); assert.equal(instanceDeliveryBlock(question, instance(broken)), 'image_dependency');
  for (const audience of ['student', 'teacher']) assert.deepEqual(figures(compilePaperOffice(paper(instance(source())), audience)).map(f => f.blockId), [body.id, ...expected.map(b => b.id)]);
});
const seeded = seedInstanceRole({question, contentVersion: version}, 'question'), edited = content(seeded), editedInstance = instance(edited);
const optionItems = c => c.question.blocks.filter(b => b.type === 'options').flatMap(b => b.items);
await check('Renderer seed binds every original crop to its original label and version', () => {
  assert(validPaperInstanceContent(edited)); assert.equal(instanceDeliveryBlock(question, editedInstance), undefined);
  assert.deepEqual(optionItems(edited).map(i => ({label: i.label, sourceImages: i.sourceImages})), options.map(o =>
    ({label: o.label, sourceImages: o.blocks.map(b => ({blockId: b.id, sourceVersion: version}))})));
  assert(!seeded.some(b => b.type === 'sourceImage' && expected.some(image => image.id === b.blockId)));
});
for (const audience of ['student', 'teacher']) await check(audience + ' edited export orders images after labels, isolates answers and authenticates all crop bytes', async () => {
  const p = paper(editedInstance), draft = compilePaperOffice(p, audience); assertPaperOffice(p, draft);
  assert.deepEqual(figures(draft).map(f => f.blockId), expected.map(b => b.id));
  const ordered = draft.sections.flatMap(s => Array.from({length: s.paragraphs.length + 1}, (_, n) =>
    [...(n ? [s.paragraphs[n - 1]] : []), ...(s.figures || []).filter(f => f.afterParagraph === n).map(f => f.blockId)]).flat());
  let cursor = -1;
  for (const o of options) {
    const at = ordered.findIndex((v, n) => n > cursor && v.startsWith(o.label + '.')); assert(at > cursor, 'Missing label ' + o.label);
    assert.deepEqual(ordered.slice(at + 1, at + 1 + o.blocks.length), o.blocks.map(b => b.id)); cursor = at + o.blocks.length;
  }
  assert.equal(JSON.stringify(draft).includes(answer), audience === 'teacher'); assert.equal(JSON.stringify(draft).includes(analysis), audience === 'teacher');
  const resolved = await resolvePaperOfficeImages(draft, {officeImages: async (id, v) => {
    assert.equal(id, question.id); assert.equal(v, version);
    return expected.map(b => ({blockId: b.id, role: 'question', ...b, bytes: bytes.get(b.assetId)}));
  }});
  assert.equal(resolved.size, expected.length); for (const b of expected) assert.equal(sha(resolved.get(b.assetId)), b.sha256);
  const missing = structuredClone(draft); for (const s of missing.sections) if (s.figures) s.figures = s.figures.filter(f => f.blockId !== expected[0].id);
  assert.throws(() => assertPaperOffice(p, missing), /conflict/);
});
await check('Missing, wrong-label, swapped, reordered, stale, foreign, duplicate, body and answer crops fail closed', () => {
  const mutations = [items => { items[0].sourceImages = []; }, items => { items[0].label = 'E'; },
    items => { [items[0].sourceImages, items[2].sourceImages] = [items[2].sourceImages, items[0].sourceImages]; },
    items => { items[1].sourceImages.reverse(); }, items => { items[0].sourceImages[0].sourceVersion = sha('stale'); },
    items => { items[0].sourceImages[0].blockId = 'choice_image_foreign'; }, items => { items[0].sourceImages.push({...items[0].sourceImages[0]}); },
    items => { items[0].sourceImages[0].blockId = body.id; }, items => { items[0].sourceImages[0].blockId = 'source_answer_0'; }];
  for (const mutate of mutations) {
    const bad = structuredClone(edited); mutate(optionItems(bad)); assert(instanceDeliveryBlock(question, instance(bad)));
    assert.throws(() => compilePaperOffice(paper(instance(bad)), 'student'), /conflict/);
  }
  for (const role of ['answer', 'analysis']) {
    const bad = source(); bad[role] = {mode: 'edited', blocks: [structuredClone(seeded.find(b => b.type === 'options'))]};
    assert(instanceDeliveryBlock(question, instance(bad)), role + ' cannot borrow question images');
  }
  const reordered = structuredClone(edited), block = reordered.question.blocks.find(b => b.type === 'options');
  [block.items[0], block.items[1]] = [block.items[1], block.items[0]];
  assert(instanceDeliveryBlock(question, instance(reordered)), 'Original option order must remain bound');
  const foreign = instance(structuredClone(edited)); foreign.sourceBinding = {...binding, questionId: 'question_' + randomUUID()};
  assert(instanceDeliveryBlock(question, foreign), 'Another question must not reuse these crop bindings');
});
await check('Unclassified separately required figures still block edited delivery', () => {
  const q = structuredClone(question); q.document.context.projection.figures = {state: 'provided', text: '另有必须保留的题图'};
  assert(validQuestionDocument(q.document)); assert.equal(instanceDeliveryBlock(q, editedInstance), 'image_dependency');
});
assert.equal(JSON.stringify(question), before);
console.log(JSON.stringify({success: true, checks, scope: 'Controlled renderer-seed, source-contract and authenticated-resolver regression; no Electron, rendered Office/PDF or provider acceptance.'}));

export const preparedGraphicPaper = audience => compilePaperOffice(paper(editedInstance),audience);
export const resolvedGraphicImages = draft => resolvePaperOfficeImages(draft,{officeImages:async(id,v)=>{
  assert.equal(id,question.id);assert.equal(v,version);
  return expected.map(block=>({blockId:block.id,role:'question',...block,bytes:bytes.get(block.assetId)}));
}});
