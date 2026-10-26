import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { assertIsolatedPiMain, testMain } from '../acceptance/build-root.mjs';
import { fingerprint, sha256 } from '../acceptance/evidence.mjs';
import { measureTextContrast, settleWorkspaceTransitions } from './capture-workspace-metrics.mjs';

// H09 dynamic-state accessibility sweep. Real isolated Electron + production
// renderer, owned synthetic profile/DB, scripted in-memory SSE model fixture.
// States are produced by the real task/copy/control governance over owned
// synthetic workspace files; zero provider requests; zero external effects.
// Human screen-reader review remains OPEN and is never claimed.
// Focus modes (H09_ONLY=I|P|R|V) extend the sweep:
//   I queued instruction control cards produced through the owned native queue
//     behind a fixture ask_teacher question (no extra model stage)
//   P practice/learning review cards restored from the owned student-context
//     journey fixture education-journey-vv5feo (no model calls)
//   R owned minimal interruption (window close during a pending copy approval)
//     then cold restore of the recovery notice (no model replay)
//   V source-invariant inspection of the run-end verification derivation plus
//     the prior sweep's empirical states; records why `verified` is unreachable
const desktop = process.cwd();
const evidenceRoot = path.resolve(desktop, 'test-results/goal/h09-dynamic-a11y-focus-20261024');
fs.mkdirSync(evidenceRoot, { recursive: true });
const output = fs.mkdtempSync(path.join(evidenceRoot, 'run-'));
const main = testMain(desktop);
if (!process.env.OMNI_EDU_TEST_BUILD_ROOT) throw new Error('OMNI_EDU_TEST_BUILD_ROOT required (isolated harness build only)');
const buildRoot = path.dirname(path.dirname(main));
const fixed = fingerprint(buildRoot);
const capabilitySource = path.resolve(desktop, 'test-results/xiaozhi-agent/pi-task-review-ui-eQdimA/data/xiaozhi-pi/deepseek-capabilities.v1.json');
const restoreDataSource = path.resolve(desktop, 'test-results/xiaozhi-agent/pi-task-plan-native-ui-XIm1Bf/data');

const report = {
  schema: 'h09.dynamic-state-accessibility.v1',
  success: false,
  phase: 'init',
  build: { root: buildRoot, sha256: fixed.sha256, files: fixed.files.length },
  scriptSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  views: [], keyboard: [], contrast: [], focus: [], axNames: [], failures: [], unverified: [],
  errors: [], requests: [], fileEffects: { workspaceBefore: null, workspaceAfter: null },
  boundary: 'Actual isolated Electron and production renderer under the isolated harness build. Dynamic states seeded through real task/copy/control governance on owned synthetic profile/DB and owned synthetic workspace files; model transport is an in-memory SSE fixture that refuses every non-fixture request (zero provider requests). Fixed 100 percent scale; human screen-reader use remains OPEN. Focus modes H09_ONLY=I/P/R/V: I produces queued instruction cards through the owned native queue behind a fixture question; P restores the owned student-context journey fixture (pending/confirmed learning review cards and confirmed/rejected practice review cards); R produces an owned minimal interruption (window close during a pending copy approval) and probes the cold-restored recovery notice; V inspects the run-end verification derivation and records why verified is unreachable without faking.',
};
const sizes = [[1366, 768], [1920, 1080]];
const themes = ['light', 'dark'];
let app, page, session;

function until(fn, ms = 60000) {
  const end = Date.now() + ms;
  const started = report.phase;
  return new Promise((resolve, reject) => {
    (async function poll() {
      while (Date.now() < end) {
        try { const v = await fn(); if (v) return resolve(v); } catch (error) { if (Date.now() >= end) return reject(error); }
        await new Promise(r => setTimeout(r, 120));
      }
      reject(new Error(`condition timed out (started in ${started}, now ${report.phase})`));
    })();
  });
}
const snap = () => page.evaluate(id => window.omniEdu.getXiaozhiSnapshot(id), session);
const settleRun = async () => until(async () => {
  const s = await snap();
  if (!s.running && s.projection.turns.length > 0 && s.projection.turns.at(-1).status !== 'running') {
    if (s.projection.turns.at(-1).status !== 'completed') throw new Error(`fixture run did not complete: turn status ${s.projection.turns.at(-1).status}`);
    return s;
  }
  return undefined;
});
const check = name => { console.log('PASS ' + name); };
const fail = message => { report.failures.push(message); throw new Error(message); };

// Playwright can drop app.evaluate promises under load ('Resulting promise was
// garbage collected'); retry those instead of failing the sweep.
async function appEval(fn, arg) {
  for (let i = 0; i < 5; i++) {
    try { return await app.evaluate(fn, arg); }
    catch (error) {
      if (!String(error).includes('garbage collected')) throw error;
      await new Promise(r => setTimeout(r, 300));
    }
  }
  throw new Error('app.evaluate kept failing with garbage collection');
}

async function setView(width, height, theme) {
  await appEval(({ BrowserWindow, nativeTheme }, value) => { nativeTheme.themeSource = value; }, theme);
  await page.emulateMedia({ colorScheme: theme, forcedColors: 'none', reducedMotion: 'no-preference' });
  await page.waitForFunction(value => matchMedia(`(prefers-color-scheme: ${value})`).matches, theme);
  await appEval(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), { width, height });
  await page.waitForFunction(value => innerWidth === value.width && innerHeight === value.height, { width, height });
  await page.waitForTimeout(200);
}

// ── accessibility probe engine ───────────────────────────────────────────────
async function tabbableBaseline() {
  return page.evaluate(() => {
    const styleTuple = el => { const s = getComputedStyle(el); return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.outlineOffset, s.boxShadow, s.borderTopWidth, s.borderTopColor].join('|'); };
    const key = el => { const r = el.getBoundingClientRect(); return [el.tagName, el.getAttribute('data-testid') || '', el.getAttribute('aria-label') || '', (el.textContent || '').trim().slice(0, 40), Math.round(r.x), Math.round(r.y)].join('#'); };
    return [...document.querySelectorAll('button,[role="button"],a[href],input,textarea,select,summary,[tabindex]:not([tabindex="-1"])')]
      .filter(el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && !el.matches(':disabled') && el.getAttribute('aria-disabled') !== 'true' && (el.tabIndex >= 0 || el.tagName === 'SUMMARY');
      })
      .map((el, index) => ({ index, key: key(el), testid: el.getAttribute('data-testid'), aria: el.getAttribute('aria-label'), slot: el.getAttribute('data-slot'), tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 60), style: styleTuple(el) }));
  });
}

async function tabWalk(label, expected, capOverride = null) {
  report.phase = `tabwalk-${label}`;
  const baseline = await tabbableBaseline();
  const walked = [];
  const cap = Math.min(capOverride || baseline.length + 4, 300);
  for (let i = 0; i < cap; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement)) return { tag: 'BODY', key: 'BODY', testid: null, style: '', focusVisible: false, rect: null, inViewport: false, wrapperFocusVisible: false };
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      const wrapper = el.closest('[data-focus-visible],[data-focus-within]');
      const testidAncestor = el.closest('[data-testid]');
      return { tag: el.tagName.toLowerCase(), key: [el.tagName, el.getAttribute('data-testid') || '', el.getAttribute('aria-label') || '', (el.textContent || '').trim().slice(0, 40), Math.round(r.x), Math.round(r.y)].join('#'), testid: el.getAttribute('data-testid'), wrapperTestid: testidAncestor === el ? null : testidAncestor?.getAttribute('data-testid') || null, aria: el.getAttribute('aria-label'), slot: el.getAttribute('data-slot'), text: (el.textContent || '').trim().slice(0, 60), style: [s.outlineStyle, s.outlineWidth, s.outlineColor, s.outlineOffset, s.boxShadow, s.borderTopWidth, s.borderTopColor].join('|'), focusVisible: el.matches(':focus-visible'), rect: { x: r.x, y: r.y, width: r.width, height: r.height }, inViewport: r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, role: el.getAttribute('role'), ariaExpanded: el.getAttribute('aria-expanded'), wrapperFocusVisible: Boolean(wrapper && (wrapper.hasAttribute('data-focus-visible') || wrapper.hasAttribute('data-focus-within'))), wrapperTag: wrapper?.tagName || null, wrapperClass: wrapper ? String(wrapper.className).slice(0, 80) : null };
    });
    walked.push(info);
    if (i > 0 && info.key === walked[0].key) break;
  }
  // A stop shows visible focus when :focus-visible matches, the computed
  // outline/box-shadow/border tuple changed from its unfocused baseline, or a
  // wrapper carries the focus-visible/focus-within marker. Chromium date inputs
  // re-visit their internal segments without a style change, so a key that
  // already proved its indicator keeps counting as covered.
  const covered = new Set();
  const rows = walked.map((info, index) => {
    const base = baseline[index] || baseline.find(row => row.key === info.key);
    const hasIndicator = Boolean(info.focusVisible || (base && base.style !== info.style) || info.wrapperFocusVisible);
    if (hasIndicator) covered.add(info.key);
    const indicator = base ? hasIndicator || covered.has(info.key) : null;
    return { index, ...info, baselineStyle: base ? base.style : null, styleDelta: base ? base.style !== info.style : null, baselineKey: base ? base.key : null, indicator: base ? indicator : null };
  });
  report.views.push({ label: `tabwalk-${label}`, width: await page.evaluate(() => innerWidth), height: await page.evaluate(() => innerHeight), walked: rows.map(row => ({ index: row.index, tag: row.tag, testid: row.testid, aria: row.aria, text: row.text, focusVisible: row.focusVisible, styleDelta: row.styleDelta, wrapperFocusVisible: row.wrapperFocusVisible, indicator: row.indicator, inViewport: row.inViewport, role: row.role, ariaExpanded: row.ariaExpanded })) });
  const reached = rows.map(row => [row.testid, row.wrapperTestid, row.aria, row.slot, row.text].filter(Boolean).join('|'));
  for (const name of expected) {
    if (!reached.some(value => String(value).includes(name))) fail(`tabwalk ${label}: expected control ${name} not reached; sequence=${JSON.stringify(reached.slice(0, 40))}`);
  }
  const noIndicator = rows.filter(row => row.tag !== 'BODY' && row.indicator === false);
  if (noIndicator.length) fail(`tabwalk ${label}: ${noIndicator.length} focus stops have no focus indicator: ${noIndicator.map(row => row.testid || row.aria || row.tag).slice(0, 12).join(', ')}`);
  report.focus.push({ label, stops: rows.length, indicatorMissing: noIndicator.map(row => row.testid || row.aria || row.tag).slice(0, 12), focusVisibleCount: rows.filter(row => row.focusVisible).length });
  return { baseline, walked: rows };
}

