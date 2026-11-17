import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const {evaluateTaskPlanning} = await import('../../src/main/xiaozhi-agent/tasks/planning-policy.ts');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-planning-policy-'));
const facets = ['capabilities', 'dependencies', 'permissions', 'risk', 'artifacts', 'recovery'];
const base = () => ({stepCount: 1, dependencyEdges: 0, longRunning: false, requiredCapabilities: 1, unresolvedCapabilities: 0, selectedProviders: 1});
const ready = () => Object.fromEntries(facets.map(facet => [facet, {state: 'ready', references: ['owned:' + facet]}]));
const files = ['src/main/xiaozhi-agent/tasks/planning-policy.ts', 'scripts/xiaozhi-agent/phase6-planning-policy-smoke.mjs'];
const report = {success: false, root, paidCalls: 0, checks: [], boundary: 'Pure main-fact planning policy. Permission/Task persistence/Host/Pi/Provider/Job integration are separate.',
  sources: files.map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
function check(name, action) {
  try {action(); report.checks.push({name, pass: true}); console.log('PASS ' + name);}
  catch (error) {report.checks.push({name, pass: false, error: String(error.stack ?? error)}); console.error('FAIL ' + name + ' ' + String(error).split('\n')[0]);}
}
const rejects = value => assert.throws(() => evaluateTaskPlanning(value), error => error instanceof Error && error.message === 'invalid_input');
check('L1 uses the short path for zero or one step with default unknown checks', () => {
  for (const stepCount of [0, 1]) {
    const decision = evaluateTaskPlanning({...base(), stepCount});
    assert.equal(decision.level, 1); assert.deepEqual(decision.reasons, ['simple_task']);
    assert.equal(decision.preflight.state, 'ready'); assert.deepEqual(decision.preflight.blockers, []);
    assert.deepEqual(Object.keys(decision.preflight.checks), facets);
    for (const facet of facets) assert.deepEqual(decision.preflight.checks[facet], {state: 'unknown', references: []});
  }
});
check('Each L2 fact and explicit request independently raises planning depth', () => {
  const cases = [[{stepCount: 2}, 'multiple_steps'], [{dependencyEdges: 1}, 'dependency_edges'],
    [{requiredCapabilities: 2}, 'multiple_required_capabilities'], [{requestedLevel: 2}, 'requested_level_2']];
  for (const [change, reason] of cases) {
    const decision = evaluateTaskPlanning({...base(), ...change});
    assert.equal(decision.level, 2); assert.deepEqual(decision.reasons, [reason]); assert.equal(decision.preflight.state, 'ready');
  }
});
check('Each L3 fact and explicit request independently requires six-facet preflight', () => {
  const cases = [[{longRunning: true}, 'long_running'], [{unresolvedCapabilities: 1}, 'unresolved_capabilities'],
    [{selectedProviders: 2}, 'multiple_providers'], [{requestedLevel: 3}, 'requested_level_3']];
  for (const [change, reason] of cases) {
    const decision = evaluateTaskPlanning({...base(), ...change});
    assert.equal(decision.level, 3); assert.deepEqual(decision.reasons, [reason]);
    assert.equal(decision.preflight.state, 'blocked'); assert.deepEqual(decision.preflight.blockers, facets);
  }
});
check('Requested levels only raise depth and never override higher factual requirements', () => {
  for (const requestedLevel of [1, 2, 3]) {
    assert.equal(evaluateTaskPlanning({...base(), selectedProviders: 2, requestedLevel}).level, 3);
    assert.equal(evaluateTaskPlanning({...base(), stepCount: 2, requestedLevel}).level, requestedLevel === 3 ? 3 : 2);
  }
  const facts = {...base(), stepCount: 2, dependencyEdges: 1, requiredCapabilities: 2, requestedLevel: 2};
  assert.deepEqual(evaluateTaskPlanning(facts).reasons, ['multiple_steps', 'dependency_edges', 'multiple_required_capabilities', 'requested_level_2']);
  assert.deepEqual(evaluateTaskPlanning({...facts, longRunning: true, unresolvedCapabilities: 1, selectedProviders: 2, requestedLevel: 3}).reasons,
    ['long_running', 'unresolved_capabilities', 'multiple_providers', 'requested_level_3']);
});
check('L3 lists blocked unknown and omitted facets in canonical order', () => {
  const preflight = {capabilities: {state: 'ready', references: []}, dependencies: {state: 'blocked', references: ['owned:dependency']},
    risk: {state: 'unknown', references: ['owned:risk']}, artifacts: {state: 'ready', references: []}};
  const decision = evaluateTaskPlanning({...base(), longRunning: true, preflight});
  assert.equal(decision.preflight.state, 'blocked'); assert.deepEqual(decision.preflight.blockers, ['dependencies', 'permissions', 'risk', 'recovery']);
  assert.deepEqual(decision.preflight.checks.dependencies, preflight.dependencies);
});
check('L3 becomes ready only when all six main-owned checks are ready', () => {
  const preflight = ready(); const decision = evaluateTaskPlanning({...base(), requestedLevel: 3, preflight});
  assert.equal(decision.preflight.state, 'ready'); assert.deepEqual(decision.preflight.blockers, []);
  for (const facet of facets) {
    const incomplete = {...preflight, [facet]: {state: 'unknown', references: []}};
    assert.deepEqual(evaluateTaskPlanning({...base(), requestedLevel: 3, preflight: incomplete}).preflight.blockers, [facet]);
  }
});
check('L1 and L2 preserve source check facts while retaining their short planning gate', () => {
  const preflight = {permissions: {state: 'blocked', references: ['approval:pending']}};
  for (const stepCount of [1, 2]) {
    const decision = evaluateTaskPlanning({...base(), stepCount, preflight});
    assert.equal(decision.preflight.state, 'ready'); assert.deepEqual(decision.preflight.blockers, []);
    assert.deepEqual(decision.preflight.checks.permissions, preflight.permissions);
  }
});
check('Supported natural counts and maximum reference bounds remain accepted', () => {
  const preflight = ready(); preflight.capabilities.references = Array.from({length: 128}, (_, index) => String(index).padEnd(2048, 'x'));
  const decision = evaluateTaskPlanning({...base(), stepCount: Number.MAX_SAFE_INTEGER, dependencyEdges: Number.MAX_SAFE_INTEGER,
    requiredCapabilities: Number.MAX_SAFE_INTEGER, unresolvedCapabilities: Number.MAX_SAFE_INTEGER, selectedProviders: Number.MAX_SAFE_INTEGER, preflight});
  assert.equal(decision.level, 3); assert.equal(decision.preflight.state, 'ready'); assert.equal(decision.preflight.checks.capabilities.references.length, 128);
});
check('Missing fields malformed counts booleans and levels are rejected', () => {
  for (const key of Object.keys(base())) {const value = base(); delete value[key]; rejects(value);}
  for (const key of ['stepCount', 'dependencyEdges', 'requiredCapabilities', 'unresolvedCapabilities', 'selectedProviders']) {
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', true, null]) rejects({...base(), [key]: value});
  }
  for (const longRunning of [0, 1, 'false', null, undefined]) rejects({...base(), longRunning});
  for (const requestedLevel of [0, 4, 1.5, '2', null, NaN]) rejects({...base(), requestedLevel});
  for (const value of [null, [], 'facts', new Date()]) rejects(value);
});
check('Known-key validation covers facts facets check objects and reference containers', () => {
  rejects({...base(), prompt: 'external text'}); rejects({...base(), preflight: {network: {state: 'ready', references: []}}});
  rejects({...base(), preflight: {risk: {state: 'ready', references: [], extra: true}}});
  rejects(Object.assign(Object.create({foreign: true}), base()));
  const references = ['owned:reference']; references.extra = 'foreign';
  rejects({...base(), preflight: {risk: {state: 'ready', references}}});
  const symbol = Symbol('foreign'); rejects({...base(), [symbol]: true});
});
check('Malformed facet states reference values limits and sparse arrays are rejected', () => {
  for (const preflight of [null, [], 'ready', new Date()]) rejects({...base(), preflight});
  for (const checkValue of [null, true, 'ready', {}, {state: 'ready'}, {references: []}, {state: 'unknown-state', references: []},
    {state: 'ready', references: 'owned'}, {state: 'ready', references: [undefined]}, {state: 'ready', references: ['']},
    {state: 'ready', references: ['   ']}, {state: 'ready', references: ['x'.repeat(2049)]}, {state: 'ready', references: ['x\ny']},
    {state: 'ready', references: Array(1)}, {state: 'ready', references: Array(129).fill('owned')}]) {
    rejects({...base(), preflight: {risk: checkValue}});
  }
});
check('Frozen inputs remain unchanged outputs are cloned deterministic and getters stay unread', () => {
  const preflight = ready(); for (const check of Object.values(preflight)) {Object.freeze(check.references); Object.freeze(check);} Object.freeze(preflight);
  const facts = Object.freeze({...base(), longRunning: true, preflight}); const before = JSON.stringify(facts);
  const decision = evaluateTaskPlanning(facts), expected = structuredClone(decision);
  assert.equal(JSON.stringify(facts), before); assert.deepEqual(evaluateTaskPlanning(facts), expected);
  assert.notEqual(decision.preflight.checks, preflight); assert.notEqual(decision.preflight.checks.risk.references, preflight.risk.references);
  decision.preflight.checks.risk.references.push('mutated'); decision.reasons.push('mutated'); decision.preflight.blockers.push('risk');
  assert.deepEqual(evaluateTaskPlanning(facts), expected); assert.equal(JSON.stringify(facts), before);
  const reversed = Object.fromEntries(Object.entries(preflight).reverse()); assert.deepEqual(evaluateTaskPlanning({...facts, preflight: reversed}), expected);
  let reads = 0; const getterFacts = base(); Object.defineProperty(getterFacts, 'stepCount', {get() {reads++; return 1;}, enumerable: true}); rejects(getterFacts);
  const references = ['owned']; Object.defineProperty(references, '0', {get() {reads++; return 'owned';}, enumerable: true});
  rejects({...base(), preflight: {risk: {state: 'ready', references}}}); assert.equal(reads, 0);
});
report.success = report.checks.length === 12 && report.checks.every(check => check.pass);
fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({root, success: report.success, checks: report.checks.length}));
if (!report.success) process.exitCode = 1;
