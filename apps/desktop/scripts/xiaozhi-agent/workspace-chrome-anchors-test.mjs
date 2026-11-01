import assert from 'node:assert/strict';
import test from 'node:test';
import {assertWorkspaceChrome} from './capture-workspace-metrics.mjs';

async function fixture({modern = true, missing = false, hiddenFirst = false, overflow = 0, moved = 0, clipped = false} = {}) {
  const keys = ['document', 'innerWidth', 'innerHeight'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const element = (className, y, testId, visible = true) => ({className, scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    getClientRects: () => visible ? [{}] : [], getAttribute: () => testId,
    getBoundingClientRect: () => ({x: 10, y, width: 1200, height: 50})});
  const header = element(modern ? 'edu-header' : 'ai-chat-header', 40, modern ? 'pi-workspace-header' : null);
  const input = element('prompt-input', clipped ? 740 : 600, 'office-prompt-input');
  const hidden = element('hidden-old-header', 40, 'pi-workspace-header', false);
  const parent = element(modern ? 'edu-chat-main' : 'ai-chat-surface', 40, null);
  parent.scrollHeight += overflow; parent.scrollTop = moved;
  const workspace = element('edu-shell', 40, 'xiaozhi-pi-workspace');
  const query = selector => {
    if (selector === '[data-testid="xiaozhi-pi-workspace"]') return modern ? [workspace] : [];
    if (selector === '[data-testid="pi-workspace-header"]') return modern && !missing ? hiddenFirst ? [hidden, header] : [header] : [];
    if (selector === '.ai-chat-header') return !modern && !missing ? [header] : [];
    if (selector === '[data-testid="office-prompt-input"]') return [input];
    return [parent];
  };
  workspace.querySelectorAll = query;
  for (const [key, value] of Object.entries({document: {querySelectorAll: query}, innerWidth: 1366, innerHeight: 768})) Object.defineProperty(globalThis, key, {value, configurable: true});
  try { return await assertWorkspaceChrome({evaluate: fn => fn()}); }
  finally { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
}
test('U2 real header anchor is sampled, skipping hidden duplicates', async () => {
  const result = await fixture({hiddenFirst: true}); assert.equal(result.anchors.header, 'pi-workspace-header');
});
test('legacy caller retains the old header fallback and result fields', async () => {
  const result = await fixture({modern: false}); assert.equal(result.anchors.header, '.ai-chat-header'); assert(result.header.rect && result.input.rect);
});
test('missing header is explicit failure rather than a skipped geometry check', async () => {
  await assert.rejects(fixture({missing: true}), /chrome anchors missing: header=false/);
});
test('hidden overflow tolerance remains one pixel', async () => {
  await fixture({overflow: 1}); await assert.rejects(fixture({overflow: 2}), /hidden overflow/);
});
test('chrome scrollTop must remain zero', async () => {
  await assert.rejects(fixture({moved: 1}), /moved the chrome/);
});
test('input clipping remains a failure', async () => {
  await assert.rejects(fixture({clipped: true}), /Header\/input clipped/);
});