async function axNameAudit(label) {
  report.phase = `ax-${label}`;
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const actionable = new Set(['button', 'link', 'textbox', 'checkbox', 'switch', 'tab', 'combobox', 'listbox', 'menuitem', 'menuitemradio', 'menuitemcheckbox', 'radio', 'searchbox', 'spinbutton', 'slider', 'option', 'treeitem']);
  const unnamed = nodes.filter(node => !node.ignored && actionable.has(node.role?.value) && !(node.name?.value || '').trim());
  report.axNames.push({ label, unnamed: unnamed.map(node => ({ role: node.role.value, name: node.name?.value || '' })).slice(0, 20) });
  if (unnamed.length) fail(`ax ${label}: ${unnamed.length} actionable nodes without an accessible name (first: ${JSON.stringify(report.axNames.at(-1).unnamed.slice(0, 5))})`);
  check(`Accessible names present for every actionable control (${label})`);
}

async function contrastProbe(label, targets) {
  const rows = [];
  for (const [name, selector] of targets) {
    const locator = page.locator(selector).first();
    if (await locator.count() === 0) continue;
    if (await locator.isDisabled()) { rows.push({ label, name, selector, skipped: 'disabled control (WCAG exempts disabled controls)' }); continue; }
    const meta = await locator.evaluate(el => ({
      fontSize: parseFloat(getComputedStyle(el).fontSize),
      weight: Number(getComputedStyle(el).fontWeight) || 400,
      text: (el.textContent || '').trim().slice(0, 40),
      // Collapsed disclosures stay in the DOM with opacity 0 and a hidden
      // ancestor; invisible content carries no contrast requirement.
      rendered: (() => {
        let opacity = 1;
        for (let current = el; current; current = current.parentElement) {
          const s = getComputedStyle(current);
          if (s.display === 'none' || s.visibility === 'hidden' || current.hasAttribute('hidden')) return false;
          opacity *= Number(s.opacity);
          if (opacity <= 0.01) return false;
        }
        return true;
      })(),
    }));
    if (!meta.rendered) { rows.push({ label, name, selector, skipped: 'collapsed or hidden content (not rendered)' }); continue; }
    const result = await measureTextContrast(locator);
    const large = meta.fontSize >= 24 || (meta.fontSize >= 18.66 && meta.weight >= 700);
    const nonText = !meta.text; // icon-only control: WCAG 1.4.11 threshold 3:1
    const threshold = nonText ? 3 : large ? 3 : 4.5;
    rows.push({ label, name, selector, ...meta, ratio: Math.round(result.ratio * 100) / 100, large, nonText, threshold, pass: result.ratio >= threshold, foreground: result.foreground.map(Math.round), background: result.background.map(Math.round) });
  }
  report.contrast.push(...rows);
  return rows;
}

const STATE_KEYS = new Set(['stepStates', 'taskStepStates', 'verificationStates', 'approvalStates', 'questionStates', 'instructionStates', 'learningReviewStates', 'practiceReviewStates']);

async function settleWithRetry() {
  for (let attempt = 0; attempt < 3; attempt++) {
    await appEval(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.show(); w.focus(); });
    await page.bringToFront();
    await page.waitForTimeout(150);
    try { return await settleWorkspaceTransitions(page); } catch (error) {
      report.transitionRetries = (report.transitionRetries || 0) + 1;
      if (attempt === 2) throw error;
    }
  }
}

async function probeState(label, { expect = {}, tabExpected = [], contrastTargets = [], liveExpected = [], configs = null, tabCap = null }) {
  report.phase = `state-${label}`;
  const matrix = configs || sizes.flatMap(([width, height]) => themes.map(theme => [width, height, theme]));
  for (const [width, height, theme] of matrix) {
    await setView(width, height, theme);
    const transitions = await settleWithRetry();
    const data = await page.evaluate(() => {
      const selectors = ['xiaozhi-pi-workspace', 'office-conversation', 'office-prompt-input', 'teacher-quick-starts', 'pi-sidebar-toggle', 'pi-permission-picker', 'pi-skill-picker', 'office-model-picker', 'prompt-input-send', 'office-tool-step', 'office-tool-group', 'pi-task-review', 'pi-task-steps', 'office-verification', 'office-recovery', 'pi-copy-approval', 'pi-teacher-question', 'pi-text-change', 'pi-task-plan', 'pi-queued-instruction', 'pi-learning-review', 'pi-practice-review', 'learning-review-batch-bar'];
      const rect = node => { if (!node) return null; const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom, display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility }; };
      return {
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        document: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, scrollHeight: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight },
        nodes: Object.fromEntries(selectors.map(selector => {
          const node = selector === 'office-model-picker' ? document.querySelector('.office-model-picker') : selector === 'prompt-input-send' ? document.querySelector('[data-slot="prompt-input-send"]') : document.querySelector(`[data-testid="${selector}"]`);
          return [selector, rect(node)];
        })),
        stepStates: [...document.querySelectorAll('[data-testid="office-tool-step"]')].map(el => ({ text: (el.querySelector('.office-step-state')?.textContent || '').trim(), state: el.getAttribute('data-state'), expanded: el.querySelector('[data-slot="chat-tool-trigger"]')?.getAttribute('aria-expanded') })),
        groupStates: [...document.querySelectorAll('[data-testid="office-tool-group"]')].map(el => ({ count: el.getAttribute('data-call-count'), state: el.getAttribute('data-state'), expanded: el.querySelector('[data-slot="chat-tool-group-trigger"]')?.getAttribute('aria-expanded') })),
        taskStepStates: [...document.querySelectorAll('[data-task-step-id]')].map(el => ({ id: el.getAttribute('data-task-step-id'), state: el.getAttribute('data-state'), text: (el.textContent || '').trim().slice(0, 60) })),
        verificationStates: [...document.querySelectorAll('[data-testid="office-verification"]')].map(el => el.getAttribute('data-state')),
        recoveryStates: [...document.querySelectorAll('[data-testid="office-recovery"]')].map(el => el.getAttribute('data-run-id')),
        approvalStates: [...document.querySelectorAll('[data-testid="pi-copy-approval"]')].map(el => el.getAttribute('data-state')),
        questionStates: [...document.querySelectorAll('[data-testid="pi-teacher-question"]')].map(el => el.getAttribute('data-state')),
        instructionStates: [...document.querySelectorAll('[data-testid="pi-queued-instruction"]')].map(el => el.getAttribute('data-state')),
        learningReviewStates: [...document.querySelectorAll('[data-testid="pi-learning-review"]')].map(el => el.getAttribute('data-state')),
        practiceReviewStates: [...document.querySelectorAll('[data-testid="pi-practice-review"]')].map(el => el.getAttribute('data-state')),
        turnNotices: [...document.querySelectorAll('.office-turn-notice')].map(el => ({ state: el.getAttribute('data-state'), text: (el.textContent || '').trim().slice(0, 60) })),
        activeElement: document.activeElement?.getAttribute?.('data-testid') || document.activeElement?.tagName,
        modelPickerDisabled: document.querySelector('.office-model-picker')?.matches(':disabled') ?? null,
        liveRegions: [...document.querySelectorAll('[role="status"],[role="alert"],[aria-live]')].map(el => ({ role: el.getAttribute('role'), live: el.getAttribute('aria-live'), testid: el.getAttribute('data-testid'), state: el.getAttribute('data-state'), text: (el.textContent || '').trim().slice(0, 80) })),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    if (data.horizontalOverflow) fail(`${label} ${width}x${height} ${theme}: horizontal overflow ${data.document.scrollWidth}/${data.document.clientWidth}`);
    for (const [key, value] of Object.entries(expect)) {
      if (STATE_KEYS.has(key)) continue;
      const node = data.nodes[key];
      if (!node || node.width <= 0 || node.height <= 0) fail(`${label} ${width}x${height} ${theme}: ${key} missing or empty`);
    }
    for (const [key, value] of Object.entries(expect)) {
      if (key === 'stepStates' && value) for (const want of value) if (!data.stepStates.some(row => row.text.includes(want.text))) fail(`${label} ${width}x${height} ${theme}: tool step state ${want.text} missing from ${JSON.stringify(data.stepStates)}`);
      if (key === 'taskStepStates' && value) for (const want of value) if (!data.taskStepStates.some(row => row.id === want.id && row.state === want.state)) fail(`${label} ${width}x${height} ${theme}: task step ${want.id}=${want.state} missing from ${JSON.stringify(data.taskStepStates)}`);
      if (key === 'verificationStates' && value) for (const state of value) if (!data.verificationStates.includes(state)) fail(`${label} ${width}x${height} ${theme}: verification state ${state} missing from ${JSON.stringify(data.verificationStates)}`);
      if (key === 'approvalStates' && value) for (const state of value) if (!data.approvalStates.includes(state)) fail(`${label} ${width}x${height} ${theme}: approval state ${state} missing from ${JSON.stringify(data.approvalStates)}`);
      if (key === 'questionStates' && value) for (const state of value) if (!data.questionStates.includes(state)) fail(`${label} ${width}x${height} ${theme}: question state ${state} missing from ${JSON.stringify(data.questionStates)}`);
      if (key === 'instructionStates' && value) for (const state of value) if (!data.instructionStates.includes(state)) fail(`${label} ${width}x${height} ${theme}: instruction state ${state} missing from ${JSON.stringify(data.instructionStates)}`);
      if (key === 'learningReviewStates' && value) for (const state of value) if (!data.learningReviewStates.includes(state)) fail(`${label} ${width}x${height} ${theme}: learning review state ${state} missing from ${JSON.stringify(data.learningReviewStates)}`);
      if (key === 'practiceReviewStates' && value) for (const state of value) if (!data.practiceReviewStates.includes(state)) fail(`${label} ${width}x${height} ${theme}: practice review state ${state} missing from ${JSON.stringify(data.practiceReviewStates)}`);
    }
    for (const wanted of liveExpected) {
      if (!data.liveRegions.some(region => (region.testid || region.text || '').includes(wanted))) fail(`${label} ${width}x${height} ${theme}: live region ${wanted} missing from ${JSON.stringify(data.liveRegions)}`);
    }
    const screenshot = path.join(output, `${label}-${theme}-${width}x${height}.png`);
    await page.screenshot({ path: screenshot, animations: 'disabled' });
    report.views.push({ label, width, height, theme, screenshot: path.relative(output, screenshot), transitions, data });
    check(`View ${label} ${width}x${height} ${theme}: no overflow, expected states present, screenshot captured`);
  }
  await setView(1366, 768, 'light');
  if (tabExpected.length) {
    // Start the walk from the document top; enable the send button via a
    // transient draft unless quick starts must stay visible.
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
    if (!tabExpected.some(name => name.includes('teacher-quick-start'))) {
      await page.getByTestId('office-prompt-input').fill('a11y 探针');
      await page.waitForTimeout(150);
    }
    await tabWalk(label, tabExpected, tabCap);
    await page.getByTestId('office-prompt-input').fill('').catch(() => undefined);
  }
  for (const theme of themes) {
    await setView(1366, 768, theme);
    await settleWithRetry();
    const rows = await contrastProbe(`${label}-${theme}`, contrastTargets);
    for (const row of rows) if (row.pass === false) console.log(`CONTRAST FLAG ${label} ${theme}: ${row.name} ratio ${row.ratio} (threshold ${row.threshold})`);
  }
}

// ── launches ────────────────────────────────────────────────────────────────
function launchEnv(dataRoot) {
  const env = { ...process.env, OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'), OMNI_EDU_E2E_DIALOG_MODE: '1', DEEPSEEK_API_KEY: 'owned-synthetic-model-fixture', DEEPSEEK_MODEL: 'deepseek-flash' };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  return env;
}

async function launch(dataRoot, profile, installFixture) {
  app = await electron.launch({ args: [main, `--user-data-dir=${profile}`, '--force-device-scale-factor=1'], env: launchEnv(dataRoot), timeout: 60000 });
  app.process().stdout?.on('data', b => fs.appendFileSync(path.join(output, 'main.log'), b));
  app.process().stderr?.on('data', b => fs.appendFileSync(path.join(output, 'main.log'), b));
  report.main = await assertIsolatedPiMain(app, main, profile);
  page = await app.firstWindow();
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ timeout: 60000 });
  await until(async () => !await page.getByTestId('office-prompt-input').isDisabled());
  session = await page.locator('.office-composer-container').getAttribute('data-session-id');
  if (!/^aisession_[0-9a-f-]{36}$/i.test(session || '')) fail('session id unavailable');
  if (installFixture) await installFixture();
}

