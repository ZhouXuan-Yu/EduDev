import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-usability-review-ui-'));

async function run() {
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

    await page.getByRole('button', { name: '设置' }).click();
    const panel = page.getByTestId('ai-usability-review-panel');
    await assertVisible(panel, 'human review panel should be visible');
    await assertVisible(page.getByTestId('ai-model-grader-panel'), 'model grader panel should be visible');

    const form = page.getByTestId('ai-usability-review-form');
    await form.locator('input[placeholder="teacher_review_001"]').fill('ui_review_manual_001');
    await form.locator('textarea[placeholder="老师真实问小智的问题"]').fill('请看小A最近错题，给我今天能用的补救建议。');
    await form.locator('input[type="number"]').nth(0).fill('5');
    await form.locator('input[type="number"]').nth(1).fill('1');
    await form.locator('textarea[placeholder="老师为什么给这个分数，哪里需要改"]').fill('UI smoke：这条样本可直接使用。');
    await page.getByTestId('save-ai-usability-review').click();

    await page.waitForFunction(async () => {
      const summary = await window.omniEdu?.getAiUsabilityReviewSummary();
      return summary?.sampleCount === 1 && summary.averageTeacherScore === 5;
    });

    const csv = [
      'sampleId,prompt,route,subIntent,teacherScore,needsRewrite,roundsToUseful,mainIssueCode,teacherNote',
      'ui_review_csv_002,小智刚才回答太长，帮我回放失败样本,workspace_help,usage_help,2,true,3,too_long,需要重写',
    ].join('\n');
    const csvImport = page.getByTestId('ai-usability-csv-import');
    await csvImport.locator('textarea').fill(csv);
    await page.getByTestId('import-ai-usability-csv').click();

    await page.waitForFunction(async () => {
      const summary = await window.omniEdu?.getAiUsabilityReviewSummary();
      return summary?.sampleCount === 2 && summary.needsRewriteCount === 1;
    });

    const failureReplay = page.getByTestId('ai-usability-failure-replay');
    await assertVisible(failureReplay.getByText('ui_review_csv_002'), 'CSV failure sample should be listed');
    await failureReplay.getByRole('button', { name: '回放到 AI 输入' }).click();
    await page.waitForFunction(() => {
      const textarea = document.querySelector('textarea');
      return textarea?.value.includes('小智刚才回答太长');
    });

    await page.getByRole('button', { name: '设置' }).click();
    const refreshedFailureReplay = page.getByTestId('ai-usability-failure-replay');
    await refreshedFailureReplay.getByTestId('select-replay-before').first().click();
    await assertVisible(page.getByTestId('selected-replay-before'), 'selected before sample should be visible');
    await form.locator('input[placeholder="teacher_review_001"]').fill('ui_review_csv_002_after');
    await form.locator('input[type="number"]').nth(0).fill('5');
    await form.locator('input[type="number"]').nth(1).fill('1');
    await form.locator('input[placeholder="none / evidence_gap / too_long"]').fill('none');
    await form.locator('textarea[placeholder="老师为什么给这个分数，哪里需要改"]').fill('UI smoke：改造后能直接进入操作，不再让老师手动切模块。');
    await page.getByTestId('save-ai-usability-review').click();

    await page.waitForFunction(async () => {
      const summary = await window.omniEdu?.getAiUsabilityReplaySummary();
      return summary?.experimentCount === 1 && summary.improvedCount === 1 && summary.averageScoreDelta === 3;
    });
    await assertVisible(page.getByTestId('ai-usability-replay-experiments').getByText('已改善'), 'replay experiment should be listed');

    const summary = await page.evaluate(() => window.omniEdu?.getAiUsabilityReviewSummary());
    const reviews = await page.evaluate(() => window.omniEdu?.listAiUsabilityReviews(10));
    const replaySummary = await page.evaluate(() => window.omniEdu?.getAiUsabilityReplaySummary());
    const replayExperiments = await page.evaluate(() => window.omniEdu?.listAiUsabilityReplayExperiments(10));
    assert.equal(summary.sampleCount, 3);
    assert.equal(summary.averageTeacherScore, 4);
    assert.equal(summary.needsRewriteCount, 1);
    assert.equal(reviews.length, 3);
    assert.equal(replaySummary.experimentCount, 1);
    assert.equal(replaySummary.improvedCount, 1);
    assert.equal(replayExperiments.length, 1);
    assert.equal(replayExperiments[0].scoreDelta, 3);

    console.log(JSON.stringify({
      ok: true,
      sampleCount: summary.sampleCount,
      averageTeacherScore: summary.averageTeacherScore,
      needsRewriteCount: summary.needsRewriteCount,
      replayExperimentCount: replaySummary.experimentCount,
      replayAverageScoreDelta: replaySummary.averageScoreDelta,
      replayPromptReady: true,
    }, null, 2));
  } finally {
    await app?.close().catch(() => undefined);
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

async function assertVisible(locator, message) {
  await locator.waitFor({ state: 'visible', timeout: 10000 }).catch((error) => {
    throw new Error(`${message}: ${error.message}`);
  });
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
