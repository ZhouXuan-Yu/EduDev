import assert from 'node:assert/strict';
import test from 'node:test';
import {settingsBackgroundEvidence} from './settings-background-evidence.mjs';

// Canvas color decoding is a browser responsibility. Stub its pixel result to
// test format-independent delegation, ancestor compositing and the strict gate.
const pixels = new Map([
  ['rgb(24, 24, 27)', [24, 24, 27, 255]],
  ['rgb(255, 255, 255)', [255, 255, 255, 255]],
  ['color(srgb 1 1 1)', [255, 255, 255, 255]],
  ['color-mix(in oklab, white 100%, black)', [255, 255, 255, 255]],
  ['color(srgb 1 1 1 / 0)', [0, 0, 0, 0]],
  ['color(srgb 1 1 1 / 0.5)', [255, 255, 255, 128]],
  ['rgb(0, 0, 0)', [0, 0, 0, 255]],
]);
const style = values => ({getPropertyValue: key => values[key] || '', getPropertyPriority: () => ''});
async function probe(colors) {
  const originals = new Map(['document', 'CSS', 'getComputedStyle'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const context = {clearRect() {}, fillRect() {}, getImageData() { return {data: pixels.get(this.fillStyle)}; }};
  const node = colors.reduceRight((parentElement, raw) => ({parentElement, raw, tagName: 'DIV', id: '', className: 'field',
    style: style({}), getAttribute: () => null, matches: selector => selector === '.field'}), null);
  const rule = {selectorText: '.field', cssText: '.field { background-color: var(--field-background); }',
    style: style({'background-color': 'var(--field-background)'})};
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {
    createElement: () => ({getContext: () => context}),
    styleSheets: [{cssRules: [rule], href: 'fixture.css', disabled: false}],
  }});
  Object.defineProperty(globalThis, 'CSS', {configurable: true, value: {supports: (_property, value) => pixels.has(value)}});
  Object.defineProperty(globalThis, 'getComputedStyle', {configurable: true, value: element => ({backgroundColor: element.raw, color: 'rgb(24, 24, 27)', opacity: '1'})});
  try { return await settingsBackgroundEvidence({evaluate: (fn, arg) => fn(node, arg)}); }
  finally { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
}
for (const color of ['rgb(255, 255, 255)', 'color(srgb 1 1 1)', 'color-mix(in oklab, white 100%, black)']) {
  test(`white gate uses resolved pixels for ${color}`, async () => {
    const result = await probe([color]);
    assert.deepEqual(result.resolvedRGB, [255, 255, 255]); assert.equal(result.sum, 765);
    assert.equal(result.layers[0].rawComputed, color);
    assert.equal(result.layers[0].matchedBackgroundRules[0].selector, '.field');
    assert.equal(result.layers[0].matchedBackgroundRules[0].source.href, 'fixture.css');
  });
}
test('modern zero-alpha layer continues to its painted ancestor', async () => {
  const result = await probe(['color(srgb 1 1 1 / 0)', 'color(srgb 1 1 1)']);
  assert.deepEqual(result.resolvedRGB, [255, 255, 255]); assert.equal(result.layers.length, 2);
  assert.equal(result.layers[0].contribution, 0); assert.equal(result.layers[1].contribution, 1);
});
test('partial alpha composites with the actual dark ancestor and still fails >500', async () => {
  const result = await probe(['color(srgb 1 1 1 / 0.5)', 'rgb(0, 0, 0)']);
  assert.deepEqual(result.resolvedRGB, [128, 128, 128]); assert.equal(result.sum, 384); assert(!(result.sum > 500));
});
test('opaque dark background remains dark', async () => {
  const result = await probe(['rgb(0, 0, 0)', 'color(srgb 1 1 1)']);
  assert.equal(result.sum, 0); assert.equal(result.layers.length, 1); assert(!(result.sum > 500));
});