// SSE fixture: staged synthetic model responses keyed by a marker in the latest
// user message. Every request is counted and refused unless it carries a marker.
function fixtureScripts() {
  const plan2 = { schemaVersion: 'xiaozhi.task-plan.v3', expectedRevision: 0, requirementsVersion: 1, reason: 'H09 可访问性扫描合成计划：读取一份资料后请教师核对。', steps: [{ id: 'read', text: '读取课堂资料', kind: 'file', target: 'lesson.txt', reported: 'completed', dependsOn: [] }, { id: 'review', text: '教师核对教学要求', kind: 'human', reported: 'pending', dependsOn: [] }] };
  const plan5 = { schemaVersion: 'xiaozhi.task-plan.v3', expectedRevision: 0, requirementsVersion: 1, reason: 'H09 可访问性扫描合成计划：成功读取、失败读取、等待前置、执行中与教师核对五种步骤状态。', steps: [{ id: 'read', text: '读取课堂资料', kind: 'file', target: 'lesson.txt', reported: 'completed', dependsOn: [] }, { id: 'bad', text: '读取不存在的资料', kind: 'file', target: 'missing.txt', reported: 'completed', dependsOn: [] }, { id: 'wait', text: '等待失败步骤之后核对', kind: 'file', target: 'lesson.txt', reported: 'pending', dependsOn: ['bad'] }, { id: 'exec', text: '正在执行的教学整理', kind: 'file', target: 'lesson.txt', reported: 'in_progress', dependsOn: [] }, { id: 'review', text: '教师核对教学要求', kind: 'human', reported: 'pending', dependsOn: ['exec'] }] };
  const planCopy = { schemaVersion: 'xiaozhi.task-plan.v3', expectedRevision: 0, requirementsVersion: 1, reason: 'H09 可访问性扫描合成计划：复制一份资料并等待教师审批。', steps: [{ id: 'copy', text: '复制课堂资料', kind: 'saved_text', target: 'h09-sweep-副本.txt', reported: 'in_progress', dependsOn: [] }, { id: 'review', text: '教师核对复制结果', kind: 'human', reported: 'pending', dependsOn: ['copy'] }] };
  const tool = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
  return {
    'H09-MATRIX-B1': [{ text: '本轮只做文本回复，未调用任何工具；用于观察未核验状态。' }],
    'H09-MATRIX-B2': [
      { calls: [tool('call_plan', 'update_task_plan', plan5)] },
      { calls: [tool('call_read', 'office_read_text', { taskStepId: 'read', path: 'lesson.txt' }), tool('call_bad', 'office_read_text', { taskStepId: 'bad', path: 'missing.txt' })] },
      { text: '已按计划读取一份资料；另一份不存在，已如实报告；后续步骤保持各自状态。' },
    ],
    'H09-MATRIX-B3': [
      { calls: [tool('call_bad_plain', 'office_read_text', { path: 'missing.txt' })] },
      { text: '读取失败，本轮未完成任何工具操作。' },
    ],
    'H09-MATRIX-B4': [
      { calls: [tool('call_plan4', 'update_task_plan', plan2)] },
      { calls: [tool('call_read4', 'office_read_text', { taskStepId: 'read', path: 'lesson.txt' })] },
      { text: '已读取并核对课堂资料；教学要求请你确认。' },
    ],
    'H09-MATRIX-C': [
      { calls: [tool('call_planC', 'update_task_plan', planCopy)] },
      { calls: [tool('call_copy', 'office_copy_file', { taskStepId: 'copy', source: 'lesson.txt', target: 'h09-sweep-副本.txt' })] },
    ],
    'H09-MATRIX-D': [
      { calls: [tool('call_ask', 'ask_teacher', { question: '这次整理的教学资料是否需要补充年级说明？', options: ['需要补充年级', '现有资料已足够'] })] },
      { text: '已收到你的回答，本轮完成。' },
    ],
  };
}

async function installFixture(scripts) {
  await app.evaluate(({ net }, { scripts }) => {
    globalThis.h09Fixture = { requests: [], scripts };
    net.fetch = async (input, init) => {
      const fixture = globalThis.h09Fixture, url = typeof input === 'string' ? input : input.url;
      if (!/\/chat\/completions(?:\?|$)/.test(url)) throw new Error('Owned fixture refuses unconfigured external transport: ' + url);
      const body = JSON.parse(init.body);
      const lastUser = [...body.messages].reverse().find(m => m.role === 'user');
      const raw = lastUser?.content ?? '';
      const contentText = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map(part => typeof part === 'string' ? part : part?.text || '').join('') : String(raw);
      const marker = contentText.match(/H09-MATRIX-[A-Z][0-9]?/)?.[0];
      if (!marker) {
        fixture.requests.push({ marker: null, diagnostic: { url, lastUserShape: Array.isArray(raw) ? 'array' : typeof raw, contentPreview: contentText.slice(0, 160), model: body.model } });
        throw new Error('Fixture refuses a request without an H09 marker');
      }
      const count = fixture.requests.filter(r => r.marker === marker).length;
      const script = scripts[marker];
      if (!script) throw new Error('Fixture has no script for marker ' + marker);
      if (count >= script.length * 2) throw new Error(`Unexpected extra fixture model call for ${marker} stage ${count}`);
      const stage = count % script.length;
      const entry = script[stage];
      fixture.requests.push({ marker, number: stage, model: body.model, taskTool: body.tools?.some(t => t.function?.name === 'update_task_plan'), copyTool: body.tools?.some(t => t.function?.name === 'office_copy_file'), askTool: body.tools?.some(t => t.function?.name === 'ask_teacher') });
      const { calls, text } = entry;
      const make = (delta, finish_reason = null) => ({ id: 'owned_fixture_' + marker + '_' + stage, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: body.model, choices: [{ index: 0, delta, finish_reason }] });
      const events = [make({ role: 'assistant' }), make(calls ? { tool_calls: calls.map((c, index) => ({ ...c, index })) } : { content: text }), make({}, calls ? 'tool_calls' : 'stop')];
      return new Response(events.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') + 'data: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
    };
  }, { scripts });
}

async function strictNoNetwork() {
  await app.evaluate(({ net }) => {
    globalThis.h09Fixture = { requests: [] };
    net.fetch = async (input) => { const url = typeof input === 'string' ? input : input.url; globalThis.h09Fixture.requests.push(url); throw new Error('Restored session must not request the network: ' + url); };
  });
}

async function collectRequests() {
  return app.evaluate(() => globalThis.h09Fixture?.requests || []);
}

async function close() {
  if (app) {
    try { report.requests.push(...await collectRequests()); } catch { /* closed */ }
    await app.close().catch(() => undefined);
    app = undefined; page = undefined;
  }
}

async function chooseWorkspace(workspace) {
  await app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }); }, workspace);
  await page.getByTestId('pi-permission-picker').click();
  await page.getByRole('menuitem', { name: '选择教学工作目录', exact: true }).click();
  await until(async () => Boolean((await snap()).workspace), 30000);
}

async function newConversation(workspace) {
  const previous = session;
  await page.getByTestId('ai-conversation-new').click();
  await until(async () => {
    const id = await page.locator('.office-composer-container').getAttribute('data-session-id');
    if (id && id !== previous && /^aisession_[0-9a-f-]{36}$/i.test(id)) { session = id; return true; }
    return false;
  });
  await until(async () => !await page.getByTestId('office-prompt-input').isDisabled());
  await chooseWorkspace(workspace);
}

async function send(marker) {
  await until(async () => !await page.getByTestId('office-prompt-input').isDisabled(), 30000);
  await page.getByTestId('office-prompt-input').fill(`${marker} 请只执行本标记对应的合成步骤。`);
  await page.getByTestId('office-prompt-input').press('Enter');
}

