import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-live-'));
const provider = process.env.OMNI_EDU_LIVE_PROVIDER === 'glm' ? 'glm' : 'deepseek';
const providerName = provider === 'glm' ? 'GLM' : 'DeepSeek';
let app;
try {
  app = await electron.launch({
    args: [join(appRoot, 'out/main/index.js')],
    cwd: appRoot,
    env: { ...process.env, OMNI_EDU_DATA_ROOT: dataRoot },
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.omniEdu));
  if (provider === 'glm') {
    await page.getByTestId('ai-return-workspace').click();
    await page.getByTestId('nav-settings').click();
    await page.getByTestId('ai-provider-select').selectOption('glm');
    await page.getByTestId('ai-provider-save').click();
  }
  const settings = await page.evaluate(() => window.omniEdu.getDeepSeekSettings());
  assert.equal(settings.provider, provider);
  assert.equal(settings.configured, true, 'live test requires a key in ignored .env.local or runtime settings');
  if (await page.getByTestId('nav-ai').isVisible()) await page.getByTestId('nav-ai').click();
  await page.getByTestId('ai-prompt-input').fill('你好');
  await page.getByRole('button', { name: `运行 ${providerName}` }).click();
  assert.equal(await page.getByTestId('ai-prompt-input').inputValue(), '');
  const outcome = await Promise.race([
    page.getByTestId('ai-output-error').waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'error'),
    page.getByTestId('ai-output-success').waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'success'),
  ]);
  const visibleText = await page.getByTestId(`ai-output-${outcome}`).first().textContent();
  assert.doesNotMatch(visibleText ?? '', /TypeError: fetch failed/);
  assert.equal(await page.getByTestId('ai-prompt-input').inputValue(), '');
  await page.getByTestId('ai-prompt-input').fill('请为教师设计一段错题练习建议');
  await page.getByRole('button', { name: `运行 ${providerName}` }).click();
  assert.equal(await page.getByTestId('ai-prompt-input').inputValue(), '');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="ai-output-error"], [data-testid="ai-output-success"]').length >= 2, undefined, { timeout: 130_000 });
  const structuredOutput = page.locator('[data-testid="ai-output-error"], [data-testid="ai-output-success"]').last();
  const structuredText = await structuredOutput.textContent();
  const structuredOutcome = await structuredOutput.getAttribute('data-testid');
  assert.doesNotMatch(structuredText ?? '', /TypeError: fetch failed/);
  if (provider === 'glm') {
    assert.equal(outcome, 'success', 'GLM direct path must return a real reply');
    assert.equal(structuredOutcome, 'ai-output-success', 'GLM structured path must return a real reply');
  }
  console.log(JSON.stringify({ suite: 'xiaozhi-live-connectivity', provider, direct: { outcome, visibleText: (visibleText ?? '').slice(0, 240) }, structured: { outcome: structuredOutcome, visibleText: (structuredText ?? '').slice(0, 240) }, composerCleared: true }));
} finally {
  await app?.close().catch(() => undefined);
  rmSync(dataRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}
