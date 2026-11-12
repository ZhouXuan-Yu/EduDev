import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { PermissionScope } from '../../../shared/xiaozhi-permissions';
import {permissionHash} from './validation';

export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const objectIdentity = (stat: fs.Stats) => digest([stat.dev, stat.ino, stat.birthtimeMs].join(':'));

export function containsPath(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === '' || relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function ordinaryPath(filename: string) {
  if (!path.isAbsolute(filename) || /[\x00-\x1f]/u.test(filename)
      || /^\\\\/u.test(filename) || /:/u.test(filename.slice(path.parse(filename).root.length))) {
    throw Error('permission_denied');
  }
  let cursor = path.resolve(filename);
  while (true) {
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
      throw Error('permission_denied');
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}

export function filesystemScope(root: string, actions: ('read' | 'write' | 'delete')[]): Extract<PermissionScope, {kind: 'filesystem'}> {
  ordinaryPath(root);
  const canonical = fs.realpathSync(root);
  const stat = fs.lstatSync(canonical);
  if (!stat.isDirectory()) throw Error('permission_denied');
  return {kind: 'filesystem', root: canonical, identity: objectIdentity(stat), actions: [...new Set(actions)].sort()};
}

export function checkedFile(scope: Extract<PermissionScope, {kind: 'filesystem'}>, filename: string, action: 'read' | 'write' | 'delete') {
  ordinaryPath(scope.root);
  ordinaryPath(filename);
  const root = fs.realpathSync(scope.root);
  if (root !== scope.root || objectIdentity(fs.lstatSync(root)) !== scope.identity
      || !scope.actions.includes(action) || !containsPath(root, path.resolve(filename))) {
    throw Error('permission_denied');
  }
  let cursor = path.resolve(filename);
  while (!fs.existsSync(cursor)) {
    cursor = path.dirname(cursor);
  }
  if (!containsPath(root, fs.realpathSync(cursor))) throw Error('permission_denied');
  if (fs.existsSync(filename)) {
    const stat = fs.lstatSync(filename);
    if ((!stat.isFile() && !stat.isDirectory()) || stat.isFile() && stat.nlink !== 1) {
      throw Error('permission_denied');
    }
  }
  return path.resolve(filename);
}

export function scopeCovers(grant: PermissionScope, requested: PermissionScope): boolean {
  if (grant.kind !== requested.kind) return false;
  if (grant.kind === 'filesystem' && requested.kind === 'filesystem') {
    try {
      return containsPath(grant.root, requested.root)
        && requested.actions.every(action => {
          checkedFile(grant, requested.root, action);
          return true;
        }) && objectIdentity(fs.lstatSync(requested.root)) === requested.identity;
    } catch { return false; }
  }
  if (grant.kind === 'network' && requested.kind === 'network') {
    return grant.origin === requested.origin && grant.purpose === requested.purpose
      && requested.methods.every(method => grant.methods.includes(method));
  }
  if (grant.kind === 'egress' && requested.kind === 'egress') {
    return grant.origin === requested.origin && requested.classifications.every(value => grant.classifications.includes(value));
  }
  if (grant.kind === 'mcp' && requested.kind === 'mcp') {
    return grant.serverId === requested.serverId && grant.sourceHash === requested.sourceHash
      && grant.schemaHash === requested.schemaHash && requested.tools.every(tool => grant.tools.includes(tool));
  }
  if (grant.kind === 'extension' && requested.kind === 'extension') {
    return grant.extensionId === requested.extensionId && grant.sourceHash === requested.sourceHash
      && requested.actions.every(action => grant.actions.includes(action));
  }
  return permissionHash(grant) === permissionHash(requested);
}