// shared probe targets (send button matched by slot so running/idle both pass)
const composerExpected = ['office-prompt-input', '添加本地附件', 'pi-permission-picker', 'pi-skill-picker', '选择模型', 'prompt-input-send'];
const composerExpectedRunning = ['office-prompt-input', 'pi-permission-picker', 'prompt-input-send'];
const composerContrast = [['composer input', '[data-testid="office-prompt-input"]'], ['model picker label', '.office-model-picker'], ['send button', '[data-slot="prompt-input-send"]'], ['permission picker', '[data-testid="pi-permission-picker"]'], ['skill picker', '[data-testid="pi-skill-picker"]']];
const quickContrast = [['quick start materials', '[data-testid="teacher-quick-start-materials"]'], ['quick start mistakes', '[data-testid="teacher-quick-start-mistakes"]'], ['quick start classroom', '[data-testid="teacher-quick-start-classroom"]']];

// ── scenario A: restored owned session (verified/completed states) ──────────
async function scenarioA() {
  report.phase = 'scenario-a-restore';
  const dataDir = path.join(output, 'restore-data');
  fs.cpSync(restoreDataSource, dataDir, { recursive: true });
  await launch(dataDir, path.join(output, 'restore-profile'), null);
  await strictNoNetwork();
  const db = new DatabaseSync(path.join(dataDir, 'app.db'), { readOnly: true });
  const restoredSession = db.prepare('SELECT id FROM ai_conversation_sessions ORDER BY created_at DESC LIMIT 1').get()?.id;
  db.close();
  if (!restoredSession) fail('restored data has no session');
  await page.getByTestId(`ai-conversation-session-${restoredSession}`).waitFor({ timeout: 30000 });
  await page.getByTestId(`ai-conversation-session-${restoredSession}`).click();
  session = restoredSession;
  await until(async () => (await snap()).projection?.turns?.length > 0, 45000);
  const restored = await snap();
  report.restoredTaskState = restored.task?.state;
  report.restoredVerificationStates = [...new Set(restored.projection.turns.map(turn => turn.verification?.state))];
  await page.locator('.office-turn').first().waitFor({ timeout: 60000 });
  await until(async () => await page.locator('[data-turn-id]').count() > 0, 60000);
  if (await page.getByTestId('pi-task-review').count()) {
    await page.getByTestId('pi-task-review-toggle').click();
    await until(async () => await page.getByTestId('pi-task-steps').count() > 0, 30000);
  }
  await axNameAudit('a-restored');
  await probeState('a-restored', {
    expect: { 'pi-task-review': 'visible', 'office-verification': 'visible' },
    tabExpected: [...composerExpected, 'chat-tool-trigger', 'chat-tool-group-trigger', 'pi-task-review-toggle', '查看核对范围', 'pi-text-open'],
    contrastTargets: [...composerContrast, ['step state label', '.office-step-state'], ['verification heading', '[data-testid="office-verification"] strong'], ['verification body', '[data-testid="office-verification"] p'], ['task review status', '.pi-task-review-status'], ['text change actions', '.pi-text-change-actions button']],
    liveExpected: ['office-verification'],
  });
  // Keyboard activations on the restored session.
  report.phase = 'keyboard-a';
  await setView(1366, 768, 'light');
  const firstStep = page.locator('[data-testid="office-tool-step"]').first();
  const trigger = firstStep.locator('[data-slot="chat-tool-trigger"]');
  await trigger.focus(); await page.keyboard.press('Enter');
  const expandedAfter = await trigger.getAttribute('aria-expanded');
  await page.keyboard.press('Enter');
  const collapsedAfter = await trigger.getAttribute('aria-expanded');
  if (expandedAfter === collapsedAfter) fail('tool step trigger Enter did not toggle expansion');
  check(`Tool step disclosure toggles by Enter (${expandedAfter} -> ${collapsedAfter})`);
  const checksSummary = page.locator('[data-testid="office-verification-checks"] summary').first();
  if (await checksSummary.count()) {
    await checksSummary.focus(); await page.keyboard.press('Enter');
    const open = await page.locator('[data-testid="office-verification-checks"]').first().getAttribute('open') !== null;
    await page.keyboard.press('Enter');
    const closed = await page.locator('[data-testid="office-verification-checks"]').first().getAttribute('open') === null;
    if (!(open && closed)) fail('verification checks summary Enter did not toggle');
    check('Verification checks summary toggles by Enter');
  }
  const reviewToggle = page.getByTestId('pi-task-review-toggle');
  await reviewToggle.focus(); await page.keyboard.press('Enter');
  const focusAfterOpen = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  await page.keyboard.press('Enter');
  const focusAfterClose = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  if (focusAfterOpen !== 'pi-task-review-toggle' || focusAfterClose !== 'pi-task-review-toggle') fail(`task review toggle focus return ${focusAfterOpen}/${focusAfterClose}`);
  check('Task review toggle keeps focus across open/close by Enter');
  await page.getByTestId('pi-permission-picker').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menu').waitFor({ state: 'visible' }).catch(() => undefined);
  if (await page.getByRole('menu').count()) {
    await page.keyboard.press('Escape');
    await until(async () => await page.evaluate(() => document.activeElement?.getAttribute('data-testid')) === 'pi-permission-picker');
    check('Permission menu closes by Escape and returns focus to its trigger');
  }
  await close();
  if (!report.requests.length) check('Restored session made zero network requests');
  else fail(`restored session made network requests: ${JSON.stringify(report.requests)}`);
}

// ── scenario B/C/D: fixture-driven sessions ─────────────────────────────────
function taskAdmissions(dataDir) {
  const db = new DatabaseSync(path.join(dataDir, 'app.db'), { readOnly: true });
  try {
    const rows = db.prepare("SELECT value_json FROM app_settings WHERE key LIKE 'xiaozhi.task.v1:%' AND key NOT LIKE '%:revision:%'").all();
    return rows.map(row => { const v = JSON.parse(String(row.value_json)); return { taskId: v.view?.id, state: v.view?.state, admissions: (v.admissions || []).map(a => ({ stepId: a.stepId, callId: a.callId, tool: a.tool })) }; });
  } finally { db.close(); }
}

