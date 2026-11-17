import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import type {Sql} from '../session-state';
import type {PermissionOwner, PermissionRequest, PermissionScope} from '../../../shared/xiaozhi-permissions';
import type {PermissionService} from '../permissions/service';
import type {PublicFetch} from '../capabilities/acquisition/npm-source';
import {NODE_RECIPE} from '../capabilities/acquisition/recipes';
import {prepareManagedNode} from '../capabilities/acquisition/node-runtime';
import {hashCapabilityFile} from '../capabilities/acquisition/file-hash';
import {boundedReadAsync, noLinksAsync} from '../skill-package-async';
import {containsPath, filesystemScope} from '../permissions/resources';
import {permissionHash, plain, exact} from '../permissions/validation';
import {openPermissionLease} from '../permissions/lease';
import {fileVersion} from '../workspace-files';
import {createExtensionState} from './state';
import {validManifest, extensionDependencySource} from './validation';
import type {ExtensionBinding, ExtensionContext, ExtensionManifest} from './types';
import {EXTENSION_PACKAGE_WORKER} from './package-worker';

type PackageFile = {path: string; bytes: number; sha256: string};
type SourceFile = PackageFile & {version: string};
export type ExtensionPackageContext = ExtensionContext & {
  recordAuthority?: (reference: string, refs: {grantId: string; revision: number}[]) => Promise<void>;
};
export type ExtensionPackageRecord = {
  schemaVersion: 1;
  artifactId: string;
  revision: number;
  manifest: ExtensionManifest;
  entry: string;
  provenance: {kind: 'local_import'; pickedPath: string; directoryFingerprint: string; trust: 'unknown'};
  files: PackageFile[];
  phase: 'quarantined' | 'preparing' | 'prepared' | 'needs_approval' | 'cancelled' | 'failed';
  attempt: {id: string; owner: PermissionOwner; expiresAt: string; processId?: number; stageName?: string} | null;
  binding: ExtensionBinding | null;
  error: string | null;
};

const prefix = 'xiaozhi.extension.package.v1.';
const limits = {nodes: 4096, files: 2048, depth: 16, fileBytes: 32 * 1048576, totalBytes: 128 * 1048576};
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const packageWorkerBytes = Buffer.from(EXTENSION_PACKAGE_WORKER);
// The .mjs bootstrap selects its own format. Payload .js files retain Node's native detection and their nearest package.json.
const packageMetadataBytes = Buffer.from(JSON.stringify({private: true}));
const internalSource = 'edudev-local://extensions';

function relativePath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 240 && !/[\\:\x00-\x1f]/u.test(value)
    && !value.startsWith('/') && value.split('/').every(part => part && part !== '.' && part !== '..'
      && !/[. ]$/u.test(part) && !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\..*)?$/iu.test(part));
}

