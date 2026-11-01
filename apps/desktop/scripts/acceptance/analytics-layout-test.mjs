import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import ts from 'typescript';

// Exercise the production render function with independent count fixtures.
// This checks placement/data preservation, not Electron or Disclosure internals.
const source = ts.createSourceFile('App.tsx', fs.readFileSync('src/renderer/App.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let renderSource;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'renderAnalyticsView') renderSource = node.getText(source);
  ts.forEachChild(node, visit);
}
visit(source); assert(renderSource, 'production analytics render function exists');
const compiled = ts.transpileModule(renderSource, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
const componentNames = ['WorkspaceLabel', 'ProKpiCard', 'EmptyState', 'DisclosureCard', 'AiObservabilityWorkspace', 'Users', 'ClipboardList', 'FileText', 'HardDrive', 'Sparkles', 'FileSearch', 'Database', 'ListChecks'];
const components = Object.fromEntries(componentNames.map(name => [name, function FixtureComponent() {}]));
function render(values) {
  const context = { React, ...components, overview: { analytics: values }, knowledgeOverview: { counts: { resources: 17, chunks: 31, nodes: 43, edges: 59 } }, aiConfirmations: [{ id: 'one' }, { id: 'two' }] };
  return new Function(...Object.keys(context), compiled + '\nreturn renderAnalyticsView();')(...Object.values(context));
}
function nodes(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}
const ofType = (element, name) => nodes(element).filter(node => node.type === components[name]);
function text(element) {
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  return React.isValidElement(element) ? React.Children.toArray(element.props.children).map(text).join('') : '';
}
let passed = 0;
function check(name, run) { run(); passed++; console.log('PASS ' + name); }
const populated = { activeStudents: 2, totalRecords: 7, totalReports: 11, totalAttachments: 19 };
check('teacher core preserves four real aggregate values without developer trend labels', () => {
  const tree = render(populated), children = React.Children.toArray(tree.props.children);
  assert.equal(children.length, 2, 'only teacher core and one diagnostic disclosure at top level');
  const core = children[0], heading = ofType(core, 'WorkspaceLabel')[0];
  assert.equal(heading.props.description, '本地学生与学习资料汇总');
  const cards = ofType(core, 'ProKpiCard');
  assert.deepEqual(cards.map(card => card.props.value), [2, 7, 11, 19]);
  assert.deepEqual(cards.map(card => card.props.label), ['在读学生', '学习记录', '复盘报告', '附件数量']);
  for (const card of cards) {
    assert.equal(card.props.trend, undefined);
    assert.doesNotMatch(card.props.detail, /AI|中控台|可调用|聚合|资产|知识库|切片/);
  }
  assert.equal(ofType(core, 'EmptyState').length, 0);
});
check('all technical counts and unsupported capability statuses share the existing collapsed boundary', () => {
  const tree = render(populated), disclosures = ofType(tree, 'DisclosureCard');
  assert.equal(disclosures.length, 1);
  const disclosure = disclosures[0];
  assert.equal(disclosure.props['data-testid'], 'analytics-runtime-diagnostics');
  assert.equal(disclosure.props.title, '运行与诊断');
  assert.equal(disclosure.props.defaultExpanded, false);
  assert.equal(ofType(disclosure, 'AiObservabilityWorkspace').length, 1);
  assert.equal(ofType(tree, 'AiObservabilityWorkspace').length, 1);
  assert.deepEqual(ofType(disclosure, 'WorkspaceLabel').map(node => node.props.title), ['AI 与知识资产状态', '待续费风险 · 未接入', '高频薄弱点 · 未接入']);
  assert.match(text(disclosure), /17 个资源 · 31 个切片/);
  assert.match(text(disclosure), /43 个节点 · 59 条边/);
  assert.match(text(disclosure), /2 个当前待确认动作/);
  assert.equal(ofType(tree, 'WorkspaceLabel').length, 4, 'no duplicated technical sections outside disclosure');
  assert.equal(React.Children.toArray(disclosure.props.children).at(-1).type, components.AiObservabilityWorkspace);
});
check('exactly one teacher empty state appears only when all four real aggregates are zero', () => {
  const zero = { activeStudents: 0, totalRecords: 0, totalReports: 0, totalAttachments: 0 };
  const empty = render(zero);
  assert.equal(ofType(empty, 'EmptyState').length, 1);
  assert.equal(ofType(empty, 'ProKpiCard').length, 4);
  for (const key of Object.keys(zero)) assert.equal(ofType(render({ ...zero, [key]: 1 }), 'EmptyState').length, 0, key);
});
console.log(JSON.stringify({ ok: true, checks: passed, boundary: 'Production render function and synthetic count fixtures; not full App or Electron acceptance.' }));
