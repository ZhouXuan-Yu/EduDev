import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

export async function paperRendererEnvironment({plugins=[]}={}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url: 'http://localhost', pretendToBeVisual: true});
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLButtonElement',
    'HTMLSelectElement', 'Document', 'DocumentFragment', 'NodeFilter', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'PointerEvent',
    'KeyboardEvent', 'FocusEvent', 'SVGElement', 'getComputedStyle', 'localStorage', 'sessionStorage', 'MutationObserver'];
  const prior = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, {value: dom.window[key], configurable: true});
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame = fn => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame = clearTimeout;
  globalThis.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
  globalThis.matchMedia = dom.window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}});
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.Element.prototype.getAnimations = () => [];
  const {createRoot} = await import('react-dom/client');
  const server = await createServer({configFile: false, appType: 'custom',plugins, optimizeDeps: {noDiscovery: true},
    server: {middlewareMode: true, hmr: false, ws: false, watch: null}});
  const root = createRoot(document.getElementById('root'));
  const run = (fn = () => {}, ms = 5) => React.act(async () => {await fn(); await new Promise(resolve => setTimeout(resolve, ms));});
  const load = path => server.ssrLoadModule('/src/' + path);
  const find = id => document.querySelector(`[data-testid="${id}"]`);
  const press = element => run(() => {
    assert(element, 'Missing actual component press target');
    for (const type of ['pointerdown', 'pointerup']) element.dispatchEvent(new window.PointerEvent(type, {pointerId: 1,
      pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0, bubbles: true, cancelable: true}));
    element.dispatchEvent(new window.MouseEvent('click', {button: 0, detail: 1, bubbles: true, cancelable: true}));
  });
  const fill = (element, value) => run(() => {
    assert(element, 'Missing actual component text field');
    const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new window.Event('input', {bubbles: true}));
  });
  return {React, root, run, load, find, press, fill, dom, async close() {
    await run(() => root.unmount()); await server.close(); dom.window.close();
    for (const key of keys) {if (prior[key]) Object.defineProperty(globalThis, key, prior[key]); else delete globalThis[key];}
  }};
}