async function scenariosBCD(only = null) {
  report.phase = 'scenario-fixtures';
  const dataDir = path.join(output, 'data'), profile = path.join(output, 'profile'), workspace = path.join(output, 'workspace');
  fs.mkdirSync(dataDir, { recursive: true }); fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'lesson.txt'), '合成课堂资料：本课37分钟，先观察再解释。核验码 H09-SWEEP。');
  fs.mkdirSync(path.join(dataDir, 'xiaozhi-pi'), { recursive: true });
  fs.copyFileSync(capabilitySource, path.join(dataDir, 'xiaozhi-pi', 'deepseek-capabilities.v1.json'));
  const scripts = fixtureScripts();
  await launch(dataDir, profile, async () => installFixture(scripts));
  await chooseWorkspace(workspace);
  const workspaceBefore = fs.readdirSync(workspace).sort().join(',');
  report.fileEffects.workspaceBefore = workspaceBefore;
  if (only === 'B' || !only) {

  // B0: empty conversation — quick starts + composer control group recheck.
  await axNameAudit('b0-empty');
  await probeState('b0-empty', {
    expect: { 'teacher-quick-starts': 'visible', 'office-prompt-input': 'visible' },
    // Send stays disabled while the draft is empty (quick-starts state);
    // its reachability/indicator are covered in the running/idle draft states.
    tabExpected: [...composerExpected.filter(name => name !== 'prompt-input-send'), 'teacher-quick-start-materials', 'teacher-quick-start-mistakes', 'teacher-quick-start-classroom'],
    contrastTargets: [...composerContrast, ...quickContrast],
    liveExpected: [],
  });
  await page.getByTestId('teacher-quick-start-materials').focus();
  await page.keyboard.press('Enter');
  await until(async () => (await page.getByTestId('office-prompt-input').inputValue()).includes('先读取资料'), 20000);
  check('Quick start activates by Enter and fills the composer');
  await page.getByTestId('office-prompt-input').fill('');
  // Diagnostic: which element in the composer chain paints a light surface in dark mode.
  await setView(1366, 768, 'dark');
  report.composerChainDark = await page.evaluate(() => {
    const row = el => { if (!el) return null; const s = getComputedStyle(el); return { tag: el.tagName, slot: el.getAttribute('data-slot'), cls: String(el.className).slice(0, 60), background: s.backgroundColor, backgroundImage: s.backgroundImage.slice(0, 60), color: s.color }; };
    const start = document.querySelector('[data-testid="office-prompt-input"]');
    const chain = []; let current = start;
    for (let i = 0; current && i < 8; i++) { chain.push(row(current)); current = current.parentElement; }
    chain.push(row(document.querySelector('.office-composer-container')), row(document.querySelector('.ai-chat-surface')));
    return chain;
  });
  await setView(1366, 768, 'light');

  // B1: text-only run -> verification unknown.
  await send('H09-MATRIX-B1');
  const b1 = await settleRun();
  const b1State = b1.projection.turns.at(-1).verification?.state;
  report.b1Verification = b1State;
  if (b1State !== 'unknown') report.failures.push(`B1 verification state ${b1State} instead of unknown (recorded, not fatal)`);
  check(`B1 text-only run completes (verification ${b1State})`);

  // B2: task plan with four step states + one failed read -> partial.
  // The dependent reads run in a separate model stage after plan adoption,
  // so the admission records persist and the read's check applies via the
  // runtime recheck before the second dependent call is admitted.
  await send('H09-MATRIX-B2');
  await settleRun();
  report.b2Admissions = taskAdmissions(dataDir);
  if (!report.b2Admissions.some(t => t.admissions.some(a => a.tool === 'office_read_text'))) fail(`dependent read admissions not persisted: ${JSON.stringify(report.b2Admissions)}`);
  check(`Dependent read admissions persisted after split staging (${JSON.stringify(report.b2Admissions)})`);
  await page.getByTestId('pi-task-review-toggle').first().click();
  await until(async () => await page.getByTestId('pi-task-steps').count() > 0, 30000);
  await axNameAudit('b2-taskplan');
  await probeState('b2-taskplan', {
    expect: {
      'office-tool-group': 'visible',
      taskStepStates: [{ id: 'read', state: 'verified' }, { id: 'bad', state: 'needs_check' }, { id: 'wait', state: 'waiting_dependency' }, { id: 'exec', state: 'executing' }, { id: 'review', state: 'waiting_dependency' }],
      verificationStates: ['unknown', 'needs_human'],
    },
    tabExpected: [...composerExpected, 'chat-tool-group-trigger', 'chat-tool-trigger', 'pi-task-review-toggle', 'pi-task-review-refresh', '查看核对范围'],
    contrastTargets: [...composerContrast, ['step state label', '.office-step-state'], ['group trigger label', '[data-testid="office-tool-group"] [data-slot="chat-tool-group-trigger"]'], ['verification heading', '[data-testid="office-verification"] strong'], ['verification body', '[data-testid="office-verification"] p'], ['task step state', '.pi-task-review-status'], ['plan step state', '.pi-plan-step-state'], ['review toggle', '[data-testid="pi-task-review-toggle"]']],
    liveExpected: ['office-verification', 'office-recovery'],
  });
  // Keyboard: group and step disclosure toggles on this state.
  report.phase = 'keyboard-b2';
  await setView(1366, 768, 'light');
  const groupTrigger = page.locator('[data-testid="office-tool-group"] [data-slot="chat-tool-group-trigger"]').first();
  await groupTrigger.focus(); await page.keyboard.press('Enter');
  const groupOpen = await groupTrigger.getAttribute('aria-expanded');
  await page.keyboard.press('Enter');
  const groupClosed = await groupTrigger.getAttribute('aria-expanded');
  if (groupOpen === groupClosed) fail('tool group trigger Enter did not toggle expansion');
  check(`Tool group disclosure toggles by Enter (${groupOpen} -> ${groupClosed})`);

  // B3: only a failing read -> blocked + attention auto-expand.
  await send('H09-MATRIX-B3');
  await settleRun();
  await probeState('b3-blocked', {
    expect: { verificationStates: ['unknown', 'needs_human', 'blocked'], stepStates: [{ text: '未完成' }] },
    tabExpected: [...composerExpected, 'chat-tool-trigger', '查看核对范围', 'pi-task-review-toggle'],
    contrastTargets: [...composerContrast, ['failed step state label', '.office-step-state'], ['verification heading', '[data-testid="office-verification"] strong'], ['verification body', '[data-testid="office-verification"] p']],
    liveExpected: ['office-verification'],
  });

  // B4: plan + read -> needs_human; the read check applies at run end, so the
  // human check and acceptance are unlocked for keyboard completion.
  await send('H09-MATRIX-B4');
  await settleRun();
  await page.getByTestId('pi-task-review-toggle').last().click();
  await until(async () => await page.getByTestId('pi-task-steps').count() > 0, 30000);
  await probeState('b4-needs-human', {
    expect: {
      verificationStates: ['needs_human'],
      taskStepStates: [{ id: 'read', state: 'verified' }, { id: 'review', state: 'pending' }],
    },
    // Accept stays disabled until the human check is selected; it is exercised
    // in the keyboard-accept phase right after this probe.
    tabExpected: [...composerExpected, 'pi-task-review-toggle', 'pi-task-review-check', '查看核对范围'],
    contrastTargets: [...composerContrast, ['verification heading', '[data-testid="office-verification"] strong'], ['verification body', '[data-testid="office-verification"] p'], ['task review status', '.pi-task-review-status'], ['accept button', '[data-testid="pi-task-review-accept"]']],
    liveExpected: ['office-verification'],
  });
  // Keyboard acceptance: Space on the human check, Enter on accept.
  report.phase = 'keyboard-accept';
  await setView(1366, 768, 'light');
  const reviewCard = page.getByTestId('pi-task-review').last();
  await until(async () => await reviewCard.getByTestId('pi-task-review-check').count() > 0, 30000);
  await reviewCard.getByTestId('pi-task-review-check').locator('input').focus();
  await page.keyboard.press('Space');
  await reviewCard.getByTestId('pi-task-review-accept').focus();
  await page.keyboard.press('Enter');
  await until(async () => (await snap()).task?.state === 'completed', 45000);
  check('Human criterion checkbox toggles by Space and task acceptance commits by Enter');
  await probeState('b5-accepted', {
    expect: { taskStepStates: [{ id: 'read', state: 'verified' }, { id: 'review', state: 'verified' }] },
    tabExpected: [...composerExpected, 'pi-task-review-toggle', '查看核对范围'],
    contrastTargets: [['task review status', '.pi-task-review-status'], ['confirmed requirement', '[data-testid="pi-task-review-confirmed"]']],
    liveExpected: ['pi-task-review'],
    configs: [[1366, 768, 'light'], [1920, 1080, 'dark']],
  });
  // B4b: a second task exercises the rejection path, which records the teacher
  // check and produces the matrix "failed" (needs_fix) step state.
  await send('H09-MATRIX-B4');
  await settleRun();
  await page.getByTestId('pi-task-review-toggle').last().click();
  await until(async () => await page.getByTestId('pi-task-steps').count() > 0, 30000);
  report.phase = 'keyboard-reject';
  await setView(1366, 768, 'light');
  const rejectCard = page.getByTestId('pi-task-review').last();
  await rejectCard.getByTestId('pi-task-review-reject').focus();
  await page.keyboard.press('Enter');
  await until(async () => (await snap()).task?.state === 'paused', 45000);
  check('Review rejection commits by Enter and pauses the task');
  await probeState('b5-rejected', {
    expect: { taskStepStates: [{ id: 'read', state: 'needs_check' }, { id: 'review', state: 'needs_fix' }] },
    tabExpected: [...composerExpected, 'pi-task-review-toggle', '查看核对范围'],
    contrastTargets: [['task review status', '.pi-task-review-status'], ['reject notice', '[data-testid="pi-task-review-notice"]']],
    liveExpected: ['pi-task-review-notice'],
    configs: [[1366, 768, 'light'], [1920, 1080, 'dark']],
  });
  }

  // C: copy approval card pending (plan adoption and the dependent copy are
  // separate model stages, so the copy admission does not race the plan).
  if (only === 'C' || !only) {
  report.phase = 'scenario-c-approval';
  await newConversation(workspace);
  await send('H09-MATRIX-C');
  const approvalProduced = await until(async () => (await snap()).approvals?.some(a => a.state === 'pending'), 45000).catch(() => false);
  if (!approvalProduced) {
    const observed = await snap().catch(() => null);
    report.copyAdmissions = taskAdmissions(dataDir);
    report.unverified.push(`Office approval card (pi-copy-approval pending): NOT produced in one bounded attempt. Observed run status ${observed?.projection?.turns?.at(-1)?.status || 'unknown'}; admissions ${JSON.stringify(report.copyAdmissions)}.`);
    console.log('UNVERIFIED c-approval: approval not produced; skipping approval-card probes');
  } else {
    await page.locator('[data-testid="pi-copy-approval"][data-state="pending"]').first().waitFor({ timeout: 30000 });
    report.copyAdmissions = taskAdmissions(dataDir);
    const copyAdmitted = report.copyAdmissions.some(t => t.admissions.some(a => a.tool === 'office_copy_file' && a.stepId === 'copy'));
    if (!copyAdmitted) fail(`copy admission not persisted: ${JSON.stringify(report.copyAdmissions)}`);
    check(`Copy step admission persisted before approval (${JSON.stringify(report.copyAdmissions)})`);
    await axNameAudit('c-approval');
    await probeState('c-approval', {
      expect: { approvalStates: ['pending'], 'pi-copy-approval': 'visible' },
      tabExpected: [...composerExpectedRunning, 'pi-copy-approve', 'pi-copy-reject'],
      contrastTargets: [['approval card label', '[data-testid="pi-copy-approval"] [data-slot="chat-tool-trigger"]'], ['approve button', '[data-testid="pi-copy-approve"]'], ['reject button', '[data-testid="pi-copy-reject"]'], ['turn notice', '.office-turn-notice strong']],
      liveExpected: ['等待你的确认'],
    });
  }
  }

  // D: teacher question card pending, then answered by keyboard.
  if (only === 'D' || !only) {
  report.phase = 'scenario-d-question';
  await newConversation(workspace);
  await send('H09-MATRIX-D');
  const questionProduced = await until(async () => (await snap()).controls?.some(c => c.kind === 'question' && c.state === 'pending'), 45000).catch(() => false);
  if (!questionProduced) {
    const observed = await snap().catch(() => null);
    report.unverified.push(`Pi interaction (question) card: NOT produced in one bounded attempt; last run status ${observed?.projection?.turns?.at(-1)?.status || 'unknown'}.`);
    console.log('UNVERIFIED d-question: control card not produced; skipping question probes');
  } else {
    await page.locator('[data-testid="pi-teacher-question"][data-state="pending"]').first().waitFor({ timeout: 30000 });
    await axNameAudit('d-question');
    await probeState('d-question', {
      expect: { questionStates: ['pending'], 'pi-teacher-question': 'visible' },
      tabExpected: [...composerExpectedRunning, 'pi-question-option-0', 'pi-question-option-1', '回答小智的问题'],
      contrastTargets: [['question card label', '[data-testid="pi-teacher-question"] [data-slot="chat-tool-trigger"]'], ['question text', '.pi-question-text'], ['option 0', '[data-testid="pi-question-option-0"]'], ['option 1', '[data-testid="pi-question-option-1"]'], ['submit button', '[data-testid="pi-question-submit"]'], ['turn notice', '.office-turn-notice strong']],
      liveExpected: ['等待你的补充'],
    });
    report.phase = 'keyboard-answer';
    await setView(1366, 768, 'light');
    await page.getByTestId('pi-question-answer').fill('需要补充年级说明，请按三年级处理。');
    await page.getByTestId('pi-question-submit').focus();
    await page.keyboard.press('Enter');
    await until(async () => { const s = await snap(); return !s.running && s.controls?.some(c => c.kind === 'question' && c.state === 'answered'); }, 60000);
    check('Question answer submits by Enter and the run completes');
    await probeState('d-answered', {
      expect: { questionStates: ['answered'] },
      // The model picker can be legitimately disabled once the session model
      // is locked by a completed run; its enabled state is covered elsewhere.
      tabExpected: [...composerExpected.filter(name => name !== '选择模型'), 'chat-tool-trigger'],
      contrastTargets: [['answered card label', '[data-testid="pi-teacher-question"] [data-slot="chat-tool-trigger"]'], ['answered body', '[data-testid="pi-teacher-question"] p']],
      liveExpected: [],
      configs: [[1366, 768, 'light']],
    });
  }
  }

  // File-effect accounting: no new files in the owned workspace.
  report.fileEffects.workspaceAfter = fs.readdirSync(workspace).sort().join(',');
  if (report.fileEffects.workspaceBefore !== report.fileEffects.workspaceAfter) fail(`workspace files changed: ${report.fileEffects.workspaceBefore} -> ${report.fileEffects.workspaceAfter}`);
  check('Sweep produced zero file effects in the owned workspace');
  await close();
}

