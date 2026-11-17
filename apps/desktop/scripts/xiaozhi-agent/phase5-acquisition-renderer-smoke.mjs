import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase5-acquisition-renderer-'));
const desktop = path.resolve(import.meta.dirname, '../..');
const orderingOnly = process.argv.includes('--prepare-ordering-only');
const credentialOnly = process.argv.includes('--mcp-secret-only');
const extensionOnly = process.argv.includes('--extension-only');
const pickerOnly = process.argv.includes('--picker-wait-only');
const continuationOnly = process.argv.includes('--extension-continuation-only');
const recoveryOnly = process.argv.includes('--acquisition-recovery-only');
const report = {success: false, output, checks: [], focus: recoveryOnly ? 'acquisition_recovery_only' : continuationOnly ? 'extension_continuation_only' : pickerOnly ? 'picker_wait_only' : extensionOnly ? 'extension_only' : credentialOnly ? 'mcp_secret_only' : orderingOnly ? 'prepare_ordering_only' : 'full_component_suite', orderingEvidence: [], pickerEvidence: [], extensionContinuationEvidence: [], acquisitionRecoveryEvidence: [],
  boundary: 'Actual React/HeroUI settings mounted in JSDOM with synthetic typed bridge responses. No Electron, build output, provider or real data.'};
let root, dom;
const channels = new Set();
const NativeMessageChannel = globalThis.MessageChannel;
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
const actor = sessionId => ({sessionId, taskId: 'xitask_fixture', runId: 'run_fixture', generation: 1});
const candidate = {id: 'candidate_fixture', source: 'github', externalId: 'fixture/repository', name: '合成候选',
  description: '合成组件测试', version: '1.2.3', repository: 'https://example.test/fixture', packageName: 'fixture-package',
  transport: 'stdio', sourceHash: 'a'.repeat(64), fetchedAt: '2026-11-17T00:00:00Z', expiresAt: '2026-12-17T00:00:00Z'};
const artifact = {id: 'artifact_fixture', name: '合成安装记录', version: '1.2.3', source: 'reviewed', license: 'MIT', revision: 4,
  status: 'verifying', schemaHash: null, installedBytes: 12345, expiresAt: '2026-12-17T00:00:00Z'};
const operation = {id: 'operation_fixture', candidateId: candidate.id, revision: 3, phase: 'downloading', error: null,
  artifactId: artifact.id, updatedAt: '2026-11-17T00:00:00Z'};
const view = (sessionId = 'session_A', patch = {}) => ({schemaVersion: 'xiaozhi.acquisition.v1', context: actor(sessionId),
  candidates: [candidate], operations: [], artifacts: [], sourceStatus: [{source: 'github', status: 'cached'}], ...patch});
const ok = value => ({ok: true, value});
const mcpServer = {id: 'server_fixture', name: '合成MCP', transport: 'stdio', endpoint: 'owned-fixture', revision: 3,
  status: 'ready', schemaHash: 'b'.repeat(64), trustedSchemaHash: 'b'.repeat(64), credentialConfigured: false,
  tools: [{name: 'write_tool', title: '写入工具', description: '合成外部效果', readOnly: false, selected: false}]};
const mcpCatalog = (patch = {}) => ({schemaVersion: 'xiaozhi.mcp.v1', revision: 17, servers: [{...mcpServer, ...patch}]});
const componentCredential = 'fixture-credential-value-only-for-component';
const extension = {artifactId: 'ext_artifact', extensionId: 'fixture.extension', version: '2.0.0', sourceHash: 'c'.repeat(64),
  directoryFingerprint: 'd'.repeat(64), sourceKind: 'local_import', trust: 'unknown', license: 'MIT',
  hooks: ['context.transform', 'event.observe'], phase: 'quarantined', revision: 3, selectionRevision: 8,
  active: false, enabled: false, revoked: false, error: null};
function extensionBridge(patch = {}) {
  window.omniEdu = {listManagedTools: async () => ok([]), getXiaozhiAcquisition: async id => ok(view(id, {extensions: [extension]})), ...patch};
}
let React, act, createRoot, PiAcquisitionSettings, PiMcpSettings, PiEnvironmentSettings, PiManagedTools, PiExtensionSettings;
let visible = true;
const intersections = new Set();

async function settle(action = async () => {}) {await act(async () => {await action(); await delay(5);});}
async function mount(component, props) {
  await settle(async () => {root?.unmount(); document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById('root')); root.render(React.createElement(component, props));});
}
function element(id) {return document.querySelector(`[data-testid="${id}"]`);}
async function click(id) {const target = element(id); assert(target, 'missing control ' + id); await settle(async () => {target.click();});}
async function text(id, value) {
  await settle(async () => {
    const target = element(id);
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(target, value);
    target.dispatchEvent(new window.Event('input', {bubbles: true}));
  });
}
async function check(name, action) {
  if (orderingOnly && !name.startsWith('Prepare ordering')) return;
  if (credentialOnly && !name.startsWith('MCP secret') && !name.startsWith('MCP effects')) return;
  if (extensionOnly && !name.startsWith('Extension')) return;
  if (pickerOnly && !name.startsWith('Extension picker')) return;
  if (continuationOnly && !name.startsWith('Extension continuation')) return;
  if (recoveryOnly && !name.startsWith('Acquisition recovery')) return;
  try {await action(); report.checks.push({name, pass: true});}
  catch (error) {report.checks.push({name, pass: false, error: error.stack});}
  console.log(JSON.stringify(report.checks.at(-1)));
}

