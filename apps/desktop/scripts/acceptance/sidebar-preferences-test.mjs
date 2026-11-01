import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const key of ['window','document','navigator','localStorage','Node','Element','HTMLElement','HTMLButtonElement','HTMLInputElement','HTMLTextAreaElement','SVGElement','MutationObserver','Event','MouseEvent','KeyboardEvent','CustomEvent','Document','ShadowRoot','NodeFilter']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.matchMedia = dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const server = await createServer({ configFile: false, appType: 'custom', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null, ws: false } });
let root, passed = 0;
async function check(name, run) { await run(); passed++; console.log('PASS ' + name); }
try {
  const prefs = await server.ssrLoadModule('/src/renderer/ui-system/workbench-preferences.ts');
  const legacy = await server.ssrLoadModule('/src/renderer/components/office/workspace-preferences.ts');
  const { WorkbenchProvider, useWorkbenchPreferences } = await server.ssrLoadModule('/src/renderer/ui-system/WorkbenchState.tsx');
  const { WorkbenchNavigation } = await server.ssrLoadModule('/src/renderer/ui-system/WorkbenchNavigation.tsx');
  const key = prefs.WORKBENCH_PREFERENCES_KEY, oldKey = legacy.WORKSPACE_PREFERENCES_KEY;
  await check('legacy-only collapsed choice migrates without losing panel defaults', () => {
    localStorage.clear(); localStorage.setItem(oldKey, JSON.stringify({ schema: 1, sidebar: false, aside: true, files: true }));
    assert.equal(prefs.readWorkbenchPreferences().collapsed, true);
    assert.deepEqual(legacy.readWorkspacePreferences(), { sidebar: false, aside: true, files: true });
  });
  await check('valid modern collapse wins over conflicting legacy state and survives a cold read', () => {
    localStorage.setItem(key, JSON.stringify({ schema: 1, collapsed: false, expanded: { teaching: true }, openFolders: { lesson: true } }));
    assert.equal(prefs.readWorkbenchPreferences().collapsed, false);
    assert.equal(legacy.readWorkspacePreferences().sidebar, true);
    assert.equal(prefs.readWorkbenchPreferences().openFolders.lesson, true);
  });
  await check('malformed or unknown modern records fall back to valid old metadata', () => {
    for (const raw of ['broken', JSON.stringify({ schema: 999, collapsed: false })]) {
      localStorage.setItem(key, raw); assert.equal(prefs.readWorkbenchPreferences().collapsed, true);
    }
    localStorage.setItem(oldKey, JSON.stringify({ schema: 999, sidebar: false, aside: true }));
    assert.equal(prefs.readWorkbenchPreferences().collapsed, false);
  });
  await check('successful canonical update mirrors only safe legacy fields and retains panel settings', () => {
    localStorage.clear(); localStorage.setItem(oldKey, JSON.stringify({ schema: 1, sidebar: true, aside: true, files: true, path: 'not-authority' }));
    const next = { ...prefs.defaultWorkbenchPreferences, collapsed: true, openFolders: { lesson: true } };
    assert(prefs.writeWorkbenchPreferences(next));
    assert.deepEqual(JSON.parse(localStorage.getItem(oldKey)), { schema: 1, sidebar: false, aside: true, files: true });
    assert.deepEqual(prefs.readWorkbenchPreferences(), next);
    // A stale panel closure must not re-expand navigation when it saves files.
    assert(legacy.writeWorkspacePreferences({ sidebar: true, aside: false, files: false }));
    assert.equal(legacy.readWorkspacePreferences().sidebar, false);
    assert.equal(prefs.readWorkbenchPreferences().collapsed, true);
  });
  await check('either storage-key failure rejects update and restores the old persistent choice', () => {
    const original = dom.window.Storage.prototype.setItem;
    const before = [localStorage.getItem(key), localStorage.getItem(oldKey)];
    for (const blocked of [oldKey, key]) {
      dom.window.Storage.prototype.setItem = function(name, value) { if (name === blocked) throw Error('owned storage unavailable'); return original.call(this, name, value); };
      try { assert.equal(prefs.writeWorkbenchPreferences({ ...prefs.defaultWorkbenchPreferences, collapsed: false }), false); }
      finally { dom.window.Storage.prototype.setItem = original; }
      assert.deepEqual([localStorage.getItem(key), localStorage.getItem(oldKey)], before);
    }
  });
  let shared;
  function Probe() { shared = useWorkbenchPreferences(); return React.createElement('output', { id: 'setting-value' }, String(!shared.preferences.collapsed)); }
  const mount = async () => {
    root = createRoot(document.getElementById('root'));
    await React.act(async () => root.render(React.createElement(WorkbenchProvider, null, React.createElement(React.Fragment, null,
      React.createElement(WorkbenchNavigation, { view: 'ai' }), React.createElement(Probe)))));
  };
  await check('actual navigation toggle and settings consumer share one authority across remounts', async () => {
    await mount(); assert.equal(document.querySelector('[data-testid="edu-navigation"]').getAttribute('data-collapsed'), 'true');
    await React.act(async () => document.querySelector('[data-testid="workbench-sidebar-toggle"]').click());
    assert.equal(document.getElementById('setting-value').textContent, 'true');
    await React.act(async () => assert(shared.update({ collapsed: true })));
    assert.equal(document.querySelector('[data-testid="edu-navigation"]').getAttribute('data-collapsed'), 'true');
    assert(document.querySelector('[data-testid="nav-settings"]'), 'icon rail retains settings destination');
    await React.act(async () => root.unmount()); root = undefined; await mount();
    assert.equal(shared.preferences.collapsed, true);
  });
  await check('failed shared-state save leaves actual navigation unchanged and exposes a real failure', async () => {
    const original = dom.window.Storage.prototype.setItem;
    dom.window.Storage.prototype.setItem = function(name, value) { if (name === oldKey) throw Error('owned storage unavailable'); return original.call(this, name, value); };
    try {
      await React.act(async () => assert.equal(shared.update({ collapsed: false }), false));
      assert.equal(document.getElementById('setting-value').textContent, 'false');
      await React.act(async () => document.querySelector('[data-testid="workbench-sidebar-toggle"]').click());
      assert.match(document.querySelector('[role="alert"]').textContent, /未能保存界面偏好/);
      assert.equal(document.querySelector('[data-testid="edu-navigation"]').getAttribute('data-collapsed'), 'true');
    } finally { dom.window.Storage.prototype.setItem = original; }
  });
  console.log(JSON.stringify({ ok: true, checks: passed, boundary: 'Real provider/navigation + synthetic storage; settings screen/cold Electron/backup acceptance remains parent-owned.' }));
} finally {
  if (root) await React.act(async () => root.unmount());
  await server.close(); dom.window.close();
}
