import assert from 'node:assert/strict';

/** Compare to the actual trusted input, not a snapshot taken before pending
 * layout/auto-follow commits. Never accepts synthetic wheels or a return to bottom.
 */
export function verifyUpwardNavigation({initialScrollTop, scrollTop, wheels, inputs}) {
  assert(Number.isFinite(initialScrollTop) && Number.isFinite(scrollTop), 'A10_NAVIGATION_GEOMETRY_MISSING');
  const first = wheels.find(wheel => wheel.trusted && wheel.inside && wheel.deltaY < 0);
  assert(first && Number.isFinite(first.scrollTop), 'A10_TRUSTED_UPWARD_WHEEL_MISSING');
  const input = inputs?.[0];
  assert(input && Number.isFinite(input.scrollTop) && Number.isFinite(input.at)
    && first.at >= input.at, 'A10_PRE_INPUT_SAMPLE_MISSING');
  const proof = {
    beforeCandidateScrollTop:initialScrollTop, beforeInputScrollTop:input.scrollTop,
    eventScrollTop:first.scrollTop, finalScrollTop:scrollTop, upwardDistance:input.scrollTop-scrollTop,
    wheelCount:wheels.length, inputAt:first.at,
  };
  assert(proof.upwardDistance >= 20, 'A10_REAL_UPWARD_SCROLL_NOT_OBSERVED ' + JSON.stringify(proof));
  return proof;
}
