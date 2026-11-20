import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkedFile, filesystemScope} from '../resources';

const identities = new Map<string, string>();
const pathKey = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value;

function directory(value: string) {
  if (!path.isAbsolute(value) || /[\x00-\x1f]/u.test(value)
      || process.platform === 'win32' && !/^[A-Za-z]:\\/u.test(value)) throw Error('invalid_projection');
  const scope = filesystemScope(value, ['read', 'write']);
  if (pathKey(scope.root) !== pathKey(path.resolve(value))) throw Error('invalid_projection');
  return scope;
}

function retainDirectory(value: string) {
  const scope = directory(value);
  const key = pathKey(scope.root);
  const retained = identities.get(key);
  if (retained && retained !== scope.identity) throw Error('invalid_projection');
  identities.set(key, scope.identity);
  return scope;
}

/** Host-owned storage is independent of a caller's custom TEMP/TMP ACLs. */
export function permissionTemporaryRoot(create = true) {
  if (process.platform !== 'win32') return directory(os.tmpdir()).root;
  const local = process.env.LOCALAPPDATA;
  if (!local) throw Error('invalid_projection');
  let scope = retainDirectory(local);
  for (const name of ['OmniEdu', 'PermissionRuntime', 'temp-v1']) {
    const target = checkedFile(scope, path.join(scope.root, name), 'write');
    if (!fs.existsSync(target)) {
      if (!create || identities.has(pathKey(target))) throw Error('invalid_projection');
      try {fs.mkdirSync(target, {mode: 0o700});}
      catch (error) {if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;}
    }
    scope = retainDirectory(target);
  }
  return scope.root;
}

/** Legacy OS-TEMP projections are accepted only by cleanup-only callers. */
export function projectionTemporaryRoot(root: string, allowLegacy = false) {
  const canonical = directory(root).root;
  if (pathKey(canonical) !== pathKey(root)
      || !/^xiaozhi-permission-exec-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(path.basename(root))) throw Error('invalid_projection');
  const parent = path.dirname(canonical);
  if (allowLegacy) {
    const legacy = os.tmpdir();
    if (path.isAbsolute(legacy) && pathKey(parent) === pathKey(path.resolve(legacy))) return directory(legacy).root;
  }
  const current = permissionTemporaryRoot(false);
  if (pathKey(parent) === pathKey(current)) return current;
  throw Error('invalid_projection');
}
