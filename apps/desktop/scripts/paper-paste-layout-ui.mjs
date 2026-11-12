import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';
import { fingerprint, sha256 } from './acceptance/evidence.mjs';
import { continuationBootstrap, continuationGuardRead } from './acceptance/paper-adaptation-continuation.mjs';
import { assertIsolatedPiMain } from './acceptance/build-root.mjs';
import { productEntry } from './product-navigation.mjs';
const desktop = path.resolve(import.meta.dirname, '..');
assert.equal(process.argv.length, 4);
const owned = fs.realpathSync(path.join(desktop, 'test-results'));
const pinFile = fs.realpathSync(path.resolve(desktop, process.argv[2]));
assert(pinFile.startsWith(owned + path.sep));
const pins = JSON.parse(fs.readFileSync(pinFile));
assert(fs.realpathSync(pins.buildRoot).startsWith(owned + path.sep));
const tag = process.argv[3];
assert(['before', 'after', 'integrated'].includes(tag));
const output = fs.mkdtempSync(path.join(desktop, 'test-results/paste-style-' + tag + '-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
fs.mkdirSync(data);
fs.mkdirSync(profile);
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, continuationBootstrap({ main: path.join(pins.buildRoot, 'main/index.js'), profile }));
const report = { success: false, output, pins, tag, scriptSha256: sha256(fs.readFileSync(import.meta.filename)), states: [], errors: [] };
const env = { ...process.env };
for (const key of Object.keys(env))
    if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || key.startsWith('OMNI_EDU_') || ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(key))
        delete env[key];