try {
  const entry = path.join(output, 'entry.tsx');
  fs.writeFileSync(entry, `export {default as React,act} from 'react';export {createRoot} from 'react-dom/client';
export {PiAcquisitionSettings} from ${JSON.stringify(path.join(desktop, 'src/renderer/components/office/PiAcquisitionSettings.tsx'))};
export {PiMcpSettings} from ${JSON.stringify(path.join(desktop, 'src/renderer/components/office/PiMcpSettings.tsx'))};
export {PiManagedTools} from ${JSON.stringify(path.join(desktop, 'src/renderer/components/office/PiManagedTools.tsx'))};
export {PiExtensionSettings} from ${JSON.stringify(path.join(desktop, 'src/renderer/components/office/PiExtensionSettings.tsx'))};
export {PiEnvironmentSettings} from ${JSON.stringify(path.join(desktop, 'src/renderer/components/office/PiEnvironmentSettings.tsx'))};`);
  const bundle = path.join(output, 'components.cjs');
  await build({entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'cjs', target: 'node24',
    nodePaths: [path.join(desktop, 'node_modules')], loader: {'.css': 'empty'}, jsx: 'automatic', logLevel: 'silent'});
  dom = new JSDOM('<html><body></body></html>', {url: 'http://localhost/', pretendToBeVisual: true});
  for (const name of ['window', 'document', 'Element', 'Node', 'Document', 'DocumentFragment', 'ShadowRoot',
    'NodeFilter', 'MutationObserver', 'Event', 'MouseEvent', 'KeyboardEvent', 'CustomEvent', 'PointerEvent',
    ...Object.getOwnPropertyNames(dom.window).filter(name => /^(HTML|SVG).*Element$/.test(name))]) {
    if (dom.window[name]) globalThis[name] = dom.window[name];
  }
  if (NativeMessageChannel) globalThis.MessageChannel = class extends NativeMessageChannel {
    constructor() {super(); channels.add(this);}
  };
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: dom.window.navigator});
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 16);
  globalThis.cancelAnimationFrame = clearTimeout;
  globalThis.CSS = dom.window.CSS || {escape: value => String(value).replace(/[^A-Za-z0-9_-]/g, '\\$&')};
  window.HTMLElement.prototype.scrollIntoView = function() {};
  window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}});
  globalThis.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
  globalThis.IntersectionObserver = class {
    constructor(callback) {this.callback = callback; intersections.add(this);}
    observe(target) {this.target = target; this.callback([{target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0}]);}
    disconnect() {intersections.delete(this);}
  };
  Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => visible ? 'visible' : 'hidden'});
  ({React, act, createRoot, PiAcquisitionSettings, PiMcpSettings, PiEnvironmentSettings, PiManagedTools, PiExtensionSettings} = createRequire(import.meta.url)(bundle));

  await check('Missing session has task guidance and performs no inferred-owner query', async () => {
    let reads = 0; window.omniEdu = {getXiaozhiAcquisition: async () => {reads++; return ok(view());}};
    await mount(PiAcquisitionSettings, {mode: 'discovery'});
    assert.equal(reads, 0); assert(document.body.textContent.includes('请在小智当前任务中准备所需能力'));
  });
  await check('Idle discovery remains searchable while null context disables preparation and exposes source state', async () => {
    window.omniEdu = {getXiaozhiAcquisition: async () => ok(view('session_A', {context: null}))};
    await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
    assert(element('pi-acquisition-prepare-candidate_fixture').disabled);
    assert(!element('pi-acquisition-query').disabled);
    assert(document.body.textContent.includes('GitHub')); assert(document.body.textContent.includes('离线缓存'));
    assert(document.body.textContent.includes('1.2.3')); assert(document.body.textContent.includes('许可证'));
  });
  await check('Real search form calls only typed search with its current session and query', async () => {
    let query;
    window.omniEdu = {getXiaozhiAcquisition: async () => ok(view()), searchXiaozhiAcquisition: async input => {
      query = input; return ok(view('session_A', {candidates: [{...candidate, name: '检索返回候选'}]}));}};
    await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
    await text('pi-acquisition-query', 'local fixture');
    await settle(async () => element('pi-acquisition-search-form').dispatchEvent(new window.Event('submit', {bubbles: true, cancelable: true})));
    assert.deepEqual(query, {sessionId: 'session_A', query: 'local fixture'});
    assert(document.body.textContent.includes('检索返回候选'));
  });
  await check('Prepare uses main context and quarantine/source_requires_review stays distinct from readiness', async () => {
    const calls = [];
    window.omniEdu = {getXiaozhiAcquisition: async () => ok(view()), mutateXiaozhiAcquisition: async input => {
      calls.push(input); return ok(view('session_A', {operations: [{...operation, phase: 'quarantined', error: 'source_requires_review', artifactId: null}]}));}};
    await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
    await click('pi-acquisition-prepare-candidate_fixture');
    assert.deepEqual(calls, [{action: 'prepare', sessionId: 'session_A', candidateId: candidate.id}]);
    assert(document.body.textContent.includes('隔离待审查')); assert(document.body.textContent.includes('此候选需要来源与权限审查'));
    assert(!document.body.textContent.includes('已就绪'));
  });
  await check('Active cancellation sends the precise operation revision and a cancelled candidate can retry', async () => {
    const calls = [];
    window.omniEdu = {getXiaozhiAcquisition: async () => ok(view('session_A', {operations: [operation]})), mutateXiaozhiAcquisition: async input => {
      calls.push(input); return ok(view('session_A', {operations: [{...operation, phase: 'cancelled'}]}));}};
    await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
    await click('pi-acquisition-cancel-operation_fixture');
    assert.deepEqual(calls[0], {action: 'cancel', sessionId: 'session_A', operationId: operation.id, revision: 3});
    assert(document.body.textContent.includes('已取消')); assert(!element('pi-acquisition-prepare-candidate_fixture').disabled);
  });
  await check('An awaited prepare pipeline continues polling real progress and allows cancellation before its API resolves', async () => {
    const preparing = deferred(); let started = false; let cancelled = false;
    window.omniEdu = {getXiaozhiAcquisition: async () => ok(view('session_A', {operations: started ? [{...operation, phase: cancelled ? 'cancelled' : 'downloading'}] : []})),
      mutateXiaozhiAcquisition: input => {
        if (input.action === 'prepare') {started = true; return preparing.promise;}
        cancelled = true;
        const result = ok(view('session_A', {operations: [{...operation, phase: 'cancelled'}]}));
        preparing.resolve(result); return Promise.resolve(result);
      }};
    await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
    await click('pi-acquisition-prepare-candidate_fixture');
    await settle(async () => delay(1300));
    assert(document.body.textContent.includes('正在下载')); assert(!element('pi-acquisition-cancel-operation_fixture').disabled);
    await click('pi-acquisition-cancel-operation_fixture'); assert(cancelled); assert(document.body.textContent.includes('已取消'));
  });
  await check('Installed records show license/version and verifying is distinct from ready; revoke is idle-safe', async () => {
    let mutation;
    window.omniEdu = {getXiaozhiAcquisition: async () => ok(view('session_A', {context: null, artifacts: [artifact]})),
      mutateXiaozhiAcquisition: async input => {mutation = input; return ok(view('session_A', {context: null, artifacts: [{...artifact, status: 'revoked'}]}));}};
    await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'installed'});
    assert(document.body.textContent.includes('MIT')); assert(document.body.textContent.includes('验证中'));
    assert(!document.body.textContent.includes('已就绪'));
    await click('pi-acquisition-revoke-artifact_fixture');
    assert.deepEqual(mutation, {action: 'revoke', sessionId: 'session_A', artifactId: artifact.id, revision: 4});
    assert(document.body.textContent.includes('已撤销'));
  });
  await check('Typed failures retain current facts and expose retry with ACQUISITION_ERRORS', async () => {
    window.omniEdu = {getXiaozhiAcquisition: async () => ok(view()), mutateXiaozhiAcquisition: async () => ({ok: false, error: 'checksum_mismatch'})};
    await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
    await click('pi-acquisition-prepare-candidate_fixture');
    assert(document.body.textContent.includes('下载内容与固定完整性记录不一致'));
    assert(element('pi-acquisition-prepare-candidate_fixture')); assert(!element('pi-acquisition-prepare-candidate_fixture').disabled);
    window.omniEdu = {getXiaozhiAcquisition: async () => ({ok: false, error: 'unavailable'})};
    await mount(PiAcquisitionSettings, {sessionId: 'session_B', mode: 'discovery'});
    assert(document.body.textContent.includes('当前能力管理尚不可用'));
    assert(!document.body.textContent.includes('请在小智当前任务中准备所需能力'));
  });
  await check('Late old-session reads and unmounted operations cannot replace the new session view', async () => {
    const old = deferred();
    window.omniEdu = {getXiaozhiAcquisition: id => id === 'session_A' ? old.promise : Promise.resolve(ok(view('session_B', {candidates: [{...candidate, name: 'B会话候选'}]})))};
    await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
    await settle(async () => root.render(React.createElement(PiAcquisitionSettings, {sessionId: 'session_B', mode: 'discovery'})));
    await settle(async () => old.resolve(ok(view('session_A', {candidates: [{...candidate, name: 'A过期候选'}]}))));
    assert(document.body.textContent.includes('B会话候选')); assert(!document.body.textContent.includes('A过期候选'));
    const pending = deferred(); window.omniEdu.mutateXiaozhiAcquisition = () => pending.promise;
    await click('pi-acquisition-prepare-candidate_fixture');
    await mount(PiAcquisitionSettings, {sessionId: 'session_C', mode: 'installed'});
    await settle(async () => pending.resolve(ok(view('session_B', {artifacts: [{...artifact, name: '已卸载组件过期结果'}]}))));
    assert(!document.body.textContent.includes('已卸载组件过期结果'));
  });
  await check('Visible polling remains single-flight and stops starting reads when hidden', async () => {
    let reads = 0; const pending = deferred();
    window.omniEdu = {getXiaozhiAcquisition: () => {reads++; return pending.promise;}};
    const nativeTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (callback, milliseconds, ...args) => nativeTimeout(callback, milliseconds === 10000 ? 20 : milliseconds, ...args);
    try {
      await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
      await settle(async () => delay(1300)); assert.equal(reads, 1);
      assert(document.body.textContent.includes('当前能力管理尚不可用'));
      visible = false;
      await settle(async () => document.dispatchEvent(new window.Event('visibilitychange')));
      await settle(async () => pending.resolve(ok(view())));
      await settle(async () => delay(1300)); assert.equal(reads, 1);
      visible = true; await settle(async () => document.dispatchEvent(new window.Event('visibilitychange')));
      assert.equal(reads, 2);
    } finally {globalThis.setTimeout = nativeTimeout; visible = true;}
  });
  await check('Original MCP configuration stays busy-locked while acquisition cancel remains available', async () => {
    window.omniEdu = {getXiaozhiMcpCatalog: async () => ({ok: true, value: {revision: 1, servers: []}}),
      getXiaozhiAcquisition: async () => ok(view('session_A', {operations: [operation]})),
      mutateXiaozhiAcquisition: async () => ok(view('session_A', {operations: [{...operation, phase: 'cancelled'}]}))};
    await mount(PiMcpSettings, {running: true, sessionId: 'session_A'});
    assert(element('pi-mcp-name').disabled); assert(element('pi-mcp-refresh').disabled);
    assert(!element('pi-acquisition-cancel-operation_fixture').disabled);
    await click('pi-acquisition-cancel-operation_fixture'); assert(document.body.textContent.includes('已取消'));
  });
  await check('Environment async repair and diagnosis stay attached to the selected session', async () => {
    const old = deferred();
    const environment = id => ({platform: {os: id, arch: 'x64', node: '24'}, checks: [{id: 'workspace_text', status: 'needs_configuration', label: '配置', detail: id}]});
    window.omniEdu = {getXiaozhiEnvironment: id => id === 'session_A' ? old.promise : Promise.resolve(ok(environment(id))),
      getXiaozhiAcquisition: async id => ok(view(id))};
    await mount(PiEnvironmentSettings, {sessionId: 'session_A'});
    await settle(async () => root.render(React.createElement(PiEnvironmentSettings, {sessionId: 'session_B'})));
    await settle(async () => old.resolve(ok(environment('A过期环境'))));
    assert(document.body.textContent.includes('session_B')); assert(!document.body.textContent.includes('A过期环境'));
  });
  await check('Prepare ordering retains a newer cancelled view when the earlier prepare resolves afterwards', async () => {
    const preparing = deferred(), cancellation = deferred();
    let started = false, truth = operation;
    window.omniEdu = {getXiaozhiAcquisition: async () => ok(view('session_A', {operations: started ? [truth] : []})),
      mutateXiaozhiAcquisition: input => {if (input.action === 'prepare') {started = true; return preparing.promise;} return cancellation.promise;}};
    await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
    await click('pi-acquisition-prepare-candidate_fixture'); await settle(async () => delay(1300));
    await click('pi-acquisition-cancel-operation_fixture');
    truth = {...operation, phase: 'cancelled', revision: 6, updatedAt: '2026-11-17T00:00:02Z'};
    await settle(async () => cancellation.resolve(ok(view('session_A', {operations: [truth]}))));
    const before = element('pi-acquisition-operation-operation_fixture').getAttribute('data-phase');
    await settle(async () => preparing.resolve(ok(view('session_A', {operations: [{...operation, phase: 'ready', revision: 4}]}))));
    const after = element('pi-acquisition-operation-operation_fixture').getAttribute('data-phase');
    report.orderingEvidence.push({case: 'cancel_then_old_prepare', before, after});
    assert.equal(before, 'cancelled'); assert.equal(after, 'cancelled');
  });
  await check('Prepare ordering cannot invalidate a later pending cancel result or typed error', async () => {
    const observations = [];
    for (const outcome of ['success', 'error']) {
      const preparing = deferred(), cancellation = deferred();
      let started = false, truth = operation;
      window.omniEdu = {getXiaozhiAcquisition: async () => ok(view('session_A', {operations: started ? [truth] : []})),
        mutateXiaozhiAcquisition: input => {if (input.action === 'prepare') {started = true; return preparing.promise;} return cancellation.promise;}};
      await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
      await click('pi-acquisition-prepare-candidate_fixture'); await settle(async () => delay(1300));
      await click('pi-acquisition-cancel-operation_fixture');
      await settle(async () => preparing.resolve(ok(view('session_A', {operations: [{...operation, phase: 'ready', revision: 4}]}))));
      truth = {...operation, phase: 'cancelled', revision: 6, updatedAt: '2026-11-17T00:00:02Z'};
      await settle(async () => cancellation.resolve(outcome === 'success' ? ok(view('session_A', {operations: [truth]})) : {ok: false, error: 'conflict'}));
      observations.push({case: 'old_prepare_during_cancel_' + outcome,
        phase: element('pi-acquisition-operation-operation_fixture').getAttribute('data-phase'),
        notice: element('pi-acquisition-notice-discovery')?.textContent || ''});
    }
    report.orderingEvidence.push(...observations);
    assert.equal(observations[0].phase, 'cancelled');
    assert(observations[1].notice.includes('状态已更新，请刷新后重试'));
  });
  await check('MCP secret configuration uses a password input and the exact typed transient set payload', async () => {
    let payload;
    window.omniEdu = {getXiaozhiAcquisition: async id => ok(view(id)), getXiaozhiMcpCatalog: async () => ok(mcpCatalog()),
      setXiaozhiMcpCredential: async input => {payload = input; return ok(mcpCatalog({credentialConfigured: true, credentialReference: 'opaque_ref', status: 'unverified', trustedSchemaHash: undefined}));}};
    await mount(PiMcpSettings, {sessionId: 'session_A', running: false});
    const password = element('pi-mcp-credential-server_fixture');
    assert(password && password.type === 'password'); assert.equal(password.autocomplete, 'off');
    await text('pi-mcp-credential-server_fixture', componentCredential);
    assert(!document.body.textContent.includes(componentCredential));
    await click('pi-mcp-credential-save-server_fixture');
    const {value, ...metadata} = payload;
    assert.deepEqual(metadata, {schemaVersion: 'xiaozhi.mcp.v1', revision: 17, serverId: 'server_fixture', action: 'set'});
    assert(value === componentCredential, 'typed credential value mismatch');
    assert.equal(element('pi-mcp-credential-server_fixture').value, '');
    assert(document.body.textContent.includes('已配置')); assert(document.body.textContent.includes('重新连接'));
    assert(!document.body.textContent.includes('opaque_ref')); assert.equal(window.localStorage.length, 0);
  });
  await check('MCP secret replacement and clear follow returned unverified trust state and clear local drafts on success', async () => {
    const mutations = [];
    window.omniEdu = {getXiaozhiAcquisition: async id => ok(view(id)), getXiaozhiMcpCatalog: async () => ok(mcpCatalog({credentialConfigured: true})),
      setXiaozhiMcpCredential: async input => {mutations.push(input); return ok({...mcpCatalog({credentialConfigured: input.action === 'set', status: 'unverified', trustedSchemaHash: undefined}), revision: 18});}};
    await mount(PiMcpSettings, {sessionId: 'session_A', running: false});
    assert(element('pi-mcp-credential-save-server_fixture').textContent.includes('替换'));
    await text('pi-mcp-credential-server_fixture', componentCredential); await click('pi-mcp-credential-save-server_fixture');
    assert(mutations[0].value === componentCredential, 'replacement value mismatch');
    assert.equal(element('pi-mcp-credential-server_fixture').value, '');
    await text('pi-mcp-credential-server_fixture', 'unsaved-local-draft'); await click('pi-mcp-credential-clear-server_fixture');
    assert.deepEqual(mutations[1], {schemaVersion: 'xiaozhi.mcp.v1', revision: 18, serverId: 'server_fixture', action: 'clear'});
    assert.equal(element('pi-mcp-credential-server_fixture').value, '');
    assert(document.body.textContent.includes('未配置')); assert(!document.body.textContent.includes('已授权选中工具'));
    assert(element('pi-mcp-trust-server_fixture').disabled);
  });
  await check('MCP secret CAS and secure-storage errors preserve a correction draft and show only mapped errors', async () => {
    for (const [error, phrase] of [['conflict', '配置已在其他位置更新'], ['storage_unavailable', '本机安全存储不可用']]) {
      window.omniEdu = {getXiaozhiAcquisition: async id => ok(view(id)), getXiaozhiMcpCatalog: async () => ok(mcpCatalog()),
        setXiaozhiMcpCredential: async () => ({ok: false, error})};
      await mount(PiMcpSettings, {sessionId: 'session_A', running: false});
      await text('pi-mcp-credential-server_fixture', componentCredential); await click('pi-mcp-credential-save-server_fixture');
      assert(element('pi-mcp-credential-server_fixture').value === componentCredential, 'correction draft was lost');
      assert(document.body.textContent.includes(phrase)); assert(!document.body.textContent.includes(componentCredential));
      assert.equal(window.localStorage.length, 0);
    }
  });
  await check('MCP secret controls retain the original running and in-flight configuration lock', async () => {
    const pending = deferred();
    window.omniEdu = {getXiaozhiAcquisition: async id => ok(view(id)), getXiaozhiMcpCatalog: async () => ok(mcpCatalog({credentialConfigured: true})),
      setXiaozhiMcpCredential: () => pending.promise};
    await mount(PiMcpSettings, {sessionId: 'session_A', running: true});
    for (const id of ['pi-mcp-credential-server_fixture', 'pi-mcp-credential-save-server_fixture', 'pi-mcp-credential-clear-server_fixture']) assert(element(id).disabled);
    await mount(PiMcpSettings, {sessionId: 'session_A', running: false});
    await text('pi-mcp-credential-server_fixture', componentCredential); await click('pi-mcp-credential-save-server_fixture');
    assert(element('pi-mcp-credential-server_fixture').disabled); assert(element('pi-mcp-refresh').disabled);
    await settle(async () => pending.resolve(ok(mcpCatalog({credentialConfigured: true, status: 'unverified', trustedSchemaHash: undefined}))));
  });
  await check('MCP secret old-session and unmounted results cannot clear or replace current drafts and catalog', async () => {
    const old = deferred(), newer = deferred(); let reads = 0, mutations = 0;
    window.omniEdu = {getXiaozhiAcquisition: async id => ok(view(id)), getXiaozhiMcpCatalog: async () => ok(mcpCatalog({name: ++reads === 1 ? '会话A连接' : '会话B连接'})),
      setXiaozhiMcpCredential: () => ++mutations === 1 ? old.promise : newer.promise};
    await mount(PiMcpSettings, {sessionId: 'session_A', running: false});
    await text('pi-mcp-credential-server_fixture', componentCredential); await click('pi-mcp-credential-save-server_fixture');
    await settle(async () => root.render(React.createElement(PiMcpSettings, {sessionId: 'session_B', running: false})));
    assert.equal(element('pi-mcp-credential-server_fixture').value, '');
    await text('pi-mcp-credential-server_fixture', 'current-session-draft');
    await settle(async () => old.resolve(ok(mcpCatalog({name: 'A过期返回', credentialConfigured: true, status: 'unverified', trustedSchemaHash: undefined}))));
    assert(document.body.textContent.includes('会话B连接')); assert(!document.body.textContent.includes('A过期返回'));
    assert.equal(element('pi-mcp-credential-server_fixture').value, 'current-session-draft');
    await click('pi-mcp-credential-save-server_fixture');
    await mount(PiAcquisitionSettings, {sessionId: 'session_C', mode: 'installed'});
    await settle(async () => newer.resolve(ok(mcpCatalog({name: '卸载后返回'}))));
    assert(!document.body.textContent.includes('卸载后返回')); assert(!element('pi-mcp-notice'));
  });
  await check('MCP effects tool selection preserves names and schema while readOnlyHint remains descriptive', async () => {
    let trusted;
    window.omniEdu = {getXiaozhiAcquisition: async id => ok(view(id)), getXiaozhiMcpCatalog: async () => ok(mcpCatalog()),
      trustXiaozhiMcp: async input => {trusted = input; return ok(mcpCatalog({tools: [{...mcpServer.tools[0], selected: true}]}));}};
    await mount(PiMcpSettings, {sessionId: 'session_A', running: false});
    const checkbox = element('pi-mcp-tool-server_fixture-write_tool').querySelector('input');
    assert(checkbox && !checkbox.disabled);
    await settle(async () => checkbox.click()); await click('pi-mcp-trust-server_fixture');
    assert.deepEqual(trusted, {schemaVersion: 'xiaozhi.mcp.v1', revision: 17, serverId: 'server_fixture', schemaHash: 'b'.repeat(64), tools: ['write_tool']});
    assert(document.body.textContent.includes('外部操作')); assert(!document.body.textContent.includes('效果未知，禁止调用'));
  });
  await check('Extension optional legacy view retains managed tools and idle import calls only the main picker contract', async () => {
    let imported;
    extensionBridge({getXiaozhiAcquisition: async id => ok(view(id, {context: null})), mutateXiaozhiAcquisition: async input => {
      imported = input; return ok(view('session_A', {context: null, extensions: [extension]}));}});
    await mount(PiManagedTools, {sessionId: 'session_A', running: false});
    assert(element('pi-managed-tool-refresh')); assert(element('pi-extension-empty'));
    assert(!element('pi-extension-import').disabled); await click('pi-extension-import');
    assert.deepEqual(imported, {action: 'extension_import', sessionId: 'session_A'});
    assert(element('pi-extension-prepare-ext_artifact').disabled);
    assert(document.body.textContent.includes('请在小智当前任务'));
  });
  await check('Extension imported source remains local with unknown trust and exposes actual license hashes and two hooks', async () => {
    extensionBridge(); await mount(PiManagedTools, {sessionId: 'session_A', running: false});
    const row = element('pi-extension-ext_artifact'); assert(row);
    assert(row.textContent.includes('本地导入')); assert(row.textContent.includes('信任未知')); assert(row.textContent.includes('MIT'));
    await settle(async () => element('pi-extension-details-ext_artifact').querySelector('button').click());
    assert(row.textContent.includes(extension.sourceHash)); assert(row.textContent.includes(extension.directoryFingerprint));
    assert(row.textContent.includes('context.transform')); assert(row.textContent.includes('event.observe'));
    assert(!row.textContent.includes('官方')); assert(!row.textContent.includes('已审核'));
  });
  await check('Extension long preparation polls progress and keeps revision-correct cancellation reachable without an active task', async () => {
    const preparing = deferred(); let truth = extension, started = false; const calls = [];
    extensionBridge({getXiaozhiAcquisition: async id => ok(view(id, {context: started ? null : actor(id), extensions: [truth]})),
      mutateXiaozhiAcquisition: input => {calls.push(input); if (input.action === 'extension_prepare') {
        started = true; truth = {...extension, phase: 'preparing', revision: 4}; return preparing.promise;
      } truth = {...truth, phase: 'cancelled', revision: 5}; return Promise.resolve(ok(view('session_A', {context: null, extensions: [truth]})));}});
    await mount(PiManagedTools, {sessionId: 'session_A', running: false}); await click('pi-extension-prepare-ext_artifact');
    await settle(async () => delay(1300));
    assert.equal(element('pi-extension-ext_artifact').getAttribute('data-phase'), 'preparing');
    assert(!element('pi-extension-cancel-ext_artifact').disabled); await click('pi-extension-cancel-ext_artifact');
    assert.deepEqual(calls, [{action: 'extension_prepare', sessionId: 'session_A', artifactId: 'ext_artifact', revision: 3},
      {action: 'extension_cancel', sessionId: 'session_A', artifactId: 'ext_artifact', revision: 4}]);
    await settle(async () => preparing.resolve(ok(view('session_A', {extensions: [{...extension, phase: 'prepared', enabled: true, active: true}]}))));
    assert.equal(element('pi-extension-ext_artifact').getAttribute('data-phase'), 'cancelled');
  });
  await check('Extension a pending newer cancel retains its typed conflict when an old prepare resolves first', async () => {
    const preparing = deferred(), cancellation = deferred(); let started = false;
    extensionBridge({getXiaozhiAcquisition: async id => ok(view(id, {extensions: [{...extension, phase: started ? 'preparing' : 'quarantined', revision: started ? 4 : 3}]})),
      mutateXiaozhiAcquisition: input => {if (input.action === 'extension_prepare') {started = true; return preparing.promise;} return cancellation.promise;}});
    await mount(PiManagedTools, {sessionId: 'session_A', running: false}); await click('pi-extension-prepare-ext_artifact');
    await settle(async () => delay(1300)); await click('pi-extension-cancel-ext_artifact');
    await settle(async () => preparing.resolve(ok(view('session_A', {extensions: [{...extension, phase: 'prepared'}]}))));
    await settle(async () => cancellation.resolve({ok: false, error: 'extension_revision_conflict'}));
    assert(element('pi-extension-notice').textContent.includes('扩展版本状态已更新'));
  });
  await check('Extension prior prepared version selection uses selectionRevision and idle disable and revoke preserve exact version', async () => {
    const oldVersion = {...extension, artifactId: 'ext_old', version: '1.0.0', phase: 'prepared', selectionRevision: 12};
    let context = actor('session_A'), truth = oldVersion; const calls = [];
    extensionBridge({getXiaozhiAcquisition: async id => ok(view(id, {context, extensions: [truth]})), mutateXiaozhiAcquisition: async input => {
      calls.push(input); truth = {...truth, selectionRevision: truth.selectionRevision + 1,
        active: input.action === 'extension_select', enabled: input.action === 'extension_select', revoked: input.action === 'extension_revoke'};
      context = null; return ok(view('session_A', {context, extensions: [truth]}));}});
    await mount(PiManagedTools, {sessionId: 'session_A', running: false}); await click('pi-extension-select-ext_old');
    assert(element('pi-extension-select-ext_old').disabled); await click('pi-extension-disable-ext_old'); await click('pi-extension-revoke-ext_old');
    assert.deepEqual(calls, ['extension_select', 'extension_disable', 'extension_revoke'].map((action, index) => ({action,
      sessionId: 'session_A', extensionId: 'fixture.extension', version: '1.0.0', revision: 12 + index})));
    assert(document.body.textContent.includes('已撤销')); assert(element('pi-extension-select-ext_old').disabled);
  });
  await check('Extension needs approval and retryable failure use mapped errors and main task context', async () => {
    extensionBridge({getXiaozhiAcquisition: async id => ok(view(id, {extensions: [{...extension, phase: 'needs_approval', error: 'permission_pending'}]})),
      mutateXiaozhiAcquisition: async () => ({ok: false, error: 'permission_denied'})});
    await mount(PiManagedTools, {sessionId: 'session_A', running: false});
    assert(document.body.textContent.includes('权限审批'));
    assert(!element('pi-extension-prepare-ext_artifact').disabled); assert(!element('pi-extension-cancel-ext_artifact'));
    extensionBridge({getXiaozhiAcquisition: async id => ok(view(id, {extensions: [{...extension, phase: 'failed', error: 'invalid_package'}]})),
      mutateXiaozhiAcquisition: async () => ({ok: false, error: 'permission_denied'})});
    await mount(PiManagedTools, {sessionId: 'session_A', running: false});
    assert(document.body.textContent.includes('导入合同')); assert(element('pi-extension-prepare-ext_artifact').textContent.includes('重试'));
    await click('pi-extension-prepare-ext_artifact'); assert(element('pi-extension-notice').textContent.includes('当前授权或任务已失效'));
  });
  await check('Extension old-session and unmounted preparation results cannot replace the current extension view', async () => {
    const pending = deferred();
    extensionBridge({getXiaozhiAcquisition: async id => ok(view(id, {extensions: [{...extension, extensionId: id === 'session_A' ? 'old.extension' : 'current.extension'}]})),
      mutateXiaozhiAcquisition: () => pending.promise});
    await mount(PiManagedTools, {sessionId: 'session_A', running: false}); await click('pi-extension-prepare-ext_artifact');
    await settle(async () => root.render(React.createElement(PiManagedTools, {sessionId: 'session_B', running: false})));
    await settle(async () => pending.resolve(ok(view('session_A', {extensions: [{...extension, extensionId: 'late.extension'}]}))));
    assert(element('pi-extension-ext_artifact').textContent.includes('current.extension')); assert(!document.body.textContent.includes('late.extension'));
    const unmounted = deferred(); window.omniEdu.mutateXiaozhiAcquisition = () => unmounted.promise;
    await click('pi-extension-prepare-ext_artifact'); await mount(PiAcquisitionSettings, {sessionId: 'session_C', mode: 'installed'});
    await settle(async () => unmounted.resolve(ok(view('session_B', {extensions: [extension]})))); assert(!element('pi-extension-ext_artifact'));
  });
  await check('Extension picker waits past the renderer deadline with single-flight ownership and applies actual success cancellation error and session outcomes', async () => {
    const observations = [];
    for (const outcome of ['success', 'cancel', 'error']) {
      const picking = deferred(); let mutations = 0;
      extensionBridge({getXiaozhiAcquisition: async id => ok(view(id, {context: null, extensions: []})),
        mutateXiaozhiAcquisition: () => {mutations++; return picking.promise;}});
      await mount(PiExtensionSettings, {sessionId: 'session_A'}); await click('pi-extension-import');
      const began = performance.now(); await settle(async () => delay(10150));
      const before = {outcome, elapsedMs: performance.now() - began, locked: element('pi-extension-import').disabled,
        notice: element('pi-extension-notice')?.textContent || '', calls: mutations};
      if (before.locked) await click('pi-extension-import');
      await settle(async () => picking.resolve(outcome === 'error' ? {ok: false, error: 'invalid_package'}
        : ok(view('session_A', {context: null, extensions: outcome === 'success' ? [extension] : []}))));
      observations.push({...before, finalLocked: element('pi-extension-import').disabled,
        finalNotice: element('pi-extension-notice')?.textContent || '', imported: Boolean(element('pi-extension-ext_artifact')), calls: mutations});
    }
    const old = deferred();
    extensionBridge({getXiaozhiAcquisition: async id => ok(view(id, {context: null, extensions: []})), mutateXiaozhiAcquisition: () => old.promise});
    await mount(PiExtensionSettings, {sessionId: 'session_A'}); await click('pi-extension-import');
    await settle(async () => root.render(React.createElement(PiExtensionSettings, {sessionId: 'session_B'})));
    await settle(async () => old.resolve(ok(view('session_A', {extensions: [extension]}))));
    const sessionSafe = !element('pi-extension-ext_artifact') && !element('pi-extension-import').disabled;
    const unmounted = deferred(); window.omniEdu.mutateXiaozhiAcquisition = () => unmounted.promise;
    await click('pi-extension-import'); await mount(PiAcquisitionSettings, {sessionId: 'session_C', mode: 'installed'});
    await settle(async () => unmounted.resolve({ok: false, error: 'invalid_package'}));
    const unmountSafe = !element('pi-extension-notice');
    report.pickerEvidence.push(...observations, {sessionSafe, unmountSafe});
    for (const item of observations) {
      assert(item.elapsedMs >= 10000); assert(item.locked, 'picker ownership released before native result for ' + item.outcome);
      assert.equal(item.notice, ''); assert.equal(item.calls, 1); assert.equal(item.finalLocked, false);
      assert.equal(item.imported, item.outcome === 'success');
      assert.equal(item.finalNotice, item.outcome === 'error' ? '扩展包不符合导入合同。' : '');
    }
    assert(sessionSafe); assert(unmountSafe);
  });
  await check('Extension continuation retries an unchanged needs_approval artifact after an external permission grant', async () => {
    let truth = extension, granted = false; const calls = [];
    extensionBridge({getXiaozhiAcquisition: async id => ok(view(id, {extensions: [truth]})), mutateXiaozhiAcquisition: async input => {
      calls.push(input);
      truth = {...truth, revision: 4, phase: granted ? 'prepared' : 'needs_approval', enabled: granted, active: granted, error: granted ? null : 'permission_pending'};
      return granted ? ok(view('session_A', {extensions: [truth]})) : {ok: false, error: 'permission_pending'};
    }});
    await mount(PiExtensionSettings, {sessionId: 'session_A'}); await click('pi-extension-prepare-ext_artifact');
    await click('pi-extension-refresh');
    granted = true; await click('pi-extension-refresh');
    const observation = {phase: element('pi-extension-ext_artifact').getAttribute('data-phase'),
      retryDisabled: element('pi-extension-prepare-ext_artifact').disabled,
      retryLabel: element('pi-extension-prepare-ext_artifact').textContent,
      cancelVisible: Boolean(element('pi-extension-cancel-ext_artifact'))};
    report.extensionContinuationEvidence.push({case: 'returned_needs_approval_after_grant', ...observation});
    assert.equal(observation.phase, 'needs_approval'); assert.equal(observation.retryDisabled, false);
    assert(observation.retryLabel.includes('重试')); assert.equal(observation.cancelVisible, false);
    await click('pi-extension-prepare-ext_artifact');
    assert.deepEqual(calls, [3, 4].map(revision => ({action: 'extension_prepare', sessionId: 'session_A', artifactId: 'ext_artifact', revision})));
    assert.equal(element('pi-extension-ext_artifact').getAttribute('data-phase'), 'prepared');
  });
  await check('Extension continuation retains cancel while a prepared package still awaits the pending install select health promise', async () => {
    const health = deferred(); let truth = extension; const calls = [];
    extensionBridge({getXiaozhiAcquisition: async id => ok(view(id, {extensions: [truth]})), mutateXiaozhiAcquisition: input => {
      calls.push(input);
      if (input.action === 'extension_prepare') {truth = {...extension, phase: 'prepared', revision: 6}; return health.promise;}
      truth = {...truth, phase: 'cancelled', revision: 7}; return Promise.resolve(ok(view('session_A', {extensions: [truth]})));
    }});
    await mount(PiExtensionSettings, {sessionId: 'session_A'}); await click('pi-extension-prepare-ext_artifact');
    await click('pi-extension-refresh');
    const observation = {phase: element('pi-extension-ext_artifact').getAttribute('data-phase'),
      cancelVisible: Boolean(element('pi-extension-cancel-ext_artifact')),
      cancelDisabled: element('pi-extension-cancel-ext_artifact')?.disabled};
    report.extensionContinuationEvidence.push({case: 'prepared_while_health_pending', ...observation});
    assert.equal(observation.phase, 'prepared'); assert(observation.cancelVisible); assert.equal(observation.cancelDisabled, false);
    await click('pi-extension-cancel-ext_artifact');
    await settle(async () => health.resolve(ok(view('session_A', {extensions: [{...extension, phase: 'prepared', active: true, enabled: true}]}))));
    assert.deepEqual(calls, [{action: 'extension_prepare', sessionId: 'session_A', artifactId: 'ext_artifact', revision: 3},
      {action: 'extension_cancel', sessionId: 'session_A', artifactId: 'ext_artifact', revision: 6}]);
    assert.equal(element('pi-extension-ext_artifact').getAttribute('data-phase'), 'cancelled');
  });
  await check('Acquisition recovery retries returned needs_approval after grant and retains running or local-promise cancellation ownership', async () => {
    const observations = [];
    for (const running of [false, undefined]) {
      const calls = [];
      window.omniEdu = {getXiaozhiAcquisition: async id => ok(view(id, {operations: [{...operation, phase: 'needs_approval', running, error: 'permission_pending'}]})),
        mutateXiaozhiAcquisition: async input => {calls.push(input); return ok(view('session_A', {operations: [{...operation, phase: 'ready', running: false}]}));}};
      await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
      // A grant is external to this bridge and leaves the operation phase unchanged.
      await click('pi-acquisition-refresh-discovery');
      const observation = {case: running === undefined ? 'legacy_approval_returned' : 'approval_returned',
        disabled: element('pi-acquisition-prepare-candidate_fixture').disabled,
        label: element('pi-acquisition-prepare-candidate_fixture').textContent,
        cancelVisible: Boolean(element('pi-acquisition-cancel-operation_fixture'))};
      observations.push(observation);
      if (!observation.disabled) await click('pi-acquisition-prepare-candidate_fixture');
      observation.calls = calls;
    }
    const pending = deferred(); let started = false;
    window.omniEdu = {getXiaozhiAcquisition: async id => ok(view(id, {operations: started ? [{...operation, phase: 'needs_approval', running: false}] : []})),
      mutateXiaozhiAcquisition: () => {started = true; return pending.promise;}};
    await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'}); await click('pi-acquisition-prepare-candidate_fixture');
    await click('pi-acquisition-refresh-discovery');
    const localOwned = element('pi-acquisition-prepare-candidate_fixture').disabled && Boolean(element('pi-acquisition-cancel-operation_fixture'));
    await settle(async () => pending.resolve(ok(view('session_A', {operations: [{...operation, phase: 'needs_approval', running: false}]}))));
    window.omniEdu.getXiaozhiAcquisition = async id => ok(view(id, {operations: [{...operation, phase: 'needs_approval', running: true}]}));
    await click('pi-acquisition-refresh-discovery');
    const mainOwned = element('pi-acquisition-prepare-candidate_fixture').disabled && Boolean(element('pi-acquisition-cancel-operation_fixture'));
    report.acquisitionRecoveryEvidence.push(...observations, {case: 'active_ownership', localOwned, mainOwned});
    for (const item of observations) {
      assert.equal(item.disabled, false); assert(item.label.includes('重试')); assert.equal(item.cancelVisible, false);
      assert.deepEqual(item.calls, [{action: 'prepare', sessionId: 'session_A', candidateId: candidate.id}]);
    }
    assert(localOwned); assert(mainOwned);
  });
  await check('Acquisition recovery uses the main interrupted projection for an explicit context-bound retry', async () => {
    let mutation;
    window.omniEdu = {getXiaozhiAcquisition: async id => ok(view(id, {operations: [{...operation, phase: 'interrupted', running: false, error: 'interrupted'}]})),
      mutateXiaozhiAcquisition: async input => {mutation = input; return ok(view('session_A'));}};
    await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
    const observation = {case: 'interrupted', disabled: element('pi-acquisition-prepare-candidate_fixture').disabled,
      phase: element('pi-acquisition-operation-operation_fixture').getAttribute('data-phase'), cancelVisible: Boolean(element('pi-acquisition-cancel-operation_fixture'))};
    report.acquisitionRecoveryEvidence.push(observation);
    assert.equal(observation.phase, 'interrupted'); assert.equal(observation.disabled, false); assert.equal(observation.cancelVisible, false);
    assert(element('pi-acquisition-prepare-candidate_fixture').textContent.includes('重试'));
    await click('pi-acquisition-prepare-candidate_fixture'); assert.deepEqual(mutation, {action: 'prepare', sessionId: 'session_A', candidateId: candidate.id});
  });
  await check('Acquisition recovery offers explicit revalidation for expired or invalid ready expiry while future ready remains current', async () => {
    const observations = [];
    for (const [expiryCase, expiresAt] of [['expired', new Date(Date.now() - 60000).toISOString()], ['invalid', 'invalid-fixture-date'], ['future', new Date(Date.now() + 86400000).toISOString()]]) {
      const calls = [], stored = {...artifact, status: 'ready', expiresAt};
      window.omniEdu = {getXiaozhiAcquisition: async id => ok(view(id, {operations: [{...operation, phase: 'ready', running: false}], artifacts: [stored]})),
        mutateXiaozhiAcquisition: async input => {calls.push(input); return ok(view('session_A'));}};
      await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'discovery'});
      const observation = {case: expiryCase, expiresAt, observedAt: Date.now(), disabled: element('pi-acquisition-prepare-candidate_fixture').disabled,
        label: element('pi-acquisition-prepare-candidate_fixture').textContent, discoveryText: element('pi-acquisition-candidate-candidate_fixture').textContent};
      if (!observation.disabled) await click('pi-acquisition-prepare-candidate_fixture');
      await mount(PiAcquisitionSettings, {sessionId: 'session_A', mode: 'installed'});
      observation.installedText = element('pi-acquisition-artifact-artifact_fixture').textContent;
      observation.status = element('pi-acquisition-artifact-artifact_fixture').getAttribute('data-status'); observation.calls = calls;
      observations.push(observation);
    }
    report.acquisitionRecoveryEvidence.push(...observations);
    for (const item of observations) {
      assert.equal(item.status, 'ready'); assert.equal(item.disabled, item.case === 'future');
      if (item.case !== 'future') {
        assert(item.label.includes('重新核验')); assert(item.discoveryText.includes('有效期')); assert(item.installedText.includes('有效期'));
        assert.deepEqual(item.calls, [{action: 'prepare', sessionId: 'session_A', candidateId: candidate.id}]);
      } else assert.equal(item.calls.length, 0);
    }
  });
  report.success = report.checks.length === (recoveryOnly ? 3 : continuationOnly ? 2 : pickerOnly ? 1 : extensionOnly ? 10 : credentialOnly ? 6 : orderingOnly ? 2 : 33) && report.checks.every(item => item.pass);
} catch (error) {report.error = error.stack;}
finally {
  if (root && act) await settle(async () => root.unmount());
  dom?.window.close();
  for (const channel of channels) {channel.port1.close(); channel.port2.close();}
  globalThis.MessageChannel = NativeMessageChannel;
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: report.checks.filter(item => item.pass).length, total: report.checks.length, output, error: report.error}));
  if (!report.success) process.exitCode = 1;
}
