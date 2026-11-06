import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyUpwardNavigation} from './chat-reading-navigation.mjs';

const wheel = {trusted:true, inside:true, deltaY:-120, scrollTop:100, at:50};
const inputs=[{scrollTop:100,at:49}];
test('A pending layout before the trusted wheel is distinct from upward movement', () => {
  // Original candidate at 0, admitted-message layout at 100, real wheel to 70.
  // The old 0-70 expression falsely fails despite 30px actual upward navigation.
  assert(0-70<20);
  const proof=verifyUpwardNavigation({initialScrollTop:0,scrollTop:70,wheels:[wheel],inputs});
  assert.equal(proof.upwardDistance,30); assert.equal(proof.beforeCandidateScrollTop,0);
  assert.equal(proof.beforeInputScrollTop,100);
});
test('Synthetic, external, downward or absent wheel input is rejected', () => {
  for (const wheels of [[],[{...wheel,trusted:false}],[{...wheel,inside:false}],[{...wheel,deltaY:120}]])
    assert.throws(() => verifyUpwardNavigation({initialScrollTop:100,scrollTop:50,wheels}),/TRUSTED/);
});
test('No movement, insufficient movement and forced return remain failures', () => {
  for (const scrollTop of [100,81,140])
    assert.throws(() => verifyUpwardNavigation({initialScrollTop:100,scrollTop,wheels:[wheel],inputs}),/REAL_UPWARD_SCROLL/);
});
test('Diagnostics contain only trusted input and geometry metadata', () => {
  const proof=verifyUpwardNavigation({initialScrollTop:100,scrollTop:80,wheels:[{...wheel,selectedText:'PRIVATE_SENTINEL'}],inputs});
  assert(!JSON.stringify(proof).includes('PRIVATE_SENTINEL'));
  assert.throws(() => verifyUpwardNavigation({initialScrollTop:NaN,scrollTop:80,wheels:[wheel]}),/GEOMETRY/);
});
test('Compositor scrolling may precede wheel delivery and still needs a pre-input sample', () => {
  const proof=verifyUpwardNavigation({initialScrollTop:0,scrollTop:70,wheels:[{...wheel,scrollTop:70}],inputs});
  assert.equal(proof.upwardDistance,30);
  assert.throws(()=>verifyUpwardNavigation({initialScrollTop:100,scrollTop:70,wheels:[wheel]}),/PRE_INPUT/);
  assert.throws(()=>verifyUpwardNavigation({initialScrollTop:100,scrollTop:70,wheels:[wheel],inputs:[{scrollTop:100,at:51}]}),/PRE_INPUT/);
});