async function tree(directory: string, signal: AbortSignal, maximumBytes = limits.totalBytes): Promise<SourceFile[]> {
  await noLinksAsync(directory, signal);
  const pending = [{relative: '', depth: 0}];
  const files: SourceFile[] = [];
  let nodes = 0;
  let bytes = 0;
  while (pending.length) {
    const current = pending.shift()!;
    if (current.depth > limits.depth) throw Error('resource_budget');
    const named = path.join(directory, current.relative);
    await noLinksAsync(named, signal);
    const before = await fs.lstat(named);
    if (!before.isDirectory()) throw Error('source_changed');
    const seen = new Set<string>();
    for (const entry of await fs.readdir(named, {withFileTypes: true})) {
      signal.throwIfAborted();
      const relative = current.relative ? current.relative + '/' + entry.name : entry.name;
      if (++nodes > limits.nodes || !relativePath(relative) || seen.has(entry.name.toLowerCase())) throw Error('invalid_package');
      seen.add(entry.name.toLowerCase());
      const filename = path.join(directory, relative);
      await noLinksAsync(filename, signal);
      const stat = await fs.lstat(filename);
      if (stat.isDirectory()) pending.push({relative, depth: current.depth + 1});
      else {
        bytes += stat.size;
        if (!stat.isFile() || stat.nlink !== 1) throw Error('source_changed');
        const managedNode = maximumBytes > limits.totalBytes && relative === 'node.exe';
        if (files.length >= limits.files || stat.size > limits.fileBytes && !managedNode || bytes > maximumBytes) throw Error('resource_budget');
        const version = fileVersion(stat);
        const digest = await hashCapabilityFile(filename, signal);
        if (fileVersion(await fs.lstat(filename)) !== version) throw Error('source_changed');
        files.push({path: relative, bytes: stat.size, sha256: digest, version});
      }
    }
    const after = await fs.lstat(named);
    if (fileVersion(before) !== fileVersion(after)) throw Error('source_changed');
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

const contentFiles = (files: SourceFile[]): PackageFile[] => files.map(({path, bytes, sha256}) => ({path, bytes, sha256}));

/** Copy the already hashed snapshot through opened handles and compare the exact bytes before accepting it. */
async function copySnapshot(source: string, destination: string, files: SourceFile[], signal: AbortSignal, assert: () => Promise<void>) {
  for (const entry of files) {
    await assert();
    await noLinksAsync(source, signal);
    const filename = path.join(source, entry.path);
    await noLinksAsync(filename, signal);
    const input = await fs.open(filename, 'r');
    let output: Awaited<ReturnType<typeof fs.open>> | undefined;
    try {
      const before = await input.stat();
      if (!before.isFile() || before.nlink !== 1 || fileVersion(before) !== entry.version) throw Error('source_changed');
      const target = path.resolve(destination, entry.path);
      if (!containsPath(destination, target)) throw Error('source_changed');
      await fs.mkdir(path.dirname(target), {recursive: true});
      await noLinksAsync(path.dirname(target), signal);
      output = await fs.open(target, 'wx');
      const digest = createHash('sha256');
      const buffer = Buffer.alloc(65536);
      let copied = 0;
      while (true) {
        await assert();
        const {bytesRead} = await input.read(buffer, 0, buffer.length, null);
        if (!bytesRead) break;
        copied += bytesRead;
        if (copied > entry.bytes) throw Error('source_changed');
        digest.update(buffer.subarray(0, bytesRead));
        let written = 0;
        while (written < bytesRead) {
          const result = await output.write(buffer, written, bytesRead - written, null);
          if (!result.bytesWritten) throw Error('write_failed');
          written += result.bytesWritten;
        }
      }
      await noLinksAsync(filename, signal);
      const named = await fs.lstat(filename);
      if (copied !== entry.bytes || digest.digest('hex') !== entry.sha256 || named.nlink !== 1
          || fileVersion(await input.stat()) !== entry.version || fileVersion(named) !== entry.version) throw Error('source_changed');
    } finally {
      await output?.close();
      await input.close();
    }
  }
}

function metadata(bytes: Buffer) {
  let value: unknown;
  try {value = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));}
  catch {throw Error('invalid_package');}
  if (!plain(value) || !exact(value, ['schemaVersion', 'extensionId', 'version', 'entry', 'hooks', 'license'])
      || value.schemaVersion !== 1 || !relativePath(value.entry) || !/\.(?:mjs|cjs|js)$/u.test(value.entry)) throw Error('invalid_package');
  const manifest = {schemaVersion: 1, extensionId: value.extensionId, version: value.version, source: internalSource + '/' + value.extensionId,
    sourceHash: '0'.repeat(64), license: value.license, licenseHash: '0'.repeat(64), artifactId: '0'.repeat(64), hooks: value.hooks};
  if (!validManifest(manifest)) throw Error('invalid_package');
  return {entry: value.entry, manifest};
}

