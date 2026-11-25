import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMcpRuntime} from '../../src/main/xiaozhi-agent/mcp-runtime';
import {createControlledMcpService, type PreparedStdioBinding} from '../../src/main/xiaozhi-agent/mcp-controlled-service';
import {createCapabilityRegistry} from '../../src/main/xiaozhi-agent/capabilities/registry';
import {createAcquisitionState, type AcquisitionArtifact} from '../../src/main/xiaozhi-agent/capabilities/acquisition/state';
import {createManagedMcpProviderRuntime, MANAGED_READ_CAPABILITY, managedMcpProviderId, registerManagedMcpArtifact} from '../../src/main/xiaozhi-agent/capabilities/acquisition/managed-mcp';
import type {CapabilityRequirement} from '../../src/main/xiaozhi-agent/capabilities/types';
import {protocolHash} from '../../src/main/xiaozhi-agent/capabilities/validation';
import {canonicalMcp} from '../../src/main/xiaozhi-agent/mcp-schema';
import {filesystemScope, digest} from '../../src/main/xiaozhi-agent/permissions/resources';
import type {createPermissionRuntimeManager} from '../../src/main/xiaozhi-agent/permissions/windows/runtime';
import type {PermissionService} from '../../src/main/xiaozhi-agent/permissions/service';
import type {PermissionStore} from '../../src/main/xiaozhi-agent/permissions/store';
import type {PermissionOwner} from '../../src/shared/xiaozhi-permissions';
import type {Sql} from '../../src/main/xiaozhi-agent/session-state';

const program = [
  '[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)',
  '[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)',
  '$fixtureRoot=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)',
  '$tools=@("read_text_file","list_directory","get_file_info") | ForEach-Object { @{name=$_;inputSchema=@{type="object";properties=@{path=@{type="string"}};required=@("path")}} }',
  'while($null -ne ($line=[Console]::ReadLine())){',
  ' $request=$line|ConvertFrom-Json',
  ' if($null -eq $request.id){continue}',
  ' switch($request.method){',
  '  "initialize" {if(Test-Path -LiteralPath (Join-Path $fixtureRoot "hold-init.txt")){continue};$value=@{protocolVersion=$request.params.protocolVersion;capabilities=@{tools=@{}};serverInfo=@{name="managed-fixture";version="1.0.0"}}}',
  '  "tools/list" {$value=@{tools=@($tools)}}',
  '  "tools/call" {$value=@{content=@(@{type="text";text=[IO.File]::ReadAllText($request.params.arguments.path)})}}',
  ' }',
  ' if($null -eq $value){continue}',
  ' [Console]::WriteLine((@{jsonrpc="2.0";id=$request.id;result=$value}|ConvertTo-Json -Depth 30 -Compress))',
  ' $value=$null',
  '}',
].join('\r\n');

