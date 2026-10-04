// @ts-nocheck
// Hana0.449.0/Apache-2.0. Original function bodies preserved; see source-manifest.json.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
// This project uses installed system fonts; Hana product font resources are not present.
function buildFontInjectionCss(){throw new Error('configuration');}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function waitForPageAssets(webContents, settleMs) {
  if (settleMs > 0) await delay(settleMs);
  try {
    await webContents.executeJavaScript(`
      Promise.all([
        document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
        Promise.all(Array.from(document.images || []).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        })),
      ]).then(() => true)
    `, true);
  } catch {
    // javascript=false pages can reject executeJavaScript. Load completion plus settleMs
    // is still deterministic enough for static HTML/CSS.
  }
}

export async function renderHanaPdfJob(job, BrowserWindow) {
  // 注入素材在开窗口前构建：字体资源缺失时显式失败，不静默产出回退字体的 PDF。
  const fontCss = job.embedHanaFonts ? buildFontInjectionCss() : null;

  const win = new BrowserWindow({
    show: false,
    width: job.viewport.width,
    height: job.viewport.height,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      javascript: job.allowJavaScript,
    },
  });

  try {
    const url = pathToFileURL(job.htmlPath).href;
    await withTimeout(win.loadURL(url), job.timeoutMs, "loadURL");
    if (fontCss) {
      // 只声明 @font-face：页面字体栈引用这些族名才会触发按 unicode-range 的
      // 惰性加载，未引用的页面零影响。waitForPageAssets 的 document.fonts.ready
      // 会等注入字体加载完成。
      await withTimeout(win.webContents.insertCSS(fontCss), job.timeoutMs, "font css inject");
    }
    await withTimeout(waitForPageAssets(win.webContents, job.settleMs), job.timeoutMs, "asset wait");
    const pdf = await withTimeout(
      win.webContents.printToPDF({
        printBackground: job.printBackground,
        preferCSSPageSize: job.preferCSSPageSize,
        pageSize: job.pageSize,
        landscape: job.landscape,
        ...(job.margins ? { margins: job.margins } : {}),
      }),
      job.timeoutMs,
      "printToPDF",
    );
    fs.mkdirSync(path.dirname(job.outputPath), { recursive: true });
    fs.writeFileSync(job.outputPath, pdf);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}
