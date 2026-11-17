import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {buildCoreToolManifest} from '../build-core-tool-manifest.mjs';

await buildCoreToolManifest();
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase5-governance-'));
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/phase5-governance-'));
await build({stdin: {contents: `export * from './src/main/xiaozhi-agent/capabilities/core-governance.ts';
export {createCapabilityRegistry} from './src/main/xiaozhi-agent/capabilities/registry.ts';
export {validProviderResult,validProviderResultContext} from './src/main/xiaozhi-agent/capabilities/provider-contract.ts';
export {CORE_TOOL_NAMES} from './src/main/xiaozhi-agent/tools/manifest.ts';
export {createSkillPrivateContext,captureSkillPrivateContext} from './src/main/xiaozhi-agent/skills/private-context.ts';`,
  resolveDir: process.cwd(), loader: 'ts'}, outfile: path.join(output, 'worker.mjs'), bundle: true, format: 'esm',
  platform: 'node', target: 'node24', packages: 'external', logLevel: 'warning'});
const {createCapabilityRegistry, registerSessionToolGovernance, createRunToolGovernance, CORE_TOOL_NAMES, CORE_TOOL_PROVIDER_IDS,
  validProviderResult, validProviderResultContext, createSkillPrivateContext, captureSkillPrivateContext} = await import(pathToFileURL(path.join(output, 'worker.mjs')).href);
const db = new DatabaseSync(path.join(root, 'authority.sqlite'));
const sql = {all: async (query, params = []) => db.prepare(query).all(...params), run: async (query, params = []) => {db.prepare(query).run(...params);}};
sql.change = async (query, params = []) => Number(db.prepare(query).run(...params).changes);
sql.transaction = async action => {db.exec('BEGIN IMMEDIATE'); try {const value = await action(sql); db.exec('COMMIT'); return value;}
  catch (error) {db.exec('ROLLBACK'); throw error;}};
const registry = createCapabilityRegistry(sql, {officialProviderIds: CORE_TOOL_PROVIDER_IDS}); await registry.migrate();
const schema = () => ({type: 'object', properties: {}, additionalProperties: false});
const definitions = CORE_TOOL_NAMES.map(name => ({name, label: name, description: name, parameters: schema(), execute: async () => ({content: [{type: 'text', text: 'synthetic'}], details: {success: true}})}));
const externalName = 'mcp_synthetic_read_hint';
definitions.push({name: externalName, label: externalName, description: 'Untrusted readOnlyHint is irrelevant to effect policy', parameters: schema(), execute: async () => ({content: [{type: 'text', text: 'synthetic'}], details: {success: true}})});
const mcp = async name => name === externalName ? {serverId: 'mcp_' + '1'.repeat(36), tool: 'hinted_read', sourceHash: 'a'.repeat(64), schemaHash: 'b'.repeat(64), transport: 'http'} : null;
const checks = [];
const report = {success: false, root, output, checks, paidCalls: 0, coreTools: CORE_TOOL_NAMES.length,
  boundary: 'Registry, source/effect/Scope policies, uniform receipt and private-capture contract fixtures. Actual final Session and original Task/Journal execution are additionally asserted by phase5-production-smoke.'};
async function check(name, action) {const started = performance.now(); await action(); checks.push({name, pass: true, durationMs: performance.now() - started}); console.log('PASS ' + name);}
let records;
const owner = {sessionId: 'aisession_' + randomUUID(), taskId: 'xitask_' + 'd'.repeat(64), runId: 'run_governance', generation: 1};
let current = true, performed = 0;
const persisted = [];
const runtime = () => createRunToolGovernance({owner, registry, records, current: () => current, mcp,
  task: async () => ({planRevision: 0, requirementsVersion: 1, stepId: null, target: null}),
  snapshot: async record => {const catalog = await registry.snapshot(); const version = await registry.providerVersion(record.providerId, record.providerVersion, record.capabilityId);
    return {schema: 'xiaozhi.capability-snapshot.v1', snapshotId: 'xicap_' + randomUUID(), ...owner, capabilityId: record.capabilityId,
      registryRevision: catalog.revision, requirement: {capabilityId: record.capabilityId, contractVersion: '1.0.0', required: ['invoke'], optional: [], conditions: [], localOnly: false, platform: process.platform,
        budget: {latencyMs: record.manifest.timeoutMs, resourceUnits: 1}}, selection: {providerId: record.providerId, providerVersion: record.providerVersion, contractVersion: '1.0.0', level: 'full', missingRequirements: [], limitations: []},
      providerHash: record.providerHash, createdAt: new Date().toISOString(), evidenceRefs: version.binding.conformance.evidence.map(item => item.reference), previousSnapshotId: null, refreshReason: 'initial'};},
  persist: async (callId, name, receipt) => {persisted.push({callId, name, receipt: structuredClone(receipt)});}});
