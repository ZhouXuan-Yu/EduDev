import assert from 'node:assert/strict';
import {PROPERTIES} from './ui-final-cssom.mjs';
import {validateDevtoolsSample} from './ui-final-devtools-cascade.mjs';
import {cssOffset, mapEmbeddedCss} from './ui-final-css-source.mjs';

const checks = [];
function test(name, run) { run(); checks.push({name, pass: true}); }
const fixture = () => ({
  sample: {before: {computed: Object.fromEntries(PROPERTIES.map(p => [p, 'initial']))}, hazards: []},
  evidence: {properties: Object.fromEntries(PROPERTIES.map(p => [p, {
    status: 'no-active-declaration', winner: null, candidates: [], variables: [],
  }]))},
});
test('No active declaration keeps a null winner rather than inventing an author selector', () => {
  const {sample, evidence} = fixture(); validateDevtoolsSample(sample, evidence);
});
test('Reject ambiguity even when candidates have equal values', () => {
  const {sample, evidence} = fixture();
  evidence.properties.color = {status: 'unresolved', winner: null, candidates: [{state: 'Active'}, {state: 'Active'}]};
  assert.throws(() => validateDevtoolsSample(sample, evidence), /Ambiguous/);
});
test('Reject a declaration lacking a generated file location', () => {
  const {sample, evidence} = fixture();
  const property = {state: 'Active', origin: 'regular', overriddenByAnimation: false};
  evidence.properties.color = {status: 'active-declaration', winner: property, candidates: [property]};
  assert.throws(() => validateDevtoolsSample(sample, evidence), /location/);
});
test('Reject unstable snapshots, animation overrides and incomplete property sets', () => {
  const {sample, evidence} = fixture(); sample.hazards.push('unstable-snapshot');
  assert.throws(() => validateDevtoolsSample(sample, evidence), /Unstable/);
  sample.hazards = [];
  const property = {state: 'Active', origin: 'Inline', overriddenByAnimation: true};
  evidence.properties.color = {status: 'active-declaration', winner: property, candidates: [property]};
  assert.throws(() => validateDevtoolsSample(sample, evidence));
  delete evidence.properties.color;
  assert.throws(() => validateDevtoolsSample(sample, evidence));
});
test('Exact range maps a complete embedded source including CRLF and surrogate offsets', () => {
  const text = '\r\n/* 😀 */\r\n.a{color:red}\r\n';
  const generated = '/* generated */\n' + text.trim() + '\n.b{color:red}';
  const range = {startLine: 2, startColumn: 3, endLine: 2, endColumn: 12};
  const mapped = mapEmbeddedCss(generated, range, [{file: 'vendor.css', text}]);
  assert.equal(mapped.status, 'exact-source'); assert.equal(mapped.text, 'color:red');
  assert.equal(mapped.line, 3); assert.equal(mapped.column, 4);
});
test('Repeated equal snippets do not establish source ownership', () => {
  const range = {startLine: 0, startColumn: 3, endLine: 0, endColumn: 12};
  const text = '.a{color:red}';
  assert.equal(mapEmbeddedCss(text + text, range, [{file: 'vendor.css', text}]).status, 'not-embedded');
  assert.equal(mapEmbeddedCss(text, range, [{file: 'a.css', text}, {file: 'b.css', text}]).status, 'ambiguous');
  assert.equal(mapEmbeddedCss(text, range, [{file: 'other.css', text: '.b{color:red}'}]).status, 'not-embedded');
});
test('Malformed or out-of-file CDP locations fail closed', () => {
  for (const [line, column] of [[-1, 0], [0, -1], [1, 0], [0, 2]]) assert.throws(() => cssOffset('x', line, column));
  assert.throws(() => mapEmbeddedCss('.a{}', {startLine: 0, startColumn: 3, endLine: 0, endColumn: 2}, []));
});
console.log(JSON.stringify({success: true, checks}));
