import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {nativeQuestionFixture} from './native-question-fixtures.mjs';
const {createQuestionContextProvider} = await import('../../src/main/education/question-context-provider.ts');

const checks = [];
const question = nativeQuestionFixture();
let unavailable = false;
let validationCount = 0;
const store = {
  listStudents: async () => [{realName: '合成学生甲'}],
  sanitizeProblemText: async text => ({sanitizedText: text}),
  searchQuestionBank: async () => [structuredClone(question)],
  getQuestionNotebookEntry: async () => structuredClone(question),
  readArchivedQuestionContext: async () => {
    validationCount++;
    if (unavailable) throw Error('source_changed');
  },
};
async function read() {
  const tools = createQuestionContextProvider(store, () => true);
  const result = await tools[0].execute('search', {query: '三角形'}, new AbortController().signal);
  const candidate = JSON.parse(result.content[0].text).questions[0];
  return {tools, candidate, result: await tools[1].execute('read', {
    reference: candidate.reference, version: candidate.version
  }, new AbortController().signal)};
}
const payload = result => JSON.parse(result.content[0].text);
async function check(name, run) {
  await run(); checks.push(name); console.log('PASS ' + name);
}
await check('Legacy Native receipts expose the original number and validated local role counts without image bytes or asset identities', async () => {
  const initial = JSON.stringify(question);
  const value = payload((await read()).result);
  assert.equal(value.success, true);
  assert.equal(value.question.originalNumber, '1');
  assert.deepEqual(value.question.localMedia, {storage: 'local', includedInModelContext: false, contextScope: 'current_read', totalImageCount: 2,
    roleImageCounts: {question: 1, answer: 1, analysis: 0}, reviewLocation: '教学工作台 → 题本'});
  assert.equal(value.originalImagesIncluded, false);
  assert.equal(value.answerVerified, false);
  assert.equal(value.teacherConfirmationKnown, false);
  assert(!JSON.stringify(value).includes('asset_'));
  assert(!JSON.stringify(value).includes('data:image'));
  assert.equal(JSON.stringify(question), initial);
  assert(validationCount >= 3);
});
await check('Reviewed Native receipts retain exact counts and origin while teacher authority remains separate', async () => {
  question.archive.ai.policy = 'native-reviewed.v2';
  const {result, tools} = await read();
  const value = payload(result);
  assert.equal(value.question.localMedia.roleImageCounts.question, 1);
  assert.equal(value.question.answerOrigin, 'source');
  assert.equal(value.question.analysisOrigin, 'ai_generated');
  assert.equal(value.scope, 'ai_transcribed_source');
  assert.match(tools[1].description, /originalNumber/);
  assert.match(tools[1].description, /localMedia/);
});
await check('Malformed original numbers containing personal data cannot become readable metadata', async () => {
  question.archive.number = '合成学生甲 D:/private/number';
  const tools = createQuestionContextProvider(store, () => true);
  const value = payload(await tools[0].execute('search', {query: '三角形'}, new AbortController().signal));
  assert.equal(value.returned, 0);
  assert(!JSON.stringify(value).includes('合成学生甲'));
  assert(!JSON.stringify(value).includes('D:/private'));
  question.archive.number = '1';
});
await check('A source revoked after discovery returns no original number or local media claims', async () => {
  const {tools, candidate} = await read();
  unavailable = true;
  const value = payload(await tools[1].execute('read', {reference: candidate.reference,
    version: candidate.version}, new AbortController().signal));
  assert.equal(value.success, false);
  assert.equal(value.code, 'source_changed');
  assert(!value.question);
});
console.log(JSON.stringify({passed: checks.length, checks,
  scope: 'Production question-reader with controlled source validation. Actual source image bytes are verified by the Native ledger and Electron path.'}));
