import assert from 'node:assert/strict';
import {paperRendererEnvironment} from './acceptance/paper-instance-renderer-env.mjs';
import {instanceFixture, ownerA} from './acceptance/paper-instance-renderer-fixture.mjs';
import {questionInputBlocks} from './acceptance/paper-instance-ui-form.mjs';

const env = await paperRendererEnvironment();
const {React, root, run, load, find, press, fill} = env;
let passed = 0;
const check = (name, fn) => {fn(); passed++; console.log('PASS ' + name);};
try {
  const {defaultPaperBlueprint} = await load('shared/paper-blueprint.ts');
  const {DesktopFrame} = await load('renderer/components/desktop/DesktopFrame.tsx');
  const {PaperBlueprintWorkspace} = await load('renderer/components/PaperBlueprintWorkspace.tsx');
  const {PaperInstanceRoleEditor} = await load('renderer/components/paper-ui/PaperInstanceRoleEditor.tsx');
  const f = instanceFixture(defaultPaperBlueprint()); window.omniEdu = f.api;
  const entry = f.data.get(ownerA).entries[0]; entry.question.questionType = '选择题';
  entry.question.stem = 'QA seed statement\nA. original alpha\nB. original beta\nC. original gamma\nD. original delta';
  await run(() => root.render(React.createElement(DesktopFrame, null, React.createElement(PaperBlueprintWorkspace, {initialSessionId: ownerA}))));
  await run(); await press(find('paper-instance-open')); await press(find('paper-instance-edit-question'));
  let role = find('paper-instance-role-question');
  check('QA input reader sees actual split statement and all four seeded option fields once', () => {
    const blocks = questionInputBlocks(role);
    assert.equal(blocks.length, 2); assert.deepEqual(blocks[0], {type: 'text', text: 'QA seed statement'});
    assert.deepEqual(blocks[1].items.map(item => item.label), ['A', 'B', 'C', 'D']);
    assert.equal(blocks[1].items[2].text, 'original gamma');
  });
  await fill(role.querySelector('[data-testid="paper-instance-text"]'), 'QA changed statement');
  await fill(role.querySelectorAll('[data-testid="paper-instance-item-text"]')[0], 'QA changed option A');
  check('QA expected payload derives changed statement and preserves untouched source options', () => {
    const blocks = questionInputBlocks(role);
    assert.equal(blocks[0].text, 'QA changed statement'); assert.equal(blocks[1].items[0].text, 'QA changed option A');
    assert.equal(blocks[1].items[2].text, 'original gamma'); assert(!blocks[0].text.includes('original gamma'));
  });
  await press(role.querySelector('[data-testid="paper-instance-add-subquestions"]'));
  await fill(role.querySelectorAll('[data-testid="paper-instance-item-text"]')[4], 'QA subquestion');
  await press(role.querySelector('[data-testid="paper-instance-add-formula"]'));
  await fill(role.querySelector('[data-testid="paper-instance-formula"]'), 'x=2');
  await press(role.querySelector('[data-testid="paper-instance-add-table"]'));
  await fill(role.querySelectorAll('table input')[0], 'QA cell');
  check('QA reader respects direct block order and nested item/formula/table fields', () => {
    const blocks = questionInputBlocks(role);
    assert.deepEqual(blocks.map(block => block.type), ['text', 'options', 'subquestions', 'formula', 'table']);
    assert.deepEqual(blocks[2].items, [{label: '1', text: 'QA subquestion'}]);
    assert.equal(blocks[3].latex, 'x=2'); assert.deepEqual(blocks[4].rows, [['QA cell', ''], ['', '']]);
  });
  await run(() => root.render(React.createElement(PaperInstanceRoleEditor, {entry, role: 'question', disabled: false,
    content: {mode: 'edited', blocks: [{type: 'sourceImage', role: 'question', blockId: 'unit-source', sourceVersion: entry.contentVersion}]},
    onChange() {}})));
  role = find('paper-instance-role-question');
  check('text-fixture QA fails clearly on a source-image dependency instead of discarding it from expected content', () => {
    assert.throws(() => questionInputBlocks(role), /must not flatten or discard/);
  });
  console.log(JSON.stringify({success: true, passed, scope: 'QA form reader against actual mounted renderer/HeroUI input DOM; no Electron/model/build'}));
} finally {await env.close();}
