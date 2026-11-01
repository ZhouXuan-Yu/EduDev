import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Mock only the browser/clock boundary. Execute the runner's real run() setup and
// explicit handoff assertions, without importing its launch path or calling a model.
const file = new URL('./ui-goal-chat-live.mjs', import.meta.url);
const source = fs.readFileSync(file, 'utf8');
const tree = ts.createSourceFile(file.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let runSource, stylePolicy;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'run') runSource = node.getText(tree);
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'captureStyles') stylePolicy = node.initializer.getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
assert(runSource && stylePolicy, 'test must execute actual runner setup and style policy');
const stop = new Error('mock handoff assertions reached');

async function exercise(scenarioName, focusMode, invalid = {}, wrongOrder = false) {
  const calls = [], report = {runs: [], styleProbes: []}, id = 'synthetic-run';
  let detached = false, polls = 0;
  const document = {activeElement: null};
  const node = {matches: () => true};
  const focus = label => async () => {
    calls.push('focus:' + label);
    assert(!detached, 'test must never refocus a tool detached by real phase handoff');
    document.activeElement = node;
  };
  const target = label => ({
    count: async () => 1,
    first() { return this; },
    focus: focus(label),
    evaluate: async callback => callback(node),
    getAttribute: async () => 'true',
    click: async () => { calls.push('click:' + label); },
    hover: async () => { assert(!detached); calls.push('hover'); },
  });
  const tool = target('summary'), input = target('composer'), link = target('detail-link');
  const turn = {
    locator: selector => selector.includes('live-prose') ? {count: async () => 1} : tool,
    getByTestId: name => {
      if (name === 'agent-trace-timeline') return {isVisible: async () => true, scrollIntoViewIfNeeded: async () => {}};
      if (name === 'office-tool-evidence') return {locator: () => link};
      if (name === 'agent-trace-toggle') return {waitFor: async () => { calls.push('handoff-asserted'); throw stop; }};
      throw Error('Unexpected mock target: ' + name);
    },
  };
  const sandbox = {
    assert, Date, console, document, report, sessionId: 'synthetic-session', ownedRun: undefined,
    scenario: {name: scenarioName}, focusMode, limit: 180000,
    send: async () => id, section: () => turn,
    readOnlyRunBlocker: () => null,
    state: async () => ({running: true, turns: [{id, tools: [{}], answer: [], publicProcessCount: 1, presentation: {handoff: 'explicit'}}]}),
    events: async () => polls < 2 ? [] : [{runId: id, kind: 'assistant_phase', phase: 'final_answer'}],
    page: {
      getByTestId: () => input,
      mouse: {move: async () => calls.push('mouse')},
      keyboard: {press: async key => calls.push('key:' + key)},
      evaluate: async () => ({beforeTerminal: true, focusBefore: focusMode, focusAfter: focusMode === 'composer' ? 'composer' : 'process-trigger', ...invalid}),
    },
    captureStyleProbe: async (_page, _target, name) => {
      calls.push('probe:' + name);
      if (name === 'real-tool-keyboard-focus') detached = true;
      return {name};
    },
    write: () => {},
    sizes: async () => { detached = true; },
    until: async callback => {
      for (polls = 1; polls <= 2; polls++) await callback();
      throw Error('Mock did not reach explicit handoff');
    },
  };
  vm.createContext(sandbox);
  const captureStyles = vm.runInContext(stylePolicy, sandbox);
  sandbox.captureStyles = captureStyles;
  let testedSource = runSource;
  if (wrongOrder) {
    const focusStart = testedSource.indexOf('      if (needsTools && !focusArmed');
    const styleStart = testedSource.indexOf('      if (captureStyles && needsTools && focusArmed');
    const next = testedSource.indexOf('      if (!executing', styleStart);
    assert(focusStart > 0 && styleStart > focusStart && next > styleStart);
    const focusBlock = testedSource.slice(focusStart, styleStart);
    const styleBlock = testedSource.slice(styleStart, next).replace(' && focusArmed && !stylesCaptured', ' && !stylesCaptured');
    testedSource = testedSource.slice(0, focusStart) + styleBlock + focusBlock + testedSource.slice(next);
  }
  const run = vm.runInContext('(' + testedSource + ')', sandbox);
  let error;
  try { await run('synthetic prompt', 'attachment', true); } catch (caught) { error = caught; }
  return {calls, error, captureStyles, report};
}
let checks = 0;
for (const scenario of ['default', 'misconception', 'practice']) {
  for (const mode of ['summary', 'composer', 'detail-link']) {
    const result = await exercise(scenario, mode);
    assert.equal(result.error, stop, scenario + '/' + mode + ' must reach unchanged explicit handoff assertions');
    const probes = result.calls.filter(call => call.startsWith('probe:'));
    assert.equal(probes.length, scenario === 'default' && mode === 'summary' ? 3 : 0);
    assert.equal(result.calls.filter(call => call.startsWith('focus:')).length, 1, 'one setup focus, never refocus after slow capture');
    assert.equal(result.calls.find(call => call.startsWith('focus:')), 'focus:' + mode);
    if (probes.length) assert(result.calls.indexOf('focus:summary') < result.calls.indexOf(probes[0]));
    console.log('PASS focus-before-probes / handoff ' + scenario + '/' + mode); checks++;
  }
}
for (const invalid of [{beforeTerminal: false}, {focusBefore: 'body'}, {focusAfter: 'body'}]) {
  const result = await exercise('practice', 'summary', invalid);
  assert.equal(result.error?.name, 'AssertionError', 'timed handoff/focus failures must still fail');
  console.log('PASS invalid handoff still fails ' + Object.keys(invalid)[0]); checks++;
}
const oldOrder = await exercise('default', 'summary', {}, true);
assert.equal(oldOrder.error?.name, 'AssertionError');
assert.match(oldOrder.error.message, /never refocus a tool detached/);
console.log('PASS regression catches slow-probe-before-focus order'); checks++;
console.log(JSON.stringify({success: true, checks, mockOnly: true, electron: false, modelCalls: 0}));
