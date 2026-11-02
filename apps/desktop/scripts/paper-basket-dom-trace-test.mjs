import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installPaperBasketDomTrace} from './acceptance/paper-basket-dom-trace.mjs';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const keys = ['window', 'document', 'Element', 'MutationObserver'];
const prior = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const key of keys) Object.defineProperty(globalThis, key, {value: dom.window[key], configurable: true});
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
try {
  installPaperBasketDomTrace();
  const root = document.createElement('div');
  root.dataset.testid = 'paper-basket-workspace'; root.dataset.basketId = 'unit-basket'; root.dataset.stage = 'organize';
  root.textContent = 'PRIVATE_QUESTION_TEXT_NEVER_RECORD';
  document.body.append(root); await flush();
  root.dataset.basketId = ''; await flush();
  root.dataset.basketId = 'unit-basket'; await flush();
  const replacement = root.cloneNode(true);
  root.replaceWith(replacement); await flush();
  window.__paperBasketDomTrace.mark('cold-ready-returned');
  const trace = window.__paperBasketDomTrace.snapshot();
  const mounts = trace.events.filter(event => event.kind === 'mount');
  assert.equal(mounts.length, 2);
  assert.notEqual(mounts[0].node, mounts[1].node, 'Remount must have a different node identity');
  assert(trace.events.some(event => event.kind === 'unmount' && event.node === mounts[0].node));
  assert(trace.events.some(event => event.kind === 'attribute' && event.node === mounts[0].node && event.value === ''));
  assert.equal(trace.current[0].node, mounts[1].node);
  assert.equal(trace.events.at(-1).name, 'cold-ready-returned');
  assert(!JSON.stringify(trace).includes('PRIVATE_QUESTION_TEXT'));
  for (let i = 0; i < 1100; i++) window.__paperBasketDomTrace.mark('unit bounded');
  const bounded = window.__paperBasketDomTrace.snapshot();
  assert.equal(bounded.events.length, 1000); assert(bounded.dropped > 0);
  console.log(JSON.stringify({success: true, passed: 3, scope: 'QA observer distinguishes same-node reset/remount, excludes content, bounds retained metadata; no app/model'}));
} finally {
  for (const key of keys) {
    if (prior[key]) Object.defineProperty(globalThis, key, prior[key]); else delete globalThis[key];
  }
  dom.window.close();
}