export async function testManagedMcpRecovery(options: {sql: Sql; workspace: string; directory: string; owner: PermissionOwner;
  permissions: PermissionService; store: PermissionStore; runtime: ReturnType<typeof createPermissionRuntimeManager>;
  signal: AbortSignal; check: (name: string, action: () => Promise<void>) => Promise<void>}) {
  const {sql, workspace, directory, owner, permissions, store, runtime, signal, check} = options;
  const script = path.join(directory, 'managed-fixture.ps1');
  const topic = 'fixture-physics.txt';
  const outage = path.join(workspace, 'hold-init.txt');
  fs.writeFileSync(script, '\ufeff' + program);
  fs.writeFileSync(path.join(workspace, topic), 'MANAGED_MCP_SYNTHETIC_PHYSICS');
  const selected = await runtime.systemRuntime();
  const binding: PreparedStdioBinding = {
    artifactId: 'xiartifact_' + 'a'.repeat(64), version: '1.0.0', directory,
    source: 'https://example.invalid', package: 'managed-recovery-fixture', packageHash: digest(program),
    files: [{path: path.basename(script), sha256: digest(fs.readFileSync(script)), bytes: fs.statSync(script).size}],
    executable: {path: selected.path, sha256: selected.sha256},
    arguments: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', '$PACKAGE/managed-fixture.ps1'],
    inputAdapter: 'filesystem_read', workspaceActions: ['read'],
    limits: {memoryBytes: 536870912, cpuRate: 5000, userTimeMs: 0, leaseMs: 120000, maxInputBytes: 4194304, maxOutputBytes: 4194304, maxProcesses: 4},
  };
  const endpoint = 'managed:' + binding.artifactId;
  const sourceHash = createHash('sha256').update(canonicalMcp({transport: 'stdio', command: endpoint, args: [], cwd: ''})).digest('hex');
  const controlled = createControlledMcpService({permissions, store, runtime, binding: async source => {
    assert.equal(source.sourceHash, sourceHash);
    return binding;
  }});
  const registry = createCapabilityRegistry(sql);
  await registry.migrate();
  const state = createAcquisitionState(sql);
  const mcp = createMcpRuntime(sql, undefined, {timeoutMs: 3500});
  const context = {owner, requirementsVersion: 1, workspace, signal, current: () => true, persist: <T>(work: () => Promise<T>) => work()};
  const managedOptions = {mcp, controlled, registry, permissions, store, state, context};
  const adapter = createManagedMcpProviderRuntime(managedOptions);
  const capabilities = MANAGED_READ_CAPABILITY;
  const providerHash = protocolHash(binding.files);
  const requirement: CapabilityRequirement = {capabilityId: capabilities.id, contractVersion: capabilities.contractVersion,
    required: ['read_text'], optional: [], conditions: [], localOnly: true, platform: 'win32',
    budget: {latencyMs: 30000, resourceUnits: 1}};
  const services = (kind: string) => sql.all('SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind=? AND json_extract(metadata_json,\'$.serverId\')=?', [kind, artifact.serverId!]);
  const view = () => controlled.forOwner({owner: () => owner, signal, workspace, requirementsVersion: () => 1});
  const artifact: AcquisitionArtifact = {
    id: binding.artifactId, name: binding.package, version: binding.version, source: binding.source, license: 'MIT',
    revision: 1, status: 'ready', schemaHash: null, installedBytes: binding.files[0].bytes,
    expiresAt: new Date(Date.now() + 300000).toISOString(), sourceHash, ownerTaskId: owner.taskId, recipeId: 'managed-fixture',
    serverId: null, filesHash: providerHash, binding, installedFiles: binding.files, validationRefs: [],
    attestation: {signature: 'unavailable', provenance: 'unavailable'},
  };
  const providerId = managedMcpProviderId(artifact), version = artifact.version + '+' + providerHash.slice(0, 12);
  const inspect = async () => {
    const catalog = await mcp.catalog();
    const result = await mcp.inspect({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: artifact.serverId!}, view().transport);
    return result.servers.find(row => row.id === artifact.serverId)!;
  };

  try {
    await check('Managed fixture publishes a real SQLite binding after an AppContainer protocol and file canary', async () => {
      await store.issue(owner.sessionId, [filesystemScope(workspace, ['read']),
        {kind: 'process', backend: 'appcontainer', executable: selected.path, executableHash: selected.sha256, workspace},
        {kind: 'dependency', source: binding.source, package: binding.package, version: binding.version, sha256: binding.packageHash, environment: directory, installScripts: false}],
      {kind: 'teacher', reference: 'managed-recovery-fixed-fixture'});
      const catalog = await mcp.add({name: 'managed-recovery-fixture', transport: 'stdio', command: endpoint});
      artifact.serverId = catalog.servers.find(row => row.endpoint === endpoint)!.id;
      const first = await inspect();
      assert.equal(first.status, 'ready');
      assert(first.schemaHash);
      await store.issue(owner.sessionId, [{kind: 'mcp', serverId: artifact.serverId, sourceHash, schemaHash: first.schemaHash,
        tools: ['read_text_file']}], {kind: 'teacher', reference: 'managed-recovery-read-fixture'});
      const record = await registerManagedMcpArtifact(managedOptions, artifact);
      artifact.schemaHash = record.schemaHash;
      artifact.validationRefs = record.evidence;
      await state.saveArtifact(artifact, 0);
      const resolved = await adapter.resolveVersion(owner.sessionId, requirement, providerId, version, providerHash);
      assert.equal(resolved.selectedProviders[0]?.providerId, providerId);
    });
    await check('Actual managed stdio timeout preserves pinned SQLite trust and releases the failed Windows Job', async () => {
      const trusted = await mcp.trustedAuthority(artifact.serverId!);
      fs.writeFileSync(outage, 'synthetic handshake outage');
      const current = await inspect();
      assert.equal(current.lastError, 'timeout');
      assert.equal(current.status, 'failed');
      assert.equal(current.trustedSchemaHash, artifact.schemaHash);
      assert.deepEqual(await mcp.trustedAuthority(artifact.serverId!), trusted);
      assert.equal(await mcp.authority(artifact.serverId!), null);
      assert.equal(permissions.engine.activeCount(), 0);
    });
    await check('Managed recovery retries bounded metadata on the selected binding, then reads through the original Grant', async () => {
      const count = (await services('mcp_service_intent')).length;
      const denied = await adapter.resolveVersion(owner.sessionId, {...requirement, platform: 'linux'}, providerId, version, providerHash);
      assert.equal(denied.selectedProviders.length, 0);
      assert.equal((await services('mcp_service_intent')).length, count);
      const resolvePinned = () => adapter.resolveVersion(owner.sessionId, requirement, providerId, version, providerHash);
      const offline = await Promise.all([resolvePinned(), resolvePinned()]);
      assert(offline.every(result => result.selectedProviders.length === 0));
      assert.equal((await services('mcp_service_intent')).length - count, 1, 'authorized resolver must attempt one known metadata handshake');
      fs.unlinkSync(outage);
      const [resolved, concurrent] = await Promise.all([resolvePinned(), resolvePinned()]);
      assert.equal(resolved.selectedProviders[0]?.providerId, providerId);
      assert.equal(concurrent.selectedProviders[0]?.providerId, providerId);
      assert.equal((await services('mcp_service_intent')).length - count, 2);
      const result = await adapter.execute({...owner, stepId: null, callId: 'managed_read_after_reconnect', signal,
        grantRef: 'managed-recovery-fixture', idempotencyKey: 'synthetic-file-v1', budget: {timeoutMs: 30000, resourceUnits: 1},
        snapshot: {schema: 'xiaozhi.capability-snapshot.v1', snapshotId: 'fixture-snapshot', ...owner, capabilityId: requirement.capabilityId,
          registryRevision: resolved.registryRevision, requirement, selection: resolved.selectedProviders[0], providerHash,
          createdAt: new Date().toISOString(), evidenceRefs: [], previousSnapshotId: null, refreshReason: 'initial'}},
      {path: topic});
      assert.equal((result.data as {text: string}).text, 'MANAGED_MCP_SYNTHETIC_PHYSICS');
      assert.equal((await services('mcp_service_intent')).length - count, 2, 'real read keeps the recovered session');
      assert.equal((await state.artifact(artifact.id))?.revision, 1);
      const catalog = await mcp.catalog();
      await mcp.revoke({schemaVersion: catalog.schemaVersion, revision: catalog.revision, serverId: artifact.serverId!});
      assert.equal((await resolvePinned()).selectedProviders.length, 0);
      assert.equal((await services('mcp_service_intent')).length - count, 2, 'revocation never opens a replacement process');
      await adapter.dispose();
      assert.equal(permissions.engine.activeCount(), 0);
      const receipts = await sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='mcp_service_terminal' AND json_extract(metadata_json,'$.artifactId')=?", [artifact.id]);
      assert(receipts.length >= 5, 'failed and healthy Windows Jobs must have actual terminal receipts');
      for (const receipt of receipts) assert.deepEqual(JSON.parse(String(receipt.metadata_json)).result.cleanup,
        {jobActiveProcesses: 0, profileRemoved: true, remainingOwnedAces: 0});
    });
  } finally {
    await adapter.dispose();
    await mcp.dispose();
  }
}