/** Local package acquisition metadata, using the existing serialized Sql and original Permission engine. */
export function createExtensionPackageManager(options: {
  sql: Sql;
  permissions: PermissionService;
  root: string;
  fetcher: PublicFetch;
  localNode?: () => string | undefined;
}) {
  const root = path.resolve(options.root);
  const quarantineRoot = path.join(root, 'quarantine');
  const versionsRoot = path.join(root, 'versions');
  const extensionState = createExtensionState(options.sql);
  const active = new Set<string>();

  async function readyRoot() {
    let existing = root;
    while (true) {
      try {await fs.lstat(existing); break;}
      catch (error) {if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; existing = path.dirname(existing);}
    }
    await noLinksAsync(existing);
    await fs.mkdir(root, {recursive: true});
    await noLinksAsync(root);
    await fs.mkdir(quarantineRoot, {recursive: true});
    await fs.mkdir(versionsRoot, {recursive: true});
    await noLinksAsync(quarantineRoot);
    await noLinksAsync(versionsRoot);
  }

  async function read(artifactId: string, work = options.sql): Promise<ExtensionPackageRecord | null> {
    if (!/^[a-f0-9]{64}$/u.test(artifactId)) throw Error('invalid_input');
    const row = (await work.all('SELECT value_json FROM app_settings WHERE key=?', [prefix + artifactId]))[0];
    if (!row) return null;
    const stored = JSON.parse(String(row.value_json));
    const value = stored.document as ExtensionPackageRecord;
    if (!value || value.schemaVersion !== 1 || value.artifactId !== artifactId || !validManifest(value.manifest)
        || value.manifest.artifactId !== artifactId || !Number.isSafeInteger(value.revision) || value.revision < 1
        || value.provenance?.kind !== 'local_import' || value.provenance.trust !== 'unknown' || !Array.isArray(value.files)
        || permissionHash(value) !== stored.hash) throw Error('extension_package_state_corrupt');
    return value;
  }

  async function save(record: ExtensionPackageRecord, expectedRevision: number) {
    if (!options.sql.transaction) throw Error('configuration');
    return options.sql.transaction(async work => {
      const previous = await read(record.artifactId, work);
      if ((previous?.revision || 0) !== expectedRevision || record.revision !== expectedRevision + 1) throw Error('extension_package_revision_conflict');
      await work.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at',
        [prefix + record.artifactId, JSON.stringify({document: record, hash: permissionHash(record)}), new Date().toISOString()]);
      return record;
    });
  }

  async function verifyDirectory(directory: string, expected: PackageFile[], signal: AbortSignal) {
    const actual = contentFiles(await tree(directory, signal, limits.totalBytes + NODE_RECIPE.bytes + 1048576));
    if (permissionHash(actual) !== permissionHash(expected)) throw Error('source_changed');
  }

  async function assertVersion(manifest: ExtensionManifest) {
    const current = (await extensionState.read(manifest.extensionId)).versions.find(item => item.manifest.version === manifest.version);
    if (current?.revokedAt) throw Error('permission_denied');
    if (current && permissionHash(current.manifest) !== permissionHash(manifest)) throw Error('source_changed');
  }

  async function cleanupStage(stage: string) {
    if (!containsPath(root, stage) || !/^\.(?:import|prepare)-[a-f0-9-]{36}$/u.test(path.basename(stage))) throw Error('invalid_input');
    await noLinksAsync(stage);
    // A stage is created exclusively by this attempt and is never a caller-selected directory.
    await fs.rm(stage, {recursive: true, force: false});
  }
  async function cleanupInterruptedStage(attempt: ExtensionPackageRecord['attempt'], binding: ExtensionBinding | null, signal: AbortSignal) {
    if (!attempt?.stageName || !binding || !Number.isSafeInteger(attempt.processId) || attempt.processId! < 1
        || !/^\.prepare-[a-f0-9-]{36}$/u.test(attempt.stageName) || attempt.stageName !== '.prepare-' + attempt.id) return;
    const exited = () => {
      try {process.kill(attempt.processId!, 0); return false;}
      catch (error) {return (error as NodeJS.ErrnoException).code === 'ESRCH';}
    };
    if (!exited()) return;
    const directory = path.join(versionsRoot, attempt.stageName);
    const before = await fs.lstat(directory).catch(error => {if (error.code === 'ENOENT') return null; throw error;});
    if (!before) return;
    await noLinksAsync(directory, signal);
    if (!before.isDirectory() || path.dirname(await fs.realpath(directory)) !== await fs.realpath(versionsRoot)) throw Error('source_changed');
    await verifyDirectory(directory, binding.files, signal);
    const after = await fs.lstat(directory);
    if (before.dev !== after.dev || before.ino !== after.ino || !exited()) throw Error('source_changed');
    await cleanupStage(directory);
  }

  return {
    async list() {
      const rows = await options.sql.all('SELECT key FROM app_settings WHERE key LIKE ? ORDER BY key', [prefix + '%']);
      return Promise.all(rows.map(async row => {
        const record = await read(String(row.key).slice(prefix.length));
        if (!record) throw Error('extension_package_state_corrupt');
        return record;
      }));
    },

    async importCandidate(directory: string, input: {signal?: AbortSignal} = {}) {
      if (typeof directory !== 'string' || !directory || !path.isAbsolute(directory) || /^\\\\/u.test(directory)) throw Error('invalid_input');
      const signal = input.signal || new AbortController().signal;
      signal.throwIfAborted();
      await readyRoot();
      const picked = path.resolve(directory);
      if (containsPath(root, picked) || containsPath(picked, root)) throw Error('invalid_input');
      await noLinksAsync(picked, signal);
      const scope = filesystemScope(picked, ['read']);
      const snapshot = await tree(picked, signal);
      if (!snapshot.some(file => file.path === 'edudev.extension.json') || !snapshot.some(file => file.path === 'LICENSE')) throw Error('invalid_package');
      let stage: string | undefined = path.join(quarantineRoot, '.import-' + randomUUID());
      await fs.mkdir(stage);
      try {
        await copySnapshot(picked, stage, snapshot, signal, async () => {signal.throwIfAborted();});
        if (filesystemScope(picked, ['read']).identity !== scope.identity) throw Error('source_changed');
        const parsed = metadata(await boundedReadAsync(path.join(stage, 'edudev.extension.json'), 65536, signal));
        if (!snapshot.some(file => file.path === parsed.entry)) throw Error('invalid_package');
        const license = await boundedReadAsync(path.join(stage, 'LICENSE'), 512 * 1024, signal);
        if (!license.length) throw Error('invalid_package');
        const files = contentFiles(snapshot);
        const sourceHash = permissionHash({schemaVersion: 1, kind: 'local_import', directoryFingerprint: scope.identity, files});
        const artifactId = permissionHash({schemaVersion: 1, sourceHash, entry: parsed.entry, node: NODE_RECIPE,
          workerHash: sha(packageWorkerBytes), packageMetadataHash: sha(packageMetadataBytes)});
        const manifest = {...parsed.manifest, sourceHash, artifactId, licenseHash: sha(license)};
        if (!validManifest(manifest)) throw Error('invalid_package');
        const previous = await read(artifactId);
        const destination = path.join(quarantineRoot, artifactId);
        if (previous) {
          if (permissionHash(previous.files) !== permissionHash(files)) throw Error('source_changed');
          const exists = await fs.lstat(destination).then(() => true, error => {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            return false;
          });
          if (exists) await verifyDirectory(destination, previous.files, signal);
          else {
            await verifyDirectory(stage, previous.files, signal);
            await fs.rename(stage, destination);
            stage = undefined;
          }
          return previous;
        }
        // The metadata intent is durable before selecting the owned immutable snapshot.
        const record: ExtensionPackageRecord = {schemaVersion: 1, artifactId, revision: 1, manifest, entry: parsed.entry,
          provenance: {kind: 'local_import', pickedPath: scope.root, directoryFingerprint: scope.identity, trust: 'unknown'}, files,
          phase: 'quarantined', attempt: null, binding: null, error: null};
        await verifyDirectory(stage, files, signal);
        await save(record, 0);
        signal.throwIfAborted();
        await fs.rename(stage, destination);
        stage = undefined;
        return record;
      } finally {if (stage) await cleanupStage(stage);}
    },

    async prepare(artifactId: string, context: ExtensionPackageContext) {
      const persist = (record: ExtensionPackageRecord, revision: number) => context.persist ? context.persist(() => save(record, revision)) : save(record, revision);
      if (active.has(artifactId)) throw Error('resource_busy');
      active.add(artifactId);
      let record: ExtensionPackageRecord | null = null;
      let stage: string | undefined;
      let lease: Awaited<ReturnType<typeof openPermissionLease>> | undefined;
      let ownsAttempt = false;
      let interruptedAttempt: ExtensionPackageRecord['attempt'] = null;
      let interruptedBinding: ExtensionBinding | null = null;
      try {
        await readyRoot();
        context.signal.throwIfAborted();
        record = await read(artifactId);
        if (!record) throw Error('not_found');
        interruptedAttempt = record.attempt;
        interruptedBinding = record.binding;
        await assertVersion(record.manifest);
        await noLinksAsync(context.workspace, context.signal);
        if ((await fs.readdir(context.workspace)).length) throw Error('extension_workspace_not_empty');
        const owner = structuredClone(context.owner());
        if (record.phase === 'preparing' && record.attempt && Date.parse(record.attempt.expiresAt) > Date.now()
            && permissionHash(record.attempt.owner) === permissionHash(owner)) throw Error('resource_busy');
        const directory = path.join(versionsRoot, artifactId);
        const installed = !!record.binding && await fs.lstat(directory).then(() => true, error => {if (error.code === 'ENOENT') return false; throw error;});
        if (installed) await verifyDirectory(directory, record.binding!.files, context.signal);
        if (record.phase === 'prepared' && !installed) throw Error('source_changed');
        const source = extensionDependencySource(record.manifest.source);
        const scopes: PermissionScope[] = [
          {kind: 'extension', extensionId: record.manifest.extensionId, sourceHash: record.manifest.sourceHash, actions: ['install', 'run']},
          {kind: 'dependency', source, package: record.manifest.extensionId, version: record.manifest.version, sha256: artifactId, environment: directory, installScripts: false},
          {kind: 'dependency', source: 'https://nodejs.org', package: 'node', version: NODE_RECIPE.version, sha256: NODE_RECIPE.sha256, environment: directory, installScripts: false},
          {kind: 'process', backend: 'appcontainer', executable: path.join(directory, 'node.exe'), executableHash: NODE_RECIPE.sha256, workspace: context.workspace},
          filesystemScope(context.workspace, ['read']),
        ];
        if (!installed) scopes.push(...['https://nodejs.org', 'https://raw.githubusercontent.com'].map(origin =>
          ({kind: 'network' as const, origin, methods: ['GET'], purpose: 'extension_dependency'})));
        const request: PermissionRequest = {schemaVersion: 2, owner, requirementsVersion: context.requirementsVersion(),
          callId: 'extension_package_' + artifactId, action: 'extension_package_prepare', inputDigest: permissionHash({artifactId, sourceHash: record.manifest.sourceHash}),
          purpose: '准备教师选择的未知来源本地扩展及固定Node依赖', scopes, files: [], provider: null, classification: 'public',
          expiresAt: new Date(Date.now() + 3600000).toISOString()};
        lease = await openPermissionLease(options.permissions.engine, request, context.signal);
        const authority = lease.authority;
        await context.recordAuthority?.('extension_package:' + artifactId, authority.decision.grantRefs);
        const assert = async () => {
          if (permissionHash(context.owner()) !== permissionHash(owner)) throw Error('permission_denied');
          await authority.assert();
          await assertVersion(record!.manifest);
        };
        await assert();
        await verifyDirectory(path.join(quarantineRoot, artifactId), record.files, authority.signal);
        if (record.phase === 'prepared' && record.binding) {
          await verifyDirectory(directory, record.binding.files, authority.signal);
          await lease.close(); lease = undefined;
          return record;
        }
        const attemptId = randomUUID();
        record = await persist({...record, revision: record.revision + 1, phase: 'preparing', error: null,
          attempt: {id: attemptId, owner, expiresAt: request.expiresAt, processId: process.pid, stageName: '.prepare-' + attemptId}}, record.revision);
        ownsAttempt = true;
        if (record.binding && await fs.lstat(directory).then(() => true, () => false)) {
          await verifyDirectory(directory, record.binding.files, authority.signal);
        } else {
          stage = path.join(versionsRoot, record.attempt!.stageName!);
          await fs.mkdir(stage);
          const payload = path.join(stage, 'payload');
          await fs.mkdir(payload);
          const snapshot = await tree(path.join(quarantineRoot, artifactId), authority.signal);
          if (permissionHash(contentFiles(snapshot)) !== permissionHash(record.files)) throw Error('source_changed');
          await copySnapshot(path.join(quarantineRoot, artifactId), payload, snapshot, authority.signal, assert);
          await fs.writeFile(path.join(stage, 'extension-worker.mjs'), packageWorkerBytes, {flag: 'wx'});
          await fs.writeFile(path.join(stage, 'extension-config.json'), JSON.stringify({schemaVersion: 1, manifest: record.manifest, entry: record.entry}), {flag: 'wx'});
          await fs.writeFile(path.join(stage, 'package.json'), packageMetadataBytes, {flag: 'wx'});
          await prepareManagedNode({directory: stage, signal: authority.signal, assert, localNode: options.localNode?.(),
            fetcher: async (url, signal, maximumBytes, accept) => {
              if (![NODE_RECIPE.sourceUrl, NODE_RECIPE.licenseUrl].includes(url)) throw Error('permission_denied');
              await assert();
              const bytes = await options.fetcher(url, signal, maximumBytes, accept);
              await assert();
              return bytes;
            }});
          const files = contentFiles(await tree(stage, authority.signal, limits.totalBytes + NODE_RECIPE.bytes + 1048576));
          const binding: ExtensionBinding = {artifactId, version: record.manifest.version, directory, source, package: record.manifest.extensionId,
            packageHash: artifactId, files, executable: {path: path.join(directory, 'node.exe'), sha256: NODE_RECIPE.sha256, packagePath: 'node.exe'},
            arguments: ['--no-addons', '--preserve-symlinks', '--preserve-symlinks-main', '$PACKAGE/extension-worker.mjs'], workspaceActions: ['read'],
            limits: {memoryBytes: 536870912, cpuRate: 5000, userTimeMs: 0, leaseMs: 3600000, maxInputBytes: 4194304, maxOutputBytes: 4194304, maxProcesses: 8}};
          await assert();
          record = await persist({...record, revision: record.revision + 1, binding}, record.revision);
          await fs.rename(stage, directory);
          stage = undefined;
        }
        await assert();
        record = await persist({...record, revision: record.revision + 1, phase: 'prepared', attempt: null, error: null}, record.revision);
        await assert();
        await cleanupInterruptedStage(interruptedAttempt, interruptedBinding, authority.signal);
        await lease.close(); lease = undefined;
        return record;
      } catch (error) {
        const code = context.signal.aborted ? 'cancelled' : error instanceof Error && /^[a-z_]{1,80}$/u.test(error.message) ? error.message : 'extension_package_failed';
        await lease?.close(error instanceof Error ? error : Error(code)).catch(() => undefined); lease = undefined;
        if (record && (ownsAttempt || !['prepared', 'preparing'].includes(record.phase))) {
          record = await persist({...record, revision: record.revision + 1,
            phase: code === 'permission_pending' ? 'needs_approval' : code === 'cancelled' ? 'cancelled' : 'failed', attempt: null, error: code}, record.revision).catch(() => record);
        }
        throw error;
      } finally {
        if (stage) await cleanupStage(stage);
        await lease?.close();
        active.delete(artifactId);
      }
    },

    async binding(manifest: ExtensionManifest) {
      if (!validManifest(manifest)) throw Error('invalid_input');
      const record = await read(manifest.artifactId);
      if (!record || record.phase !== 'prepared' || !record.binding) throw Error('extension_package_unavailable');
      if (permissionHash(record.manifest) !== permissionHash(manifest)) throw Error('source_changed');
      await assertVersion(manifest);
      await verifyDirectory(record.binding.directory, record.binding.files, new AbortController().signal);
      return structuredClone(record.binding);
    },

    async verifyProcess(scope: Extract<PermissionScope, {kind: 'process'}>) {
      if (scope.backend !== 'appcontainer' || scope.executableHash !== NODE_RECIPE.sha256) return false;
      const directory = path.dirname(scope.executable);
      if (!containsPath(versionsRoot, directory) || path.dirname(directory) !== versionsRoot || path.basename(scope.executable) !== 'node.exe') return false;
      try {
        const record = await read(path.basename(directory));
        if (!record || record.phase !== 'prepared' || !record.binding || record.binding.executable.path !== scope.executable) return false;
        await assertVersion(record.manifest);
        await verifyDirectory(directory, record.binding.files, new AbortController().signal);
        return true;
      } catch {return false;}
    },
  };
}
