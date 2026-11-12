import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileVersion} from '../../workspace-files';
import {filesystemScope, checkedFile, digest, containsPath} from '../resources';
import type {CurrentPermission} from '../current';
import type {PermissionStore} from '../store';
import {withOwnedFileStage} from '../../owned-file-stage';

type Entry = {relative: string; kind: 'file' | 'directory'; version: string; hash: string | null; bytes: number};
export type ExecutionProjection = {
  executionId: string;
  root: string;
  cwd: string;
  originalRoot: string;
  entries: Entry[];
  excluded: string[];
};
const limits = {files: 4096, bytes: 128 * 1048576, fileBytes: 32 * 1048576};
const reserved = (relative: string) => relative.split(/[\\/]/u).some(part =>
  /^(?:\.runtime|\.xiaozhi-projection\.json|\.env(?:\..*)?|\.git|\.codex|\.ssh|\.pi|\.aws|\.azure|.*\.(?:pem|key))$/iu.test(part));

async function readTree(root: string, signal: AbortSignal, assert: () => Promise<void>) {
  const scope = filesystemScope(root, ['read']);
  const entries: Entry[] = [];
  const excluded: string[] = [];
  const pending = [''];
  let total = 0;
  while (pending.length) {
    signal.throwIfAborted();
    const relative = pending.shift()!;
    await assert();
    const directory = checkedFile(scope, path.join(root, relative), 'read');
    const children = await fs.promises.readdir(directory, {withFileTypes: true});
    for (const child of children) {
      const name = path.join(relative, child.name);
      if (reserved(name)) {excluded.push(name); continue;}
      await assert();
      const filename = checkedFile(scope, path.join(root, name), 'read');
      const stat = fs.lstatSync(filename);
      if (entries.length >= limits.files || stat.isFile() && stat.size > limits.fileBytes) throw Error('resource_budget');
      total += stat.isFile() ? stat.size : 0;
      if (total > limits.bytes) throw Error('resource_budget');
      let hash: string | null = null;
      if (stat.isFile()) {
        const bytes = await fs.promises.readFile(filename);
        if (fileVersion(fs.lstatSync(checkedFile(scope, filename, 'read'))) !== fileVersion(stat)) throw Error('source_changed');
        hash = digest(bytes);
      } else pending.push(name);
      entries.push({relative: name, kind: stat.isDirectory() ? 'directory' : 'file', version: fileVersion(stat), hash, bytes: stat.size});
    }
  }
  return {entries, excluded};
}

export async function prepareExecutionProjection(originalRoot: string, workdir: string, authority: CurrentPermission): Promise<ExecutionProjection> {
  await authority.assert();
  const originalScope = filesystemScope(originalRoot, ['read']);
  const originalCwd = checkedFile(originalScope, path.resolve(originalRoot, workdir), 'read');
  if (!fs.statSync(originalCwd).isDirectory()) throw Error('invalid_input');
  const snapshot = await readTree(originalRoot, authority.signal, authority.assert);
  const executionId = 'xiexec_' + randomUUID();
  const root = path.join(os.tmpdir(), 'xiaozhi-permission-exec-' + randomUUID());
  fs.mkdirSync(root, {recursive: false, mode: 0o700});
  try {
    for (const entry of snapshot.entries) {
      await authority.assert();
      const target = path.join(root, entry.relative);
      if (entry.kind === 'directory') fs.mkdirSync(target, {recursive: true});
      else {
        const source = checkedFile(originalScope, path.join(originalRoot, entry.relative), 'read');
        const bytes = await fs.promises.readFile(source);
        if (digest(bytes) !== entry.hash || fileVersion(fs.lstatSync(source)) !== entry.version) throw Error('source_changed');
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, bytes, {flag: 'wx', mode: 0o600});
      }
    }
    fs.writeFileSync(path.join(root, '.xiaozhi-projection.json'), JSON.stringify({schemaVersion: 1, executionId,
      grantHash: authority.decision.permissionSnapshotHash, owner: authority.request.owner}), {flag: 'wx', mode: 0o600});
    const cwd = path.join(root, path.relative(originalRoot, originalCwd));
    return {executionId, root, cwd, originalRoot, entries: snapshot.entries, excluded: snapshot.excluded};
  } catch (error) {
    removeOwnedProjection(root);
    throw error;
  }
}