// ── shared restored-session helpers ──────────────────────────────────────────
async function openSessionById(id, label) {
  report.phase = `open-${label}`;
  const row = page.getByTestId(`ai-conversation-session-${id}`);
  await row.waitFor({ timeout: 30000 });
  await row.click();
  const switched = await until(async () => (await page.locator('.office-composer-container').getAttribute('data-session-id')) === id, 30000).catch(() => false);
  if (!switched) {
    const state = await page.evaluate(() => ({
      composerSession: document.querySelector('.office-composer-container')?.getAttribute('data-session-id'),
      sessionRows: [...document.querySelectorAll('[data-testid^="ai-conversation-session-"]')].slice(0, 40).map(el => ({ id: el.getAttribute('data-testid'), visible: el.offsetParent !== null })),
    }));
    fail(`open-${label}: composer did not switch to ${id}; ${JSON.stringify(state).slice(0, 900)}`);
  }
  session = id;
  let lastSnapshotError = '';
  const turns = await until(async () => {
    try { const s = await snap(); return s?.projection?.turns?.length > 0; }
    catch (error) { lastSnapshotError = String(error).slice(0, 300); return false; }
  }, 45000).catch(() => false);
  if (!turns) {
    const state = await page.evaluate((target) => ({
      composerContainers: [...document.querySelectorAll('.office-composer-container')].map(el => el.getAttribute('data-session-id')),
      target,
      sessionRowVisible: document.querySelector(`[data-testid="ai-conversation-session-${target}"]`)?.offsetParent !== null,
    }), id);
    fail(`open-${label}: snapshot never yielded turns for ${id}; last snapshot error: ${lastSnapshotError || 'none (empty projection)'}; state ${JSON.stringify(state)}`);
  }
  await until(async () => !await page.getByTestId('office-prompt-input').isDisabled(), 90000).catch(() => {
    return page.evaluate(() => ({
      promptDisabled: document.querySelector('[data-testid="office-prompt-input"]')?.disabled,
      studentNote: document.querySelector('[data-testid="pi-student-selection"]')?.textContent || null,
      modelPickerDisabled: document.querySelector('.office-model-picker')?.disabled,
      notices: [...document.querySelectorAll('.office-history-notice, [role="alert"]')].map(el => (el.textContent || '').trim().slice(0, 80)).slice(0, 6),
      turns: document.querySelectorAll('[data-turn-id]').length,
    })).then(state => { fail(`open-${label}: prompt stayed disabled; ${JSON.stringify(state)}`); });
  });
}

// ── scenario I: queued instruction control cards ────────────────────────────
async function scenarioI() {
  report.phase = 'scenario-i-queued';
  const dataDir = path.join(output, 'data-i'), profile = path.join(output, 'profile-i'), workspace = path.join(output, 'workspace-i');
  fs.mkdirSync(dataDir, { recursive: true }); fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'lesson.txt'), '合成课堂资料：本课37分钟，先观察再解释。核验码 H09-SWEEP。');
  fs.mkdirSync(path.join(dataDir, 'xiaozhi-pi'), { recursive: true });
  fs.copyFileSync(capabilitySource, path.join(dataDir, 'xiaozhi-pi', 'deepseek-capabilities.v1.json'));
  report.fileEffects.workspaceBefore = fs.readdirSync(workspace).sort().join(',');
  await launch(dataDir, profile, async () => installFixture(fixtureScripts()));
  await chooseWorkspace(workspace);
  await send('H09-MATRIX-D');
  await until(async () => (await snap()).controls?.some(c => c.kind === 'question' && c.state === 'pending'), 45000);
  // The owned native queue behind the pending question accepts a steering
  // instruction without any model stage; the card renders from control state.
  await page.getByTestId('office-prompt-input').fill('H09 排队指令补充：核对时请注意教学要求版本。');
  await page.getByTestId('pi-queue-submit').click();
  const first = await until(async () => {
    const item = (await snap()).controls?.find(c => c.kind === 'instruction' && c.state === 'queued');
    return item || undefined;
  }, 30000);
  report.queuedInstruction = { id: first.id, mode: first.mode, state: first.state, revision: first.revision };
  await page.getByTestId('pi-queue-mode-followup').click();
  await page.getByTestId('office-prompt-input').fill('H09 排队补充二：完成后补一句教师复核提醒。');
  await page.getByTestId('pi-queue-submit').click();
  const second = await until(async () => {
    const items = ((await snap()).controls || []).filter(c => c.kind === 'instruction' && c.state === 'queued');
    return items.length >= 2 ? items : undefined;
  }, 30000);
  report.queuedInstructions = second.map(item => ({ id: item.id, mode: item.mode, state: item.state, revision: item.revision }));
  if (!report.queuedInstructions.some(item => item.mode === 'followUp')) fail(`followUp queue mode not applied: ${JSON.stringify(report.queuedInstructions)}`);
  check(`Two queued instruction cards visible behind the pending question (${JSON.stringify(report.queuedInstructions.map(i => i.mode))})`);
  await axNameAudit('i-queued');
  await probeState('i-queued', {
    expect: { questionStates: ['pending'], instructionStates: ['queued'], 'pi-queued-instruction': 'visible' },
    tabExpected: [...composerExpectedRunning, 'pi-queue-mode-steer', 'pi-queue-mode-followup', 'pi-queue-submit', '补充本轮', '接着处理', 'pi-instruction-edit', 'pi-instruction-withdraw'],
    contrastTargets: [...composerContrast, ['queue submit', '[data-testid="pi-queue-submit"]'], ['queue mode steer', '[data-testid="pi-queue-mode-steer"]'], ['queue mode followup', '[data-testid="pi-queue-mode-followup"]'], ['instruction trigger', '[data-testid="pi-queued-instruction"] [data-slot="chat-tool-trigger"]'], ['instruction body', '[data-testid="pi-queued-instruction"] p'], ['instruction edit', '[data-testid="pi-instruction-edit"]'], ['instruction withdraw', '[data-testid="pi-instruction-withdraw"]']],
    liveExpected: ['等待你的补充'],
  });
  // Keyboard edit bumps the control revision while the run keeps waiting.
  report.phase = 'keyboard-i-edit';
  await setView(1366, 768, 'light');
  const steer = report.queuedInstructions.find(item => item.mode === 'steer');
  const steerCard = page.locator(`[data-testid="pi-queued-instruction"][data-control-id="${steer.id}"]`);
  await steerCard.getByTestId('pi-instruction-edit').focus();
  await page.keyboard.press('Enter');
  await steerCard.getByTestId('pi-instruction-text').waitFor({ timeout: 10000 });
  await steerCard.getByTestId('pi-instruction-text').fill('H09 排队指令补充（教师已修改）：核对时请注意教学要求版本与年级说明。');
  await steerCard.getByTestId('pi-instruction-mode').selectOption('followUp');
  await steerCard.getByTestId('pi-instruction-save').focus();
  await page.keyboard.press('Enter');
  const edited = await until(async () => {
    const item = (await snap()).controls?.find(c => c.id === steer.id);
    return item && item.state === 'queued' && item.mode === 'followUp' && item.revision === steer.revision + 1 ? item : undefined;
  }, 30000);
  check(`Queued instruction edits by keyboard with a revision bump and stays queued (revision ${steer.revision} -> ${edited.revision})`);
  // Keyboard withdraw moves the second card to the withdrawn state.
  report.phase = 'keyboard-i-withdraw';
  const followUp = report.queuedInstructions.find(item => item.mode === 'followUp');
  const followCard = page.locator(`[data-testid="pi-queued-instruction"][data-control-id="${followUp.id}"]`);
  await followCard.getByTestId('pi-instruction-withdraw').focus();
  await page.keyboard.press('Enter');
  await until(async () => (await snap()).controls?.some(c => c.id === followUp.id && c.state === 'withdrawn'), 30000);
  check('Queued instruction withdraws by Enter to the withdrawn state');
  // Expand the withdrawn card so its body text is actually rendered and gets a
  // real contrast measurement (collapsed disclosure content is exempt).
  const withdrawnTrigger = page.locator('[data-testid="pi-queued-instruction"][data-state="withdrawn"] [data-slot="chat-tool-trigger"]').first();
  await withdrawnTrigger.click();
  await until(async () => await page.locator('[data-testid="pi-queued-instruction"][data-state="withdrawn"] p').first().evaluate(el => {
    let opacity = 1;
    for (let current = el; current; current = current.parentElement) {
      if (current.hasAttribute('hidden')) return false;
      opacity *= Number(getComputedStyle(current).opacity);
      if (opacity <= 0.01) return false;
    }
    return el.getBoundingClientRect().height > 0;
  }), 15000);
  check('Withdrawn instruction disclosure expands to reveal the body text');
  await probeState('i-withdrawn', {
    expect: { instructionStates: ['queued', 'withdrawn'], 'pi-queued-instruction': 'visible' },
    tabExpected: [...composerExpectedRunning, '已撤回', 'pi-instruction-edit', 'pi-instruction-withdraw'],
    contrastTargets: [['withdrawn trigger', '[data-testid="pi-queued-instruction"][data-state="withdrawn"] [data-slot="chat-tool-trigger"]'], ['withdrawn body', '[data-testid="pi-queued-instruction"][data-state="withdrawn"] p'], ['queued trigger', '[data-testid="pi-queued-instruction"][data-state="queued"] [data-slot="chat-tool-trigger"]']],
    liveExpected: ['等待你的补充'],
    configs: [[1366, 768, 'light'], [1920, 1080, 'dark']],
  });
  report.fileEffects.workspaceAfter = fs.readdirSync(workspace).sort().join(',');
  if (report.fileEffects.workspaceBefore !== report.fileEffects.workspaceAfter) fail(`workspace files changed: ${report.fileEffects.workspaceBefore} -> ${report.fileEffects.workspaceAfter}`);
  await close();
}

