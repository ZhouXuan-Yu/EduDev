import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
await import('./office-agent/register-source.mjs');
const {MATERIAL_PASTE_SCHEMA, validMaterialPaste} = await import('../src/shared/material-paste.ts');
const {previewPastedMaterial, importPastedMaterial} = await import('../src/main/assets/material-paste.ts');
const {registerMaterialPasteIpc} = await import('../src/main/assets/material-paste-ipc.ts');
let passed = 0;
const check = async (name, action) => {await action(); passed++; console.log('PASS ' + name);};
const text = '学科：数学\n年级：初二\n知识点：有理数\n题型：选择题\n难度：easy\n'
  + '2. 计算 $2+3$。\nA. 4\nB. 5\n答案：B\n解析：两数相加得5。\n'
  + '12. 计算 $3+4$。\nA. 6\nB. 7\n答案：B\n解析：两数相加得7。';
const input = {schemaVersion: MATERIAL_PASTE_SCHEMA, text};
const preview = previewPastedMaterial(input);
const commit = {...input, expectedDigest: preview.digest};
await check('strict input rejects extra paths, invalid bytes, oversize and accessors without invoking them', () => {
  assert(validMaterialPaste(input)); assert(validMaterialPaste(commit, true));
  let invoked = 0;
  const getter = {schemaVersion: MATERIAL_PASTE_SCHEMA, get text() {invoked++; return text;}};
  for (const value of [getter, null, [], {...input, path: 'C:/private'}, {...input, text: 'x'.repeat(40001)},
    {...input, text: '\0'}, {...input, text: '  '}, {...commit, expectedDigest: 'broken'}]) {
    assert.equal(validMaterialPaste(value, true), false);
    if (value !== commit) assert.equal(validMaterialPaste(value), false);
  }
  assert.equal(invoked, 0);
});
await check('real local parser preserves distinct original numbers, formulas, options, answers and digest', () => {
  assert.deepEqual(preview.questions.map(question => question.number), ['2', '12']);
  assert(preview.questions[0].fields.stem.includes('$2+3$'));
  assert(preview.questions[0].fields.stem.includes('A. 4\nB. 5'));
  assert.equal(preview.questions[0].fields.answer, 'B');
  assert.deepEqual(previewPastedMaterial(input), preview);
  assert.equal(preview.digest, createHash('sha256').update(text).digest('hex'));
  assert(!JSON.stringify(preview).includes('resource_'));
});
await check('ambiguous numbering, missing answers and figures remain pending instead of gaining confirmations', () => {
  const result = previewPastedMaterial({schemaVersion: MATERIAL_PASTE_SCHEMA,
    text: '1. 如图，选择正确答案。\nA. 1\nB. 2\n1. 另一道题目。'});
  assert(result.questions.every(question => question.issues.includes('ambiguous_number')));
  assert(result.questions[0].issues.includes('visual_unchecked'));
  assert(result.questions[0].issues.includes('missing_answer'));
  assert.equal(result.questions[0].fields.answer, '');
  assert(!JSON.stringify(result).includes('sourceChecked'));
});
await check('empty numbering and excessive questions fail explicitly without truncation', () => {
  assert.throws(() => previewPastedMaterial({...input, text: '只有无题号的段落。'}), /no_questions/);
  assert.throws(() => previewPastedMaterial({...input, text: Array.from({length: 21}, (_, i) => `${i + 1}. 计算两个数之和。`).join('\n')}), /too_many_questions/);
});
let file, calls = 0;
const host = {async importKnowledgeResources(paths, signal, background, guard) {
  calls++; file = paths[0]; signal.throwIfAborted(); await guard();
  assert.equal(await fs.readFile(file, 'utf8'), text);
  assert.equal(path.basename(file), '粘贴题目.txt');
  assert.equal(background, true);
  return {status: 'succeeded', resources: [{id: 'owned', contentHash: preview.digest}],
    items: [{ok: true, sourcePath: file, fileName: path.basename(file)}], overview: {}};
}};
await check('explicit import delegates actual immutable bytes to the original importer and cleans only its staging files', async () => {
  const result = await importPastedMaterial(host, commit, new AbortController().signal, async () => {});
  assert.equal(calls, 1); assert.equal(result.resources[0].contentHash, preview.digest);
  assert.equal(result.items[0].sourcePath, path.basename(file));
  await assert.rejects(fs.stat(file), {code: 'ENOENT'});
  await assert.rejects(fs.stat(path.dirname(file)), {code: 'ENOENT'});
});
await check('stale digest, cancelled input and failed owner guard never enter the importer', async () => {
  const before = calls;
  await assert.rejects(importPastedMaterial(host, {...commit, expectedDigest: '0'.repeat(64)}, new AbortController().signal, async () => {}), /source_changed/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(importPastedMaterial(host, commit, controller.signal, async () => {}));
  await assert.rejects(importPastedMaterial(host, commit, new AbortController().signal, async () => {throw Error('permission_denied');}), /permission_denied/);
  assert.equal(calls, before);
});
await check('import acknowledgement failure preserves the identical retry bytes and filename', async () => {
  let failedPath;
  await assert.rejects(importPastedMaterial({async importKnowledgeResources(paths) {
    failedPath = paths[0]; assert.equal(await fs.readFile(failedPath, 'utf8'), text); throw Error('readback_failed');
  }}, commit, new AbortController().signal, async () => {}), /readback_failed/);
  await assert.rejects(fs.stat(failedPath), {code: 'ENOENT'});
  await importPastedMaterial(host, commit, new AbortController().signal, async () => {});
  assert.equal(path.basename(failedPath), path.basename(file));
});
await check('both IPC handlers apply the parent main-frame gate before inspecting input', async () => {
  const handlers = new Map();
  const checkOwner = event => {if (event !== 'main') throw Error('permission_denied');};
  const job = async (event, action) => {checkOwner(event); return action(new AbortController().signal);};
  registerMaterialPasteIpc(host, {handle: (name, action) => handlers.set(name, action)}, checkOwner, job);
  assert.throws(() => handlers.get('materials:paste-preview')('iframe', input), /permission_denied/);
  await assert.rejects(handlers.get('materials:paste-import')('iframe', commit), /permission_denied/);
  assert.deepEqual(handlers.get('materials:paste-preview')('main', input), preview);
});
console.log(JSON.stringify({passed, tier: 'real-parser-and-staging-with-controlled-importer-delegate',
  limits: 'Native database idempotency and actual main-frame checks require the formal Electron consumer.'}));
