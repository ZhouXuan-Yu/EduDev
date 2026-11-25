import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createProviderHealth, ProviderHealthBlocked} from '../../src/main/xiaozhi-agent/provider-health.ts';

function clock(maxDomains) {
  let time = 1000;
  return {health: createProviderHealth({now: () => time, random: () => 0, maxDomains}),
    advance: ms => {time += ms;}};
}
const failure = {kind: 'dependency_failure'};
const verified = {kind: 'verified'};
const ignored = {kind: 'ignored'};
function raiseThree(health, key) {
  for (let index = 0; index < 3; index++) health.begin(key, false).complete(failure);
}
function blocked(reason) {
  return error => error instanceof ProviderHealthBlocked && error.reason === reason;
}

test('only physical dependency failures in the rolling window can open the domain', () => {
  const {health, advance} = clock();
  const one = health.begin('alpha', false);
  one.complete(failure);
  one.complete(failure);
  assert.equal(health.snapshot('alpha').failures, 1);
  health.begin('alpha', false).complete(ignored);
  assert.equal(health.snapshot('alpha').failures, 1);
  advance(60_001);
  health.begin('alpha', false).complete(failure);
  assert.equal(health.snapshot('alpha').failures, 1);
  health.begin('alpha', false).complete(failure);
  health.begin('alpha', false).complete(failure);
  assert.equal(health.snapshot('alpha').phase, 'open');
  assert.throws(() => health.begin('alpha', false), blocked('cooldown'));
  health.begin('bravo', false).complete(verified);
  assert.equal(health.snapshot('bravo').phase, 'closed');
});

test('an open domain waits for earlier physical custody, then admits one verified probe', () => {
  const {health, advance} = clock();
  const draining = health.begin('alpha', false);
  raiseThree(health, 'alpha');
  advance(10_000);
  assert.throws(() => health.begin('alpha', true), blocked('active'));
  draining.complete(verified);
  assert.equal(health.snapshot('alpha').phase, 'open');
  const probe = health.begin('alpha', true);
  for (let index = 0; index < 10; index++) assert.throws(() => health.begin('alpha', true), blocked('active'));
  probe.complete(ignored);
  assert.equal(health.snapshot('alpha').phase, 'open');
  const next = health.begin('alpha', true);
  next.complete(verified);
  assert.deepEqual(health.snapshot('alpha'), {phase: 'closed', failures: 0, active: 0, retryAt: 0});
});

test('a failed probe backs off and a longer Retry-After cannot be crossed', () => {
  const {health, advance} = clock();
  raiseThree(health, 'alpha');
  advance(10_000);
  health.begin('alpha', true).complete({...failure, retryAfterMs: 120_000});
  assert.equal(health.snapshot('alpha').retryAt, 131_000);
  advance(119_999);
  assert.throws(() => health.begin('alpha', true), blocked('cooldown'));
  advance(1);
  health.begin('alpha', true).complete(failure);
  assert.equal(health.snapshot('alpha').retryAt, 171_000);
  advance(-50_000);
  assert.throws(() => health.begin('alpha', true), blocked('cooldown'));
});

test('retirement fences old results and budgeted cache eviction keeps active domains', () => {
  const {health} = clock(2);
  const old = health.begin('alpha', true);
  health.begin('bravo', false).complete(verified);
  const charlie = health.begin('charlie', true);
  assert.equal(health.snapshot('bravo').phase, 'unknown');
  health.retire('alpha');
  assert.throws(() => health.begin('alpha', true), blocked('active'));
  assert.throws(() => health.begin('delta', true), blocked('capacity'));
  old.complete(verified);
  assert.deepEqual(health.snapshot('alpha'), {phase: 'unknown', failures: 0, active: 0, retryAt: 0});
  health.begin('delta', true).complete(failure);
  charlie.complete(verified);
});
