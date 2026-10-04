import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-workspace-'));
const artifactRoot = join(appRoot, 'test-results', 'electron-e2e');
mkdirSync(artifactRoot, { recursive: true });
let app;
try {
  app = await electron.launch({
    args: [join(appRoot, 'out/main/index.js')],
    env: { ...process.env, DEEPSEEK_API_KEY: '', OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_E2E_DIALOG_MODE: '1' },
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.omniEdu));
  if (await page.getByTestId('nav-ai').isVisible()) await page.getByTestId('nav-ai').click();
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.getByTestId('ai-conversation-sidebar').waitFor({ state: 'visible' });
    await page.getByTestId('ai-run-inspector').waitFor({ state: 'visible' });
    const bounds = await page.evaluate(() => {
      const box = (selector) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width } : null;
      };
      return { sidebar: box('[data-testid="ai-conversation-sidebar"]'), chat: box('.ai-chat-surface'), inspector: box('[data-testid="ai-run-inspector"]'), composer: box('[data-testid="ai-prompt-input"]'), viewport: { width: innerWidth, height: innerHeight } };
    });
    assert.ok(bounds.sidebar && bounds.chat && bounds.inspector && bounds.composer);
    assert.ok(bounds.sidebar.right <= bounds.chat.left + 1, 'sidebar should precede chat');
    assert.ok(bounds.chat.right <= bounds.inspector.left + 1, 'inspector should follow chat');
    assert.ok(bounds.composer.bottom <= height && bounds.composer.top > height / 2, 'composer should remain reachable near the bottom');
    assert.ok(bounds.chat.width >= 540, 'reading column should remain usable');
    await page.screenshot({ path: join(artifactRoot, `xiaozhi-chat-${width}x${height}.png`), fullPage: true });
    if (width === 1366) {
      await page.getByTestId('ai-prompt-input').fill('你好');
      await page.getByRole('button', { name: '运行 DeepSeek' }).click();
      assert.equal(await page.getByTestId('ai-prompt-input').inputValue(), '', 'clicking send must clear the controlled composer immediately');
      await page.getByTestId('ai-output-error').waitFor({ state: 'visible' });
      assert.equal(await page.getByTestId('ai-prompt-input').inputValue(), '', 'failed provider request must not restore submitted text');
      assert.equal(await page.locator('[data-slot="chat-message-user"]').count(), 1, 'clicking send must append the user turn only once');
      assert.match(await page.getByTestId('ai-output-error').textContent(), /DeepSeek|配置|API Key/);
      await page.getByTestId('ai-prompt-input').fill('您好');
      await page.getByTestId('ai-prompt-input').press('Enter');
      await page.getByText('您好', { exact: true }).waitFor({ state: 'visible' });
      assert.equal(await page.getByTestId('ai-prompt-input').inputValue(), '', 'pressing Enter must clear the composer');
    }
  }
  await page.getByTestId('ai-return-workspace').click();
  await page.getByTestId('nav-ai').waitFor({ state: 'visible' });
  await page.getByTestId('nav-ai').click();
  await page.getByRole('button', { name: '检查模型设置' }).first().click();
  await page.getByTestId('nav-settings').waitFor({ state: 'visible' });
  console.log(JSON.stringify({ suite: 'xiaozhi-chat-workspace', passed: true, viewports: ['1366x768', '1920x1080'], checks: 'three columns, reachable composer, send/Enter clears input, single user turn, error feedback, workspace return, settings link' }));
} finally {
  await app?.close().catch(() => undefined);
  rmSync(dataRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}
