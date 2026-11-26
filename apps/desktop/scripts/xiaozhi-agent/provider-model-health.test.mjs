import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const {createProviderHealth} = await import('../../src/main/xiaozhi-agent/provider-health.ts');
const {createModelHealthScope} = await import('../../src/main/xiaozhi-agent/model-provider-health.ts');

function fixture() {
  let now = 1000, cancelled = false;
  const health = createProviderHealth({now: () => now, random: () => 0});
  const config = {health, keyForModel: id => id};
  const scope = id => createModelHealthScope(config, id, () => cancelled, () => {});
  return {health, scope, advance: amount => {now += amount;}, cancel: () => {cancelled = true;}};
}

test('HTTP success headers and SDK verification cannot release a body that has not settled', async () => {
  const {health, scope, advance} = fixture();
  for (let index = 0; index < 3; index++) health.begin('owned', false).complete({kind: 'dependency_failure'});
  advance(10_000);
  const model = scope('owned');
  let source;
  const wrapped = await model.begin().response(new Response(new ReadableStream({start(controller) {source = controller;}})));
  model.sdkResult(true);
  assert.equal(health.snapshot('owned').phase, 'half_open');
  assert.equal(health.snapshot('owned').active, 1);
  assert.throws(() => scope('owned').begin(), /provider_unavailable/u);
  source.close();
  await wrapped.text();
  assert.equal(health.snapshot('owned').phase, 'closed');
});

test('SDK end sentinel closes only after pending stream cancellation has actually settled', async () => {
  const {health, scope, advance} = fixture();
  for (let index = 0; index < 3; index++) health.begin('owned', false).complete({kind: 'dependency_failure'});
  advance(10_000);
  const model = scope('owned');
  let release;
  const cleanup = new Promise(resolve => {release = resolve;});
  const result = await model.begin().response(new Response(new ReadableStream({cancel: () => cleanup})));
  const closing = result.body.cancel();
  model.sdkResult(true);
  assert.equal(health.snapshot('owned').phase, 'half_open');
  assert.equal(health.snapshot('owned').active, 1);
  release();
  await closing;
  assert.deepEqual(health.snapshot('owned'), {phase: 'closed', failures: 0, active: 0, retryAt: 0});
});

test('HTTP 401, caller cancellation and short throttling retain the original health policy', async () => {
  const {health, scope, advance, cancel} = fixture();
  await (await scope('owned').begin().response(new Response('rejected', {status: 401}))).text();
  assert.equal(health.snapshot('owned').failures, 0);
  await (await scope('owned').begin().response(new Response('limited', {status: 429, headers: {'retry-after': '2'}}))).text();
  assert.equal(health.snapshot('owned').failures, 1);
  advance(1999);
  assert.throws(() => scope('owned').begin(), /provider_unavailable/u);
  advance(1);
  const next = scope('owned');
  const body = await next.begin().response(new Response(new ReadableStream()));
  cancel();
  await body.body.cancel();
  next.sdkResult(true);
  assert.equal(health.snapshot('owned').active, 0);
  assert.equal(health.snapshot('owned').failures, 1);
});

test('an interrupted wire response contributes exactly one fault and an invalid SDK result never verifies recovery', async () => {
  const {health, scope} = fixture();
  const first = scope('owned');
  const body = await first.begin().response(new Response(new ReadableStream({
    start(controller) {controller.error(new TypeError('terminated'));},
  })));
  await assert.rejects(body.text(), /terminated/u);
  first.sdkResult(false);
  assert.equal(health.snapshot('owned').failures, 1);
  const second = scope('owned');
  await (await second.begin().response(new Response('malformed stream'))).text();
  second.sdkResult(false);
  assert.equal(health.snapshot('owned').failures, 1);
  assert.equal(health.snapshot('owned').active, 0);
});
