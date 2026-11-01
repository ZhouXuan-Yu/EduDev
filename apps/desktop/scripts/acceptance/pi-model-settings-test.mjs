import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost', pretendToBeVisual: true,
});
for (const name of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'MutationObserver', 'SVGElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'PointerEvent', 'CustomEvent', 'HTMLAnchorElement', 'Document', 'ShadowRoot', 'NodeFilter']) {
  globalThis[name] = name === 'window' ? dom.window : name === 'document' ? dom.window.document : dom.window[name];
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.requestAnimationFrame = callback => setTimeout(() => callback(Date.now()), 0);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
globalThis.ResizeObserver = dom.window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  appType: 'custom', optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false, watch: null, ws: false },
});
let root, passed = 0;
const check = async (name, run) => { await run(); passed++; console.log('PASS ' + name); };
const model = { id: 'deepseek-flash', name: 'DeepSeek Flash', contextWindow: 1048576, maxOutputTokens: 393216 };
const base = {
  schemaVersion: 'xiaozhi.settings.v1', version: 4, provider: 'deepseek',
  configured: false, maskedApiKey: '', defaultModel: model.id, locked: false,
  models: [], catalogue: 'unavailable',
  web: { schemaVersion: 'xiaozhi.web.v1', version: 0, enabled: true, dnsMode: 'auto' },
};
const node = id => document.querySelector(`[data-testid="${id}"]`);
const text = () => node('pi-model-settings').textContent;
try {
  const { PiModelSettings } = await server.ssrLoadModule('/src/renderer/components/office/PiModelSettings.tsx');
  async function mount(view, overrides = {}) {
    if (root) await React.act(async () => root.unmount());
    window.omniEdu = {
      getXiaozhiSettings: async () => ({ ok: true, value: structuredClone(view) }),
      onXiaozhiEvent: () => () => {}, ...overrides,
    };
    root = createRoot(document.getElementById('root'));
    await React.act(async () => root.render(React.createElement(PiModelSettings, { onBack() {}, embedded: true })));
  }
  await check('empty catalogue renders no stray numeric zero and keeps the real empty state', async () => {
    await mount(base);
    const walker = document.createTreeWalker(node('pi-model-settings'), NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode.textContent.trim());
    assert(!nodes.includes('0'), 'empty-array length must not render as a text node');
    assert(!node('pi-settings-model-unavailable'));
    assert.match(text(), /模型目录尚未读取/);
    assert(node('pi-settings-default-model').disabled);
  });
  await check('section headings remain separately named and source/refresh privacy hints are retained', async () => {
    assert.deepEqual([...document.querySelectorAll('.pi-model-settings-section h2')].map(el => el.textContent), ['DeepSeek', '可用模型', '默认思考强度']);
    assert.match(text(), /不发送教学问题或继续旧任务/);
    assert.match(text(), /原始文件和学生图片保留在本机/);
    assert.match(text(), /不修改系统网络设置/);
    assert(node('pi-web-settings')); assert(node('pi-provider-balance'));
    assert.equal(node('pi-settings-key').type, 'password');
  });
  await check('configured model list and explicit accessible default-model control remain available', async () => {
    await mount({ ...base, configured: true, maskedApiKey: 'masked-only', models: [model], catalogue: 'official' });
    assert.match(node('pi-settings-configured').textContent, /masked-only/);
    assert.match(node('pi-settings-model-list').textContent, /1,048,576/);
    assert.match(node('pi-settings-model-list').textContent, /393,216/);
    assert.equal(node('pi-settings-default-model').getAttribute('aria-label'), '新对话默认模型');
    assert(!node('pi-settings-default-model').disabled);
    assert(!node('pi-settings-model-unavailable'));
  });
  await check('removed default model still shows the original actionable warning', async () => {
    await mount({ ...base, models: [model], defaultModel: 'removed-model', catalogue: 'cache' });
    assert.match(node('pi-settings-model-unavailable').textContent, /removed-model/);
    assert.match(node('pi-settings-model-unavailable').textContent, /请选择可用模型/);
  });
  await check('running task still locks model/key/save and retains the task-lock notice', async () => {
    await mount({ ...base, models: [model], locked: true });
    for (const id of ['pi-settings-key', 'pi-settings-default-model', 'pi-settings-verify', 'pi-settings-save']) assert(node(id).disabled, id);
    assert.match(text(), /小智正在处理任务，结束后可修改配置/);
    assert(node('pi-web-save').disabled);
  });
  await check('credential and catalogue failures remain visible with their original alert semantics', async () => {
    await mount({ ...base, credentialError: 'storage_unavailable', catalogueError: 'authentication' });
    assert.equal(node('pi-settings-credential-error').getAttribute('role'), 'alert');
    assert.match(node('pi-settings-credential-error').textContent, /安全存储暂时不可用/);
    assert.equal(node('pi-settings-catalogue-error').getAttribute('role'), 'alert');
    assert.match(node('pi-settings-catalogue-error').textContent, /密钥未通过验证/);
  });
  await check('form submit retains versioned save payload, new-conversation semantics and public feedback', async () => {
    const calls = [];
    await mount({ ...base, models: [model] }, { saveXiaozhiSettings: async input => { calls.push(input); return { ok: true, value: { ...base, models: [model], version: 5 } }; } });
    await React.act(async () => node('pi-settings-save').closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    assert.deepEqual(calls, [{ schemaVersion: base.schemaVersion, version: 4, defaultModel: model.id }]);
    assert.match(node('pi-settings-feedback').textContent, /已有对话继续使用原模型/);
  });
  console.log(`PiModelSettings ${passed}/${passed} passed (component only; no Electron/model/build).`);
} finally {
  if (root) await React.act(async () => root.unmount());
  await server.close(); dom.window.close();
}
