import assert from 'node:assert/strict';
import {paperRendererEnvironment} from './acceptance/paper-instance-renderer-env.mjs';
import {deferred} from './acceptance/paper-basket-renderer-fixture.mjs';

const environment = await paperRendererEnvironment();
const {React, root, run, load, find, press, fill} = environment;
const errors = [];
environment.dom.window.addEventListener('error', event => errors.push(String(event.error)));
let passed = 0, navigation, dirty = false, submitted = [], previewAction, importAction;
const text = '1. 计算 $2+3$。\nA. 4\nB. 5\n答案：B\n解析：2+3=5。';
const onDirtyChange = value => {dirty = value;};
const check = (name, action) => {action(); passed++; console.log('PASS ' + name);};
try {
  const {PaperPastePanel} = await load('renderer/components/paper-ui/PaperPastePanel.tsx');
  const {DesktopFrame, useDesktopNavigation} = await load('renderer/components/desktop/DesktopFrame.tsx');
  const {previewPastedMaterial} = await load('main/assets/material-paste.ts');
  const preview = previewPastedMaterial({schemaVersion: 'xiaozhi.material-paste.v1', text});
  window.omniEdu = {onDesktopCommand: () => () => {},
    previewPastedMaterial: input => previewAction(input),
    importPastedMaterial: input => {submitted.push(input); return importAction(input);}};
  function Consumer() {
    navigation = useDesktopNavigation();
    return React.createElement(PaperPastePanel, {disabled: false, onDirtyChange, onMaterials: () => navigation.navigate({view: 'knowledge'})});
  }
  await run(() => root.render(React.createElement(DesktopFrame, null, React.createElement(Consumer))));
  const delayed = deferred(); previewAction = () => delayed.promise;
  await press(find('paper-paste-open')); await fill(find('paper-paste-text'), text);
  await press(find('paper-paste-preview'));
  let navigated;
  await run(() => {navigated = navigation.navigate({view: 'knowledge'});});
  check('unsaved paste blocks actual application navigation and has not called the importer', () => {
    assert.equal(dirty, true); assert.equal(navigated, false); assert.equal(submitted.length, 0);
  });
  await run(() => find('paper-paste-text').dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
  await run(() => delayed.resolve(preview));
  check('cancelled preview response cannot resurrect the panel or write facts', () => {
    assert(find('paper-paste-open')); assert.equal(find('paper-paste-preview-list'), null);
    assert.equal(dirty, false); assert.equal(submitted.length, 0);
  });
  previewAction = async () => preview;
  await press(find('paper-paste-open')); await fill(find('paper-paste-text'), text);
  await press(find('paper-paste-preview'));
  check('actual card renders parsed source text and requires an explicit boundary check', () => {
    assert.equal(document.querySelectorAll('[data-testid="paper-paste-question"]').length, 1);
    assert(find('paper-paste-preview-list').textContent.includes('原题号 1'));
    assert(find('paper-paste-save').disabled); assert.equal(submitted.length, 0);
    assert.equal(document.querySelectorAll('details,summary,img').length, 0);
  });
  const boundaryCheck = find('paper-paste-check').querySelector('input[type="checkbox"]');
  assert(boundaryCheck, 'Official checkbox exposes its native input');
  // JSDOM does not implement the real browser label activation exercised by the Electron suite.
  await run(() => boundaryCheck.click());
  assert.equal(find('paper-paste-save').disabled, false, 'Actual checked state enables explicit import');
  importAction = async () => {throw Error('readback_failed');};
  await press(find('paper-paste-save'));
  await run(() => find('paper-paste-text').dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
  await run(() => {navigated = navigation.navigate({view: 'knowledge'});});
  check('unknown import acknowledgement retains original input, blocks cancellation and offers same-operation verification', () => {
    assert.equal(submitted.length, 1); assert.equal(find('paper-paste-text').value, text);
    assert(find('paper-paste-cancel').disabled); assert(find('paper-paste-text').disabled);
    assert.equal(navigated, false); assert(find('paper-paste-save').textContent.includes('核实上次导入结果'));
  });
  importAction = async () => ({resources: [{id: 'owned', title: '实际回执字段', contentHash: preview.digest}], items: [{ok: true}]});
  await press(find('paper-paste-save'));
  check('successful verification uses identical content/digest and retains the actual resource receipt', () => {
    assert.deepEqual(submitted[1], submitted[0]); assert(find('paper-paste-saved').textContent.includes('实际回执字段'));
    assert.equal(dirty, false); assert(!find('paper-paste-cancel').disabled);
  });
  await press(find('paper-paste-cancel'));
  previewAction = async () => {throw Error('no_questions');};
  await press(find('paper-paste-open')); await fill(find('paper-paste-text'), '没有题号');
  await press(find('paper-paste-preview'));
  check('real parser failure is visible while teacher input stays editable and no import occurs', () => {
    assert(find('paper-paste-error').textContent.includes('没有识别到独立题号'));
    assert.equal(find('paper-paste-text').value, '没有题号'); assert.equal(submitted.length, 2);
  });
  await press(find('paper-paste-cancel'));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({passed, tier: 'actual-mounted-components-with-controlled-IPC', modelCalls: 0, errors}));
} finally {await environment.close();}
