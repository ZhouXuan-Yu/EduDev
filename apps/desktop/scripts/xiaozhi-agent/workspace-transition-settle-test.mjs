import assert from 'node:assert/strict';
import test from 'node:test';
import {settleWorkspaceTransitions} from './capture-workspace-metrics.mjs';

async function fixture(hiddenSnapshot) {
  const previous = new Map(['document', 'Element', 'getComputedStyle'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  class Target { getClientRects() { return [{}]; } }
  let finishes = 0;
  const animation = endTime => ({playState:'running', pending:false, currentTime:0,
    effect:{target:new Target(), getComputedTiming:()=>({endTime})},
    finish() { finishes++; this.playState='finished'; }});
  const finite=animation(75), infinite=animation(Infinity);
  for(const [key,value] of Object.entries({document:{getAnimations:()=>[finite,infinite]},Element:Target,getComputedStyle:()=>({visibility:'visible'})})) Object.defineProperty(globalThis,key,{value,configurable:true});
  const start=Date.now();
  const timer = hiddenSnapshot ? null : setTimeout(()=>{finite.playState='finished';},30);
  try {
    const result=await settleWorkspaceTransitions({evaluate:(fn,arg)=>fn(arg)},{hiddenSnapshot});
    return {result,finishes,elapsed:Date.now()-start,infiniteState:infinite.playState};
  } finally {
    if(timer)clearTimeout(timer);
    for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
}
test('visible-window finite transition completes naturally; no finish or infinite-animation mutation',async()=>{
  const {result,finishes,elapsed,infiniteState}=await fixture(false);
  assert.equal(finishes,0);assert(elapsed>=30);assert.deepEqual(result.durations,[75]);
  assert.equal(result.advancedHiddenSnapshot,false);assert.equal(infiniteState,'running');
});
test('explicit hidden snapshot may finish finite transitions only',async()=>{
  const {result,finishes,infiniteState}=await fixture(true);
  assert.equal(finishes,1);assert.equal(result.count,1);assert.deepEqual(result.durations,[75]);
  assert.equal(result.advancedHiddenSnapshot,true);assert.equal(infiniteState,'running');
});
