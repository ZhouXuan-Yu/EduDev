import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Focused Electron coverage for the knowledge search box and the local vector
// index panel. It is a separate script on purpose: the full electron smoke also
// runs OCR (onnxruntime) and multiple restarts, and on memory-constrained
// machines the two runs must not have to coexist.
const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-knowledge-search-'));
const sourceRoot = mkdtempSync(join(tmpdir(), 'omni-edu-knowledge-search-src-'));
const artifactRoot = join(appRoot, 'test-results', 'electron-e2e');
mkdirSync(artifactRoot, { recursive: true });

const teachingNotePath = join(sourceRoot, 'vector-search-note.md');
writeFileSync(
  teachingNotePath,
  ['# 一次函数讲义', '', '斜率表示纵向变化量与横向变化量之比，可用于描述变化快慢。', '', '## 易错点', '', '学生常把截距与斜率对图像的影响混在一起。'].join('\n'),
  'utf8',
);

async function run() {
  let app;
  try {
    app = await electron.launch({
      args: [join(appRoot, 'out/main/index.js')],
      env: {
        ...process.env,
        OMNI_EDU_DATA_ROOT: dataRoot,
        OMNI_EDU_REPO_ROOT: dirname(dirname(appRoot)),
      },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => Boolean(window.omniEdu));

    await page.getByTestId('nav-knowledge').click();
    await page.getByTestId('knowledge-resource-panel').waitFor({ state: 'visible' });
    await page.getByTestId('knowledge-resource-empty').waitFor({ state: 'visible' });

    const imported = await page.evaluate((filePath) => window.omniEdu.importKnowledgeResourcePaths([filePath]), teachingNotePath);
    assert.equal(imported.status, 'succeeded', 'markdown import must succeed');
    await page.getByTestId('knowledge-resource-refresh').click();
    await page.getByTestId(`knowledge-resource-status-${imported.resources[0].id}`).waitFor({ state: 'visible', timeout: 30_000 });

    await page.getByTestId('knowledge-search-input').fill('斜率');
    await page.getByTestId('knowledge-search-submit').click();
    await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="knowledge-search-results"]')), undefined, { timeout: 60_000 });
    assert.ok(await page.locator('[data-testid^="knowledge-search-hit-"]').count() >= 1, 'knowledge search must return local keyword hits from the teacher UI');
    const keywordHitCount = await page.locator('[data-testid^="knowledge-search-hit-"]').count();
    await page.screenshot({ path: join(artifactRoot, 'frontend-knowledge-search-1366x768.png'), fullPage: true });

    await page.getByTestId('knowledge-search-input').fill('绝对不存在的资料检索词-9f2a');
    await page.getByTestId('knowledge-search-submit').click();
    await page.getByTestId('knowledge-search-empty').waitFor({ state: 'visible', timeout: 60_000 });

    await page.getByTestId('nav-settings').click();
    await page.getByTestId('vector-index-panel').waitFor({ state: 'visible' });
    await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="vector-index-availability"]')?.textContent), undefined, { timeout: 60_000 });
    const availabilityText = await page.getByTestId('vector-index-availability').textContent();
    const status = await page.evaluate(() => window.omniEdu.getVectorIndexStatus());
    assert.equal(status.indexedCount, 0, 'a fresh data root must not claim indexed vectors');
    assert.equal(status.pendingChunks > 0, true, 'imported chunks must be pending for the vector index');
    if (status.available) {
      assert.match(availabilityText ?? '', /模型可用/, 'available model must be reported truthfully');
      assert.match(status.model, /bge-small-zh/, 'vector panel must name the local embedding model');
      assert.equal(status.dims, 512, 'vector panel must report the embedding dimensions');
      assert.equal(await page.getByTestId('vector-index-build').isDisabled(), false, 'build must be enabled when the model is available');
      assert.match(await page.getByTestId('vector-index-pending').textContent(), /待索引 [1-9]/, 'pending chunk count must be visible');
    } else {
      assert.match(availabilityText ?? '', /降级关键词检索/, 'unavailable model must disclose the keyword degradation path');
      assert.equal(await page.getByTestId('vector-index-build').isDisabled(), true, 'build must be disabled without the model');
    }
    await page.screenshot({ path: join(artifactRoot, 'frontend-vector-index-1366x768.png'), fullPage: true });

    console.log(JSON.stringify({
      ok: true,
      importedResources: imported.resources.length,
      keywordHits: keywordHitCount,
      vectorAvailable: status.available,
      vectorModel: status.model,
      vectorDims: status.dims,
      pendingChunks: status.pendingChunks,
      degradedDisclosure: !status.available,
    }, null, 2));
  } finally {
    await app?.close().catch(() => undefined);
    rmSync(sourceRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        rmSync(dataRoot, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 7) console.error(`cleanup warning: could not remove ${dataRoot}`);
        else await new Promise((resolveWait) => setTimeout(resolveWait, 250));
      }
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