export async function commitExecutionProjection(projection: ExecutionProjection, authority: CurrentPermission, store: PermissionStore) {
  await authority.assert();
  const original = filesystemScope(projection.originalRoot, ['read', 'write', 'delete']);
  const projected = filesystemScope(projection.root, ['read']);
  const result = await readTree(projection.root, authority.signal, authority.assert);
  const before = new Map(projection.entries.map(entry => [entry.relative, entry]));
  const after = new Map(result.entries.map(entry => [entry.relative, entry]));
  const changed = result.entries.filter(entry => !before.has(entry.relative) || entry.hash !== before.get(entry.relative)!.hash
    || entry.kind !== before.get(entry.relative)!.kind);
  const removed = projection.entries.filter(entry => !after.has(entry.relative));
  const verify = (entry: Entry | undefined, relative: string) => {
    const filename = checkedFile(original, path.join(projection.originalRoot, relative), entry ? 'read' : 'write');
    if (!entry) {if (fs.existsSync(filename)) throw Error('source_changed'); return filename;}
    if (!fs.existsSync(filename)) throw Error('source_changed');
    const stat = fs.lstatSync(filename);
    if (entry.kind === 'file' && (fileVersion(stat) !== entry.version || digest(fs.readFileSync(filename)) !== entry.hash)
        || entry.kind === 'directory' && !stat.isDirectory()) throw Error('source_changed');
    return filename;
  };
  for (const entry of [...changed, ...removed]) {
    await authority.assert();
    verify(before.get(entry.relative), entry.relative);
    if (before.has(entry.relative) && after.has(entry.relative) && before.get(entry.relative)!.kind !== after.get(entry.relative)!.kind) throw Error('unsupported_constraint');
  }
  const changes = [...changed.map(entry => ({path: entry.relative, action: before.has(entry.relative) ? 'write' : 'create',
    beforeHash: before.get(entry.relative)?.hash || null, afterHash: entry.hash})),
    ...removed.map(entry => ({path: entry.relative, action: 'delete', beforeHash: entry.hash, afterHash: null}))];
  await store.audit(authority.request.owner.sessionId, 'projection_commit_intent', projection.executionId,
    {owner: authority.request.owner, grantRefs: authority.decision.grantRefs, changes});
  const committed: string[] = [];
  try {
    for (const entry of changed.filter(item => item.kind === 'directory').sort((a, b) => a.relative.length - b.relative.length)) {
      await authority.assert();
      const destination = verify(before.get(entry.relative), entry.relative);
      fs.mkdirSync(checkedFile(original, destination, 'write'), {recursive: false});
      committed.push(entry.relative);
    }
    for (const entry of changed.filter(item => item.kind === 'file')) {
      await authority.assert();
      const destination = verify(before.get(entry.relative), entry.relative);
      const source = checkedFile(projected, path.join(projection.root, entry.relative), 'read');
      const bytes = await fs.promises.readFile(source);
      if (digest(bytes) !== entry.hash) throw Error('source_changed');
      await withOwnedFileStage(destination, bytes, stage => store.audit(authority.request.owner.sessionId,
        'projection_file_stage', projection.executionId, {owner: authority.request.owner, path: entry.relative, stage}), temporary => {
          authority.signal.throwIfAborted();
          verify(before.get(entry.relative), entry.relative);
          checkedFile(original, destination, 'write');
          if (before.has(entry.relative)) fs.renameSync(temporary, destination);
          else {fs.linkSync(temporary, destination); fs.unlinkSync(temporary);}
        });
      committed.push(entry.relative);
      await store.audit(authority.request.owner.sessionId, 'projection_file_committed', projection.executionId,
        {owner: authority.request.owner, path: entry.relative, afterHash: entry.hash, grantRefs: authority.decision.grantRefs});
    }
    for (const entry of removed.sort((a, b) => b.relative.length - a.relative.length)) {
      await authority.assert();
      const filename = verify(entry, entry.relative);
      checkedFile(original, filename, 'delete');
      if (entry.kind === 'directory') fs.rmdirSync(filename);
      else fs.unlinkSync(filename);
      committed.push(entry.relative);
      await store.audit(authority.request.owner.sessionId, 'projection_file_committed', projection.executionId,
        {owner: authority.request.owner, path: entry.relative, deleted: true, grantRefs: authority.decision.grantRefs});
    }
    return {executionId: projection.executionId, changes, committed, excluded: projection.excluded};
  } catch (error) {
    await store.audit(authority.request.owner.sessionId, 'projection_commit_partial', projection.executionId,
      {owner: authority.request.owner, committed, pending: changes.filter(change => !committed.includes(change.path))});
    throw error;
  }
}

export function assertOwnedProjection(root: string) {
  const temp = fs.realpathSync(os.tmpdir());
  if (!containsPath(temp, root) || path.dirname(root) !== temp || !/^xiaozhi-permission-exec-[a-f0-9-]{36}$/iu.test(path.basename(root))
      || fs.lstatSync(root).isSymbolicLink()) throw Error('invalid_projection');
}

export function removeOwnedProjection(root: string) {
  const absolute = path.resolve(root);
  assertOwnedProjection(absolute);
  if (fs.realpathSync(absolute) !== absolute) throw Error('invalid_projection');
  // Only a main-created direct child of the current TEMP execution root reaches here.
  fs.rmSync(absolute, {recursive: true, force: false});
}
