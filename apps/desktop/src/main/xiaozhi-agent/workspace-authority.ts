import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const inside = (root: string, target: string) => { const relative = path.relative(root.toLowerCase(), target.toLowerCase()); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };
export const workspaceHash = (root: string) => createHash('sha256').update(root).digest('hex');
export function authorizedWorkspace(raw: string, dataRoot: string) {
  if (!path.isAbsolute(raw) || !fs.lstatSync(raw).isDirectory() || fs.lstatSync(raw).isSymbolicLink()) throw new Error('permission_denied');
  const resolved = fs.realpathSync(raw), data = fs.realpathSync(dataRoot), home = process.env.USERPROFILE || '';
  const blocked = [path.join(home, '.codex'), path.join(home, '.pi'), path.join(home, '.ssh'), process.env.WINDIR || 'C:\\Windows'];
  if (resolved === path.parse(resolved).root || resolved.toLowerCase() === home.toLowerCase() || inside(data, resolved) || inside(resolved, data)
    || blocked.some(root => inside(root, resolved) || inside(resolved, root))) throw new Error('permission_denied');
  // Ancestor links also change the authority frozen in the session snapshot.
  let cursor = path.resolve(raw);
  while (cursor !== path.parse(cursor).root) {
    if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('permission_denied');
    cursor = path.dirname(cursor);
  }
  return resolved;
}
export function approvedFile(root: string, relative: string) {
  if (!relative || path.isAbsolute(relative) || /[:\x00-\x1f]/.test(relative)) throw new Error('permission_denied');
  const file = path.resolve(root, relative); if (!inside(root, file)) throw new Error('permission_denied');
  let cursor = root;
  for (const segment of path.relative(root, file).split(path.sep)) {
    cursor = path.join(cursor, segment);
    if (/^(\.env(?:\..*)?|\.git|\.codex|.*\.(?:key|pem))$/i.test(segment)) throw new Error('permission_denied');
    if (fs.existsSync(cursor) && (fs.lstatSync(cursor).isSymbolicLink() || !inside(root, fs.realpathSync(cursor)))) throw new Error('permission_denied');
  }
  return file;
}
export function verifyCopy(root: string, relative: string, hash: string) {
  const file = approvedFile(root, relative);
  if (!fs.existsSync(file)) return false;
  const stat = fs.lstatSync(file);
  return stat.isFile() && stat.nlink === 1 && stat.size <= 1048576 && createHash('sha256').update(fs.readFileSync(file)).digest('hex') === hash;
}
