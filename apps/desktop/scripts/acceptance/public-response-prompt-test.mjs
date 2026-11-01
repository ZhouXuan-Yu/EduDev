import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const { withPublicResponsePrompt, REPLY_PRESENTATION_PROMPT } = await import('../../src/main/xiaozhi-agent/public-response-prompt.ts');
const { createPresentationEventAdapter } = await import('../../src/main/xiaozhi-agent/presentation-event-adapter.ts');
const { resolveCreationPromptIdentity } = await import('../../src/main/xiaozhi-agent/creation-prompt-identity.ts');

let passed = 0;
const check = (name, run) => { run(); passed++; console.log('PASS ' + name); };
const source = ts.createSourceFile('pi-session.ts', fs.readFileSync('src/main/xiaozhi-agent/pi-session.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let basePrompt;
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'XIAOZHI_EDUCATION_PROMPT') {
    assert(ts.isNoSubstitutionTemplateLiteral(node.initializer)); basePrompt = node.initializer.text;
  }
  ts.forEachChild(node, visit);
};
visit(source);
assert(basePrompt);
const options = { provider: 'deepseek', model: 'deepseek-flash', workspace: 'owned-fixture', tools: ['office_read_text'], basePrompt, copyAllowed: false, restoring: false };
check('current effective response prompt resolves tool-first conflict without changing old session authority', () => {
  const creation = resolveCreationPromptIdentity(options);
  const restored = resolveCreationPromptIdentity({ ...options, restoring: true, snapshot: { fingerprint: creation.fingerprint } });
  const permissionSuffix = '\n受保护测试权限：原始资料留本机，写入等待教师确认。';
  const effective = withPublicResponsePrompt(restored.effectivePrompt + permissionSuffix);
  assert(basePrompt.includes('需要资料时先调用工具，再用中文按任务阶段简短说明和归纳。'));
  assert(!effective.includes('需要资料时先调用工具，再用中文按任务阶段简短说明和归纳。'));
  assert(effective.includes(permissionSuffix));
  assert.match(effective, /首个原生工具调用之前必须在普通 text 通道输出一至两句公开计划/);
  assert.match(effective, /附件清单、工具发现和读取也属于首个工具调用/);
  assert.equal(restored.fingerprint, creation.fingerprint);
  assert.equal(restored.identityPrompt, basePrompt);
  assert.match(effective, /学生信息只能走宿主的教育脱敏工具/);
  assert.match(effective, /任何持久写入需要教师确认/);
});
check('response protocol preserves direct zero-tool answers and does not require a new generation per tool', () => {
  assert.match(REPLY_PRESENTATION_PROMPT, /不要求每个工具额外生成一段话/);
  assert.match(REPLY_PRESENTATION_PROMPT, /无需工具的解释直接以 <xiaozhi_answer> 交付/);
  assert.match(REPLY_PRESENTATION_PROMPT, /不写隐藏推理、内部参数或尚未执行的结果/);
});
check('model-written marked public plan emits an explicit phase before its text and the first real tool', () => {
  const plan = '<xiaozhi_progress>我先核对已发送资料，再读取正文；不联网、不写文件。';
  for (let split = 0; split <= plan.length; split++) {
    const events = [], adapter = createPresentationEventAdapter(event => events.push(event));
    adapter.start(1); adapter.delta(plan.slice(0, split)); adapter.delta(plan.slice(split)); adapter.end();
    events.push({ kind: 'tool_start', callId: 'actual-fixture-call', tool: 'office_list_attachments' });
    assert.equal(events[0].kind, 'assistant_phase'); assert.equal(events[0].phase, 'commentary');
    assert.equal(events.filter(event => event.kind === 'text_delta').map(event => event.delta).join(''), plan.slice('<xiaozhi_progress>'.length));
    assert.equal(events.at(-1).kind, 'tool_start');
    assert(!JSON.stringify(events).includes('<xiaozhi_progress>'));
  }
});
check('the exact unmarked PR0X9n public intro is not retroactively certified as an explicit phase', () => {
  const events = [], adapter = createPresentationEventAdapter(event => events.push(event));
  const text = '我先核对本轮附件清单，再读取合成资料正文，据此写活动建议；不联网、不写文件。';
  adapter.start(1); adapter.delta(text); adapter.end();
  assert(!events.some(event => event.kind === 'assistant_phase'));
  assert.equal(events.map(event => event.delta).join(''), text);
});
check('an actual silent tool segment emits no fabricated phase or text; final remains explicit-only', () => {
  const events = [], adapter = createPresentationEventAdapter(event => events.push(event));
  adapter.start(1); adapter.end(); assert.deepEqual(events, []);
  adapter.start(2); adapter.delta('<xiaozhi_answer>正文结果。'); adapter.end();
  assert.equal(events[0].kind, 'assistant_phase'); assert.equal(events[0].phase, 'final_answer');
  assert.equal(events[1].delta, '正文结果。');
});
console.log(JSON.stringify({ suite: 'public-response-prompt', passed, modelCalls: 0, boundary: 'Prompt/identity/parser contract only. Real provider marker compliance requires the parent paired rerun.' }));
