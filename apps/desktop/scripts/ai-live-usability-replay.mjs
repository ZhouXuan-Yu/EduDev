import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const suppliedDataRoot = process.env.OMNI_EDU_LIVE_DATA_ROOT?.trim();
const dataRoot = suppliedDataRoot || mkdtempSync(join(tmpdir(), 'omni-edu-ai-live-usability-'));
const ownsDataRoot = !suppliedDataRoot;

const replayPrompts = [
  {
    id: 'live_student_progress_001',
    prompt: '请查看小A最近数学学习进度，告诉我下一步补什么。',
    expectedRoute: 'student_diagnosis',
    expectedCapability: 'deep_solve',
  },
  {
    id: 'live_workspace_help_002',
    prompt: '如何使用左侧导航打开学生数据模块？',
    expectedRoute: 'workspace_help',
    expectedCapability: 'chat',
  },
];

async function run() {
  const entry = join(appRoot, 'out/main/index.js');
  if (!existsSync(entry)) {
    throw new Error('Electron build output is missing. Run `npm run build` before ai-live-usability-replay.');
  }

  let app;
  const launchOutput = [];
  const captureLaunchOutput = (chunk) => {
    const redacted = String(chunk)
      .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-[redacted]')
      .slice(0, 4_000);
    if (redacted.trim()) launchOutput.push(redacted);
    if (launchOutput.length > 20) launchOutput.shift();
  };
  try {
    app = await electron.launch({
      args: [entry],
      env: {
        ...process.env,
        OMNI_EDU_DATA_ROOT: dataRoot,
      },
    });
    app.process().stdout?.on('data', captureLaunchOutput);
    app.process().stderr?.on('data', captureLaunchOutput);
    let page;
    try {
      page = await app.firstWindow({ timeout: 30_000 });
    } catch (error) {
      const exitCode = app.process().exitCode;
      throw new Error([
        error instanceof Error ? error.message : String(error),
        `Electron exit code: ${exitCode ?? 'still-running'}`,
        launchOutput.length ? `Electron output:\n${launchOutput.join('\n')}` : 'Electron produced no captured output.',
      ].join('\n'));
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => Boolean(window.omniEdu));

    const bootstrap = await page.evaluate(() => window.omniEdu.bootstrap());
    const student = bootstrap.students.find((item) => item.displayName === '小A') ?? bootstrap.students[0];
    assert.ok(student?.id, 'seed student should exist for live replay');

    const savedSettings = process.env.DEEPSEEK_API_KEY
      ? await page.evaluate(
          ({ apiKey, model }) => window.omniEdu.saveDeepSeekSettings({ apiKey, model }),
          {
            apiKey: process.env.DEEPSEEK_API_KEY,
            model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
          },
        )
      : await page.evaluate(() => window.omniEdu.getDeepSeekSettings());
    if (!savedSettings.configured) {
      console.log(JSON.stringify({
        ok: true,
        skipped: true,
        reason: 'No DeepSeek credential is configured in the supplied isolated data root.',
        sampleCount: replayPrompts.length,
      }, null, 2));
      return;
    }

    const cases = [];
    for (const sample of replayPrompts) {
      const result = await page.evaluate(({ prompt, studentId }) => window.omniEdu.runDeepTutorConsole({
        prompt,
        studentId,
        timeRange: 'last30',
        knowledgeScope: 'teacher',
      }), { prompt: sample.prompt, studentId: student.id });

      assert.equal(result.ok, true, result.errorMessage || `${sample.id} should succeed`);
      assert.ok(result.structuredReply, `${sample.id} should return structured reply`);
      assert.equal(result.harness?.schemaValid, true, `${sample.id} should pass structured schema`);
      assert.equal(result.harness?.educationGrade?.passed, true, `${sample.id} should pass education grader`);
      assert.equal(result.harness?.usabilityGrade?.passed, true, `${sample.id} should pass usability grader`);
      assert.ok((result.harness?.usabilityGrade?.score ?? 0) >= 75, `${sample.id} usability score should meet baseline`);
      assert.equal(result.harness?.router?.route, sample.expectedRoute, `${sample.id} route should match expectation`);
      assert.equal(result.harness?.selectedCapability, sample.expectedCapability, `${sample.id} capability should match the route`);
      assert.match(result.harness?.harnessVersion ?? '', /^xiazhi\.agent-harness\.v\d+$/, `${sample.id} should expose the Agent Harness version`);
      assert.ok(Array.isArray(result.harness?.trace) && result.harness.trace.length >= 4, `${sample.id} should expose loop trace`);

      cases.push({
        id: sample.id,
        ok: result.ok,
        runId: result.harness?.agentRunId ?? '',
        route: result.harness.router.route,
        subIntent: result.harness.router.subIntent,
        schemaValid: result.harness.schemaValid,
        educationScore: result.harness.educationGrade.score,
        usabilityScore: result.harness.usabilityGrade.score,
        responseLength: result.content.length,
        totalTokens: result.usage?.totalTokens ?? null,
      });
    }

    console.log(JSON.stringify({
      ok: true,
      skipped: false,
      model: savedSettings.model,
      sampleCount: cases.length,
      cases,
    }, null, 2));
  } catch (error) {
    throw new Error([
      error instanceof Error ? error.message : String(error),
      launchOutput.length ? `Electron output:\n${launchOutput.join('\n')}` : 'Electron produced no captured output.',
    ].join('\n'));
  } finally {
    await app?.close().catch(() => undefined);
    if (ownsDataRoot) rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
