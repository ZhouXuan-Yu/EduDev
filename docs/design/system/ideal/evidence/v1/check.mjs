import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const require = createRequire(new URL('../../../../apps/desktop/package.json', import.meta.url));
const { chromium } = require('playwright');
const root = import.meta.dirname, output = path.join(root, 'evidence');
fs.mkdirSync(output, { recursive: true });
const report = { success: false, layer: 'offline_design_prototype_not_production_or_official_react', checks: [], errors: [], requests: [], screenshots: [] };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.on('pageerror', error => report.errors.push(String(error)));
page.on('request', request => { if (!request.url().startsWith('file:')) report.requests.push(request.url()); });
page.on('dialog', dialog => dialog.accept());
const check = async (name, run) => { await run(); report.checks.push(name); console.log('PASS ' + name); };
const screenshot = async name => {
  await page.locator('#toast').evaluate(node => { node.hidden = true; });
  await page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' });
  report.screenshots.push(name + '.png');
};
const route = async name => { await page.locator(`[data-route="${name}"]`).click(); };
const fits = async selector => {
  const box = await page.locator(selector).boundingBox(), viewport = page.viewportSize();
  assert(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, selector + ' outside viewport: ' + JSON.stringify(box));
};
try {
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await check('Fresh chat: input first, right pane closed, lightweight task actions', async () => {
    assert(await page.locator('#context').isHidden());
    assert.equal(await page.locator('.home-shortcuts button').count(), 3);
    await fits('#composer'); await fits('.sidebar-footer');
    assert.equal(await page.locator('.home-shortcuts').evaluate(el => getComputedStyle(el).display), 'flex');
  });
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 768 });
    for (const name of ['chat', 'library', 'teaching', 'students', 'settings']) {
      await check(`${name} viewport ${width}`, async () => {
        await route(name); await fits('.workspace-header'); await fits('.sidebar-footer');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await screenshot(`${name}-${width}`);
      });
    }
  }
  await check('Teaching five subpages, editor and unsaved-state feedback', async () => {
    await route('teaching');
    for (const tab of ['教学文件', '备课本', '讲义', '题本', '组卷']) {
      await page.locator(`[data-teaching-tab="${tab}"]`).click();
      assert.equal(await page.locator(`[data-teaching-tab="${tab}"]`).getAttribute('aria-selected'), 'true');
      await screenshot('teaching-' + tab);
    }
    await page.locator('[data-resource="0"]').click();
    await page.locator('#editor-text').fill('演示编辑');
    assert((await page.locator('#editor-status').innerText()).includes('未保存'));
    await page.locator('[data-action="save-edit"]').click();
    assert((await page.locator('#editor-status').innerText()).includes('非正式文件'));
    await screenshot('paper-editor');
  });
  await check('Library source disclosure, correction form, and search empty state', async () => {
    await route('library'); await page.locator('[data-resource="0"]').click();
    assert.equal(await page.locator('.question-row details').getAttribute('open'), null);
    await page.locator('.question-row summary').click();
    await screenshot('library-detail');
    await page.locator('[data-action="correct-question"]').click();
    assert(await page.locator('#modal').isVisible()); await page.keyboard.press('Escape');
    await route('library'); await page.locator('#resource-search').fill('no-such-resource');
    assert(await page.locator('#resource-empty').isVisible());
  });
  await check('Student context across six tabs, add/search record and switch student', async () => {
    await route('students'); await page.locator('[data-student="sample-a"]').click();
    for (const tab of ['档案', '学习记录', '错题与练习', '学习计划', '学习复盘', '学习概览']) {
      await page.locator(`[data-student-tab="${tab}"]`).click();
      assert.equal(await page.locator('#student-tab-content').getAttribute('data-student-id'), 'sample-a');
      await screenshot('student-' + tab);
    }
    await page.locator('[data-student-tab="学习记录"]').click();
    await page.locator('[data-action="add-record"]').click();
    await page.locator('[name="title"]').fill('测试观察'); await page.locator('[name="content"]').fill('仅当前学生的演示记录');
    await page.locator('#design-form button[type="submit"]').click();
    assert((await page.locator('.timeline').innerText()).includes('测试观察'));
    await page.locator('[data-student="sample-b"]').click();
    assert(!(await page.locator('.timeline').innerText()).includes('测试观察'));
  });
  await check('Library category, search and sort compose without losing the active filter', async () => {
    await route('library'); await page.locator('#resource-search').fill('');
    await page.locator('[data-library-filter="教材"]').click();
    await page.locator('#resource-search').fill('浮力');
    assert.equal(await page.locator('[data-resource-row]:visible').count(), 1);
    await page.locator('#library-sort').selectOption('按名称');
    assert.equal(await page.locator('#library-sort').inputValue(), '按名称');
    assert.equal(await page.locator('[data-resource-row]:visible').count(), 1);
    await page.locator('[data-library-filter="归档"]').click();
    assert(await page.locator('#resource-empty').isVisible());
    await page.locator('[data-library-filter="全部资料"]').click(); await page.locator('#resource-search').fill('');
  });
  await check('Settings daily/advanced groups, preference retention, no real credential input', async () => {
    await route('settings'); assert(await page.locator('#advanced-nav').isHidden());
    assert(await page.locator('[aria-label="密钥演示占位"]').isDisabled());
    await page.locator('#advanced-toggle').focus(); await page.keyboard.press('Enter');
    for (const tab of ['界面偏好', '资料与权限', '备份与归档', '教育技能', '外部工具', '策略与诊断']) {
      await page.locator(`[data-settings-tab="${tab}"]`).click(); await screenshot('settings-' + tab);
    }
    await page.locator('[data-settings-tab="界面偏好"]').click();
    await page.locator('[data-setting="阅读密度"]').selectOption('紧凑');
    await route('chat'); await route('settings');
    assert.equal(await page.locator('[data-setting="阅读密度"]').inputValue(), '紧凑');
  });
  await check('IME guard, newline, draft preservation and explicit task streaming', async () => {
    await route('chat'); await page.locator('#prompt').fill('保留的教师草稿');
    await page.locator('[data-prompt]').first().click(); assert.equal(await page.locator('#prompt').inputValue(), '保留的教师草稿');
    await page.locator('#attach').click();
    await route('library'); await route('chat'); assert.equal(await page.locator('#prompt').inputValue(), '保留的教师草稿');
    assert(await page.locator('#attachment-preview').isVisible()); await page.locator('#remove-attachment').click();
    await page.locator('#prompt').dispatchEvent('compositionstart'); await page.locator('#prompt').press('Enter');
    assert.equal(await page.locator('.chat-page').getAttribute('data-scene'), 'home');
    await page.locator('#prompt').dispatchEvent('compositionend');
    await page.locator('#prompt').press('Shift+Enter'); assert((await page.locator('#prompt').inputValue()).includes('\n'));
    await page.locator('#send').click();
    assert.equal(await page.locator('#process-trigger').getAttribute('aria-expanded'), 'true');
    assert(await page.locator('#context').isHidden());
    await page.waitForFunction(() => document.querySelector('.tool-entry'));
    await screenshot('chat-running');
    await page.waitForFunction(() => document.querySelectorAll('.tool-entry').length === 3);
    await screenshot('chat-running-tools');
    await page.waitForFunction(() => document.querySelector('#process-trigger')?.getAttribute('aria-expanded') === 'false');
    await page.locator('#answer-rest').waitFor({ state: 'visible' });
    assert(await page.locator('#process-body').isHidden());
    assert(await page.locator('#answer').isVisible()); await screenshot('chat-completed');
    await page.locator('#process-trigger').click(); assert(await page.locator('#process-body').isVisible());
    await page.locator('#process-trigger').click();
  });
  await check('File notification does not open panel; explicit preview and Escape restore focus', async () => {
    assert(await page.locator('#context').isHidden()); await page.locator('#attention').click();
    assert(await page.locator('#context').isVisible());
    await page.locator('[data-preview="1"]').click(); await page.locator('#slide-next').click();
    assert.equal(await page.locator('#slide-number').innerText(), '2 / 6'); await screenshot('ppt-preview');
    await page.locator('[data-action="export-preview"]').click();
    assert.equal(await page.locator('[name="name"]').inputValue(), '浮力与密度课件.pptx');
    await screenshot('export-dialog'); await page.keyboard.press('Escape');
    await page.keyboard.press('Escape'); assert(await page.locator('#context').isHidden());
    assert.equal(await page.evaluate(() => document.activeElement.id), 'attention');
  });
  await check('Failure, stop and approval are distinct; approval is visible inline', async () => {
    for (const scene of ['failed', 'stopped', 'approval']) {
      await page.locator('#scene').selectOption(scene);
      assert(await page.locator('#context').isHidden()); await screenshot('chat-' + scene);
    }
    await page.locator('#reject').click(); assert((await page.locator('.approval-card').innerText()).includes('没有写入'));
    await page.locator('#scene').selectOption('running'); await page.locator('#send').click();
    assert.equal(await page.locator('.chat-page').getAttribute('data-scene'), 'stopped');
  });
  await check('Search dialog, page directory and collapsed navigation keyboard access', async () => {
    await page.locator('#search-chat').click(); await page.locator('#history-query').fill('not-found');
    assert(await page.locator('#search-empty').isVisible()); await page.keyboard.press('Escape');
    await page.locator('#guide-button').click(); assert.equal(await page.locator('[data-guide-route]').count(), 16);
    await page.keyboard.press('Escape'); await page.locator('#collapse').click();
    assert.equal(await page.locator('#collapse').getAttribute('aria-expanded'), 'false');
    await screenshot('navigation-rail');
    await page.locator('#collapse').click();
  });
  await check('Backup and restore have scope, validation, impact confirmation and cancel states', async () => {
    await route('settings'); await page.locator('[data-settings-tab="备份与归档"]').click();
    await page.locator('[data-action="backup"]').click(); await screenshot('backup-dialog');
    await page.locator('#backup-start').click(); assert((await page.locator('#modal').innerText()).includes('没有生成真实备份文件'));
    await page.keyboard.press('Escape'); await page.locator('[data-action="restore"]').click();
    assert(await page.locator('#restore-confirm').isDisabled()); await page.locator('#restore-check').click();
    assert(await page.locator('#restore-confirm').isEnabled()); await screenshot('restore-checked');
    await page.locator('#restore-confirm').click(); assert(await page.locator('.check-line input').isVisible());
    await screenshot('restore-confirmation'); await page.keyboard.press('Escape');
    await page.locator('#advanced-toggle').click();
    if (await page.locator('#advanced-nav').isHidden()) await page.locator('#advanced-toggle').click();
    await page.locator('[data-settings-tab="外部工具"]').click(); await page.locator('[data-action="add-tool"]').click();
    await page.locator('[name="name"]').fill('演示连接'); await page.locator('[name="url"]').fill('https://example.invalid');
    await page.locator('#design-form button[type="submit"]').click(); assert((await page.locator('.record-row').innerText()).includes('未连接'));
  });
  for (const width of [840, 700, 911]) {
    await check(`Responsive viewport ${width}, primary controls reachable`, async () => {
      await page.setViewportSize({ width, height: width === 911 ? 512 : 768 });
      await route('chat'); await page.locator('#scene').selectOption('home');
      await fits('#composer'); await fits('#send'); await fits('.sidebar-footer');
      await page.locator('#panel-toggle').click(); await fits('#context'); await page.keyboard.press('Escape');
      for (const name of ['chat', 'library', 'teaching', 'students', 'settings']) {
        await route(name); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await route('chat'); await screenshot(`chat-${width}`);
    });
  }
  await check('Reduced motion and visible keyboard focus', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.locator('#prompt').focus(); await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none');
    assert.equal(await page.locator('#send').evaluate(node => getComputedStyle(node).transitionDuration), '0s');
  });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.requests, []); report.success = true;
} catch (error) {
  report.error = String(error.stack || error); process.exitCode = 1;
  await screenshot('failure').catch(() => {});
} finally {
  await browser.close();
  report.hashes = Object.fromEntries(fs.readdirSync(root).filter(file => /\.(html|css|js|mjs)$/.test(file)).map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
  report.viewportBoundary = 'CSS viewports only; 911x512 approximates reduced CSS area at 150%, not native Windows scaling.';
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ success: report.success, checks: report.checks.length, error: report.error, output }));
}
