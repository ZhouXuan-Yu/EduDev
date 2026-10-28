# Visual comparison protocol

Use this when the user asks for “100%” or “和演示站一致”.

## 1. Capture the demo

Use Chromium at the target viewport:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1366, height: 768 },
  deviceScaleFactor: 1,
});
await page.goto('https://herouipro-v3.shunqwang.workers.dev/#ChatSource', {
  waitUntil: 'networkidle',
});
await page.locator('[data-slot="chat-source"]').first().screenshot({
  path: 'test-results/heroui-parity/demo-chat-source-1366x768.png',
});
await browser.close();
```

Repeat for `1920x1080`.

## 2. Capture EduProject

Use the existing Electron launch pattern:

```js
import { _electron as electron } from 'playwright';

const app = await electron.launch({
  args: ['out/main/index.js', `--user-data-dir=${profile}`],
  env: {
    ...process.env,
    OMNI_EDU_DATA_ROOT: data,
    OMNI_EDU_REPO_ROOT: repoRoot,
    OMNI_EDU_XIAOZHI_PI: '1',
    OMNI_EDU_E2E_VISIBLE: '1',
  },
});
const page = await app.firstWindow();
await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible' });
await page.locator('[data-slot="chat-source"]').first().screenshot({
  path: 'test-results/heroui-parity/app-chat-source-1366x768.png',
});
```

Do not hide the app window for visual checks unless the screenshot is still reliable; a hidden background window can fail to produce a Playwright window.

## 3. Compare DOM

Check the same `data-slot`, `data-source-type`, and BEM class structure:

```js
const anatomy = await page.locator('[data-slot="chat-source"]').first().evaluate((el) => ({
  className: el.className,
  slot: el.getAttribute('data-slot'),
  sourceType: el.getAttribute('data-source-type'),
  children: [...el.querySelectorAll('[data-slot]')].map((node) => node.getAttribute('data-slot')),
}));
```

Expected for a URL `ChatSource`:

```text
chat-source
chat-source-trigger
chat-source-icon (or fallback)
chat-source-title
chat-source-preview (only when preview enabled)
```

## 4. Compare computed styles

Capture the values that determine layout and typography:

```js
const styles = await page.locator('[data-slot="chat-source"]').first().evaluate((el) => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    display: s.display,
    gap: s.gap,
    padding: s.padding,
    border: s.border,
    borderRadius: s.borderRadius,
    background: s.backgroundColor,
    color: s.color,
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    width: r.width,
    height: r.height,
  };
});
```

Compare the demo and app values. Differences caused by host theme tokens are acceptable only if the user approved the theme adaptation; otherwise they indicate a style mismatch.

## 5. Compare states

For each component, capture the states it owns:

- default
- hover
- focus-visible
- expanded/collapsed
- preview open
- long title/overflow
- empty/loading/error when applicable

Use Playwright actions, not synthetic CSS class changes, so state transitions are real.

## 6. Evidence file

Write a small report:

```json
{
  "component": "ChatSource",
  "sourceCommit": "eabeaa7...",
  "viewports": ["1366x768", "1920x1080"],
  "demoScreenshots": ["..."],
  "appScreenshots": ["..."],
  "domMatch": true,
  "computedStyleDeltas": [],
  "interactionChecks": ["url opens via host", "preview open/close", "keyboard focus"],
  "unverified": [],
  "testCommand": "...",
  "testResult": "..."
}
```

Do not call it “100%” if any required state or viewport is missing.
