import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { resolveSubjectAnswerInstructions } = await import('../../src/main/xiaozhi-agent/answer-quality.ts');
const { createPiXiaozhiSession } = await import('../../src/main/xiaozhi-agent/pi-session.ts');

// These inputs exercise routing on different physical setups, not a memorized
// answer. The scientific correctness of model responses needs independent review.
const relevant = [
  '有学生说：物体受到浮力就一定会上浮。请结合附件的3N和2N数据，诊断这个说法，用约200字解释，并给一道变式及答案。',
  '木块平均密度小于盐水密度，但被细绳系在水底保持静止，能说它没有上浮趋势吗？',
  '金属球被线拉住悬浮在油中，可以只凭悬浮判断球和油的密度相同吗？',
  '物块放在桌面静止，撤掉支持力后从静止释放，应怎样说明新条件？',
  '物体正在竖直向上运动，合力方向向下，是否已经向下运动？',
  '完全浸没在均匀水里的刚性球向上移动，直到露出水面，分段比较浮力。',
  '橡皮泥的质量不变，捏成船漂浮在水面，比较平均密度和排液体积。',
  '两个木块浸入不同液体，用密度和体积分析浮沉条件。',
  'Does a sphere held by a string in water have the same density as water?',
  'Explain buoyancy when a rigid body rises while fully submerged.',
  'A body has upward velocity but a downward net force due to gravity. Does its velocity reverse instantly?',
  '匀速圆周运动的物体所受合力是零吗？'
];
const unrelated = [
  '', '你好', '证明两条平行线的内错角相等。',
  '把列表做得更紧凑，增加资料展示密度。',
  '设计一个悬浮按钮，鼠标经过时显示提示。',
  '分析课文里主人公命运的浮沉。',
  'Explain CSS float, display: block and position: static.',
  'Increase the pixel density of the image.',
  'Write an SQL query to count student records.'
];
let passed = 0;
async function check(name, run) {
  await run(); passed++; console.log('PASS ' + name);
}
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-physics-policy-'));
const originalFetch = globalThis.fetch;
const originalMode = process.env.XIAOZHI_ANSWER_QUALITY;
let agent;
try {
  await check('held-out physical conditions and the actual failed task receive subject constraints', () => {
    for (const input of relevant) assert(resolveSubjectAnswerInstructions(input), input);
  });
  await check('unrelated teaching, CSS, density and metaphor inputs receive no subject addendum', () => {
    for (const input of unrelated) assert.equal(resolveSubjectAnswerInstructions(input), '', input);
  });
  await check('only existing exact continuation policy inherits an unfinished physics task', () => {
    assert(resolveSubjectAnswerInstructions('继续！', relevant[1]));
    assert.equal(resolveSubjectAnswerInstructions('继续'), '');
    assert.equal(resolveSubjectAnswerInstructions('谢谢', relevant[1]), '');
    assert.equal(resolveSubjectAnswerInstructions('解释光合作用', relevant[1]), '');
    assert.equal(resolveSubjectAnswerInstructions('继续', unrelated[2]), '');
  });
  await check('constraint contract includes force and displacement conditions without fixture answers', () => {
    const text = resolveSubjectAnswerInstructions(relevant[1]);
    for (const required of [/张力/, /支持力/, /摩擦力/, /合力为零/, /匀速直线运动/, /新增条件/, /已有速度/, /加速度/, /完全浸没/, /均匀液体/, /体积固定/, /不随深度改变/, /跨过液面/, /平均密度/]) assert.match(text, required);
    assert.doesNotMatch(text, /3\s*N|2\s*N|1\s*N|buoyancy-review|kias9P|附件的/iu);
    assert.match(text, /不输出隐藏推理/);
  });

  const captures = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).hostname, 'api.deepseek.com', 'unexpected outbound destination blocked');
    const body = JSON.parse(init.body); captures.push(body);
    const chunks = [{ role: 'assistant', content: '' }, { content: '这是合成的传输层测试响应，不用于科学质量验收。' }, {}]
      .map((delta, index) => 'data: ' + JSON.stringify({ id: 'physics-policy-fixture', object: 'chat.completion.chunk', created: 0, model: body.model,
        choices: [{ index: 0, delta, finish_reason: index === 2 ? 'stop' : null }] }) + '\n\n').join('');
    return new Response(chunks + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
  };
  const capacity = { id: 'deepseek-flash', name: 'DeepSeek Flash', contextWindow: 1048576, maxOutputTokens: 32768, observedAt: new Date().toISOString(), source: 'official' };
  const options = index => {
    const stateRoot = path.join(root, 'state-' + index), workspace = path.join(root, 'workspace-' + index);
    fs.mkdirSync(stateRoot); fs.mkdirSync(workspace);
    return { stateRoot, workspace, apiKey: 'synthetic-not-a-secret', model: capacity.id, capabilities: capacity, limitsEnforced: false, onEvent() {} };
  };
  const latestUser = body => [...body.messages].reverse().find(message => message.role === 'user');
  const userText = body => {
    const content = latestUser(body)?.content;
    return typeof content === 'string' ? content : content?.filter(part => part.type === 'text').map(part => part.text).join('\n');
  };
  await check('real Pi serialized wire injects current subject context with exactly one model request', async () => {
    delete process.env.XIAOZHI_ANSWER_QUALITY;
    agent = await createPiXiaozhiSession(options(1));
    assert((await agent.prompt(relevant[1])).ok);
    assert.equal(captures.length, 1, 'no extra generation or repair loop');
    assert.match(userText(captures[0]), /\[本次物理任务的答案核对约束\]/);
    assert(userText(captures[0]).endsWith('[教师本次请求]\n' + relevant[1]));
    assert(!JSON.stringify(captures[0].messages.filter(message => message.role === 'system')).includes('[本次物理任务的答案核对约束]'), 'stable system/cache prefix must not change');
  });
  await check('next unrelated user turn keeps its exact text and does not inherit the addendum', async () => {
    const text = '请简短解释光合作用。';
    assert((await agent.prompt(text)).ok);
    assert.equal(captures.length, 2);
    assert.equal(userText(captures[1]), text, 'historical context may remain, but current request gets no subject policy');
    await agent.dispose(); agent = undefined;
  });
  await check('existing main-only legacy rollback disables subject injection on actual wire', async () => {
    process.env.XIAOZHI_ANSWER_QUALITY = 'legacy';
    agent = await createPiXiaozhiSession(options(2));
    assert((await agent.prompt(relevant[2])).ok);
    assert.equal(captures.length, 3);
    assert.equal(userText(captures[2]), relevant[2]);
  });
  console.log(JSON.stringify({ ok: true, checks: passed, relevantInputs: relevant.length, unrelatedInputs: unrelated.length, paidCalls: 0,
    boundary: 'Real Pi SDK with intercepted deterministic HTTP/SSE. Routing and wire contract only; no model/science acceptance.' }));
} finally {
  await agent?.dispose();
  globalThis.fetch = originalFetch;
  if (originalMode === undefined) delete process.env.XIAOZHI_ANSWER_QUALITY;
  else process.env.XIAOZHI_ANSWER_QUALITY = originalMode;
}
