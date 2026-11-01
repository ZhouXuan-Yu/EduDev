import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
const { responseScopeInstructions } = await import('../../src/main/xiaozhi-agent/response-scope.ts');

let passed = 0;
const check = (name, run) => { run(); passed++; console.log('PASS ' + name); };
check('explicit explanation length stays distinct from an additional task without inventing a numeric budget', () => {
  const text = '请用约180字解释光合作用，并给一道练习及答案。';
  const hint = responseScopeInstructions(text);
  assert.match(hint, /字数只限定解释/);
  assert.match(hint, /题目与答案分开呈现/);
  assert.match(hint, /公式、标点及引用的可见文字预留余量/);
  assert.match(hint, /不自行新增数值上限、容差或变式格式/);
  assert(!/\d/.test(hint), 'limits must remain solely in the unchanged teacher request');
});
check('whole-response and multiple or English scopes remain conditional on the teacher original', () => {
  for (const text of [
    '全文不超过350字，包括题目与答案。',
    '解释用120字，摘要控制在80字，不要出题。',
    'Explain the result in about 90 words and give a separate question with its answer.',
    'Summarize in 60–90 words; answer the questions within 40 words.',
    '用150字符介绍植物，不要使用变式格式。',
  ]) {
    const hint = responseScopeInstructions(text);
    assert(hint, text);
    assert.match(hint, /若限定全文或总字数，所有部分共同计入/);
    assert.match(hint, /多个范围分别遵守，不合并、不猜分配/);
    assert.match(hint, /按指定语言和计数单位/);
    assert.match(hint, /按words要求时不擅自改成字符计数/);
    assert(!/\d/.test(hint));
  }
});
check('numbers, question indexes, lexical matches and no-length turns gain no length constraint', () => {
  for (const text of [
    '', '请解释第180题，数据是6N和4N。', '写第200题的答案。', '把第180字改成红色。',
    '用200字母组成一个密码。', '找出200字样。', '写200字体的排版示例。',
    '分析180个字符中有几个数字。', '请解释光合作用，并给一道练习及答案。',
    'Explain question 150 with a force of 25 N.', '请解释两百字的来源。',
  ]) assert.equal(responseScopeInstructions(text), '', text);
});
check('subject checking narrows output without numeric limits or mandatory extra exercises', () => {
  const hint = responseScopeInstructions('解释给定条件下的运动趋势。', true);
  assert.match(hint, /学科护栏用于核对，不是额外输出提纲/);
  assert.match(hint, /不删必要条件来缩短/);
  assert.match(hint, /不.*增加未被询问的规律/);
  assert(!hint.includes('题目与答案分开呈现'));
  assert(!/\d/.test(hint));
});
console.log(JSON.stringify({ ok: true, checks: passed, paidCalls: 0, boundary: 'Local request-guidance and prompt-composition contracts only; no model compliance or answer-quality claim.' }));