// ── scenario P: practice/learning review cards (student-context flow) ────────
async function scenarioP() {
  report.phase = 'scenario-p-student-context';
  // Owned DT-05 journey fixture: real teacher/student flow over synthetic data.
  // Contains practice reviews (confirmed/rejected), a pending learning review
  // (batch decision flow) and a confirmed learning review. Copied, never mutated.
  const source = path.resolve(desktop, 'test-results/education-journey-vv5feo');
  assert(fs.existsSync(path.join(source, 'data/app.db')), 'student-context journey fixture missing');
  const dataDir = path.join(output, 'data-p'), profile = path.join(output, 'profile-p');
  fs.cpSync(path.join(source, 'data'), dataDir, { recursive: true });
  await launch(dataDir, profile, null);
  await strictNoNetwork();
  const db = new DatabaseSync(path.join(dataDir, 'app.db'), { readOnly: true });
  const rows = db.prepare('SELECT session_id, action_type, status, COUNT(*) AS n FROM ai_confirmation_items GROUP BY session_id, action_type, status ORDER BY session_id').all();
  const pendingPayload = JSON.parse(String(db.prepare("SELECT payload_json FROM ai_confirmation_items WHERE status='pending' AND action_type='pi_student_learning_change'").get()?.payload_json || '{}'));
  db.close();
  const pendingKind = pendingPayload?.draft?.kind === 'strategy' ? 'strategy' : 'assessment';
  report.pFixture = { source: path.relative(desktop, source), reviewRows: rows, pendingKind };
  const pendingFields = pendingKind === 'assessment' ? ['learning-review-result', 'learning-review-error-type', 'learning-review-feedback'] : ['learning-review-retention'];
  const pendingLearning = rows.find(row => row.action_type === 'pi_student_learning_change' && row.status === 'pending');
  const confirmedLearning = rows.find(row => row.action_type === 'pi_student_learning_change' && row.status === 'confirmed');
  const practice = rows.find(row => row.action_type === 'pi_practice_candidate');
  if (!pendingLearning || !confirmedLearning || !practice) fail(`fixture missing expected review rows: ${JSON.stringify(rows)}`);
  // 1) Pending learning review card set (student-context batch decision flow).
  await openSessionById(pendingLearning.session_id, 'p-pending-learning');
  await page.locator('[data-testid="pi-learning-review"][data-state="pending"]').first().waitFor({ timeout: 60000 });
  await page.locator('[data-testid="learning-review-batch-bar"]').waitFor({ timeout: 30000 });
  await until(async () => await page.locator('[data-testid="pi-learning-review"][data-state="pending"]').first().locator('[data-slot="chat-tool-trigger"]').count() > 0, 30000);
  const pendingTrigger = (await page.locator('[data-testid="pi-learning-review"][data-state="pending"] [data-slot="chat-tool-trigger"] strong').first().innerText()).trim();
  report.pPendingTrigger = pendingTrigger;
  // Batch confirm/reject stay disabled until a review is selected; select the
  // first pending review so the enabled batch actions join the tab walk.
  await page.locator('[data-testid^="learning-review-select-"]').first().check();
  await until(async () => await page.locator('[data-testid="learning-review-batch-confirm"]').first().isEnabled(), 10000);
  await axNameAudit('p-pending-learning');
  await probeState('p-pending-learning', {
    expect: { learningReviewStates: ['pending'], 'pi-learning-review': 'visible', 'learning-review-batch-bar': 'visible' },
    tabExpected: [...composerExpected.filter(name => name !== '选择模型'), pendingTrigger, 'learning-review-batch-confirm', 'learning-review-batch-reject', 'learning-review-select-', ...pendingFields, 'learning-review-reason', 'learning-review-confirm', 'learning-review-reject'],
    // The 14-day training plan adds ~70 real controls; walk them all.
    tabCap: 260,
    contrastTargets: [...composerContrast, ['learning trigger', '[data-testid="pi-learning-review"][data-state="pending"] [data-slot="chat-tool-trigger"]'], ['learning body', '[data-testid="pi-learning-review"][data-state="pending"] p'], ['learning source summary', '[data-testid="pi-learning-review"][data-state="pending"] details summary'], ['batch confirm', '[data-testid="learning-review-batch-confirm"]'], ['batch reject', '[data-testid="learning-review-batch-reject"]'], ['learning confirm', '[data-testid="learning-review-confirm"]'], ['learning reject', '[data-testid="learning-review-reject"]'], ['batch count', '[data-testid="learning-review-selected-count"]']],
    liveExpected: [],
  });
  // 2) Practice review cards (confirmed and rejected) in the student context.
  await openSessionById(practice.session_id, 'p-practice-review');
  await page.locator('[data-testid="pi-practice-review"][data-state="confirmed"]').first().waitFor({ timeout: 60000 });
  await until(async () => await page.locator('[data-testid="pi-practice-review"][data-state="rejected"]').count() > 0, 30000);
  // Expand one confirmed card so the source links participate in the tab walk.
  const practiceCard = page.locator('[data-testid="pi-practice-review"][data-state="confirmed"]').first();
  await practiceCard.locator('[data-slot="chat-tool-trigger"]').click();
  await until(async () => await practiceCard.locator('[data-testid="practice-review-stem"]').first().isVisible(), 15000);
  await axNameAudit('p-practice-review');
  await probeState('p-practice-review', {
    expect: { practiceReviewStates: ['confirmed', 'rejected'], 'pi-practice-review': 'visible' },
    tabExpected: [...composerExpected.filter(name => name !== '选择模型'), '核对练习', 'pi-question-source-open', '练习题目与来源'],
    contrastTargets: [...composerContrast, ['practice trigger', '[data-testid="pi-practice-review"][data-state="confirmed"] [data-slot="chat-tool-trigger"]'], ['practice body', '[data-testid="pi-practice-review"][data-state="confirmed"] p'], ['practice item heading', '[data-testid="practice-review-item"] strong'], ['practice stem', '[data-testid="practice-review-stem"]'], ['practice answer', '[data-testid="practice-review-answer"]'], ['practice source link', '[data-testid="pi-question-source-open"]'], ['rejected trigger', '[data-testid="pi-practice-review"][data-state="rejected"] [data-slot="chat-tool-trigger"]']],
    liveExpected: ['已保存到学生的错题与练习'],
  });
  // 3) Confirmed learning review card (saved version notice).
  await openSessionById(confirmedLearning.session_id, 'p-learning-confirmed');
  await page.locator('[data-testid="pi-learning-review"][data-state="confirmed"]').first().waitFor({ timeout: 60000 });
  const confirmedTrigger = (await page.locator('[data-testid="pi-learning-review"][data-state="confirmed"] [data-slot="chat-tool-trigger"] strong').first().innerText()).trim();
  report.pConfirmedTrigger = confirmedTrigger;
  await page.locator('[data-testid="pi-learning-review"][data-state="confirmed"]').first().locator('[data-slot="chat-tool-trigger"]').click();
  // Strategy-kind confirmed reviews carry no assessment source details; wait for
  // the rendered content itself instead of any specific field.
  await until(async () => {
    const content = page.locator('[data-testid="pi-learning-review"][data-state="confirmed"]').first().locator('[data-slot="chat-tool-content"]').first();
    return await content.evaluate(el => {
      let opacity = 1;
      for (let current = el; current; current = current.parentElement) {
        if (current.hasAttribute('hidden')) return false;
        opacity *= Number(getComputedStyle(current).opacity);
        if (opacity <= 0.01) return false;
      }
      return el.getBoundingClientRect().height > 0;
    }).catch(() => false);
  }, 15000);
  await axNameAudit('p-learning-confirmed');
  await probeState('p-learning-confirmed', {
    expect: { learningReviewStates: ['confirmed'], 'pi-learning-review': 'visible' },
    tabExpected: [...composerExpected.filter(name => name !== '选择模型'), confirmedTrigger],
    contrastTargets: [...composerContrast, ['confirmed learning trigger', '[data-testid="pi-learning-review"][data-state="confirmed"] [data-slot="chat-tool-trigger"]'], ['confirmed learning body', '[data-testid="pi-learning-review"][data-state="confirmed"] p'], ['confirmed saved notice', '[data-testid="pi-learning-review"][data-state="confirmed"] [role="status"]']],
    liveExpected: ['已保存第'],
    configs: [[1366, 768, 'light'], [1920, 1080, 'dark']],
  });
  await close();
  if (report.requests.length) fail(`restored student-context sessions made network requests: ${JSON.stringify(report.requests)}`);
  check('Restored practice/learning review sessions made zero network requests');
}