const signal = new AbortController().signal;
try {
  await check('Every declared core identity plus selected MCP identity is registered without changing original names or input schemas', async () => {
    const before = definitions.map(tool => JSON.stringify(tool.parameters));
    records = await registerSessionToolGovernance({definitions, registry, mcp});
    assert.equal(records.size, definitions.length); assert.deepEqual([...records.keys()], definitions.map(tool => tool.name));
    assert.deepEqual(definitions.map(tool => JSON.stringify(tool.parameters)), before);
    const catalog = await registry.snapshot(); for (const record of records.values()) {assert(catalog.providers.some(provider => provider.id === record.providerId)); assert(record.scopePolicy);}
  });
  await check('Duplicate and unknown tools fail registration before they acquire core authority', async () => {
    await assert.rejects(registerSessionToolGovernance({definitions: [definitions[0], definitions[0]], registry, mcp}), /tool_manifest_conflict/u);
    await assert.rejects(registerSessionToolGovernance({definitions: [{...definitions[0], name: 'unregistered_raw_tool'}], registry, mcp}), /tool_governance_missing/u);
  });
  await check('MCP hints retain external effect, one attempt and explicit MCP Scope policy', async () => {
    const record = records.get(externalName); assert.equal(record.manifest.effect, 'external_effect'); assert.equal(record.manifest.maxAttempts, 1); assert.equal(record.scopePolicy, 'mcp_tool_request');
  });
  await check('Original result body is preserved and a schema-valid unified provider result references it', async () => {
    const governance = runtime(); await governance.before('call_read', 'office_read_text', {}, signal);
    const original = {content: [{type: 'text', text: 'owned synthetic source'}], details: {success: true, data: {text: 'owned synthetic source'}}};
    const returned = await governance.execute('call_read', 'office_read_text', {}, signal, async () => {performed++; return original;});
    const result = governance.decorate('call_read', 'office_read_text', returned);
    assert.deepEqual(result.content, original.content); assert(validProviderResult(result.details.coreProvider));
    assert.equal(result.details.coreProvider.data.kind, 'native_tool_result'); assert.equal(result.details.governance.classification, 'teacher_private');
  });
  await check('Dynamic provider results must match the actual current execution, snapshot and source identity', async () => {
    const governance = runtime(); await governance.before('call_identity', 'office_read_text', {}, signal);
    const value = governance.decorate('call_identity', 'office_read_text', {content: [{type: 'text', text: 'owned'}], details: {success: true}}).details.coreProvider;
    const context = {...owner, callId: value.executionId, snapshot: {snapshotId: value.snapshotId, capabilityId: value.capabilityId,
      providerHash: value.provenance.providerHash, registryRevision: value.provenance.registryRevision,
      selection: {providerId: value.providerId, providerVersion: value.provenance.providerVersion, contractVersion: value.provenance.contractVersion}}};
    assert(validProviderResultContext(value, context));
    for (const field of ['executionId', 'taskId', 'runId', 'snapshotId', 'capabilityId', 'providerId']) {
      const foreign = structuredClone(value); foreign[field] += '_foreign'; assert(!validProviderResultContext(foreign, context), field);
    }
    for (const field of ['providerVersion', 'providerHash', 'contractVersion', 'registryRevision']) {
      const foreign = structuredClone(value); foreign.provenance[field] = field === 'registryRevision' ? value.provenance[field] + 1 : 'f'.repeat(64);
      assert(!validProviderResultContext(foreign, context), field);
    }
  });
  await check('Child resource leases append their actual original Grant references to the original call contract', async () => {
    const governance = runtime(); await governance.before('call_prepare', 'capability_prepare', {}, signal);
    await governance.recordAuthority('call_prepare', [{grantId: 'xigrant_' + randomUUID(), revision: 1}], 'permission-request:' + 'a'.repeat(64));
    const latest = persisted.at(-1).receipt; assert.equal(latest.grantRefs.length, 1); assert.equal(latest.authorityRefs.length, 1);
  });
  await check('Domain malformed results fail the shared result boundary', async () => {
    const governance = runtime(); await governance.before('call_bad', 'office_read_text', {}, signal);
    await assert.rejects(governance.execute('call_bad', 'office_read_text', {}, signal, async () => ({content: 'bad'})), /invalid_output/u);
  });
  await check('Private data under a dynamic surface name survives native JSON round trip as rejection evidence', async () => {
    const governance = runtime(); await governance.before('call_mcp', externalName, {}, signal);
    const text = 'Owned private synthetic teacher text ' + 'a1b2c3d4e5f6g7h8'.repeat(8);
    const result = governance.decorate('call_mcp', externalName, {content: [{type: 'text', text}], details: {success: true}});
    const privateContext = createSkillPrivateContext(); captureSkillPrivateContext(privateContext, externalName, JSON.parse(JSON.stringify(result)));
    assert(privateContext.contains(text.slice(40, 100))); privateContext.clear();
  });
  await check('Schema mutation is rejected before the original implementation runs', async () => {
    const governance = runtime(); const tool = definitions.find(tool => tool.name === 'office_read_text'); const before = performed;
    tool.parameters.properties.injected = {type: 'string'};
    await assert.rejects(governance.before('call_changed', tool.name, {}, signal), /source_changed/u); assert.equal(performed, before);
    delete tool.parameters.properties.injected;
  });
  await check('Revoked core Provider blocks direct named execution through the same Registry', async () => {
    const record = records.get('office_read_text'); await registry.revokeProvider(record.providerId);
    await assert.rejects(runtime().before('call_revoked', record.name, {}, signal), /capability_revoked/u);
  });
  await check('Intrinsic Task controls also require the current main-owned Task generation', async () => {
    current = false; await assert.rejects(runtime().before('call_stale', 'ask_teacher', {}, signal), /permission_denied/u); current = true;
  });
  report.success = true;
} catch (error) {report.error = error.stack || String(error); process.exitCode = 1; console.error(error);}
finally {db.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({success: report.success, passed: checks.length, root, output}));}
