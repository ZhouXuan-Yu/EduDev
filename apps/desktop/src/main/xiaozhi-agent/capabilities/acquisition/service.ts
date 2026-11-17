import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {canonicalMcp} from '../../mcp-schema';
import {protocolHash} from '../validation';
import {digest, containsPath} from '../../permissions/resources';
import {noLinks} from '../../managed-skills';
import type {PermissionService} from '../../permissions/service';
import type {PermissionStore} from '../../permissions/store';
import {openPermissionLease} from '../../permissions/lease';
import type {PermissionOwner, PermissionRequest, PermissionScope} from '../../../../shared/xiaozhi-permissions';
import {ACQUISITION_SCHEMA, type AcquisitionPhase, type AcquisitionView, type DiscoverySource} from '../../../../shared/xiaozhi-acquisition';
import {createAcquisitionState, type AcquisitionOperation, type AcquisitionArtifact} from './state';
import type {Sql} from '../../session-state';
import {createCapabilitySources, reviewedFilesystemCandidate} from './sources';
import {lockNpmGraph, type PublicFetch} from './npm-source';
import {capabilityPackageFiles, installLockedNpmCapability} from './npm-install';
import {FILESYSTEM_RECIPE, NODE_RECIPE} from './recipes';
import type {PreparedStdioBinding} from '../../mcp-controlled-service';
import {hashCapabilityFile} from './file-hash';

export type AcquisitionContext = {
  owner: PermissionOwner;
  requirementsVersion: number;
  workspace: string;
  signal: AbortSignal;
  current: () => boolean | Promise<boolean>;
  persist: <T>(action: () => Promise<T>) => Promise<T>;
  recordAuthority?: (reference: string, refs: {grantId: string; revision: number}[], callId?: string) => Promise<void>;
};
const knownErrors = new Set(['permission_pending', 'permission_denied', 'source_changed', 'cancelled', 'no_space', 'source_unavailable',
  'rate_limited', 'license_requires_review', 'source_requires_review', 'unsupported_runtime', 'unsupported_dependency', 'checksum_mismatch',
  'archive_invalid', 'install_scripts_require_review', 'missing_dependency', 'resource_budget', 'schema_changed', 'conflict']);
const errorCode = (error: unknown) => error instanceof Error && knownErrors.has(error.message) ? error.message : 'acquisition_failed';

