import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { captureWorkspaceMetrics } from './capture-workspace-metrics.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(desktop, 'test-results/xiaozhi-agent/pi-composer-layout-'));
const source = path.join(output, 'teacher-skill'), title = '五年级分数加法教研会议纪要整理与资料来源复核办公技能';
fs.mkdirSync(source);
fs.writeFileSync(path.join(source, 'SKILL.md'), `---\nname: layout-review\ndescription: 整理合成的教研办公纪要。\n---\n# ${title}\n先核对资料来源，再整理会议纪要；最终结果等待教师确认。\n`);
const report = { success: false, checks: [], boundary: 'Formal Electron with owned fresh data/profile; actual original Skills import/enable/picker and DOM geometry. No model completion claim from this layout suite.' };
let app, page;
const check = name => { report.checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
try {
  const env = { ...process.env, OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_DATA_ROOT: path.join(output, 'data'), OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..') };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  app = await electron.launch({ args: [path.join(desktop, 'out/main/index.js'), `--user-data-dir=${path.join(output, 'profile')}`], env, timeout: 60000 });
  page = await app.firstWindow();
  await page.getByTestId('office-conversation').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
  await page.getByTestId('pi-skills-open').click();
  await page.getByTestId('pi-skills-settings').waitFor({ state: 'visible' });
  await app.evaluate(({ dialog }, source) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] }); }, source);
  await page.getByTestId('pi-skill-import').click();
  await page.getByTestId('pi-managed-skill-layout-review').waitFor({ state: 'visible' });
  const control = page.getByRole('switch', { name: `启用技能：${title}`, exact: true });
  assert(!await control.isChecked());
  await page.getByTestId('pi-skill-enabled-layout-review').locator('[data-slot="switch-content"]').click();
  await page.waitForFunction(async () => (await window.omniEdu.getXiaozhiSkills()).value.skills.some(item => item.name === 'layout-review' && item.enabled));
  await page.getByTestId('pi-skills-close').click();
  await page.getByTestId('pi-skill-picker').click();
  await page.getByRole('menuitemradio', { name: title, exact: true }).click();
  assert((await page.getByTestId('pi-skill-badge').innerText()).includes(title));
  check('Long title is selected through actual imported-disabled then teacher-enabled Skills UI');
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    const metrics = await captureWorkspaceMetrics(page, app, output, `selected-${width}x${height}`);
    const shell = metrics.renderer.regions.composerShell.rect, buttons = metrics.renderer.toolbarButtons;
    assert(buttons.length >= 6);
    for (const button of buttons) assert(button.rect.x >= shell.x && button.rect.x + button.rect.width <= shell.x + shell.width + 1, button.name);
    assert(Math.max(...buttons.map(button => button.rect.y)) - Math.min(...buttons.map(button => button.rect.y)) <= 6);
    check(`Selected long skill, permission, model, preview and send remain inside one row at ${width}x${height}`);
    await page.getByTestId('pi-skill-view').click();
    assert((await page.getByTestId('pi-skill-preview').innerText()).includes(title));
    await page.getByRole('button', { name: '关闭说明', exact: true }).click();
    await page.getByTestId('pi-skill-picker').click();
    assert(await page.getByRole('menuitemradio', { name: title, exact: true }).isVisible());
    await page.getByRole('menuitemradio', { name: title, exact: true }).click();
    check(`Condensed picker still exposes full selected title and real preview at ${width}x${height}`);
  }
  // Open the existing real file panel to exercise the narrower reading region.
  await page.setViewportSize({ width: 1366, height: 768 });
  const draft = '尚未发送的教研纪要草稿，切换文件面板后应保留。';
  await page.getByTestId('office-prompt-input').fill(draft);
  await page.getByTestId('pi-files-toggle').click();
  await page.getByTestId('pi-file-panel').waitFor({ state: 'visible' });
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(), draft);
  assert((await page.getByTestId('pi-skill-badge').innerText()).includes(title));
  const narrow = await captureWorkspaceMetrics(page, app, output, 'selected-with-files-1366x768');
  const shell = narrow.renderer.regions.composerShell.rect;
  for (const button of narrow.renderer.toolbarButtons) assert(button.rect.x >= shell.x && button.rect.x + button.rect.width <= shell.x + shell.width + 1, button.name);
  const send = await page.getByRole('button', { name: '发送消息', exact: true }).boundingBox();
  assert(send && send.y + send.height <= 768);
  check('Actual file-panel split safely wraps narrow controls and retains the send button');
  await page.getByTestId('pi-files-close').click();
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(), draft);
  assert((await page.getByTestId('pi-skill-badge').innerText()).includes(title));
  check('Opening and closing the real file split retain the same unsent draft and selected skill');
  await page.getByRole('button', { name: '移除所选技能', exact: true }).click();
  assert(!await page.getByTestId('pi-skill-badge').isVisible());
  check('Removing the selected skill restores the normal composer');
  const prior = await page.locator('.office-composer-container').getAttribute('data-session-id');
  await page.getByTestId('ai-conversation-new').click();
  await page.waitForFunction(id => document.querySelector('.office-composer-container')?.getAttribute('data-session-id') !== id, prior);
  assert.equal(await page.getByTestId('office-prompt-input').inputValue(), '');
  assert(!await page.getByTestId('pi-skill-badge').isVisible());
  check('Starting a different actual conversation clears ephemeral input and skill selection');
  report.success = true;
} catch (error) {
  process.exitCode = 1; report.error = String(error.stack || error).slice(0, 3000);
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  await app?.close().catch(() => {});
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ success: report.success, checks: report.checks.length, error: report.error, report: path.relative(desktop, path.join(output, 'report.json')) }));
}
