import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-native-plan-contract-'));
const entry = path.resolve('src/main/xiaozhi-agent/plan-native.ts');
await build({stdin: {contents: `export {ensureNativeTaskContract} from ${JSON.stringify(entry)};
  export {TASK_PLAN_PARAMETERS} from ${JSON.stringify(path.resolve('src/shared/xiaozhi-task-plan.ts'))};
  export {createNetworkReceiptFiles} from ${JSON.stringify(path.resolve('src/main/xiaozhi-agent/effects/network-receipts.ts'))};
  export {persistNativeSessionReplacement} from ${JSON.stringify(path.resolve('src/main/xiaozhi-agent/tasks/native-session-replacement.ts'))};`,
  resolveDir: process.cwd(), loader: 'ts'}, bundle: true, platform: 'node', format: 'esm',
  packages: 'external', outfile: path.join(root, 'fixture.mjs')});
const {ensureNativeTaskContract, TASK_PLAN_PARAMETERS, createNetworkReceiptFiles, persistNativeSessionReplacement} = await import(pathToFileURL(path.join(root, 'fixture.mjs')).href);
const tools = [{name: 'update_task_plan', parameters: TASK_PLAN_PARAMETERS}];
const base = 'synthetic-control-fingerprint';
const legacy = {schemaVersion: 3, base, envelopeVersion: 1,
  // Exact Phase5 0f753e5 schema, verified from its committed source.
  schemaHash: 'e56bcad48b255ea1cc7bf8ca22f60ff8fd61ad36f216dab3f59b49fc03839386'};
function manager(data = []) {
  const entries = structuredClone(data);
  return {entries, getEntries: () => entries, appendCustomEntry(customType, value) {
    entries.push({type: 'custom', customType, data: value});
  }};
}
const report = {success: false, root, checks: [], sources: [entry,
  path.resolve('src/shared/xiaozhi-task-plan.ts'), path.resolve('src/main/xiaozhi-agent/effects/network-receipts.ts')]
  .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
try {
  const fresh = manager(); ensureNativeTaskContract(fresh, base, tools); ensureNativeTaskContract(fresh, base, tools);
  assert.equal(fresh.entries.length, 1); assert.notEqual(fresh.entries[0].data.schemaHash, legacy.schemaHash);
  report.checks.push({id: 'fresh_current_contract', pass: true});
  const old = manager([{type: 'custom', customType: 'xiaozhi.education.task-plan.v3', data: legacy}]);
  const original = JSON.stringify(old.entries[0]);
  ensureNativeTaskContract(old, base, tools); ensureNativeTaskContract(old, base, tools);
  assert.equal(old.entries.length, 2); assert.equal(JSON.stringify(old.entries[0]), original);
  assert.equal(old.entries[1].customType, 'xiaozhi.education.task-planning.v1');
  assert.equal(old.entries[1].data.previousSchemaHash, legacy.schemaHash);
  report.checks.push({id: 'phase5_append_only_upgrade', pass: true});
  for (const invalid of [
    [{type: 'custom', customType: 'xiaozhi.education.task-plan.v3', data: {...legacy, schemaHash: '0'.repeat(64)}}],
    [{type: 'custom', customType: 'xiaozhi.education.task-plan.v3', data: {...legacy, base: 'foreign'}}],
    [...old.entries, old.entries[1]], [old.entries[1]],
    [old.entries[0], {...old.entries[1], data: {...old.entries[1].data, schemaHash: '0'.repeat(64)}}],
  ]) assert.throws(() => ensureNativeTaskContract(manager(invalid), base, tools), /configuration/);
  report.checks.push({id: 'unknown_foreign_duplicate_upgrade_rejected', pass: true});
  const files = createNetworkReceiptFiles(path.join(root, 'receipts'));
  const id = 'xieffect_' + 'a'.repeat(64), body = '\u0000'.repeat(1048576);
  await files.write(id, 'b'.repeat(64), {status: 200, body});
  assert.equal((await files.read(id, 'b'.repeat(64))).body, body);
  assert.equal(fs.statSync(path.join(root, 'receipts', id + '.json')).size > 6 * 1048576, true);
  report.checks.push({id: 'bounded_escaped_network_response_readback', pass: true});
  const {SessionManager} = await import('@earendil-works/pi-coding-agent');
  const actual = SessionManager.create(root, path.join(root, 'native'));
  actual.appendModelChange('xiaozhi_deepseek', 'deepseek-flash');
  actual.appendCustomEntry('xiaozhi.synthetic-metadata.v1', {schemaVersion: 1});
  const file = actual.getSessionFile(), identity = actual.getSessionId(), originalEntries = structuredClone(actual.getEntries());
  assert.equal(fs.existsSync(file), false);
  await persistNativeSessionReplacement(actual, root);
  assert.equal(actual.getSessionId(), identity); assert.deepEqual(actual.getEntries(), originalEntries);
  const marker = actual.appendCustomEntry('xiaozhi.synthetic-owner.v1', {schemaVersion: 1});
  const persisted = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  assert.equal(persisted.length, originalEntries.length + 2);
  assert.equal(persisted[0].id, identity); assert.equal(persisted.at(-1).id, marker);
  assert.equal(persisted.filter(entry => entry.id === marker).length, 1);
  report.checks.push({id: 'real_pi_lazy_metadata_materialized_then_append_once', pass: true});
  report.success = true;
} catch (error) {report.error = error.stack; process.exitCode = 1;}
fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({success: report.success, checks: report.checks.length, root, error: report.error}));
