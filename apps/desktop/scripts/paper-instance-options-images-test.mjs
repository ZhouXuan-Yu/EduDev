import assert from 'node:assert/strict';
import {paperRendererEnvironment} from './acceptance/paper-instance-renderer-env.mjs';
import {instanceFixture, ownerA, sourceContent, version} from './acceptance/paper-instance-renderer-fixture.mjs';
import {deferred} from './acceptance/paper-basket-renderer-fixture.mjs';

const env = await paperRendererEnvironment();
const {React, root, run, load, find, press, fill} = env;
let passed = 0, generation = 0;
const check = (name, fn) => {fn(); passed++; console.log('PASS ' + name);};
const trigger = id => {
  const matches = find(id).querySelectorAll(':scope > [data-slot="disclosure-heading"] > [data-slot="disclosure-trigger"]');
  assert.equal(matches.length, 1); return matches[0];
};
try {
  const {defaultPaperBlueprint} = await load('shared/paper-blueprint.ts');
  const {DesktopFrame} = await load('renderer/components/desktop/DesktopFrame.tsx');
  const {PaperBlueprintWorkspace} = await load('renderer/components/PaperBlueprintWorkspace.tsx');
  const {PaperInstanceContent} = await load('renderer/components/paper-ui/PaperInstanceContent.tsx');
  const {seedInstanceRole} = await load('renderer/components/paper-ui/paper-instance-content.ts');
  const {splitInstanceOptions} = await load('renderer/components/paper-ui/paper-instance-options.ts');
  const {validQuestionDocument} = await load('shared/question-document.ts');
  const {editedInstanceChoiceLabels, instanceDeliveryBlock} = await load('main/education/paper-instance.ts');
  const f = instanceFixture(defaultPaperBlueprint()); window.omniEdu = f.api;
  const entry = f.data.get(ownerA).entries[0]; entry.question.questionType = '选择题';
  entry.question.stem = '计算 1+1 的值。\nA. 1\nB. 2\nC. 3\nD. 4';
  const originalQuestion = JSON.stringify(entry.question);
  check('plain stem A-D splits once into editable statement and four ordered options without duplicating option text', () => {
    const blocks = seedInstanceRole(entry, 'question');
    assert.deepEqual(blocks, [{type: 'text', text: '计算 1+1 的值。'}, {type: 'options', items: [
      {label: 'A', text: '1'}, {label: 'B', text: '2'}, {label: 'C', text: '3'}, {label: 'D', text: '4'}]}]);
    assert.equal(JSON.stringify(entry.question), originalQuestion);
    for (const text of ['无从确定的选项文本', '求点 A 的坐标，B 为原点。', '问题 A. 1 C. 3', '问题 A. 1 A. 2', '问题 A. 1 B. ']) {
      assert.equal(splitInstanceOptions(text), undefined, 'Ambiguous/empty/out-of-order labels must not manufacture options');
    }
  });
  await run(() => root.render(React.createElement(DesktopFrame, null, React.createElement(PaperBlueprintWorkspace, {initialSessionId: ownerA}))));
  await run(); await press(find('paper-instance-open')); await press(find('paper-instance-edit-question'));
  const role = find('paper-instance-role-question');
  check('actual choice editor exposes natural option fields seeded from plain source stem', () => {
    assert.equal(role.querySelectorAll('[data-testid="paper-instance-item-text"]').length, 4);
    assert.equal(role.querySelector('[data-testid="paper-instance-text"]').value, '计算 1+1 的值。');
    assert.equal(find('paper-instance-options-required'), null);
  });
  await fill(role.querySelector('[data-testid="paper-instance-text"]'), '仅修改本卷题干，计算 1+1。');
  await press(find('paper-instance-save')); await run();
  check('saving only a changed statement preserves all four structured options and original bank facts', () => {
    const saved = f.data.get(ownerA).entries[0];
    assert.equal(saved.instance.content.question.blocks[1].type, 'options');
    assert.deepEqual(saved.instance.content.question.blocks[1].items.map(item => item.label), ['A', 'B', 'C', 'D']);
    assert.deepEqual(editedInstanceChoiceLabels(saved.question, saved.instance), ['A', 'B', 'C', 'D'], 'Accepted host answer-sheet consumer reads the same four labels');
    assert.equal(JSON.stringify(saved.question), originalQuestion);
  });
  await run(() => root.render(null));
  const blocked = f.data.get(ownerA).entries[0];
  blocked.instance.content.question = {mode: 'edited', blocks: [{type: 'text', text: '无法可信拆分的选择题文本'}]};
  blocked.deliveryBlock = instanceDeliveryBlock(blocked.question, blocked.instance);
  assert.equal(blocked.deliveryBlock, 'options_required'); blocked.reviewCurrent = false; f.data.get(ownerA).complete = false;
  await run(() => root.render(React.createElement(DesktopFrame, null, React.createElement(PaperBlueprintWorkspace, {initialSessionId: ownerA}))));
  await run(); await press(find('paper-instance-open'));
  check('authoritative options_required has a distinct teacher explanation and keeps review blocked while input is editable', () => {
    assert(find('paper-instance-options-required')); assert.equal(find('paper-instance-confirm').disabled, true);
    assert(find('paper-instance-content').textContent.includes('补齐至少两个选项'));
    assert(!find('paper-instance-content').textContent.includes('原图'));
    assert.equal(find('paper-instance-role-question').querySelector('[data-testid="paper-instance-text"]').disabled, false);
  });
  await run(() => root.render(null));
  const image = (id, asset, sha) => ({id, kind: 'image', assetId: 'asset_' + asset.repeat(8) + '-1111-4111-8111-111111111111',
    sha256: sha.repeat(64), mime: 'image/png', width: 100, height: 100, anchors: [{page: 1, box: [0, 0, 1, 1]}]});
  const qImage = image('source_question_1', '1', '1'), aImage = image('source_answer_1', '2', '2'), xImage = image('source_analysis_1', '3', '3');
  const part = text => ({state: text ? 'provided' : 'not_applicable', text});
  const document = {schemaVersion: 'xiaozhi.question-document.v2', source: {
    resourceId: 'resource_11111111-1111-4111-8111-111111111111', resourceVersion: version,
    parserVersion: 'teacher-transcription.v2+unit', ocrVersion: 'unit'}, blocks: [qImage, aImage, xImage],
    answer: {origin: 'source', text: 'UNIT source answer', anchors: aImage.anchors},
    analysis: {origin: 'source', text: 'UNIT source analysis', anchors: xImage.anchors},
    context: {schemaVersion: 'xiaozhi.question-projection.v1', sourceBlockIds: [qImage.id], projection: {
      statement: part('UNIT source statement'), formulas: part(''), tables: part(''), figures: part(''), choices: part(''), subquestions: part('')}}};
  assert(validQuestionDocument(document), 'Image regression uses a valid pinned QuestionDocument DTO');
  const shown = structuredClone(blocked); shown.deliveryBlock = undefined;
  shown.instance.content = {...sourceContent(), question: {mode: 'edited', blocks: [{type: 'text', text: 'UNIT edited question'}]}};
  shown.question.document = document; shown.question.answer = document.answer.text; shown.question.analysis = document.analysis.text;
  check('editing a document source-answer role retains its explicit figure dependency instead of flattening the image away', () => {
    assert(seedInstanceRole(shown, 'answer').some(block => block.type === 'sourceImage' && block.blockId === aImage.id && block.sourceVersion === version));
    assert(!seedInstanceRole(shown, 'answer').some(block => block.type === 'sourceImage' && block.blockId === xImage.id));
  });
  const calls = [];
  const gallery = [qImage, aImage, xImage].map((block, index) => ({role: ['question', 'answer', 'analysis'][index], page: 1,
    assetId: block.assetId, sha256: block.sha256, dataUrl: 'data:image/png;base64,UNIT_' + index}));
  f.api.getOriginalQuestionGallery = async input => {calls.push(input); return {ok: true, value: gallery};};
  const mountContent = (value, showAnswers) => run(() => root.render(React.createElement(PaperInstanceContent,
    {key: ++generation, entry: value, showAnswers})));
  await mountContent(shown, false);
  check('student instance DOM never mounts answer/analysis gallery readers or answer images', () => {
    assert.equal(calls.length, 0); assert.equal(find('paper-basket-answer'), null); assert.equal(env.dom.window.document.querySelectorAll('img').length, 0);
  });
  await mountContent(shown, true); assert.equal(calls.length, 0);
  await press(trigger('paper-basket-answer')); await run();
  check('teacher source roles read authorized gallery with exact pinned version and show only matching role/assets', () => {
    assert.equal(calls.length, 2);
    for (const call of calls) assert.deepEqual(call, {schemaVersion: 'xiaozhi.education.original-review.v2', questionId: shown.questionId, version});
    const answerImages = find('paper-instance-answer-view').querySelectorAll('img'), analysisImages = find('paper-instance-analysis-view').querySelectorAll('img');
    assert.equal(answerImages.length, 1); assert.equal(analysisImages.length, 1);
    assert.equal(answerImages[0].getAttribute('src'), gallery[1].dataUrl); assert.equal(analysisImages[0].getAttribute('src'), gallery[2].dataUrl);
  });
  f.api.getOriginalQuestionGallery = async () => ({ok: true, value: gallery.map(x => ({...x, sha256: 'f'.repeat(64)}))});
  await mountContent(shown, true); await press(trigger('paper-basket-answer')); await run();
  check('mismatched gallery asset hashes cannot substitute an old/wrong role image', () => {
    assert.equal(env.dom.window.document.querySelectorAll('img').length, 0);
    assert(find('paper-instance-answer-view').querySelector('[role="alert"]'));
  });
  f.api.getOriginalQuestionGallery = async () => ({ok: false, error: 'source_changed'});
  await mountContent(shown, true); await press(trigger('paper-basket-answer')); await run();
  check('gallery permission/version failure remains visible with no image fallback', () => {
    assert.equal(env.dom.window.document.querySelectorAll('img').length, 0);
    assert(find('paper-instance-analysis-view').querySelector('[role="alert"]'));
  });
  const pending = deferred(); f.api.getOriginalQuestionGallery = () => pending.promise;
  await mountContent(shown, true); await press(trigger('paper-basket-answer'));
  await mountContent(shown, false); await run(() => pending.resolve({ok: true, value: gallery}));
  check('late teacher-gallery reply cannot mount private role content after switching to student', () => {
    assert.equal(find('paper-basket-answer'), null); assert.equal(env.dom.window.document.querySelectorAll('img').length, 0);
  });
  console.log(JSON.stringify({success: true, passed, scope: 'Actual renderer controls and saved/source-role rendering with typed unit DTOs; no actual Electron/Office or source fixture mutation'}));
} finally {await env.close();}
