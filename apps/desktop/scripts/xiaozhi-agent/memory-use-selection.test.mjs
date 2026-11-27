import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planMemoryUse, dispatchMemoryUse } from '../../src/main/xiaozhi-agent/memory-use/selection.ts';

const pin = (id, layer = 'history') => ({
  layer, source: layer, id, version: 2, fingerprint: 'b'.repeat(64), sourceVersion: 'source-v2',
});
const fact = (ref, changes = {}) => ({
  ...ref, state: 'active', provenance: 'exact', scope: { classRef: 'class-b', termRef: 'term-2' },
  relevant: true, relevance: 0.5, ...changes,
});
const snapshot = (refs, changes = {}) => ({
  sessionId: 'session', requestId: 'request', authority: 'rev-1', scopeVersion: 2,
  scope: { classRef: 'class-b', termRef: 'term-2' }, enabled: true,
  selections: refs, preferences: [], named: [], availableTokens: 24000, ...changes,
});
const ids = plan => plan.items.map(item => item.id);

test('discovery, pending candidates and unverified summaries cannot publish identifiers or titles', () => {
  const refs = ['unselected-secret', 'candidate', 'surface', 'valid'].map(id => pin(id));
  const result = planMemoryUse(snapshot(refs.slice(1)), [
    fact(refs[0], {title:'private-title'}), fact(refs[1], {state:'candidate'}),
    fact(refs[2], {provenance:'surface_only'}), fact(refs[3]),
  ]);
  assert.deepEqual(ids(result), ['valid']);
  assert.doesNotMatch(JSON.stringify(result), /unselected-secret|private-title|surface_only|candidate/);
});
test('an adopted explicit preference is independent of history lookup permission', () => {
  const pref = pin('format', 'preference'), historical = pin('old');
  const context = snapshot([historical], {enabled:false, preferences:[pref, historical]});
  assert.deepEqual(ids(planMemoryUse(context, [fact(pref), fact(historical)])), ['format']);
  assert.deepEqual(ids(planMemoryUse(snapshot([pref]), [fact(pref)])), []);
});
test('requires all known scope dimensions and an explicit global scope for global records', () => {
  const ref = pin('exercise');
  for (const scope of [null, {}, {classRef:'class-a'}, {termRef:'term-1'}, {courseRef:'algebra'},
    {grade:'8'}, {unknown:'class-b'}, {classRef:''}, {teacher:'self', classRef:'class-a'}]) {
    assert.deepEqual(ids(planMemoryUse(snapshot([ref]), [fact(ref, {scope})])), []);
  }
  assert.deepEqual(ids(planMemoryUse(snapshot([ref]), [fact(ref, {scope:{teacher:'self'}})])), ['exercise']);
});
test('requires current pin, exact provenance, relevance and no current conflict', () => {
  const ref = pin('source');
  for (const delta of [{sourceVersion:'stale'}, {fingerprint:''}, {fingerprint:'c'.repeat(64)}, {version:3}, {state:'disabled'},
    {state:'forgotten'}, {state:'superseded'}, {relevant:false}, {conflicts:true}, {provenance:'none'}]) {
    assert.deepEqual(ids(planMemoryUse(snapshot([ref]), [fact(ref, delta)])), []);
  }
  assert.deepEqual(ids(planMemoryUse(snapshot([ref]), [fact(ref), fact(ref,{state:'disabled'})])), []);
  assert.deepEqual(ids(planMemoryUse(snapshot([ref]), [fact(ref),fact(ref)])), ['source']);
});
test('stable rank across permutations, named still needs permission, budget skips whole references', () => {
  const refs = ['c','b','a','new'].map(id => pin(id));
  const ctx = snapshot(refs.slice(0,3), {named:[refs[0],refs[3]]});
  const facts = refs.map(ref => fact(ref));
  const full = planMemoryUse(ctx, facts);
  assert.deepEqual(ids(full), ['c','a','b']);
  assert.deepEqual(full, planMemoryUse(ctx, facts.toReversed()));
  assert.equal(full.items[0].reason, 'named');
  const tiny = planMemoryUse({...ctx,availableTokens:18}, facts);
  assert.deepEqual(tiny.items, []);
  assert.equal(tiny.omitted, 3);
  assert.equal(tiny.projection, '');
  const bounded = planMemoryUse({...ctx,availableTokens:2000}, facts);
  assert.ok(Buffer.byteLength(bounded.projection) <= 100);
  if (bounded.projection) assert.deepEqual(JSON.parse(bounded.projection).map(row => row.id), ids(bounded));
});
test('refuses malformed scope, ambiguous grants and unsafe budget values', () => {
  const refs = Array.from({length:13}, (_,i)=>pin(String(i)));
  assert.deepEqual(planMemoryUse(snapshot(refs), refs.map(ref=>fact(ref))).items, []);
  assert.deepEqual(planMemoryUse(snapshot([refs[0],{...refs[0],version:1}]), [fact(refs[0])]).items, []);
  for (const availableTokens of [NaN, Infinity, -1]) {
    assert.deepEqual(planMemoryUse(snapshot([refs[0]], {availableTokens}), [fact(refs[0])]).items, []);
  }
});
test('late read, authority changes, task switch and cancellation never dispatch old refs', async () => {
  const ref = pin('old'), ctx = snapshot([ref]);
  for (const change of [{authority:'new'}, {requestId:'another'}, {sessionId:'other'}, {scopeVersion:3}]) {
    let current = ctx, count = 0;
    const result = await dispatchMemoryUse(ctx, async () => {current = {...ctx,...change}; return [fact(ref)];},
      () => current, () => {count++;});
    assert.equal(result.status,'invalidated');
    assert.equal(count,0);
  }
  const controller = new AbortController();
  assert.equal((await dispatchMemoryUse(ctx, async () => {controller.abort(); return [fact(ref)];},
    () => ctx, assert.fail, controller.signal)).status, 'cancelled');
});
test('disabled empty host scope makes no reads; source failure is distinct from empty; dispatch receipt is distinct from adherence', async () => {
  const ref = pin('a'), ctx = snapshot([ref]);
  assert.equal((await dispatchMemoryUse({...ctx,enabled:false}, assert.fail, () => ctx, assert.fail)).status,'empty');
  assert.equal((await dispatchMemoryUse(ctx, async () => {throw Error('offline');}, () => ctx, assert.fail)).status,'unavailable');
  let sent;
  assert.equal((await dispatchMemoryUse(ctx, async allowed => {assert.deepEqual(allowed,[ref]); return [fact(ref)];},
    () => ctx, plan => {sent = plan.projection;})).status,'dispatched');
  assert.equal(JSON.parse(sent)[0].id, 'a');
});
test('a stale direct reference cannot promote a different revision of the same source', () => {
  const a = pin('a'), b = pin('b');
  const ctx = snapshot([a,b], {named:[{...b,version:1}]});
  assert.deepEqual(ids(planMemoryUse(ctx,[fact(b),fact(a)])), ['a','b']);
});
test('conflicting preference pins are rejected before any host read', async () => {
  const pref = pin('format', 'preference');
  const ctx = snapshot([], {preferences:[pref,{...pref,fingerprint:'c'.repeat(64)}]});
  assert.equal((await dispatchMemoryUse(ctx,assert.fail,()=>ctx,assert.fail)).status, 'empty');
});
test('equal facts with different property insertion order have the same result', () => {
  const a = pin('a'), first = fact(a);
  const same = {...Object.fromEntries(Object.entries(first).reverse()),scope:{termRef:'term-2',classRef:'class-b'}};
  assert.deepEqual(ids(planMemoryUse(snapshot([a]),[first,same])), ['a']);
});

test('malformed authority or an unusable reference budget never starts a source read', async () => {
  const ref = pin('x'.repeat(100));
  const envelope = {layer:ref.layer, source:ref.source, id:ref.id, version:ref.version};
  const exact = Buffer.byteLength(JSON.stringify([envelope])) * 20;
  for (const [change, expected] of [
    [{enabled:'false'},'empty'], [{scopeVersion:-1},'invalidated'],
    [{availableTokens:0},'empty'], [{availableTokens:exact-1},'empty'],
  ]) {
    const ctx = snapshot([ref], change);
    let reads = 0, deliveries = 0;
    const receipt = await dispatchMemoryUse(ctx, async () => { reads++; return [fact(ref)]; },
      () => ctx, () => { deliveries++; });
    assert.deepEqual({reads,deliveries,status:receipt.status},{reads:0,deliveries:0,status:expected});
  }
  const ctx = snapshot([ref],{availableTokens:exact});
  let reads=0, deliveries=0;
  await dispatchMemoryUse(ctx, async () => { reads++; return [fact(ref)]; },
    () => ctx, () => { deliveries++; });
  assert.deepEqual([reads,deliveries],[1,1]);
});
