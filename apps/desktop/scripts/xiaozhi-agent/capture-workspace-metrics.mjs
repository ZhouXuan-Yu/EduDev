import fs from 'node:fs';
import path from 'node:path';

/** Read actual renderer geometry/style and owned Electron window; never model state. */
export async function captureWorkspaceMetrics(page, app, directory, name) {
  const renderer = await page.evaluate(() => {
    const selectors = {
      workspace: '[data-testid="xiaozhi-pi-workspace"]', sidebar: '[data-testid="ai-conversation-sidebar"]',
      header: '.ai-chat-header', conversation: '[data-testid="office-conversation"]',
      readingColumn: '.office-conversation-content', composer: '.office-composer-container',
      input: '[data-testid="office-prompt-input"]', inspection: '[data-testid="xiaozhi-pi-inspector"]',
      assistant: '[data-slot="chat-message-assistant"]', tool: '.office-tool [data-slot="chat-tool-trigger"]',
      assistantText: '[data-slot="chat-message-assistant"] [data-slot="markdown"] p',
      composerShell: '.office-composer [data-slot="prompt-input-shell"]',
      toolbar: '.office-composer [data-slot="prompt-input-toolbar"]',
      sidebarHeading: '.pi-conversation-sidebar .ai-session-header h2',
      sidebarTitle: '.pi-conversation-sidebar .chat-list-view__title',
    };
    const regions = Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
      const element = document.querySelector(selector);
      if (!element) return [name, { selector, present: false }];
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return [name, { selector, present: true, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, color: style.color,
        background: style.backgroundColor, borderRadius: style.borderRadius, padding: style.padding, gap: style.gap }];
    }));
    const buttons = Array.from(document.querySelectorAll('.office-composer [data-slot="prompt-input-toolbar"] button')).map(element => {
      const rect = element.getBoundingClientRect();
      return { name: element.getAttribute('aria-label') || element.textContent, disabled: element.disabled,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
    });
    return { viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio, toolbarButtons: buttons,
      visualViewport: { width: visualViewport?.width, height: visualViewport?.height, scale: visualViewport?.scale },
      screen: { width: screen.width, height: screen.height }, regions };
  });
  const native = await app.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows()[0];
    return { bounds: window?.getBounds(), contentBounds: window?.getContentBounds(),
      zoomFactor: window?.webContents.getZoomFactor(), displayScaleFactor: screen.getPrimaryDisplay().scaleFactor };
  });
  fs.mkdirSync(directory, { recursive: true });
  const screenshot = path.join(directory, `${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  const bytes = fs.readFileSync(screenshot);
  const result = { schemaVersion: 1, name, capturedAt: new Date().toISOString(), renderer, native,
    screenshot: { file: path.basename(screenshot), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } };
  fs.writeFileSync(path.join(directory, `${name}.json`), JSON.stringify(result, null, 2));
  return result;
}
