import fs from 'node:fs';
import io from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase5-acquisition-lifecycle-'));
const output = path.join(root, 'evidence'); fs.mkdirSync(output);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceRoot = 'C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-production-grcqce/data';
const sources = ['capabilities/acquisition/service.ts', 'capabilities/acquisition/sources.ts', 'capabilities/acquisition/state.ts',
  'capabilities/acquisition/npm-source.ts', 'capabilities/acquisition/npm-install.ts', 'permissions/engine.ts'];
const report = {success: false, root, output, paidCalls: 0, checks: [], requests: [], registrationCalls: [], revocations: [], authority: [],
  sources: sources.map(filename => ({path: 'src/main/xiaozhi-agent/' + filename, sha256: digest(fs.readFileSync('src/main/xiaozhi-agent/' + filename))})),
  scriptSha256: digest(fs.readFileSync(new URL(import.meta.url))),
  boundary: 'Actual source/state/Permission/acquisition/npm services with fixture publicFetch and registration instrumentation. Genuine previously verified package and Registry snapshot. No native execution or real network in this leaf.'};
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
await build({stdin: {contents: `export {createCapabilityAcquisition} from './src/main/xiaozhi-agent/capabilities/acquisition/service.ts';
export {reviewedFilesystemCandidate} from './src/main/xiaozhi-agent/capabilities/acquisition/sources.ts';
export {createAcquisitionState} from './src/main/xiaozhi-agent/capabilities/acquisition/state.ts';
export {capabilityPackageFiles,installLockedNpmCapability} from './src/main/xiaozhi-agent/capabilities/acquisition/npm-install.ts';
export {verifyNpmIntegrity} from './src/main/xiaozhi-agent/capabilities/acquisition/npm-source.ts';
export {FILESYSTEM_RECIPE,NODE_RECIPE} from './src/main/xiaozhi-agent/capabilities/acquisition/recipes.ts';
export {createPermissionStore} from './src/main/xiaozhi-agent/permissions/store.ts';
export {createPermissionService} from './src/main/xiaozhi-agent/permissions/service.ts';
export {createCapabilityRegistry} from './src/main/xiaozhi-agent/capabilities/registry.ts';
export {serializeStateWrites} from './src/main/xiaozhi-agent/serialized-state-sql.ts';
export {permissionHash} from './src/main/xiaozhi-agent/permissions/validation.ts';`, resolveDir: process.cwd(), loader: 'ts'},
  outfile: path.join(output, 'lifecycle.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node24',
  plugins: [{name: 'installed-dependencies', setup(builder) {
    builder.onResolve({filter: /^(?:@[^/]+\/[^/]+|[a-zA-Z][\w-]*)(?:\/.*)?$/}, args => ({path: import.meta.resolve(args.path), external: true}));
  }}]});
const api = await import(pathToFileURL(path.join(output, 'lifecycle.mjs')).href);
const databaseFile = path.join(root, 'authority.sqlite');
let db = new DatabaseSync(databaseFile);
db.exec('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)');
const rawSql = {
  all: async (query, values = []) => db.prepare(query).all(...values),
  run: async (query, values = []) => {db.prepare(query).run(...values);},
  change: async (query, values = []) => Number(db.prepare(query).run(...values).changes),
};
rawSql.transaction = async action => {
  db.exec('BEGIN IMMEDIATE');
  try {const value = await action(rawSql); db.exec('COMMIT'); return value;}
  catch (error) {db.exec('ROLLBACK'); throw error;}
};
const sql = api.serializeStateWrites(rawSql);
let store = api.createPermissionStore(sql); await store.migrate();
const sessionId = 'aisession_' + randomUUID();
let taskNumber = 0;
let activeOwner;
const workspace = path.join(root, 'workspace'); fs.mkdirSync(workspace);
const managedRoot = path.join(root, 'capabilities');
const state = api.createAcquisitionState(sql); await state.migrate();
let permissions;
let acquisition;
let fetchMode = 'offline';
let registerBehavior = async artifact => ({serverId: artifact.serverId, schemaHash: artifact.schemaHash, evidence: ['owned-lifecycle-existing-validation-reference']});
let sourceArtifact;
let oldRegistryHash;
let originalExpiry;
const registry = api.createCapabilityRegistry(sql); await registry.migrate();
const sourceRequests = [];
const json = value => Buffer.from(JSON.stringify(value));
const fixtureCommit = 'a'.repeat(40);
const fetcher = async (url, signal, maximumBytes, accept) => {
  signal.throwIfAborted();
  const request = {url, maximumBytes, accept: accept || null, mode: fetchMode};
  report.requests.push(request); sourceRequests.push(request);
  if (fetchMode === 'search_blocked') {
    await new Promise((resolve, reject) => {
      const aborted = () => reject(Error('cancelled'));
      signal.addEventListener('abort', aborted, {once: true});
      if (signal.aborted) aborted();
    });
  }
  if (fetchMode !== 'catalogs') throw Error(url.startsWith('https://registry.modelcontextprotocol.io') ? 'rate_limited' : 'source_unavailable');
  assert.equal(maximumBytes, 4 * 1048576);
  const parsed = new URL(url);
  if (parsed.origin === 'https://registry.modelcontextprotocol.io') {
    const page = Number((parsed.searchParams.get('cursor') || 'page0').slice(4));
    assert.equal(parsed.searchParams.get('limit'), '20'); assert.equal(parsed.searchParams.get('version'), 'latest');
    const servers = Array.from({length: 25}, (_, index) => ({server: {name: `owned.lifecycle.p${page}.n${index}`, version: '1.0.0',
      title: `lifecycle ${page} ${index}\u0000`, description: 'lifecycle ' + 'd'.repeat(1500), repository: {url: 'https://github.com/owned/lifecycle'},
      packages: [{registryType: 'npm', identifier: '@owned/lifecycle'}]}}));
    if (page === 0) {servers[0] = null; servers[1] = {server: {name: '', version: ''}};}
    return json({servers, metadata: {nextCursor: 'page' + (page + 1)}});
  }
  if (parsed.pathname === '/search/repositories') {
    assert.equal(parsed.searchParams.get('per_page'), '20');
    const items = Array.from({length: 25}, (_, index) => ({full_name: 'owned/lifecycle-' + index,
      pushed_at: '2026-11-17T00:00:00Z', html_url: 'https://github.com/owned/lifecycle-' + index, description: 'lifecycle metadata'}));
    items[0] = null; items[1] = {html_url: 'https://user:password@github.com/owned/lifecycle'};
    return json({items, incomplete_results: true});
  }
  if (parsed.pathname.endsWith('/commits/main')) return json({sha: fixtureCommit});
  assert.equal(url, 'https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/' + fixtureCommit + '/README.md');
  return Buffer.from(Array.from({length: 25}, (_, index) => `[lifecycle ${index}](https://github.com/owned/lifecycle-${index}) lifecycle description`).join('\n'));
};
function makeService() {
  permissions = api.createPermissionService({store, dataRoot: path.join(root, 'data'), owner: () => activeOwner,
    archived: async () => false, workspace: async () => ({path: workspace})});
  acquisition = api.createCapabilityAcquisition({sql, root: managedRoot, permissions, permissionsStore: store, fetcher,
    sanitize: async text => text.replace(/[\x00-\x1f]/gu, ' '), localNode: () => 'D:/Node/node.exe',
    register: async (artifact, context) => {
      report.registrationCalls.push({artifactId: artifact.id, owner: context.owner, expiresAt: artifact.expiresAt});
      return registerBehavior(artifact, context);
    }, revoke: async artifact => {
      assert.equal((await state.artifact(artifact.id)).status, 'revoked'); report.revocations.push(artifact.id);
    }});
}
makeService();
function task(label) {
  activeOwner = {sessionId, taskId: 'xitask_' + digest(label + (++taskNumber)), runId: 'run_' + label + '_' + taskNumber, generation: 1};
  const owner = structuredClone(activeOwner);
  return {owner, requirementsVersion: 1, workspace, signal: new AbortController().signal,
    current: () => api.permissionHash(activeOwner) === api.permissionHash(owner), persist: action => action(),
    recordAuthority: async (reference, refs) => report.authority.push({reference, refs, owner})};
}
let context = task('initial');
const reviewed = api.reviewedFilesystemCandidate();
async function approvePending() {
  for (const approval of (await store.approvals(sessionId)).filter(row => row.state === 'pending')) {
    await permissions.decide({sessionId, approvalId: approval.id, revision: approval.revision, decision: 'approve', scope: 'task'});
  }
}
const requestCount = () => report.requests.length;
const registrationCount = () => report.registrationCalls.length;
async function activeUnchanged() {assert.equal(api.permissionHash(await registry.snapshot()), oldRegistryHash);}
async function check(id, name, action) {
  const start = performance.now();
  try {await action(); report.checks.push({id, name, pass: true, durationMs: performance.now() - start}); console.log('PASS ' + id + ' ' + name);}
  catch (error) {report.checks.push({id, name, pass: false, durationMs: performance.now() - start, error: error.stack}); console.error('FAIL ' + id + ' ' + error.stack);}
  save();
}
try {
  await check('L01', 'Actual source adapters normalize bounded pages, fixed references and isolate bad entries', async () => {
    fetchMode = 'catalogs';
    const found = await acquisition.search('lifecycle\u0001', ['official_mcp', 'github', 'community'], context.signal);
    assert.equal(found.candidates.filter(row => row.source === 'official_mcp').length, 58);
    assert.equal(found.candidates.filter(row => row.source === 'github').length, 18);
    assert.equal(found.candidates.filter(row => row.source === 'community').length, 20);
    assert.equal(sourceRequests.filter(row => row.url.startsWith('https://registry.modelcontextprotocol.io')).length, 3);
    assert(found.candidates.every(row => row.name.length <= 160 && row.description.length <= 1000 && !/[\x00-\x1f]/u.test(row.name + row.description)));
    assert(found.candidates.filter(row => row.source === 'community').every(row => row.version === fixtureCommit));
    assert.equal((await state.artifacts()).length, 0); assert.equal(registrationCount(), 0);
    report.catalogCandidateCounts = {official: 58, github: 18, community: 20};
  });
  await check('L02', 'Offline metadata cache preserves original expiry and grants no verified artifact or execution', async () => {
    const cached = (await state.candidates()).map(row => ({...row, expiresAt: '2020-01-01T00:00:00.000Z'}));
    await state.cache(cached); fetchMode = 'offline';
    const found = await acquisition.search('lifecycle', ['official_mcp', 'github', 'community'], context.signal);
    assert(found.sourceStatus.every(row => row.status === 'cached'));
    assert(found.candidates.every(row => row.expiresAt === '2020-01-01T00:00:00.000Z'));
    assert.equal((await state.artifacts()).length, 0); assert.equal(registrationCount(), 0);
    report.metadataCacheBoundary = 'Expired discovery records retain their expiry and cached status. They are not verified artifacts.';
  });
  await check('L03', 'Previously verified public package and original Registry snapshot clone with exact byte identities', async () => {
    const sourceDb = new DatabaseSync(path.join(sourceRoot, 'app.db'), {readOnly: true});
    let sourceOperation; let registryRow;
    try {
      const row = sourceDb.prepare('SELECT payload_json,document_hash FROM xiaozhi_acquisition_artifacts_v1 LIMIT 1').get();
      sourceArtifact = JSON.parse(row.payload_json); assert.equal(api.permissionHash(sourceArtifact), row.document_hash);
      sourceOperation = JSON.parse(sourceDb.prepare("SELECT payload_json FROM xiaozhi_acquisition_operations_v1 WHERE json_extract(payload_json,'$.artifactId')=? LIMIT 1").get(sourceArtifact.id).payload_json);
      registryRow = sourceDb.prepare('SELECT * FROM xiaozhi_capability_registry_v1 WHERE id=1').get();
    } finally {sourceDb.close();}
    assert.equal(sourceArtifact.status, 'ready'); assert(Date.parse(sourceArtifact.expiresAt) > Date.now());
    const directory = path.join(managedRoot, 'versions', sourceOperation.plan.digest);
    await io.mkdir(path.dirname(directory), {recursive: true});
    await io.cp(sourceArtifact.binding.directory, directory, {recursive: true, dereference: false, errorOnExist: true, force: false});
    const files = await api.capabilityPackageFiles(directory); assert.equal(api.permissionHash(files), sourceArtifact.filesHash);
    assert.equal(sourceOperation.plan.digest, api.permissionHash({schemaVersion: 1, recipe: api.FILESYSTEM_RECIPE, runtime: api.NODE_RECIPE, lock: sourceOperation.plan.lock, bundler: 'esbuild@0.25.12'}));
    const oldContext = task('old-approved-task'); context = oldContext;
    const artifact = {...sourceArtifact, revision: 1, ownerTaskId: oldContext.owner.taskId,
      binding: {...sourceArtifact.binding, directory, executable: {...sourceArtifact.binding.executable, path: path.join(directory, 'node.exe')}}};
    await state.saveArtifact(artifact, 0); await state.cache([reviewed]);
    const operationId = 'xiacquisition_' + api.permissionHash({sessionId, taskId: oldContext.owner.taskId, candidateId: reviewed.id, candidateHash: reviewed.sourceHash});
    await state.saveOperation({...sourceOperation, id: operationId, owner: oldContext.owner, revision: 1, candidateId: reviewed.id,
      candidateHash: reviewed.sourceHash, plan: {...sourceOperation.plan, directory}, requirementsVersion: 1, phase: 'ready'}, 0);
    await sql.run('INSERT INTO xiaozhi_capability_registry_v1(id,revision,document_json,document_hash) VALUES(?,?,?,?)',
      [registryRow.id, registryRow.revision, registryRow.document_json, registryRow.document_hash]);
    oldRegistryHash = api.permissionHash(await registry.snapshot()); originalExpiry = artifact.expiresAt;
    await store.issue(sessionId, [{kind: 'dependency', source: 'https://registry.npmjs.org', package: api.FILESYSTEM_RECIPE.name,
      version: api.FILESYSTEM_RECIPE.version, sha256: sourceOperation.plan.digest, environment: directory, installScripts: false}],
    {kind: 'teacher', reference: 'owned-old-task'}, oldContext.owner.taskId);
    report.verifiedCache = {artifactId: artifact.id, files: files.length, bytes: artifact.installedBytes, originalExpiry, registryHash: oldRegistryHash};
  });
  await check('L04', 'New Task valid cache has zero GET and no network scope while old Task grant cannot authorize it', async () => {
    context = task('new-offline-task'); const before = requestCount(); const calls = registrationCount();
    const result = await acquisition.prepare(context, reviewed.id); assert.equal(result.phase, 'needs_approval'); assert.equal(result.error, 'permission_pending');
    assert.equal(requestCount(), before); assert.equal(registrationCount(), calls);
    const approval = (await store.approvals(sessionId)).find(row => row.state === 'pending' && row.request.owner.taskId === context.owner.taskId);
    assert(approval); assert(!approval.request.scopes.some(scope => scope.kind === 'network'));
    assert.equal(approval.request.scopes.filter(scope => scope.kind === 'dependency').length, 1);
    await activeUnchanged();
  });
  await check('L05', 'Explicit original Task approval enables offline reuse without sliding artifact TTL', async () => {
    await approvePending(); const before = requestCount(); const calls = registrationCount();
    const result = await acquisition.prepare(context, reviewed.id); assert.equal(result.phase, 'ready');
    assert.equal(requestCount(), before); assert.equal(registrationCount(), calls + 1);
    assert.equal((await state.artifact(sourceArtifact.id)).expiresAt, originalExpiry);
    assert(report.authority.at(-1).refs.length); assert.equal(permissions.engine.activeCount(), 0);
    await activeUnchanged();
  });
  await check('L06', 'Unknown discovery source remains quarantined before external acquisition or registration', async () => {
    const candidate = (await state.candidates()).find(row => row.source === 'github');
    const before = requestCount(); const calls = registrationCount();
    const result = await acquisition.prepare(context, candidate.id); assert.equal(result.phase, 'quarantined'); assert.equal(result.error, 'source_requires_review');
    assert.equal(requestCount(), before); assert.equal(registrationCount(), calls); await activeUnchanged();
  });
  await check('L07', 'Whole-plan unknown child license and lifecycle scripts reject before archive I/O', async () => {
    const prior = (await state.operations()).find(row => row.plan);
    for (const policy of ['root-script', 'child-script', 'child-license']) {
      const lock = structuredClone(prior.plan.lock);
      if (policy === 'root-script') lock[0].scripts.postinstall = 'node forbidden-fixture';
      if (policy === 'child-script') lock[1].scripts.postinstall = 'node forbidden-fixture';
      if (policy === 'child-license') lock[1].license = 'LicenseRef-Unreviewed';
      const stage = path.join(root, 'policy-' + policy); let fetches = 0;
      const scope = {kind: 'dependency', source: 'https://registry.npmjs.org', package: api.FILESYSTEM_RECIPE.name,
        version: api.FILESYSTEM_RECIPE.version, sha256: api.permissionHash(lock), environment: stage, installScripts: false};
      await store.issue(sessionId, [scope], {kind: 'teacher', reference: 'owned-policy-test'}, context.owner.taskId);
      const request = {schemaVersion: 2, owner: context.owner, requirementsVersion: 1, callId: 'policy_' + policy, action: 'owned_policy_test',
        inputDigest: api.permissionHash(lock), purpose: '合成无脚本执行策略核验', scopes: [scope], files: [], provider: null, classification: 'public', expiresAt: new Date(Date.now() + 120000).toISOString()};
      let observed;
      try {
        await permissions.engine.run(request, context.signal, authority => api.installLockedNpmCapability({lock, stage,
          signal: authority.signal, assert: authority.assert, localNode: 'D:/Node/node.exe',
          fetcher: async () => {fetches++; throw Error('unexpected_archive_io_before_policy');}}));
      } catch (error) {observed = error.message;}
      finally {if (fs.existsSync(stage)) await io.rm(stage, {recursive: true, force: false});}
      report.policyResults ||= []; report.policyResults.push({policy, observed, archiveFetches: fetches});
    }
    for (const result of report.policyResults) {
      assert.equal(result.observed, result.policy === 'child-license' ? 'license_requires_review' : 'install_scripts_require_review');
      assert.equal(result.archiveFetches, 0);
    }
    await activeUnchanged();
  });
  await check('L08', 'Wrong archive integrity is rejected by the original async SRI validator', async () => {
    await assert.rejects(api.verifyNpmIntegrity(Buffer.from('owned invalid archive bytes'), api.FILESYSTEM_RECIPE.integrity), /checksum_mismatch/);
    await activeUnchanged();
  });
  await check('L09', 'Cancellation deduplicates active prepare and explicit restart retry preserves old active facts', async () => {
    context = task('cancel-reopen'); await acquisition.prepare(context, reviewed.id); await approvePending();
    let entered; const registered = new Promise(resolve => {entered = resolve;});
    registerBehavior = async (_artifact, current) => {entered(); return new Promise((resolve, reject) => {
      const abort = () => reject(Error('cancelled')); current.signal.addEventListener('abort', abort, {once: true}); if (current.signal.aborted) abort();
    });};
    const calls = registrationCount(); const first = acquisition.prepare(context, reviewed.id); const second = acquisition.prepare(context, reviewed.id);
    await registered; const operation = (await state.operations()).find(row => row.owner.taskId === context.owner.taskId);
    assert.equal(operation.phase, 'registering'); assert(operation.plan); assert.equal(registrationCount(), calls + 1);
    await acquisition.cancel(sessionId, operation.id, operation.revision);
    const [a, b] = await Promise.all([first, second]); assert.equal(a.phase, 'cancelled'); assert.equal(a.id, b.id);
    assert.equal((await state.artifact(sourceArtifact.id)).status, 'ready'); assert.equal((await state.artifact(sourceArtifact.id)).expiresAt, originalExpiry);
    await activeUnchanged(); await acquisition.close(); assert.equal(permissions.engine.activeCount(), 0);
    db.close(); db = new DatabaseSync(databaseFile); store = api.createPermissionStore(sql); await store.migrate(); makeService();
    const before = registrationCount(); assert.equal((await state.operation(operation.id)).phase, 'cancelled'); assert.equal(registrationCount(), before);
    activeOwner = {...context.owner, runId: 'run_explicit_retry', generation: 2};
    const owner = structuredClone(activeOwner); context = {...context, owner, current: () => api.permissionHash(activeOwner) === api.permissionHash(owner)};
    registerBehavior = async artifact => ({serverId: artifact.serverId, schemaHash: artifact.schemaHash, evidence: ['owned-existing-validation-reference']});
    const result = await acquisition.prepare(context, reviewed.id); assert.equal(result.phase, 'ready'); assert.equal(registrationCount(), before + 1);
    assert.equal((await state.artifact(sourceArtifact.id)).expiresAt, originalExpiry); await activeUnchanged();
  });
  await check('L10', 'Original Sql CAS and integrity checks reject concurrent stale writes and corrupt facts', async () => {
    const current = await state.artifact(sourceArtifact.id);
    const results = await Promise.allSettled(['one', 'two'].map(label => state.saveArtifact({...current, revision: current.revision + 1,
      validationRefs: [...current.validationRefs, 'owned-cas-' + label]}, current.revision)));
    assert.equal(results.filter(row => row.status === 'fulfilled').length, 1); assert.equal(results.filter(row => row.status === 'rejected' && row.reason.message === 'conflict').length, 1);
    const original = (await sql.all('SELECT * FROM xiaozhi_acquisition_artifacts_v1 WHERE id=?', [sourceArtifact.id]))[0];
    await sql.run('UPDATE xiaozhi_acquisition_artifacts_v1 SET document_hash=? WHERE id=?', ['0'.repeat(64), sourceArtifact.id]);
    try {await assert.rejects(acquisition.binding(sourceArtifact.sourceHash, context.owner), /acquisition_state_corrupt/);}
    finally {await sql.run('UPDATE xiaozhi_acquisition_artifacts_v1 SET document_hash=? WHERE id=?', [original.document_hash, sourceArtifact.id]);}
    await activeUnchanged();
  });
  await check('L11', 'Modified verified artifact bytes fail before registration and preserve old active snapshot', async () => {
    const current = await state.artifact(sourceArtifact.id); const filename = path.join(current.binding.directory, 'server.mjs'); const original = await io.readFile(filename);
    const before = requestCount(); const calls = registrationCount();
    await io.appendFile(filename, '\n// owned file corruption');
    try {const result = await acquisition.prepare(context, reviewed.id); assert.equal(result.error, 'source_changed'); assert.equal(result.phase, 'failed');}
    finally {await io.writeFile(filename, original);}
    assert.equal(requestCount(), before); assert.equal(registrationCount(), calls); await activeUnchanged();
  });
  await check('L12', 'Expired artifact refuses binding and offline refresh cannot extend TTL', async () => {
    const current = await state.artifact(sourceArtifact.id); const expired = '2020-01-01T00:00:00.000Z';
    await state.saveArtifact({...current, revision: current.revision + 1, expiresAt: expired}, current.revision);
    await assert.rejects(acquisition.binding(current.sourceHash, context.owner), /permission_denied/);
    assert.equal(await acquisition.verifyProcess({kind: 'process', backend: 'appcontainer', executable: current.binding.executable.path,
      executableHash: current.binding.executable.sha256, workspace}), false);
    const before = requestCount(); const pending = await acquisition.prepare(context, reviewed.id); assert.equal(pending.phase, 'needs_approval'); assert.equal(requestCount(), before);
    const approval = (await store.approvals(sessionId)).find(row => row.state === 'pending' && row.request.owner.taskId === context.owner.taskId);
    assert(approval.request.scopes.some(scope => scope.kind === 'network')); await approvePending();
    const calls = registrationCount(); const result = await acquisition.prepare(context, reviewed.id);
    assert.equal(result.phase, 'failed'); assert.equal(result.error, 'source_unavailable'); assert(requestCount() > before);
    assert.equal((await state.artifact(current.id)).expiresAt, expired); assert.equal(registrationCount(), calls); await activeUnchanged();
  });
  await check('L13', 'Known revoked artifact rejects a new Task before offline metadata GET', async () => {
    const current = await state.artifact(sourceArtifact.id); await acquisition.revoke(current.id, current.revision);
    assert.equal(report.revocations.length, 1); await assert.rejects(acquisition.binding(current.sourceHash, context.owner), /permission_denied/);
    context = task('revoked-new-task'); const before = requestCount(); const calls = registrationCount();
    const result = await acquisition.prepare(context, reviewed.id);
    report.revokedAttempt = {phase: result.phase, error: result.error, getAttempts: requestCount() - before, registrationCalls: registrationCount() - calls};
    assert.equal(result.phase, 'failed'); assert.equal(result.error, 'permission_denied'); assert.equal(requestCount(), before);
    assert.equal(registrationCount(), calls); assert.equal((await state.artifact(current.id)).status, 'revoked');
  });
  await check('L14', 'Closing acquisition aborts pending public-source searches without replay or authority leaks', async () => {
    fetchMode = 'search_blocked';
    const pending = acquisition.search('lifecycle', ['official_mcp', 'github'], context.signal);
    const observed = assert.rejects(pending);
    await new Promise(resolve => setImmediate(resolve)); await acquisition.close(); await observed;
    assert.equal(permissions.engine.activeCount(), 0);
    report.permissionAudit = await sql.all('SELECT kind,reference,metadata_json FROM xiaozhi_permission_audit_v1 ORDER BY created_at,id');
    assert(report.permissionAudit.some(row => row.kind === 'execution_intent'));
    assert(report.permissionAudit.some(row => row.kind === 'capability_acquisition_failed'));
  });
  report.success = report.checks.every(row => row.pass); if (!report.success) process.exitCode = 1;
} catch (error) {report.error = error.stack; process.exitCode = 1; console.error(error);}
finally {await acquisition.close(); db.close(); save(); console.log(JSON.stringify({success: report.success, passed: report.checks.filter(row => row.pass).length,
  failed: report.checks.filter(row => !row.pass).length, root, output}));}