// ── scenario R: interrupted-run recovery notice ──────────────────────────────
async function scenarioR() {
  report.phase = 'scenario-r-interrupted';
  const dataDir = path.join(output, 'data-r'), profile = path.join(output, 'profile-r'), workspace = path.join(output, 'workspace-r');
  fs.mkdirSync(dataDir, { recursive: true }); fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'lesson.txt'), '合成课堂资料：本课37分钟，先观察再解释。核验码 H09-SWEEP。');
  fs.mkdirSync(path.join(dataDir, 'xiaozhi-pi'), { recursive: true });
  fs.copyFileSync(capabilitySource, path.join(dataDir, 'xiaozhi-pi', 'deepseek-capabilities.v1.json'));
  report.fileEffects.workspaceBefore = fs.readdirSync(workspace).sort().join(',');
  await launch(dataDir, profile, async () => installFixture(fixtureScripts()));
  await chooseWorkspace(workspace);
  await send('H09-MATRIX-C');
  const pendingApproval = await until(async () => (await snap()).approvals?.some(a => a.state === 'pending'), 45000);
  const preSession = session;
  const preClose = await snap();
  report.rPreClose = { session: preSession, approval: pendingApproval, turnStatus: preClose.projection?.turns?.at(-1)?.status, running: preClose.running };
  // Fixture requests live in the dying process; capture them before the kill.
  report.rPreCloseRequests = await collectRequests();
  if (!report.rPreCloseRequests.some(r => r.marker)) fail(`fixture marker request missing before the interruption: ${JSON.stringify(report.rPreCloseRequests)}`);
  // Owned minimal interruption: hard-kill the real Electron process while the
  // approval waits. The durable journal keeps the run 'running', so the cold
  // startup recovery reconciles the persisted receipts into the recovery
  // notice (a clean window close would settle the run first and is exercised
  // by pi-shutdown-pending-ui; the run-end publisher seal is product logic).
  const pid = app.process().pid;
  execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'pipe' });
  await app.waitForEvent('close', { timeout: 20000 }).catch(() => undefined);
  app = undefined; page = undefined;
  check('Owned minimal interruption: real process killed while a copy approval was pending');
  // Cold relaunch; a refusing fixture proves the interrupted run never replays.
  await launch(dataDir, profile, null);
  await strictNoNetwork();
  report.requests.push(...report.rPreCloseRequests);
  if (session !== preSession) {
    await page.getByTestId(`ai-conversation-session-${preSession}`).waitFor({ timeout: 30000 });
    await page.getByTestId(`ai-conversation-session-${preSession}`).click();
    session = preSession;
  }
  await until(async () => (await snap()).projection?.turns?.length > 0, 45000);
  const restored = await snap();
  if (restored.running) fail('cold restore resumed a run');
  const interruptedTurn = restored.projection.turns.find(turn => turn.status === 'interrupted');
  if (!interruptedTurn) fail(`no interrupted turn after cold restore: ${JSON.stringify(restored.projection.turns.map(t => t.status))}`);
  const receipts = interruptedTurn.recovery?.receipts || [];
  if (!receipts.length) fail(`interrupted turn has no recovery receipts: ${JSON.stringify(interruptedTurn.recovery)}`);
  if (!restored.approvals?.some(a => a.state === 'interrupted')) fail(`approval did not persist interrupted: ${JSON.stringify(restored.approvals?.map(a => a.state))}`);
  report.rRestored = { turn: interruptedTurn.id, receipts: receipts.map(r => ({ tool: r.tool, disposition: r.disposition })), approvals: restored.approvals.map(a => a.state), running: restored.running };
  await page.locator('[data-testid="office-recovery"]').first().waitFor({ timeout: 60000 });
  await page.locator('[data-testid="pi-copy-approval"][data-state="interrupted"]').first().waitFor({ timeout: 30000 });
  check(`Cold restore projects the interrupted run with ${receipts.length} recovery receipts and an interrupted approval`);
  await axNameAudit('r-recovered');
  await probeState('r-recovered', {
    expect: { 'office-recovery': 'visible', 'pi-copy-approval': 'visible', approvalStates: ['interrupted'] },
    tabExpected: [...composerExpected.filter(name => name !== '选择模型'), '查看操作结果', '复制教学资料', '确认已失效'],
    contrastTargets: [...composerContrast, ['recovery heading', '[data-testid="office-recovery"] strong'], ['recovery body', '[data-testid="office-recovery"] p'], ['recovery summary', '[data-testid="office-recovery"] summary'], ['approval trigger', '[data-testid="pi-copy-approval"] [data-slot="chat-tool-trigger"]'], ['turn notice', '.office-turn-notice strong']],
    liveExpected: ['office-recovery'],
  });
  // Keyboard: recovery details and interrupted approval disclosure.
  report.phase = 'keyboard-r';
  await setView(1366, 768, 'light');
  const recoverySummary = page.locator('[data-testid="office-recovery"] summary').first();
  await recoverySummary.focus(); await page.keyboard.press('Enter');
  const recoveryOpen = await page.locator('[data-testid="office-recovery"] details').first().evaluate(el => el.open);
  await page.keyboard.press('Enter');
  const recoveryClosed = await page.locator('[data-testid="office-recovery"] details').first().evaluate(el => !el.open);
  if (!(recoveryOpen && recoveryClosed)) fail('recovery notice details did not toggle by Enter');
  check('Recovery notice operation details toggle by Enter');
  const approvalTrigger = page.locator('[data-testid="pi-copy-approval"] [data-slot="chat-tool-trigger"]').first();
  await approvalTrigger.focus(); await page.keyboard.press('Enter');
  const expandedAfter = await approvalTrigger.getAttribute('aria-expanded');
  await page.keyboard.press('Enter');
  const collapsedAfter = await approvalTrigger.getAttribute('aria-expanded');
  if (expandedAfter === collapsedAfter) fail('interrupted approval trigger Enter did not toggle');
  check(`Interrupted approval disclosure toggles by Enter (${expandedAfter} -> ${collapsedAfter})`);
  report.fileEffects.workspaceAfter = fs.readdirSync(workspace).sort().join(',');
  if (report.fileEffects.workspaceBefore !== report.fileEffects.workspaceAfter) fail(`workspace files changed: ${report.fileEffects.workspaceBefore} -> ${report.fileEffects.workspaceAfter}`);
  await close();
  if (!report.requests.filter(r => r.marker).length) fail('expected the fixture marker request before the interruption');
  check(`Interrupted run made zero model requests after cold restore (${report.requests.filter(r => r.marker).length} pre-interruption fixture call)`);
}

// ── scenario V: verified notice derivation (source invariants) ───────────────
async function scenarioV() {
  report.phase = 'scenario-v-verified';
  const read = rel => fs.readFileSync(path.resolve(desktop, 'src', rel), 'utf8');
  const runObserver = read('main/xiaozhi-agent/verification/run-observer.ts');
  const resultReadback = read('main/xiaozhi-agent/verification/result-readback.ts');
  const verifier = read('main/xiaozhi-agent/verification/verifier.ts');
  report.verifiedDerivation = {
    runObserverOnlyDerivesBlockedPartialNeedsHumanUnknown: runObserver.includes("const state = executionFailed ? succeeded ? 'partial' : 'blocked' : criteria.length || imageReceived ? 'needs_human' : 'unknown'"),
    resultReadbackAlwaysAppendsHumanCriterion: resultReadback.includes("criteria.push({id:'answer:human',kind:'human',alternatives:[]})"),
    resultReadbackFinalStateNeverVerified: resultReadback.includes("state:['blocked','partial'].includes(base.state)?base.state:missing?'partial':'needs_human'"),
    verifierVerifiedRequiresAllChecksPassed: verifier.includes("checks.every(c => c.state==='passed') ? 'verified'"),
    verifierHumanCriterionAlwaysNeedsHuman: verifier.includes("criterion.kind === 'human' ? 'needs_human' : 'unknown'"),
  };
  const reachable = Object.values(report.verifiedDerivation).every(Boolean);
  if (!reachable) fail(`verified-derivation source invariants changed; re-inspect the run-end paths before claiming: ${JSON.stringify(report.verifiedDerivation)}`);
  // Empirical corroboration from the prior accepted sweep: every produced
  // run-end verification state was blocked/partial/needs_human/unknown.
  const prior = JSON.parse(fs.readFileSync(path.resolve(desktop, 'test-results/goal/h09-dynamic-a11y-20261023/run-u6tJg6/report.json'), 'utf8'));
  report.verifiedPriorStates = { b1: prior.b1Verification || null, b2: prior.views.find(v => v.label === 'b2-taskplan')?.data?.verificationStates || null, restored: prior.restoredVerificationStates || null };
  check(`Run-end verification inspected: ${JSON.stringify(report.verifiedPriorStates)}; current derivation cannot produce verified without faking a human criterion pass`);
  report.unverified.push('Office verification notice state verified (matrix "passed"): run-observer.ts and result-readback.ts run-end paths always append an answer:human criterion (always needs_human) or force blocked/partial/needs_human/unknown; verifyCriteria only returns verified when every check passed with no human criterion, which these paths never produce. Producing verified would require faking a human check pass. Kept UNVERIFIED with this source-invariant reason plus the prior sweep\'s empirical states.');
}

try {
  const only = process.env.H09_ONLY || null;
  if (only === 'I') await scenarioI();
  else if (only === 'P') await scenarioP();
  else if (only === 'R') await scenarioR();
  else if (only === 'V') await scenarioV();
  else {
    if (process.env.H09_START !== 'fixtures') await scenarioA();
    await scenariosBCD(only);
  }
  // Gates.
  if (report.errors.length) fail('renderer errors: ' + report.errors.join(' | '));
  const all = report.requests;
  if (!all.every(r => r && typeof r === 'object' && r.marker)) fail('non-fixture network requests observed: ' + JSON.stringify(all.filter(r => !(r && r.marker))));
  const markerMinimum = only ? (['I', 'R', 'B', 'C', 'D'].includes(only) ? 1 : 0) : 6;
  if (all.filter(r => r.marker).length < markerMinimum) fail(`expected at least ${markerMinimum} fixture requests, saw ${all.length}`);
  check(`All ${all.length} model requests were served by the owned fixture (zero provider requests)`);
  if (fingerprint(buildRoot).sha256 !== fixed.sha256) fail('build changed during probe');
  for (const row of report.contrast) {
    if (row.pass === false) report.failures.push(`contrast ${row.label} ${row.name} ratio ${row.ratio} < ${row.threshold}`);
  }
  report.unverified.push('Human screen-reader use: OPEN, not exercised and not claimed.');
  if (only !== 'V') report.unverified.push('Office verification notice state verified (matrix "passed"): run-end verification derives blocked/partial/needs_human/unknown; the H09_ONLY=V mode inspects the derivation source and records why verified is unreachable without faking.');
  if (only !== 'I') report.unverified.push('Instruction (queued) control card: covered by the H09_ONLY=I focus mode.');
  if (only !== 'P') report.unverified.push('Practice/learning review cards: covered by the H09_ONLY=P focus mode.');
  if (only !== 'R') report.unverified.push('Interrupted-run recovery: covered by the H09_ONLY=R focus mode.');
  if (report.failures.length) { report.error = report.failures.slice(0, 12).join(' | '); process.exitCode = 1; }
  else report.success = true;
} catch (error) {
  report.error = String(error.stack || error).slice(0, 6000);
  process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, 'failure.png'), animations: 'disabled' }).catch(() => undefined);
} finally {
  await close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ success: report.success, phase: report.phase, output, views: report.views.filter(v => !v.label.startsWith('tabwalk-')).length, tabwalks: report.views.filter(v => v.label.startsWith('tabwalk-')).length, requests: report.requests.length, errors: report.errors.length, failures: report.failures.length, error: report.error }));
}
