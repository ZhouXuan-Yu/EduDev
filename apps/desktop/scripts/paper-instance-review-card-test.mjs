import assert from 'node:assert/strict';
import {paperRendererEnvironment} from './acceptance/paper-instance-renderer-env.mjs';
import {instanceFixture, ownerA, version} from './acceptance/paper-instance-renderer-fixture.mjs';

const env = await paperRendererEnvironment();
const {React, root, run, load, find, press} = env;
let passed = 0, mount = 0;
const check = (name, fn) => {fn(); passed++; console.log('PASS ' + name);};
const trigger = id => {
  const matches = find(id)?.querySelectorAll(':scope > [data-slot="disclosure-heading"] > [data-slot="disclosure-trigger"]');
  assert.equal(matches?.length, 1, `Exactly one official trigger for ${id}`);
  return matches[0];
};
try {
  const {defaultPaperBlueprint} = await load('shared/paper-blueprint.ts');
  const {PaperQuestionReviewCard} = await load('renderer/components/paper-ui/PaperQuestionReviewCard.tsx');
  const f = instanceFixture(defaultPaperBlueprint());
  window.omniEdu = f.api;
  const entry = structuredClone(f.data.get(ownerA).entries[0]);
  entry.question.stem = 'ORIGINAL bank statement only for source comparison';
  entry.question.answer = 'ORIGINAL bank answer only for source comparison';
  entry.instance.content = {
    question: {mode: 'edited', blocks: [{type: 'text', text: 'FINAL edited statement'},
      {type: 'options', items: [{label: 'A', text: 'FINAL edited option'}]},
      {type: 'subquestions', items: [{label: '1', text: 'FINAL edited subquestion'}]}]},
    answer: {mode: 'edited', blocks: [{type: 'text', text: 'TEACHER supplemental answer'}, {type: 'formula', latex: 'x=\\frac{3}{2}'}]},
    analysis: {mode: 'edited', blocks: [{type: 'text', text: 'FINAL teacher analysis'}]},
  };
  const item = {number: 1, points: 5, sectionId: 'choice', entryId: entry.entryId,
    question: entry.question, source: {questionId: entry.questionId, version}, instance: entry.instance};
  const before = JSON.stringify(item);
  const render = value => run(() => root.render(React.createElement(PaperQuestionReviewCard, {key: ++mount, item: value})));
  await render(item); await press(trigger('paper-question'));
  check('whole-paper review card renders final edited statement/options/subquestion instead of bank content', () => {
    const content = find('paper-instance-content');
    assert(content.textContent.includes('FINAL edited statement'));
    assert(content.textContent.includes('FINAL edited option'));
    assert(content.textContent.includes('FINAL edited subquestion'));
    assert(!document.body.textContent.includes('ORIGINAL bank statement'));
    assert.equal(find('paper-question-source').querySelector('[data-testid="paper-basket-question-stem"]'), null);
  });
  check('teacher supplemental answer is not mounted before the answer disclosure opens', () => {
    assert.equal(find('paper-instance-answer-view'), null);
    assert(!document.body.textContent.includes('TEACHER supplemental answer'));
  });
  await press(trigger('paper-basket-answer'));
  check('review/history consumer displays saved teacher answer, formula and analysis', () => {
    assert(find('paper-instance-answer-view').textContent.includes('TEACHER supplemental answer'));
    assert(find('paper-instance-answer-view').querySelector('.katex'));
    assert(find('paper-instance-analysis-view').textContent.includes('FINAL teacher analysis'));
    assert(!find('paper-instance-content').textContent.includes('ORIGINAL bank answer'));
  });
  await press(trigger('paper-question-source'));
  check('original question is accessible only in an independent source comparison', () => {
    assert(find('paper-question-source').textContent.includes('ORIGINAL bank statement'));
    assert(!find('paper-question-source').textContent.includes('FINAL edited statement'));
    assert.equal(find('paper-instance-content').querySelector('[data-testid="pi-question-source-open"]'), null);
    assert.equal(document.querySelector('details,summary'), null);
    assert.equal(JSON.stringify(item), before, 'Rendering must not mutate saved content or bank facts');
  });
  await render({...item, instance: undefined}); await press(trigger('paper-question'));
  check('legacy v1/automatic question card retains original statement and answer evidence path', () => {
    assert(find('paper-question-stem').textContent.includes('ORIGINAL bank statement'));
    assert.equal(find('paper-snapshot-instance'), null);
    assert(find('paper-question-answer').textContent.includes('ORIGINAL bank answer'));
    assert.equal(trigger('paper-question-answer').getAttribute('aria-expanded'), 'false');
  });
  console.log(JSON.stringify({success: true, passed, scope: 'Actual shared review-card and HeroUI render in JSDOM; no Electron/SQLite/provider claim'}));
} finally {await env.close();}
