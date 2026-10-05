import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

/** Wait for real finite theme/focus transitions; keep live infinite spinners. */
export async function settleWorkspaceTransitions(page, options={}) {
  return page.evaluate(async ({hiddenSnapshot}) => {
    const finite=document.getAnimations().filter(animation=>{
      const element=animation.effect?.target;
      return animation.playState==='running'&&Number.isFinite(animation.effect?.getComputedTiming().endTime)
        &&element instanceof Element&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden';
    });
    const durations=finite.map(animation=>animation.effect?.getComputedTiming().endTime);
    // Static screenshot policy only: Windows suppresses the compositor of a
    // hidden acceptance window even with backgroundThrottling=false. Advance
    // finite transitions to their real end styles, as screenshot animations:
    // 'disabled' does; leave infinite animations and product code untouched.
    // The caller checks native BrowserWindow.isVisible; Chromium can report
    // visibilityState=visible even when Windows has never shown that window.
    const advanced=hiddenSnapshot===true;
    if(advanced)for(const animation of finite)animation.finish();
    const remaining=Math.max(0,...finite.map(animation=>Number(animation.effect?.getComputedTiming().endTime)-Number(animation.currentTime||0)));
    const deadline=performance.now()+Math.min(10000,Math.max(2000,remaining+500));
    // Hidden Electron can reach finished/idle without resolving the captured
    // Animation.finished promise. Verify actual state instead of that receipt.
    while(finite.some(animation=>animation.playState==='running'||animation.pending)){
      if(performance.now()>deadline)throw new Error('Finite theme transition did not settle: '+JSON.stringify(finite.filter(a=>a.playState==='running'||a.pending).map(a=>({time:a.currentTime,end:a.effect?.getComputedTiming().endTime,target:a.effect?.target?.tagName,transition:a.transitionProperty}))));
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    return {count:finite.length,durations,advancedHiddenSnapshot:advanced};
  }, {hiddenSnapshot:options.hiddenSnapshot===true});
}

/** Chrome must never own hidden scroll; only history/side panes may scroll. */
export async function assertWorkspaceChrome(page) {
  const result = await page.evaluate(() => {
    const sample = element => {
      const rect = element.getBoundingClientRect();
      return { className: element.className, rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
        scrollTop: element.scrollTop, overflow: element.scrollHeight - element.clientHeight };
    };
    return {width: innerWidth, height: innerHeight, header: sample(document.querySelector('.ai-chat-header')),
      input: sample(document.querySelector('[data-testid="office-prompt-input"]')),
      parents: [...document.querySelectorAll('.pi-shell, .app-layout__body, .app-layout__main, .ai-chat-surface, .ai-conversation-frame')].map(sample)};
  });
  for (const parent of result.parents) {
    assert(parent.overflow <= 1, `${parent.className}: ${parent.overflow}px hidden overflow`);
    assert.equal(parent.scrollTop, 0, `${parent.className} moved the chrome`);
  }
  for (const part of [result.header, result.input]) {
    const r = part.rect;
    assert(r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 36 && r.x+r.width <= result.width+1 && r.y+r.height <= result.height+1, 'Header/input clipped');
  }
  return result;
}

/** Contrast of real foreground against the composed ancestor backgrounds. */
export async function measureTextContrast(locator, pseudo = null) {
  return locator.evaluate((element, pseudo) => {
    // Let Chromium convert its computed rgb/oklab/color-mix values to sRGB.
    // Parsing their numeric tokens as RGB yields false contrast failures.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    const rgba = value => {
      if (!CSS.supports('color', value)) throw new Error(`Unsupported computed color: ${value}`);
      context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
      const c = [...context.getImageData(0, 0, 1, 1).data]; return [...c.slice(0, 3), c[3]/255];
    };
    const rawForeground = rgba(getComputedStyle(element, pseudo).color);
    let opacity = pseudo ? Number(getComputedStyle(element, pseudo).opacity) : 1;
    for(let current=element;current;current=current.parentElement) opacity *= Number(getComputedStyle(current).opacity);
    let remaining = 1, background = [0, 0, 0];
    for (let current=element; current && remaining>0; current=current.parentElement) {
      const c=rgba(getComputedStyle(current).backgroundColor), alpha=c[3] ?? 1;
      background=background.map((v,i)=>v+(c[i]||0)*alpha*remaining); remaining*=1-alpha;
    }
    background=background.map(v=>v+255*remaining);
    const alpha=rawForeground[3]*opacity;
    const foreground=background.map((v,i)=>rawForeground[i]*alpha+v*(1-alpha));
    const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((v,c,i)=>v+c*[0.2126,0.7152,0.0722][i],0);
    const a=luminance(foreground), b=luminance(background);
    return { foreground, background, opacity, ratio: (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05) };
  }, pseudo);
}

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