Object.assign(env, { OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'), OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_VISIBLE: '1', NODE_ENV: 'development' });
let app;
const deadline = setTimeout(() => {
    report.budgetExceeded = true;
    if (app)
        spawn('taskkill.exe', ['/PID', String(app.process().pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
}, 180000);
try {
    if (tag !== 'before')
        assert.equal(fingerprint(path.join(desktop, 'src')).sha256, pins.source);
    assert.equal(fingerprint(pins.buildRoot).sha256, pins.build);
    app = await electron.launch({ args: [bootstrap, '--user-data-dir=' + profile, '--force-device-scale-factor=1'], env, cwd: output, timeout: 30000 });
    report.stderr = [];
    app.process().stderr?.on('data', bytes => { if (report.stderr.length < 16)
        report.stderr.push(String(bytes).slice(0, 1500).replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')); });
    const page = await app.firstWindow();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => report.errors.push(String(error)));
    await page.getByTestId('workbench-home').waitFor();
    report.identity = await assertIsolatedPiMain(app, path.join(pins.buildRoot, 'main/index.js'), profile);
    await productEntry(page, 'teaching').click();
    await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-paper').click();
    await page.getByTestId('paper-basket-stage-select').and(page.locator(':enabled')).waitFor();
    await page.getByTestId('paper-paste-open').click();
    const target = page.getByTestId('paper-paste-text');
    await target.waitFor();
    const cdp = await page.context().newCDPSession(page), sheets = new Map();
    cdp.on('CSS.styleSheetAdded', ({ header }) => sheets.set(header.styleSheetId, header));
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-testid="paper-paste-text"]' });
    const capture = async (state, width, height) => {
        await page.waitForFunction(() => {
            let node = document.querySelector('[data-testid="paper-paste-text"]');
            while (node) {
                if (node.getAnimations().some(animation => animation.playState === 'running')) return false;
                node = node.parentElement;
            }
            return true;
        });
        const metrics = await target.evaluate(element => {
            const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
            const css = getComputedStyle(element), field = element.closest('[data-slot="textfield"]'), label = field?.querySelector('[data-slot="label"]') || element.closest('label');
            const content = element.closest('[data-slot="modal-body"]') || element.closest('[data-slot="card-content"]');
            const contentStyle = content && getComputedStyle(content);
            const dialog = element.closest('[role="dialog"]');
            return { element: rect(element), label: label ? rect(label) : null,
                content: content ? { ...rect(content), availableWidth: content.clientWidth - parseFloat(contentStyle.paddingLeft) - parseFloat(contentStyle.paddingRight) } : null,
                dialog: dialog ? rect(dialog) : null,
                field: field ? rect(field) : null, rows: element.rows,
                scroll: { top: element.scrollTop, height: element.scrollHeight, clientHeight: element.clientHeight, width: element.scrollWidth, clientWidth: element.clientWidth },
                className: element.className, focus: document.activeElement === element, focusVisible: element.matches(':focus-visible'), hover: element.matches(':hover'), active: element.matches(':active'),
                properties: Object.fromEntries(['width', 'min-width', 'max-width', 'height', 'min-height', 'padding', 'display', 'font-family', 'font-size', 'line-height', 'border-radius', 'background-color', 'border-color', 'box-shadow', 'outline', 'resize'].map(key => [key, css.getPropertyValue(key)])) };
        });
        const matched = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
        const rules = (matched.matchedCSSRules || []).map(({ rule, matchingSelectors }) => ({ selector: rule.selectorList.text, matchingSelectors, origin: rule.origin,
            file: sheets.get(rule.styleSheetId)?.sourceURL, layers: rule.layers, scope: rule.scopes, range: rule.style.range,
            properties: rule.style.cssProperties.filter(p => ['all', 'width', 'min-width', 'max-width', 'height', 'min-height', 'padding', 'font', 'font-family', 'border-radius', 'background-color', 'box-shadow', 'outline'].includes(p.name)) })).filter(rule => rule.properties.length);
        report.states.push({ state, width, height, metrics, rules });
        if (tag !== 'before') {
            assert(metrics.content && metrics.field && metrics.label);
            assert(metrics.element.width >= metrics.content.availableWidth * .95, 'Textarea must fill the available form column');
            assert(metrics.element.width <= metrics.content.availableWidth + 1, 'Textarea must stay inside the form column');
            assert(metrics.dialog, 'The approved source form opens in a dialog');
            assert(Math.abs(metrics.dialog.width - Math.min(900, width - 40)) <= 1, 'Dialog width follows the approved 900px maximum and 20px window gutters');
            assert(metrics.dialog.y >= 0 && metrics.dialog.y + metrics.dialog.height <= height + 1, 'Dialog stays inside the window');
            assert(metrics.label.y + metrics.label.height <= metrics.element.y + 1, 'Label belongs above the full-width field');
            assert.equal(metrics.rows, 6);
            assert(rules.some(rule => rule.selector.includes('.textarea--full-width') && rule.properties.some(p => p.name === 'width')), 'Official width modifier must supply the width');
        }
        const file = path.join(output, `${width}-${state}.png`);
        await page.screenshot({ path: file });
    };
    for (const [width, height] of [[1366, 768], [1920, 1080], [800, 768]]) {
        await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width, height]);
        await page.waitForFunction(size => innerWidth === size[0] && innerHeight === size[1], [width, height]);
        if (tag === 'before') await page.getByTestId('paper-studio-title').focus();
        else await page.getByTestId('paper-paste-close').focus();
        await page.mouse.move(1, 1);
        await target.scrollIntoViewIfNeeded();
        await capture('normal', width, height);
        await target.hover();
        await capture('hover', width, height);
        await page.mouse.down();
        await capture('active', width, height);
        await page.mouse.up();
        await target.focus();
        await page.keyboard.press('ArrowLeft');
        await capture('focus', width, height);
        const longText = '第1题：保留多行原文与公式 $2+3$。\n' + ('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.repeat(70)) + '\n原文结尾。';
        await target.fill(longText);
        await target.press('Control+End');
        assert.equal(await target.inputValue(), longText);
        await capture('long-text', width, height);
        const scroll = report.states.at(-1).metrics.scroll;
        assert(scroll.height > scroll.clientHeight && scroll.top > 0, 'Long text remains editable and vertically scrollable');
        assert(scroll.width <= scroll.clientWidth + 1, 'Long unbroken input must not overflow horizontally');
        const cancel = page.getByTestId('paper-paste-cancel');
        await cancel.scrollIntoViewIfNeeded();
        const bounds = await cancel.boundingBox();
        assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= height + 1);
        await target.fill('');
    }
    if (tag !== 'before') {
        await page.getByTestId('paper-paste-close').click();
        await page.getByTestId('paper-paste-panel').waitFor({state: 'hidden'});
        await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'paper-paste-open');
    }
    report.guard = await app.evaluate(continuationGuardRead, true);
    for (const name of ['networkAttempts', 'modelAttempts', 'rendererErrors'])
        assert.equal(report.guard[name], 0);
    assert.deepEqual(report.errors, []);
    if (tag !== 'before')
        assert.equal(fingerprint(path.join(desktop, 'src')).sha256, pins.source);
    assert.equal(fingerprint(pins.buildRoot).sha256, pins.build);
    assert.equal(sha256(fs.readFileSync(import.meta.filename)), report.scriptSha256);
    report.success = true;
}
catch (error) {
    report.failure = { message: error.message, stack: String(error.stack) };
    process.exitCode = 1;
}
finally {
    clearTimeout(deadline);
    report.processExit = app?.process().exitCode;
    report.windows = app?.windows().length;
    await app?.close();
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ success: report.success, output, states: report.states.length, failure: report.failure }));
}