export function createCapabilityAcquisition(options: {
  sql: Sql;
  root: string;
  permissions: PermissionService;
  permissionsStore: PermissionStore;
  fetcher: PublicFetch;
  sanitize: (text: string) => Promise<string>;
  localNode?: () => string | undefined;
  register: (artifact: AcquisitionArtifact, context: AcquisitionContext) => Promise<{serverId: string; schemaHash: string; evidence: string[]}>;
  revoke: (artifact: AcquisitionArtifact) => Promise<void>;
}) {
  const state = createAcquisitionState(options.sql);
  const sources = createCapabilitySources({state, fetcher: options.fetcher, sanitize: options.sanitize});
  const root = path.resolve(options.root);
  const running = new Map<string, {owner: PermissionOwner; controller: AbortController; result: Promise<AcquisitionOperation>}>();
  const searching = new Map<AbortController, Promise<unknown>>();
  let sourceStatus: AcquisitionView['sourceStatus'];
  const progressPhases = new Set<AcquisitionPhase>(['resolving', 'downloading', 'verifying', 'registering']);
  async function view(sessionId?: string): Promise<AcquisitionView> {
    return {schemaVersion: ACQUISITION_SCHEMA, candidates: await state.candidates(), sourceStatus,
      operations: (await state.operations()).filter(operation => !sessionId || operation.owner.sessionId === sessionId)
        .map(operation => {
          const {id, candidateId, revision, phase, error, artifactId, updatedAt} = operation;
          const work = running.get(operation.owner.taskId + ':' + candidateId);
          const active = !!work && protocolHash(work.owner) === protocolHash(operation.owner);
          const interrupted = progressPhases.has(phase) && !active;
          return {id, candidateId, revision, phase: interrupted ? 'interrupted' : phase,
            error: interrupted ? 'interrupted' : error, artifactId, updatedAt, running: active};
        }),
      artifacts: (await state.artifacts()).map(({id, name, version, source, license, revision, status, schemaHash, installedBytes, expiresAt}) =>
        ({id, name, version, source, license, revision, status, schemaHash, installedBytes, expiresAt}))};
  }
  const assertContext = async (context: AcquisitionContext) => {
    context.signal.throwIfAborted();
    if (!await context.current()) throw Error('permission_denied');
  };
  async function update(context: AcquisitionContext, operation: AcquisitionOperation, phase: AcquisitionPhase, error: string | null = null, terminal = false) {
    if (terminal) {if (!await context.current()) throw Error('permission_denied');}
    else await assertContext(context);
    return context.persist(() => state.saveOperation({...operation, phase, error, revision: operation.revision + 1, updatedAt: new Date().toISOString()}, operation.revision));
  }
  async function prepareWork(context: AcquisitionContext, candidateId: string) {
    await assertContext(context);
    const candidate = await state.candidate(candidateId);
    if (!candidate) throw Error('not_found');
    const id = 'xiacquisition_' + protocolHash({sessionId: context.owner.sessionId, taskId: context.owner.taskId, candidateId, candidateHash: candidate.sourceHash});
    const previous = await state.operation(id);
    let operation: AcquisitionOperation = {...previous, id, candidateId, candidateHash: candidate.sourceHash, owner: structuredClone(context.owner),
      requirementsVersion: context.requirementsVersion, revision: (previous?.revision || 0) + 1, phase: 'resolving', error: null,
      artifactId: previous?.artifactId || null, updatedAt: new Date().toISOString()};
    operation = await context.persist(() => state.saveOperation(operation, previous?.revision || 0));
    let lease: Awaited<ReturnType<typeof openPermissionLease>> | undefined;
    let stage: string | undefined;
    let stageOwned = false;
    try {
      if (candidate.source !== 'reviewed' || candidate.sourceHash !== protocolHash(FILESYSTEM_RECIPE)) {
        return update(context, operation, 'quarantined', 'source_requires_review');
      }
      if (!operation.plan) {
        const prior = (await state.operations()).find(item => item.candidateId === candidateId && item.candidateHash === candidate.sourceHash && item.plan);
        const cached = prior?.plan ? await state.artifact(prior.plan.artifactId) : null;
        if (cached?.status === 'revoked') throw Error('permission_denied');
        const lock = cached?.status === 'ready' && Date.parse(cached.expiresAt) > Date.now() && cached.recipeId === FILESYSTEM_RECIPE.id
          ? prior!.plan!.lock : await lockNpmGraph(FILESYSTEM_RECIPE.name, FILESYSTEM_RECIPE.version, options.fetcher, context.signal);
        await assertContext(context);
        const planDigest = protocolHash({schemaVersion: 1, recipe: FILESYSTEM_RECIPE, runtime: NODE_RECIPE, lock, bundler: 'esbuild@0.25.12'});
        operation = {...operation, plan: {artifactId: 'xiartifact_' + planDigest, digest: planDigest, directory: path.join(root, 'versions', planDigest), lock}, artifactId: 'xiartifact_' + planDigest};
        operation = await update(context, operation, 'resolving');
      }
      const plan = operation.plan!;
      if (!containsPath(path.join(root, 'versions'), plan.directory) || path.basename(plan.directory) !== plan.digest
          || plan.digest !== protocolHash({schemaVersion: 1, recipe: FILESYSTEM_RECIPE, runtime: NODE_RECIPE, lock: plan.lock, bundler: 'esbuild@0.25.12'})) throw Error('source_changed');
      let artifact = await state.artifact(plan.artifactId);
      if (artifact?.status === 'revoked') throw Error('permission_denied');
      const existingDirectory = await fs.stat(plan.directory).catch(() => null);
      if (artifact && existingDirectory && (artifact.recipeId !== FILESYSTEM_RECIPE.id || protocolHash(await capabilityPackageFiles(plan.directory)) !== artifact.filesHash)) throw Error('source_changed');
      const cachedReady = artifact?.status === 'ready' && !!existingDirectory && Date.parse(artifact.expiresAt) > Date.now();
      const scopes: PermissionScope[] = [{kind: 'dependency', source: 'https://registry.npmjs.org', package: FILESYSTEM_RECIPE.name,
        version: FILESYSTEM_RECIPE.version, sha256: plan.digest, environment: plan.directory, installScripts: false},
      ...(cachedReady ? [] : ['https://registry.npmjs.org', 'https://raw.githubusercontent.com', 'https://nodejs.org']).map(origin =>
        ({kind: 'network' as const, origin, methods: ['GET'], purpose: 'capability_dependency'}))];
      const request: PermissionRequest = {schemaVersion: 2, owner: context.owner, requirementsVersion: context.requirementsVersion,
        callId: id, action: 'capability_prepare', inputDigest: protocolHash(plan), purpose: '获取并验证已锁定的免费本地能力包与运行依赖',
        scopes, files: [], provider: null, classification: 'public', expiresAt: new Date(Date.now() + 3600000).toISOString()};
      lease = await openPermissionLease(options.permissions.engine, request, context.signal);
      await context.recordAuthority?.('acquisition:' + id, lease.authority.decision.grantRefs);
      noLinks(root, true);
      await fs.mkdir(path.join(root, 'versions'), {recursive: true});
      noLinks(path.join(root, 'versions'));
      if (!artifact || !existingDirectory) {
        operation = await update(context, operation, 'downloading');
        stage = path.join(root, 'versions', '.stage-' + plan.digest + '-' + randomUUID());
        const installed = await installLockedNpmCapability({lock: plan.lock, stage, fetcher: options.fetcher,
          signal: lease.authority.signal, assert: lease.authority.assert, localNode: options.localNode?.(), onStageCreated: () => {stageOwned = true;}});
        await lease.authority.assert();
        await assertContext(context);
        const files = installed.files.filter(entry => ['node.exe', 'server.mjs', 'package.json'].includes(entry.path));
        if (files.length !== 3) throw Error('source_changed');
        const binding: PreparedStdioBinding = {artifactId: plan.artifactId, version: FILESYSTEM_RECIPE.version, directory: plan.directory,
          source: 'https://registry.npmjs.org', package: FILESYSTEM_RECIPE.name, packageHash: plan.digest, files,
          executable: {path: path.join(plan.directory, 'node.exe'), sha256: NODE_RECIPE.sha256, packagePath: 'node.exe'},
          arguments: ['--no-addons', '--preserve-symlinks', '--preserve-symlinks-main', '$PACKAGE/server.mjs', ...FILESYSTEM_RECIPE.arguments],
          workspaceActions: ['read'], inputAdapter: 'filesystem_read', limits: {memoryBytes: 536870912, cpuRate: 5000, userTimeMs: 0, leaseMs: 3600000,
            maxInputBytes: 64 * 1048576, maxOutputBytes: 4194304, maxProcesses: 8}};
        const priorArtifact = artifact;
        artifact = {id: plan.artifactId, name: '本地资料只读访问', version: FILESYSTEM_RECIPE.version, source: 'https://registry.npmjs.org',
          license: FILESYSTEM_RECIPE.license, revision: (priorArtifact?.revision || 0) + 1, status: 'verifying', schemaHash: null, installedBytes: installed.installedBytes,
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), sourceHash: digest(canonicalMcp({transport: 'stdio',
            command: 'managed:' + plan.artifactId, args: [], cwd: ''})), ownerTaskId: context.owner.taskId,
          recipeId: FILESYSTEM_RECIPE.id, serverId: null, filesHash: protocolHash(installed.files), binding,
          installedFiles: installed.files, validationRefs: ['npm-lock:' + protocolHash(plan.lock), 'license:' + FILESYSTEM_RECIPE.licenseHash],
          attestation: {signature: 'unavailable', provenance: 'unavailable'}};
        // Intent and exact file identities are durable before the atomic directory activation.
        await options.permissionsStore.audit(context.owner.sessionId, 'capability_install_intent', id,
          {owner: context.owner, artifactId: artifact.id, filesHash: artifact.filesHash, recipeHash: plan.digest});
        if (priorArtifact && priorArtifact.filesHash !== artifact.filesHash) throw Error('source_changed');
        artifact = await context.persist(() => state.saveArtifact(artifact!, priorArtifact?.revision || 0));
        if (existingDirectory) {
          noLinks(plan.directory);
          if (protocolHash(await capabilityPackageFiles(plan.directory)) !== artifact.filesHash) throw Error('source_changed');
        } else {await fs.rename(stage, plan.directory); stage = undefined; stageOwned = false;}
        await assertContext(context);
      }
      if (artifact.recipeId !== FILESYSTEM_RECIPE.id) throw Error('source_changed');
      if (!(Date.parse(artifact.expiresAt) > Date.now())) {
        // Explicit preparation revalidates the pinned npm graph and all owned bytes before refreshing an expired artifact.
        const currentLock = await lockNpmGraph(FILESYSTEM_RECIPE.name, FILESYSTEM_RECIPE.version, options.fetcher, lease.authority.signal);
        if (protocolHash(currentLock) !== protocolHash(plan.lock)) throw Error('source_changed');
        artifact = await context.persist(() => state.saveArtifact({...artifact!, status: 'verifying', ownerTaskId: context.owner.taskId,
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), revision: artifact!.revision + 1}, artifact!.revision));
      }
      operation = await update(context, operation, 'registering');
      const registered = await options.register(artifact, context);
      await assertContext(context);
      artifact = await context.persist(() => state.saveArtifact({...artifact!, status: 'ready', serverId: registered.serverId,
        schemaHash: registered.schemaHash, validationRefs: [...artifact!.validationRefs, ...registered.evidence], revision: artifact!.revision + 1}, artifact!.revision));
      operation = await update(context, operation, 'ready');
      await lease.close(); lease = undefined;
      return operation;
    } catch (error) {
      const code = context.signal.aborted ? 'cancelled' : errorCode(error);
      await options.permissionsStore.audit(context.owner.sessionId, 'capability_acquisition_failed', id,
        {owner: context.owner, code, reason: await options.sanitize(error instanceof Error ? error.message.slice(0, 512) : 'acquisition_failed')}).catch(() => undefined);
      await lease?.close(error instanceof Error ? error : Error(code)).catch(() => undefined); lease = undefined;
      operation = await update(context, operation, code === 'permission_pending' ? 'needs_approval' : code === 'cancelled' ? 'cancelled' : 'failed', code, true).catch(() => operation);
      return operation;
    } finally {
      await lease?.close().catch(() => undefined);
      if (stage && stageOwned && containsPath(path.join(root, 'versions'), stage) && path.basename(stage).startsWith('.stage-')) {
        noLinks(stage);
        const resolved = await fs.realpath(stage);
        if (!containsPath(path.join(root, 'versions'), resolved)) throw Error('source_changed');
        await fs.rm(resolved, {recursive: true, force: false});
      }
    }
  }
  return {
    state,
    view,
    async search(query: string, selected: DiscoverySource[] | undefined, signal: AbortSignal) {
      const controller = new AbortController();
      const work = sources.search(query, selected, AbortSignal.any([signal, controller.signal]));
      searching.set(controller, work);
      try {const result = await work; sourceStatus = result.sourceStatus; return result;}
      finally {searching.delete(controller);}
    },
    async prepare(context: AcquisitionContext, candidateId: string) {
      const key = context.owner.taskId + ':' + candidateId;
      const prior = running.get(key);
      if (prior) {
        if (protocolHash(prior.owner) !== protocolHash(context.owner)) throw Error('busy');
        return prior.result;
      }
      const controller = new AbortController();
      const result = prepareWork({...context, signal: AbortSignal.any([context.signal, controller.signal])}, candidateId);
      running.set(key, {owner: context.owner, controller, result});
      try {return await result;} finally {running.delete(key);}
    },
    async binding(sourceHash: string, owner: PermissionOwner) {
      const artifact = await state.artifactBySource(sourceHash);
      if (!artifact || artifact.status !== 'ready' && !(artifact.status === 'verifying' && artifact.ownerTaskId === owner.taskId)
          || !(Date.parse(artifact.expiresAt) > Date.now())) throw Error('permission_denied');
      if (!containsPath(path.join(root, 'versions'), artifact.binding.directory)) throw Error('source_changed');
      return artifact.binding;
    },
    async verifyProcess(scope: Extract<PermissionScope, {kind: 'process'}>) {
      const artifact = (await state.artifacts()).find(row => row.binding.executable.path === scope.executable);
      if (!artifact || !['verifying', 'ready'].includes(artifact.status) || !(Date.parse(artifact.expiresAt) > Date.now())
          || artifact.recipeId !== FILESYSTEM_RECIPE.id || scope.executableHash !== NODE_RECIPE.sha256
          || !containsPath(path.join(root, 'versions'), artifact.binding.directory)) return false;
      return await hashCapabilityFile(scope.executable) === scope.executableHash;
    },
    async cancel(sessionId: string, operationId: string, revision: number) {
      const operation = await state.operation(operationId);
      if (!operation || operation.owner.sessionId !== sessionId || operation.revision !== revision) throw Error('conflict');
      const active = running.get(operation.owner.taskId + ':' + operation.candidateId);
      if (active) {active.controller.abort('cancelled'); await active.result;}
      return view(sessionId);
    },
    async revoke(artifactId: string, revision: number) {
      const artifact = await state.artifact(artifactId);
      if (!artifact || artifact.revision !== revision) throw Error('conflict');
      const revoked = await state.saveArtifact({...artifact, status: 'revoked', revision: artifact.revision + 1}, artifact.revision);
      await options.revoke(revoked);
      return view();
    },
    async ensureReviewed() {await state.cache([reviewedFilesystemCandidate()]);},
    async close() {
      for (const task of running.values()) task.controller.abort();
      for (const controller of searching.keys()) controller.abort();
      await Promise.allSettled([...[...running.values()].map(task => task.result), ...searching.values()]);
    },
  };
}
export type CapabilityAcquisition = ReturnType<typeof createCapabilityAcquisition>;
