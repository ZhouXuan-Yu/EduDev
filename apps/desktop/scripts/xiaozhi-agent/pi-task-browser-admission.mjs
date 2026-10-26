import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const { createTaskResources } = await import('../../src/main/xiaozhi-agent/tasks/resources.ts');
const { taskToolKinds } = await import('../../src/main/xiaozhi-agent/tasks/task-evidence.ts');
const { taskEnvelope } = await import('../../src/main/xiaozhi-agent/tasks/tool-envelope.ts');
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-task-browser-admission-'));
const sessionId = `aisession_${randomUUID()}`;
const url = 'https://www.moe.gov.cn/';
const resources = createTaskResources({
  sessionId,
  workspace: async () => { throw Error('workspace must not be read for web'); },
  studentId: async () => '',
  attachment: async () => false,
});
const checks = [];
const check = async (name, action) => {
  await action();
  checks.push({ name, pass: true });
  console.log('PASS ' + name);
};
try {
  await check('Web task mapping accepts the actual isolated browser without granting unrelated write tools', async () => {
    assert(taskToolKinds.web.includes('office_browser'));
    assert(taskToolKinds.web.includes('office_web_fetch'));
    await assert.rejects(() => resources.invocation('web', 'office_create_text', { path: 'lesson.md' }), /task_tool_scope/);
  });
  await check('Browser navigate uses the actual public URL identity', async () => {
    const expected = await resources.resource('web', url);
    assert.equal(await resources.invocation('web', 'office_browser', { action: 'navigate', url }), expected);
    await assert.rejects(() => resources.invocation('web', 'office_browser', { action: 'navigate' }), /task_target_invalid/);
  });
  await check('Snapshot and screenshot reuse only the adopted step resource', async () => {
    const expected = await resources.resource('web', url);
    for (const action of ['snapshot', 'screenshot']) {
      assert.equal(await resources.invocation('web', 'office_browser', { action }, expected), expected);
      assert.equal(await resources.invocation('web', 'office_browser', { action, url: 'https://example.com/' }, expected), expected);
    }
    await assert.rejects(() => resources.invocation('web', 'office_browser', { action: 'snapshot' }), /task_target_invalid/);
    await assert.rejects(() => resources.invocation('web', 'office_browser', { action: 'screenshot' }, 'private'), /task_target_invalid/);
  });
  await check('Task envelope adds only taskStepId and preserves browser inputs', async () => {
    let received;
    const wrapped = taskEnvelope({
      name: 'office_browser',
      label: 'Browser',
      description: 'owned',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['action'],
        properties: { action: { type: 'string' }, url: { type: 'string' } },
      },
      execute: async (_id, args) => {
        received = args;
        return { content: [{ type: 'text', text: 'ok' }], details: { success: true } };
      },
    });
    assert.equal(wrapped.parameters.properties.taskStepId.type, 'string');
    await wrapped.execute('browser_owned', { taskStepId: 'browser_open', action: 'navigate', url });
    assert.deepEqual(received, { action: 'navigate', url });
  });
  const report = {
    success: true,
    checks,
    buildRoot: path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT || 'out'),
    boundary: 'Actual task resource/tool-envelope mapping with no browser launch, model or external effect.',
  };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ success: true, checks: checks.length, output }));
} catch (error) {
  const report = {
    success: false,
    checks,
    error: String(error.stack || error),
    boundary: 'Actual task resource/tool-envelope mapping with no browser launch, model or external effect.',
  };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.error(JSON.stringify({ success: false, checks: checks.length, output, error: report.error }));
  process.exitCode = 1;
}
