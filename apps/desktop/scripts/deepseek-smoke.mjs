import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-deepseek-'));

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      reason: 'Set DEEPSEEK_API_KEY in the current shell to run the live DeepSeek smoke test.',
    }, null, 2));
    return;
  }

  let app;
  try {
    app = await electron.launch({
      args: [join(appRoot, 'out/main/index.js')],
      env: {
        ...process.env,
        OMNI_EDU_DATA_ROOT: dataRoot,
      },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => Boolean(window.omniEdu));

    const bootstrap = await page.evaluate(() => window.omniEdu.bootstrap());
    const student = bootstrap.students[0];
    assert.ok(student?.id, 'seed student should exist');

    const savedSettings = await page.evaluate(
      ({ apiKey, model }) => window.omniEdu.saveDeepSeekSettings({ apiKey, model }),
      {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      },
    );
    assert.equal(savedSettings.configured, true, 'DeepSeek settings should be saved');

    const result = await page.evaluate((studentId) => window.omniEdu.runDeepSeek({
      prompt: 'Please summarize the current student learning records in three concise Chinese sentences.',
      studentId,
      timeRange: 'last30',
      knowledgeScope: 'teacher',
    }), student.id);

    assert.equal(result.ok, true, result.errorMessage || 'DeepSeek call should succeed');
    assert.ok(result.content.length > 20, 'DeepSeek response should include content');
    assert.ok(result.sources.length >= 3, 'sources should be returned');
    assert.ok(result.toolRuns.length >= 3, 'tool runs should be returned');

    console.log(JSON.stringify({
      ok: true,
      model: result.model,
      responseLength: result.content.length,
      sourceCount: result.sources.length,
      toolRunCount: result.toolRuns.length,
      totalTokens: result.usage?.totalTokens ?? null,
    }, null, 2));
  } finally {
    await app?.close().catch(() => undefined);
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    rmSync(dataRoot, { recursive: true, force: true });
  });
